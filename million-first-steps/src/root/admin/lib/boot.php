<?php
/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *  Million First Steps — admin panel core.   require __DIR__ . '/lib/boot.php';   (index.php does this)
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════
 *
 *  FILES
 *    admin/index.php            front controller: ?p=<page>[&id=…]; registers every page; default = dashboard
 *    admin/modules/<page>.php   one file per page, included by index.php INSIDE A FUNCTION (variables stay local)
 *    admin/lib/boot.php         this file: constants, loads the helpers below, mfs_web_start()
 *    admin/lib/helpers.php      h t tp url redirect is_post post get get_int post_ids flash dates money badges pager
 *    admin/lib/db.php           mfs_data_dir db db_tx db_value db_row db_all db_exec setting set_setting audit + schema
 *    admin/lib/auth.php         sessions, current_user require_login require_owner is_owner csrf_* passwords, throttling
 *    admin/lib/catalog.php      catalog tours tiers tour_name tier_name party_factors suggest_price effective_contact
 *                               contact_channel_url form_recipients write_live_json
 *    admin/lib/layout.php       render render_error asset   ·   icons.php: icon()   ·   mail.php: send_mail()
 *    admin/lib/stats.php        visitor counting (api/hit.php)   ·   housekeeping.php: daily clean-up
 *    admin/lib/store.php        mfs_store_request (send.php → database), mfs_store_note
 *    admin/lib/lang/ka.php      Georgian UI strings: return ['English text' => 'ქართული', …];
 *    admin/lib/catalog.json     written by the build: tours, tiers, languages, built-in contact details, party factors
 *    admin/lib/setup-key.php    written by the build: the first-run setup key
 *    admin/assets/admin.css     the design system (component list at its top) · admin.js: data-attribute behaviours
 *    admin/assets/<module>.css|js   module extras: render(…, ['css' => ['bookings.css'], 'js' => ['bookings.js']])
 *    Data folder (mfs_data_dir()): <above the site>/mfs-data, else admin/data — mfs.sqlite (+ -wal/-shm), sessions/
 *
 *  HELPERS (use exactly these)
 *    db(): PDO                               shared SQLite connection (exceptions on error, rows as assoc arrays)
 *    db_value($sql, $args): mixed|null       first column of the first row     db_row($sql, $args): ?array
 *    db_all($sql, $args): array              all rows                          db_exec($sql, $args): int (rows changed)
 *    db_tx(function (PDO $pdo) { … }): mixed one write transaction (BEGIN IMMEDIATE; rolled back on exception)
 *        NOTE: on PHP < 8.1 numbers come back as strings — cast with (int)/(float) before comparing.
 *    h($s): string                           escape for HTML — wrap EVERY printed value, including t() results
 *    t($english, $vars = []): string         translated PLAIN text: h(t('Hello, {name}', ['name' => $u['name']]))
 *    tp($n, '{n} request', '{n} requests')   plural form, {n} filled in (formatted)
 *    url($page, $params = []): string        'index.php?p=requests&status=new' (empty params dropped) — print with h()
 *    redirect($url): never                   303 + exit (use after every POST: POST-redirect-GET)
 *    current_user(): ?array                  users row (id, email, name, role 'owner'|'staff', lang, active, …)
 *    current_user_id(): ?int    is_owner(): bool
 *    require_login(): array                  not signed in → login page (then back here); returns the user
 *    require_owner(): array                  team members get a calm 403 page
 *    csrf_field(): string                    hidden input — in EVERY <form method="post">
 *    csrf_check(): void                      FIRST line of every POST handler (also checks Origin/Referer host)
 *    is_post(): bool    post($key, $default = ''): string (trimmed, control chars removed, keeps new lines)
 *    get($key, $default = ''): string        get_int($key, $default = 0): int     post_ids('ids'): int[] (bulk forms)
 *    flash($type, $message): void            'ok' | 'error' | 'info' — shown once on the next rendered page
 *    render($title, $bodyHtml, $opts): never full page. $opts: nav, css, js, actions, crumbs, lead, status, width
 *                                            ('narrow'), head (false = no page header), layout ('auth'), body_class
 *    render_error($status, $title, $message, $extraHtml = ''): never     calm error card (403/404/400 …)
 *    setting($key, $default = null)          JSON-decoded; falls back to SETTING_DEFAULTS when $default is null
 *    set_setting($key, $value): void         stores JSON (records updated_at / updated_by)
 *    catalog(): array                        lib/catalog.json: brand, languages[{code,name}], tiers[{id,name}],
 *                                            tours[{id,name,days,styles,prices}], partyFactors{"1".."8"}, contact{…}
 *    tours(): array                          keyed by tour id, website order: id, name, days, styles, prices (effective,
 *                                            {tier: €}), built_in_prices, price_overridden (bool), hidden (bool)
 *    tiers(): array ['wanderer' => 'Wanderer', …]     tour_name($id): string     tier_name($id): string
 *    party_factors(): array {"1".."8": factor} (overrides applied)
 *    suggest_price($tourId, $tier, $travellers): float   website price × party factor, rounded to €10 per person, × travellers
 *    effective_contact(): array              email, phone, whatsapp (number), telegram (username), signal, instagram,
 *                                            facebook, address, officeHours, legalName, registrationNumber
 *    CONTACT_FIELDS                          the same keys => English labels, in settings-page order
 *    contact_channel_url($key, $value)       whatsapp number → https://wa.me/…, telegram name → https://t.me/…
 *    form_recipients($builtIn = ''): array   where website forms are emailed (setting, else built-in address)
 *    write_live_json(): bool                 rebuild <site>/api/live.json — call after saving contact, tour_prices,
 *                                            tours_hidden, party_factors or notice
 *    audit($action, $target = '', $details = ''): void   e.g. audit('booking.create', 'booking:12', 'MFS-B-0012')
 *                                            convention: action "<area>.<verb>", target "<table>:<id>"
 *    send_mail($to, $subject, $body, $replyTo = ''): bool  plain-text email (sender: mfs_mail_from())
 *    fmt_money($n): string ('€1,250', '€1,250.50')         money_value($input): float (parses "1,250.50", "€90")
 *    fmt_date($utcOrYmd, $withTime = false): string        "20 Nov 2026" / "20 Nov 2026, 14:05" (Tbilisi time);
 *                                            a plain 'Y-m-d' (trip/due dates) is shown without time-zone shift
 *    fmt_ago($utc): string ("5 min ago", "yesterday, 14:05")   now_utc(): 'Y-m-d H:i:s' UTC (for created_at …)
 *    local_today(): 'Y-m-d' in Tbilisi       days_until($ymd): ?int (0 = today, -2 = two days ago)
 *    utc_to_local($utc): ?DateTime (Asia/Tbilisi)
 *    status_badge($status, 'request'|'booking'): string     coloured pill with translated label
 *    REQUEST_STATUSES / BOOKING_STATUSES / REQUEST_KINDS / USER_ROLES   ordered key => English label (t() them)
 *    pager($total, $page, $per, ['p' => 'requests', …filters]): string  page number travels as &page=N
 *    icon($name): string                     inline SVG: dashboard inbox calendar suitcase chart tag settings users
 *        user logout search plus download mail phone whatsapp telegram edit trash check arrow arrow-left external
 *        menu close chevron-left chevron-right chevron-down copy eye eye-off clock alert info globe note euro lock
 *        key home refresh bell filter star map-pin send history shield flag link print more sun
 *    Visitor data: valid_email($s), tel_href($phone), whatsapp_href($phone), mailto_href($email, $subject) —
 *        the ONLY ways to turn request data into links ('' when the value isn't safe/valid).
 *    Also: excerpt($s, 120), initials($name), phone_digits($s), mfs_parse_emails($s), asset('x.css'),
 *        mfs_store_request(array): ?int, mfs_store_note($requestId, $body, $kind = 'system', $userId = null),
 *        mfs_admin_base_url() ('https://host/admin/'), mfs_housekeeping(true) (force the daily clean-up),
 *        mfs_data_dir() (the private data folder, e.g. for a backup temp file), UI_LANGS ['en' => 'English', 'ka' => …].
 *    Passwords (team page): post_password($key) (raw, untrimmed) · password_problem($pw, $confirm = null): ''|reason
 *        (min MFS_PASSWORD_MIN = 10) · mfs_hash_password($pw). Saving a new password_hash signs that person out
 *        everywhere (sessions keep a fingerprint of it); setting users.active = 0 signs them out at once.
 *        A user's own password change: call mfs_refresh_session_password($newHash) to stay signed in.
 *    Notes timeline (notes.kind): 'note' (typed by a person), 'status' ("Status changed from New to Contacted"),
 *        'system' (automatic, e.g. "Email notification could not be sent"), 'email'. Store English text for
 *        status/system notes and show them through t().
 *    The top bar's search box sends ?p=requests&q=<text> (the requests page should read 'q').
 *
 *  STATS TABLES use UTC days (gmdate('Y-m-d')). stats_dims dims: lang (site language code, or 'other'),
 *    ref (referrer host without www, or '(direct)'; own-site navigation is not counted), device (phone|tablet|
 *    desktop|unknown). stats_pages.path is normalised: '/', '/about', '/tours/', '/ru/tours/cradle-of-wine',
 *    '(not found)' for addresses that don't exist.
 *  SETTINGS beyond the spec (internal — never show): housekeeping_day, daily_salt, cookie_secret (signs the small
 *    cookies of people who aren't signed in), dummy_hash, id_floor (db_next_id), site_url (the address the owners
 *    sign in at — links in emails use it, see mfs_site_origin()); mail_from (Settings › Form emails).
 *    Backups leave out daily_salt, housekeeping_day, cookie_secret and dummy_hash.
 *  SESSIONS only exist for people who are signed in; before that, the form token (mfs_pre), messages
 *    (mfs_flash), the language (mfs_lang) and "this device signed in before" (mfs_dev) are small cookies.
 *
 *  A MODULE (admin/modules/example.php)
 *    <?php
 *    $me = require_login();                          // or require_owner()
 *    $id = get_int('id');
 *    $row = db_row('SELECT * FROM bookings WHERE id = ?', [$id]);
 *    if (!$row) render_error(404, t('Not found'), t('This booking no longer exists.'));
 *    if (is_post()) {
 *      csrf_check();
 *      if (post('action') === 'save') {
 *        $name = post('client_name');
 *        if ($name === '') { flash('error', t('Please enter the client’s name.')); redirect(url('example', ['id' => $id])); }
 *        db_exec('UPDATE bookings SET client_name = ?, updated_at = ? WHERE id = ?', [$name, now_utc(), $id]);
 *        audit('booking.update', 'booking:' . $id);
 *        flash('ok', t('Saved.'));
 *      }
 *      redirect(url('example', ['id' => $id]));
 *    }
 *    ob_start(); ?>
 *    <form method="post" class="card form" data-once>
 *      <?= csrf_field() ?><input type="hidden" name="action" value="save">
 *      <div class="field"><label class="field__label" for="cn"><?= h(t('Client name')) ?></label>
 *        <input class="input" id="cn" name="client_name" value="<?= h($row['client_name']) ?>" required></div>
 *      <div class="form-actions"><button class="btn btn--primary"><?= icon('check') ?><?= h(t('Save')) ?></button></div>
 *    </form>
 *    <?php
 *    render(t('Booking {ref}', ['ref' => $row['ref']]), ob_get_clean(), [
 *      'nav' => 'bookings', 'crumbs' => [[t('Bookings'), url('bookings')], [$row['ref'], '']],
 *      'actions' => '<a class="btn btn--secondary" href="' . h(url('bookings')) . '">' . h(t('Back')) . '</a>',
 *    ]);
 *
 *    Rules: escape everything with h(); all state changes are POST + csrf_check(); prepared statements only;
 *    whitelist ORDER BY / filter columns; no inline <script> or on*= attributes (CSP) — use admin.js data
 *    attributes or admin/assets/<module>.js; downloads send their own headers and exit; every UI string via t().
 *
 *  CSS CHEAT-SHEET (admin/assets/admin.css — full list with markup at the top of that file)
 *    layout     .content--narrow · .page-head (__title __lead __actions) · .crumbs · .stack · .row · .row--between
 *               .grid .grid--2/3/4 · .split (main + 340px aside) · .section-title · .spacer
 *    cards      .card (.card--flush .card--muted .card--accent .card--danger) · .card__head .card__title .card__sub
 *               .card__actions .card__body .card__foot
 *    KPIs       .kpis > .kpi (.kpi--gold/--wine/--green/--blue) · .kpi__label .kpi__value .kpi__meta .kpi__icon
 *               .trend .trend--up/--down/--flat
 *    tables     .table-wrap > table.table (.table--compact .table--stack) · td[data-label] · .num · .nowrap
 *               tr.is-unread · tr[data-href] (whole row clickable) · .cell-main/.cell-sub · td.actions
 *    forms      .form · .field (.has-error) · .field__label .field__help .field__error .field__opt · .input .select
 *               .textarea · .check · .switch · .input-group (+ .input-group__addon) · .form-row (2 cols) ·
 *               .form-row--3 · .fieldset/.legend · .form-actions · .input--sm · .search-input
 *    buttons    .btn (.btn--primary gold, --secondary, --danger, --ghost, --sm, --icon, --block, --link) · .btn-row
 *    pills      .pill .pill--new/contacted/quoted/booked/lost/spam/quote/confirmed/completed/cancelled/muted/
 *               owner/staff/gold/wine/green/blue · .badge (count) · .dot (.dot--new …)
 *    tabs       .tabs > a.tab (.is-active) > .tab__count · filters: .toolbar (__group __search __spacer) ·
 *               .bulkbar (button[data-bulk] auto-enabled) · .chips > .chip(.is-active)
 *    feedback   .flash (--ok/--error/--info) · .callout (--info/--warn/--danger/--ok) · .empty (__mark __title
 *               __text) · .skeleton (shimmer block)
 *    lists      .list > .list__item (__main __title __meta __aside) · .timeline > .tl-item (--note/--status/
 *               --system/--email) (__dot __head __who __time __body) · .dl (key/value grid) · .kv (detail panel:
 *               .kv__row .kv__key .kv__val) · .pager
 *    charts     .chart (__head __title __legend __svg) · .chart-grid .chart-axis .chart-bar .chart-line .chart-area
 *               .chart-dot · .bars > .bar-row (__label __track __fill __value) · .progress > .progress__fill
 *    calendar   .cal (__nav __title) · .cal__grid · .cal__dow · .cal__day (.is-today .is-other .is-weekend) ·
 *               .cal__num · .cal__bar (--quote/--confirmed/--completed/--cancelled, .is-start .is-end)
 *    misc       .danger-zone · .avatar · .muted .small .mono .strong .nowrap .truncate .sr-only .text-right
 *               .hide-sm .show-sm · .divider · .meta (inline facts with dots) · .disclosure (details/summary)
 *
 *  ADMIN.JS data attributes: data-menu-toggle / data-menu-close · data-confirm="Question?" (forms, buttons,
 *    links) · data-autosubmit (select/input submits its form on change) · data-copy="text" (+ data-copied="Copied")
 *    · data-check-all="ids[]" + input[name="ids[]"] + button[data-bulk] (+ [data-bulk-count]) · data-dismiss
 *    (closes .flash) · data-href on rows · data-toggle-password="#id" · data-toggle="#id" (show/hide) ·
 *    data-once (form: disable submit buttons after submitting) · data-autofocus-end
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════ */

if (isset($_SERVER['SCRIPT_FILENAME']) && @realpath((string) $_SERVER['SCRIPT_FILENAME']) === __FILE__) { http_response_code(404); exit; }
if (defined('MFS_BOOTED')) return;
define('MFS_BOOTED', 1);
define('MFS_LIB', __DIR__);
define('MFS_ADMIN_DIR', dirname(__DIR__));
define('MFS_SITE_ROOT', dirname(MFS_ADMIN_DIR));
define('MFS_TZ', 'Asia/Tbilisi');

if (is_file(MFS_ADMIN_DIR . '/config.local.php')) require MFS_ADMIN_DIR . '/config.local.php';
date_default_timezone_set('UTC');
if (PHP_SAPI !== 'cli') {
  ini_set('display_errors', '0');
  ini_set('log_errors', '1');
}

require_once __DIR__ . '/helpers.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/icons.php';
require_once __DIR__ . '/layout.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/stats.php';
require_once __DIR__ . '/housekeeping.php';
require_once __DIR__ . '/store.php';

/** Security headers for every admin response (spec §4.3). */
function mfs_security_headers(): void
{
  if (headers_sent()) return;
  header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
  header('X-Frame-Options: DENY');
  header('Referrer-Policy: same-origin');
  header('X-Robots-Tag: noindex, nofollow');
  header('X-Content-Type-Options: nosniff');
  header('Cache-Control: no-store');
  header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
  if (mfs_is_https()) header('Strict-Transport-Security: max-age=15552000');
}

/** Starts an admin page request: headers, error page, data folder + database, session, language, daily clean-up. */
function mfs_web_start(): void
{
  mfs_security_headers();
  set_exception_handler(function ($e) {
    error_log('[mfs-admin] ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if ($e instanceof MfsSetupError) {
      mfs_fatal_page(503, t('The team area needs a little setting up'),
        t('It needs a private folder it can write to and PHP’s SQLite support. On Hostinger: in File Manager, create a folder named “mfs-data” next to public_html (not inside it). If that isn’t possible, make sure public_html/admin/data can be written to.'),
        $e->getMessage());
    }
    mfs_fatal_page(500, t('Something went wrong'), t('Sorry — this page could not be shown. Please go back and try again in a moment. If it keeps happening, tell whoever looks after the website.'));
  });
  db();
  mfs_bounce_cross_site();
  mfs_session_start();
  if (!current_user() && isset($_GET['lang']) && is_string($_GET['lang']) && isset(UI_LANGS[$_GET['lang']])) mfs_remember_lang($_GET['lang']);
  mfs_housekeeping();
}
