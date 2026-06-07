from __future__ import annotations

import csv
import io
import json
import sqlite3
from dataclasses import dataclass

import chess


REQUIRED_COLUMNS = {
    "PuzzleId",
    "FEN",
    "Moves",
    "Rating",
    "RatingDeviation",
    "Popularity",
    "NbPlays",
    "Themes",
    "GameUrl",
    "OpeningTags",
}


@dataclass
class ImportResult:
    imported: int
    skipped: int
    errors: list[str]


def import_lichess_csv(conn: sqlite3.Connection, csv_text: str, quality_filter: bool = True, max_rows: int = 5000) -> ImportResult:
    reader = csv.DictReader(io.StringIO(csv_text))
    if not reader.fieldnames or not REQUIRED_COLUMNS.issubset(set(reader.fieldnames)):
        missing = sorted(REQUIRED_COLUMNS.difference(reader.fieldnames or []))
        return ImportResult(imported=0, skipped=0, errors=[f"Missing columns: {', '.join(missing)}"])

    imported = 0
    skipped = 0
    errors: list[str] = []

    for index, row in enumerate(reader):
        if index >= max_rows:
            break
        try:
            puzzle = parse_row(row)
            if quality_filter and not passes_quality_filter(puzzle):
                skipped += 1
                continue
            insert_puzzle(conn, puzzle)
            imported += 1
        except Exception as exc:
            skipped += 1
            if len(errors) < 10:
                errors.append(f"{row.get('PuzzleId', 'unknown')}: {exc}")

    conn.commit()
    return ImportResult(imported=imported, skipped=skipped, errors=errors)


def parse_row(row: dict[str, str]) -> dict:
    moves = row["Moves"].split()
    if len(moves) < 2:
        raise ValueError("Lichess puzzle needs at least initial move and one solution move")

    board = chess.Board(row["FEN"])
    board.push_uci(moves[0])
    fen_presented = board.fen()
    themes = row["Themes"].split()
    opening_tags = row["OpeningTags"].split()
    material_count = sum(1 for piece in board.piece_map().values() if piece.piece_type != chess.KING)
    phase, family, thinking_skills = classify(board, themes, opening_tags)

    return {
        "source": "lichess",
        "source_puzzle_id": row["PuzzleId"],
        "fen_before": row["FEN"],
        "fen_presented": fen_presented,
        "initial_opponent_move_uci": moves[0],
        "solution_moves_uci": moves[1:],
        "rating": int(row["Rating"]),
        "rating_deviation": int(row["RatingDeviation"]),
        "popularity": int(row["Popularity"]),
        "nb_plays": int(row["NbPlays"]),
        "themes_raw": themes,
        "opening_tags_raw": opening_tags,
        "phase": phase,
        "family": family,
        "move_number": int(row["FEN"].split()[5]),
        "material_count": material_count,
        "source_game_url": row["GameUrl"],
        "thinking_skills": thinking_skills,
    }


def passes_quality_filter(puzzle: dict) -> bool:
    return (
        800 <= puzzle["rating"] <= 2200
        and puzzle["rating_deviation"] <= 120
        and puzzle["popularity"] >= 70
        and puzzle["nb_plays"] >= 50
    )


def classify(board: chess.Board, themes: list[str], opening_tags: list[str]) -> tuple[str, str, list[str]]:
    theme_set = set(themes)
    non_king_material = sum(1 for piece in board.piece_map().values() if piece.piece_type != chess.KING)
    has_queen = any(piece.piece_type == chess.QUEEN for piece in board.piece_map().values())

    if {"endgame", "pawnEndgame", "rookEndgame", "queenEndgame"} & theme_set or non_king_material <= 6 or (not has_queen and non_king_material <= 10):
        phase = "endgame"
    elif opening_tags or board.fullmove_number <= 12 or "opening" in theme_set:
        phase = "opening"
    else:
        phase = "middlegame"

    if phase == "endgame" or {"pawnEndgame", "rookEndgame", "queenEndgame"} & theme_set:
        family = "endgame"
    elif "defensiveMove" in theme_set:
        family = "defense"
    elif {"fork", "pin", "skewer", "discoveredAttack", "backRankMate", "sacrifice", "mate", "mateIn1", "mateIn2"} & theme_set:
        family = "tactics"
    elif phase == "opening":
        family = "opening-transition"
    else:
        family = "calculation"

    skills = set()
    if {"mate", "mateIn1", "mateIn2", "fork", "pin", "skewer"} & theme_set:
        skills.update(["forcing_moves", "candidate_moves"])
    if "defensiveMove" in theme_set:
        skills.update(["threat_awareness", "defensive_resource"])
    if phase == "endgame":
        skills.update(["endgame_counting", "conversion_technique"])
    if not skills:
        skills.add("candidate_moves")
    return phase, family, sorted(skills)


def insert_puzzle(conn: sqlite3.Connection, puzzle: dict) -> None:
    cursor = conn.execute(
        """
        INSERT OR REPLACE INTO puzzles (
          source, source_puzzle_id, fen_before, fen_presented, initial_opponent_move_uci,
          solution_moves_uci, rating, rating_deviation, popularity, nb_plays,
          themes_raw, opening_tags_raw, phase, family, move_number, material_count, source_game_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            puzzle["source"],
            puzzle["source_puzzle_id"],
            puzzle["fen_before"],
            puzzle["fen_presented"],
            puzzle["initial_opponent_move_uci"],
            json.dumps(puzzle["solution_moves_uci"]),
            puzzle["rating"],
            puzzle["rating_deviation"],
            puzzle["popularity"],
            puzzle["nb_plays"],
            json.dumps(puzzle["themes_raw"]),
            json.dumps(puzzle["opening_tags_raw"]),
            puzzle["phase"],
            puzzle["family"],
            puzzle["move_number"],
            puzzle["material_count"],
            puzzle["source_game_url"],
        ),
    )
    puzzle_id = cursor.lastrowid
    for tag_type, values in {
        "phase": [puzzle["phase"]],
        "family": [puzzle["family"]],
        "opening": puzzle["opening_tags_raw"],
        "theme": puzzle["themes_raw"],
        "thinking_skill": puzzle["thinking_skills"],
    }.items():
        for value in values:
            conn.execute(
                """
                INSERT OR IGNORE INTO puzzle_tags (puzzle_id, tag_type, tag_value)
                VALUES (?, ?, ?)
                """,
                (puzzle_id, tag_type, value),
            )
