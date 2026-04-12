from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import pools, brackets, leaderboard, admin

app = FastAPI(title="NBA Bracket Betting API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pools.router)
app.include_router(brackets.router)
app.include_router(leaderboard.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
