/**
 * API client that attaches the Supabase JWT to every request.
 */
import { createClient } from "./supabase";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail ?? "Request failed");
  }
  return res.json();
}

// ── Pools ─────────────────────────────────────
export const api = {
  pools: {
    get: (id: string) => request<PoolOut>(`/pools/${id}`),
    create: (body: PoolCreate) =>
      request<PoolOut>("/pools", { method: "POST", body: JSON.stringify(body) }),
    join: (id: string) =>
      request(`/pools/${id}/join`, { method: "POST" }),
    joinByCode: (code: string) =>
      request(`/pools/join-by-code?code=${code}`, { method: "POST" }),
    update: (id: string, body: Partial<PoolCreate>) =>
      request<PoolOut>(`/pools/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
  },
  brackets: {
    template: (poolId: string) =>
      request<BracketTemplate>(`/pools/${poolId}/bracket-template`),
    mine: (poolId: string) =>
      request<BracketOut>(`/pools/${poolId}/my-bracket`),
    save: (poolId: string, body: BracketUpsert) =>
      request(`/pools/${poolId}/my-bracket`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    submit: (poolId: string) =>
      request(`/pools/${poolId}/my-bracket/submit`, { method: "POST" }),
  },
  leaderboard: {
    get: (poolId: string) =>
      request<LeaderboardResponse>(`/pools/${poolId}/leaderboard`),
    compare: (poolId: string, userA: string, userB: string) =>
      request<CompareResponse>(
        `/pools/${poolId}/compare?user_a=${userA}&user_b=${userB}`
      ),
  },
  admin: {
    seed: (poolId: string, matchups: MatchupSeed[]) =>
      request(`/admin/pools/${poolId}/seed`, {
        method: "POST",
        body: JSON.stringify(matchups),
      }),
    enterResults: (poolId: string, body: ManualResultsPayload) =>
      request(`/admin/pools/${poolId}/results/manual`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    recalculate: (poolId: string) =>
      request(`/admin/pools/${poolId}/recalculate`, { method: "POST" }),
    overrides: (poolId: string) =>
      request(`/admin/pools/${poolId}/overrides`),
    syncLogs: (poolId: string) =>
      request(`/admin/pools/${poolId}/sync-logs`),
  },
};

// ── Type re-exports (kept lean) ───────────────
export type PoolOut = {
  id: string;
  name: string;
  season: number;
  created_by: string;
  is_public: boolean;
  invite_code: string;
  lock_at: string;
  scoring_config_json: ScoringConfig;
  status: "setup" | "open" | "locked" | "complete";
  created_at: string;
};

export type ScoringConfig = {
  playin_correct: number;
  series_winner_correct: number;
  series_length_correct: number;
  finals_game_correct: number;
  series_length_requires_winner: boolean;
};

export type PoolCreate = {
  name: string;
  season: number;
  lock_at: string;
  is_public: boolean;
  scoring_config: ScoringConfig;
};

export type Team = {
  id: string;
  abbreviation: string;
  city: string;
  name: string;
  logo_url: string | null;
  conference: "east" | "west" | "none";
};

export type Matchup = {
  id: string;
  season: number;
  round_type: "playin" | "first_round" | "semifinals" | "conference_finals" | "finals";
  conference: "east" | "west" | "none";
  matchup_slot: number;
  higher_seed_team_id: string | null;
  lower_seed_team_id: string | null;
  best_of: number;
  starts_at: string | null;
  winner_team_id: string | null;
  series_length: number | null;
  status: "scheduled" | "in_progress" | "complete";
};

export type BracketTemplate = {
  matchups: Matchup[];
  teams: Record<string, Team>;
};

export type BracketPick = {
  matchup_id: string;
  picked_winner_team_id: string | null;
  picked_series_length: number | null;
};

export type FinalsGamePick = {
  game_number: number;
  picked_winner_team_id: string | null;
};

export type BracketOut = {
  id: string;
  pool_id: string;
  user_id: string;
  is_submitted: boolean;
  submitted_at: string | null;
  picks: BracketPick[];
  finals_picks: FinalsGamePick[];
};

export type BracketUpsert = {
  picks: BracketPick[];
  finals_picks: FinalsGamePick[];
};

export type LeaderboardEntry = {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  total_points: number;
  playin_points: number;
  series_winner_points: number;
  series_length_points: number;
  finals_game_points: number;
};

export type LeaderboardResponse = {
  pool_id: string;
  entries: LeaderboardEntry[];
};

export type CompareResponse = {
  user_a_id: string;
  user_b_id: string;
  picks: Array<{
    matchup_id: string;
    round_type: string;
    conference: string;
    matchup_slot: number;
    user_a_pick: string | null;
    user_b_pick: string | null;
    actual_winner: string | null;
    picks_match: boolean;
    a_correct: boolean;
    b_correct: boolean;
  }>;
  finals_picks: Array<{
    game_number: number;
    user_a_pick: string | null;
    user_b_pick: string | null;
  }>;
};

export type MatchupSeed = {
  round_type: string;
  conference: string;
  matchup_slot: number;
  higher_seed_team_id?: string;
  lower_seed_team_id?: string;
  best_of?: number;
  starts_at?: string;
};

export type ManualResultsPayload = {
  matchup_results: Array<{
    matchup_id: string;
    winner_team_id: string;
    series_length: number;
    status?: string;
  }>;
  game_results: Array<{
    game_id: string;
    winner_team_id: string;
  }>;
};
