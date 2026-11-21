ALTER TABLE users ADD COLUMN google_sub TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);
CREATE TABLE password_resets (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at INTEGER NOT NULL,
 requested_at INTEGER NOT NULL
);
ALTER TABLE photos ADD COLUMN country TEXT NOT NULL DEFAULT '';
ALTER TABLE photos ADD COLUMN region TEXT NOT NULL DEFAULT '';
CREATE TABLE backup_restores (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 digest TEXT NOT NULL,
 PRIMARY KEY(user_id,digest)
);
