from __future__ import annotations

import json
import sqlite3

from fastapi import APIRouter, Depends

from ..db import get_db
from ..models import LichessCsvImportRequest, LichessCsvImportResponse, PuzzleOut
from ..services.lichess_importer import import_lichess_csv

router = APIRouter(prefix="/puzzles", tags=["puzzles"])


@router.get("", response_model=list[PuzzleOut])
def list_puzzles(limit: int = 50, db: sqlite3.Connection = Depends(get_db)) -> list[PuzzleOut]:
    rows = db.execute(
        """
        SELECT * FROM puzzles
        ORDER BY rating ASC, id ASC
        LIMIT ?
        """,
        (limit,),
    ).fetchall()
    return [row_to_puzzle(row) for row in rows]


@router.post("/import/lichess", response_model=LichessCsvImportResponse)
def import_lichess(payload: LichessCsvImportRequest, db: sqlite3.Connection = Depends(get_db)) -> LichessCsvImportResponse:
    result = import_lichess_csv(db, payload.csv_text, payload.quality_filter, payload.max_rows)
    return LichessCsvImportResponse(imported=result.imported, skipped=result.skipped, errors=result.errors)


def row_to_puzzle(row: sqlite3.Row) -> PuzzleOut:
    data = dict(row)
    data["solution_moves_uci"] = json.loads(data["solution_moves_uci"])
    data["themes_raw"] = json.loads(data["themes_raw"])
    data["opening_tags_raw"] = json.loads(data["opening_tags_raw"])
    return PuzzleOut(**data)
