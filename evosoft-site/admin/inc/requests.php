<?php
/*
 * EvoSoft admin panel: quote requests (the list, one request, status and notes, delete, CSV).
 * © 2026 EvoSoft Solutions. All rights reserved.
 *
 * Requests come from api/quote.php (evosoft-data/quotes.jsonl); the panel's status and notes live in quote-meta.json.
 * Both are read and written through the helpers in api/lib.php (evo_quotes_all, evo_quote_meta_update,
 * evo_quote_delete), which lock the files the same way quote.php does.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

const ADMIN_PER_PAGE = 25;
const ADMIN_STATUS_LABELS = ['new' => 'New', 'contacted' => 'Contacted', 'quoted' => 'Quoted', 'won' => 'Won', 'lost' => 'Lost'];
const ADMIN_SOURCE_LABELS = ['estimate' => 'Quote builder', 'contact' => 'Contact form'];
const ADMIN_LANGS = ['en' => 'English', 'es' => 'Spanish', 'ka' => 'Georgian', 'ru' => 'Russian'];

/** The filters from the address: status, source, q (search) and page, made safe. */
function req_filters(array $get): array
{
    $status = is_string($get['status'] ?? null) && isset(ADMIN_STATUS_LABELS[$get['status']]) ? $get['status'] : '';
    $source = is_string($get['source'] ?? null) && isset(ADMIN_SOURCE_LABELS[$get['source']]) ? $get['source'] : '';
    $q = is_string($get['q'] ?? null) ? evo_clean_line($get['q'], 100) : '';
    $page = is_string($get['page'] ?? null) && ctype_digit($get['page']) ? max(1, min(100000, (int)$get['page'])) : 1;
    return ['status' => $status, 'source' => $source, 'q' => $q, 'page' => $page];
}

/** Every request, newest first, each with its status and notes ('meta'). */
function req_all(): array
{
    $meta = evo_quote_meta_all();
    $rows = [];
    foreach (array_reverse(evo_quotes_all()) as $q) {
        $q['meta'] = evo_quote_meta($meta, $q['id']);
        $rows[] = $q;
    }
    usort($rows, static fn(array $a, array $b): int => strcmp($b['when'], $a['when'])); // stable: same minute keeps newest first
    return $rows;
}

/** The design of a request, made safe again (the file could have been edited by hand), or null. */
function req_design(array $q): ?array
{
    if (!is_array($q['design'])) {
        return null;
    }
    $d = evo_normalise_design($q['design']);
    return $d !== [] ? $d : null;
}

/** "What": the website type for the quote builder, otherwise what they ticked. */
function req_what(array $q): string
{
    $d = req_design($q);
    if ($d !== null) {
        return evo_label('types', $d['type']);
    }
    return $q['types'] ? implode(', ', $q['types']) : 'Not specified';
}

function req_range(array $q): string
{
    $e = $q['estimate'];
    if (!is_array($e) || !isset($e['low'], $e['high'])) {
        return '';
    }
    return evo_money((int)$e['low']) . '–' . evo_money((int)$e['high']);
}

/** Search: every word must appear in the name, email, company, message, phone or business name. */
function req_matches(array $q, string $search): bool
{
    if ($search === '') {
        return true;
    }
    $hay = implode("\n", [$q['name'], $q['email'], $q['company'], $q['message'], $q['phone'], (string)(req_design($q)['business']['name'] ?? '')]);
    foreach (preg_split('/\s+/u', $search) ?: [] as $word) {
        if ($word !== '' && mb_stripos($hay, $word) === false) {
            return false;
        }
    }
    return true;
}

/** The requests that pass the filters, and the count per status (with the other filters applied). */
function req_filtered(array $f): array
{
    $counts = array_fill_keys(array_keys(ADMIN_STATUS_LABELS), 0);
    $all = 0;
    $rows = [];
    foreach (req_all() as $q) {
        if (($f['source'] !== '' && $q['source'] !== $f['source']) || !req_matches($q, $f['q'])) {
            continue;
        }
        $counts[$q['meta']['status']]++;
        $all++;
        if ($f['status'] === '' || $q['meta']['status'] === $f['status']) {
            $rows[] = $q;
        }
    }
    return [$rows, $counts, $all];
}

function req_badge(string $status): string
{
    $status = isset(ADMIN_STATUS_LABELS[$status]) ? $status : 'new';
    return '<span class="badge st-' . $status . '">' . admin_h(ADMIN_STATUS_LABELS[$status]) . '</span>';
}

/** '2026-11-25 20:04 UTC' as a <time>. */
function req_time(string $when): string
{
    if (preg_match('/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})/', $when, $m)) {
        return '<time datetime="' . $m[1] . 'T' . $m[2] . 'Z">' . admin_h($m[1]) . ' <span class="muted">' . admin_h($m[2]) . '</span></time>';
    }
    return admin_h($when !== '' ? $when : '—');
}

/** The requests list. */
function req_list_view(array $get): string
{
    $f = req_filters($get);
    [$rows, $counts, $all] = req_filtered($f);
    $pages = max(1, (int)ceil(count($rows) / ADMIN_PER_PAGE));
    $page = min($f['page'], $pages);
    $shown = array_slice($rows, ($page - 1) * ADMIN_PER_PAGE, ADMIN_PER_PAGE);
    $keep = ['source' => $f['source'], 'q' => $f['q']];

    $html = '<div class="page-head row"><div><h1>Requests</h1><p class="muted">Quote requests from the website, newest first.</p></div>'
        . '<a class="btn" href="' . admin_h(admin_url(['view' => 'export', 'status' => $f['status']] + $keep)) . '" download>Download CSV<span class="sr-only"> of the requests shown</span></a></div>';
    if (is_string($_SESSION['rehash'] ?? null)) {
        $html .= '<p class="flash flash-ok" role="status">Your password line can be made stronger. <a href="' . admin_h(admin_url(['view' => 'security'])) . '">See Security</a>.</p>';
    }

    // the status tabs, with counts
    $html .= '<nav class="tabs" aria-label="Status"><ul>';
    $tabs = ['' => ['All', $all]];
    foreach (ADMIN_STATUS_LABELS as $k => $label) {
        $tabs[$k] = [$label, $counts[$k]];
    }
    foreach ($tabs as $k => [$label, $n]) {
        $html .= '<li><a href="' . admin_h(admin_url(['status' => $k] + $keep)) . '"' . ($k === $f['status'] ? ' aria-current="page"' : '') . '>'
            . admin_h($label) . ' <span class="count">' . $n . '</span></a></li>';
    }
    $html .= '</ul></nav>';

    // search and filters (a GET form: it only changes what's shown)
    $html .= '<form class="filters" method="get" action="' . admin_h(admin_base()) . '" role="search" aria-label="Filter the requests">'
        . '<div class="field grow"><label for="f-q">Search</label><input id="f-q" name="q" type="search" value="' . admin_h($f['q']) . '" maxlength="100" placeholder="Name, email, company or message"></div>'
        . '<div class="field"><label for="f-status">Status</label><select id="f-status" name="status"><option value="">All</option>';
    foreach (ADMIN_STATUS_LABELS as $k => $label) {
        $html .= '<option value="' . $k . '"' . ($k === $f['status'] ? ' selected' : '') . '>' . admin_h($label) . '</option>';
    }
    $html .= '</select></div><div class="field"><label for="f-source">From</label><select id="f-source" name="source"><option value="">Anywhere</option>';
    foreach (ADMIN_SOURCE_LABELS as $k => $label) {
        $html .= '<option value="' . $k . '"' . ($k === $f['source'] ? ' selected' : '') . '>' . admin_h($label) . '</option>';
    }
    $html .= '</select></div><div class="filter-actions"><button class="btn primary" type="submit">Show</button>'
        . (($f['q'] !== '' || $f['status'] !== '' || $f['source'] !== '') ? '<a class="btn plain" href="' . admin_h(admin_url()) . '">Clear</a>' : '') . '</div></form>';

    $found = count($rows);
    $html .= '<p class="summary" role="status">' . ($found === 1 ? '1 request' : $found . ' requests')
        . ($found > ADMIN_PER_PAGE ? ', page ' . $page . ' of ' . $pages : '') . '</p>';
    if (!$shown) {
        $html .= '<div class="card empty"><p>' . ($all === 0 && $f['q'] === '' && $f['source'] === '' ? 'No requests yet. They appear here as soon as someone sends the quote form or the quote builder.' : 'No requests match these filters.') . '</p></div>';
        return $html;
    }
    $html .= '<div class="table-wrap"><table class="list"><caption class="sr-only">Quote requests' . ($found > ADMIN_PER_PAGE ? ', page ' . $page . ' of ' . $pages : '') . '</caption><thead><tr>'
        . '<th scope="col">Date (UTC)</th><th scope="col">Name</th><th scope="col">Company</th><th scope="col">Email</th><th scope="col">What</th><th scope="col">Estimate</th><th scope="col">Status</th></tr></thead><tbody>';
    foreach ($shown as $q) {
        $name = $q['name'] !== '' ? $q['name'] : '(no name)';
        $range = req_range($q);
        $html .= '<tr>'
            . '<td data-label="Date">' . req_time($q['when']) . '</td>'
            . '<th scope="row" data-label="Name"><a href="' . admin_h(admin_url(['r' => $q['id']])) . '">' . admin_h($name) . '</a>'
            . '<span class="src">' . admin_h(ADMIN_SOURCE_LABELS[$q['source']]) . '</span></th>'
            . '<td data-label="Company">' . ($q['company'] !== '' ? admin_h($q['company']) : '<span class="muted">—</span>') . '</td>'
            . '<td data-label="Email" class="email">' . admin_h($q['email']) . '</td>'
            . '<td data-label="What">' . admin_h(req_what($q)) . '</td>'
            . '<td data-label="Estimate" class="num">' . ($range !== '' ? admin_h($range) : '<span class="muted">—</span>') . '</td>'
            . '<td data-label="Status">' . req_badge($q['meta']['status']) . '</td>'
            . '</tr>';
    }
    $html .= '</tbody></table></div>';
    if ($pages > 1) {
        $html .= '<nav class="pager" aria-label="Pages">';
        $html .= $page > 1 ? '<a class="btn" href="' . admin_h(admin_url(['status' => $f['status'], 'page' => $page - 1] + $keep)) . '" rel="prev">← Newer</a>' : '<span></span>';
        $html .= '<span class="muted">Page ' . $page . ' of ' . $pages . '</span>';
        $html .= $page < $pages ? '<a class="btn" href="' . admin_h(admin_url(['status' => $f['status'], 'page' => $page + 1] + $keep)) . '" rel="next">Older →</a>' : '<span></span>';
        $html .= '</nav>';
    }
    return $html;
}

/** One request: everything it holds, the design and its preview, the estimate, status and notes, reply, delete. */
function req_detail_view(array $q): string
{
    $id = $q['id'];
    $m = $q['meta'];
    $name = $q['name'] !== '' ? $q['name'] : '(no name)';
    $design = req_design($q);
    $est = is_array($q['estimate']) ? $q['estimate'] : null;

    $html = '<p class="back"><a href="' . admin_h(admin_url()) . '">← All requests</a></p>'
        . '<div class="page-head"><h1>' . admin_h($name) . '</h1><p class="meta-line">' . req_time($q['when']) . ' · ' . admin_h(ADMIN_SOURCE_LABELS[$q['source']])
        . ' · ' . req_badge($m['status']) . '</p></div><div class="detail">';

    // contact details and reply
    $rows = [['Email', '<a href="mailto:' . admin_h(str_replace('%40', '@', rawurlencode($q['email']))) . '">' . admin_h($q['email']) . '</a>']];
    if ($q['phone'] !== '') {
        $digits = preg_replace('/[^0-9+]/', '', $q['phone']) ?? '';
        $rows[] = ['Phone', $digits !== '' ? '<a href="tel:' . admin_h($digits) . '">' . admin_h($q['phone']) . '</a>' : admin_h($q['phone'])];
    }
    if ($q['company'] !== '') {
        $rows[] = ['Company', admin_h($q['company'])];
    }
    $rows[] = ['Language', admin_h(ADMIN_LANGS[$q['lang']] ?? ($q['lang'] !== '' ? $q['lang'] : 'English'))];
    if ($q['source'] === 'contact' || $q['types']) {
        $rows[] = ['Needs', admin_h($q['types'] ? implode(', ', $q['types']) : 'Not specified')];
    }
    if ($q['source'] === 'contact' && $q['timeline'] !== '') {
        $rows[] = ['Timeline', admin_h($q['timeline'])];
    }
    $rows[] = ['Sent', admin_h($q['when'])];
    $rows[] = ['Request id', '<code>' . admin_h($id) . '</code>'];
    $subject = $design !== null ? 'Your ' . strtolower(evo_label('types', $design['type'])) . ' with EvoSoft' : 'Your request to EvoSoft';
    $mailto = 'mailto:' . str_replace('%40', '@', rawurlencode($q['email'])) . '?subject=' . rawurlencode($subject);
    $html .= '<section class="card" aria-labelledby="h-contact"><h2 id="h-contact">Contact</h2>' . req_dl($rows)
        . '<p><a class="btn primary" href="' . admin_h($mailto) . '">Reply by email</a></p></section>';

    // status and notes
    $html .= '<section class="card" aria-labelledby="h-status"><h2 id="h-status">Status and notes</h2>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'save', 'r' => $id])) . '" class="stack">' . admin_csrf_field()
        . '<div class="field"><label for="status">Status</label><select id="status" name="status">';
    foreach (ADMIN_STATUS_LABELS as $k => $label) {
        $html .= '<option value="' . $k . '"' . ($k === $m['status'] ? ' selected' : '') . '>' . admin_h($label) . '</option>';
    }
    $html .= '</select></div><div class="field"><label for="notes">Notes <span class="muted">(only you see them; deleted with the request)</span></label>'
        . '<textarea id="notes" name="notes" rows="6" maxlength="5000">' . admin_h($m['notes']) . '</textarea></div>'
        . '<div class="row-actions"><button class="btn primary" type="submit">Save</button>'
        . ($m['updated_at'] !== '' ? '<span class="muted small">Last saved ' . admin_h($m['updated_at']) . '</span>' : '') . '</div></form></section>';

    // message
    $html .= '<section class="card wide" aria-labelledby="h-msg"><h2 id="h-msg">Message</h2>'
        . ($q['message'] !== '' ? '<div class="message">' . nl2br(admin_h($q['message']), false) . '</div>' : '<p class="muted">No message.</p>') . '</section>';

    if ($design !== null) {
        $drows = array_map(static fn(array $r): array => [$r[0], admin_h($r[1])], evo_design_rows($design));
        $html .= '<section class="card wide" aria-labelledby="h-design"><h2 id="h-design">Website design</h2>' . req_dl($drows) . '</section>';
        // the live preview: assets/js/site-preview.js from the public site draws it (admin.js calls EvoPreview.render)
        $json = json_encode($design, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE);
        $html .= '<section class="card wide" aria-labelledby="h-preview"><h2 id="h-preview">Preview</h2>'
            . '<p class="muted small">How the visitor saw their design, drawn again from the choices above.</p>'
            . '<div class="preview-host" id="preview" aria-hidden="true"></div>'
            . '<p class="preview-missing muted" id="preview-missing" hidden>The preview isn’t available right now (the website’s preview script didn’t load). The choices above are the whole design.</p>'
            . '<script type="application/json" id="design-data">' . $json . '</script></section>';
    }
    if ($est !== null && $design !== null) {
        $html .= req_estimate_html($est, $design);
    }

    // delete
    $html .= '<section class="card wide danger" aria-labelledby="h-delete"><h2 id="h-delete">Delete this request</h2>'
        . '<p>Deletes the request and your notes from the website for good, for example when the person asks to be forgotten. '
        . 'The email copy stays in the mailbox: delete that by hand too.</p>'
        . '<form method="post" action="' . admin_h(admin_url(['action' => 'delete', 'r' => $id])) . '" class="stack">' . admin_csrf_field()
        . '<div class="check"><input type="checkbox" id="confirm" name="confirm" value="yes" required><label for="confirm">Yes, delete the request from ' . admin_h($name) . ' for good</label></div>'
        . '<div><button class="btn danger" type="submit">Delete request</button></div></form></section>';
    return $html . '</div>';
}

/** $rows of [label, html] as a description list. */
function req_dl(array $rows): string
{
    $html = '<dl class="facts">';
    foreach ($rows as [$label, $value]) {
        $html .= '<div><dt>' . admin_h($label) . '</dt><dd>' . $value . '</dd></div>';
    }
    return $html . '</dl>';
}

/** The estimate saved with the request (worked out on the server when it was sent), and today's if prices changed. */
function req_estimate_html(array $est, array $design): string
{
    $weeks = is_array($est['weeks'] ?? null) ? $est['weeks'] : [0, 0];
    $html = '<section class="card wide" aria-labelledby="h-est"><h2 id="h-est">Estimate</h2>'
        . '<dl class="facts big"><div><dt>Estimated price</dt><dd>' . admin_h(evo_money((int)($est['low'] ?? 0)) . ' – ' . evo_money((int)($est['high'] ?? 0))) . '</dd></div>'
        . '<div><dt>Care plan</dt><dd>' . ((int)($est['monthly'] ?? 0) > 0 ? admin_h(evo_money((int)$est['monthly'])) . ' a month' : 'None') . '</dd></div>'
        . '<div><dt>Time</dt><dd>about ' . (int)($weeks[0] ?? 0) . '–' . (int)($weeks[1] ?? 0) . ' weeks</dd></div></dl>'
        . '<table class="breakdown"><caption>Breakdown</caption><thead><tr><th scope="col">Item</th><th scope="col" class="num">Amount</th></tr></thead><tbody>';
    foreach ((array)($est['lines'] ?? []) as $line) {
        if (!is_array($line)) {
            continue;
        }
        $html .= '<tr><td>' . admin_h(evo_estimate_line_label($line, $design)) . '</td><td class="num">' . admin_h(evo_money((int)($line['amount'] ?? 0))) . '</td></tr>';
    }
    $html .= '</tbody><tfoot><tr><th scope="row">Total</th><td class="num">' . admin_h(evo_money((int)($est['total'] ?? 0))) . '</td></tr></tfoot></table>'
        . '<p class="muted small">Worked out by the server from the price list when the request was sent; the visitor saw the same range. It is not an offer: your written quote is.</p>';
    $pricing = evo_pricing();
    if ($pricing !== []) {
        $now = evo_estimate($design, $pricing);
        if ($now !== [] && ((int)$now['total'] !== (int)($est['total'] ?? 0) || (int)$now['monthly'] !== (int)($est['monthly'] ?? 0))) {
            $html .= '<p class="flash flash-ok">With today’s prices it would be ' . admin_h(evo_money((int)$now['low']) . ' – ' . evo_money((int)$now['high']))
                . ' (total ' . admin_h(evo_money((int)$now['total'])) . ')' . ((int)$now['monthly'] > 0 ? ', care ' . admin_h(evo_money((int)$now['monthly'])) . ' a month' : '') . '.</p>';
        }
    }
    return $html . '</section>';
}

/** POST ?action=save&r=<id>: status and notes. */
function req_save(string $id): never
{
    $status = $_POST['status'] ?? '';
    $notes = $_POST['notes'] ?? '';
    $changes = [];
    if (is_string($status) && isset(ADMIN_STATUS_LABELS[$status])) {
        $changes['status'] = $status;
    }
    if (is_string($notes)) {
        $changes['notes'] = $notes;
    }
    if ($id === '' || !evo_quote_meta_update($id, $changes)) {
        admin_redirect($id !== '' ? ['r' => $id] : [], 'That request wasn’t found (it may have been deleted), or the change couldn’t be saved.', 'error');
    }
    admin_redirect(['r' => $id], 'Saved.');
}

/** POST ?action=delete&r=<id>, with the confirmation box ticked. */
function req_delete(string $id): never
{
    if (($_POST['confirm'] ?? '') !== 'yes') {
        admin_redirect(['r' => $id], 'Nothing was deleted: tick the box to confirm first.', 'error');
    }
    if ($id === '' || !evo_quote_delete($id)) {
        admin_redirect([], 'That request wasn’t found, so nothing was deleted.', 'error');
    }
    admin_redirect([], 'The request was deleted for good.');
}

/** A CSV cell that spreadsheet apps can't run as a formula. */
function req_csv_cell($v): string
{
    $s = is_string($v) ? $v : (is_scalar($v) ? (string)$v : '');
    return $s !== '' && strpbrk($s[0], "=+-@\t\r\n") !== false ? "'" . $s : $s;
}

/** GET ?view=export: the requests that pass the current filters, as a CSV file (UTF-8, for Excel too). */
function req_export(array $get): never
{
    $f = req_filters($get);
    [$rows] = req_filtered($f);
    admin_send_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="evosoft-requests-' . gmdate('Ymd-Hi') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF");
    $head = ['Date (UTC)', 'Status', 'From', 'Name', 'Email', 'Phone', 'Company', 'Language', 'What', 'Business', 'Pages', 'Features',
        'Estimate low (USD)', 'Estimate high (USD)', 'Total (USD)', 'Care per month (USD)', 'Weeks', 'Timeline', 'Message', 'Notes', 'Notes saved', 'Request id'];
    fputcsv($out, $head, ',', '"', '');
    foreach ($rows as $q) {
        $d = req_design($q);
        $e = is_array($q['estimate']) ? $q['estimate'] : null;
        $weeks = $e && is_array($e['weeks'] ?? null) ? (int)$e['weeks'][0] . '-' . (int)$e['weeks'][1] : '';
        $row = [
            $q['when'], ADMIN_STATUS_LABELS[$q['meta']['status']], ADMIN_SOURCE_LABELS[$q['source']], $q['name'], $q['email'], $q['phone'], $q['company'],
            ADMIN_LANGS[$q['lang']] ?? $q['lang'], req_what($q),
            $d ? trim($d['business']['name'] . ' (' . evo_label('industries', $d['business']['industry']) . ')') : '',
            $d ? implode(', ', array_map(static fn($p) => evo_label('pages', $p), $d['pages'])) . ($d['extraPages'] ? ' +' . $d['extraPages'] : '') : '',
            $d ? implode(', ', array_map(static fn($x) => evo_label('features', $x), $d['features'])) : '',
            $e ? (int)$e['low'] : '', $e ? (int)$e['high'] : '', $e ? (int)$e['total'] : '', $e ? (int)$e['monthly'] : '', $weeks,
            $d ? evo_label('timeline', $d['timeline']) : $q['timeline'], $q['message'], $q['meta']['notes'], $q['meta']['updated_at'], $q['id'],
        ];
        fputcsv($out, array_map('req_csv_cell', $row), ',', '"', '');
    }
    fclose($out);
    exit;
}
