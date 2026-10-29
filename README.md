# Fantalytics NFL Lines Board

A self-contained lines board for Fantalytics.pro: spreads, totals and moneylines from 8 books plus consensus and best price, tap-to-pick, and a 1-10 confidence per game. Visitors' picks are saved in their own browser.

- `index.html` – the board (no build step, no dependencies)
- `lines.json` – the current lines; overwrite this file to update the board (the page re-checks every 5 minutes)

## Embed on Fantalytics.pro (Readdy)
Add an iframe pointing at the hosted page, e.g.

    <iframe src="https://pittardj.github.io/bet-tracker/" title="NFL Lines Board" allow="clipboard-write" style="width:100%;height:1400px;border:0" loading="lazy"></iframe>

Options: `?theme=dark` or `?theme=light` to force a theme, `?bg=transparent` to let your page background show through.
The page posts `{fantalyticsLinesHeight: <px>}` to its parent whenever its height changes, if you want the iframe to auto-size.

## Sharing picks
Tap prices to pick, add confidence, then use **Share link** in the picks tray. It copies a text card plus a link like `https://pittardj.github.io/bet-tracker/?p=...` (add `&n=YourName` to label it). Anyone opening the link sees those picks highlighted, with the price picked compared to the current consensus, and can save them or start their own. Add `&site=<url>` to the board's iframe src to make shared links point at your own page instead.

## Bet Ledger (`/ledger`)
A copy of the personal bet tracker at https://pittardj.github.io/bet-tracker/ledger/. On GitHub Pages it runs in single-browser mode: bets, picks and confidence are saved in that browser only (use Export CSV to back up), and it reads the same `lines.json` as the board. Account sync, two-player picks, comments and bet-history import need the Claude-hosted version.

## Google sign-in (Firebase)
Signing in with Google syncs a person's picks, confidence and comments across devices, and **Copy invite link** (`?g=<group>`) lets friends join the same group to see each other's picks side by side, with comments on each game.
- `firebase-config.js` holds the Firebase web config (public by design). With it set to `null` the board runs without sign-in.
- `firestore.rules` are the database security rules: group members can read each other's picks; each person can write only their own.
- In the Firebase console: enable Authentication → Google, create a Firestore database, paste `firestore.rules`, and add `pittardj.github.io` and `fantalytics.pro` under Authentication → Settings → Authorized domains.

## Odds comparison (`/compare`)
https://pittardj.github.io/bet-tracker/compare/ shows every game with all sportsbooks plus Polymarket and Kalshi side by side, the best number on each side highlighted, and each book's hold. Filter by market or hide exchanges. Exchange prices are the current ask converted to American odds, before fees. Embed with `?bg=transparent`.

## How the public board is built
`index.html` is generated from the Claude Bet Ledger page so both look and work the same:

    python3 tools/build_public.py path/to/bet-ledger.html

`shim.js` stands in for the Claude runtime: lines come from `lines.json`, picks sync through Firebase when signed in with Google (otherwise this browser), and the bet log stays in this browser. The previous standalone board is kept at `classic.html`.
