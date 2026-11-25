<?php
/*
 * EvoSoft admin panel, client finder: the Local businesses tab. Two sources, each its own request from finder.js:
 *   - OpenStreetMap through the Overpass API (never Nominatim): named businesses of a type, in a city, with no
 *     website tag. The city is found by name with an Overpass area query inside the country's area.
 *     Fair use: about 80 queries and 10 MB a day in all, one query at a time, a 24-hour cache, an honest User-Agent,
 *     a pause after 429 and a day's stop after 406. Attribution "© OpenStreetMap contributors" wherever it's shown.
 *   - AI web search (ai.php).
 * © 2026 EvoSoft Solutions. All rights reserved.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

/**
 * Niches: label, the words for the AI search, and OpenStreetMap selectors [key, value]. A value starting with '~' is
 * a list of alternatives, matched exactly (the query builder anchors it, since Overpass regexes match anywhere).
 */
const FINDER_NICHES = [
    'dentists' => ['Dentists', 'dental clinics and dentists', [['amenity', 'dentist'], ['healthcare', 'dentist']]],
    'clinics' => ['Clinics and doctors', 'private medical clinics and doctors', [['amenity', 'clinic'], ['healthcare', 'clinic'], ['amenity', 'doctors'], ['healthcare', 'doctor']]],
    'restaurants' => ['Restaurants', 'restaurants', [['amenity', 'restaurant']]],
    'cafes' => ['Cafés', 'cafés and coffee shops', [['amenity', 'cafe']]],
    'hotels' => ['Hotels', 'hotels', [['tourism', '~hotel|motel']]],
    'guest_houses' => ['Guest houses', 'guest houses and hostels', [['tourism', '~guest_house|hostel|apartment|chalet']]],
    'beauty' => ['Beauty salons', 'beauty salons, nail and massage studios', [['shop', '~beauty|cosmetics|massage']]],
    'hairdressers' => ['Hairdressers', 'hairdressers and barbers', [['shop', 'hairdresser']]],
    'car_repair' => ['Car repair', 'car repair shops and garages', [['shop', '~car_repair|tyres'], ['craft', 'car_repair'], ['amenity', 'car_wash']]],
    'lawyers' => ['Lawyers', 'law firms, lawyers and notaries', [['office', '~lawyer|notary']]],
    'accountants' => ['Accountants', 'accountants and tax advisers', [['office', '~accountant|tax_advisor']]],
    'real_estate' => ['Real estate', 'real estate agencies', [['office', 'estate_agent'], ['shop', 'estate_agent']]],
    'gyms' => ['Gyms and fitness', 'gyms, fitness and yoga studios', [['leisure', '~fitness_centre|sports_centre'], ['sport', '~yoga|fitness']]],
    'schools' => ['Tutors and schools', 'private tutors, language, music and driving schools', [['amenity', '~language_school|music_school|driving_school|prep_school|dancing_school']]],
    'shops' => ['Shops', 'independent shops', [['shop', '~clothes|shoes|boutique|jewelry|gift|florist|furniture|interior_decoration|books|toys|sports|bakery|pastry']]],
    'wineries' => ['Wineries', 'wineries and wine cellars', [['craft', 'winery'], ['shop', 'wine'], ['tourism', 'wine_cellar']]],
    'tours' => ['Tour operators', 'tour operators and travel agencies', [['shop', 'travel_agency'], ['office', '~travel_agent|guide|tourism']]],
    'construction' => ['Construction', 'construction companies and builders', [['office', 'construction_company'], ['craft', '~builder|carpenter|electrician|plumber|roofer|hvac|tiler|window_construction']]],
];

/** Countries for local searches: ISO 3166-1 alpha-2 => name. */
const FINDER_COUNTRIES = [
    'GE' => 'Georgia', 'AM' => 'Armenia', 'AZ' => 'Azerbaijan', 'TR' => 'Türkiye', 'UA' => 'Ukraine', 'MD' => 'Moldova', 'KZ' => 'Kazakhstan',
    'UZ' => 'Uzbekistan', 'AE' => 'United Arab Emirates', 'IL' => 'Israel', 'CY' => 'Cyprus', 'GR' => 'Greece', 'BG' => 'Bulgaria', 'RO' => 'Romania',
    'PL' => 'Poland', 'LT' => 'Lithuania', 'LV' => 'Latvia', 'EE' => 'Estonia', 'CZ' => 'Czechia', 'SK' => 'Slovakia', 'HU' => 'Hungary',
    'DE' => 'Germany', 'AT' => 'Austria', 'CH' => 'Switzerland', 'NL' => 'Netherlands', 'BE' => 'Belgium', 'FR' => 'France', 'ES' => 'Spain',
    'PT' => 'Portugal', 'IT' => 'Italy', 'IE' => 'Ireland', 'GB' => 'United Kingdom', 'DK' => 'Denmark', 'SE' => 'Sweden', 'NO' => 'Norway',
    'FI' => 'Finland', 'US' => 'United States', 'CA' => 'Canada',
];

/** Keys that mean "has a website" (Overpass leaves these out already; checked again here). */
const FINDER_WEBSITE_KEYS = ['website', 'contact:website', 'url', 'contact:url', 'website:en', 'website:ka', 'website:ru', 'brand:website'];

/** The search form, checked: ['niche', 'other', 'city', 'country', 'max', 'label', 'words'] or an error string. */
function finder_local_input(array $post)
{
    $niche = is_string($post['niche'] ?? null) && (isset(FINDER_NICHES[$post['niche']]) || $post['niche'] === 'other') ? $post['niche'] : '';
    $other = finder_line($post['other'] ?? '', 60);
    $city = finder_line($post['city'] ?? '', 60);
    $country = is_string($post['country'] ?? null) && isset(FINDER_COUNTRIES[$post['country']]) ? $post['country'] : '';
    if ($niche === '') {
        return 'Choose a type of business.';
    }
    if ($niche === 'other' && mb_strlen($other) < 3) {
        return 'Type the kind of business you’re looking for (at least 3 letters).';
    }
    if ($niche === 'other' && !preg_match('/^[\p{L}\p{N}\p{M} &\'’,.\/-]+$/u', $other)) {
        return 'Use letters, numbers and spaces for the type of business.';
    }
    if (mb_strlen($city) < 2 || !preg_match('/^[\p{L}\p{M}][\p{L}\p{M} \'’-]*$/u', $city)) {
        return 'Type the city or town as it is written on the map: letters, spaces, hyphens and apostrophes only.';
    }
    if ($country === '') {
        return 'Choose a country.';
    }
    return [
        'niche' => $niche, 'other' => $other, 'city' => $city, 'country' => $country,
        'max' => finder_int($post['max'] ?? 30, 30, 1, 100),
        'label' => $niche === 'other' ? $other : FINDER_NICHES[$niche][0],
        'words' => $niche === 'other' ? $other : FINDER_NICHES[$niche][1],
    ];
}

// ---- OpenStreetMap (Overpass) ----

/** An Overpass QL string literal. */
function finder_ql_str(string $s): string
{
    return '"' . addcslashes($s, "\\\"") . '"';
}

/**
 * The whole search in one query: the country's area, the city's area(s) by name (name or name:en, as typed and in
 * Title Case; place=city/town/village or an administrative boundary), the city areas' tags (to tell "city not
 * found" from "nothing found"), then the named businesses of the niche in both areas with no website tag.
 */
function finder_osm_query(string $niche, string $city, string $country): string
{
    $variants = array_values(array_unique([$city, mb_convert_case($city, MB_CASE_TITLE, 'UTF-8')]));
    $q = "[out:json][timeout:20][maxsize:134217728];\n";
    $q .= 'area["ISO3166-1"=' . finder_ql_str($country) . '][admin_level="2"]->.country;' . "\n(\n";
    foreach ($variants as $v) {
        foreach (['name', 'name:en'] as $key) {
            $q .= '  area[' . finder_ql_str($key) . '=' . finder_ql_str($v) . '][place~"^(city|town|village)$"];' . "\n";
            $q .= '  area[' . finder_ql_str($key) . '=' . finder_ql_str($v) . '][boundary="administrative"];' . "\n";
        }
    }
    $q .= ")->.city;\n.city out tags;\n(\n";
    foreach (FINDER_NICHES[$niche][2] as [$k, $v]) {
        $f = str_starts_with($v, '~')
            ? '[' . finder_ql_str($k) . '~' . finder_ql_str('^(' . substr($v, 1) . ')$') . ']'
            : '[' . finder_ql_str($k) . '=' . finder_ql_str($v) . ']';
        $q .= '  nwr' . $f . '["name"][!"website"][!"contact:website"][!"url"](area.city)(area.country);' . "\n";
    }
    return $q . ");\nout tags center;";
}

/**
 * Runs one Overpass query within the budget. Returns ['elements' => [...], 'base' => timestamp] or an error string.
 */
function finder_overpass_run(string $ql)
{
    $u = finder_usage();
    if ($u['overpass_pause_until'] > time()) {
        $wait = $u['overpass_pause_until'] - time();
        return $u['overpass_pause_why'] . ' Try again ' . ($wait > 3600 ? 'tomorrow' : 'in ' . max(1, (int)ceil($wait / 60)) . ' minutes') . '.';
    }
    if ($u['overpass_bytes'] >= FINDER_OSM_DAILY_BYTES) {
        return 'Today’s OpenStreetMap allowance (10 MB) is used up. Searches already made stay available from the cache; new ones work again tomorrow (UTC).';
    }
    if (!finder_usage_take('overpass')) {
        return 'Today’s OpenStreetMap allowance (' . FINDER_OSM_DAILY . ' searches) is used up. It resets at midnight UTC.';
    }
    $lock = finder_lock('overpass');
    if ($lock === false) {
        return 'Another OpenStreetMap search is still running. Wait for it to finish, then try again.';
    }
    $r = finder_http('POST', finder_cfg()['overpass_url'], ['Content-Type: application/x-www-form-urlencoded', 'Accept: application/json',
        'Referer: https://evosoft.solutions/admin/'], http_build_query(['data' => $ql]), 50, 8 * 1024 * 1024);
    if (is_resource($lock)) {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
    finder_usage_take('overpass_bytes', max(0, $r['bytes'] ?: strlen($r['body'])), true);
    $st = $r['status'];
    if ($st === 406) {
        finder_overpass_pause(86400, 'The OpenStreetMap server refused this website’s requests (HTTP 406: blocked or an unrecognised User-Agent), so OpenStreetMap searches are paused for a day. Check finder_user_agent in the settings.');
        return 'The OpenStreetMap server refused the request (HTTP 406). Searches are paused for a day so it doesn’t get worse; check finder_user_agent in the settings.';
    }
    if ($st === 429) {
        finder_overpass_pause(60, 'The OpenStreetMap server is busy with requests from this server’s address (HTTP 429).');
        return 'The OpenStreetMap server is busy with requests from this server’s address (HTTP 429). Wait a minute, then try again.';
    }
    if ($st === 504) {
        return 'The OpenStreetMap server is too busy to take this search right now (HTTP 504). Try again in a few minutes.';
    }
    if ($r['error'] === 'too_large') {
        return 'That search returned too much data. Try a smaller town or a narrower type of business.';
    }
    if ($st === 0) {
        return $r['error'] === 'timeout' ? 'The OpenStreetMap server didn’t answer in time. Try again in a few minutes.' : 'Couldn’t reach the OpenStreetMap server. Try again later.';
    }
    if ($st === 400) {
        error_log('EvoSoft finder: Overpass 400: ' . substr(trim(strip_tags($r['body'])), 0, 300));
        return 'The OpenStreetMap server didn’t understand the search (HTTP 400). Try different words for the city.';
    }
    if ($st !== 200) {
        return 'The OpenStreetMap server answered with an error (HTTP ' . $st . '). Try again later.';
    }
    $j = json_decode($r['body'], true);
    if (!is_array($j) || !is_array($j['elements'] ?? null)) {
        return 'The OpenStreetMap server sent an answer that couldn’t be read. Try again later.';
    }
    if (is_string($j['remark'] ?? null) && stripos($j['remark'], 'runtime error') !== false) {
        error_log('EvoSoft finder: Overpass remark: ' . substr($j['remark'], 0, 300));
        return 'The OpenStreetMap search ran out of time or memory on the server. Try a smaller town or a narrower type of business.';
    }
    return ['elements' => $j['elements'], 'base' => finder_line($j['osm3s']['timestamp_osm_base'] ?? '', 30)];
}

/** One OSM element as a result row, or null (no name, has a website, a chain branch, not a business). */
function finder_osm_row(array $el, string $category, string $city, string $country): ?array
{
    $type = $el['type'] ?? '';
    $id = $el['id'] ?? null;
    $t = is_array($el['tags'] ?? null) ? $el['tags'] : [];
    if (!in_array($type, ['node', 'way', 'relation'], true) || !is_int($id) || $id <= 0) {
        return null;
    }
    foreach (FINDER_WEBSITE_KEYS as $k) {
        if (isset($t[$k]) && trim((string)$t[$k]) !== '') {
            return null;
        }
    }
    if (isset($t['brand']) || isset($t['brand:wikidata'])) {
        return null; // a branch of a chain: the chain has its own website
    }
    $pick = static function (array $keys) use ($t): string {
        foreach ($keys as $k) {
            if (is_string($t[$k] ?? null) && trim($t[$k]) !== '') {
                return trim($t[$k]);
            }
        }
        return '';
    };
    $name = finder_line($pick(['name']), 120);
    if ($name === '') {
        return null;
    }
    $alt = finder_line($pick(['name:en', 'int_name', 'name:latin']), 120);
    $addr = $pick(['addr:full']);
    if ($addr === '') {
        $street = trim($pick(['addr:street']) . ' ' . $pick(['addr:housenumber']));
        $addr = implode(', ', array_filter([$street, $pick(['addr:city']), $pick(['addr:postcode'])]));
    }
    $phone = '';
    foreach (['phone', 'contact:phone', 'mobile', 'contact:mobile'] as $k) {
        $p = finder_phone(explode(';', (string)($t[$k] ?? ''))[0]);
        if ($p !== '') {
            $phone = $p;
            break;
        }
    }
    $email = finder_email(explode(';', $pick(['email', 'contact:email']))[0]);
    $social = [];
    foreach (['contact:facebook', 'facebook', 'contact:instagram', 'instagram', 'contact:tiktok'] as $k) {
        $u = finder_url($t[$k] ?? '');
        if ($u !== '' && !in_array($u, $social, true)) {
            $social[] = $u;
        }
    }
    $reasons = [];
    $reasons[] = $social ? 'On the map with a social page but no website' : 'On the map with no website';
    if (isset($t['opening_hours'])) {
        $reasons[] = 'opening hours listed (likely active)';
    }
    return [
        'key' => 'osm:' . $type . '/' . $id,
        'source' => 'osm',
        'name' => $alt !== '' && $alt !== $name ? $name . ' (' . $alt . ')' : $name,
        'category' => $category,
        'city' => $city,
        'country' => $country,
        'address' => finder_line($addr, 200),
        'phone' => $phone,
        'email' => $email,
        'website' => '',
        'website_status' => $social ? 'social_only' : 'none',
        'evidence_url' => '',
        'social' => array_slice($social, 0, 3),
        'osm' => ['type' => $type, 'id' => (string)$id],
        'link' => 'https://www.openstreetmap.org/' . $type . '/' . $id,
        'reason' => implode('; ', $reasons),
        'quality' => ($phone !== '' ? 2 : 0) + ($email !== '' ? 2 : 0) + ($social ? 2 : 0) + (isset($t['opening_hours']) ? 1 : 0),
    ];
}

/** POST finder.local_osm */
function finder_action_local_osm(array $post): never
{
    $in = finder_local_input($post);
    if (is_string($in)) {
        finder_fail($in, 422);
    }
    if ($in['niche'] === 'other') {
        finder_fail('OpenStreetMap needs a type from the list (it searches by map tags). The AI web search can use your own words.', 422);
    }
    finder_long_request(75);
    $ql = finder_osm_query($in['niche'], $in['city'], $in['country']);
    $cached = finder_cache_get('osm', $ql);
    $fromCache = $cached !== null;
    if ($cached === null) {
        $res = finder_overpass_run($ql);
        if (is_string($res)) {
            finder_fail($res, 502);
        }
        $areas = 0;
        $rows = [];
        $chains = 0;
        foreach ($res['elements'] as $el) {
            if (!is_array($el)) {
                continue;
            }
            if (($el['type'] ?? '') === 'area') {
                $areas++;
                continue;
            }
            $row = finder_osm_row($el, $in['label'], $in['city'], $in['country']);
            if ($row === null) {
                $chains += isset($el['tags']['brand']) || isset($el['tags']['brand:wikidata']) ? 1 : 0;
                continue;
            }
            $rows[$row['key']] = $row;
        }
        $rows = array_values($rows);
        usort($rows, static fn(array $a, array $b): int => [$b['quality'], $a['name']] <=> [$a['quality'], $b['name']]);
        $data = ['rows' => $rows, 'areas' => $areas, 'chains' => $chains, 'base' => $res['base'], 'total' => count($rows)];
        $id = finder_cache_put('osm', $ql, $data);
        $cached = ['id' => $id, 'at' => time(), 'data' => $data];
    }
    $d = $cached['data'];
    if (($d['areas'] ?? 0) === 0) {
        finder_fail('“' . $in['city'] . '” wasn’t found as a city or town in ' . FINDER_COUNTRIES[$in['country']] . ' on OpenStreetMap. Check the spelling, or try its English or local name.', 404);
    }
    [$rows, $hidden] = finder_rows_for_page(array_slice($d['rows'] ?? [], 0, 1000));
    $total = count($rows);
    $rows = array_slice($rows, 0, $in['max']);
    $note = $total . ' found without a website on the map' . ($total > count($rows) ? ', showing the best ' . count($rows) : '')
        . (($d['chains'] ?? 0) ? '; ' . $d['chains'] . ' chain branches skipped' : '') . ($hidden ? '; ' . $hidden . ' on your do-not-contact list hidden' : '') . '.';
    admin_json(['ok' => true, 'source' => 'osm', 'search' => $cached['id'], 'rows' => $rows, 'note' => $note, 'cached' => $fromCache,
        'cachedAt' => gmdate('H:i', (int)$cached['at']) . ' UTC', 'attribution' => true, 'usage' => finder_usage_public()]);
}

/**
 * Rows ready for the page: anything on the do-not-contact list removed, each marked "saved" when it's already a
 * lead, and only the fields the page shows. Returns [rows, hidden count].
 */
function finder_rows_for_page(array $rows): array
{
    $hashes = finder_suppressed();
    $saved = finder_saved_keys();
    $out = [];
    $hidden = 0;
    foreach ($rows as $r) {
        if (!is_array($r) || !isset($r['key'])) {
            continue;
        }
        if (finder_is_suppressed($r, $hashes)) {
            $hidden++;
            continue;
        }
        $lead = null;
        foreach (finder_lead_keys($r) as $k) {
            if (isset($saved[$k])) {
                $lead = $saved[$k];
                break;
            }
        }
        $r['saved'] = $lead;
        unset($r['quality'], $r['osm']);
        $out[] = $r;
    }
    return [$out, $hidden];
}

/** POST finder.local_ai */
function finder_action_local_ai(array $post): never
{
    $in = finder_local_input($post);
    if (is_string($in)) {
        finder_fail($in, 422);
    }
    if (!finder_ai_ready()) {
        finder_fail('AI web search isn’t set up: add anthropic_api_key to the settings file.', 503);
    }
    finder_long_request(120);
    $max = min(20, $in['max']);
    $key = implode('|', [$in['niche'], mb_strtolower($in['words']), mb_strtolower($in['city']), $in['country'], $max]);
    $cached = finder_cache_get('web', $key);
    $fromCache = $cached !== null;
    if ($cached === null) {
        $res = finder_ai_local_search($in['words'], $in['label'], $in['city'], $in['country'], $max);
        if (is_string($res)) {
            finder_fail($res, 502);
        }
        $id = finder_cache_put('web', $key, $res);
        $cached = ['id' => $id, 'at' => time(), 'data' => $res];
    }
    $d = $cached['data'];
    [$rows, $hidden] = finder_rows_for_page($d['rows'] ?? []);
    $n = count($rows);
    $note = ($n === 1 ? '1 business' : $n . ' businesses') . ' found by AI web search' . (($d['dropped'] ?? 0) ? '; ' . $d['dropped'] . ' left out (incomplete or not valid)' : '')
        . ($hidden ? '; ' . $hidden . ' on your do-not-contact list hidden' : '') . (!empty($d['partial']) ? '. The search stopped early, so there may be more' : '') . '.';
    admin_json(['ok' => true, 'source' => 'web', 'search' => $cached['id'], 'rows' => $rows, 'note' => $note, 'cached' => $fromCache,
        'cachedAt' => gmdate('H:i', (int)$cached['at']) . ' UTC', 'usage' => finder_usage_public()]);
}

/** Today's usage as the page shows it. */
function finder_usage_public(): array
{
    $u = finder_usage();
    return ['ai' => $u['ai'], 'aiLimit' => finder_limit('ai'), 'overpass' => $u['overpass'], 'overpassLimit' => FINDER_OSM_DAILY,
        'overpassMb' => round($u['overpass_bytes'] / 1048576, 1), 'ted' => $u['ted'], 'tedLimit' => FINDER_TED_DAILY];
}

function finder_usage_html(): string
{
    $u = finder_usage_public();
    return '<p class="usage small muted" id="finder-usage">Used today (UTC): AI searches <span data-u="ai">' . $u['ai'] . '</span> of ' . $u['aiLimit']
        . ' · OpenStreetMap <span data-u="overpass">' . $u['overpass'] . '</span> of ' . $u['overpassLimit'] . ' (<span data-u="overpassMb">' . $u['overpassMb'] . '</span> of 10 MB)'
        . ' · TED <span data-u="ted">' . $u['ted'] . '</span> of ' . $u['tedLimit'] . '</p>';
}

/** The Local businesses tab. */
function finder_local_view(): string
{
    $ai = finder_ai_ready();
    $niches = '';
    foreach (FINDER_NICHES as $k => $n) {
        $niches .= '<option value="' . $k . '">' . admin_h($n[0]) . '</option>';
    }
    $niches .= '<option value="other">Other (type it)</option>';
    $countries = '';
    foreach (FINDER_COUNTRIES as $code => $name) {
        $countries .= '<option value="' . $code . '"' . ($code === 'GE' ? ' selected' : '') . '>' . admin_h($name) . '</option>';
    }
    $html = '<section class="card" aria-labelledby="h-local"><h2 id="h-local">Find local businesses</h2>'
        . '<p class="muted">Businesses with no website, only a social page, or a weak one. Choose a type and a place; each source runs in turn.</p>'
        . '<form id="local-form" class="finder-form" method="post" action="' . admin_h(admin_url(['action' => 'finder.local_osm'])) . '" novalidate>' . admin_csrf_field()
        . '<div class="form-grid">'
        . '<div class="field"><label for="l-niche">Type of business</label><select id="l-niche" name="niche">' . $niches . '</select></div>'
        . '<div class="field" id="l-other-field" hidden><label for="l-other">Which kind?</label><input id="l-other" name="other" type="text" maxlength="60" aria-describedby="l-other-hint"><p class="hint" id="l-other-hint">E.g. “yoga studios”. OpenStreetMap only searches the types in the list.</p></div>'
        . '<div class="field"><label for="l-city">City or town</label><input id="l-city" name="city" type="text" required maxlength="60" autocomplete="off" aria-describedby="l-city-hint l-city-error">'
        . '<p class="hint" id="l-city-hint">As it’s written on the map, e.g. Tbilisi, Batumi, Kutaisi.</p><p class="field-error" id="l-city-error" hidden></p></div>'
        . '<div class="field"><label for="l-country">Country</label><select id="l-country" name="country">' . $countries . '</select></div>'
        . '<div class="field"><label for="l-max">Most results</label><input id="l-max" name="max" type="number" min="1" max="100" value="30" inputmode="numeric" aria-describedby="l-max-hint"><p class="hint" id="l-max-hint">1 to 100 (AI search: up to 20).</p></div>'
        . '</div>'
        . '<fieldset class="checks"><legend>Sources</legend>'
        . '<div class="check"><input type="checkbox" id="l-src-osm" name="src_osm" value="1" checked><label for="l-src-osm">OpenStreetMap <span class="muted">(free map data: businesses whose map entry has no website)</span></label></div>'
        . '<div class="check"><input type="checkbox" id="l-src-ai" name="src_ai" value="1"' . ($ai ? ' checked' : ' disabled') . '><label for="l-src-ai">AI web search <span class="muted">'
        . ($ai ? '(one of today’s ' . finder_limit('ai') . ' AI calls, sometimes two; about a minute)' : '(needs anthropic_api_key in the settings file)') . '</span></label></div>'
        . '</fieldset>'
        . '<p class="field-error" id="l-form-error" hidden></p>'
        . '<div class="row-actions"><button class="btn primary" type="submit" hidden>Find businesses</button></div>'
        . '<noscript><p class="flash flash-error">The search needs JavaScript, which is off in this browser.</p></noscript>'
        . '</form></section>'
        . finder_results_shell('local', 'Results', true);
    return $html . finder_usage_html();
}

/**
 * The (empty) results area that finder.js fills: progress lines, a table and a "Save selected" button.
 * $kind is local or ted.
 */
function finder_results_shell(string $kind, string $title, bool $osm): string
{
    $cols = $kind === 'ted'
        ? '<th scope="col"><span class="sr-only">Select</span></th><th scope="col">Tender</th><th scope="col">Buyer</th><th scope="col">Deadline</th><th scope="col">Estimated value</th><th scope="col">Notice</th>'
        : '<th scope="col"><span class="sr-only">Select</span></th><th scope="col">Business</th><th scope="col">Address</th><th scope="col">Phone</th><th scope="col">Online</th><th scope="col">Source</th><th scope="col">Link</th>';
    return '<section class="card results" id="' . $kind . '-results" aria-labelledby="h-' . $kind . '-results" hidden>'
        . '<h2 id="h-' . $kind . '-results" tabindex="-1">' . admin_h($title) . '</h2>'
        . '<ul class="progress" id="' . $kind . '-progress"></ul>'
        . '<div class="results-body" id="' . $kind . '-body" hidden>'
        . '<div class="results-tools"><div class="check"><input type="checkbox" id="' . $kind . '-all"><label for="' . $kind . '-all">Select all</label></div>'
        . '<button type="button" class="btn primary" id="' . $kind . '-save">Save selected to leads</button><span class="row-state" id="' . $kind . '-save-state"></span></div>'
        . '<div class="table-wrap"><table class="list results-table"><caption class="sr-only">' . admin_h($title) . '</caption><thead><tr>' . $cols . '</tr></thead><tbody id="' . $kind . '-rows"></tbody></table></div>'
        . ($osm ? '<div id="' . $kind . '-osm-credit" hidden>' . finder_osm_credit() . '</div>' : '')
        . '</div></section>';
}
