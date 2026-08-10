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

-- duration_ms is nullable on purpose: every score recorded before the daily
-- was timed has none, and those keep their place on score while sitting
-- behind a timed run on a tie.
CREATE TABLE IF NOT EXISTS daily_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_size INTEGER NOT NULL,
  challenge_date TEXT NOT NULL,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  board TEXT,
  ending_roll INTEGER,
  duration_ms INTEGER,
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

-- A game in transit between two devices. The payload is the sending device's
-- own saved game, held only long enough to be collected: fifteen minutes, and
-- once claimed the row keeps a claimed_at so the sender can be told it landed
-- but the payload can never be handed out twice.
CREATE TABLE IF NOT EXISTS transfers (
  code TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  claimed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfers_expires ON transfers (expires_at);

CREATE TABLE IF NOT EXISTS device_placements (
  device_id TEXT NOT NULL,
  board_size INTEGER NOT NULL,
  position INTEGER NOT NULL,
  value_bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (device_id, board_size, position, value_bucket)
);

CREATE INDEX IF NOT EXISTS idx_device_placements_device ON device_placements (device_id);
