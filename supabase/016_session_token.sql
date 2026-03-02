-- Session token for single-device enforcement
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_token TEXT DEFAULT NULL;
