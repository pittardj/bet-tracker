#!/usr/bin/env python3
"""Refresh live NFL scores in lines.json using ESPN's public scoreboard feed.

The public Bet Tracker reads lines.json directly, so this job updates that file
without requiring a browser, Claude session, or API key.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "lines.json"
USER_AGENT = "Fantalytics-Bet-Tracker/1.0 (+https://pittardj.github.io/bet-tracker/)"


def iso_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def fetch_scoreboard(start: datetime, end: datetime) -> list[dict]:
    date_range = f"{start:%Y%m%d}-{end:%Y%m%d}"
    url = (
        "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard"
        f"?dates={date_range}&limit=1000"
    )
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    events = payload.get("events")
    if not isinstance(events, list):
        raise RuntimeError("ESPN response did not contain an events list")
    return events


def team_name(value: str) -> str:
    return " ".join(value.casefold().replace("&", "and").split())


def event_live(event: dict, updated_at: str) -> dict | None:
    competitions = event.get("competitions") or []
    if not competitions:
        return None
    competition = competitions[0]
    competitors = competition.get("competitors") or []
    by_side = {c.get("homeAway"): c for c in competitors}
    away, home = by_side.get("away"), by_side.get("home")
    if not away or not home:
        return None
    status = competition.get("status") or event.get("status") or {}
    status_type = status.get("type") or {}
    state = status_type.get("state")
    if state not in {"pre", "in", "post"}:
        # Postponed/canceled events should not be mistaken for a final.
        return None
    try:
        away_score = int(away.get("score") or 0)
        home_score = int(home.get("score") or 0)
    except (TypeError, ValueError):
        return None
    detail = status_type.get("description") or ("Final" if state == "post" else "Live" if state == "in" else "Scheduled")
    return {
        "state": state,
        "a": away_score,
        "h": home_score,
        "detail": detail,
        "clock": status.get("displayClock") or "15:00",
        "period": status.get("period") or 0,
        "updatedAt": updated_at,
        "source": "ESPN",
        "eventId": str(event.get("id") or ""),
    }


def main() -> int:
    data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    games = data.get("games")
    if not isinstance(games, list) or not games:
        raise RuntimeError("lines.json has no games; refusing to write")

    now = datetime.now(timezone.utc)
    events = fetch_scoreboard(now - timedelta(days=3), now + timedelta(days=8))
    updated_at = iso_now()

    # Match by full team names, not abbreviations (ESPN and sportsbook feeds
    # sometimes use different abbreviations for the same franchise).
    event_by_matchup = {}
    for event in events:
        comps = (event.get("competitions") or [])
        if not comps:
            continue
        competitors = comps[0].get("competitors") or []
        sides = {c.get("homeAway"): c for c in competitors}
        if "away" not in sides or "home" not in sides:
            continue
        away_name = team_name((sides["away"].get("team") or {}).get("displayName", ""))
        home_name = team_name((sides["home"].get("team") or {}).get("displayName", ""))
        if away_name and home_name:
            event_by_matchup[(away_name, home_name)] = event

    matched = 0
    for game in games:
        key = (team_name(game.get("away", "")), team_name(game.get("home", "")))
        event = event_by_matchup.get(key)
        if not event:
            continue
        live = event_live(event, updated_at)
        if live is None:
            continue
        previous = game.get("live") or {}
        # Ignore routine game-clock ticks so the workflow only commits
        # meaningful score, period, or status changes.
        meaningful = any(
            previous.get(field) != live.get(field)
            for field in ("state", "a", "h", "period", "detail")
        )
        if meaningful:
            game["live"] = live
        matched += 1

    if matched == 0:
        raise RuntimeError(
            f"ESPN returned {len(events)} events but none matched the {len(games)} games "
            "in lines.json; refusing to overwrite the file"
        )

    changed = sum(1 for game in games if game.get("live", {}).get("updatedAt") == updated_at)
    if changed:
        data["scoresUpdatedAt"] = updated_at
        data["scoresSource"] = "ESPN"
        DATA_FILE.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Matched {matched} of {len(games)} listed games; published {changed} meaningful score/status changes at {updated_at}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, urllib.error.URLError, RuntimeError) as exc:
        print(f"Score refresh failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
