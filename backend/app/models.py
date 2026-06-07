from __future__ import annotations

from pydantic import BaseModel, Field


class LichessCsvImportRequest(BaseModel):
    csv_text: str = Field(min_length=1)
    quality_filter: bool = True
    max_rows: int = Field(default=5000, ge=1, le=100000)


class LichessCsvImportResponse(BaseModel):
    imported: int
    skipped: int
    errors: list[str]


class PuzzleOut(BaseModel):
    id: int
    source: str
    source_puzzle_id: str
    fen_before: str
    fen_presented: str
    initial_opponent_move_uci: str
    solution_moves_uci: list[str]
    rating: int
    rating_deviation: int
    popularity: int
    nb_plays: int
    themes_raw: list[str]
    opening_tags_raw: list[str]
    phase: str
    family: str
    move_number: int
    material_count: int
    source_game_url: str | None = None


class AttemptIn(BaseModel):
    user_id: int = 1
    session_id: int | None = None
    puzzle_id: int
    result_type: str
    first_move_correct: bool
    full_line_correct: bool
    time_ms: int = Field(ge=0)
    hint_count: int = Field(default=0, ge=0)
    user_moves_uci: list[str]
    mistake_reason: list[str] = []
    score: float = 0


class AttemptOut(BaseModel):
    id: int
    created_at: str


class SummaryReport(BaseModel):
    attempts: int
    solved: int
    first_move_rate: float
    full_line_rate: float
