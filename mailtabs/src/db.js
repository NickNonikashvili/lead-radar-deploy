'use strict';

const Database = require('better-sqlite3');

// Each entry is one schema version. Never edit a released migration — append a new one.
//
// Ids use AUTOINCREMENT on purpose: plain INTEGER PRIMARY KEY reuses the id of the newest
// deleted row, and a background sync or body download still holding that id would then write
// into somebody else's account or message.
// accounts.config_version is bumped whenever an account's server/login changes, so a sync
// that started with the old settings can tell its writes are stale.
// messages.flags_changed_at records when the user last changed read/star in Mailtabs, so a
// sync that read the server's flags before that change doesn't undo it.
const MIGRATIONS = [
  // v1 — initial schema
  `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    config_version INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    last_synced_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(user_id, email COLLATE NOCASE)
  );

  CREATE TABLE tabs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    flags_changed_at INTEGER,
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

  // v2 — every folder, sending, drafts, outbox, conversations
  `
  CREATE TABLE folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    delimiter TEXT,
    parent_path TEXT,
    special_use TEXT,
    selectable INTEGER NOT NULL DEFAULT 1,
    sync_mode TEXT NOT NULL DEFAULT 'auto',
    sync_state TEXT,
    total_count INTEGER NOT NULL DEFAULT 0,
    unread_count INTEGER NOT NULL DEFAULT 0,
    has_older INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    last_opened_at INTEGER,
    created_at INTEGER NOT NULL,
    UNIQUE(account_id, path)
  );
  CREATE INDEX folders_account ON folders(account_id);
  CREATE INDEX folders_special ON folders(special_use);

  -- Every existing account has its INBOX; carry its sync position over.
  INSERT INTO folders (account_id, path, name, special_use, sync_mode, sync_state, last_synced_at, created_at)
    SELECT id, 'INBOX', 'Inbox', '\\Inbox', 'auto', sync_state, last_synced_at, created_at FROM accounts;

  ALTER TABLE messages ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE CASCADE;
  ALTER TABLE messages ADD COLUMN in_reply_to TEXT;
  ALTER TABLE messages ADD COLUMN references_json TEXT;
  ALTER TABLE messages ADD COLUMN thread_key TEXT;
  ALTER TABLE messages ADD COLUMN is_draft INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE messages ADD COLUMN is_answered INTEGER NOT NULL DEFAULT 0;
  UPDATE messages SET folder_id = (
    SELECT f.id FROM folders f WHERE f.account_id = messages.account_id AND f.path = messages.mailbox
  );
  UPDATE messages SET thread_key = 'mid:' || message_id WHERE message_id IS NOT NULL;
  CREATE INDEX messages_folder_date ON messages(folder_id, date DESC, id DESC);
  CREATE INDEX messages_thread ON messages(account_id, thread_key);
  CREATE INDEX messages_account_msgid ON messages(account_id, message_id);

  ALTER TABLE accounts ADD COLUMN smtp_host TEXT;
  ALTER TABLE accounts ADD COLUMN smtp_port INTEGER;
  ALTER TABLE accounts ADD COLUMN smtp_security TEXT;
  ALTER TABLE accounts ADD COLUMN smtp_user TEXT;
  ALTER TABLE accounts ADD COLUMN smtp_secret_enc TEXT;
  ALTER TABLE accounts ADD COLUMN sender_name TEXT;
  ALTER TABLE accounts ADD COLUMN signature_html TEXT;
  ALTER TABLE accounts ADD COLUMN folders_synced_at INTEGER;

  CREATE TABLE user_settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    settings TEXT NOT NULL DEFAULT '{}'
  );

  CREATE TABLE uploads (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    path TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX uploads_user ON uploads(user_id);

  CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    payload TEXT NOT NULL,
    send_at INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    draft_folder_id INTEGER,
    draft_uid INTEGER,
    sent_message_id TEXT,
    created_at INTEGER NOT NULL,
    sent_at INTEGER
  );
  CREATE INDEX outbox_due ON outbox(status, send_at);
  CREATE INDEX outbox_user ON outbox(user_id, status);
    `,

  // v3 — Microsoft accounts whose SMTP AUTH is turned off (535 5.7.139) send through Microsoft
  // Graph: smtp_disabled_at records when Microsoft refused SMTP, so later sends go straight to
  // Graph. (folders.sync_mode may now also be 'hidden': Exchange's calendar, contacts, … folders.)
  `
  ALTER TABLE accounts ADD COLUMN smtp_disabled_at INTEGER;
  `,

  // v4 —
  //  * outbox_uploads: the uploads each outbox row needs (an indexed lookup instead of parsing
  //    every waiting payload). The trigger records a payload's own uploads; the outbox adds the
  //    ones it reaches through carried_parts.
  //  * outbox.handed_over_at: when the current attempt started handing the message to the
  //    server (after that, a lost connection means "may have been sent", never an automatic
  //    resend). outbox.pending_recipients: JSON list of recipients a partly delivered message
  //    still has to reach (NULL = all of them).
  //  * carried_parts: attachments and inline images of a draft that a later save replaced, kept
  //    as uploads, so a composer that still refers to them by the old draft's row keeps working.
  //  * moved_messages: where a moved message went, so references to its old row (a forward's
  //    attachments) still find it.
  //  * messages_pre_v2: the rows stored before conversations existed (no References read yet),
  //    which the sync gives their threading headers a batch at a time.
  `
  CREATE TABLE outbox_uploads (
    outbox_id INTEGER NOT NULL REFERENCES outbox(id) ON DELETE CASCADE,
    upload_id TEXT NOT NULL,
    PRIMARY KEY (outbox_id, upload_id)
  );
  CREATE INDEX outbox_uploads_upload ON outbox_uploads(upload_id);
  CREATE TRIGGER outbox_uploads_ai AFTER INSERT ON outbox BEGIN
    INSERT OR IGNORE INTO outbox_uploads (outbox_id, upload_id)
      SELECT new.id, json_extract(a.value, '$.uploadId')
        FROM json_each(CASE WHEN json_valid(new.payload) THEN new.payload ELSE '{}' END, '$.attachments') a
       WHERE a.type = 'object' AND json_type(a.value, '$.uploadId') = 'text';
  END;
  INSERT OR IGNORE INTO outbox_uploads (outbox_id, upload_id)
    SELECT o.id, json_extract(a.value, '$.uploadId')
      FROM outbox o, json_each(CASE WHEN json_valid(o.payload) THEN o.payload ELSE '{}' END, '$.attachments') a
     WHERE a.type = 'object' AND json_type(a.value, '$.uploadId') = 'text';

  ALTER TABLE outbox ADD COLUMN handed_over_at INTEGER;
  ALTER TABLE outbox ADD COLUMN pending_recipients TEXT;

  CREATE TABLE carried_parts (
    message_id INTEGER NOT NULL,
    part_index INTEGER NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, part_index)
  );
  CREATE INDEX carried_parts_upload ON carried_parts(upload_id);

  CREATE TABLE moved_messages (
    old_id INTEGER PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    message_id TEXT,
    folder_id INTEGER,
    uid INTEGER,
    uid_validity INTEGER,
    moved_at INTEGER NOT NULL
  );
  CREATE INDEX moved_messages_at ON moved_messages(moved_at);

  CREATE INDEX messages_pre_v2 ON messages(folder_id, uid) WHERE references_json IS NULL;
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

/** The database holds cached mail and sessions: keep it private to the server's user. */
function restrictPermissions(filePath) {
  const fs = require('fs');
  const path = require('path');
  try {
    fs.chmodSync(path.dirname(filePath), 0o700);
  } catch (_) {
    /* not ours to change (e.g. a mounted volume root) */
  }
  for (const f of [filePath, `${filePath}-wal`, `${filePath}-shm`]) {
    try {
      fs.chmodSync(f, 0o600);
    } catch (_) {
      /* WAL files appear later; SQLite creates them with the db file's mode */
    }
  }
}

/**
 * Open (or create) the SQLite database and bring the schema up to date.
 * @param {string} filePath path to the .db file, or ':memory:'
 */
function openDb(filePath) {
  const db = new Database(filePath);
  if (filePath !== ':memory:') restrictPermissions(filePath);
  if (filePath !== ':memory:') db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}

module.exports = { openDb, MIGRATIONS };
