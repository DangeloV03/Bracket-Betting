"""Admin endpoints — pool seeding, manual result entry, scoring recalculation."""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from app.core.auth import get_current_user, require_pool_admin
from app.core.supabase import supabase
from app.models.schemas import MatchupSeed, ManualResultsPayload
from app.services.scoring import recalculate_pool_scores

router = APIRouter(prefix="/admin/pools/{pool_id}", tags=["admin"])


@router.post("/seed")
async def seed_bracket(
    pool_id: str,
    matchups: list[MatchupSeed],
    current_user: dict = Depends(get_current_user),
):
    await require_pool_admin(pool_id, current_user)

    pool = supabase.table("pools").select("season").eq("id", pool_id).single().execute()
    season = pool.data["season"]

    created = []
    for m in matchups:
        data = {
            "season": season,
            "round_type": m.round_type.value,
            "conference": m.conference.value,
            "matchup_slot": m.matchup_slot,
            "higher_seed_team_id": m.higher_seed_team_id,
            "lower_seed_team_id": m.lower_seed_team_id,
            "best_of": m.best_of,
            "starts_at": m.starts_at.isoformat() if m.starts_at else None,
            "status": "scheduled",
            "updated_at": datetime.utcnow().isoformat(),
        }
        result = supabase.table("postseason_matchups").upsert(
            data,
            on_conflict="season,round_type,conference,matchup_slot",
        ).execute()
        created.extend(result.data or [])

        # Log override
        supabase.table("admin_overrides").insert({
            "pool_id": pool_id,
            "entity_type": "matchup",
            "entity_id": result.data[0]["id"] if result.data else "unknown",
            "changed_by": current_user["id"],
            "after_json": data,
        }).execute()

    return {"seeded": len(created), "matchups": created}


@router.post("/results/manual")
async def enter_results_manually(
    pool_id: str,
    body: ManualResultsPayload,
    current_user: dict = Depends(get_current_user),
):
    await require_pool_admin(pool_id, current_user)

    updated_matchups = []
    for r in body.matchup_results:
        mid = r.get("matchup_id")
        if not mid:
            continue

        before = supabase.table("postseason_matchups").select("*").eq("id", mid).single().execute()

        update_data = {
            "winner_team_id": r.get("winner_team_id"),
            "series_length": r.get("series_length"),
            "status": r.get("status", "complete"),
            "updated_at": datetime.utcnow().isoformat(),
        }
        supabase.table("postseason_matchups").update(update_data).eq("id", mid).execute()

        supabase.table("admin_overrides").insert({
            "pool_id": pool_id,
            "entity_type": "matchup_result",
            "entity_id": mid,
            "changed_by": current_user["id"],
            "before_json": before.data,
            "after_json": update_data,
        }).execute()

        updated_matchups.append(mid)

    updated_games = []
    for g in body.game_results:
        gid = g.get("game_id")
        if not gid:
            continue

        before = supabase.table("games").select("*").eq("id", gid).single().execute()

        update_data = {
            "winner_team_id": g.get("winner_team_id"),
            "status": g.get("status", "complete"),
        }
        supabase.table("games").update(update_data).eq("id", gid).execute()

        supabase.table("admin_overrides").insert({
            "pool_id": pool_id,
            "entity_type": "game_result",
            "entity_id": gid,
            "changed_by": current_user["id"],
            "before_json": before.data,
            "after_json": update_data,
        }).execute()

        updated_games.append(gid)

    return {
        "updated_matchups": len(updated_matchups),
        "updated_games": len(updated_games),
    }


@router.post("/recalculate")
async def recalculate_scores(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_pool_admin(pool_id, current_user)
    result = recalculate_pool_scores(pool_id)
    return result


@router.get("/overrides")
async def get_override_log(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_pool_admin(pool_id, current_user)
    logs = (
        supabase.table("admin_overrides")
        .select("*")
        .eq("pool_id", pool_id)
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    return {"overrides": logs.data or []}


@router.get("/sync-logs")
async def get_sync_logs(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    await require_pool_admin(pool_id, current_user)
    logs = (
        supabase.table("sync_logs")
        .select("*")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"logs": logs.data or []}
