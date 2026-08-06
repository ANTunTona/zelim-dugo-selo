CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  support_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  moderated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_proposals_status
ON proposals(status);

CREATE INDEX IF NOT EXISTS idx_proposals_created_at
ON proposals(created_at);

CREATE INDEX IF NOT EXISTS idx_proposals_category
ON proposals(category);