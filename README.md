# Dynasty Room

The front office for your Sleeper leagues: [dynasty-room.com](https://dynasty-room.com).

Sign in with Google, link your Sleeper username, pick any of your leagues. Everything is computed in the browser from Sleeper's public data with our own value model and Monte Carlo simulations; accounts, payments and the AI gazette run on Supabase, Stripe and Anthropic.

| Module | Free | Premium |
| --- | --- | --- |
| **Live** | Every starter's points, pregame projection and live projection; win probability on the game clock | |
| **Lineup** | Most projected points this week and over the next four | Best chance to win: the lineup most likely to beat this week's opponent, with floors and ceilings |
| **Rankings** | Power and dynasty rankings; player rankings with tiers (week, rest of season, dynasty); Start/Sit simulator | |
| **Forecast** | Playoff, bye, title and toilet bowl odds; what this week is worth | Team outlook (dynasty, contender, win now, rising, rebuilding, tanking, stuck); next three seasons with aging and draft picks |
| **Trades** | Two-team calculator: value, lineup impact now and in two years | Three- and four-team trades; trade finder for win-win deals |
| **Waivers / News** | Free agents, trending adds, drop candidates, injury report, Sleeper-wide adds and drops | |
| **Sportsbook** (play money) | Spreads, moneylines, totals, team totals, singles, your bets | Player props and duels, specials, futures, parlays with same-game pricing, Hindsight backtests, league leaderboard |
| **History** | Trophy case | All-time standings, records, best players, MVPs, every season, graded trade ledger |
| **Gazette** | Weekly roast in Spanish or English | Written by AI in any language |

Premium is US$4.99 a month or US$14.99 a year. La Dinastía gets it free with an invite code.

## Layout

```
index.html, privacy.html, terms.html, _headers   the site (served as-is; no build step)
css/app.css
js/config.js          settings: Supabase URL and anon key, prices, data sources
js/core.js            Sleeper loading, value model, lineup optimizer, simulations, future model, brackets
js/account.js         Google sign-in, plans, Premium locks, checkout
js/modules/*.js       one file per tab; each calls registerModule({key, label, order, render})
js/app.js             landing page, Sleeper linking, league picker, routing, boot
supabase/migrations   database schema with row level security
supabase/functions    create-checkout, billing-portal, stripe-webhook, ai-gazette
docs/LAUNCH.md        step-by-step launch on dynasty-room.com
scripts/build.py      bundles everything into dist/dynasty-room.html
```

## Running locally

Serve the folder with any static server, for example `python3 -m http.server 8080`, and open `http://localhost:8080`. With `supabase.url` empty in `js/config.js` it runs in dev mode: Sleeper username sign-in, every feature unlocked, bets saved in the browser.

## Launching

Follow [docs/LAUNCH.md](docs/LAUNCH.md).

## Data

Sleeper (leagues, rosters, matchups, projections, dynasty ADP, schedule, trending players, brackets, drafts, transactions), ESPN's public scoreboard for live game clocks (optional, `sources.espnClock`). Player values, forecasts, odds and lineups come from Dynasty Room's own models. Not affiliated with Sleeper, the NFL or any team.
