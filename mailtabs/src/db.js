'use strict';

const Database = require('better-sqlite3');

// Each entry is one schema version. Never edit a released migration — append a new one.
const MIGRATIONS = [
  // v1 — initial schema
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    auth_type TEXT NOT NULL,
    email TEXT NOT NULL,
    display_name TEXT,
    color TEXT NOT NULL DEFAULT '#4f46e5',
    imap_host TEXT NOT NULL,
    imap_port INTEGER NOT NULL,
    imap_security TEXT NOT NULL,
    imap_user TEXT NOT NULL,
    secret_enc TEXT NOT NULL,
    mailbox TEXT NOT NULL DEFAULT 'INBOX',
    sync_state TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    last_error TEXT,
    last_synced_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, email COLLATE NOCASE)
  );

  CREATE TABLE tabs (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#4f46e5',
    position INTEGER NOT NULL,
    all_accounts INTEGER NOT NULL DEFAULT 0,
    rules TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX tabs_user ON tabs(user_id, position);

  CREATE TABLE tab_accounts (
    tab_id INTEGER NOT NULL REFERENCES tabs(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    PRIMARY KEY (tab_id, account_id)
  );
  CREATE INDEX tab_accounts_account ON tab_accounts(account_id);

  CREATE TABLE messages (
    id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    mailbox TEXT NOT NULL,
    uid INTEGER NOT NULL,
    uid_validity INTEGER NOT NULL,
    message_id TEXT,
    from_name TEXT,
    from_address TEXT,
    to_json TEXT,
    cc_json TEXT,
    reply_to_json TEXT,
    subject TEXT,
    snippet TEXT,
    date INTEGER NOT NULL,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_starred INTEGER NOT NULL DEFAULT 0,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    size INTEGER,
    body_state TEXT NOT NULL DEFAULT 'deferred',
    text_body TEXT,
    html_body TEXT,
    attachments_json TEXT,
    remote_image_count INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    UNIQUE(account_id, mailbox, uid_validity, uid)
  );
  CREATE INDEX messages_account_date ON messages(account_id, date DESC, id DESC);
  CREATE INDEX messages_date ON messages(date DESC, id DESC);

  CREATE VIRTUAL TABLE messages_fts USING fts5(
    subject, from_name, from_address, snippet, text_body,
    content='messages', content_rowid='id', tokenize='unicode61 remove_diacritics 2'
  );
  CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, subject, from_name, from_address, snippet, text_body)
    VALUES (new.id, new.subject, new.from_name, new.from_address, new.snippet, new.text_body);
  END;
  CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, subject, from_name, from_address, snippet, text_body)
    VALUES ('delete', old.id, old.subject, old.from_name, old.from_address, old.snippet, old.text_body);
  END;
  CREATE TRIGGER messages_au AFTER UPDATE OF subject, from_name, from_address, snippet, text_body ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, subject, from_name, from_address, snippet, text_body)
    VALUES ('delete', old.id, old.subject, old.from_name, old.from_address, old.snippet, old.text_body);
    INSERT INTO messages_fts(rowid, subject, from_name, from_address, snippet, text_body)
    VALUES (new.id, new.subject, new.from_name, new.from_address, new.snippet, new.text_body);
  END;

  CREATE TABLE oauth_states (
    state TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    account_id INTEGER,
    tab_ids TEXT,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  `,
];

function migrate(db) {
  const current = db.pragma('user_version', { simple: true });
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

/**
 * Open (or create) the SQLite database and bring the schema up to date.
 * @param {string} filePath path to the .db file, or ':memory:'
 */
function openDb(filePath) {
  const db = new Database(filePath);
  if (filePath !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

module.exports = { openDb, MIGRATIONS };
