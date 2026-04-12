from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user
from app.core.supabase import supabase

router = APIRouter(prefix="/pools/{pool_id}", tags=["leaderboard"])


@router.get("/leaderboard")
async def get_leaderboard(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    # Verify membership
    member = (
        supabase.table("pool_members")
        .select("id")
        .eq("pool_id", pool_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not member.data:
        raise HTTPException(status_code=403, detail="Not a pool member")

    # Fetch scores joined with users
    scores = (
        supabase.table("scores")
        .select("*, users(username, display_name, avatar_url)")
        .eq("pool_id", pool_id)
        .order("total_points", desc=True)
        .execute()
    )

    entries = []
    prev_score = None
    rank = 0
    actual_rank = 0

    for row in (scores.data or []):
        actual_rank += 1
        if row["total_points"] != prev_score:
            rank = actual_rank
            prev_score = row["total_points"]

        user_info = row.get("users") or {}
        entries.append(
            {
                "rank": rank,
                "user_id": row["user_id"],
                "username": user_info.get("username", ""),
                "display_name": user_info.get("display_name"),
                "avatar_url": user_info.get("avatar_url"),
                "total_points": row["total_points"],
                "playin_points": row["playin_points"],
                "series_winner_points": row["series_winner_points"],
                "series_length_points": row["series_length_points"],
                "finals_game_points": row["finals_game_points"],
                "recalculated_at": row["recalculated_at"],
            }
        )

    return {"pool_id": pool_id, "entries": entries}


@router.get("/compare")
async def compare_brackets(
    pool_id: str,
    user_a: str,
    user_b: str,
    current_user: dict = Depends(get_current_user),
):
    # Must be a pool member
    member = (
        supabase.table("pool_members")
        .select("id")
        .eq("pool_id", pool_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if not member.data:
        raise HTTPException(status_code=403, detail="Not a pool member")

    # Pool must be locked
    pool = supabase.table("pools").select("lock_at, season").eq("id", pool_id).single().execute()
    from datetime import datetime, timezone
    lock_at = datetime.fromisoformat(pool.data["lock_at"])
    if lock_at.tzinfo is None:
        lock_at = lock_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) < lock_at:
        raise HTTPException(status_code=403, detail="Brackets are not visible until pool locks")

    season = pool.data["season"]

    def _get_bracket(user_id: str) -> dict:
        b = (
            supabase.table("brackets")
            .select("id")
            .eq("pool_id", pool_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        if not b.data:
            return {"picks": [], "finals_picks": []}
        bid = b.data["id"]
        picks = supabase.table("bracket_picks").select("*").eq("bracket_id", bid).execute()
        finals = supabase.table("finals_game_picks").select("*").eq("bracket_id", bid).execute()
        return {"picks": {p["matchup_id"]: p for p in (picks.data or [])},
                "finals_picks": {p["game_number"]: p for p in (finals.data or [])}}

    a_data = _get_bracket(user_a)
    b_data = _get_bracket(user_b)

    # Fetch matchups
    matchups = (
        supabase.table("postseason_matchups")
        .select("*")
        .eq("season", season)
        .execute()
    ).data or []

    comparisons = []
    for m in matchups:
        mid = m["id"]
        a_pick = a_data["picks"].get(mid)
        b_pick = b_data["picks"].get(mid)
        actual_winner = m.get("winner_team_id")

        comparisons.append({
            "matchup_id": mid,
            "round_type": m["round_type"],
            "conference": m["conference"],
            "matchup_slot": m["matchup_slot"],
            "user_a_pick": a_pick["picked_winner_team_id"] if a_pick else None,
            "user_a_series_length": a_pick["picked_series_length"] if a_pick else None,
            "user_b_pick": b_pick["picked_winner_team_id"] if b_pick else None,
            "user_b_series_length": b_pick["picked_series_length"] if b_pick else None,
            "actual_winner": actual_winner,
            "picks_match": (
                (a_pick["picked_winner_team_id"] if a_pick else None) ==
                (b_pick["picked_winner_team_id"] if b_pick else None)
            ),
            "a_correct": bool(actual_winner and a_pick and a_pick["picked_winner_team_id"] == actual_winner),
            "b_correct": bool(actual_winner and b_pick and b_pick["picked_winner_team_id"] == actual_winner),
        })

    # Finals game comparison
    finals_comp = []
    all_game_numbers = set(a_data["finals_picks"]) | set(b_data["finals_picks"])
    for gn in sorted(all_game_numbers):
        a_fg = a_data["finals_picks"].get(gn)
        b_fg = b_data["finals_picks"].get(gn)
        finals_comp.append({
            "game_number": gn,
            "user_a_pick": a_fg["picked_winner_team_id"] if a_fg else None,
            "user_b_pick": b_fg["picked_winner_team_id"] if b_fg else None,
        })

    return {
        "user_a_id": user_a,
        "user_b_id": user_b,
        "picks": comparisons,
        "finals_picks": finals_comp,
    }
