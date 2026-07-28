CREATE TABLE IF NOT EXISTS placements (
  board_size INTEGER NOT NULL,
  position INTEGER NOT NULL,
  value_bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (board_size, position, value_bucket)
);

CREATE TABLE IF NOT EXISTS scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_size INTEGER NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  board TEXT,
  ending_roll INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_board_created ON scores (board_size, created_at);

CREATE TABLE IF NOT EXISTS daily_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_size INTEGER NOT NULL,
  challenge_date TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  board TEXT,
  ending_roll INTEGER,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_date ON daily_scores (challenge_date);

CREATE TABLE IF NOT EXISTS streaks (
  device_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  streak_count INTEGER NOT NULL,
  last_played_date TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_streaks_last_played ON streaks (last_played_date);

CREATE TABLE IF NOT EXISTS game_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  name TEXT,
  date TEXT NOT NULL,
  mode TEXT NOT NULL,
  board_size INTEGER NOT NULL,
  placed_count INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_log_device_date ON game_log (device_id, date);
CREATE INDEX IF NOT EXISTS idx_game_log_date ON game_log (date);

-- One pre-computed row per completed day, written by the nightly cron rather
-- than aggregated on every read. game_log can answer all of this directly,
-- but only by scanning every row for that date on each request; the app opens
-- this panel often and the answer never changes once the day is over. Keying
-- on date (not an autoincrement id) makes a re-run of the same day an upsert,
-- so a retried cron invocation can't double-count.
CREATE TABLE IF NOT EXISTS daily_summary (
  date TEXT PRIMARY KEY,
  games INTEGER NOT NULL,
  players INTEGER NOT NULL,
  busiest_name TEXT,
  busiest_games INTEGER,
  best_name TEXT,
  best_score INTEGER,
  best_board_size INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS device_placements (
  device_id TEXT NOT NULL,
  board_size INTEGER NOT NULL,
  position INTEGER NOT NULL,
  value_bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, board_size, position, value_bucket)
);

CREATE INDEX IF NOT EXISTS idx_device_placements_device ON device_placements (device_id);
