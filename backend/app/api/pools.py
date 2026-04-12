from fastapi import APIRouter, Depends, HTTPException, status
from app.core.auth import get_current_user, require_pool_admin
from app.core.supabase import supabase
from app.models.schemas import PoolCreate, PoolUpdate, PoolOut

router = APIRouter(prefix="/pools", tags=["pools"])


@router.get("/{pool_id}", response_model=PoolOut)
async def get_pool(pool_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("pools").select("*").eq("id", pool_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Pool not found")
    return result.data


@router.post("", response_model=PoolOut, status_code=status.HTTP_201_CREATED)
async def create_pool(body: PoolCreate, current_user: dict = Depends(get_current_user)):
    pool_data = {
        "name": body.name,
        "season": body.season,
        "created_by": current_user["id"],
        "is_public": body.is_public,
        "lock_at": body.lock_at.isoformat(),
        "scoring_config_json": body.scoring_config.model_dump(),
        "status": "open",
    }
    result = supabase.table("pools").insert(pool_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create pool")

    pool = result.data[0]

    # Auto-add creator as admin member
    supabase.table("pool_members").insert(
        {"pool_id": pool["id"], "user_id": current_user["id"], "role": "admin"}
    ).execute()

    return pool


@router.post("/{pool_id}/join")
async def join_pool(pool_id: str, current_user: dict = Depends(get_current_user)):
    # Check pool exists and is open
    pool = supabase.table("pools").select("status, is_public").eq("id", pool_id).single().execute()
    if not pool.data:
        raise HTTPException(status_code=404, detail="Pool not found")
    if pool.data["status"] not in ("open", "setup"):
        raise HTTPException(status_code=400, detail="Pool is not accepting new members")

    # Check not already a member
    existing = (
        supabase.table("pool_members")
        .select("id")
        .eq("pool_id", pool_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        return {"message": "Already a member"}

    supabase.table("pool_members").insert(
        {"pool_id": pool_id, "user_id": current_user["id"], "role": "member"}
    ).execute()

    return {"message": "Joined pool successfully"}


@router.post("/{pool_id}/join-by-code")
async def join_by_code(
    code: str,
    current_user: dict = Depends(get_current_user),
):
    pool = supabase.table("pools").select("id, status").eq("invite_code", code).single().execute()
    if not pool.data:
        raise HTTPException(status_code=404, detail="Invalid invite code")

    pool_id = pool.data["id"]
    existing = (
        supabase.table("pool_members")
        .select("id")
        .eq("pool_id", pool_id)
        .eq("user_id", current_user["id"])
        .execute()
    )
    if existing.data:
        return {"message": "Already a member", "pool_id": pool_id}

    supabase.table("pool_members").insert(
        {"pool_id": pool_id, "user_id": current_user["id"], "role": "member"}
    ).execute()

    return {"message": "Joined pool successfully", "pool_id": pool_id}


@router.patch("/{pool_id}", response_model=PoolOut)
async def update_pool(
    pool_id: str,
    body: PoolUpdate,
    current_user: dict = Depends(get_current_user),
):
    await require_pool_admin(pool_id, current_user)

    updates = body.model_dump(exclude_none=True)
    if "scoring_config" in updates:
        updates["scoring_config_json"] = updates.pop("scoring_config")
    if "lock_at" in updates:
        updates["lock_at"] = updates["lock_at"].isoformat()

    result = supabase.table("pools").update(updates).eq("id", pool_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Pool not found")
    return result.data[0]
