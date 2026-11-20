<?php
/*
 * Data folder, SQLite connection, schema migrations, settings and the audit log.
 * Loaded by boot.php — see the overview at the top of boot.php.
 */
if (!defined('MFS_BOOTED')) { http_response_code(404); exit; }

/** Thrown when the server can't run the admin panel (no writable folder, no SQLite). Shown as a friendly page. */
class MfsSetupError extends RuntimeException
{
}

/**
 * The private data folder (database + sessions). In order of preference:
 * MFS_DATA_DIR from admin/config.local.php; a folder that already holds the database;
 * <folder above the site>/mfs-data (outside public_html — best); admin/data (protected by .htaccess).
 */
function mfs_data_dir(): string
{
  static $dir = null;
  if ($dir !== null) return $dir;
  if (defined('MFS_DATA_DIR') && MFS_DATA_DIR) {
    $d = rtrim((string) MFS_DATA_DIR, '/\\');
    if (!@is_dir($d)) @mkdir($d, 0700, true);
    if (!@is_dir($d) || !@is_writable($d)) throw new MfsSetupError('The data folder set in admin/config.local.php (' . $d . ') does not exist or is not writable.');
    return $dir = $d;
  }
  $candidates = [dirname(MFS_SITE_ROOT) . '/mfs-data', MFS_ADMIN_DIR . '/data'];
  foreach ($candidates as $c) {
    if (!@is_file($c . '/mfs.sqlite')) continue;
    // Never start a second, empty database elsewhere just because the real one is briefly out of reach.
    if (!@is_writable($c) || !@is_writable($c . '/mfs.sqlite')) throw new MfsSetupError('The data folder ' . basename($c) . ' holds the database but cannot be written to.');
    return $dir = mfs_prepare_data_dir($c);
  }
  foreach ($candidates as $c) {
    if (@is_dir($c)) {
      if (@is_writable($c)) return $dir = mfs_prepare_data_dir($c);
    } elseif (@is_writable(dirname($c)) && @mkdir($c, 0700)) {
      return $dir = mfs_prepare_data_dir($c);
    }
  }
  throw new MfsSetupError('No writable data folder.');
}

/** Makes sure the data folder is private: deny-all .htaccess + empty index.html when it sits inside the website. */
function mfs_prepare_data_dir(string $d): string
{
  $inside = strpos(str_replace('\\', '/', (string) @realpath($d)) . '/', str_replace('\\', '/', (string) @realpath(MFS_SITE_ROOT)) . '/') === 0;
  if ($inside) {
    if (!@is_file($d . '/.htaccess')) @file_put_contents($d . '/.htaccess', "# Private data: never served.\n<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
    if (!@is_file($d . '/index.html')) @file_put_contents($d . '/index.html', '');
  }
  if (!@is_dir($d . '/sessions')) @mkdir($d . '/sessions', 0700);
  return $d;
}

/** The shared database connection (SQLite, WAL, foreign keys on). Creates/migrates the schema on first use. */
function db(): PDO
{
  static $pdo = null;
  if ($pdo instanceof PDO) return $pdo;
  if (!class_exists('PDO') || !in_array('sqlite', PDO::getAvailableDrivers(), true)) {
    throw new MfsSetupError('PHP\'s SQLite support (pdo_sqlite) is not switched on.');
  }
  $file = mfs_data_dir() . '/mfs.sqlite';
  $isNew = !@is_file($file);
  $conn = new PDO('sqlite:' . $file, null, null, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_TIMEOUT => 5,
  ]);
  if ($isNew) @chmod($file, 0600);
  $conn->exec('PRAGMA busy_timeout = 5000');
  $conn->query('PRAGMA journal_mode = WAL')->fetchAll();
  $conn->exec('PRAGMA synchronous = NORMAL');
  $conn->exec('PRAGMA foreign_keys = ON');
  mfs_migrate($conn);
  $pdo = $conn;
  return $pdo;
}

/**
 * Runs $fn inside one write transaction (BEGIN IMMEDIATE, so it waits for other writers instead of failing).
 * Returns $fn's result; rolls back and re-throws on any error. Nested calls join the outer transaction.
 */
function db_tx(callable $fn)
{
  $pdo = db();
  $depth = isset($GLOBALS['mfs_tx_depth']) ? (int) $GLOBALS['mfs_tx_depth'] : 0;
  if ($depth > 0) {
    $GLOBALS['mfs_tx_depth'] = $depth + 1;
    try {
      return $fn($pdo);
    } finally {
      $GLOBALS['mfs_tx_depth'] = $depth;
    }
  }
  $pdo->exec('BEGIN IMMEDIATE');
  $GLOBALS['mfs_tx_depth'] = 1;
  try {
    $r = $fn($pdo);
    $pdo->exec('COMMIT');
    return $r;
  } catch (Throwable $e) {
    try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
    throw $e;
  } finally {
    $GLOBALS['mfs_tx_depth'] = 0;
  }
}

/** One value from a query: db_value('SELECT COUNT(*) FROM requests WHERE status = ?', ['new']). */
function db_value(string $sql, array $args = [])
{
  $st = db()->prepare($sql);
  $st->execute($args);
  $v = $st->fetchColumn();
  return $v === false ? null : $v;
}

/** One row (or null). */
function db_row(string $sql, array $args = []): ?array
{
  $st = db()->prepare($sql);
  $st->execute($args);
  $r = $st->fetch(PDO::FETCH_ASSOC);
  return $r === false ? null : $r;
}

/** All rows. */
function db_all(string $sql, array $args = []): array
{
  $st = db()->prepare($sql);
  $st->execute($args);
  return $st->fetchAll(PDO::FETCH_ASSOC);
}

/** Runs a statement; returns the number of changed rows. */
function db_exec(string $sql, array $args = []): int
{
  $st = db()->prepare($sql);
  $st->execute($args);
  return $st->rowCount();
}

/** Schema versions: version => list of SQL statements. Add new versions at the end; never edit old ones. */
function mfs_migrations(): array
{
  return [
    1 => [
      "CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        email TEXT UNIQUE COLLATE NOCASE NOT NULL,
        name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
        lang TEXT NOT NULL DEFAULT 'en',
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      )",
      "CREATE TABLE login_attempts (
        id INTEGER PRIMARY KEY,
        ip_hash TEXT NOT NULL,
        email TEXT,
        ok INTEGER NOT NULL,
        at INTEGER NOT NULL
      )",
      "CREATE TABLE password_resets (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash TEXT UNIQUE NOT NULL,
        expires_at INTEGER NOT NULL,
        used_at INTEGER
      )",
      "CREATE TABLE requests (
        id INTEGER PRIMARY KEY,
        ref TEXT UNIQUE NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('trip','contact','partner','other')),
        kind_label TEXT,
        status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','booked','lost','spam')),
        name TEXT, email TEXT, phone TEXT, country TEXT, company TEXT,
        travel_dates TEXT, travellers TEXT, interests TEXT, tour_id TEXT, tier TEXT, message TEXT,
        fields_json TEXT NOT NULL,
        lang TEXT, page TEXT,
        assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
        follow_up_on TEXT,
        read_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )",
      "CREATE TABLE bookings (
        id INTEGER PRIMARY KEY,
        ref TEXT UNIQUE NOT NULL,
        request_id INTEGER REFERENCES requests(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'quote' CHECK (status IN ('quote','confirmed','completed','cancelled')),
        client_name TEXT NOT NULL, client_email TEXT, client_phone TEXT, client_country TEXT, client_lang TEXT,
        tour_id TEXT, tour_name TEXT, tier TEXT, start_date TEXT, end_date TEXT,
        adults INTEGER NOT NULL DEFAULT 2, children INTEGER NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0, deposit_amount REAL NOT NULL DEFAULT 0,
        deposit_due TEXT, balance_due TEXT,
        guide TEXT, driver TEXT, vehicle TEXT, accommodation TEXT, notes TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )",
      "CREATE TABLE payments (
        id INTEGER PRIMARY KEY,
        booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
        paid_on TEXT NOT NULL,
        amount REAL NOT NULL,
        method TEXT, note TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      )",
      "CREATE TABLE notes (
        id INTEGER PRIMARY KEY,
        request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','status','system','email')),
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )",
      "CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT,
        updated_by INTEGER
      )",
      "CREATE TABLE stats_daily (
        day TEXT PRIMARY KEY,
        views INTEGER NOT NULL DEFAULT 0,
        visitors INTEGER NOT NULL DEFAULT 0
      )",
      "CREATE TABLE stats_pages (
        day TEXT, path TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, path)
      )",
      "CREATE TABLE stats_dims (
        day TEXT, dim TEXT, value TEXT,
        views INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (day, dim, value)
      )",
      "CREATE TABLE stats_seen (
        day TEXT, hash TEXT,
        PRIMARY KEY (day, hash)
      )",
      "CREATE TABLE audit_log (
        id INTEGER PRIMARY KEY,
        user_id INTEGER,
        action TEXT NOT NULL,
        target TEXT,
        details TEXT,
        at TEXT NOT NULL
      )",
      "CREATE INDEX idx_requests_status ON requests(status, created_at)",
      "CREATE INDEX idx_requests_created ON requests(created_at)",
      "CREATE INDEX idx_bookings_start ON bookings(start_date, status)",
      "CREATE INDEX idx_bookings_request ON bookings(request_id)",
      "CREATE INDEX idx_payments_booking ON payments(booking_id)",
      "CREATE INDEX idx_notes_request ON notes(request_id)",
      "CREATE INDEX idx_notes_booking ON notes(booking_id)",
      "CREATE INDEX idx_login_ip ON login_attempts(ip_hash, at)",
      "CREATE INDEX idx_login_email ON login_attempts(email, at)",
      "CREATE INDEX idx_resets_user ON password_resets(user_id)",
      "CREATE INDEX idx_audit_at ON audit_log(at)",
    ],
    // Sessions end for good when access is switched off (a generation number in the session fingerprint);
    // a per-visitor view counter, so one visitor can't inflate the statistics.
    2 => [
      "ALTER TABLE users ADD COLUMN session_gen INTEGER NOT NULL DEFAULT 0",
      "ALTER TABLE stats_seen ADD COLUMN n INTEGER NOT NULL DEFAULT 0",
      // Ids handed out so far: db_next_id() never goes below them, even after the newest rows are deleted.
      "INSERT OR REPLACE INTO settings (key, value, updated_at) SELECT 'id_floor', '{\"users\":' || MAX(COALESCE((SELECT MAX(id) FROM users), 0),
         COALESCE((SELECT MAX(user_id) FROM audit_log), 0)) || ',\"requests\":' || COALESCE((SELECT MAX(id) FROM requests), 0)
         || ',\"bookings\":' || COALESCE((SELECT MAX(id) FROM bookings), 0) || '}', datetime('now')",
    ],
  ];
}

/**
 * The id for a new row in users, requests or bookings — never one a deleted row had (SQLite would hand the
 * highest id out again, so the activity log or an emailed link would point at someone or something else).
 * Call inside db_tx() and insert with that id. Keeps a high-water mark per table in the setting id_floor.
 */
function db_next_id(string $table): int
{
  if (!in_array($table, ['users', 'requests', 'bookings'], true)) throw new InvalidArgumentException('db_next_id: ' . $table);
  $floor = mfs_setting_fresh('id_floor');
  $floor = is_array($floor) ? $floor : [];
  $n = max((int) ($floor[$table] ?? 0), (int) db_value('SELECT COALESCE(MAX(id), 0) FROM ' . $table));
  if ($table === 'users') {
    // Ids an older copy of the panel may already have handed out and taken back.
    $n = max($n, (int) db_value('SELECT COALESCE(MAX(user_id), 0) FROM audit_log'), (int) db_value('SELECT COALESCE(MAX(updated_by), 0) FROM settings'));
  }
  $n++;
  $floor[$table] = $n;
  db_exec('INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, NULL)',
    ['id_floor', json_encode($floor), now_utc()]);
  $all = &mfs_settings_cache();
  $all['id_floor'] = $floor;
  return $n;
}

function mfs_schema_version(): int
{
  $m = mfs_migrations();
  return (int) max(array_keys($m));
}

function mfs_migrate(PDO $pdo): void
{
  $target = mfs_schema_version();
  if ((int) $pdo->query('PRAGMA user_version')->fetchColumn() >= $target) return;
  $pdo->exec('BEGIN IMMEDIATE');
  try {
    $v = (int) $pdo->query('PRAGMA user_version')->fetchColumn();
    foreach (mfs_migrations() as $version => $statements) {
      if ($v >= $version) continue;
      foreach ($statements as $sql) $pdo->exec($sql);
      $pdo->exec('PRAGMA user_version = ' . (int) $version);
      $v = $version;
    }
    $pdo->exec('COMMIT');
  } catch (Throwable $e) {
    try { $pdo->exec('ROLLBACK'); } catch (Throwable $ignored) {}
    throw $e;
  }
}

// ── Settings ────────────────────────────────────────────────────────────────

/** Values used when a setting has never been saved (and setting() gets no $default). */
const SETTING_DEFAULTS = [
  'contact' => [],
  'form_recipients' => '',
  'notify_new_request' => true,
  'tour_prices' => [],
  'tours_hidden' => [],
  'party_factors' => [],
  'notice' => ['enabled' => false, 'text' => []],
  'analytics_enabled' => true,
  'retention_months' => 24,
  'spam_retention_days' => 30,
];

function &mfs_settings_cache(): array
{
  static $cache = null;
  if ($cache === null) {
    $cache = [];
    foreach (db()->query('SELECT key, value FROM settings') as $row) {
      $v = json_decode((string) $row['value'], true);
      $cache[(string) $row['key']] = (json_last_error() === JSON_ERROR_NONE) ? $v : null;
    }
  }
  return $cache;
}

/** A saved setting (JSON-decoded). Falls back to $default, or to SETTING_DEFAULTS when $default is null. */
function setting($key, $default = null)
{
  $all = &mfs_settings_cache();
  if (array_key_exists($key, $all) && $all[$key] !== null) return $all[$key];
  if ($default === null && array_key_exists($key, SETTING_DEFAULTS)) return SETTING_DEFAULTS[$key];
  return $default;
}

/** Saves a setting (any JSON-encodable value). */
function set_setting($key, $value): void
{
  $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  if ($json === false) throw new InvalidArgumentException('Setting ' . $key . ' cannot be stored as JSON.');
  $uid = current_user_id();
  db_exec('INSERT OR REPLACE INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)', [(string) $key, $json, now_utc(), $uid]);
  $all = &mfs_settings_cache();
  $all[(string) $key] = $value;
}

/** Reads a setting straight from the database (no cache) — for values other requests may change meanwhile. */
function mfs_setting_fresh($key)
{
  $v = db_value('SELECT value FROM settings WHERE key = ?', [(string) $key]);
  if ($v === null) return null;
  $d = json_decode((string) $v, true);
  return json_last_error() === JSON_ERROR_NONE ? $d : null;
}

// ── Audit log ───────────────────────────────────────────────────────────────

/**
 * Records who did what: audit('request.status', 'request:12', 'new → contacted').
 * $details may be an array (stored as JSON). Never throws.
 */
function audit($action, $target = '', $details = ''): void
{
  try {
    if (is_array($details)) $details = json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    db_exec('INSERT INTO audit_log (user_id, action, target, details, at) VALUES (?, ?, ?, ?, ?)', [
      current_user_id(), (string) $action, (string) $target, (string) $details, now_utc(),
    ]);
  } catch (Throwable $e) {
    error_log('[mfs-admin] audit failed: ' . $e->getMessage());
  }
}
