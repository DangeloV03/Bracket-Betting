"""Verify Supabase JWT tokens coming from the frontend."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
from app.core.supabase import supabase

bearer_scheme = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        user_id: str = payload.get("sub")
        if not user_id:
            raise ValueError("No sub in token")
        return {"id": user_id, "email": payload.get("email", "")}
    except (JWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


async def require_pool_admin(
    pool_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Verify the current user is an admin of the given pool."""
    result = (
        supabase.table("pool_members")
        .select("role")
        .eq("pool_id", pool_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not result.data or result.data["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Pool admin access required",
        )
    return current_user
