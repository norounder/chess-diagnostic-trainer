from __future__ import annotations

import json
import sqlite3

from fastapi import APIRouter, Depends

from ..db import get_db
from ..models import AttemptIn, AttemptOut, SummaryReport

router = APIRouter(tags=["attempts"])


@router.post("/attempts", response_model=AttemptOut)
def create_attempt(payload: AttemptIn, db: sqlite3.Connection = Depends(get_db)) -> AttemptOut:
    cursor = db.execute(
        """
        INSERT INTO attempts (
          user_id, session_id, puzzle_id, result_type, first_move_correct, full_line_correct,
          time_ms, hint_count, user_moves_uci, mistake_reason, score
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            payload.user_id,
            payload.session_id,
            payload.puzzle_id,
            payload.result_type,
            int(payload.first_move_correct),
            int(payload.full_line_correct),
            payload.time_ms,
            payload.hint_count,
            json.dumps(payload.user_moves_uci),
            json.dumps(payload.mistake_reason),
            payload.score,
        ),
    )
    db.commit()
    row = db.execute("SELECT id, created_at FROM attempts WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return AttemptOut(id=row["id"], created_at=row["created_at"])


@router.get("/reports/summary", response_model=SummaryReport)
def summary_report(user_id: int = 1, db: sqlite3.Connection = Depends(get_db)) -> SummaryReport:
    row = db.execute(
        """
        SELECT
          COUNT(*) AS attempts,
          SUM(full_line_correct) AS solved,
          AVG(first_move_correct) AS first_move_rate,
          AVG(full_line_correct) AS full_line_rate
        FROM attempts
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return SummaryReport(
        attempts=row["attempts"] or 0,
        solved=row["solved"] or 0,
        first_move_rate=row["first_move_rate"] or 0,
        full_line_rate=row["full_line_rate"] or 0,
    )
