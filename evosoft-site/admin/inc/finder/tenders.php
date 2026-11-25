<?php
/*
 * EvoSoft admin panel, client finder: the Tenders tab. EU public tenders from the TED Search API v3 (anonymous POST,
 * no key; https://api.ted.europa.eu/v3/notices/search), on demand only, from the server (the API's CORS header only
 * allows ted.europa.eu). Notices are reusable, commercially too; TED is credited in text, never with its logo.
 * The Georgian portal has no API or terms that allow automation, so it gets a plain link.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

if (!defined('FINDER_TED_URL')) {
    define('FINDER_TED_URL', 'https://api.ted.europa.eu/v3/notices/search');
}

/** CPV codes offered (labels from the eForms CPV code list). Matching is hierarchical: 72000000 covers all 72… codes. */
const FINDER_CPV = [
    '72413000' => ['Website design', true],
    '72420000' => ['Internet development', true],
    '72212000' => ['Application software programming', true],
    '72262000' => ['Software development', true],
    '72230000' => ['Custom software development', true],
    '72200000' => ['Software programming and consultancy', false],
    '72400000' => ['Internet services', false],
    '72000000' => ['All IT services (very broad)', false],
];
/** Calls for competition (eForms notice-type_competition): the notices you can still bid on. */
const FINDER_TED_NOTICE_TYPES = ['cn-standard', 'cn-social', 'pin-cfc-standard', 'pin-cfc-social', 'cn-desg'];
const FINDER_TED_FIELDS = ['publication-number', 'publication-date', 'notice-type', 'form-type', 'notice-title', 'title-proc', 'buyer-name',
    'buyer-country', 'buyer-city', 'classification-cpv', 'deadline-receipt-tender-date-lot', 'deadline-receipt-request', 'estimated-value-proc',
    'estimated-value-cur-proc', 'estimated-value-lot', 'estimated-value-cur-lot', 'links']; // 17 fields x 100 notices, far under 10,000 per page
/** Buyer countries (ISO 3166-1 alpha-3, as TED expects). */
const FINDER_TED_COUNTRIES = [
    'AUT' => 'Austria', 'BEL' => 'Belgium', 'BGR' => 'Bulgaria', 'HRV' => 'Croatia', 'CYP' => 'Cyprus', 'CZE' => 'Czechia', 'DNK' => 'Denmark',
    'EST' => 'Estonia', 'FIN' => 'Finland', 'FRA' => 'France', 'DEU' => 'Germany', 'GRC' => 'Greece', 'HUN' => 'Hungary', 'IRL' => 'Ireland',
    'ITA' => 'Italy', 'LVA' => 'Latvia', 'LTU' => 'Lithuania', 'LUX' => 'Luxembourg', 'MLT' => 'Malta', 'NLD' => 'Netherlands', 'POL' => 'Poland',
    'PRT' => 'Portugal', 'ROU' => 'Romania', 'SVK' => 'Slovakia', 'SVN' => 'Slovenia', 'ESP' => 'Spain', 'SWE' => 'Sweden',
    'ISL' => 'Iceland', 'LIE' => 'Liechtenstein', 'NOR' => 'Norway', 'CHE' => 'Switzerland', 'ALB' => 'Albania', 'MNE' => 'Montenegro',
    'MKD' => 'North Macedonia', 'SRB' => 'Serbia', 'MDA' => 'Moldova', 'UKR' => 'Ukraine', 'GEO' => 'Georgia',
];

/** The expert query: CPV codes, published since, calls for competition, buyer countries; newest first. */
function finder_ted_query(array $cpv, int $days, array $countries, bool $active, bool $typeClause): string
{
    $since = (new DateTimeImmutable('-' . $days . ' days', new DateTimeZone('Europe/Luxembourg')))->format('Ymd'); // literal YYYYMMDD
    $q = 'classification-cpv IN (' . implode(' ', $cpv) . ') AND publication-date>=' . $since;
    if ($active && $typeClause) {
        $q .= ' AND notice-type IN (' . implode(' ', FINDER_TED_NOTICE_TYPES) . ')';
    }
    if ($countries) {
        $q .= ' AND buyer-country IN (' . implode(' ', $countries) . ')';
    }
    return $q . ' SORT BY publication-number DESC'; // DESC or nothing: ASC is a syntax error
}

/** The type of a TED error body: {"error":{"type":...}}, {"error":[{"type":...}]} or {"type":...}. */
function finder_ted_error_type(?array $body): string
{
    $e = $body['error'] ?? null;
    if (is_array($e) && array_is_list($e)) {
        $e = $e[0] ?? null;
    }
    return (string)(is_array($e) ? ($e['type'] ?? '') : ($body['type'] ?? ''));
}

/** One POST, retried once after 2 s on 429, 5xx or a network error (never on 400). Returns the JSON or an error. */
function finder_ted_post(array $body, float $deadline): array|string
{
    for ($attempt = 0; ; $attempt++) {
        if (!finder_usage_take('ted')) {
            return 'Today’s TED allowance (' . FINDER_TED_DAILY . ' calls) is used up. It resets at midnight UTC.';
        }
        $r = finder_http('POST', FINDER_TED_URL, ['Content-Type: application/json', 'Accept: application/json'],
            json_encode($body, JSON_UNESCAPED_SLASHES), max(5, min(25, finder_left($deadline))), 4 * 1024 * 1024);
        $retry = $r['status'] === 0 || $r['status'] === 429 || $r['status'] >= 500;
        if ($retry && $attempt === 0 && finder_left($deadline) > 8) {
            sleep(2);
            continue;
        }
        if ($r['status'] === 0) {
            return $r['error'] === 'timeout' ? 'TED didn’t answer in time. Try again in a few minutes.' : 'Couldn’t reach TED. Try again later.';
        }
        $j = json_decode($r['body'], true);
        if ($r['status'] !== 200 || !is_array($j)) {
            return ['status' => $r['status'], 'type' => finder_ted_error_type(is_array($j) ? $j : null), 'message' => is_array($j) ? finder_line($j['message'] ?? '', 200) : ''];
        }
        return ['ok' => $j];
    }
}

/** {lang3: text} or {lang3: [text]} or [text] or text → one text, English first, then multilingual, then any. */
function finder_ted_text($v): string
{
    if ($v === null || $v === '' || $v === []) {
        return '';
    }
    if (!is_array($v)) {
        return finder_line($v, 400);
    }
    if (array_is_list($v)) {
        return finder_line($v[0] ?? '', 400);
    }
    foreach (array_unique(array_merge(['eng', 'mul'], array_keys($v))) as $lang) {
        $x = $v[$lang] ?? null;
        if (is_array($x)) {
            $x = $x[0] ?? null;
        }
        if (is_string($x) && trim($x) !== '') {
            return finder_line($x, 400);
        }
    }
    return '';
}

/** Dates (Y-m-d) in a TED value: "2026-12-15+01:00", "2026-12-11T12:00:00+01:00", or a list of those. Sorted, unique. */
function finder_ted_dates($v): array
{
    $d = [];
    foreach (is_array($v) ? $v : [$v] as $x) {
        if (is_string($x) && preg_match('/^\d{4}-\d{2}-\d{2}/', $x, $m)) {
            $d[] = $m[0];
        }
    }
    $d = array_values(array_unique($d));
    sort($d);
    return $d;
}

/** One notice as a result row, or null (no number, or every deadline has passed when $active). */
function finder_ted_row(array $n, string $today, bool $active): ?array
{
    $pub = (string)($n['publication-number'] ?? '');
    if (!preg_match('/^\d{1,9}-\d{4}$/', $pub)) {
        return null;
    }
    $dl = finder_ted_dates($n['deadline-receipt-request'] ?? null) ?: finder_ted_dates($n['deadline-receipt-tender-date-lot'] ?? null);
    $upcoming = array_values(array_filter($dl, static fn(string $x): bool => $x >= $today));
    if ($active && $dl && !$upcoming) {
        return null; // every lot is closed (scope ACTIVE doesn't filter this)
    }
    if ($active && !in_array((string)($n['notice-type'] ?? ''), FINDER_TED_NOTICE_TYPES, true)) {
        return null;
    }
    $value = is_numeric($n['estimated-value-proc'] ?? null) ? (float)$n['estimated-value-proc'] : null;
    $cur = $n['estimated-value-cur-proc'] ?? null;
    if ($value === null && is_array($n['estimated-value-lot'] ?? null) && $n['estimated-value-lot']) {
        $curs = array_values(array_unique(array_filter((array)($n['estimated-value-cur-lot'] ?? []), 'is_string')));
        if (count($curs) === 1) {
            $value = (float)array_sum(array_filter($n['estimated-value-lot'], 'is_numeric'));
            $cur = $curs[0];
        }
    }
    $cur = is_array($cur) ? ($cur[0] ?? '') : (string)$cur;
    $country = (string)(((array)($n['buyer-country'] ?? []))[0] ?? '');
    $title = finder_ted_text($n['notice-title'] ?? null) ?: finder_ted_text($n['title-proc'] ?? null);
    $buyer = finder_ted_text($n['buyer-name'] ?? null);
    $url = finder_url($n['links']['html']['ENG'] ?? '');
    if (!str_starts_with($url, 'https://ted.europa.eu/')) {
        $url = 'https://ted.europa.eu/en/notice/-/detail/' . $pub;
    }
    $deadline = $upcoming[0] ?? ($dl ? end($dl) : '');
    return [
        'key' => 'ted:' . $pub,
        'source' => 'ted',
        'name' => $buyer !== '' ? $buyer : 'Buyer not named',
        'category' => 'Tender',
        'city' => finder_ted_text($n['buyer-city'] ?? null),
        'country' => preg_match('/^[A-Z]{3}$/', $country) ? $country : '',
        'evidence_url' => $url,
        'link' => $url,
        'website_status' => 'unknown',
        'tender' => ['pub' => $pub, 'title' => $title !== '' ? $title : 'Notice ' . $pub, 'deadline' => $deadline,
            'value' => $value !== null && $value > 0 ? round($value, 2) : null, 'currency' => preg_match('/^[A-Z]{3}$/', $cur) ? $cur : ''],
        'published' => finder_ted_dates($n['publication-date'] ?? null)[0] ?? '',
        'cpv' => array_slice(array_values(array_unique(array_filter((array)($n['classification-cpv'] ?? []), 'is_string'))), 0, 6),
    ];
}

/** POST finder.ted_search */
function finder_action_ted_search(array $post): never
{
    $cpv = finder_pick_list($post['cpv'] ?? null, array_keys(FINDER_CPV));
    $countries = finder_pick_list($post['countries'] ?? null, array_keys(FINDER_TED_COUNTRIES));
    $days = finder_int($post['days'] ?? 14, 14, 1, 90);
    $active = ($post['active'] ?? '') === '1';
    if (!$cpv) {
        finder_fail('Choose at least one kind of work (CPV code).', 422);
    }
    finder_long_request(60);
    $key = json_encode([$cpv, $countries, $days, $active, gmdate('Y-m-d')]);
    $cached = finder_cache_get('ted', $key);
    $fromCache = $cached !== null;
    $warn = [];
    if ($cached === null) {
        $deadline = microtime(true) + 40;
        $today = (new DateTimeImmutable('now', new DateTimeZone('Europe/Luxembourg')))->format('Y-m-d');
        $typeClause = true;
        $rows = [];
        $total = 0;
        $complete = false;
        for ($page = 1; $page <= 2; $page++) {
            if (finder_left($deadline) < 6) {
                $warn[] = 'The search stopped at the time limit, so there may be more.';
                break;
            }
            $body = ['query' => finder_ted_query($cpv, $days, $countries, $active, $typeClause), 'fields' => FINDER_TED_FIELDS, 'page' => $page,
                'limit' => 100, 'scope' => $active ? 'ACTIVE' : 'ALL', 'paginationMode' => 'PAGE_NUMBER', 'onlyLatestVersions' => true];
            $res = finder_ted_post($body, $deadline);
            if (is_string($res)) {
                if ($rows) {
                    $warn[] = $res;
                    break;
                }
                finder_fail($res, 502, ['usage' => finder_usage_public()]);
            }
            if (!isset($res['ok'])) {
                // the notice-type clause has no official documentation: if TED rejects it, drop it once and filter here
                if ($typeClause && $res['status'] === 400 && str_starts_with($res['type'], 'QUERY_')) {
                    $typeClause = false;
                    $page--;
                    continue;
                }
                error_log('EvoSoft finder: TED ' . $res['status'] . ' ' . $res['type'] . ' ' . $res['message']);
                if ($rows) {
                    $warn[] = 'TED stopped answering part way, so there may be more.';
                    break;
                }
                finder_fail('TED didn’t accept the search (HTTP ' . $res['status'] . ($res['type'] !== '' ? ', ' . $res['type'] : '') . '). Try fewer codes or countries.', 502);
            }
            $j = $res['ok'];
            if (!empty($j['timedOut'])) {
                $warn[] = 'TED cut the search short, so there may be more.';
            }
            foreach (is_array($j['notices'] ?? null) ? $j['notices'] : [] as $n) {
                if (is_array($n) && ($row = finder_ted_row($n, $today, $active)) !== null) {
                    $rows[$row['key']] = $row;
                }
            }
            $total = (int)($j['totalNoticeCount'] ?? 0);
            if (empty($j['notices']) || $page * 100 >= $total) {
                $complete = empty($j['timedOut']);
                break;
            }
            usleep(500000);
        }
        if (!$complete && $total > 200) {
            $warn[] = 'Only the newest 200 notices were read: narrow the search for the rest.';
        }
        $data = ['rows' => array_values($rows), 'total' => $total, 'warnings' => array_values(array_unique($warn))];
        $id = finder_cache_put('ted', $key, $data);
        $cached = ['id' => $id, 'at' => time(), 'data' => $data];
    }
    [$rows, $hidden] = finder_rows_for_page($cached['data']['rows'] ?? []);
    $n = count($rows);
    $note = ($n === 1 ? '1 notice' : $n . ' notices') . ($active ? ' still open for bids' : '') . ($hidden ? '; ' . $hidden . ' on your do-not-contact list hidden' : '') . '.';
    foreach ($cached['data']['warnings'] ?? [] as $w) {
        $note .= ' ' . $w;
    }
    admin_json(['ok' => true, 'source' => 'ted', 'search' => $cached['id'], 'rows' => $rows, 'note' => $note, 'cached' => $fromCache,
        'cachedAt' => gmdate('H:i', (int)$cached['at']) . ' UTC', 'usage' => finder_usage_public()]);
}

/** The Tenders tab. */
function finder_tenders_view(): string
{
    $cpv = '';
    foreach (FINDER_CPV as $code => [$label, $on]) {
        $cpv .= '<div class="check"><input type="checkbox" id="cpv-' . $code . '" name="cpv[]" value="' . $code . '"' . ($on ? ' checked' : '') . '>'
            . '<label for="cpv-' . $code . '">' . admin_h($label) . ' <span class="muted">' . $code . '</span></label></div>';
    }
    $countries = '';
    foreach (FINDER_TED_COUNTRIES as $code => $name) {
        $countries .= '<div class="check"><input type="checkbox" id="tc-' . $code . '" name="countries[]" value="' . $code . '"><label for="tc-' . $code . '">' . admin_h($name) . '</label></div>';
    }
    return '<section class="card" aria-labelledby="h-ted"><h2 id="h-ted">EU public tenders (TED)</h2>'
        . '<p class="muted">Calls for tenders for web and software work, published on TED, the EU’s public procurement journal. Searched only when you press the button.</p>'
        . '<form id="ted-form" class="finder-form" method="post" action="' . admin_h(admin_url(['action' => 'finder.ted_search'])) . '" novalidate>' . admin_csrf_field()
        . '<fieldset class="checks cols"><legend>Kind of work (CPV codes)</legend>' . $cpv . '</fieldset>'
        . '<details class="countries"><summary>Buyer countries: <span id="tc-summary">all</span></summary><fieldset class="checks cols"><legend class="sr-only">Buyer countries</legend>' . $countries . '</fieldset></details>'
        . '<div class="form-grid">'
        . '<div class="field"><label for="t-days">Published in the last</label><select id="t-days" name="days"><option value="3">3 days</option><option value="7">7 days</option><option value="14" selected>14 days</option><option value="30">30 days</option><option value="60">60 days</option><option value="90">90 days</option></select></div>'
        . '<div class="check align-end"><input type="checkbox" id="t-active" name="active" value="1" checked><label for="t-active">Still open for bids only</label></div>'
        . '</div><p class="field-error" id="t-form-error" hidden></p>'
        . '<div class="row-actions"><button class="btn primary" type="submit" hidden>Search tenders</button></div>'
        . '<noscript><p class="flash flash-error">The search needs JavaScript, which is off in this browser.</p></noscript>'
        . '</form>'
        . '<p class="muted small">Source: TED (ted.europa.eu). Notices may be reused, commercially too. Bid through the procedure in each notice, and check its eligibility rules: access for Georgian companies to EU services tenders depends on each tender.</p></section>'
        . finder_results_shell('ted', 'Tenders found', false)
        . '<section class="card" aria-labelledby="h-geo"><h2 id="h-geo">Georgian public tenders</h2>'
        . '<p>Search Georgia’s e-procurement portal yourself, for example for CPV 72000000 (IT services) and 72413000 (website design).</p>'
        . '<p><a class="btn" href="https://tenders.procurement.gov.ge/public/?lang=en" target="_blank" rel="noopener noreferrer">Search Georgian e-procurement<span class="sr-only"> (opens in a new tab)</span></a></p>'
        . '<p class="muted small">Not automated on purpose: the portal offers no API and no terms that allow automated searching, and its open-data feed stopped being updated in 2019. Registering as a supplier there may give you its own notifications.</p></section>'
        . finder_usage_html();
}
