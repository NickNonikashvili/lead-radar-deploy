<?php
/*
 * EvoSoft admin panel, client finder: the Upwork tab, through Upwork's official GraphQL API only, on demand only.
 *   - Sign-in: OAuth 2.0 authorization code. "Connect Upwork" stores a random state in the panel session; Upwork
 *     sends the owner back to upwork_redirect_uri (this panel: ?view=finder&tab=upwork&code=…&state=…), where a
 *     button finishes the exchange by POST (nothing changes on a GET).
 *   - Tokens: evosoft-data/upwork-token.json, 0600, written atomically under umask 0077, encrypted with a key derived
 *     from upwork_client_secret. Refresh tokens rotate, so a refresh holds a lock and re-reads the file inside it.
 *   - Terms: searches only when the owner presses the button (never from a schedule); internal use; results sorted by
 *     Upwork (newest first) with no AI ranking; Upwork content cached for an hour at most and deleted within 24 hours;
 *     "Track" keeps only the job's address, the owner's own note and the date. Reply to clients on Upwork only.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

// Upwork's addresses (tests can point them at a local mock before the panel loads)
if (!defined('FINDER_UPWORK_AUTHORIZE_URL')) {
    define('FINDER_UPWORK_AUTHORIZE_URL', 'https://www.upwork.com/ab/account-security/oauth2/authorize');
}
if (!defined('FINDER_UPWORK_TOKEN_URL')) {
    define('FINDER_UPWORK_TOKEN_URL', 'https://www.upwork.com/api/v3/oauth2/token');
}
if (!defined('FINDER_UPWORK_GRAPHQL_URL')) {
    define('FINDER_UPWORK_GRAPHQL_URL', 'https://api.upwork.com/graphql');
}

const FINDER_UPWORK_KEYWORDS = ['website', 'web design', 'wordpress', 'shopify', 'landing page', 'web app'];
const FINDER_UPWORK_QUERY = <<<'GQL'
query FinderSearch($filter: MarketplaceJobPostingsSearchFilter, $searchType: MarketplaceJobPostingSearchType, $sort: [MarketplaceJobPostingSearchSortAttribute]) {
  marketplaceJobPostingsSearch(marketPlaceJobFilter: $filter, searchType: $searchType, sortAttributes: $sort) {
    totalCount
    edges {
      node {
        id ciphertext title description createdDateTime publishedDateTime experienceLevel
        amount { rawValue currency }
        hourlyBudgetType
        hourlyBudgetMin { rawValue currency }
        hourlyBudgetMax { rawValue currency }
        skills { name prettyName }
        job { contractTerms { contractType } }
        client {
          totalSpent { rawValue currency }
          totalHires totalReviews totalFeedback verificationStatus
          location { country }
        }
      }
    }
    pageInfo { endCursor hasNextPage }
  }
}
GQL;

function finder_upw_configured(): bool
{
    $c = finder_cfg();
    return $c['upwork_client_id'] !== '' && $c['upwork_client_secret'] !== '';
}

function finder_upw_token_file(): string
{
    return evo_data_dir() . '/upwork-token.json';
}

/** The saved sign-in, or null (none, or it can't be read with the current secret). */
function finder_upw_token_load(): ?array
{
    $file = finder_upw_token_file();
    clearstatcache(true, $file);
    if (!is_file($file)) {
        return null;
    }
    $d = json_decode((string)@file_get_contents($file), true);
    $plain = is_array($d) && is_string($d['sealed'] ?? null) ? finder_decrypt($d['sealed']) : null;
    $t = $plain !== null ? json_decode($plain, true) : null;
    return is_array($t) && is_string($t['access_token'] ?? null) && $t['access_token'] !== '' ? $t : null;
}

/** True when a token file exists but can't be read (the client secret changed since). */
function finder_upw_token_unreadable(): bool
{
    return is_file(finder_upw_token_file()) && finder_upw_token_load() === null;
}

/** A token as Upwork sends it: printable ASCII, no spaces (it goes into an HTTP header), at most 4 KB. */
function finder_upw_token_ok($v): bool
{
    return is_string($v) && $v !== '' && strlen($v) <= 4096 && preg_match('/^[\x21-\x7E]+$/', $v) === 1;
}

/** Saves a token response (keeping the old refresh token only if Upwork sent no new one). Returns the token or null. */
function finder_upw_token_save(array $resp, ?array $prev = null): ?array
{
    if (!finder_upw_token_ok($resp['access_token'] ?? null) || (isset($resp['refresh_token']) && !finder_upw_token_ok($resp['refresh_token']))) {
        error_log('EvoSoft finder: Upwork sent a token in an unexpected format; it was not saved.');
        return null;
    }
    $t = [
        'access_token' => (string)$resp['access_token'],
        'refresh_token' => (string)($resp['refresh_token'] ?? ($prev['refresh_token'] ?? '')),
        'expires_at' => time() + max(60, (int)($resp['expires_in'] ?? 86400)), // the docs show 86400; one example sends it as a string
        'refreshed_at' => time(),
        'connected_at' => (int)($prev['connected_at'] ?? time()),
    ];
    $sealed = finder_encrypt(json_encode($t));
    if ($sealed === null || !finder_write_atomic(finder_upw_token_file(), json_encode(['v' => 1, 'sealed' => $sealed]) . "\n")) {
        return null;
    }
    return $t;
}

function finder_upw_forget(): void
{
    @unlink(finder_upw_token_file());
    foreach (glob(finder_cache_dir() . '/upwork-*.json') ?: [] as $f) {
        @unlink($f);
    }
}

/**
 * Runs $fn holding the token lock (so two refreshes never race: the second would use a spent refresh token).
 * Waits for the lock until $deadline (microtime) at most, so a slow refresh elsewhere can't stretch this request.
 */
function finder_upw_locked(callable $fn, ?float $deadline = null)
{
    $deadline ??= microtime(true) + 25;
    $old = umask(0077);
    $fh = @fopen(finder_upw_token_file() . '.lock', 'c');
    umask($old);
    if ($fh === false) {
        return 'The Upwork sign-in file couldn’t be locked (is the data folder writable?).';
    }
    while (!flock($fh, LOCK_EX | LOCK_NB)) {
        if (finder_left($deadline) < 1) {
            fclose($fh);
            return 'Another Upwork step is still renewing the sign-in. Try again in a minute.';
        }
        usleep(100000);
    }
    try {
        return $fn();
    } finally {
        flock($fh, LOCK_UN);
        fclose($fh);
    }
}

/** POSTs to Upwork's token endpoint, within $timeout seconds (20 at most). */
function finder_upw_token_post(array $form, float $timeout = 20): array
{
    $c = finder_cfg();
    $r = finder_http('POST', FINDER_UPWORK_TOKEN_URL, ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json'],
        http_build_query($form + ['client_id' => $c['upwork_client_id'], 'client_secret' => $c['upwork_client_secret']]), max(2, min(20, $timeout)), 65536);
    return [$r['status'], json_decode($r['body'], true), $r['body'], $r['error']];
}

/** A clear message for a failed token request. */
function finder_upw_token_error(int $status, $j, string $raw, string $err): string
{
    $code = is_array($j) && is_string($j['error'] ?? null) ? $j['error'] : (preg_match('/invalid_(client|grant|request|scope)/', $raw, $m) ? $m[0] : '');
    if ($status === 0) {
        return $err === 'timeout' ? 'Upwork didn’t answer in time. Try again in a few minutes.' : 'Couldn’t reach Upwork. Try again later.';
    }
    if ($code === 'invalid_client') {
        return 'Upwork didn’t accept the app’s key (invalid_client). Check upwork_client_id and upwork_client_secret in the settings file: the secret changes when the key is rotated.';
    }
    if ($code === 'invalid_grant') {
        return 'The Upwork sign-in has expired or was withdrawn (invalid_grant). Connect Upwork again.';
    }
    if ($status === 429) {
        return 'Upwork is limiting requests from this server (HTTP 429). Wait a few minutes, then try again.';
    }
    if ($status >= 500) {
        return 'Upwork had a server problem (HTTP ' . $status . '). Try again later.';
    }
    return 'Upwork refused the sign-in (HTTP ' . $status . ($code !== '' ? ', ' . finder_line($code, 40) : '') . '). Check the key’s settings in Upwork’s API Center, then connect again.';
}

/** Exchanges the code from the callback for tokens. True, or an error message. */
function finder_upw_exchange(string $code): bool|string
{
    [$st, $j, $raw, $err] = finder_upw_token_post(['grant_type' => 'authorization_code', 'code' => $code, 'redirect_uri' => finder_cfg()['upwork_redirect_uri']]);
    if ($st !== 200 || !is_array($j) || !finder_upw_token_ok($j['access_token'] ?? null)) {
        return finder_upw_token_error($st, $j, $raw, $err);
    }
    $saved = finder_upw_locked(static fn() => finder_upw_token_save($j));
    return is_array($saved) ? true : 'Connected, but the sign-in couldn’t be saved (is the data folder writable?).';
}

/**
 * A valid access token, refreshed if it's about to expire, or if it is $stale (the token Upwork just refused).
 * Everything, waiting for the lock included, stays inside $deadline (microtime). Token array or an error.
 */
function finder_upw_access(float $deadline, ?string $stale = null): array|string
{
    $t = finder_upw_token_load();
    if ($t === null) {
        return 'Upwork isn’t connected. Connect it first.';
    }
    $fresh = static fn(array $t): bool => (int)$t['expires_at'] - time() > 300 && ($stale === null || !hash_equals($stale, (string)$t['access_token']));
    if ($fresh($t)) {
        return $t;
    }
    return finder_upw_locked(static function () use ($fresh, $deadline) {
        $t = finder_upw_token_load(); // read again inside the lock: another request may have refreshed it already
        if ($t === null) {
            return 'Upwork isn’t connected. Connect it first.';
        }
        if ($fresh($t)) {
            return $t;
        }
        if (($t['refresh_token'] ?? '') === '') {
            finder_upw_forget();
            return 'The Upwork sign-in has expired. Connect Upwork again.';
        }
        if (finder_left($deadline) < 3) {
            return 'Upwork didn’t answer in time. Try again in a few minutes.';
        }
        [$st, $j, $raw, $err] = finder_upw_token_post(['grant_type' => 'refresh_token', 'refresh_token' => $t['refresh_token']], finder_left($deadline));
        if ($st === 200 && is_array($j) && finder_upw_token_ok($j['access_token'] ?? null)) {
            return finder_upw_token_save($j, $t) ?? 'The new Upwork sign-in couldn’t be saved (is the data folder writable?).';
        }
        $msg = finder_upw_token_error($st, $j, $raw, $err);
        if (str_contains($msg, 'invalid_grant')) {
            finder_upw_forget();
        }
        return $msg;
    }, $deadline);
}

/**
 * One GraphQL call, finished by $deadline (microtime; each call 20 s at most). Returns data, or an error message.
 * A 401 refreshes the sign-in once and tries again, if there is time left.
 */
function finder_upw_graphql(string $query, array $vars, float $deadline, bool $retried = false): array|string
{
    $t = finder_upw_access($deadline);
    if (is_string($t)) {
        return $t;
    }
    if (finder_left($deadline) < 3) {
        return 'Upwork didn’t answer in time.';
    }
    if (!finder_usage_take('upwork')) {
        return 'Today’s Upwork allowance (' . FINDER_UPWORK_DAILY . ' calls) is used up. It resets at midnight UTC.';
    }
    $r = finder_http('POST', FINDER_UPWORK_GRAPHQL_URL, ['Authorization: Bearer ' . $t['access_token'], 'Content-Type: application/json', 'Accept: application/json'],
        json_encode(['query' => $query, 'variables' => (object)$vars], JSON_UNESCAPED_SLASHES), min(20, finder_left($deadline)), 4 * 1024 * 1024);
    $st = $r['status'];
    if ($st === 401 && !$retried && finder_left($deadline) >= 8) {
        $t = finder_upw_access($deadline, (string)$t['access_token']);
        return is_string($t) ? $t : finder_upw_graphql($query, $vars, $deadline, true);
    }
    if ($st === 0) {
        return $r['error'] === 'timeout' ? 'Upwork didn’t answer in time.' : 'Couldn’t reach Upwork.';
    }
    if ($st === 401 || $st === 403) {
        return 'Upwork refused the sign-in (HTTP ' . $st . '). Connect Upwork again.';
    }
    if ($st === 429) {
        return 'Upwork is limiting requests from this server (HTTP 429). Wait a few minutes, then try again.';
    }
    if ($st >= 500) {
        return 'Upwork had a server problem (HTTP ' . $st . '). Try again later.';
    }
    $j = json_decode($r['body'], true);
    if ($st !== 200 || !is_array($j)) {
        return 'Upwork answered with an error (HTTP ' . $st . ').';
    }
    if (!empty($j['errors']) && empty($j['data'])) {
        $m = (string)($j['errors'][0]['message'] ?? '');
        if (stripos($m, 'permissions/scopes') !== false || stripos($m, 'scope') !== false) {
            return 'The Upwork API key is missing a permission. In Upwork’s API Center the key needs “Common Entities - Read-Only Access” and “Read marketplace Job Postings”; after changing them, connect Upwork again.';
        }
        error_log('EvoSoft finder: Upwork GraphQL error: ' . substr($m, 0, 300));
        return 'Upwork couldn’t run the search: ' . finder_line($m, 160);
    }
    if (!empty($j['errors'])) {
        error_log('EvoSoft finder: Upwork GraphQL partial errors: ' . substr((string)json_encode($j['errors']), 0, 300));
    }
    return is_array($j['data'] ?? null) ? $j['data'] : 'Upwork sent an answer that couldn’t be read.';
}

/** Money {rawValue: "1.23"} → float, or null when missing or 0 ("0.0" means no budget). */
function finder_upw_money($m): ?float
{
    if (!is_array($m) || !is_numeric($m['rawValue'] ?? null)) {
        return null;
    }
    $v = (float)$m['rawValue'];
    return $v > 0 ? $v : null;
}

/** A job node as the page shows it, every field checked; null without an id or a valid ciphertext. */
function finder_upw_job(array $n, string $kw): ?array
{
    $cx = (string)($n['ciphertext'] ?? '');
    if ($cx !== '' && $cx[0] !== '~') {
        $cx = '~' . $cx;
    }
    if (!preg_match('/^~[0-9A-Za-z_]{5,40}$/', $cx) || !preg_match('/^\d{1,30}$/', (string)($n['id'] ?? ''))) {
        return null;
    }
    $ct = $n['job']['contractTerms']['contractType'] ?? null;
    if (!in_array($ct, ['HOURLY', 'FIXED'], true)) {
        $ct = (!empty($n['hourlyBudgetMin']) || !empty($n['hourlyBudgetMax'])) ? 'HOURLY' : 'FIXED';
    }
    $hourly = $ct === 'HOURLY';
    $min = $hourly ? finder_upw_money($n['hourlyBudgetMin'] ?? null) : finder_upw_money($n['amount'] ?? null);
    $max = $hourly ? finder_upw_money($n['hourlyBudgetMax'] ?? null) : $min;
    $cur = (string)(($hourly ? ($n['hourlyBudgetMin']['currency'] ?? null) : ($n['amount']['currency'] ?? null)) ?? 'USD');
    $pub = (string)($n['publishedDateTime'] ?? ($n['createdDateTime'] ?? ''));
    $ts = $pub !== '' ? strtotime($pub) : false;
    $c = is_array($n['client'] ?? null) ? $n['client'] : [];
    $skills = [];
    foreach (is_array($n['skills'] ?? null) ? array_slice($n['skills'], 0, 8) : [] as $s) {
        $x = finder_line(is_array($s) ? ($s['prettyName'] ?? ($s['name'] ?? '')) : '', 40);
        if ($x !== '') {
            $skills[] = $x;
        }
    }
    $desc = finder_line($n['description'] ?? '', 2000);
    return [
        'id' => (string)$n['id'],
        'job' => $cx,
        'url' => 'https://www.upwork.com/jobs/' . $cx,
        'title' => finder_line($n['title'] ?? '', 200) ?: 'Untitled job',
        'snippet' => mb_strlen($desc) > 280 ? mb_substr($desc, 0, 277) . '…' : $desc,
        'posted' => $ts !== false ? gmdate('Y-m-d H:i', $ts) . ' UTC' : '',
        'ts' => $ts !== false ? $ts : 0,
        'type' => $ct,
        'min' => $min,
        'max' => $max,
        'currency' => preg_match('/^[A-Z]{3}$/', $cur) ? $cur : 'USD',
        'level' => in_array($n['experienceLevel'] ?? '', ['ENTRY_LEVEL', 'INTERMEDIATE', 'EXPERT'], true) ? $n['experienceLevel'] : '',
        'skills' => $skills,
        'country' => finder_line($c['location']['country'] ?? '', 60),
        'spent' => finder_upw_money($c['totalSpent'] ?? null),
        'hires' => is_int($c['totalHires'] ?? null) ? $c['totalHires'] : null,
        'rating' => is_numeric($c['totalFeedback'] ?? null) && (float)$c['totalFeedback'] > 0 ? round((float)$c['totalFeedback'], 2) : null,
        'reviews' => is_int($c['totalReviews'] ?? null) ? $c['totalReviews'] : null,
        'verified' => ($c['verificationStatus'] ?? '') === 'VERIFIED',
        'keyword' => $kw,
    ];
}

/** POST finder.upwork_search: one call per keyword (at most 6), 45 seconds in all, newest first. */
function finder_action_upwork_search(array $post): never
{
    if (!finder_upw_configured()) {
        finder_fail('Upwork isn’t set up: see what’s needed on this tab.', 503);
    }
    $kws = finder_pick_list($post['kw'] ?? null, FINDER_UPWORK_KEYWORDS);
    $own = finder_line($post['own'] ?? '', 40);
    if ($own !== '') {
        if (!preg_match('/^[\p{L}\p{N} +#.\-]{2,40}$/u', $own)) {
            finder_fail('Use letters, numbers and spaces for your own keyword.', 422);
        }
        $kws[] = $own;
    }
    $kws = array_slice(array_values(array_unique($kws)), 0, 6);
    if (!$kws) {
        finder_fail('Choose at least one keyword.', 422);
    }
    $days = finder_int($post['days'] ?? 3, 3, 1, 30);
    $minBudget = finder_int($post['min'] ?? 0, 0, 0, 100000);
    $verified = ($post['verified'] ?? '') === '1';
    finder_long_request(60);
    $key = json_encode([$kws, $days, $verified]);
    $cached = finder_cache_get('upwork', $key);
    $fromCache = $cached !== null;
    if ($cached === null) {
        if (!evo_rate_ok('finder-upwork', 'owner', 10, 3600)) {
            finder_fail('That’s 10 Upwork searches this hour, the most this tool makes. Try again later.', 429);
        }
        $deadline = microtime(true) + 45;
        $jobs = [];
        $warn = [];
        foreach ($kws as $kw) {
            $left = finder_left($deadline);
            if ($left < 5) {
                $warn[] = 'The search stopped at the time limit, so some keywords weren’t searched.';
                break;
            }
            $filter = ['searchExpression_eq' => $kw, 'daysPosted_eq' => $days, 'pagination_eq' => ['after' => '0', 'first' => 20]];
            if ($verified) {
                $filter['verifiedPaymentOnly_eq'] = true;
            }
            // the deadline covers the whole search, renewing the sign-in included
            $d = finder_upw_graphql(FINDER_UPWORK_QUERY, ['filter' => $filter, 'searchType' => 'USER_JOBS_SEARCH', 'sort' => [['field' => 'RECENCY']]], $deadline);
            if (is_string($d)) {
                if (!$jobs) {
                    finder_fail($d, 502);
                }
                $warn[] = $d;
                break;
            }
            foreach (is_array($d['marketplaceJobPostingsSearch']['edges'] ?? null) ? $d['marketplaceJobPostingsSearch']['edges'] : [] as $e) {
                $job = is_array($e['node'] ?? null) ? finder_upw_job($e['node'], $kw) : null;
                if ($job !== null) {
                    $jobs[$job['id']] ??= $job;
                }
            }
        }
        $jobs = array_values($jobs);
        usort($jobs, static fn(array $a, array $b): int => $b['ts'] <=> $a['ts']);
        $data = ['rows' => $jobs, 'warnings' => $warn];
        $id = finder_cache_put('upwork', $key, $data);
        $cached = ['id' => $id, 'at' => time(), 'data' => $data];
    }
    $rows = array_values(array_filter($cached['data']['rows'] ?? [], static fn(array $j): bool => $minBudget <= 0 || $j['type'] === 'HOURLY' || $j['min'] === null || $j['min'] >= $minBudget));
    $hidden = count($cached['data']['rows'] ?? []) - count($rows);
    $note = (count($rows) === 1 ? '1 job' : count($rows) . ' jobs') . ', newest first' . ($hidden ? '; ' . $hidden . ' fixed-price jobs under $' . number_format($minBudget) . ' hidden' : '') . '.';
    foreach ($cached['data']['warnings'] ?? [] as $w) {
        $note .= ' ' . $w;
    }
    admin_json(['ok' => true, 'rows' => $rows, 'note' => $note, 'cached' => $fromCache, 'cachedAt' => gmdate('H:i', (int)$cached['at']) . ' UTC']);
}

/** POST finder.upwork_track {job: ciphertext, note}: keeps only the job's address, your note and the date. */
function finder_action_upwork_track(array $post): never
{
    $cx = is_string($post['job'] ?? null) ? $post['job'] : '';
    if (!preg_match('/^~[0-9A-Za-z_]{5,40}$/', $cx)) {
        finder_fail('That job link isn’t valid.', 422);
    }
    $note = finder_text($post['note'] ?? '', 1000);
    $row = ['source' => 'upwork-track', 'name' => 'Upwork job ' . $cx, 'evidence_url' => 'https://www.upwork.com/jobs/' . $cx, 'notes' => $note, 'website_status' => 'unknown'];
    $r = finder_leads_add(['u' => $row]);
    if (isset($r['saved']['u'])) {
        admin_json(['ok' => true, 'message' => 'Tracked. Find it under Leads.', 'id' => $r['saved']['u']]);
    }
    if (isset($r['duplicates']['u'])) {
        admin_json(['ok' => true, 'message' => 'You’re already tracking this job.', 'id' => $r['duplicates']['u']]);
    }
    if (!empty($r['suppressed'])) {
        finder_fail('This job is on your do-not-contact list, so it wasn’t tracked.', 409);
    }
    finder_fail('The job couldn’t be tracked.', 500);
}

/** POST finder.upwork_connect: a new state for this session, then off to Upwork. */
function finder_action_upwork_connect(): never
{
    if (!finder_upw_configured()) {
        finder_done(['view' => 'finder', 'tab' => 'upwork'], 'Upwork isn’t set up yet: see below.', false);
    }
    $state = bin2hex(random_bytes(24));
    $_SESSION['finder_upw_state'] = ['v' => $state, 'at' => time()];
    $c = finder_cfg();
    $url = FINDER_UPWORK_AUTHORIZE_URL . '?' . http_build_query(['response_type' => 'code', 'client_id' => $c['upwork_client_id'],
        'redirect_uri' => $c['upwork_redirect_uri'], 'state' => $state], '', '&', PHP_QUERY_RFC3986);
    if (admin_wants_json()) {
        admin_json(['ok' => true, 'url' => $url]);
    }
    // a page with a link: the panel's Content-Security-Policy (form-action 'self') would block a redirect away from a form
    admin_layout('Client finder', finder_header('upwork') . '<section class="card" aria-labelledby="h-go"><h2 id="h-go">Connect Upwork</h2>'
        . '<p>Upwork will ask you to sign in and allow EvoSoft’s app to read job postings. Then it sends you back here.</p>'
        . '<p><a class="btn primary" href="' . admin_h($url) . '">Continue to Upwork</a></p></section>', 'finder');
    exit;
}

/** POST finder.upwork_finish {code, state}: checks the state against this session, then gets the tokens. */
function finder_action_upwork_finish(array $post): never
{
    $code = is_string($post['code'] ?? null) && preg_match('/^[A-Za-z0-9._~\-]{4,512}$/', $post['code']) ? $post['code'] : '';
    $state = is_string($post['state'] ?? null) ? $post['state'] : '';
    $saved = $_SESSION['finder_upw_state'] ?? null;
    unset($_SESSION['finder_upw_state']);
    if (!is_array($saved) || !is_string($saved['v'] ?? null) || $state === '' || !hash_equals($saved['v'], $state) || (int)($saved['at'] ?? 0) < time() - 900) {
        finder_done(['view' => 'finder', 'tab' => 'upwork'], 'That Upwork sign-in wasn’t started from this browser, or took longer than 15 minutes. Nothing was saved: press “Connect Upwork” again.', false);
    }
    if ($code === '') {
        finder_done(['view' => 'finder', 'tab' => 'upwork'], 'Upwork didn’t send a sign-in code. Press “Connect Upwork” again.', false);
    }
    $r = finder_upw_exchange($code);
    if ($r !== true) {
        finder_done(['view' => 'finder', 'tab' => 'upwork'], $r, false);
    }
    finder_done(['view' => 'finder', 'tab' => 'upwork'], 'Upwork is connected.');
}

function finder_action_upwork_disconnect(): never
{
    // under the token lock, so a refresh running at this moment can't write the sign-in back afterwards
    $r = finder_upw_locked(static function (): bool {
        finder_upw_forget();
        return true;
    });
    if ($r !== true) {
        finder_upw_forget(); // couldn't lock: delete anyway (a refresh finishing now could re-create it; disconnect again then)
    }
    finder_done(['view' => 'finder', 'tab' => 'upwork'], 'Upwork is disconnected here and its cached results are deleted. To withdraw the app’s access completely, remove it in your Upwork settings too.');
}

/** The Upwork tab. */
function finder_upwork_view(array $get): string
{
    $c = finder_cfg();
    $html = '';
    $terms = '<p class="note small"><strong>Reply to these clients on Upwork.</strong> Moving them off Upwork (email, phone, other sites) before a contract starts is against Upwork’s terms. '
        . 'Searches run only when you press the button, for EvoSoft’s own use; results are listed newest first as Upwork returns them, reused for an hour at most, and deleted within 24 hours.</p>';
    if (!finder_upw_configured()) {
        return $html . '<section class="card" aria-labelledby="h-upw-setup"><h2 id="h-upw-setup">Set up Upwork job search</h2>'
            . '<p>This tab searches Upwork’s job postings through Upwork’s official API. Upwork must first give EvoSoft an API key:</p><ol class="steps">'
            . '<li>Apply at <a href="https://www.upwork.com/developer/keys/apply" target="_blank" rel="noopener noreferrer">upwork.com/developer/keys/apply<span class="sr-only"> (opens in a new tab)</span></a>, with your agency organisation selected at the top right (a key can’t be moved to another organisation later).</li>'
            . '<li>Upwork’s account requirements: a real name, address and profile picture; an active, verified payment method; completed identity verification; <strong>at least $25,000 in lifetime earnings, spend or both</strong>; a <strong>Job Success Score of at least 90%</strong>; and an account in good standing.</li>'
            . '<li>Key type: <strong>OAuth 2.0</strong>. Permissions (scopes): <strong>“Common Entities - Read-Only Access”</strong> and <strong>“Read marketplace Job Postings”</strong>.</li>'
            . '<li>Callback URL (copy it exactly): <code id="upw-callback">' . admin_h($c['upwork_redirect_uri']) . '</code> <button type="button" class="btn small" data-copy="upw-callback" hidden>Copy</button></li>'
            . '<li>In the application, describe it as an internal tool for EvoSoft only, and confirm you’ll stay under 40,000 requests a day and won’t use Upwork’s name, logo or colours. Upwork reviews each request (about a week).</li>'
            . '<li>Then add <code>upwork_client_id</code> and <code>upwork_client_secret</code> to the settings file (and <code>upwork_redirect_uri</code> if the panel’s address isn’t the one above).</li>'
            . '</ol><p class="muted small">If the account doesn’t meet the bar, keep using Upwork’s own job search in the browser.</p>' . $terms . '</section>';
    }
    // back from Upwork: ?code=…&state=… (or ?error=…)
    if (isset($get['error']) || isset($get['code'])) {
        $err = is_string($get['error'] ?? null) ? finder_line($get['error'], 40) : '';
        $state = is_string($get['state'] ?? null) ? $get['state'] : '';
        $code = is_string($get['code'] ?? null) && preg_match('/^[A-Za-z0-9._~\-]{4,512}$/', $get['code']) ? $get['code'] : '';
        $saved = $_SESSION['finder_upw_state'] ?? null;
        $stateOk = is_array($saved) && is_string($saved['v'] ?? null) && $state !== '' && hash_equals($saved['v'], $state) && (int)($saved['at'] ?? 0) >= time() - 900;
        if ($err !== '') {
            $html .= '<div class="flash flash-error" role="alert">Upwork didn’t connect' . ($err === 'access_denied' ? ': access was declined.' : ' (' . admin_h($err) . ').') . ' You can try again below.</div>';
        } elseif (!$stateOk || $code === '') {
            $html .= '<div class="flash flash-error" role="alert">That Upwork sign-in wasn’t started from this browser, or took longer than 15 minutes, so it was ignored. Press “Connect Upwork” to start again.</div>';
        } else {
            return $html . '<section class="card" aria-labelledby="h-upw-finish"><h2 id="h-upw-finish">Finish connecting Upwork</h2>'
                . '<p>Upwork sent you back with a sign-in code. Save it to finish.</p>'
                . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.upwork_finish'])) . '">' . admin_csrf_field()
                . '<input type="hidden" name="code" value="' . admin_h($code) . '"><input type="hidden" name="state" value="' . admin_h($state) . '">'
                . '<button class="btn primary" type="submit">Finish connecting</button></form></section>';
        }
    }
    $t = finder_upw_token_load();
    if ($t === null) {
        $html .= '<section class="card" aria-labelledby="h-upw-connect"><h2 id="h-upw-connect">Connect Upwork</h2>'
            . (finder_upw_token_unreadable() ? '<p class="flash flash-error">The saved Upwork sign-in can’t be read any more (the client secret in the settings changed). Connect again.</p>' : '')
            . '<p>Sign in to Upwork once to let this panel search job postings for you. The sign-in is stored encrypted in the data folder; you can disconnect at any time.</p>'
            . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.upwork_connect'])) . '" id="upw-connect">' . admin_csrf_field()
            . '<button class="btn primary" type="submit">Connect Upwork</button></form>'
            . '<p class="muted small">Callback URL registered with the key: <code>' . admin_h($c['upwork_redirect_uri']) . '</code></p>' . $terms . '</section>';
        return $html;
    }
    $kw = '';
    foreach (FINDER_UPWORK_KEYWORDS as $i => $k) {
        $kw .= '<div class="check"><input type="checkbox" id="uk-' . $i . '" name="kw[]" value="' . admin_h($k) . '"' . ($i < 3 ? ' checked' : '') . '><label for="uk-' . $i . '">' . admin_h($k) . '</label></div>';
    }
    $html .= '<section class="card" aria-labelledby="h-upw"><h2 id="h-upw">Search Upwork jobs</h2>' . $terms
        . '<form id="upwork-form" class="finder-form" method="post" action="' . admin_h(admin_url(['action' => 'finder.upwork_search'])) . '" novalidate>' . admin_csrf_field()
        . '<fieldset class="checks cols"><legend>Keywords <span class="muted">(one search each, 6 at most)</span></legend>' . $kw . '</fieldset>'
        . '<div class="form-grid">'
        . '<div class="field"><label for="u-own">Your own keyword <span class="muted">(optional)</span></label><input id="u-own" name="own" type="text" maxlength="40"></div>'
        . '<div class="field"><label for="u-days">Posted in the last</label><select id="u-days" name="days"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="7">7 days</option><option value="14">14 days</option><option value="30">30 days</option></select></div>'
        . '<div class="field"><label for="u-min">Smallest fixed-price budget (USD)</label><input id="u-min" name="min" type="number" min="0" max="100000" step="50" value="0" inputmode="numeric" aria-describedby="u-min-hint"><p class="hint" id="u-min-hint">Hourly jobs and jobs without a budget are always shown.</p></div>'
        . '<div class="check align-end"><input type="checkbox" id="u-verified" name="verified" value="1" checked><label for="u-verified">Clients with a verified payment method only</label></div>'
        . '</div><p class="field-error" id="u-form-error" hidden></p>'
        . '<div class="row-actions"><button class="btn primary" type="submit" hidden>Search Upwork</button></div>'
        . '<noscript><p class="flash flash-error">The search needs JavaScript, which is off in this browser.</p></noscript></form></section>'
        . '<section class="card results" id="upwork-results" aria-labelledby="h-upw-results" hidden><h2 id="h-upw-results" tabindex="-1">Upwork jobs</h2>'
        . '<ul class="progress" id="upwork-progress"></ul><ol class="jobs" id="upwork-rows"></ol><p class="muted small">Source: Upwork.</p></section>'
        . '<section class="card" aria-labelledby="h-upw-acct"><h2 id="h-upw-acct">Upwork connection</h2><p>Connected ' . admin_h(gmdate('Y-m-d', (int)($t['connected_at'] ?? time()))) . '. The sign-in renews itself while you use it; after about two weeks without a search you’ll need to connect again.</p>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.upwork_disconnect'])) . '">' . admin_csrf_field() . '<button class="btn" type="submit">Disconnect Upwork</button></form></section>';
    return $html;
}
