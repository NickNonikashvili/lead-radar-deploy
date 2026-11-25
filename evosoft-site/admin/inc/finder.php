<?php
/*
 * EvoSoft admin panel: the client finder (?view=finder), for the owner only, in English.
 * © 2026 EvoSoft Solutions. All rights reserved.
 *
 * Tabs (?view=finder&tab=…):
 *   local    Local businesses with no or a weak website: OpenStreetMap (Overpass) and AI web search.
 *   leads    Saved leads: status, notes, AI research, a draft first email (never sent from here), do not contact,
 *            delete, CSV export (&export=csv). One lead: &lead=<id>.
 *   upwork   Upwork job postings through Upwork's official API (OAuth 2.0), when a key is configured.
 *   tenders  EU tenders from TED, and a link to Georgia's e-procurement portal.
 * Scripts (assets/finder.js) run each long step as its own POST ?action=finder.<name> with the CSRF token and get
 * JSON back; the forms that change one lead also work without scripts. index.php has already checked the session and
 * the CSRF token before finder_action() runs (see the internal API at the top of core.php).
 * Code: inc/finder/common.php (settings, files, budgets, cache, HTTP), leads.php, local.php, ai.php, tenders.php,
 * upwork.php. Clean-up of old leads and cache: evo_finder_housekeeping() in api/lib.php.
 */

declare(strict_types=1);

if (!defined('EVO_ADMIN')) {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/finder/common.php';
require_once __DIR__ . '/finder/leads.php';
require_once __DIR__ . '/finder/local.php';
require_once __DIR__ . '/finder/ai.php';
require_once __DIR__ . '/finder/tenders.php';
require_once __DIR__ . '/finder/upwork.php';

const FINDER_TABS = ['local' => 'Local businesses', 'leads' => 'Leads', 'upwork' => 'Upwork', 'tenders' => 'Tenders'];

/** The finder's own stylesheet and script (versioned like admin.css and admin.js). */
function finder_assets(): void
{
    $dir = dirname(__DIR__) . '/assets/';
    foreach (['css' => 'finder.css', 'js' => 'finder.js'] as $type => $file) {
        $url = admin_asset_url($dir . $file, admin_base() . 'assets/' . $file);
        if ($url !== null) {
            admin_add_asset($type, $url);
        }
    }
}

/** The page title, the tabs and the outreach rules, above every finder page. */
function finder_header(string $tab): string
{
    $n = count(finder_leads_all());
    $html = '<div class="page-head"><h1>Client finder</h1><p class="muted">Find businesses that could use a website and keep track of them. Private: only you can see this.</p></div>'
        . '<nav class="tabs finder-tabs" aria-label="Client finder"><ul>';
    foreach (FINDER_TABS as $k => $label) {
        $html .= '<li><a href="' . admin_h(admin_url(['view' => 'finder', 'tab' => $k])) . '"' . ($k === $tab ? ' aria-current="page"' : '') . '>' . admin_h($label)
            . ($k === 'leads' ? ' <span class="count">' . $n . '</span>' : '') . '</a></li>';
    }
    $html .= '</ul></nav>'
        . '<section class="compliance" aria-labelledby="h-rules"><h2 id="h-rules">Before you reach out</h2><ul>'
        . '<li>Business contacts only. Every first email says where you found their details and offers an easy opt-out.</li>'
        . '<li>Honour an opt-out at once: use “Do not contact” on the lead.</li>'
        . '<li>Keep the list private: don’t publish, sell or share it.</li>'
        . '<li>Georgian law may require consent before direct marketing to individuals, and sole traders count. Check with a lawyer before any mass outreach.</li>'
        . '</ul></section>';
    return $html;
}

/** GET ?view=finder&… (index.php prints it with admin_layout). Changes nothing. */
function finder_view(array $query): string
{
    $tab = is_string($query['tab'] ?? null) && isset(FINDER_TABS[$query['tab']]) ? $query['tab'] : 'local';
    if ($tab === 'leads' && ($query['export'] ?? '') === 'csv') {
        finder_export($query);
    }
    finder_assets();
    $html = finder_header($tab) . '<div class="finder" data-tab="' . $tab . '">';
    switch ($tab) {
        case 'leads':
            $id = finder_clean_id($query['lead'] ?? '');
            if (isset($query['lead'])) {
                $lead = finder_lead_find($id);
                $html .= $lead !== null ? finder_lead_detail_view($lead)
                    : '<div class="card"><p>There is no lead with that address. It may have been deleted.</p><p><a href="' . admin_h(admin_url(['view' => 'finder', 'tab' => 'leads'])) . '">Back to the leads</a></p></div>';
            } else {
                $html .= finder_leads_view($query);
            }
            break;
        case 'upwork':
            $html .= finder_upwork_view($query);
            break;
        case 'tenders':
            $html .= finder_tenders_view();
            break;
        default:
            $html .= finder_local_view();
    }
    return $html . '<p class="sr-only" id="finder-live" role="status" aria-live="polite"></p></div>';
}

/** POST ?action=finder.<name> (signed in, CSRF checked). Ends the request: JSON for scripts, a redirect for forms. */
function finder_action(string $name, array $post): never
{
    match ($name) {
        'local_osm' => finder_action_local_osm($post),
        'local_ai' => finder_action_local_ai($post),
        'save' => finder_action_save($post),
        'ted_search' => finder_action_ted_search($post),
        'upwork_search' => finder_action_upwork_search($post),
        'upwork_track' => finder_action_upwork_track($post),
        'upwork_connect' => finder_action_upwork_connect(),
        'upwork_finish' => finder_action_upwork_finish($post),
        'upwork_disconnect' => finder_action_upwork_disconnect(),
        'lead_update' => finder_action_lead_update($post),
        'lead_delete' => finder_action_lead_delete($post),
        'lead_dnc' => finder_action_lead_dnc($post),
        'lead_add' => finder_action_lead_add($post),
        'draft_save' => finder_action_draft_save($post),
        'lead_research' => finder_action_lead_research($post),
        'lead_draft' => finder_action_lead_draft($post),
        default => admin_fail(404, 'Not found', 'There is no such action.'),
    };
}
