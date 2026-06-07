from __future__ import annotations

import os
import sqlite3
from pathlib import Path
from typing import Iterator

APP_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("CDT_DB_PATH", APP_DIR / "trainer.sqlite3"))
SCHEMA_PATH = APP_DIR / "schema.sql"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
        conn.execute(
            """
            INSERT OR IGNORE INTO users (id, username, estimated_rating)
            VALUES (1, 'local', 1400)
            """
        )


def get_db() -> Iterator[sqlite3.Connection]:
    conn = connect()
    try:
        yield conn
    finally:
        conn.close()
