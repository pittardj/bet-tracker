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
