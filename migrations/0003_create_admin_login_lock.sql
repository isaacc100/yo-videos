CREATE TABLE IF NOT EXISTS admin_login_lock (
  id TEXT PRIMARY KEY,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked INTEGER NOT NULL DEFAULT 0,
  unlock_hash TEXT,
  email_backoff_step INTEGER NOT NULL DEFAULT 0,
  next_email_at TEXT,
  reset_secret_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO admin_login_lock (id, failed_attempts, locked)
VALUES ('admin', 0, 0);
