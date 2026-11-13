'use strict';

/**
 * Attachment uploads: files the user attached in the composer, kept on disk under
 * <dataDir>/uploads/ (directory 0700, files 0600, named by a random id — never by the user's
 * filename) until the message is sent, or until cleanupUploads() finds them abandoned.
 */

const fs = require('fs');
const path = require('path');
const { HttpError } = require('./errors');
const { randomToken } = require('./crypto');
const { cleanFilename, cleanContentType } = require('./compose');

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
// Per user, so one account cannot fill the server's disk.
const MAX_USER_UPLOAD_BYTES = 250 * 1024 * 1024;
const MAX_USER_UPLOADS = 500;
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function uploadsDir(config) {
  return path.join(config.dataDir, 'uploads');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(dir, 0o700);
  } catch (_) {
    /* not ours to change */
  }
}

function toJson(row) {
  return { id: row.id, filename: row.filename, contentType: row.content_type, size: row.size };
}

/**
 * Store an uploaded file.
 * @returns {{ id, filename, contentType, size }}
 * @throws HttpError 413 UPLOAD_TOO_LARGE / UPLOAD_QUOTA, 400 INVALID_UPLOAD
 */
function saveUpload(deps, userId, { filename, contentType, buffer }) {
  const { db, config } = deps;
  if (!Buffer.isBuffer(buffer)) throw new HttpError(400, 'No file was uploaded.', 'INVALID_UPLOAD');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new HttpError(413, 'This file is too large to attach (at most 25 MB).', 'UPLOAD_TOO_LARGE');
  }
  const usage = db.prepare('SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM uploads WHERE user_id = ?').get(userId);
  if (usage.n >= MAX_USER_UPLOADS || usage.bytes + buffer.length > MAX_USER_UPLOAD_BYTES) {
    throw new HttpError(413, 'You have too many unsent attachments. Send or discard some drafts first.', 'UPLOAD_QUOTA');
  }

  const dir = uploadsDir(config);
  ensureDir(dir);
  const id = randomToken(18);
  const file = path.join(dir, id);
  const row = {
    id,
    user_id: userId,
    filename: cleanFilename(filename, 'attachment'),
    content_type: cleanContentType(contentType),
    size: buffer.length,
    path: file,
    created_at: Date.now(),
  };
  // 'wx': never overwrite (ids are random, so a collision means something is very wrong).
  fs.writeFileSync(file, buffer, { mode: 0o600, flag: 'wx' });
  try {
    db.prepare(
      'INSERT INTO uploads (id, user_id, filename, content_type, size, path, created_at) VALUES (@id, @user_id, @filename, @content_type, @size, @path, @created_at)'
    ).run(row);
  } catch (err) {
    fs.rmSync(file, { force: true });
    throw err;
  }
  return toJson(row);
}

/** The upload row if it belongs to the user, else null. */
function getUpload(db, userId, id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) return null;
  return db.prepare('SELECT * FROM uploads WHERE id = ? AND user_id = ?').get(id, userId) || null;
}

/**
 * The file's bytes. Throws HttpError 410 ATTACHMENT_GONE when it is missing or does not look
 * like one of ours (a row whose path left the uploads directory is never read).
 */
function readUpload(row) {
  const gone = () => new HttpError(410, `The attachment "${row && row.filename}" is no longer available — attach it again.`, 'ATTACHMENT_GONE');
  if (!row || typeof row.path !== 'string' || !path.isAbsolute(row.path) || path.basename(row.path) !== row.id) throw gone();
  let buf;
  try {
    buf = fs.readFileSync(row.path);
  } catch (_) {
    throw gone();
  }
  if (buf.length !== row.size) throw gone();
  return buf;
}

function removeFile(file) {
  try {
    fs.rmSync(file, { force: true });
  } catch (_) {
    /* already gone, or not ours */
  }
}

/** Delete an upload (row and file). Returns true when it existed. */
function deleteUpload(deps, userId, id) {
  const row = getUpload(deps.db, userId, id);
  if (!row) return false;
  deps.db.prepare('DELETE FROM uploads WHERE id = ? AND user_id = ?').run(row.id, userId);
  if (path.basename(row.path) === row.id) removeFile(row.path);
  return true;
}

/** Upload ids still needed by messages waiting in the outbox (queued, sending or failed). */
function uploadsInUse(db) {
  const ids = new Set();
  for (const { payload } of db.prepare("SELECT payload FROM outbox WHERE status IN ('queued', 'sending', 'failed')").all()) {
    try {
      const parsed = JSON.parse(payload);
      for (const a of (parsed && parsed.attachments) || []) if (a && typeof a.uploadId === 'string') ids.add(a.uploadId);
    } catch (_) {
      /* unreadable payload: nothing to keep */
    }
  }
  return ids;
}

/**
 * Remove uploads older than `olderThanMs` that no waiting outbox message uses, and stray files
 * in the uploads directory that have no row (e.g. after a crash between write and insert).
 * @returns {{ removed: number, strayFiles: number }}
 */
function cleanupUploads(deps, { olderThanMs = DEFAULT_MAX_AGE_MS } = {}) {
  const { db, config } = deps;
  const cutoff = Date.now() - Math.max(0, Number(olderThanMs) || 0);
  const keep = uploadsInUse(db);
  let removed = 0;
  for (const row of db.prepare('SELECT * FROM uploads WHERE created_at < ?').all(cutoff)) {
    if (keep.has(row.id)) continue;
    db.prepare('DELETE FROM uploads WHERE id = ?').run(row.id);
    if (path.basename(row.path) === row.id) removeFile(row.path);
    removed += 1;
  }

  let strayFiles = 0;
  const dir = uploadsDir(config);
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch (_) {
    names = [];
  }
  const known = db.prepare('SELECT 1 FROM uploads WHERE id = ?');
  for (const name of names) {
    if (!ID_RE.test(name) || known.get(name)) continue;
    const file = path.join(dir, name);
    try {
      const stat = fs.statSync(file);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        removeFile(file);
        strayFiles += 1;
      }
    } catch (_) {
      /* vanished meanwhile */
    }
  }
  return { removed, strayFiles };
}

module.exports = {
  MAX_UPLOAD_BYTES,
  saveUpload,
  getUpload,
  readUpload,
  deleteUpload,
  cleanupUploads,
  uploadsInUse,
  uploadJson: toJson,
};
