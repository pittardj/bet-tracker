# Fantalytics NFL Lines Board

A self-contained lines board for Fantalytics.pro: spreads, totals and moneylines from 8 books plus consensus and best price, tap-to-pick, and a 1-10 confidence per game. Visitors' picks are saved in their own browser.

- `index.html` – the board (no build step, no dependencies)
- `lines.json` – the current lines; overwrite this file to update the board (the page re-checks every 5 minutes)

## Embed on Fantalytics.pro (Readdy)
Add an iframe pointing at the hosted page, e.g.

    <iframe src="https://pittardj.github.io/bet-tracker/" title="NFL Lines Board" style="width:100%;height:1400px;border:0" loading="lazy"></iframe>

Options: `?theme=dark` or `?theme=light` to force a theme, `?bg=transparent` to let your page background show through.
The page posts `{fantalyticsLinesHeight: <px>}` to its parent whenever its height changes, if you want the iframe to auto-size.
