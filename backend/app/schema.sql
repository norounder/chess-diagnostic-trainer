PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  estimated_rating INTEGER NOT NULL DEFAULT 1400,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS puzzles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_puzzle_id TEXT NOT NULL,
  fen_before TEXT NOT NULL,
  fen_presented TEXT NOT NULL,
  initial_opponent_move_uci TEXT NOT NULL,
  solution_moves_uci TEXT NOT NULL,
  rating INTEGER NOT NULL,
  rating_deviation INTEGER NOT NULL,
  popularity INTEGER NOT NULL,
  nb_plays INTEGER NOT NULL,
  themes_raw TEXT NOT NULL,
  opening_tags_raw TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('opening', 'middlegame', 'endgame')),
  family TEXT NOT NULL,
  move_number INTEGER NOT NULL,
  material_count INTEGER NOT NULL,
  source_game_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source, source_puzzle_id)
);

CREATE INDEX IF NOT EXISTS idx_puzzles_rating ON puzzles (rating);
CREATE INDEX IF NOT EXISTS idx_puzzles_phase ON puzzles (phase);
CREATE INDEX IF NOT EXISTS idx_puzzles_family ON puzzles (family);

CREATE TABLE IF NOT EXISTS puzzle_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('phase', 'theme', 'family', 'thinking_skill', 'opening')),
  tag_value TEXT NOT NULL,
  UNIQUE (puzzle_id, tag_type, tag_value)
);

CREATE INDEX IF NOT EXISTS idx_puzzle_tags_lookup ON puzzle_tags (tag_type, tag_value);

CREATE TABLE IF NOT EXISTS training_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TEXT
);

CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES training_sessions(id) ON DELETE SET NULL,
  puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  result_type TEXT NOT NULL CHECK (
    result_type IN (
      'SOLVED_CLEAN',
      'SOLVED_SLOW',
      'FIRST_MOVE_WRONG',
      'LINE_FAILED',
      'GAVE_UP',
      'ILLEGAL_MOVE'
    )
  ),
  first_move_correct INTEGER NOT NULL CHECK (first_move_correct IN (0, 1)),
  full_line_correct INTEGER NOT NULL CHECK (full_line_correct IN (0, 1)),
  time_ms INTEGER NOT NULL,
  hint_count INTEGER NOT NULL DEFAULT 0,
  user_moves_uci TEXT NOT NULL,
  mistake_reason TEXT NOT NULL DEFAULT '[]',
  score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON attempts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_puzzle ON attempts (puzzle_id);

CREATE TABLE IF NOT EXISTS user_skill_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tag_type TEXT NOT NULL CHECK (tag_type IN ('phase', 'theme', 'family', 'thinking_skill', 'opening')),
  tag_value TEXT NOT NULL,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  first_move_correct_count INTEGER NOT NULL DEFAULT 0,
  full_line_correct_count INTEGER NOT NULL DEFAULT 0,
  avg_time_ms REAL NOT NULL DEFAULT 0,
  weakness_score REAL NOT NULL DEFAULT 0,
  last_updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, tag_type, tag_value)
);

CREATE TABLE IF NOT EXISTS review_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  due_at TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 0,
  ease REAL NOT NULL DEFAULT 2.2,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_result TEXT NOT NULL,
  UNIQUE (user_id, puzzle_id)
);

CREATE TABLE IF NOT EXISTS imported_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('lichess', 'chesscom', 'pgn_upload')),
  source_game_id TEXT,
  pgn TEXT NOT NULL,
  opponent TEXT,
  color TEXT CHECK (color IN ('white', 'black')),
  result TEXT,
  time_control TEXT,
  opening_name TEXT,
  played_at TEXT
);

CREATE TABLE IF NOT EXISTS game_move_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL REFERENCES imported_games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  fen TEXT NOT NULL,
  move_uci TEXT NOT NULL,
  best_move_uci TEXT,
  eval_before_cp INTEGER,
  eval_after_cp INTEGER,
  eval_loss_cp INTEGER,
  mistake_type TEXT CHECK (mistake_type IN ('inaccuracy', 'mistake', 'blunder')),
  phase TEXT CHECK (phase IN ('opening', 'middlegame', 'endgame')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (game_id, ply)
);

CREATE TABLE IF NOT EXISTS personal_puzzles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id INTEGER NOT NULL REFERENCES imported_games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL,
  fen_presented TEXT NOT NULL,
  solution_moves_uci TEXT NOT NULL,
  mistake_context TEXT NOT NULL,
  generated_from TEXT NOT NULL CHECK (generated_from IN ('user_blunder', 'missed_win', 'endgame_error')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
