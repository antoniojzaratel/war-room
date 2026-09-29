# War Room

A live fantasy football toolkit for a Sleeper league (built for La Dinastía). One page, no server, no API keys: it reads your league straight from Sleeper in the browser.

| Module | What it does |
| --- | --- |
| **Live** | Your matchup as a scoreboard with live projection and win probability, plus every other matchup. Refreshes every 60 seconds during games. |
| **Lineup** | Optimal lineup from Sleeper projections scored with your league's exact settings, with "start X over Y" swaps. Players already playing stay locked. |
| **Rankings** | Season power rankings (all-play, record, lineup strength) and dynasty power rankings (starters, bench, draft picks, age, contention window). |
| **Forecast** | Champion and toilet bowl loser forecasts, playoff/bye/#1-seed odds, and what winning or losing this week does to your season. |
| **Trades** | Trade calculator with value and lineup impact for both sides, plus win-win trade ideas tested against every team. |
| **Waivers** | Best free agents, 48-hour trending adds, and your drop candidates. |
| **News** | League-wide injury report and NFL headlines tagged with who rosters each player. |
| **Sportsbook** | Play-money betting: spreads, moneylines, totals, team totals, player over/unders, player duels, specials, futures (champion, toilet bowl, playoffs, win totals) and parlays. Settles automatically from real Sleeper scores. |
| **Gazette** | *El Pasquín*, a weekly roast newspaper in Spanish or English built from real results. |

## Put it online with GitHub Pages (about 3 minutes)

1. Create a new **public** repository on GitHub, for example `war-room`. Don't add a README.
2. Upload everything in this folder (drag the files and folders into the repository page, or push with git — see below).
3. In the repository go to **Settings → Pages**. Under *Build and deployment* choose **Deploy from a branch**, branch **main**, folder **/ (root)**, then **Save**.
4. After a minute your site is live at `https://<your-github-username>.github.io/war-room/`. Share that link with the league.
5. Optional: put that address in `siteUrl` inside `js/config.js`, so the claude.ai preview links people to the live site.

Pushing with git instead of uploading:

```bash
git remote add origin https://github.com/<your-github-username>/war-room.git
git push -u origin main
```

## Using it with the league

- Everyone opens the same link. Each person picks themselves under **Change league** (their Sleeper username) or you send them a personal link: `.../war-room/?user=FerCantu2001`.
- A different league: `.../war-room/?league=<sleeper league id>`.
- Jump straight to a module: add `#book`, `#forecast`, `#paper` and so on to the link.
- Sportsbook chips live in each person's browser (1,000 to start). Use **Copy my bets for the group chat** to post slips and results.

## Changing things

- Default league and user: `js/config.js`.
- Each module is one file in `js/modules/`. A module registers itself with `registerModule({key, label, order, render})`, so adding a tab is one new file plus one `<script>` line in `index.html`.
- Shared data and models (Sleeper loading, optimal lineup, season simulation, values, picks) are in `js/core.js`.
- `python3 scripts/build.py` bundles everything into `dist/war-room.html`, a single file you can send to someone or open offline.

## Data sources

Sleeper API (league, rosters, matchups, projections, live points, brackets), ESPN public scoreboard and news (game clocks, headlines), FantasyCalc market values with a built-in model as fallback. Everything is fetched live on each visit; the large Sleeper players file is cached in the browser for a day, as Sleeper asks.
