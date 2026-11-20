<?php
/*
 * Demo data for the team area (development and testing only — never run it on the live site).
 *
 *   php scripts/admin-seed.php <data-dir> [--days 120] [--force] [--users] [--site <public_html>] [--seed 42]
 *
 *   <data-dir>   the admin's data folder, e.g. /tmp/mfs-site-8101/mfs-data (created if missing)
 *   --days N     how far back requests and visitor statistics go (default 120); bookings run ~5 months ahead
 *   --force      replace existing requests, bookings, payments, notes and statistics (users and settings stay)
 *   --users      also create two demo accounts if they don't exist:
 *                  owner@example.com / demo-password-2026 (owner)   staff@example.com / demo-password-2026 (staff)
 *   --site DIR   the built website (for admin/lib/catalog.json and the schema); default: the public_html next to
 *                <data-dir>, else dist/ of this project, else src/root (with a built-in tour list)
 *   --seed N     random seed (default 42), so runs are repeatable
 *
 * Uses the real schema (admin/lib/boot.php creates/migrates it). Run it as the web server's user, or as root
 * (files are then handed to the data folder's owner).
 */
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

$args = $argv;
array_shift($args);
$opt = ['days' => 120, 'force' => false, 'users' => false, 'site' => '', 'seed' => 42];
$dataDir = '';
for ($i = 0; $i < count($args); $i++) {
  $a = $args[$i];
  if ($a === '--force') $opt['force'] = true;
  elseif ($a === '--users') $opt['users'] = true;
  elseif ($a === '--days' || $a === '--site' || $a === '--seed') $opt[substr($a, 2)] = $args[++$i] ?? '';
  elseif (preg_match('/^--(days|site|seed)=(.*)$/', $a, $m)) $opt[$m[1]] = $m[2];
  elseif ($a === '-h' || $a === '--help') { fwrite(STDOUT, preg_replace('/^.*?\/\*\n|\*\/.*$/s', '', file_get_contents(__FILE__))); exit(0); }
  elseif ($a !== '' && $a[0] !== '-' && $dataDir === '') $dataDir = $a;
  else { fwrite(STDERR, "Unknown option: $a\n"); exit(2); }
}
if ($dataDir === '') { fwrite(STDERR, "Usage: php scripts/admin-seed.php <data-dir> [--days 120] [--force] [--users] [--site DIR] [--seed N]\n"); exit(2); }
$days = max(7, min(1000, (int) $opt['days']));
mt_srand((int) $opt['seed']);

$createdDir = false;
if (!is_dir($dataDir)) {
  if (!mkdir($dataDir, 0700, true)) { fwrite(STDERR, "Cannot create $dataDir\n"); exit(1); }
  $createdDir = true;
}
$dataDir = realpath($dataDir);
// Running as root on a folder we just made: give it to the owner of the folder above (the web server user on the test server).
if ($createdDir && function_exists('posix_geteuid') && posix_geteuid() === 0) { @chown($dataDir, fileowner(dirname($dataDir))); @chgrp($dataDir, filegroup(dirname($dataDir))); }
$project = dirname(__DIR__);
$site = $opt['site'] !== '' ? $opt['site'] : '';
if ($site === '') {
  foreach ([dirname($dataDir) . '/public_html', $project . '/dist', $project . '/src/root'] as $c) {
    if (is_file($c . '/admin/lib/boot.php')) { $site = $c; break; }
  }
}
if ($site === '' || !is_file($site . '/admin/lib/boot.php')) { fwrite(STDERR, "No admin/lib/boot.php found (use --site)\n"); exit(1); }
define('MFS_DATA_DIR', $dataDir);
require $site . '/admin/lib/boot.php';

$cat = catalog();
if (!$cat['tours']) {
  // src/root has no catalog.json: the website's tours as built (src/data/tours.mjs).
  $cat['tours'] = [
    ['id' => 'footsteps-of-the-first-europeans', 'name' => 'Footsteps of the First Europeans', 'days' => 7, 'prices' => ['wanderer' => 790, 'explorer' => 1690, 'golden-fleece' => 3790]],
    ['id' => 'the-grand-journey', 'name' => 'The Grand Journey', 'days' => 12, 'prices' => ['wanderer' => 1390, 'explorer' => 2890, 'golden-fleece' => 6490]],
    ['id' => 'cradle-of-wine', 'name' => 'The Cradle of Wine', 'days' => 5, 'prices' => ['wanderer' => 590, 'explorer' => 1290, 'golden-fleece' => 2890]],
    ['id' => 'into-the-high-caucasus', 'name' => 'Into the High Caucasus', 'days' => 8, 'prices' => ['wanderer' => 920, 'explorer' => 1950, 'golden-fleece' => 4290]],
    ['id' => 'tusheti-the-last-road', 'name' => 'Tusheti: The Last Road', 'days' => 6, 'prices' => ['wanderer' => 840, 'explorer' => 1590, 'golden-fleece' => 2990]],
    ['id' => 'tbilisi-and-the-ancient-capital', 'name' => 'Tbilisi & the Ancient Capital', 'days' => 4, 'prices' => ['wanderer' => 390, 'explorer' => 890, 'golden-fleece' => 2190]],
    ['id' => 'colchis-and-the-black-sea', 'name' => 'Colchis & the Black Sea', 'days' => 6, 'prices' => ['wanderer' => 690, 'explorer' => 1450, 'golden-fleece' => 3290]],
  ];
}
$tours = $cat['tours'];
$tiers = ['wanderer' => 'Wanderer', 'explorer' => 'Explorer', 'golden-fleece' => 'Golden Fleece'];
$factors = $cat['partyFactors'];

$pdo = db();
$have = (int) db_value('SELECT (SELECT COUNT(*) FROM requests) + (SELECT COUNT(*) FROM bookings) + (SELECT COUNT(*) FROM stats_daily)');
if ($have > 0 && !$opt['force']) {
  fwrite(STDERR, "The database in $dataDir already has requests, bookings or statistics. Add --force to replace them.\n");
  exit(1);
}

// ── helpers ─────────────────────────────────────────────────────────────────
function pick(array $a) { return $a[mt_rand(0, count($a) - 1)]; }
function weighted(array $w) { $sum = array_sum($w); $r = mt_rand(1, (int) $sum); foreach ($w as $k => $v) { $r -= $v; if ($r <= 0) return $k; } return array_key_first($w); }
function chance(float $p): bool { return mt_rand() / mt_getrandmax() < $p; }
function utc_at(int $ts): string { return gmdate('Y-m-d H:i:s', $ts); }
function ymd(int $ts): string { $d = new DateTime('@' . $ts); $d->setTimezone(new DateTimeZone('Asia/Tbilisi')); return $d->format('Y-m-d'); }
function add_days(string $ymd, int $n): string { $d = new DateTime($ymd . ' 12:00:00', new DateTimeZone('Asia/Tbilisi')); $d->modify(($n >= 0 ? '+' : '') . $n . ' days'); return $d->format('Y-m-d'); }
function nice_dates(string $start, int $len): string {
  $a = new DateTime($start); $b = (clone $a)->modify('+' . ($len - 1) . ' days');
  return $a->format('M') === $b->format('M') ? $a->format('j') . '–' . $b->format('j M Y') : $a->format('j M') . ' – ' . $b->format('j M Y');
}

$people = [
  'en' => [['Emma Clarke', 'United Kingdom', '+44', '7700 900'], ['James Whitfield', 'United Kingdom', '+44', '7911 123'], ['Olivia Bennett', 'United States', '+1', '415 555'], ['Michael O’Connor', 'Ireland', '+353', '85 123'], ['Sophie Turner', 'Australia', '+61', '412 345'], ['Daniel Hughes', 'Canada', '+1', '604 555'], ['Hannah Lee', 'United States', '+1', '212 555'], ['Thomas Reid', 'New Zealand', '+64', '21 456']],
  'ru' => [['Анна Смирнова', 'Russia', '+7', '916 123'], ['Дмитрий Козлов', 'Kazakhstan', '+7', '701 555'], ['Ольга Иванова', 'Israel', '+972', '52 345'], ['Сергей Петров', 'Belarus', '+375', '29 123']],
  'de' => [['Anna Müller', 'Germany', '+49', '151 2345'], ['Lukas Schneider', 'Germany', '+49', '170 9876'], ['Eva Gruber', 'Austria', '+43', '664 123'], ['Jonas Weber', 'Switzerland', '+41', '79 555']],
  'fr' => [['Camille Laurent', 'France', '+33', '6 12 34'], ['Pierre Dubois', 'France', '+33', '6 98 76'], ['Léa Martin', 'Belgium', '+32', '470 12']],
  'it' => [['Giulia Rossi', 'Italy', '+39', '333 123'], ['Marco Bianchi', 'Italy', '+39', '347 555']],
  'es' => [['Lucía García', 'Spain', '+34', '612 345'], ['Javier Fernández', 'Mexico', '+52', '55 1234']],
  'pt' => [['Inês Costa', 'Portugal', '+351', '912 345'], ['Rafael Souza', 'Brazil', '+55', '11 9123']],
  'zh' => [['Li Wei', 'China', '+86', '138 0013'], ['Wang Fang', 'Singapore', '+65', '9123 4']],
  'ka' => [['ნინო ბერიძე', 'Georgia', '+995', '555 12'], ['გიორგი კაპანაძე', 'Georgia', '+995', '599 34']],
];
$langW = ['en' => 34, 'ru' => 14, 'de' => 12, 'fr' => 8, 'it' => 6, 'es' => 6, 'pt' => 4, 'zh' => 7, 'ka' => 9];
$likesPool = ['wine', 'mountains', 'old towns', 'food', 'hiking', 'monasteries', 'photography', 'the Black Sea', 'cooking class', 'Svaneti towers', 'a supra with singing', 'cave cities'];
$messages = [
  'We are celebrating our anniversary — something special would be lovely.',
  'Is it possible to add two nights in Batumi at the end?',
  'We travel with a 7-year-old. Is the mountain part OK for children?',
  'Could you send prices for a private driver only, without a guide?',
  'My parents are in their seventies, so not too much walking please.',
  'We would like vegetarian food where possible.',
  'Can we combine the wine tour with a few days in Kazbegi?',
  'Hello! What is the best month for Tusheti?',
  "We land in Kutaisi late at night.\nCan you pick us up from the airport?",
];
$contactMsgs = [
  'Do I need a visa as a Canadian citizen?', 'What is your cancellation policy?', 'Can we pay the deposit by card?',
  'Is it safe to drive to Tusheti in early June?', 'Do you have English-speaking guides in Mestia?', 'We booked with you last year — thank you again! Can we book a short trip for friends?',
];
$companies = [['Caucasus Travel GmbH', 'Austria'], ['Silk Road Journeys', 'United Kingdom'], ['Voyages Orient', 'France'], ['Viaggi del Vino', 'Italy'], ['Nordic Explorer AB', 'Sweden']];
$spamTexts = ['SEO services for your website!!! Best price, contact now', 'Crypto investment opportunity 500% profit', 'We can bring 10,000 visitors to your site, write back'];

$users = db_all('SELECT id, name, role FROM users WHERE active = 1');
if ($opt['users']) {
  foreach ([['owner@example.com', 'Nino Kapanadze', 'owner'], ['staff@example.com', 'Giorgi Beridze', 'staff']] as $u) {
    if (!db_value('SELECT 1 FROM users WHERE email = ?', [$u[0]])) {
      db_exec('INSERT INTO users (email, name, password_hash, role, lang, active, created_at) VALUES (?, ?, ?, ?, \'en\', 1, ?)',
        [$u[0], $u[1], password_hash('demo-password-2026', PASSWORD_DEFAULT), $u[2], utc_at(time() - $days * 86400)]);
      echo "Created {$u[2]} account {$u[0]} / demo-password-2026\n";
    }
  }
  $users = db_all('SELECT id, name, role FROM users WHERE active = 1');
}
$userIds = array_map(function ($u) { return (int) $u['id']; }, $users);
$someone = function () use ($userIds) { return $userIds ? $userIds[mt_rand(0, count($userIds) - 1)] : null; };

$now = time();
$today = local_today();
db_tx(function () use (&$counts, $opt) {
  if ($opt['force']) {
    foreach (['payments', 'notes', 'bookings', 'requests', 'stats_daily', 'stats_pages', 'stats_dims', 'stats_seen'] as $t) db_exec("DELETE FROM $t");
  }
});

$counts = ['requests' => 0, 'notes' => 0, 'bookings' => 0, 'payments' => 0, 'stat_days' => 0];
$insReq = $pdo->prepare('INSERT INTO requests (ref, kind, kind_label, status, name, email, phone, country, company, travel_dates, travellers, interests, tour_id, tier, message, fields_json, lang, page, assigned_to, follow_up_on, read_at, created_at, updated_at)
  VALUES (:ref, :kind, :kind_label, :status, :name, :email, :phone, :country, :company, :travel_dates, :travellers, :interests, :tour_id, :tier, :message, :fields_json, :lang, :page, :assigned_to, :follow_up_on, :read_at, :created_at, :updated_at)');
$insNote = $pdo->prepare('INSERT INTO notes (request_id, booking_id, user_id, kind, body, created_at) VALUES (?, ?, ?, ?, ?, ?)');
$insBooking = $pdo->prepare('INSERT INTO bookings (ref, request_id, status, client_name, client_email, client_phone, client_country, client_lang, tour_id, tour_name, tier, start_date, end_date, adults, children, total_price, deposit_amount, deposit_due, balance_due, guide, driver, vehicle, accommodation, notes, created_by, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$insPay = $pdo->prepare('INSERT INTO payments (booking_id, paid_on, amount, method, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
$label = REQUEST_STATUSES;
$guides = ['Levan Tsiklauri', 'Mariam Gelashvili', 'Dato Lomidze', 'Tamar Javakhishvili'];
$drivers = ['Zura Maisuradze', 'Gia Abashidze', 'Beka Kvaratskhelia'];
$vehicles = ['Toyota Prius', 'Mercedes Vito', 'Land Cruiser Prado', 'Mercedes Sprinter', 'Mitsubishi Delica'];
$stays = ['Guesthouse Nino, Sighnaghi', 'Rooms Hotel Kazbegi', 'Stamba Hotel, Tbilisi', 'Hotel Lileo, Mestia', 'Schuchmann Wines Château, Telavi', 'Family guesthouse in Omalo'];
$bookingSeq = 0;
$refsUsed = [];

$addBooking = function (array $o) use (&$counts, &$bookingSeq, $insBooking, $insPay, $insNote, $pdo, $today, $someone, $guides, $drivers, $vehicles, $stays, $factors) {
  $bookingSeq++;
  $t = $o['tour'];
  $tier = $o['tier'];
  $adults = $o['adults'];
  $children = $o['children'];
  $party = max(1, $adults + $children);
  $per = $t['prices'][$tier] * ($factors[(string) min(8, $party)] ?? 1);
  $total = round($per * $party / 10) * 10;
  $start = $o['start'];
  $end = add_days($start, max(1, (int) $t['days']) - 1);
  $status = $o['status'];
  $deposit = round($total * 0.3 / 10) * 10;
  $createdTs = $o['created_ts'];
  $created = utc_at($createdTs);
  $ref = 'BK-' . substr(str_replace('-', '', $start), 2, 4) . '-' . str_pad((string) $bookingSeq, 3, '0', STR_PAD_LEFT);
  $past = $end < $today;
  $insBooking->execute([
    $ref, $o['request_id'], $status, $o['name'], $o['email'], $o['phone'], $o['country'], $o['lang'], $t['id'], $t['name'], $tier, $start, $end,
    $adults, $children, $total, $deposit, add_days(ymd($createdTs), 7), add_days($start, -30),
    $status === 'quote' ? null : pick($guides), $status === 'quote' ? null : pick($drivers), pick($vehicles), $status === 'quote' ? null : pick($stays),
    chance(0.4) ? pick(['Vegetarian meals for one guest.', 'Celebrating a birthday on day 3 — cake arranged.', 'Late arrival: flight lands 23:40.', 'Prefers ground-floor rooms.']) : null,
    $someone(), $created, $created,
  ]);
  $bid = (int) $pdo->lastInsertId();
  $counts['bookings']++;
  $method = pick(['Bank transfer', 'Card', 'Cash', 'Bank transfer']);
  if ($status === 'confirmed' || $status === 'completed') {
    $paidOn = add_days(ymd($createdTs), mt_rand(1, 6));
    if ($paidOn <= $today) { $insPay->execute([$bid, $paidOn, $deposit, $method, 'Deposit', $someone(), utc_at($createdTs + 3 * 86400)]); $counts['payments']++; }
    $balanceOn = add_days($start, -mt_rand(5, 35));
    if ($status === 'completed' || ($balanceOn <= $today && chance(0.6))) {
      $rest = $total - $deposit;
      if (chance(0.15) && $status !== 'completed') $rest = round($rest / 2);
      if ($balanceOn <= $today && $rest > 0) { $insPay->execute([$bid, $balanceOn, $rest, pick(['Bank transfer', 'Card', 'Cash']), $rest < $total - $deposit ? 'Part of the balance' : 'Balance', $someone(), utc_at(strtotime($balanceOn . ' 10:00:00 UTC'))]); $counts['payments']++; }
    }
  } elseif ($status === 'cancelled' && chance(0.5)) {
    $insPay->execute([$bid, add_days(ymd($createdTs), 3), $deposit, $method, 'Deposit (kept under the booking terms)', $someone(), utc_at($createdTs + 3 * 86400)]);
    $counts['payments']++;
  }
  $insNote->execute([null, $bid, $someone(), 'system', 'Booking created', $created]);
  $counts['notes']++;
  if ($status !== 'quote') { $insNote->execute([null, $bid, $someone(), 'note', pick(['Hotels confirmed for all nights.', 'Sent the day-by-day plan by email.', 'Client asked for an extra wine tasting on day 2 — booked.', 'Driver will meet them at arrivals with a sign.']), utc_at($createdTs + 5 * 86400)]); $counts['notes']++; }
  return $bid;
};

// ── Requests (and the bookings that came from them) ─────────────────────────
for ($d = $days; $d >= 0; $d--) {
  $dayTs = $now - $d * 86400;
  $growth = 0.6 + 1.4 * (1 - $d / $days);
  $n = (int) floor($growth * (mt_rand(0, 100) / 100) * 2.6 + (chance(0.35) ? 1 : 0));
  for ($k = 0; $k < $n; $k++) {
    $ts = $dayTs - mt_rand(0, 14 * 3600);
    if ($ts > $now) $ts = $now - mt_rand(60, 3600);
    $ageDays = ($now - $ts) / 86400;
    $isSpam = chance(0.07);
    $kind = $isSpam ? 'other' : weighted(['trip' => 62, 'contact' => 26, 'partner' => 9, 'other' => 3]);
    $lang = weighted($langW);
    $person = pick($people[$lang]);
    list($name, $country, $dial, $phonePart) = $person;
    $first = strtolower(preg_replace('/[^a-z]/i', '', explode(' ', (string) @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $name))[0])) ?: 'guest';
    $email = $first . mt_rand(1, 99) . '@' . pick(['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'gmx.de', 'mail.ru', 'proton.me']);
    $phone = $dial . ' ' . $phonePart . ' ' . str_pad((string) mt_rand(0, 9999), 4, '0', STR_PAD_LEFT);
    $pfx = $lang === 'en' ? '' : '/' . $lang;
    $tour = pick($tours);
    $tier = weighted(['wanderer' => 30, 'explorer' => 50, 'golden-fleece' => 20]);
    $adults = weighted([1 => 8, 2 => 55, 3 => 10, 4 => 17, 5 => 4, 6 => 6]);
    $children = chance(0.18) ? mt_rand(1, 2) : 0;
    $travStart = add_days(ymd($ts), mt_rand(25, 170));
    $when = nice_dates($travStart, (int) $tour['days'] + mt_rand(0, 2));
    $trav = $adults . ' ' . ($adults === 1 ? 'adult' : 'adults') . ($children ? ', ' . $children . ' ' . ($children === 1 ? 'child' : 'children') : '');
    $likes = chance(0.55) ? $tour['name'] . ' (' . $tiers[$tier] . ')' : implode(', ', array_slice((function ($a) { shuffle($a); return $a; })($likesPool), 0, mt_rand(1, 3)));
    $tourId = strpos($likes, $tour['name']) !== false ? $tour['id'] : null;
    $msg = null; $company = null; $ctry = null;
    if ($isSpam) {
      $kindLabel = pick(['Message from the contact page', 'Travel partner enquiry']);
      $name = pick(['Best SEO', 'Mark', 'Crypto Team']);
      $email = 'promo' . mt_rand(100, 999) . '@spam-mail.example';
      $msg = pick($spamTexts);
      $fields = [['l' => 'Full name', 'n' => 'c-nm', 'v' => $name], ['l' => 'Email', 'n' => 'c-em', 'v' => $email], ['l' => 'Message', 'n' => 'c-msg', 'v' => $msg]];
      $page = '/contact'; $ref = 'C-' . gmdate('ym', $ts) . '-' . mt_rand(1000, 9999); $phone = null; $when = null; $trav = null; $likes = null; $tourId = null;
      $kind = 'contact';
    } elseif ($kind === 'trip') {
      $fromHome = chance(0.65);
      $kindLabel = $fromHome ? 'Trip request (home)' : 'Trip request (contact page)';
      $msg = chance(0.45) ? pick($messages) : null;
      $fields = $fromHome
        ? [['l' => 'Passenger', 'n' => 'name', 'v' => $name], ['l' => 'Email', 'n' => 'email', 'v' => $email], ['l' => 'Country code', 'n' => 'country_code', 'v' => $country . ' (' . $dial . ')'], ['l' => 'Phone', 'n' => 'phone', 'v' => substr($phone, strlen($dial) + 1)], ['l' => 'When', 'n' => 'when', 'v' => $when], ['l' => 'Travellers', 'n' => 'people', 'v' => $trav], ['l' => 'Would like to see', 'n' => 'likes', 'v' => $likes], ['l' => 'I agree to the privacy policy.', 'n' => 'rq-consent', 'v' => 'Yes']]
        : [['l' => 'Full name', 'n' => 'c-nm', 'v' => $name], ['l' => 'Email', 'n' => 'c-em', 'v' => $email], ['l' => 'What is it about?', 'n' => 'c-tp', 'v' => 'A custom trip'], ['l' => 'Phone', 'n' => 'c-ph', 'v' => $phone], ['l' => 'When', 'n' => 'when', 'v' => $when], ['l' => 'Travellers', 'n' => 'people', 'v' => $trav], ['l' => 'Would like to see', 'n' => 'c-likes', 'v' => $likes]];
      if ($msg && !$fromHome) $fields[] = ['l' => 'Message (optional)', 'n' => 'c-msg', 'v' => $msg];
      if (!$fromHome && !$msg) $msg = null;
      $page = $fromHome ? $pfx . '/' : $pfx . '/contact';
      $ref = ($fromHome ? 'MFS-' : 'C-') . gmdate('ym', $ts) . '-' . mt_rand(1000, 9999);
    } elseif ($kind === 'contact') {
      $kindLabel = 'Message from the contact page';
      $msg = pick($contactMsgs);
      $fields = [['l' => 'Full name', 'n' => 'c-nm', 'v' => $name], ['l' => 'Email', 'n' => 'c-em', 'v' => $email], ['l' => 'What is it about?', 'n' => 'c-tp', 'v' => pick(['A question about a tour', 'A trip I’ve already booked', 'Something else'])], ['l' => 'Message', 'n' => 'c-msg', 'v' => $msg]];
      $page = $pfx . '/contact'; $ref = 'C-' . gmdate('ym', $ts) . '-' . mt_rand(1000, 9999); $phone = null; $when = null; $trav = null; $likes = null; $tourId = null;
    } elseif ($kind === 'partner') {
      list($company, $ctry) = pick($companies);
      $kindLabel = 'Travel partner enquiry';
      $msg = 'We are a tour operator and would like to offer your private tours to our clients. Could you send your partner rates?';
      $fields = [['l' => 'Company', 'n' => 'company', 'v' => $company], ['l' => 'Country', 'n' => 'country', 'v' => $ctry], ['l' => 'Contact person', 'n' => 'name', 'v' => $name], ['l' => 'Work email', 'n' => 'email', 'v' => $email], ['l' => 'Website (optional)', 'n' => 'website', 'v' => 'https://' . strtolower(preg_replace('/[^a-z]/i', '', $company)) . '.example'], ['l' => 'Expected volume (optional)', 'n' => 'volume', 'v' => pick(['1–10 travellers a year', '10–25 travellers a year', '25–100 travellers a year'])], ['l' => 'Message', 'n' => 'message', 'v' => $msg]];
      $page = $pfx . '/partners'; $ref = 'P-' . gmdate('ym', $ts) . '-' . mt_rand(1000, 9999); $phone = null; $when = null; $trav = null; $likes = null; $tourId = null; $country = $ctry;
    } else {
      $kindLabel = 'Website form';
      $msg = 'Hello, do you also organise day trips from Tbilisi?';
      $fields = [['l' => 'Name', 'n' => 'name', 'v' => $name], ['l' => 'Message', 'n' => 'message', 'v' => $msg]];
      $page = $pfx . '/'; $ref = 'MFS-' . gmdate('ym', $ts) . '-' . mt_rand(1000, 9999); $phone = null; $when = null; $trav = null; $likes = null; $tourId = null;
    }
    while (isset($refsUsed[$ref])) $ref .= '-2';
    $refsUsed[$ref] = 1;

    // Status by age: recent ones are mostly new; older ones have moved on.
    if ($isSpam) $status = 'spam';
    elseif ($ageDays < 4) $status = weighted(['new' => 80, 'contacted' => 20]);
    elseif ($ageDays < 10) $status = weighted(['new' => 25, 'contacted' => 45, 'quoted' => 25, 'lost' => 5]);
    elseif ($kind === 'trip') $status = weighted(['contacted' => 15, 'quoted' => 20, 'booked' => 35, 'lost' => 30]);
    else $status = weighted(['contacted' => 70, 'lost' => 30]);
    $assigned = $status !== 'spam' && $status !== 'new' && chance(0.6) ? $someone() : null;
    $follow = null;
    if (in_array($status, ['contacted', 'quoted'], true) && chance(0.55)) $follow = add_days($today, mt_rand(-6, 12));
    $updatedTs = min($now, $ts + ($status === 'new' ? 0 : mt_rand(3600, 6 * 86400)));
    $insReq->execute([
      ':ref' => $ref, ':kind' => $kind, ':kind_label' => $kindLabel, ':status' => $status, ':name' => $name, ':email' => $email, ':phone' => $phone,
      ':country' => ($kind === 'partner' ? $ctry : null), ':company' => $company, ':travel_dates' => $when, ':travellers' => $trav, ':interests' => $likes,
      ':tour_id' => $tourId, ':tier' => $tourId ? $tier : null, ':message' => $msg, ':fields_json' => json_encode($fields, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
      ':lang' => $lang, ':page' => $page, ':assigned_to' => $assigned, ':follow_up_on' => $follow,
      ':read_at' => ($status === 'new' && chance(0.7)) ? null : utc_at(min($now, $ts + mt_rand(600, 30000))),
      ':created_at' => utc_at($ts), ':updated_at' => utc_at($updatedTs),
    ]);
    $rid = (int) $pdo->lastInsertId();
    $counts['requests']++;

    // Timeline
    $path = ['new'];
    if (in_array($status, ['contacted', 'quoted', 'booked', 'lost'], true)) $path[] = 'contacted';
    if (in_array($status, ['quoted', 'booked'], true) || ($status === 'lost' && chance(0.5))) $path[] = 'quoted';
    if ($status === 'booked') $path[] = 'booked';
    if ($status === 'lost') $path[] = 'lost';
    $t = $ts;
    for ($p = 1; $p < count($path); $p++) {
      $t = min($now, $t + mt_rand(1800, 2 * 86400));
      $who = $someone();
      if ($path[$p] === 'contacted') { $insNote->execute([$rid, null, $who, 'note', pick(['Replied by email with a few ideas and asked about their dates.', 'Called on WhatsApp — very friendly, wants a slower pace.', 'Sent our tour PDF and asked about budget.']), utc_at($t)]); $counts['notes']++; }
      if ($path[$p] === 'quoted') { $insNote->execute([$rid, null, $who, 'note', 'Sent a quote: ' . $tiers[$tier] . ', ' . fmt_money(round($tour['prices'][$tier] * ($factors[(string) min(8, $adults + $children)] ?? 1) * ($adults + $children) / 10) * 10) . ' for ' . $trav . '.', utc_at($t)]); $counts['notes']++; }
      if ($path[$p] === 'lost') { $insNote->execute([$rid, null, $who, 'note', pick(['They chose another company.', 'No reply after two follow-ups.', 'Trip postponed to next year.']), utc_at($t)]); $counts['notes']++; }
      $insNote->execute([$rid, null, $who, 'status', 'Status changed from ' . $label[$path[$p - 1]] . ' to ' . $label[$path[$p]], utc_at($t)]);
      $counts['notes']++;
    }
    if ($status === 'spam') { $insNote->execute([$rid, null, $someone(), 'status', 'Marked as spam', utc_at(min($now, $ts + 3600))]); $counts['notes']++; }

    if ($status === 'booked') {
      $end = add_days($travStart, (int) $tour['days'] - 1);
      $bStatus = $end < $today ? (chance(0.9) ? 'completed' : 'cancelled') : (chance(0.85) ? 'confirmed' : 'quote');
      $addBooking(['tour' => $tour, 'tier' => $tier, 'adults' => $adults, 'children' => $children, 'start' => $travStart, 'status' => $bStatus,
        'created_ts' => $t, 'request_id' => $rid, 'name' => $name, 'email' => $email, 'phone' => $phone, 'country' => $country, 'lang' => $lang]);
    }
  }
}

// A few bookings made directly (phone, returning clients, partners), spread over past and coming months.
for ($i = 0; $i < 10; $i++) {
  $lang = weighted($langW);
  $person = pick($people[$lang]);
  $start = add_days($today, mt_rand(-$days, 150));
  $tour = pick($tours);
  $end = add_days($start, (int) $tour['days'] - 1);
  $createdTs = min($now, strtotime($start . ' 12:00:00 UTC') - mt_rand(20, 90) * 86400);
  $addBooking(['tour' => $tour, 'tier' => weighted(['wanderer' => 30, 'explorer' => 50, 'golden-fleece' => 20]), 'adults' => weighted([2 => 60, 4 => 25, 6 => 15]), 'children' => 0,
    'start' => $start, 'status' => $end < $today ? 'completed' : weighted(['confirmed' => 70, 'quote' => 30]), 'created_ts' => max($now - ($days + 60) * 86400, $createdTs),
    'request_id' => null, 'name' => $person[0], 'email' => null, 'phone' => $person[2] . ' ' . $person[3] . ' ' . mt_rand(1000, 9999), 'country' => $person[1], 'lang' => $lang]);
}

// ── Visitor statistics (UTC days) ───────────────────────────────────────────
$pages = ['/' => 30, '/tours/' => 14, '/contact' => 6, '/about' => 5, '/discover-georgia' => 6, '/guide/' => 5, '/partners' => 2, '/privacy' => 1];
foreach ($tours as $t) $pages['/tours/' . $t['id']] = mt_rand(3, 7);
foreach (['georgia-in-ten-points', 'visa', 'seasons', 'money', 'getting-around', 'safety', 'supra'] as $slug) $pages['/guide/' . $slug] = mt_rand(1, 4);
$refW = ['(direct)' => 44, 'google.com' => 30, 'instagram.com' => 8, 'facebook.com' => 5, 'tripadvisor.com' => 4, 'bing.com' => 3, 'chatgpt.com' => 3, 't.co' => 2, 'duckduckgo.com' => 1];
$devW = ['phone' => 62, 'desktop' => 30, 'tablet' => 8];
$insDay = $pdo->prepare('INSERT OR REPLACE INTO stats_daily (day, views, visitors) VALUES (?, ?, ?)');
$insPage = $pdo->prepare('INSERT INTO stats_pages (day, path, views) VALUES (?, ?, ?) ON CONFLICT(day, path) DO UPDATE SET views = views + excluded.views');
$insDim = $pdo->prepare('INSERT INTO stats_dims (day, dim, value, views) VALUES (?, ?, ?, ?) ON CONFLICT(day, dim, value) DO UPDATE SET views = views + excluded.views');
db_tx(function () use ($days, $now, $insDay, $insPage, $insDim, $pages, $langW, $refW, $devW, &$counts) {
  for ($d = $days; $d >= 0; $d--) {
    $ts = $now - $d * 86400;
    $day = gmdate('Y-m-d', $ts);
    $dow = (int) gmdate('N', $ts);
    $base = 22 + 70 * (1 - $d / $days);
    $visitors = (int) max(3, round($base * ($dow >= 6 ? 1.25 : 1) * (0.75 + mt_rand(0, 50) / 100)));
    if ($d === 0) $visitors = (int) round($visitors * (int) gmdate('G', $now) / 24) + 1;
    $views = (int) round($visitors * (2.1 + mt_rand(0, 140) / 100));
    $insDay->execute([$day, $views, $visitors]);
    $acc = [];
    for ($v = 0; $v < $views; $v++) {
      $lang = weighted($langW);
      $p = weighted($pages);
      $path = $lang === 'en' ? $p : '/' . $lang . $p;
      $acc['p'][$path] = ($acc['p'][$path] ?? 0) + 1;
      $acc['lang'][$lang] = ($acc['lang'][$lang] ?? 0) + 1;
      if ($v < $visitors * 1.1) { $r = weighted($refW); $acc['ref'][$r] = ($acc['ref'][$r] ?? 0) + 1; }
      $dv = weighted($devW); $acc['device'][$dv] = ($acc['device'][$dv] ?? 0) + 1;
    }
    foreach ($acc['p'] ?? [] as $path => $n) $insPage->execute([$day, $path, $n]);
    foreach (['lang', 'ref', 'device'] as $dim) foreach ($acc[$dim] ?? [] as $val => $n) $insDim->execute([$day, $dim, (string) $val, $n]);
    $counts['stat_days']++;
  }
});

$pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
// Running as root: hand the files to whoever owns the data folder (the web server user on the test server).
if (function_exists('posix_geteuid') && posix_geteuid() === 0) {
  $owner = fileowner($dataDir);
  $group = filegroup($dataDir);
  foreach (array_merge(glob($dataDir . '/mfs.sqlite*') ?: [], is_dir($dataDir . '/sessions') ? [$dataDir . '/sessions'] : []) as $f) { @chown($f, $owner); @chgrp($f, $group); }
}
printf("Seeded %s: %d requests, %d notes, %d bookings, %d payments, %d days of visitor statistics.\n", $dataDir, $counts['requests'], $counts['notes'], $counts['bookings'], $counts['payments'], $counts['stat_days']);
$byStatus = db_all('SELECT status, COUNT(*) n FROM requests GROUP BY status ORDER BY n DESC');
echo 'Requests by status: ' . implode(', ', array_map(function ($r) { return $r['status'] . ' ' . $r['n']; }, $byStatus)) . "\n";
$byB = db_all('SELECT status, COUNT(*) n FROM bookings GROUP BY status ORDER BY n DESC');
echo 'Bookings by status: ' . implode(', ', array_map(function ($r) { return $r['status'] . ' ' . $r['n']; }, $byB)) . "\n";
