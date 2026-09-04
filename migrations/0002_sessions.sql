-- Sessions for cookie-based authentication.
--
-- Design notes:
--  * `id` is the SHA-256 hash of the session token, not the token itself.
--    The raw token only ever exists in the user's cookie, so a dump of this
--    table cannot be replayed to impersonate anyone.
--  * Sessions are rows rather than signed stateless tokens so that logout,
--    "sign out everywhere" and password changes can revoke access immediately.
--  * Expired rows are deleted opportunistically on lookup; there is no cron.

CREATE TABLE sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,

  CHECK (length(id) = 64)
);

CREATE INDEX idx_sessions_user    ON sessions (user_id);
CREATE INDEX idx_sessions_expires ON sessions (expires_at);
