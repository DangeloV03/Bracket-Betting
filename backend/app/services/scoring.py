"""Scoring engine — computes points for all brackets in a pool."""
from datetime import datetime
from app.core.supabase import supabase


def _get_scoring_config(pool_id: str) -> dict:
    pool = supabase.table("pools").select("scoring_config_json").eq("id", pool_id).single().execute()
    return pool.data["scoring_config_json"]


def recalculate_pool_scores(pool_id: str) -> dict:
    """
    Recompute every member's score in the pool.
    Returns a summary dict with user_id → points breakdown.
    """
    cfg = _get_scoring_config(pool_id)

    # Fetch all completed matchups for this pool's season
    pool_data = supabase.table("pools").select("season").eq("id", pool_id).single().execute()
    season = pool_data.data["season"]

    matchups = (
        supabase.table("postseason_matchups")
        .select("*")
        .eq("season", season)
        .eq("status", "complete")
        .execute()
    ).data

    matchup_map = {m["id"]: m for m in matchups}

    # Fetch completed Finals games
    finals_matchup = next(
        (m for m in matchups if m["round_type"] == "finals"), None
    )
    actual_finals_games = {}
    if finals_matchup:
        games = (
            supabase.table("games")
            .select("*")
            .eq("matchup_id", finals_matchup["id"])
            .eq("status", "complete")
            .execute()
        ).data
        actual_finals_games = {g["game_number"]: g for g in games}

    # Fetch all submitted brackets in the pool
    brackets = (
        supabase.table("brackets")
        .select("id, user_id")
        .eq("pool_id", pool_id)
        .eq("is_submitted", True)
        .execute()
    ).data

    results = []

    for bracket in brackets:
        bid = bracket["id"]
        uid = bracket["user_id"]

        playin_pts = 0
        series_winner_pts = 0
        series_length_pts = 0
        finals_game_pts = 0

        # Fetch picks
        picks = (
            supabase.table("bracket_picks")
            .select("*")
            .eq("bracket_id", bid)
            .execute()
        ).data

        for pick in picks:
            mid = pick["matchup_id"]
            actual = matchup_map.get(mid)
            if not actual:
                continue  # matchup not complete yet

            picked_winner = pick["picked_winner_team_id"]
            actual_winner = actual["winner_team_id"]
            winner_correct = picked_winner == actual_winner

            if actual["round_type"] == "playin":
                if winner_correct:
                    playin_pts += cfg["playin_correct"]
            else:
                if winner_correct:
                    series_winner_pts += cfg["series_winner_correct"]
                    # Length bonus only if winner correct (per config)
                    if (
                        pick["picked_series_length"] is not None
                        and pick["picked_series_length"] == actual["series_length"]
                    ):
                        series_length_pts += cfg["series_length_correct"]
                elif not cfg.get("series_length_requires_winner", True):
                    # Optional: award length even if winner wrong
                    if (
                        pick["picked_series_length"] is not None
                        and pick["picked_series_length"] == actual["series_length"]
                    ):
                        series_length_pts += cfg["series_length_correct"]

        # Finals game-by-game picks
        fg_picks = (
            supabase.table("finals_game_picks")
            .select("*")
            .eq("bracket_id", bid)
            .execute()
        ).data

        for fgp in fg_picks:
            gn = fgp["game_number"]
            actual_game = actual_finals_games.get(gn)
            if not actual_game:
                continue  # game not played yet
            if fgp["picked_winner_team_id"] == actual_game["winner_team_id"]:
                finals_game_pts += cfg["finals_game_correct"]

        total = playin_pts + series_winner_pts + series_length_pts + finals_game_pts

        # Upsert into scores table
        supabase.table("scores").upsert(
            {
                "pool_id": pool_id,
                "user_id": uid,
                "total_points": total,
                "playin_points": playin_pts,
                "series_winner_points": series_winner_pts,
                "series_length_points": series_length_pts,
                "finals_game_points": finals_game_pts,
                "recalculated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="pool_id,user_id",
        ).execute()

        results.append(
            {
                "user_id": uid,
                "total_points": total,
                "playin_points": playin_pts,
                "series_winner_points": series_winner_pts,
                "series_length_points": series_length_pts,
                "finals_game_points": finals_game_pts,
            }
        )

    return {"recalculated": len(results), "scores": results}
