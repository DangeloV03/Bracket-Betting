"""Pydantic request/response models."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from enum import Enum


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────
class RoundType(str, Enum):
    playin = "playin"
    first_round = "first_round"
    semifinals = "semifinals"
    conference_finals = "conference_finals"
    finals = "finals"


class ConferenceType(str, Enum):
    east = "east"
    west = "west"
    none = "none"


class MatchupStatus(str, Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    complete = "complete"


class PoolStatus(str, Enum):
    setup = "setup"
    open = "open"
    locked = "locked"
    complete = "complete"


# ──────────────────────────────────────────────
# Pool
# ──────────────────────────────────────────────
class ScoringConfig(BaseModel):
    playin_correct: int = 5
    series_winner_correct: int = 10
    series_length_correct: int = 5
    finals_game_correct: int = 5
    series_length_requires_winner: bool = True


class PoolCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    season: int = Field(..., ge=2020, le=2030)
    lock_at: datetime
    scoring_config: ScoringConfig = ScoringConfig()
    is_public: bool = False


class PoolUpdate(BaseModel):
    name: Optional[str] = None
    lock_at: Optional[datetime] = None
    scoring_config: Optional[ScoringConfig] = None
    is_public: Optional[bool] = None
    status: Optional[PoolStatus] = None


class PoolOut(BaseModel):
    id: str
    name: str
    season: int
    created_by: str
    is_public: bool
    invite_code: str
    lock_at: datetime
    scoring_config_json: dict
    status: PoolStatus
    created_at: datetime


# ──────────────────────────────────────────────
# Matchup
# ──────────────────────────────────────────────
class MatchupSeed(BaseModel):
    """Used by admin to manually seed/update matchups."""
    season: int
    round_type: RoundType
    conference: ConferenceType
    matchup_slot: int
    higher_seed_team_id: Optional[str] = None
    lower_seed_team_id: Optional[str] = None
    best_of: int = 7
    starts_at: Optional[datetime] = None


class MatchupResultUpdate(BaseModel):
    winner_team_id: str
    series_length: int
    status: MatchupStatus = MatchupStatus.complete


class MatchupOut(BaseModel):
    id: str
    season: int
    round_type: RoundType
    conference: ConferenceType
    matchup_slot: int
    higher_seed_team_id: Optional[str]
    lower_seed_team_id: Optional[str]
    best_of: int
    starts_at: Optional[datetime]
    winner_team_id: Optional[str]
    series_length: Optional[int]
    status: MatchupStatus


# ──────────────────────────────────────────────
# Games
# ──────────────────────────────────────────────
class GameResultUpdate(BaseModel):
    winner_team_id: str
    status: MatchupStatus = MatchupStatus.complete


# ──────────────────────────────────────────────
# Bracket
# ──────────────────────────────────────────────
class BracketPickIn(BaseModel):
    matchup_id: str
    picked_winner_team_id: Optional[str] = None
    picked_series_length: Optional[int] = Field(None, ge=4, le=7)


class FinalsGamePickIn(BaseModel):
    game_number: int = Field(..., ge=1, le=7)
    picked_winner_team_id: Optional[str] = None


class BracketUpsert(BaseModel):
    picks: list[BracketPickIn] = []
    finals_picks: list[FinalsGamePickIn] = []


class BracketOut(BaseModel):
    id: str
    pool_id: str
    user_id: str
    is_submitted: bool
    submitted_at: Optional[datetime]
    picks: list[dict] = []
    finals_picks: list[dict] = []


# ──────────────────────────────────────────────
# Leaderboard
# ──────────────────────────────────────────────
class LeaderboardEntry(BaseModel):
    rank: int
    user_id: str
    username: str
    display_name: Optional[str]
    total_points: int
    playin_points: int
    series_winner_points: int
    series_length_points: int
    finals_game_points: int


# ──────────────────────────────────────────────
# Comparison
# ──────────────────────────────────────────────
class PickComparison(BaseModel):
    matchup_id: str
    round_type: str
    conference: str
    matchup_slot: int
    user_a_pick: Optional[str]
    user_b_pick: Optional[str]
    actual_winner: Optional[str]
    match: bool
    is_correct_a: Optional[bool]
    is_correct_b: Optional[bool]


class BracketComparison(BaseModel):
    user_a_id: str
    user_b_id: str
    picks: list[PickComparison]
    finals_picks: list[dict]


# ──────────────────────────────────────────────
# Admin
# ──────────────────────────────────────────────
class ManualResultsPayload(BaseModel):
    matchup_results: list[dict] = []   # [{matchup_id, winner_team_id, series_length}]
    game_results: list[dict] = []      # [{game_id, winner_team_id}]


class SyncLogOut(BaseModel):
    id: str
    provider: str
    sync_type: str
    status: str
    message: Optional[str]
    created_at: datetime
