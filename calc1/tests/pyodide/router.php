<?php
// Serves the local Pyodide package with CORS for Mathub tests.
header('Access-Control-Allow-Origin: *');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
// a stand-in for RevenueCat's GET /v1/subscribers/{id}, for the Mathub Create tests (config.local.php: revenuecat_api,
// revenuecat_secret 'sk_test'); who is subscribed comes from tests/fixtures/rc-state.json, written by the test
if (preg_match('#^/revenuecat/v1/subscribers/(.+)$#', $path, $m)) {
  header('Content-Type: application/json');
  if (($_SERVER['HTTP_AUTHORIZATION'] ?? '') !== 'Bearer sk_test') { http_response_code(401); echo '{"code":7225,"message":"Invalid API key."}'; exit; }
  $id = rawurldecode($m[1]); $state = json_decode((string)@file_get_contents(__DIR__ . '/../fixtures/rc-state.json'), true) ?: []; $s = $state[$id] ?? null;
  $ent = $s ? ['create' => ['expires_date' => $s['expires'] ?? null, 'grace_period_expires_date' => null, 'product_identifier' => 'mathub_create_monthly', 'purchase_date' => gmdate('c')]] : [];
  echo json_encode(['request_date' => gmdate('c'), 'subscriber' => ['original_app_user_id' => $id, 'entitlements' => $ent, 'subscriptions' => $s ? ['mathub_create_monthly' => ['store' => $s['store'] ?? 'rc_billing', 'expires_date' => $s['expires'] ?? null]] : (object)[], 'management_url' => $s ? 'https://billing.example/manage' : null]]);
  exit;
}
$file = __DIR__ . '/package' . $path;
if ($path === '/' || !is_file($file)) { http_response_code(404); echo 'not found'; exit; }
$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$types = ['js' => 'text/javascript', 'mjs' => 'text/javascript', 'wasm' => 'application/wasm', 'json' => 'application/json', 'zip' => 'application/zip', 'whl' => 'application/octet-stream', 'ts' => 'text/plain', 'map' => 'application/json'];
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($file));
readfile($file);
