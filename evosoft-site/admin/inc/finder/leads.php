<?php
/*
 * EvoSoft admin panel, client finder: saved leads (leads.json), the "do not contact" list (leads-suppressed.json,
 * hashes only), the Leads tab, one lead, and CSV export.
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

const FINDER_LEADS_PER_PAGE = 25;
/** Hosts many businesses share (social sites, maps, listings): a page there says nothing about which business it is. */
const FINDER_SHARED_HOSTS = ['facebook.com', 'fb.com', 'fb.me', 'instagram.com', 'tiktok.com', 'linkedin.com', 'twitter.com', 'x.com',
    'youtube.com', 'youtu.be', 'google.com', 'goo.gl', 'g.page', 'tripadvisor.com', 'yelp.com', 'booking.com', 'airbnb.com', 'wolt.com',
    'glovoapp.com', '2gis.ge', '2gis.com', 'yandex.com', 'yandex.ru', 't.me', 'wa.me', 'whatsapp.com', 'linktr.ee', 'openstreetmap.org',
    'osm.org', 'ted.europa.eu', 'upwork.com', 'pinterest.com', 'vk.com', 'ok.ru', 'foursquare.com', 'my.ge', 'ss.ge', 'myhome.ge'];

// ---- the store ----

function finder_iso_now(): string
{
    return gmdate('Y-m-d\TH:i:s\Z');
}

function finder_new_id(): string
{
    return bin2hex(random_bytes(6));
}

function finder_clean_id($v): string
{
    return is_string($v) && preg_match('/^[0-9a-f]{12}$/', $v) ? $v : '';
}

/** Stored AI research with every field of the right type (as finder_ai_research() writes it), or null. */
function finder_research_shape($r): ?array
{
    if (!is_array($r)) {
        return null;
    }
    $w = is_array($r['website'] ?? null) ? $r['website'] : [];
    $c = is_array($r['contacts'] ?? null) ? $r['contacts'] : [];
    $bool = static fn($v): ?bool => is_bool($v) ? $v : null;
    $urls = static fn($v, int $n): array => is_array($v) ? array_values(array_filter(array_map('finder_url', array_slice($v, 0, $n)))) : [];
    $sources = [];
    foreach (is_array($r['sources'] ?? null) ? array_slice($r['sources'], 0, 8) : [] as $s) {
        $u = is_array($s) ? finder_url($s['url'] ?? '') : '';
        if ($u !== '') {
            $sources[] = ['url' => $u, 'seen' => ($s['seen'] ?? false) === true];
        }
    }
    return [
        'website' => [
            'url' => finder_url($w['url'] ?? ''),
            'status' => is_string($w['status'] ?? null) && isset(FINDER_WEB_STATUSES[$w['status']]) ? $w['status'] : 'unknown',
            'https' => $bool($w['https'] ?? null), 'mobile' => $bool($w['mobile'] ?? null),
            'speed' => in_array($w['speed'] ?? '', ['fast', 'average', 'slow'], true) ? $w['speed'] : 'unknown',
            'outdated' => $bool($w['outdated'] ?? null), 'notes' => finder_line($w['notes'] ?? '', 400),
        ],
        'contacts' => ['phone' => finder_phone($c['phone'] ?? ''), 'email' => finder_email($c['email'] ?? ''), 'address' => finder_line($c['address'] ?? '', 200),
            'social' => $urls($c['social'] ?? null, 6)],
        'score' => is_numeric($r['score'] ?? null) ? max(0, min(100, (int)$r['score'])) : 0,
        'reasons' => is_array($r['reasons'] ?? null) ? array_values(array_filter(array_map(static fn($x) => finder_line($x, 240), array_slice($r['reasons'], 0, 6)), 'strlen')) : [],
        'pitch' => finder_text($r['pitch'] ?? '', 700),
        'sources' => $sources,
        'partial' => ($r['partial'] ?? false) === true,
        'at' => preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', (string)(is_string($r['at'] ?? null) ? $r['at'] : '')) ? $r['at'] : '',
    ];
}

/** A lead with every field present and of the right type (the file may have been edited by hand). */
function finder_lead_shape(array $l): array
{
    $list = static fn($v, int $n, int $len): array => is_array($v) ? array_values(array_filter(array_map(static fn($x) => finder_line($x, $len), array_slice($v, 0, $n)), 'strlen')) : [];
    $status = is_string($l['status'] ?? null) && isset(FINDER_STATUSES[$l['status']]) ? $l['status'] : 'new';
    $source = is_string($l['source'] ?? null) && isset(FINDER_SOURCES[$l['source']]) ? $l['source'] : 'manual';
    $ws = is_string($l['website_status'] ?? null) && isset(FINDER_WEB_STATUSES[$l['website_status']]) ? $l['website_status'] : 'unknown';
    $osm = null;
    if (is_array($l['osm'] ?? null) && in_array($l['osm']['type'] ?? '', ['node', 'way', 'relation'], true) && ctype_digit((string)($l['osm']['id'] ?? ''))) {
        $osm = ['type' => $l['osm']['type'], 'id' => (string)$l['osm']['id']];
    }
    $tender = null;
    if (is_array($l['tender'] ?? null) && preg_match('/^\d{1,9}-\d{4}$/', (string)($l['tender']['pub'] ?? ''))) {
        $t = $l['tender'];
        $tender = ['pub' => (string)$t['pub'], 'title' => finder_line($t['title'] ?? '', 300), 'deadline' => finder_line($t['deadline'] ?? '', 10),
            'value' => is_numeric($t['value'] ?? null) ? (float)$t['value'] : null, 'currency' => finder_line($t['currency'] ?? '', 3)];
    }
    $score = is_numeric($l['score'] ?? null) ? max(0, min(100, (int)$l['score'])) : null;
    return [
        'id' => finder_clean_id($l['id'] ?? '') ?: finder_new_id(),
        'source' => $source,
        'name' => finder_line($l['name'] ?? '', 120),
        'category' => finder_line($l['category'] ?? '', 80),
        'city' => finder_line($l['city'] ?? '', 60),
        'country' => finder_line($l['country'] ?? '', 3),
        'address' => finder_line($l['address'] ?? '', 200),
        'phone' => finder_phone($l['phone'] ?? ''),
        'email' => finder_email($l['email'] ?? ''),
        'website' => finder_url($l['website'] ?? ''),
        'website_status' => $ws,
        'evidence_url' => finder_url($l['evidence_url'] ?? ''),
        'social' => array_values(array_filter(array_map('finder_url', is_array($l['social'] ?? null) ? array_slice($l['social'], 0, 4) : []))),
        'osm' => $osm,
        'tender' => $tender,
        'score' => $score,
        'reasons' => $list($l['reasons'] ?? null, 8, 240),
        'research' => finder_research_shape($l['research'] ?? null),
        'draft' => is_array($l['draft'] ?? null) ? ['subject' => finder_line($l['draft']['subject'] ?? '', 160), 'body' => finder_text($l['draft']['body'] ?? '', 5000),
            'lang' => finder_line($l['draft']['lang'] ?? 'en', 2), 'at' => finder_line($l['draft']['at'] ?? '', 20)] : null,
        'status' => $status,
        'notes' => finder_text($l['notes'] ?? '', 5000),
        'found_at' => preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', (string)($l['found_at'] ?? '')) ? $l['found_at'] : finder_iso_now(),
        'updated_at' => preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', (string)($l['updated_at'] ?? '')) ? $l['updated_at'] : '',
    ];
}

/** Every saved lead, newest first: [id => lead]. */
function finder_leads_all(): array
{
    $data = finder_json_read(finder_data_file('leads.json'));
    $out = [];
    foreach (is_array($data['leads'] ?? null) ? $data['leads'] : [] as $l) {
        if (is_array($l) && finder_clean_id($l['id'] ?? '') !== '') {
            $l = finder_lead_shape($l);
            $out[$l['id']] = $l;
        }
    }
    uasort($out, static fn(array $a, array $b): int => strcmp($b['found_at'], $a['found_at']));
    return $out;
}

function finder_lead_find(string $id): ?array
{
    return $id !== '' ? (finder_leads_all()[$id] ?? null) : null;
}

/** Changes leads.json under its lock: $fn gets [id => raw lead] and returns [newLeads, result]. */
function finder_leads_change(callable $fn)
{
    return finder_json_change(finder_data_file('leads.json'), static function (array $data) use ($fn): array {
        $leads = [];
        foreach (is_array($data['leads'] ?? null) ? $data['leads'] : [] as $l) {
            if (is_array($l) && finder_clean_id($l['id'] ?? '') !== '') {
                $leads[$l['id']] = $l;
            }
        }
        [$leads, $result] = $fn($leads);
        return [['v' => 1, 'leads' => array_values($leads)], $result];
    });
}

// ---- duplicates and the do-not-contact list ----

function finder_shared_host(string $host): bool
{
    foreach (FINDER_SHARED_HOSTS as $h) {
        if ($host === $h || str_ends_with($host, '.' . $h)) {
            return true;
        }
    }
    return false;
}

/**
 * What identifies a business, for finding duplicates: name+city, its own web domain(s), email(s), the OSM object,
 * the TED notice, the Upwork job. $lead can be a lead or a search result row.
 */
function finder_lead_keys(array $lead): array
{
    $keys = [];
    $name = finder_norm((string)($lead['name'] ?? ''));
    $city = finder_norm((string)($lead['city'] ?? ''));
    // (a tender's "name" is its buyer, which may publish many tenders; an Upwork job has no business name)
    if ($name !== '' && !in_array($lead['source'] ?? '', ['upwork-track', 'tender', 'ted'], true)) {
        $keys[] = 'nc:' . $name . '|' . $city;
    }
    $urls = [(string)($lead['website'] ?? '')];
    if (is_array($lead['research']['website'] ?? null)) {
        $urls[] = (string)($lead['research']['website']['url'] ?? '');
    }
    foreach ($urls as $u) {
        $host = finder_host(finder_url($u));
        if ($host !== '' && !finder_shared_host($host)) {
            $keys[] = 'dom:' . $host;
        }
    }
    $emails = [(string)($lead['email'] ?? ''), (string)($lead['research']['contacts']['email'] ?? '')];
    foreach ($emails as $e) {
        $e = finder_email($e);
        if ($e !== '') {
            $keys[] = 'em:' . $e;
        }
    }
    if (is_array($lead['osm'] ?? null) && isset($lead['osm']['type'], $lead['osm']['id'])) {
        $keys[] = 'osm:' . $lead['osm']['type'] . '/' . $lead['osm']['id'];
    }
    if (is_array($lead['tender'] ?? null) && isset($lead['tender']['pub'])) {
        $keys[] = 'ted:' . $lead['tender']['pub'];
    }
    if (($lead['source'] ?? '') === 'upwork-track' && ($lead['evidence_url'] ?? '') !== '') {
        $keys[] = 'upw:' . strtolower((string)$lead['evidence_url']);
    }
    return array_values(array_unique($keys));
}

/** The last 9 digits of a phone number (so +995 32 222 1111 and 032 222 1111 match), or '' when it's too short. */
function finder_phone_key(string $phone): string
{
    $d = (string)preg_replace('/\D+/', '', $phone);
    return strlen($d) >= 7 ? substr($d, -9) : '';
}

/** One business's page on a shared site (a social profile, a directory entry) as "host/path", or ''. */
function finder_profile_key(string $url): string
{
    $u = finder_url($url);
    $host = finder_host($u);
    if ($u === '' || !finder_shared_host($host)) {
        return '';
    }
    $path = strtolower(trim((string)parse_url($u, PHP_URL_PATH), '/'));
    if ($path === 'profile.php') { // facebook.com/profile.php?id=123
        parse_str((string)parse_url($u, PHP_URL_QUERY), $q);
        $path = is_string($q['id'] ?? null) && ctype_digit($q['id']) ? 'profile.php?id=' . $q['id'] : '';
    }
    // pages that list many businesses (groups, searches, hashtags, a map search) say nothing about one of them
    $first = explode('/', $path)[0];
    if ($path === '' || in_array($first, ['groups', 'search', 'hashtag', 'explore', 'events', 'watch', 'results', 'share', 'sharer', 'sharer.php', 'l.php', 'tr', 'p'], true)
        || ($first === 'maps' && !str_starts_with($path, 'maps/place/'))) {
        return '';
    }
    return $host . '/' . $path;
}

/**
 * What the do-not-contact list hashes and checks: everything finder_lead_keys() uses for duplicates, plus more ways
 * the same business can turn up again in another search: each part of a name like "local (English)", the name
 * without the city on its end, phone numbers, and its own social or directory pages. A business whose city wasn't
 * known when it opted out is stored by name alone too ($store), and every row is checked against that.
 * (Wider than duplicate detection on purpose: wrongly hiding a business costs a lead, wrongly showing it again
 * could mean writing to someone who asked us not to.)
 */
function finder_dnc_keys(array $lead, bool $store = false): array
{
    $keys = finder_lead_keys($lead);
    if (in_array($lead['source'] ?? '', ['upwork-track', 'tender', 'ted'], true)) {
        return $keys;
    }
    $city = finder_norm((string)($lead['city'] ?? ''));
    $name = (string)($lead['name'] ?? '');
    $names = [$name];
    if (preg_match('/^(.+?)\s*\((.+)\)$/u', $name, $m)) {
        $names[] = $m[1];
        $names[] = $m[2];
    }
    foreach ($names as $n) {
        $n = finder_norm($n);
        $forms = [$n];
        if ($city !== '' && str_ends_with($n, ' ' . $city)) {
            $forms[] = trim(substr($n, 0, -strlen($city) - 1));
        }
        foreach ($forms as $f) {
            if (mb_strlen($f) >= 3) {
                $keys[] = 'nc:' . $f . '|' . $city;
                if (!$store || $city === '') {
                    $keys[] = 'n:' . $f;
                }
            }
        }
    }
    $research = is_array($lead['research'] ?? null) ? $lead['research'] : [];
    foreach ([(string)($lead['phone'] ?? ''), (string)($research['contacts']['phone'] ?? '')] as $p) {
        if (($k = finder_phone_key($p)) !== '') {
            $keys[] = 'tel:' . $k;
        }
    }
    $pages = array_merge(is_array($lead['social'] ?? null) ? $lead['social'] : [], is_array($research['contacts']['social'] ?? null) ? $research['contacts']['social'] : [],
        [(string)($lead['website'] ?? ''), (string)($lead['evidence_url'] ?? ''), (string)($research['website']['url'] ?? '')]);
    foreach ($pages as $u) {
        if (is_string($u) && ($k = finder_profile_key($u)) !== '') {
            $keys[] = 'page:' . $k;
        }
    }
    return array_values(array_unique($keys));
}

function finder_dnc_hash(string $key): string
{
    return hash('sha256', 'evosoft-dnc|' . $key);
}

/** The do-not-contact list: [hash => 'Y-m-d']. */
function finder_suppressed(): array
{
    $d = finder_json_read(finder_data_file('leads-suppressed.json'));
    return is_array($d['hashes'] ?? null) ? $d['hashes'] : [];
}

/** True when anything identifying $row is on the do-not-contact list. */
function finder_is_suppressed(array $row, ?array $hashes = null): bool
{
    $hashes ??= finder_suppressed();
    foreach (finder_dnc_keys($row) as $k) {
        if (isset($hashes[finder_dnc_hash($k)])) {
            return true;
        }
    }
    return false;
}

/** [key => lead id] for every saved lead. */
function finder_saved_keys(?array $leads = null): array
{
    $map = [];
    foreach ($leads ?? finder_leads_all() as $l) {
        foreach (finder_lead_keys($l) as $k) {
            $map[$k] ??= $l['id'];
        }
    }
    return $map;
}

/**
 * Saves new leads (already shaped by the caller from trusted data), skipping duplicates and anything on the
 * do-not-contact list. Returns ['saved' => [rowKey => id], 'duplicates' => [rowKey => existing id], 'suppressed' => n].
 */
function finder_leads_add(array $rows): array
{
    $hashes = finder_suppressed();
    $r = finder_leads_change(static function (array $leads) use ($rows, $hashes): array {
        $map = [];
        foreach ($leads as $l) {
            foreach (finder_lead_keys(finder_lead_shape($l)) as $k) {
                $map[$k] ??= $l['id'];
            }
        }
        $out = ['saved' => [], 'duplicates' => [], 'suppressed' => 0];
        $now = finder_iso_now();
        foreach ($rows as $rowKey => $row) {
            if (finder_is_suppressed($row, $hashes)) {
                $out['suppressed']++;
                continue;
            }
            $dup = null;
            foreach (finder_lead_keys($row) as $k) {
                if (isset($map[$k])) {
                    $dup = $map[$k];
                    break;
                }
            }
            if ($dup !== null) {
                $out['duplicates'][$rowKey] = $dup;
                continue;
            }
            $lead = finder_lead_shape(['id' => finder_new_id(), 'found_at' => $now, 'updated_at' => $now, 'status' => 'new'] + $row);
            $leads[$lead['id']] = $lead;
            foreach (finder_lead_keys($lead) as $k) {
                $map[$k] = $lead['id'];
            }
            $out['saved'][$rowKey] = $lead['id'];
        }
        return [$leads, $out];
    });
    return is_array($r) ? $r : ['saved' => [], 'duplicates' => [], 'suppressed' => 0, 'error' => true];
}

/** Changes one lead with $fn(lead): lead. Returns the new lead, or null when it isn't there. */
function finder_lead_update(string $id, callable $fn): ?array
{
    $r = finder_leads_change(static function (array $leads) use ($id, $fn): array {
        if (!isset($leads[$id])) {
            return [$leads, null];
        }
        $lead = finder_lead_shape($fn(finder_lead_shape($leads[$id])));
        $lead['id'] = $id;
        $lead['updated_at'] = finder_iso_now();
        $leads[$id] = $lead;
        return [$leads, $lead];
    });
    return is_array($r) ? $r : null;
}

function finder_lead_delete(string $id): bool
{
    return finder_leads_change(static function (array $leads) use ($id): array {
        if (!isset($leads[$id])) {
            return [$leads, false];
        }
        unset($leads[$id]);
        return [$leads, true];
    }) === true;
}

/** Do not contact: adds the lead's hashes to the suppression list, then deletes the lead (and everything it held). */
function finder_lead_dnc(string $id): bool
{
    $lead = finder_lead_find($id);
    if ($lead === null) {
        return false;
    }
    $keys = finder_dnc_keys($lead, true);
    $ok = finder_json_change(finder_data_file('leads-suppressed.json'), static function (array $d) use ($keys): array {
        $d['v'] = 1;
        $d['hashes'] = is_array($d['hashes'] ?? null) ? $d['hashes'] : [];
        foreach ($keys as $k) {
            $d['hashes'][finder_dnc_hash($k)] = gmdate('Y-m-d');
        }
        return [$d, true];
    });
    return $ok === true && finder_lead_delete($id);
}

// ---- the Leads tab ----

function finder_lead_filters(array $get): array
{
    $status = is_string($get['status'] ?? null) && isset(FINDER_STATUSES[$get['status']]) ? $get['status'] : '';
    $source = is_string($get['source'] ?? null) && isset(FINDER_SOURCES[$get['source']]) ? $get['source'] : '';
    $q = finder_line($get['q'] ?? '', 100);
    $page = is_string($get['page'] ?? null) && ctype_digit($get['page']) ? max(1, min(100000, (int)$get['page'])) : 1;
    return ['status' => $status, 'source' => $source, 'q' => $q, 'page' => $page];
}

function finder_lead_matches(array $l, string $q): bool
{
    if ($q === '') {
        return true;
    }
    $hay = implode("\n", [$l['name'], $l['category'], $l['city'], $l['address'], $l['phone'], $l['email'], $l['website'], $l['notes'], $l['tender']['title'] ?? '']);
    foreach (preg_split('/\s+/u', $q) ?: [] as $w) {
        if ($w !== '' && mb_stripos($hay, $w) === false) {
            return false;
        }
    }
    return true;
}

/** [rows, counts per status, count with the other filters] */
function finder_leads_filtered(array $f): array
{
    $counts = array_fill_keys(array_keys(FINDER_STATUSES), 0);
    $all = 0;
    $rows = [];
    foreach (finder_leads_all() as $l) {
        if (($f['source'] !== '' && $l['source'] !== $f['source']) || !finder_lead_matches($l, $f['q'])) {
            continue;
        }
        $counts[$l['status']]++;
        $all++;
        if ($f['status'] === '' || $l['status'] === $f['status']) {
            $rows[] = $l;
        }
    }
    return [$rows, $counts, $all];
}

function finder_status_badge(string $status): string
{
    $status = isset(FINDER_STATUSES[$status]) ? $status : 'new';
    return '<span class="badge fst-' . str_replace('_', '-', $status) . '">' . admin_h(FINDER_STATUSES[$status]) . '</span>';
}

function finder_date(string $iso): string
{
    if (preg_match('/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/', $iso, $m)) {
        return '<time datetime="' . admin_h($iso) . '">' . admin_h($m[1]) . '</time>';
    }
    return '<span class="muted">—</span>';
}

function finder_country_name(string $code): string
{
    return FINDER_COUNTRIES[$code] ?? (FINDER_TED_COUNTRIES[$code] ?? $code);
}

/** Can the AI research or write to this lead? Not for tenders (bid through the procedure) or Upwork (reply there). */
function finder_lead_outreach_ok(array $l): bool
{
    return !in_array($l['source'], ['tender', 'upwork-track'], true);
}

function finder_osm_url(?array $osm): string
{
    return $osm ? 'https://www.openstreetmap.org/' . $osm['type'] . '/' . $osm['id'] : '';
}

function finder_osm_credit(): string
{
    return '<p class="osm-credit small">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors<span class="sr-only"> (opens in a new tab)</span></a>, available under the ODbL. Keep this list private: don’t publish or share it.</p>';
}

function finder_leads_view(array $get): string
{
    $f = finder_lead_filters($get);
    [$rows, $counts, $all] = finder_leads_filtered($f);
    $pages = max(1, (int)ceil(count($rows) / FINDER_LEADS_PER_PAGE));
    $page = min($f['page'], $pages);
    $shown = array_slice($rows, ($page - 1) * FINDER_LEADS_PER_PAGE, FINDER_LEADS_PER_PAGE);
    $base = ['view' => 'finder', 'tab' => 'leads'];
    $keep = $base + ['source' => $f['source'], 'q' => $f['q']];
    $suppressed = count(finder_suppressed());

    $html = '<section aria-labelledby="h-leads"><div class="page-head row sub"><div><h2 id="h-leads">Saved leads</h2>'
        . '<p class="muted">Businesses you saved from a search or added by hand, newest first.' . ($suppressed ? ' ' . admin_h((string)$suppressed) . ' identifiers are on the do-not-contact list.' : '') . '</p></div>'
        . '<a class="btn" href="' . admin_h(admin_url($keep + ['status' => $f['status'], 'export' => 'csv'])) . '" download>Download CSV<span class="sr-only"> of the leads shown</span></a></div>';

    $html .= '<nav class="tabs" aria-label="Lead status"><ul>';
    $tabs = ['' => ['All', $all]];
    foreach (FINDER_STATUSES as $k => $label) {
        $tabs[$k] = [$label, $counts[$k]];
    }
    foreach ($tabs as $k => [$label, $n]) {
        $html .= '<li><a href="' . admin_h(admin_url($keep + ['status' => $k])) . '"' . ($k === $f['status'] ? ' aria-current="page"' : '') . '>'
            . admin_h($label) . ' <span class="count">' . $n . '</span></a></li>';
    }
    $html .= '</ul></nav>';

    $html .= '<form class="filters" method="get" action="' . admin_h(admin_base()) . '" role="search" aria-label="Filter the leads">'
        . '<input type="hidden" name="view" value="finder"><input type="hidden" name="tab" value="leads">'
        . '<div class="field grow"><label for="lf-q">Search</label><input id="lf-q" name="q" type="search" value="' . admin_h($f['q']) . '" maxlength="100" placeholder="Name, city, phone, email or notes"></div>'
        . '<div class="field"><label for="lf-status">Status</label><select id="lf-status" name="status"><option value="">All</option>';
    foreach (FINDER_STATUSES as $k => $label) {
        $html .= '<option value="' . $k . '"' . ($k === $f['status'] ? ' selected' : '') . '>' . admin_h($label) . '</option>';
    }
    $html .= '</select></div><div class="field"><label for="lf-source">Source</label><select id="lf-source" name="source"><option value="">Any</option>';
    foreach (FINDER_SOURCES as $k => $label) {
        $html .= '<option value="' . $k . '"' . ($k === $f['source'] ? ' selected' : '') . '>' . admin_h($label) . '</option>';
    }
    $html .= '</select></div><div class="filter-actions"><button class="btn primary" type="submit">Show</button>'
        . (($f['q'] !== '' || $f['status'] !== '' || $f['source'] !== '') ? '<a class="btn plain" href="' . admin_h(admin_url($base)) . '">Clear</a>' : '') . '</div></form>';

    $found = count($rows);
    $html .= '<p class="summary" role="status">' . ($found === 1 ? '1 lead' : $found . ' leads') . ($found > FINDER_LEADS_PER_PAGE ? ', page ' . $page . ' of ' . $pages : '') . '</p>';
    if (!$shown) {
        $html .= '<div class="card empty"><p>' . ($all === 0 && $f['q'] === '' && $f['source'] === '' ? 'No leads yet. Search on the Local businesses or Tenders tab and save the ones worth a look, or add one by hand below.' : 'No leads match these filters.') . '</p></div>';
    } else {
        $anyOsm = false;
        $html .= '<div class="table-wrap"><table class="list leads"><caption class="sr-only">Saved leads' . ($found > FINDER_LEADS_PER_PAGE ? ', page ' . $page . ' of ' . $pages : '') . '</caption><thead><tr>'
            . '<th scope="col">Business</th><th scope="col">Contact</th><th scope="col">Website</th><th scope="col">Score</th><th scope="col">Status</th><th scope="col">Found</th><th scope="col">Actions</th></tr></thead><tbody>';
        foreach ($shown as $l) {
            $anyOsm = $anyOsm || $l['source'] === 'osm';
            $where = trim(implode(', ', array_filter([$l['city'], $l['country'] !== '' ? finder_country_name($l['country']) : ''])));
            $contact = [];
            if ($l['phone'] !== '') {
                $contact[] = admin_h($l['phone']);
            }
            if ($l['email'] !== '') {
                $contact[] = '<span class="email">' . admin_h($l['email']) . '</span>';
            }
            $web = $l['website'] !== '' ? finder_link($l['website'], finder_host($l['website'])) . ' <span class="muted">(' . admin_h(FINDER_WEB_STATUSES[$l['website_status']]) . ')</span>'
                : admin_h(FINDER_WEB_STATUSES[$l['website_status']]);
            $url = admin_url(['view' => 'finder', 'tab' => 'leads', 'lead' => $l['id']]);
            // one box per cell, so the phone layout keeps each label on the left and the content on the right
            $html .= '<tr data-lead="' . admin_h($l['id']) . '">'
                . '<th scope="row" data-label="Business"><div class="cell"><a class="name" href="' . admin_h($url) . '">' . admin_h($l['name'] !== '' ? $l['name'] : '(no name)') . '</a>'
                . '<span class="src">' . admin_h(implode(' · ', array_filter([$l['category'], $where, FINDER_SOURCES[$l['source']]]))) . '</span>'
                . ($l['source'] === 'upwork-track' && $l['notes'] !== '' ? '<span class="reason">' . admin_h(mb_strimwidth($l['notes'], 0, 120, '…')) . '</span>' : '')
                . ($l['tender'] ? '<span class="reason">' . admin_h(mb_strimwidth($l['tender']['title'], 0, 140, '…')) . ($l['tender']['deadline'] !== '' ? ' · deadline ' . admin_h($l['tender']['deadline']) : '') . '</span>' : '') . '</div></th>'
                . '<td data-label="Contact"><div class="cell">' . ($contact ? implode('<br>', $contact) : '<span class="muted">—</span>') . '</div></td>'
                . '<td data-label="Website"><div class="cell">' . $web . '</div></td>'
                . '<td data-label="Score" class="num"><div class="cell" data-score>' . ($l['score'] !== null ? admin_h((string)$l['score']) : '<span class="muted">—</span>') . '</div></td>'
                . '<td data-label="Status"><div class="cell">' . finder_status_badge($l['status']) . '</div></td>'
                . '<td data-label="Found"><div class="cell">' . finder_date($l['found_at']) . '</div></td>'
                . '<td data-label="Actions"><div class="cell"><div class="row-actions">'
                . (finder_lead_outreach_ok($l) && finder_ai_ready() ? '<button type="button" class="btn small" data-research="' . admin_h($l['id']) . '" hidden>Research<span class="sr-only"> ' . admin_h($l['name']) . '</span></button>' : '')
                . '<a class="btn small plain" href="' . admin_h($url) . '">Open<span class="sr-only"> ' . admin_h($l['name']) . '</span></a></div>'
                . '<p class="row-state small" data-state></p></div></td></tr>';
        }
        $html .= '</tbody></table></div>';
        if ($pages > 1) {
            $html .= '<nav class="pager" aria-label="Pages">'
                . ($page > 1 ? '<a class="btn" href="' . admin_h(admin_url($keep + ['status' => $f['status'], 'page' => $page - 1])) . '" rel="prev">← Newer</a>' : '<span></span>')
                . '<span class="muted">Page ' . $page . ' of ' . $pages . '</span>'
                . ($page < $pages ? '<a class="btn" href="' . admin_h(admin_url($keep + ['status' => $f['status'], 'page' => $page + 1])) . '" rel="next">Older →</a>' : '<span></span>')
                . '</nav>';
        }
        if ($anyOsm) {
            $html .= finder_osm_credit();
        }
    }
    $html .= '</section>' . finder_manual_form();
    return $html;
}

/** The "add a lead by hand" form. */
function finder_manual_form(): string
{
    $opts = '';
    foreach (FINDER_COUNTRIES as $code => $name) {
        $opts .= '<option value="' . $code . '"' . ($code === 'GE' ? ' selected' : '') . '>' . admin_h($name) . '</option>';
    }
    return '<section class="card" aria-labelledby="h-add"><h2 id="h-add">Add a lead by hand</h2>'
        . '<p class="muted small">For a business you came across yourself. Business details only.</p>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.lead_add'])) . '" class="form-grid">' . admin_csrf_field()
        . '<div class="field"><label for="m-name">Business name</label><input id="m-name" name="name" type="text" required maxlength="120"></div>'
        . '<div class="field"><label for="m-cat">Type of business <span class="muted">(optional)</span></label><input id="m-cat" name="category" type="text" maxlength="80"></div>'
        . '<div class="field"><label for="m-city">City <span class="muted">(optional)</span></label><input id="m-city" name="city" type="text" maxlength="60"></div>'
        . '<div class="field"><label for="m-country">Country</label><select id="m-country" name="country">' . $opts . '</select></div>'
        . '<div class="field"><label for="m-phone">Phone <span class="muted">(optional)</span></label><input id="m-phone" name="phone" type="text" inputmode="tel" maxlength="40"></div>'
        . '<div class="field"><label for="m-email">Email <span class="muted">(optional)</span></label><input id="m-email" name="email" type="email" maxlength="254"></div>'
        . '<div class="field"><label for="m-web">Website or page <span class="muted">(optional)</span></label><input id="m-web" name="website" type="url" maxlength="400" placeholder="https://"></div>'
        . '<div class="field"><label for="m-ws">Website</label><select id="m-ws" name="website_status">'
        . '<option value="unknown">Not checked yet</option><option value="none">No website</option><option value="social_only">Social page only</option><option value="weak">Weak website</option><option value="ok">Has a good website</option></select></div>'
        . '<div class="field span2"><label for="m-notes">Notes <span class="muted">(optional; only you see them)</span></label><textarea id="m-notes" name="notes" rows="3" maxlength="5000"></textarea></div>'
        . '<div class="span2"><button class="btn primary" type="submit">Add lead</button></div></form></section>';
}

/** One lead: facts, status and notes, research, the draft email, do not contact, delete. */
function finder_lead_detail_view(array $l): string
{
    $id = $l['id'];
    $name = $l['name'] !== '' ? $l['name'] : '(no name)';
    $html = '<p class="back"><a href="' . admin_h(admin_url(['view' => 'finder', 'tab' => 'leads'])) . '">← All leads</a></p>'
        . '<div class="page-head sub"><h2 class="lead-name">' . admin_h($name) . '</h2><p class="meta-line">' . admin_h(FINDER_SOURCES[$l['source']]) . ' · ' . finder_status_badge($l['status'])
        . ($l['score'] !== null ? ' · <span>Fit score ' . admin_h((string)$l['score']) . '/100</span>' : '') . '</p></div><div class="detail">';

    // facts
    $rows = [];
    if ($l['category'] !== '') {
        $rows[] = ['Type', admin_h($l['category'])];
    }
    $city = $l['city'] !== '' && mb_stripos($l['address'], $l['city']) === false ? $l['city'] : '';
    $where = trim(implode(', ', array_filter([$l['address'], $city, $l['country'] !== '' ? finder_country_name($l['country']) : ''])));
    if ($where !== '') {
        $rows[] = ['Where', admin_h($where)];
    }
    if ($l['phone'] !== '') {
        $digits = preg_replace('/[^0-9+]/', '', $l['phone']) ?? '';
        $rows[] = ['Phone', $digits !== '' ? '<a href="tel:' . admin_h($digits) . '">' . admin_h($l['phone']) . '</a>' : admin_h($l['phone'])];
    }
    if ($l['email'] !== '') {
        $rows[] = ['Email', admin_h($l['email'])];
    }
    $rows[] = ['Website', ($l['website'] !== '' ? finder_link($l['website'], $l['website']) . ' · ' : '') . admin_h(FINDER_WEB_STATUSES[$l['website_status']])];
    foreach ($l['social'] as $s) {
        $rows[] = ['Social page', finder_link($s, finder_host($s))];
    }
    if ($l['tender']) {
        $t = $l['tender'];
        $rows[] = ['Tender', admin_h($t['title'])];
        if ($t['deadline'] !== '') {
            $rows[] = ['Deadline', admin_h($t['deadline'])];
        }
        if ($t['value'] !== null) {
            $rows[] = ['Estimated value', admin_h(number_format($t['value'], 0, '.', ',') . ' ' . $t['currency'])];
        }
    }
    if ($l['osm']) {
        $rows[] = ['On the map', finder_link(finder_osm_url($l['osm']), 'OpenStreetMap ' . $l['osm']['type'] . ' ' . $l['osm']['id'])];
    }
    if ($l['evidence_url'] !== '') {
        $label = $l['source'] === 'upwork-track' ? 'Open on Upwork' : ($l['source'] === 'tender' ? 'Notice on TED' : finder_host($l['evidence_url']));
        $rows[] = [$l['source'] === 'web' ? 'Found on' : 'Link', finder_link($l['evidence_url'], $label)];
    }
    if ($l['reasons'] && !is_array($l['research'])) { // after research, the Research card lists them
        $rows[] = ['Why it’s a lead', '<ul class="plain-list">' . implode('', array_map(static fn($r) => '<li>' . admin_h($r) . '</li>', $l['reasons'])) . '</ul>'];
    }
    $rows[] = ['Found', finder_date($l['found_at'])];
    $rows[] = ['Lead id', '<code>' . admin_h($id) . '</code>'];
    $html .= '<section class="card" aria-labelledby="h-facts"><h2 id="h-facts">Details</h2>' . req_dl($rows)
        . ($l['source'] === 'osm' ? finder_osm_credit() : '')
        . ($l['source'] === 'upwork-track' ? '<p class="muted small">Reply to this client on Upwork only. Contacting them outside Upwork before a contract starts is against Upwork’s terms. Only the link, your note and the date are kept.</p>' : '')
        . ($l['source'] === 'tender' ? '<p class="muted small">Source: TED (ted.europa.eu), reused under the EU’s reuse policy. To win the work, bid through the procedure named in the notice; check the eligibility rules for Georgian companies first.</p>' : '')
        . '</section>';

    // status and notes
    $html .= '<section class="card" aria-labelledby="h-status"><h2 id="h-status">Status and notes</h2>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.lead_update'])) . '" class="stack">' . admin_csrf_field()
        . '<input type="hidden" name="id" value="' . admin_h($id) . '">'
        . '<div class="field"><label for="ls-status">Status</label><select id="ls-status" name="status">';
    foreach (FINDER_STATUSES as $k => $label) {
        $html .= '<option value="' . $k . '"' . ($k === $l['status'] ? ' selected' : '') . '>' . admin_h($label) . '</option>';
    }
    $html .= '</select><p class="hint">To never hear of this business again, use “Do not contact” below instead.</p></div>'
        . '<div class="field"><label for="ls-notes">Notes <span class="muted">(only you see them)</span></label><textarea id="ls-notes" name="notes" rows="5" maxlength="5000">' . admin_h($l['notes']) . '</textarea></div>'
        . '<div class="row-actions"><button class="btn primary" type="submit">Save</button>'
        . ($l['updated_at'] !== '' ? '<span class="muted small">Last changed ' . finder_date($l['updated_at']) . '</span>' : '') . '</div></form></section>';

    if (finder_lead_outreach_ok($l)) {
        $html .= finder_research_html($l) . finder_draft_html($l);
    } elseif ($l['source'] === 'upwork-track' && $l['evidence_url'] !== '') {
        $html .= '<section class="card wide" aria-labelledby="h-reply"><h2 id="h-reply">Reply</h2><p>Send your proposal on Upwork. Messages and contracts stay on Upwork.</p><p>'
            . finder_link($l['evidence_url'], 'Open the job on Upwork', 'btn primary') . '</p></section>';
    }

    // do not contact
    $html .= '<section class="card wide" aria-labelledby="h-dnc"><h2 id="h-dnc">Do not contact</h2>'
        . '<p>For a business that asked not to be contacted, or that you shouldn’t contact. Its details and your notes are deleted; only scrambled identifiers (hashes of its name and city, web domain, email, phone, social or directory pages and map id) are kept, so later searches and manual adds skip it.</p>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.lead_dnc'])) . '" class="stack">' . admin_csrf_field()
        . '<input type="hidden" name="id" value="' . admin_h($id) . '">'
        . '<div class="check"><input type="checkbox" id="dnc-confirm" name="confirm" value="yes" required><label for="dnc-confirm">Yes, never contact <bdi>' . admin_h($name) . '</bdi></label></div>'
        . '<div><button class="btn" type="submit">Do not contact</button></div></form></section>';

    $html .= '<section class="card wide danger" aria-labelledby="h-del"><h2 id="h-del">Delete this lead</h2><p>Deletes it for good. A later search can find it again (use “Do not contact” to stop that).</p>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.lead_delete'])) . '" class="stack">' . admin_csrf_field()
        . '<input type="hidden" name="id" value="' . admin_h($id) . '">'
        . '<div class="check"><input type="checkbox" id="del-confirm" name="confirm" value="yes" required><label for="del-confirm">Yes, delete <bdi>' . admin_h($name) . '</bdi></label></div>'
        . '<div><button class="btn danger" type="submit">Delete lead</button></div></form></section>';
    return $html . '</div>';
}

/** The research card: what the AI found, and the button that asks it. */
function finder_research_html(array $l): string
{
    $r = is_array($l['research']) ? $l['research'] : null;
    $html = '<section class="card wide" aria-labelledby="h-research"><div class="card-head"><h2 id="h-research">Research</h2>';
    if (finder_ai_ready()) {
        $html .= '<button type="button" class="btn ' . ($r ? '' : 'primary') . '" data-research="' . admin_h($l['id']) . '" data-reload="1" hidden>' . ($r ? 'Research again' : 'Research this business') . '</button>';
    }
    $html .= '</div><p class="row-state" data-state-for="' . admin_h($l['id']) . '"></p>';
    if (!finder_ai_ready()) {
        $html .= '<p class="muted">AI research needs <code>anthropic_api_key</code> in the settings file.</p>';
    }
    if ($r === null) {
        $html .= '<p class="muted">The AI looks the business up on the web: does it have a website, how good is it (https, phones, speed, how up to date), its public business contacts, a fit score and a suggested pitch. Takes up to a minute and a half.</p>';
        return $html . '</section>';
    }
    $w = is_array($r['website'] ?? null) ? $r['website'] : [];
    $c = is_array($r['contacts'] ?? null) ? $r['contacts'] : [];
    $yn = static fn($v): string => $v === true ? 'Yes' : ($v === false ? 'No' : 'Not sure');
    $rows = [];
    $rows[] = ['Website', (($w['url'] ?? '') !== '' ? finder_link((string)$w['url'], (string)$w['url']) . ' · ' : '') . admin_h(FINDER_WEB_STATUSES[$w['status'] ?? 'unknown'] ?? 'Not checked')];
    if (($w['url'] ?? '') !== '') {
        $rows[] = ['Secure (https)', admin_h($yn($w['https'] ?? null))];
        $rows[] = ['Works on phones', admin_h($yn($w['mobile'] ?? null))];
        $rows[] = ['Speed', admin_h(['fast' => 'Fast', 'average' => 'Average', 'slow' => 'Slow'][$w['speed'] ?? ''] ?? 'Not sure')];
        $rows[] = ['Looks outdated', admin_h($yn($w['outdated'] ?? null))];
    }
    if (($w['notes'] ?? '') !== '') {
        $rows[] = ['About the site', admin_h((string)$w['notes'])];
    }
    foreach (['phone' => 'Business phone', 'email' => 'Business email', 'address' => 'Address'] as $k => $label) {
        if (($c[$k] ?? '') !== '') {
            $rows[] = [$label, admin_h((string)$c[$k])];
        }
    }
    foreach (is_array($c['social'] ?? null) ? $c['social'] : [] as $s) {
        $rows[] = ['Social page', finder_link((string)$s, finder_host((string)$s))];
    }
    if (isset($r['score'])) {
        $rows[] = ['Fit score', admin_h((string)(int)$r['score']) . '/100'];
    }
    if (!empty($r['reasons']) && is_array($r['reasons'])) {
        $rows[] = ['Reasons', '<ul class="plain-list">' . implode('', array_map(static fn($x) => '<li>' . admin_h((string)$x) . '</li>', $r['reasons'])) . '</ul>'];
    }
    if (($r['pitch'] ?? '') !== '') {
        $rows[] = ['Suggested pitch', '<p class="pitch">' . nl2br(admin_h((string)$r['pitch']), false) . '</p>'];
    }
    $src = [];
    foreach (is_array($r['sources'] ?? null) ? $r['sources'] : [] as $s) {
        if (is_array($s) && finder_url($s['url'] ?? '') !== '') {
            $src[] = '<li>' . finder_link((string)$s['url'], finder_host((string)$s['url'])) . (($s['seen'] ?? false) ? '' : ' <span class="muted">(not among the search results: check it)</span>') . '</li>';
        }
    }
    if ($src) {
        $rows[] = ['Sources', '<ul class="plain-list">' . implode('', $src) . '</ul>'];
    }
    $html .= req_dl($rows) . '<p class="muted small">Researched ' . finder_date((string)($r['at'] ?? '')) . ' by AI from public web pages. Web pages can be wrong or out of date, so check before you rely on it. Contacts found here are kept apart from the map data.</p>';
    return $html . '</section>';
}

/** The draft email card. Nothing is ever sent from here: it's a draft to edit, copy, or open in your email app. */
function finder_draft_html(array $l): string
{
    $d = is_array($l['draft']) ? $l['draft'] : ['subject' => '', 'body' => '', 'lang' => 'en', 'at' => ''];
    $to = $l['email'] !== '' ? $l['email'] : finder_email($l['research']['contacts']['email'] ?? '');
    $toFromAi = $l['email'] === '' && $to !== '';
    $mailto = 'mailto:' . str_replace('%40', '@', rawurlencode($to)) . '?subject=' . rawurlencode($d['subject']) . '&body=' . rawurlencode($d['body']);
    $langs = ['en' => 'English', 'ka' => 'Georgian', 'ru' => 'Russian'];
    $html = '<section class="card wide" aria-labelledby="h-draft"><div class="card-head"><h2 id="h-draft">Draft email</h2></div>'
        . '<p class="muted small">Only a draft: nothing is ever sent from here. Read it, fix anything that isn’t right, then copy it or open it in your email app.</p>'
        . ($to !== '' ? '<p class="small">To: <bdi class="email">' . admin_h($to) . '</bdi>' . ($toFromAi ? ' <span class="muted">(found by the AI research, not in the original listing: check it’s the business’s own address)</span>' : '') . '</p>' : '')
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'finder.draft_save'])) . '" class="stack" id="draft-form" data-to="' . admin_h($to) . '">' . admin_csrf_field()
        . '<input type="hidden" name="id" value="' . admin_h($l['id']) . '">';
    if (finder_ai_ready()) {
        $opts = '';
        foreach ($langs as $k => $label) {
            $opts .= '<option value="' . $k . '"' . ($k === $d['lang'] ? ' selected' : '') . '>' . $label . '</option>';
        }
        $html .= '<div class="draft-ai"><div class="field"><label for="d-lang">Language</label><select id="d-lang" name="lang">' . $opts . '</select></div>'
            . '<button type="button" class="btn" data-draft="' . admin_h($l['id']) . '" hidden>' . ($d['body'] !== '' ? 'Write a new draft<span class="sr-only"> (replaces the one below)</span>' : 'Write a draft with AI') . '</button></div>'
            . '<p class="row-state" data-state-for="draft-' . admin_h($l['id']) . '"></p>';
    }
    $html .= '<div class="field"><label for="d-subject">Subject</label><input id="d-subject" name="subject" type="text" maxlength="160" value="' . admin_h($d['subject']) . '"></div>'
        . '<div class="field"><label for="d-body">Message</label><textarea id="d-body" name="body" rows="14" maxlength="5000">' . admin_h($d['body']) . '</textarea></div>'
        . '<div class="checklist"><p class="small"><strong>Before you send it, check that it:</strong></p><ul class="small">'
        . '<li>goes to a business address, not a private person</li><li>says where you found their details</li><li>offers an easy way to opt out (honour it at once with “Do not contact”)</li><li>only states things that are true</li></ul></div>'
        . '<div class="row-actions"><button class="btn primary" type="submit">Save draft</button>'
        . '<a class="btn" id="d-mailto" href="' . admin_h($mailto) . '">Open in email app</a>'
        . '<button type="button" class="btn" id="d-copy" hidden>Copy</button>'
        . ($d['at'] !== '' ? '<span class="muted small">Draft from ' . finder_date($d['at']) . '</span>' : '') . '</div>'
        . ($to === '' ? '<p class="muted small">No email address is known for this business: add the recipient in your email app.</p>' : '')
        . '</form></section>';
    return $html;
}

// ---- actions (form posts with a redirect, or JSON for scripts) ----

function finder_done(array $query, string $message, bool $ok = true, array $json = []): never
{
    if (admin_wants_json()) {
        admin_json(['ok' => $ok, 'message' => $message] + ($ok ? [] : ['error' => $message]) + $json);
    }
    admin_redirect($query, $message, $ok ? 'ok' : 'error');
}

function finder_action_lead_update(array $post): never
{
    $id = finder_clean_id($post['id'] ?? '');
    $status = is_string($post['status'] ?? null) && isset(FINDER_STATUSES[$post['status']]) ? $post['status'] : null;
    $notes = is_string($post['notes'] ?? null) ? finder_text($post['notes'], 5000) : null;
    $lead = $id !== '' ? finder_lead_update($id, static function (array $l) use ($status, $notes): array {
        if ($status !== null) {
            $l['status'] = $status;
        }
        if ($notes !== null) {
            $l['notes'] = $notes;
        }
        return $l;
    }) : null;
    if ($lead === null) {
        finder_done(['view' => 'finder', 'tab' => 'leads'], 'That lead wasn’t found (it may have been deleted).', false);
    }
    finder_done(['view' => 'finder', 'tab' => 'leads', 'lead' => $id], 'Saved.');
}

function finder_action_draft_save(array $post): never
{
    $id = finder_clean_id($post['id'] ?? '');
    $subject = finder_line($post['subject'] ?? '', 160);
    $body = finder_text($post['body'] ?? '', 5000);
    $lang = is_string($post['lang'] ?? null) && in_array($post['lang'], ['en', 'ka', 'ru'], true) ? $post['lang'] : 'en';
    $lead = $id !== '' ? finder_lead_update($id, static function (array $l) use ($subject, $body, $lang): array {
        $l['draft'] = ['subject' => $subject, 'body' => $body, 'lang' => $lang, 'at' => finder_iso_now()];
        return $l;
    }) : null;
    if ($lead === null) {
        finder_done(['view' => 'finder', 'tab' => 'leads'], 'That lead wasn’t found (it may have been deleted).', false);
    }
    finder_done(['view' => 'finder', 'tab' => 'leads', 'lead' => $id], 'Draft saved. Nothing was sent.');
}

function finder_action_lead_delete(array $post): never
{
    $id = finder_clean_id($post['id'] ?? '');
    if (($post['confirm'] ?? '') !== 'yes') {
        finder_done(['view' => 'finder', 'tab' => 'leads', 'lead' => $id], 'Nothing was deleted: tick the box to confirm first.', false);
    }
    if ($id === '' || !finder_lead_delete($id)) {
        finder_done(['view' => 'finder', 'tab' => 'leads'], 'That lead wasn’t found, so nothing was deleted.', false);
    }
    finder_done(['view' => 'finder', 'tab' => 'leads'], 'The lead was deleted.');
}

function finder_action_lead_dnc(array $post): never
{
    $id = finder_clean_id($post['id'] ?? '');
    if (($post['confirm'] ?? '') !== 'yes') {
        finder_done(['view' => 'finder', 'tab' => 'leads', 'lead' => $id], 'Nothing was changed: tick the box to confirm first.', false);
    }
    if ($id === '' || !finder_lead_dnc($id)) {
        finder_done(['view' => 'finder', 'tab' => 'leads'], 'That lead wasn’t found, so nothing was changed.', false);
    }
    finder_done(['view' => 'finder', 'tab' => 'leads'], 'Done: its details were deleted and later searches will skip it.');
}

function finder_action_lead_add(array $post): never
{
    $name = finder_line($post['name'] ?? '', 120);
    if ($name === '') {
        finder_done(['view' => 'finder', 'tab' => 'leads'], 'Please give the business a name.', false);
    }
    $country = is_string($post['country'] ?? null) && isset(FINDER_COUNTRIES[$post['country']]) ? $post['country'] : '';
    $ws = is_string($post['website_status'] ?? null) && isset(FINDER_WEB_STATUSES[$post['website_status']]) ? $post['website_status'] : 'unknown';
    $email = finder_email($post['email'] ?? '');
    $web = finder_url($post['website'] ?? '');
    $bad = [];
    if (finder_line($post['email'] ?? '', 254) !== '' && $email === '') {
        $bad[] = 'the email address';
    }
    if (finder_line($post['website'] ?? '', 400) !== '' && $web === '') {
        $bad[] = 'the web address (it must start with https:// or http://)';
    }
    if (finder_line($post['phone'] ?? '', 40) !== '' && finder_phone($post['phone']) === '') {
        $bad[] = 'the phone number';
    }
    if ($bad) {
        finder_done(['view' => 'finder', 'tab' => 'leads'], 'Nothing was added: please check ' . implode(', ', $bad) . '.', false);
    }
    $row = ['source' => 'manual', 'name' => $name, 'category' => finder_line($post['category'] ?? '', 80), 'city' => finder_line($post['city'] ?? '', 60),
        'country' => $country, 'phone' => finder_phone($post['phone'] ?? ''), 'email' => $email, 'website' => $web, 'website_status' => $ws,
        'notes' => finder_text($post['notes'] ?? '', 5000)];
    $r = finder_leads_add(['m' => $row]);
    if (isset($r['saved']['m'])) {
        finder_done(['view' => 'finder', 'tab' => 'leads', 'lead' => $r['saved']['m']], 'Lead added.');
    }
    if (isset($r['duplicates']['m'])) {
        finder_done(['view' => 'finder', 'tab' => 'leads', 'lead' => $r['duplicates']['m']], 'You already have this business: here it is.', false);
    }
    finder_done(['view' => 'finder', 'tab' => 'leads'], $r['suppressed'] ? 'This business is on your do-not-contact list, so it wasn’t added.' : 'The lead couldn’t be saved.', false);
}

/**
 * POST finder.save: items = JSON [{"search": "<cache id>", "key": "<row key>"}, ...] from a results table.
 * The rows are read back from the server's own cache (never trusted from the page).
 */
function finder_action_save(array $post): never
{
    $items = json_decode(is_string($post['items'] ?? null) ? $post['items'] : '[]', true);
    if (!is_array($items) || !$items) {
        finder_fail('Select at least one row first.');
    }
    if (count($items) > 200) {
        finder_fail('That’s more than 200 rows at once: save them in smaller groups.');
    }
    $rows = [];
    $missing = 0;
    $entries = [];
    foreach ($items as $it) {
        $sid = is_array($it) && is_string($it['search'] ?? null) ? $it['search'] : '';
        $key = is_array($it) && is_string($it['key'] ?? null) ? substr($it['key'], 0, 200) : '';
        if (!preg_match('/^(osm|web|ted)-[0-9a-f]{40}$/', $sid) || $key === '') {
            $missing++;
            continue;
        }
        $entries[$sid] ??= finder_cache_get_id($sid);
        $row = null;
        foreach ($entries[$sid]['data']['rows'] ?? [] as $r) {
            if (is_array($r) && ($r['key'] ?? '') === $key) {
                $row = $r;
                break;
            }
        }
        if ($row === null) {
            $missing++;
            continue;
        }
        $rows[$key] = finder_row_to_lead($row);
    }
    if (!$rows) {
        finder_fail('Those results have expired (they are kept for 24 hours). Please search again.', 410);
    }
    $r = finder_leads_add($rows);
    if (!empty($r['error'])) {
        finder_fail('The leads couldn’t be saved (the data folder isn’t writable).', 500);
    }
    $n = count($r['saved']);
    $parts = [$n === 1 ? '1 lead saved' : $n . ' leads saved'];
    if ($r['duplicates']) {
        $parts[] = count($r['duplicates']) . ' already saved';
    }
    if ($r['suppressed']) {
        $parts[] = $r['suppressed'] . ' on the do-not-contact list';
    }
    if ($missing) {
        $parts[] = $missing . ' expired';
    }
    admin_json(['ok' => true, 'message' => implode(', ', $parts) . '.', 'saved' => $r['saved'], 'duplicates' => $r['duplicates']]);
}

/** A cached search row as lead fields (the cache already holds checked values; they are checked again on save). */
function finder_row_to_lead(array $row): array
{
    $src = ['osm' => 'osm', 'web' => 'web', 'ted' => 'tender'][$row['source'] ?? ''] ?? 'manual';
    return [
        'source' => $src,
        'name' => $row['name'] ?? '',
        'category' => $row['category'] ?? '',
        'city' => $row['city'] ?? '',
        'country' => $row['country'] ?? '',
        'address' => $row['address'] ?? '',
        'phone' => $row['phone'] ?? '',
        'email' => $row['email'] ?? '',
        'website' => $row['website'] ?? '',
        'website_status' => $row['website_status'] ?? 'unknown',
        'evidence_url' => $row['evidence_url'] ?? '',
        'social' => $row['social'] ?? [],
        'osm' => $row['osm'] ?? null,
        'tender' => $row['tender'] ?? null,
        'reasons' => isset($row['reason']) && $row['reason'] !== '' ? [$row['reason']] : [],
    ];
}

/** GET ?view=finder&tab=leads&export=csv: the leads that pass the filters, as CSV (spreadsheet formulas defused). */
function finder_export(array $get): never
{
    $f = finder_lead_filters($get);
    [$rows] = finder_leads_filtered($f);
    admin_send_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="evosoft-leads-' . gmdate('Ymd-Hi') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    foreach ($rows as $l) {
        if ($l['source'] === 'osm') {
            fputcsv($out, ['Contains OpenStreetMap data © OpenStreetMap contributors, under the Open Database License (ODbL 1.0): https://opendatacommons.org/licenses/odbl/1-0/ and https://www.openstreetmap.org/copyright. Private list: do not publish or share.'], ',', '"', '');
            break;
        }
    }
    fputcsv($out, ['Found (UTC)', 'Status', 'Source', 'Name', 'Type', 'City', 'Country', 'Address', 'Phone', 'Email', 'Website', 'Website status', 'Link',
        'OpenStreetMap', 'Tender', 'Deadline', 'Score', 'Reasons', 'Suggested pitch', 'Notes', 'Last changed (UTC)', 'Lead id'], ',', '"', '');
    foreach ($rows as $l) {
        $row = [str_replace(['T', 'Z'], [' ', ''], $l['found_at']), FINDER_STATUSES[$l['status']], FINDER_SOURCES[$l['source']], $l['name'], $l['category'], $l['city'],
            $l['country'] !== '' ? finder_country_name($l['country']) : '', $l['address'], $l['phone'], $l['email'], $l['website'], FINDER_WEB_STATUSES[$l['website_status']],
            $l['evidence_url'], finder_osm_url($l['osm']), $l['tender']['title'] ?? '', $l['tender']['deadline'] ?? '', $l['score'] ?? '',
            implode('; ', $l['reasons']), is_array($l['research']) ? (string)($l['research']['pitch'] ?? '') : '', $l['notes'],
            str_replace(['T', 'Z'], [' ', ''], $l['updated_at']), $l['id']];
        fputcsv($out, array_map('req_csv_cell', $row), ',', '"', '');
    }
    fclose($out);
    exit;
}
