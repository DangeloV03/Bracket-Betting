Here’s a product-ready PRD you can use as the starting spec for a **Next.js + FastAPI + Supabase** build.

A few implementation calls I made up front:

* I’d design this so **manual result entry always works**, even if live data fails.
* For production, the safest live-data option is a **licensed provider like Sportradar**. Its NBA API is an official B2B REST API. ([Getting Started][1])
* A cheaper fallback is **TheSportsDB**, which offers a sports API and says its premium tier includes **2-minute live scores**. ([The Sports DB][2])
* I would **not** build the core product around scraping undocumented NBA.com endpoints. NBA.com clearly has live scores and postseason pages, but I did not find a public official developer API from NBA.com itself in this search, while third-party tooling like `nba_api` explicitly describes itself as a client for NBA.com rather than an official NBA developer platform. ([NBA][3])

---

# PRD — NBA Playoff Bracket App

## 1. Product summary

A web app where users create and submit their NBA postseason bracket, including:

* both **Play-In Tournament** matchups
* all **playoff series**
* **number of games** each series takes
* **game-by-game NBA Finals picks**

Once brackets lock, users can view other submitted brackets and follow a live leaderboard as actual postseason results come in.

The NBA’s play-in format currently uses seeds **7 vs 8** and **9 vs 10** in each conference, with winners/losers advancing as expected for the 7-seed and 8-seed paths. The 2026 postseason schedule page says the Play-In Tournament is **April 14–17, 2026**, the first round starts **April 18**, and Game 1 of the NBA Finals is **June 3**. ([NBA][4])

---

## 2. Goals

### Primary goal

Create the most fun and competitive way for a friend group or community to predict the NBA postseason.

### Secondary goals

* Make bracket creation fast and intuitive
* Make leaderboard scoring transparent
* Let users compare their bracket to others
* Support either manual or automatic result updates
* Keep the app stable even if external sports data is delayed or unavailable

---

## 3. Non-goals

* Sports betting or gambling features
* Real-money prizes
* Deep player stat analysis
* Full fantasy sports functionality
* Full NBA regular-season coverage beyond determining postseason seeds and results

---

## 4. Users

### Commissioner / admin

The person who creates the season pool, verifies settings, can manually seed the bracket if needed, and can override outcomes.

### Participant

A user who joins the pool, fills out a bracket, submits it before lock, and checks standings during the postseason.

### Viewer

A logged-in user who wants to compare submitted brackets after lock.

---

## 5. Core user stories

### Bracket setup

* As an admin, I can create a postseason pool for a specific NBA season.
* As an admin, I can populate the bracket from live standings/data or enter seeds manually.
* As an admin, I can edit matchups before the lock deadline.

### Bracket submission

* As a user, I can join a pool.
* As a user, I can pick the winner of each Play-In game.
* As a user, I can pick the winner of each playoff series.
* As a user, I can pick how many games each series takes.
* As a user, I can pick NBA Finals outcomes game by game.
* As a user, I can save a draft and come back later.
* As a user, I can submit my bracket and see that it is locked.

### Social and leaderboard

* As a user, I can view everyone’s submitted brackets after lock.
* As a user, I can see a leaderboard sorted by score.
* As a user, I can click a person and compare my bracket to theirs.
* As a user, I can see where I earned or missed points.

### Result updates

* As an admin, I can manually enter game and series outcomes.
* As an admin, I can trigger a sync from an NBA data provider.
* As a user, I can trust that scores update quickly and correctly.

---

## 6. Product rules

### Bracket structure

The app must support:

* Eastern Conference Play-In
* Western Conference Play-In
* First Round
* Conference Semifinals
* Conference Finals
* NBA Finals

### Finals prediction format

For the Finals only, users do not just pick “Team A in 6.”
They also pick each game result individually:

* Game 1 winner
* Game 2 winner
* ...
* Game 7 winner if needed

### Locking

* Brackets lock at the configured time, likely the first Play-In tipoff
* No edits allowed after lock
* Admin can unlock only through an explicit override action with audit logging

### Viewing others’ brackets

* Before lock: only your own bracket is visible
* After lock: all submitted brackets become viewable within the pool

---

## 7. Scoring system

User-provided scoring model:

* **5 points** for a correct Play-In prediction
* **10 points** for a correct series winner
* **5 points** for correct number of games in a series
* **5 points** for each correct NBA Finals game outcome

### Recommended clarification

Decide whether “correct number of games” only counts if the series winner is also correct.

Recommended rule:

* User gets the **5 points for series length only if the winner is also correct**
* This avoids weird cases like picking “Knicks in 6” and receiving partial credit when Celtics win in 6

### Tiebreakers

Recommended tie-break order:

1. Most correct series winners
2. Most exact series-length predictions
3. Most correct Finals game picks
4. Earliest submission timestamp

---

## 8. Functional requirements

## 8.1 Authentication and users

* Email/password auth via Supabase Auth
* Optional Google sign-in later
* Profile contains username, display name, avatar
* User can belong to multiple pools later, though v1 can support one pool

## 8.2 Pool management

* Admin can create a pool with:

  * title
  * season
  * lock datetime
  * scoring settings
  * privacy setting: private or public
* Admin can invite users by link or code

## 8.3 Bracket builder

* Show full bracket visually
* Each matchup card includes:

  * team logos
  * seeds
  * team names
  * pick controls
  * number-of-games selector
* Finals card includes individual game pick controls
* Save draft automatically
* Warn before submission
* After submission, bracket becomes read-only

## 8.4 Results ingestion

* System stores:

  * actual play-in winners
  * actual series winners
  * actual series lengths
  * actual Finals game-by-game outcomes
* Support two update modes:

  * manual admin entry
  * API sync

## 8.5 Leaderboard

* Display:

  * rank
  * username
  * total score
  * correct play-in picks
  * correct series winners
  * correct series lengths
  * correct Finals game picks
* Auto-recompute when results update
* Show “points earned this round”

## 8.6 Bracket comparison

* User can compare any two brackets
* Differences highlighted matchup by matchup
* Correct picks shown in green, incorrect in red, pending in neutral

## 8.7 Admin tools

* Force refresh data sync
* Manually edit seeds/matchups/results
* View sync logs
* View scoring recalculation log
* Export standings as CSV

---

## 9. UX requirements

## Main pages

1. Landing page
2. Sign up / login
3. Pool dashboard
4. Bracket builder
5. My bracket view
6. Leaderboard
7. Compare brackets
8. Admin console

## UX principles

* Bracket should feel visual first, form second
* Mobile should still work, but desktop is the main experience
* Save progress automatically
* Surface lock deadlines clearly
* Never let data-sync uncertainty block manual updates

---

## 10. Technical architecture

## Frontend

**Next.js**

* App Router
* TypeScript
* Tailwind
* Server components for pool pages where useful
* Client components for bracket interactions

## Backend

**FastAPI**

* Business logic
* scoring engine
* bracket generation
* admin sync endpoints
* webhook / cron-compatible sync jobs

## Database + auth

**Supabase**

* Postgres
* Auth
* Row-level security
* Realtime subscriptions for leaderboard updates if desired
* Storage for avatars later

## Suggested architecture pattern

* Next.js = UI and authenticated app shell
* FastAPI = authoritative application logic
* Supabase Postgres = persistent data store
* External NBA API = standings, games, series outcomes
* Scheduled worker / cron = periodic result sync

---

## 11. NBA data strategy

## Recommended approach

### Option A — production-safe

Use **Sportradar NBA API**

* Official commercial product
* REST API
* Better for reliability and legal clarity in production ([Getting Started][1])

### Option B — lower-cost fallback

Use **TheSportsDB**

* Simpler and cheaper
* Premium offering claims 2-minute live scores ([The Sports DB][2])

### Option C — dev-only / prototype

Use NBA.com-derived unofficial tooling like `nba_api`

* Good for experimentation
* Not what I’d anchor a production consumer app on, especially if you want dependable uptime and clean licensing posture ([NBA-API Documentation][5])

## Data needed

* Final regular-season standings or seeds
* Play-In schedule and results
* Playoff bracket matchups
* Game results
* Series status
* Finals game outcomes

## Sync cadence

Recommended:

* every 5 minutes on game days
* every 30–60 minutes otherwise
* manual “refresh now” button for admin

---

## 12. Data model

## users

* id
* email
* username
* display_name
* avatar_url
* created_at

## pools

* id
* name
* season
* created_by
* is_public
* lock_at
* scoring_config_json
* status

## pool_members

* id
* pool_id
* user_id
* role

## teams

* id
* external_api_id
* conference
* city
* name
* abbreviation
* logo_url

## postseason_matchups

* id
* season
* round_type

  * playin
  * first_round
  * semifinals
  * conference_finals
  * finals
* conference
* matchup_slot
* higher_seed_team_id
* lower_seed_team_id
* best_of
* starts_at
* winner_team_id
* series_length
* status

## games

* id
* matchup_id
* game_number
* home_team_id
* away_team_id
* winner_team_id
* scheduled_at
* status
* external_game_id

## brackets

* id
* pool_id
* user_id
* is_submitted
* submitted_at
* locked_snapshot_json

## bracket_picks

* id
* bracket_id
* matchup_id
* picked_winner_team_id
* picked_series_length

## finals_game_picks

* id
* bracket_id
* game_number
* picked_winner_team_id

## scores

* id
* pool_id
* user_id
* total_points
* playin_points
* series_winner_points
* series_length_points
* finals_game_points
* recalculated_at

## sync_logs

* id
* provider
* sync_type
* status
* message
* payload_meta_json
* created_at

## admin_overrides

* id
* pool_id
* entity_type
* entity_id
* changed_by
* before_json
* after_json
* created_at

---

## 13. API design

## FastAPI endpoints

### Auth/session

* handled primarily by Supabase Auth

### Pools

* `GET /pools/:id`
* `POST /pools`
* `POST /pools/:id/join`
* `PATCH /pools/:id`

### Bracket

* `GET /pools/:id/bracket-template`
* `GET /pools/:id/my-bracket`
* `PUT /pools/:id/my-bracket`
* `POST /pools/:id/my-bracket/submit`

### Leaderboard

* `GET /pools/:id/leaderboard`

### Comparison

* `GET /pools/:id/compare?userA=...&userB=...`

### Admin

* `POST /admin/pools/:id/seed`
* `POST /admin/pools/:id/results/manual`
* `POST /admin/pools/:id/sync`
* `POST /admin/pools/:id/recalculate`

### Internal sync

* `POST /internal/sync/standings`
* `POST /internal/sync/games`
* `POST /internal/sync/series`

---

## 14. Scoring logic

## Play-In

For each eligible Play-In matchup:

* if predicted winner matches actual winner → +5

## Series

For each non-Finals series:

* correct winner → +10
* correct number of games → +5, only if winner also correct

## Finals

Two layers:

1. Finals series winner and length can be scored like any other series
2. Each correct game outcome → +5

### Recommendation

Also keep the normal Finals series scoring:

* winner correct → +10
* length correct → +5
* each game correct → +5

That gives the Finals more weight, which is usually fun and fits the idea of more detailed prediction.

---

## 15. Edge cases

* Play-In teams not final until regular season ends
* Bracket creation before official seeding is final
* Finals ends in 4, 5, or 6, so later game picks should become “not applicable”
* API provider delays or mismatches
* Game postponement/reschedule
* User submits bracket with incomplete picks
* Admin changes seeds after some users already drafted
* Two teams tied in the standings before the official bracket is set

### Rule for not-applicable Finals games

If Finals ends before Game 7:

* do not score non-played games
* only score games that actually happened

---

## 16. Security and permissions

* Supabase RLS so users can only edit their own bracket
* Submitted brackets immutable to normal users
* Admin routes protected by role
* Admin overrides logged
* Results sync signed or secret-protected
* Rate limit public endpoints

---

## 17. Analytics

Track:

* number of created pools
* bracket completion rate
* save-draft rate
* time-to-submit
* leaderboard visits
* compare-view usage
* API sync success/failure rate

---

## 18. MVP scope

## Must-have

* user auth
* single pool
* admin manual seeding
* full bracket submission
* Finals game-by-game picks
* bracket lock
* view other brackets after lock
* leaderboard
* manual result entry
* automatic score recalculation

## Nice-to-have

* live API sync
* multiple pools
* public pools
* push notifications
* side-by-side bracket diff view
* avatars
* comments / reactions

---

## 19. Post-MVP roadmap

* Multiple friend groups / pools
* Custom scoring settings per pool
* Shareable public bracket links
* Notifications when standings change
* Upset bonus scoring
* Round-by-round survival metrics
* NCAA/March Madness version using same framework
* WNBA version

---

## 20. Recommended build order

### Phase 1

* Supabase auth
* database schema
* admin creates pool
* manual postseason bracket entry

### Phase 2

* bracket builder UI
* draft save
* submit and lock
* leaderboard scoring engine

### Phase 3

* view others’ brackets
* bracket comparison UI
* admin result entry tools

### Phase 4

* external NBA API sync
* cron jobs
* sync logs and override tools

---

## 21. Open product decisions

You should settle these before building:

1. Can users edit until **first Play-In game**, or does each round lock separately?
2. Should Finals still award normal **series winner + length** points in addition to game-by-game points?
3. Is there one global pool or many private pools?
4. Should bracket visibility open **immediately at lock** or only after all users submit?
5. Should “correct number of games” require the right winner? I strongly recommend yes.

---

## 22. Recommendation on NBA API

My recommendation:

* **Prototype:** manual seeding + manual result updates first
* **Production upgrade:** use **Sportradar**
* **Budget fallback:** TheSportsDB
* **Avoid relying on undocumented NBA.com access for the core app**

That recommendation is mostly about reliability and operational risk, not just coding convenience. Sportradar explicitly documents an NBA API product, while TheSportsDB explicitly advertises an API with premium live score access. ([Getting Started][1])

---

## 23. One-sentence product definition

**An NBA postseason bracket app where users predict every Play-In and playoff matchup, choose series length, make game-by-game Finals picks, then compete on a live leaderboard as results come in.**

If you want, next I can turn this into a **technical spec with Supabase schema + FastAPI endpoint contracts + Next.js folder structure**.

[1]: https://developer.sportradar.com/basketball/reference/nba-overview?utm_source=chatgpt.com "NBA Overview"
[2]: https://www.thesportsdb.com/?utm_source=chatgpt.com "TheSportsDB.com - A Crowdsourced sports database ..."
[3]: https://www.nba.com/?utm_source=chatgpt.com "The official site of the NBA for the latest NBA Scores, Stats ..."
[4]: https://www.nba.com/news/nba-play-in-tournament?utm_source=chatgpt.com "2026 SoFi NBA Play-In Tournament"
[5]: https://nba-apidocumentation.knowledgeowl.com/help?utm_source=chatgpt.com "Welcome to the NBA-API Documentation!"
