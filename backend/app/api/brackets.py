from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user
from app.core.supabase import supabase
from app.models.schemas import BracketUpsert, BracketOut

router = APIRouter(prefix="/pools/{pool_id}", tags=["brackets"])


def _get_pool_or_404(pool_id: str) -> dict:
    result = supabase.table("pools").select("*").eq("id", pool_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Pool not found")
    return result.data


def _is_member(pool_id: str, user_id: str) -> bool:
    r = (
        supabase.table("pool_members")
        .select("id")
        .eq("pool_id", pool_id)
        .eq("user_id", user_id)
        .execute()
    )
    return bool(r.data)


def _is_locked(pool: dict) -> bool:
    lock_at = datetime.fromisoformat(pool["lock_at"])
    if lock_at.tzinfo is None:
        lock_at = lock_at.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) >= lock_at


def _get_bracket_template(season: int) -> list[dict]:
    matchups = (
        supabase.table("postseason_matchups")
        .select("*")
        .eq("season", season)
        .order("round_type")
        .order("matchup_slot")
        .execute()
    )
    return matchups.data or []


@router.get("/bracket-template")
async def get_bracket_template(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    pool = _get_pool_or_404(pool_id)
    if not _is_member(pool_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a pool member")

    matchups = _get_bracket_template(pool["season"])

    # Enrich with team data
    team_ids = set()
    for m in matchups:
        for k in ("higher_seed_team_id", "lower_seed_team_id", "winner_team_id"):
            if m.get(k):
                team_ids.add(m[k])

    teams_map = {}
    if team_ids:
        teams = (
            supabase.table("teams")
            .select("id, abbreviation, city, name, logo_url, conference")
            .in_("id", list(team_ids))
            .execute()
        )
        teams_map = {t["id"]: t for t in (teams.data or [])}

    return {"matchups": matchups, "teams": teams_map}


@router.get("/my-bracket", response_model=BracketOut)
async def get_my_bracket(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    pool = _get_pool_or_404(pool_id)
    if not _is_member(pool_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a pool member")

    bracket = (
        supabase.table("brackets")
        .select("*")
        .eq("pool_id", pool_id)
        .eq("user_id", current_user["id"])
        .execute()
    )

    if not bracket.data:
        # Return empty bracket shell
        return {
            "id": "",
            "pool_id": pool_id,
            "user_id": current_user["id"],
            "is_submitted": False,
            "submitted_at": None,
            "picks": [],
            "finals_picks": [],
        }

    b = bracket.data[0]

    picks = (
        supabase.table("bracket_picks").select("*").eq("bracket_id", b["id"]).execute()
    )
    finals_picks = (
        supabase.table("finals_game_picks").select("*").eq("bracket_id", b["id"]).execute()
    )

    return {**b, "picks": picks.data or [], "finals_picks": finals_picks.data or []}


@router.put("/my-bracket")
async def upsert_my_bracket(
    pool_id: str,
    body: BracketUpsert,
    current_user: dict = Depends(get_current_user),
):
    pool = _get_pool_or_404(pool_id)
    if not _is_member(pool_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a pool member")
    if _is_locked(pool):
        raise HTTPException(status_code=400, detail="Pool is locked — no edits allowed")

    uid = current_user["id"]

    # Get or create bracket
    existing = (
        supabase.table("brackets")
        .select("id, is_submitted")
        .eq("pool_id", pool_id)
        .eq("user_id", uid)
        .execute()
    )

    if existing.data and existing.data[0]["is_submitted"]:
        raise HTTPException(status_code=400, detail="Bracket already submitted")

    if existing.data:
        bracket_id = existing.data[0]["id"]
        supabase.table("brackets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", bracket_id).execute()
    else:
        new_bracket = (
            supabase.table("brackets")
            .insert({"pool_id": pool_id, "user_id": uid})
            .execute()
        )
        bracket_id = new_bracket.data[0]["id"]

    # Upsert picks
    for pick in body.picks:
        supabase.table("bracket_picks").upsert(
            {
                "bracket_id": bracket_id,
                "matchup_id": pick.matchup_id,
                "picked_winner_team_id": pick.picked_winner_team_id,
                "picked_series_length": pick.picked_series_length,
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="bracket_id,matchup_id",
        ).execute()

    # Upsert finals game picks
    for fgp in body.finals_picks:
        supabase.table("finals_game_picks").upsert(
            {
                "bracket_id": bracket_id,
                "game_number": fgp.game_number,
                "picked_winner_team_id": fgp.picked_winner_team_id,
                "updated_at": datetime.utcnow().isoformat(),
            },
            on_conflict="bracket_id,game_number",
        ).execute()

    return {"bracket_id": bracket_id, "saved": True}


@router.post("/my-bracket/submit")
async def submit_bracket(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
):
    pool = _get_pool_or_404(pool_id)
    if not _is_member(pool_id, current_user["id"]):
        raise HTTPException(status_code=403, detail="Not a pool member")
    if _is_locked(pool):
        raise HTTPException(status_code=400, detail="Pool is locked")

    uid = current_user["id"]
    existing = (
        supabase.table("brackets")
        .select("id, is_submitted")
        .eq("pool_id", pool_id)
        .eq("user_id", uid)
        .single()
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=400, detail="No bracket found — save a draft first")

    if existing.data["is_submitted"]:
        return {"message": "Already submitted"}

    bracket_id = existing.data["id"]

    # Create snapshot of picks
    picks = supabase.table("bracket_picks").select("*").eq("bracket_id", bracket_id).execute()
    finals = supabase.table("finals_game_picks").select("*").eq("bracket_id", bracket_id).execute()
    snapshot = {"picks": picks.data, "finals_picks": finals.data}

    supabase.table("brackets").update(
        {
            "is_submitted": True,
            "submitted_at": datetime.utcnow().isoformat(),
            "locked_snapshot_json": snapshot,
        }
    ).eq("id", bracket_id).execute()

    return {"message": "Bracket submitted successfully", "bracket_id": bracket_id}
