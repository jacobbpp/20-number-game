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
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_board_created ON scores (board_size, created_at);
