# NBA Bracket Betting — Setup Guide

## Project structure

```
Bracket_Betting/
├── prd.md                  # Product requirements
├── SETUP.md                # This file
├── supabase/
│   └── schema.sql          # Full DB schema — run this in Supabase SQL editor
├── backend/                # FastAPI app
│   ├── app/
│   │   ├── main.py
│   │   ├── core/           # config, supabase client, auth
│   │   ├── api/            # pools, brackets, leaderboard, admin
│   │   ├── models/         # Pydantic schemas
│   │   └── services/       # scoring engine
│   ├── requirements.txt
│   ├── start.sh
│   └── .env.example
└── frontend/               # Next.js app
    ├── app/                # App Router pages
    ├── components/         # bracket UI components
    └── lib/                # supabase client, API wrapper, utils
```

## 1. Supabase project setup

1. Create a new project at https://supabase.com
2. Go to **SQL Editor** and run `supabase/schema.sql`
3. Note your **Project URL**, **anon key**, and **service role key**
4. Note your **JWT secret** (Settings → API → JWT Settings)

## 2. Backend setup

```bash
cd backend
cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, JWT_SECRET
./start.sh
# API runs at http://localhost:8000
# Docs at http://localhost:8000/docs
```

## 3. Frontend setup

```bash
cd frontend
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_API_URL
npm run dev
# App runs at http://localhost:3000
```

## First-time flow

1. Sign up for an account at `/auth/signup`
2. Create a pool at `/pool/create` (you auto-become admin)
3. Go to the pool's Admin console → **Seed** tab
4. Add each matchup (Play-In through Conference Finals) manually
5. Share the invite code with friends so they can join and fill out brackets
6. After the lock deadline, use Admin → **Results** tab to enter series outcomes
7. Admin → **Tools** → **Recalculate Scores** to update the leaderboard

## Scoring rules (default)

| Pick | Points |
|------|--------|
| Play-In winner correct | 5 |
| Series winner correct | 10 |
| Series length correct (winner must also be correct) | 5 |
| Each NBA Finals game correct | 5 |

## Adding NBA data later

- **Sportradar** (recommended for production) — replace admin manual entry with API sync
- **TheSportsDB** — cheaper option with 2-min live scores
- Add sync endpoints to `backend/app/api/` and wire up APScheduler in `main.py`

## Key decisions made (from PRD open questions)

- Brackets lock at the single configured `lock_at` time (first Play-In tipoff)
- Finals scores both: series winner/length (10+5 pts) AND game-by-game (5 pts each)
- Series length bonus requires correct winner
- Brackets visible to all pool members after lock time

