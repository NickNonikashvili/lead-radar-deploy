<?php
/*
 * Tours & prices (?p=tours) — owners only.
 *
 * For each tour in the website's catalogue: the price per person for each travel style (an empty field means
 * "the price the website was built with", shown as the placeholder), a "show on the website" switch and a link
 * to the tour's public page. Below, folded away: the party-size factors the tour pages' price calculator uses.
 *
 * Saving stores the settings
 *   tour_prices   {tourId: {tier: €}}  only prices that differ from the built-in ones (whole euros)
 *   tours_hidden  [tourId, …]
 *   party_factors {"1".."8": factor}   only factors that differ from the built-in ones
 * then rewrites api/live.json (write_live_json) so the website follows within a minute, and writes one
 * activity-log line per kind of change (tours.prices, tours.visibility, tours.factors; tours.reset).
 * A form that doesn't pass the checks is shown again (422) with what was typed and a message under each field.
 */
require_once __DIR__ . '/manage-lib.php';
$me = require_owner();

const TOURS_PRICE_MIN = 10;
const TOURS_PRICE_MAX = 50000;

$tiers = tiers();
$tours = tours();
$cat = catalog();
$builtFactors = [];
for ($i = 1; $i <= 8; $i++) $builtFactors[(string) $i] = isset($cat['partyFactors'][(string) $i]) ? (float) $cat['partyFactors'][(string) $i] : 1.0;
$factors = party_factors();
$factorOver = setting('party_factors');
$factorOver = is_array($factorOver) ? $factorOver : [];
$builtPrice = function (array $t, string $tier): int {
  return isset($t['built_in_prices'][$tier]) ? (int) round((float) $t['built_in_prices'][$tier]) : 0;
};

$errors = [];
$typed = null; // what was sent, to show again when something needs fixing

if (is_post()) {
  csrf_check();
  $action = post('action');

  if ($action === 'reset') {
    $n = 0;
    foreach ($tours as $t) if ($t['price_overridden']) $n++;
    set_setting('tour_prices', []);
    if ($n > 0) audit('tours.reset', 'settings:tour_prices', 'All tour prices back to the built-in ones (' . $n . ' tours had their own prices)');
    if (mg_publish()) flash('ok', t('Every tour is back to the price the website was built with. The website follows within a minute.'));
    redirect(url('tours'));
  }

  if ($action !== 'save') redirect(url('tours'));

  // ── Read and check everything first; save only when it is all fine ──
  $typed = ['price' => [], 'show' => [], 'factor' => []];
  $newPrices = [];
  foreach ($tours as $id => $t) {
    $typed['show'][$id] = mg_posted_on(['show', $id]);
    foreach ($tiers as $tier => $tierName) {
      $raw = mg_posted(['price', $id, $tier]);
      $typed['price'][$id][$tier] = $raw;
      $why = '';
      $v = mg_parse_euros($raw, $why, TOURS_PRICE_MIN, TOURS_PRICE_MAX);
      if ($v === false) {
        $errors['price.' . $id . '.' . $tier] = $why;
        continue;
      }
      if ($v !== null && $v !== $builtPrice($t, $tier)) $newPrices[$id][$tier] = $v;
    }
  }
  $newFactors = [];
  foreach ($builtFactors as $k => $b) {
    $k = (string) $k;
    $raw = mg_posted(['factor', $k]);
    $typed['factor'][$k] = $raw;
    $why = '';
    $v = mg_parse_factor($raw, $why);
    if ($v === false) {
      $errors['factor.' . $k] = $why;
      continue;
    }
    if ($v !== null && abs($v - $b) > 0.0001) $newFactors[$k] = $v;
  }

  if (!$errors) {
    $newHidden = [];
    foreach ($tours as $id => $t) if (!$typed['show'][$id]) $newHidden[] = $id;

    // What changes, for the activity log and the message.
    $priceLines = [];
    foreach ($tours as $id => $t) {
      foreach ($tiers as $tier => $tierName) {
        $old = (int) round((float) $t['prices'][$tier]);
        $built = $builtPrice($t, $tier);
        $new = $newPrices[$id][$tier] ?? $built;
        if ($new !== $old) $priceLines[] = $id . '/' . $tier . ': ' . $old . ' → ' . $new . ($new === $built ? ' (built-in)' : '');
      }
    }
    $nowHidden = [];
    $nowShown = [];
    foreach ($tours as $id => $t) {
      $off = in_array($id, $newHidden, true);
      if ($off && !$t['hidden']) $nowHidden[] = $id;
      if (!$off && $t['hidden']) $nowShown[] = $id;
    }
    $factorLines = [];
    foreach ($builtFactors as $k => $b) {
      $k = (string) $k;
      $new = $newFactors[$k] ?? $b;
      if (abs($new - $factors[$k]) > 0.0001) $factorLines[] = $k . ': ' . mg_num($factors[$k]) . ' → ' . mg_num($new);
    }

    db_tx(function () use ($newPrices, $newHidden, $newFactors) {
      set_setting('tour_prices', $newPrices);
      set_setting('tours_hidden', $newHidden);
      set_setting('party_factors', $newFactors);
    });
    if ($priceLines) audit('tours.prices', 'settings:tour_prices', implode('; ', $priceLines));
    if ($nowHidden || $nowShown) audit('tours.visibility', 'settings:tours_hidden', trim(($nowHidden ? 'Taken off the website: ' . implode(', ', $nowHidden) . '. ' : '') . ($nowShown ? 'Back on the website: ' . implode(', ', $nowShown) . '.' : '')));
    if ($factorLines) audit('tours.factors', 'settings:party_factors', implode('; ', $factorLines));

    $published = mg_publish();
    $parts = [];
    if ($priceLines) $parts[] = tp(count($priceLines), '{n} price changed', '{n} prices changed');
    if ($nowHidden) $parts[] = tp(count($nowHidden), '{n} tour taken off the website', '{n} tours taken off the website');
    if ($nowShown) $parts[] = tp(count($nowShown), '{n} tour back on the website', '{n} tours back on the website');
    if ($factorLines) $parts[] = tp(count($factorLines), '{n} party-size factor changed', '{n} party-size factors changed');
    if ($published) {
      flash($parts ? 'ok' : 'info', $parts
        ? t('Saved: {what}. The website follows within a minute.', ['what' => implode(', ', $parts)])
        : t('Nothing had changed, so everything stays as it was.'));
    }
    if (count($newHidden) === count($tours) && count($tours) > 0) {
      flash('info', t('Every tour is now hidden, so the website’s tours page shows none. Switch at least one back on when you’re ready.'));
    }
    redirect(url('tours'));
  }
}

$renderOpts = [
  'nav' => 'tours',
  'css' => ['manage.css'],
  'js' => ['manage.js'],
  'lead' => t('What each tour costs on the website, and which tours are on offer.'),
  'actions' => '<a class="btn btn--secondary" href="../tours/" target="_blank" rel="noopener">' . icon('external') . h(t('View the tours page'))
    . '<span class="sr-only"> ' . h(t('(opens in a new tab)')) . '</span></a>',
  'status' => $errors ? 422 : 200,
];

// ── No catalogue: nothing to price ──────────────────────────────────────────
if (!$tours) {
  $html = '<section class="card empty"><div class="empty__mark" aria-hidden="true">' . icon('tag') . '</div>'
    . '<h2 class="empty__title">' . h(t('No tours found')) . '</h2>'
    . '<p class="empty__text">' . h(t('The list of tours comes with the website (admin/lib/catalog.json). Upload the complete website again and they will appear here.')) . '</p></section>';
  render(t('Tours & prices'), $html, $renderOpts);
}

// ── The page ───────────────────────────────────────────────────────────────
$shownCount = 0;
$changedCount = 0;
foreach ($tours as $t) {
  if (!$t['hidden']) $shownCount++;
  if ($t['price_overridden']) $changedCount++;
}
$factorsChanged = 0;
foreach ($builtFactors as $k => $b) if (abs($factors[(string) $k] - $b) > 0.0001) $factorsChanged++;
$factorErrors = false;
foreach ($errors as $k => $e) if (strpos($k, 'factor.') === 0) $factorErrors = true;
$over = setting('tour_prices');

// The example under the factors: like the tour page's calculator (per person rounded to €10).
$exTour = null;
foreach ($tours as $t) if (!$t['hidden']) { $exTour = $t; break; }
if (!$exTour) $exTour = reset($tours);
reset($tiers);
$exTier = isset($tiers['explorer']) ? 'explorer' : (string) key($tiers);

ob_start();
echo mg_error_summary($errors);
?>
<div class="callout callout--info tp-intro">
  <?= icon('info') ?>
  <div>
    <p><?= h(t('Prices are per person for two travellers sharing, in euros — as the website shows them. An empty field keeps the price the website was built with (shown in grey).')) ?></p>
    <p class="strong"><?= h(t('Changes appear on the website within a minute.')) ?></p>
  </div>
</div>

<ul class="tp-summary" aria-label="<?= h(t('Summary')) ?>">
  <li><?= icon('eye') ?><span><?= h(t('{shown} of {all} tours on the website', ['shown' => $shownCount, 'all' => count($tours)])) ?></span></li>
  <li><?= icon('tag') ?><span><?= h($changedCount ? tp($changedCount, '{n} tour with its own prices', '{n} tours with their own prices') : t('All prices as built')) ?></span></li>
  <?php if ($factorsChanged) { ?><li><?= icon('users') ?><span><?= h(tp($factorsChanged, '{n} party-size factor changed', '{n} party-size factors changed')) ?></span></li><?php } ?>
</ul>

<form method="post" action="<?= h(url('tours')) ?>" class="tp-form" id="tours-form" data-once data-dirty-form novalidate>
  <?= csrf_field() ?><input type="hidden" name="action" value="save">
  <div class="stack">
    <?php foreach ($tours as $id => $t) {
      $show = $typed ? !empty($typed['show'][$id]) : !$t['hidden'];
      $styles = array_map(function ($s) { return t(TOUR_STYLE_NAMES[$s] ?? ucfirst((string) $s)); }, $t['styles']);
      $pub = '../tours/' . rawurlencode($id);
      $tid = mg_id($id); ?>
      <section class="card tp-tour<?= $show ? '' : ' is-off' ?>" id="tour-<?= h($tid) ?>" data-tour-row aria-labelledby="tt-<?= h($tid) ?>">
        <div class="card__head tp-tour__head">
          <div class="tp-tour__title">
            <h2 class="card__title" id="tt-<?= h($tid) ?>"><?= h($t['name']) ?></h2>
            <p class="meta card__sub">
              <span><?= h(tp($t['days'], '{n} day', '{n} days')) ?></span>
              <?php if ($styles) { ?><span><?= h(implode(' · ', $styles)) ?></span><?php } ?>
            </p>
            <a href="<?= h($pub) ?>" target="_blank" rel="noopener" class="tp-link"><?= h(t('Open its page')) ?><?= icon('external') ?><span class="sr-only"> <?= h(t('(opens in a new tab)')) ?></span></a>
          </div>
          <div class="card__actions">
            <label class="switch tp-switch">
              <input type="checkbox" role="switch" name="show[<?= h($id) ?>]" value="1"<?= $show ? ' checked' : '' ?> data-tour-show aria-describedby="off-<?= h($tid) ?>">
              <span class="switch__track"></span>
              <span class="switch__label"><?= h(t('On the website')) ?></span>
            </label>
          </div>
        </div>
        <div class="card__body">
          <p class="tp-off" id="off-<?= h($tid) ?>"<?= $show ? ' hidden' : '' ?> data-off-note><?= icon('eye-off') ?><span><?= h(t('Hidden: its card is taken off the website. Its page can still be opened from old links, and says the tour isn’t on offer at the moment.')) ?></span></p>
          <div class="tp-prices">
            <?php foreach ($tiers as $tier => $tierName) {
              $key = 'price.' . $id . '.' . $tier;
              $fid = mg_id('price-' . $id . '-' . $tier);
              $built = $builtPrice($t, $tier);
              $ownNow = is_array($over) && isset($over[$id][$tier]) && is_numeric($over[$id][$tier]) && (int) round((float) $over[$id][$tier]) !== $built;
              $value = $typed ? $typed['price'][$id][$tier] : ($ownNow ? (string) (int) round((float) $over[$id][$tier]) : ''); ?>
              <div class="field tp-price<?= mg_cls($errors, $key) ?><?= $ownNow ? ' is-own' : '' ?>">
                <label class="field__label" for="<?= h($fid) ?>"><?= h(t($tierName)) ?></label>
                <div class="input-group">
                  <span class="input-group__addon" aria-hidden="true">€</span>
                  <input class="input" type="text" inputmode="numeric" id="<?= h($fid) ?>" name="price[<?= h($id) ?>][<?= h($tier) ?>]"
                    value="<?= h($value) ?>" placeholder="<?= h(number_format($built)) ?>" autocomplete="off" maxlength="12"
                    data-price-input data-builtin="<?= (int) $built ?>"<?= mg_inv($errors, $key, 'note-' . $fid) ?>>
                </div>
                <p class="tp-note" id="note-<?= h($fid) ?>"><span class="tp-note__own"><?= h(t('Own price')) ?> · </span><?= h(t('Built-in {price}', ['price' => fmt_money($built)])) ?></p>
                <?= mg_err($errors, $key) ?>
              </div>
            <?php } ?>
          </div>
        </div>
      </section>
    <?php } ?>

    <details class="disclosure tp-factors" id="factors"<?= ($factorsChanged || $factorErrors) ? ' open' : '' ?>>
      <summary><span><?= h(t('Party-size factors')) ?> <span class="field__opt"><?= h(t('advanced')) ?></span></span></summary>
      <div class="disclosure__body stack stack--sm">
        <p class="tp-factors__text"><?= h(t('The price calculator on each tour page multiplies the per-person price by these factors. One traveller pays more (a whole car and room to themselves); larger groups share the costs. For two travellers the factor is normally 1, which is the price as listed. Empty = the built-in factor (in grey).')) ?></p>
        <div class="tp-factor-grid">
          <?php foreach ($builtFactors as $k => $b) {
            $k = (string) $k;
            $key = 'factor.' . $k;
            $fid = 'factor-' . $k;
            $own = isset($factorOver[$k]) && is_numeric($factorOver[$k]) && abs((float) $factorOver[$k] - $b) > 0.0001;
            $value = $typed ? $typed['factor'][$k] : ($own ? mg_num((float) $factorOver[$k]) : '');
            $label = $k === '8' ? t('8 or more') : tp((int) $k, '{n} traveller', '{n} travellers'); ?>
            <div class="field tp-factor<?= mg_cls($errors, $key) ?><?= $own ? ' is-own' : '' ?>">
              <label class="field__label" for="<?= h($fid) ?>"><?= h($label) ?></label>
              <input class="input" type="text" inputmode="decimal" id="<?= h($fid) ?>" name="factor[<?= h($k) ?>]" value="<?= h($value) ?>"
                placeholder="<?= h(mg_num($b)) ?>" autocomplete="off" maxlength="6" data-factor="<?= h($k) ?>" data-builtin="<?= h(mg_num($b)) ?>"<?= mg_inv($errors, $key) ?>>
              <?= mg_err($errors, $key) ?>
            </div>
          <?php } ?>
        </div>
        <?php if (isset($exTour['prices'][$exTier])) {
          $exPrice = (float) $exTour['prices'][$exTier];
          $exN = 4;
          $exPer = round($exPrice * $factors[(string) $exN] / 10) * 10;
          $tpl = t('Example — {tour}, {tier}, for {n} travellers: {per} per person, {total} in total.', ['tour' => $exTour['name'], 'tier' => t(tier_name($exTier))]); ?>
          <p class="tp-example" data-example data-price="<?= h((string) $exPrice) ?>" data-n="<?= $exN ?>"
            data-price-from="#<?= h(mg_id('price-' . $exTour['id'] . '-' . $exTier)) ?>" data-tpl="<?= h($tpl) ?>" aria-live="polite">
            <?= icon('info') ?><span data-example-text><?= h(strtr($tpl, ['{n}' => $exN, '{per}' => fmt_money($exPer), '{total}' => fmt_money($exPer * $exN)])) ?></span>
          </p>
        <?php } ?>
      </div>
    </details>
  </div>

  <div class="tp-savebar" data-savebar>
    <p class="tp-savebar__text">
      <span data-clean-text><?= icon('check') ?><?= h(t('Changes appear on the website within a minute.')) ?></span>
      <span data-dirty-text hidden><?= icon('alert') ?><?= h(t('You have unsaved changes.')) ?></span>
    </p>
    <button type="submit" class="btn btn--primary"><?= icon('check') ?><span class="tp-save-long"><?= h(t('Save prices and tours')) ?></span><span class="tp-save-short" aria-hidden="true"><?= h(t('Save')) ?></span></button>
  </div>
</form>

<?php if ($changedCount > 0) { ?>
  <form method="post" action="<?= h(url('tours')) ?>" class="tp-reset" data-confirm="<?= h(t('Use the built-in price for every tour? The prices you set here will be removed.')) ?>" data-once>
    <?= csrf_field() ?><input type="hidden" name="action" value="reset">
    <p class="small muted"><?= h(t('Want to start again?')) ?>
      <button type="submit" class="btn btn--link"><?= h(t('Go back to the built-in prices for every tour')) ?></button></p>
  </form>
<?php }

render(t('Tours & prices'), ob_get_clean(), $renderOpts);
