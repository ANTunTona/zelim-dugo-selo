CREATE TABLE visitors (
  visitor_hash TEXT PRIMARY KEY,
  first_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visitors_last_seen
ON visitors(last_seen);