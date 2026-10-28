/* Off-site backups (api/offsite.php, api/backupcrypto.php, api/backup-tool.php; the Backups tab, assets/admin-ops.js),
   against the stand-in bucket in tests/pyodide/router.php.
   Covered: the request signer against AWS's own (botocore 1.35.0 computed the expected signatures); nothing is sent until it
   is set up, and the panel says what is missing; a plain-http address and a short passphrase are refused; Check the storage;
   Send now: encrypted (no SQLite header in the bucket), and the bucket holds the size and SHA-256 that were sent; the copy
   opens with the passphrase (the command-line tool) and not without it, and the tool is not on the web; the restore test,
   and a copy changed in the bucket failing it; keeping the newest copies and none older than 90 days, without touching
   anything else in the bucket; a failed send reported; housekeeping sends a new day's copy; administrators only; the tab. */
const T = require('./lib'); const fs = require('fs'); const path = require('path'); const cp = require('child_process');
const ROOT = path.join(__dirname, '..'); const DB = path.join(ROOT, 'api', 'data', 'mathub.sqlite');
const BUCKET = path.join(__dirname, 'fixtures', 's3', 'mathub-test'); const FAIL = path.join(__dirname, 'fixtures', 's3-fail.json');
const sql = (q, ...a) => cp.spawnSync('php', ['-r', '$d = new PDO("sqlite:" . $argv[1]); $s = $d->prepare($argv[2]); $s->execute(array_slice($argv, 3)); echo json_encode($s->fetchAll(PDO::FETCH_ASSOC));', DB, q, ...a.map(String)]).stdout.toString();
const rows = (q, ...a) => { try { return JSON.parse(sql(q, ...a) || '[]'); } catch (e) { return []; } };
const SETTINGS = { offsite_endpoint: 'http://127.0.0.1:8767/s3', offsite_region: 'us-east-1', offsite_bucket: 'mathub-test', offsite_prefix: 'nightly', offsite_key_id: 'AKIATEST', offsite_secret: 'test-secret-key', offsite_passphrase: 'correct horse battery staple', offsite_keep: '3' };
const PASS = SETTINGS.offsite_passphrase;
const inBucket = () => fs.existsSync(BUCKET) ? fs.readdirSync(BUCKET).filter(f => !f.endsWith('.meta.json')).map(f => f.replace(/%2F/g, '/')).sort() : [];
const fileOf = key => path.join(BUCKET, key.replace(/\//g, '%2F'));
const tmp = n => path.join(require('os').tmpdir(), 'mathub-offsite-' + process.pid + '-' + n);
(async () => {
  const { mk, login, go, txt, check, api } = await T.start({});
  const clean = () => { fs.rmSync(path.join(__dirname, 'fixtures', 's3'), { recursive: true, force: true }); fs.rmSync(FAIL, { force: true }); sql('DELETE FROM offsite_log'); };
  const [c, a] = await mk(1360, 900); await go(a, '#/'); await login(a, 'admin.user@montana.edu');
  const unset = () => api(a, 'admin_config_save', { password: 'password123', clear: Object.keys(SETTINGS).concat(['cron_key']) });
  await unset(); clean();

  // the signer: AWS Signature Version 4 as botocore makes it, for a PUT with metadata, a listing (a / and + in the query) and a HEAD on a key with a space and $
  const sigs = cp.spawnSync('php', ['-r', `
    function mh_backup_dir() { return sys_get_temp_dir(); } function mh_config() { return []; }
    require ${JSON.stringify(path.join(ROOT, 'api', 'backupcrypto.php'))};
    eval('?>' . str_replace(["declare(strict_types=1);", "require_once __DIR__ . '/extras.php';", "require_once __DIR__ . '/backupcrypto.php';"], '', file_get_contents(${JSON.stringify(path.join(ROOT, 'api', 'offsite.php'))})));
    $O = ['key' => 'AKIDEXAMPLE', 'secret' => 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY', 'region' => 'us-west-2']; $t = gmmktime(12, 0, 0, 10, 26, 2026);
    $a = mh_s3_sign('PUT', 'mybucket.s3.us-west-2.amazonaws.com', '/nightly/mathub-20261026-1451.sqlite.mhbak', [], ['content-type' => 'application/octet-stream', 'x-amz-meta-sha256' => 'abc123', 'x-amz-meta-users' => '42'], hash('sha256', 'hello backup'), $O, $t);
    $b = mh_s3_sign('GET', 's3.us-west-004.backblazeb2.com', '/my-bucket', ['list-type' => '2', 'prefix' => 'nightly/', 'continuation-token' => 'a+b/c=='], [], hash('sha256', ''), $O, $t);
    $c = mh_s3_sign('HEAD', '127.0.0.1:8767', '/s3/mathub-test/nightly/my file$1.mhbak', [], [], hash('sha256', ''), $O, $t);
    echo json_encode(array_map(fn($h) => explode('Signature=', $h['authorization'])[1], [$a, $b, $c]));`]).stdout.toString();
  check('requests are signed exactly as AWS signs them (botocore’s signatures)', sigs === JSON.stringify(['40a97d6f5e6de68849b860eb5d1dac4e53f2bae44bfab6cb72ebc612fbef65e3', 'abb366994b75890b1de6956dfa752a9739c964453970e31a6040ef0102a6989d', 'dccda1592cc9295e79ddc7854b57bf51e97677be8e03359120d435c094a6cb46']), sigs);

  // not set up yet
  let r = await api(a, 'admin_offsite');
  check('until it is set up, nothing goes and the panel says what is missing', r.json && r.json.ok && r.json.ready === false && /storage address, bucket and keys/.test(r.json.missing) && !r.json.last_sent, r.json);
  r = await api(a, 'admin_offsite_now', {}); check('Send now says so too', r.status === 502 && /Keys & settings/.test(r.json.error), r.json);
  r = await api(a, 'admin_config_save', { password: 'password123', values: { offsite_endpoint: 'http://storage.example.com' } });
  check('a plain-http address is refused (only https, or this computer for tests)', r.status === 400 && r.json.field === 'offsite_endpoint', r.json);
  r = await api(a, 'admin_config_save', { password: 'password123', values: Object.assign({}, SETTINGS, { offsite_passphrase: 'too short' }) });
  r = await api(a, 'admin_offsite'); check('a passphrase under 12 characters is not enough', r.json.ready === false && /at least 12 characters/.test(r.json.missing), r.json.missing);
  r = await api(a, 'admin_config_test', { what: 'backup' });
  check('Check the storage says the passphrase is too short', r.json && r.json.ok && r.json.pass === false && r.json.results.find(x => x.name === 'Passphrase' && !x.pass && /12 characters/.test(x.message)), r.json);
  r = await api(a, 'admin_config_save', { password: 'password123', values: { offsite_passphrase: PASS } }); check('the settings are saved', r.json && r.json.ok, r.json);
  r = await api(a, 'admin_config_test', { what: 'backup' });
  check('Check the storage writes, reads, lists and deletes a test file', r.json && r.json.ok && r.json.pass === true && ['Write', 'Read', 'List', 'Delete', 'Passphrase'].every(n => r.json.results.find(x => x.name === n && x.pass)), r.json);
  check('and leaves nothing behind', inBucket().length === 0, inBucket());
  r = await api(a, 'admin_offsite'); check('now it is ready', r.json.ready === true && r.json.where === '127.0.0.1 · mathub-test/nightly' && r.json.keep === 3, r.json);

  // send now
  r = await api(a, 'admin_offsite_now', {});
  const sent = r.json && r.json.sent; const key = sent ? 'nightly/' + sent.name : '';
  check('Send now sends the newest copy and checks it', r.json && r.json.ok && /^mathub-\d{8}-\d{4}(-manual)?\.sqlite\.mhbak$/.test(sent.name) && inBucket().includes(key), r.json);
  const raw = fs.existsSync(fileOf(key)) ? fs.readFileSync(fileOf(key)) : Buffer.alloc(0); const meta = fs.existsSync(fileOf(key) + '.meta.json') ? JSON.parse(fs.readFileSync(fileOf(key) + '.meta.json', 'utf8')) : {};
  check('it is encrypted: StudyCat’s header, no SQLite inside', raw.slice(0, 6).equals(Buffer.from('MHBAK\x01', 'latin1')) && !raw.includes(Buffer.from('SQLite format 3')) && !raw.includes(Buffer.from('alice.a@montana.edu')));
  const users = +rows('SELECT COUNT(*) AS n FROM users')[0].n;
  check('the bucket holds the size and SHA-256 that were sent, and how many members', raw.length === sent.size && meta['x-amz-meta-sha256'] === require('crypto').createHash('sha256').update(raw).digest('hex') && meta['x-amz-meta-users'] === String(sent.users) && sent.users === users, { meta, size: raw.length, sent });
  r = await api(a, 'admin_offsite'); check('the panel shows it', r.json.last_sent && r.json.last_sent.name === sent.name && r.json.last_sent.ok && r.json.log[0].kind === 'send', r.json.last_sent);

  // opening it anywhere: the command-line tool
  const enc = tmp('copy.mhbak'), out = tmp('restored.sqlite'), bad = tmp('wrong.sqlite'); fs.writeFileSync(enc, raw); fs.rmSync(out, { force: true }); fs.rmSync(bad, { force: true });
  let t = cp.spawnSync('php', [path.join(ROOT, 'api', 'backup-tool.php'), 'decrypt', enc, out], { env: Object.assign({}, process.env, { MATHUB_BACKUP_PASSPHRASE: PASS }) });
  const head = fs.existsSync(out) ? fs.readFileSync(out).slice(0, 15).toString('latin1') : '';
  check('the copy opens with the passphrase (php backup-tool.php decrypt): the whole database, intact', t.status === 0 && head === 'SQLite format 3' && new RegExp(`integrity: ok · \\d+ tables · ${users} members`).test(t.stdout.toString()), t.stdout.toString() + t.stderr.toString());
  t = cp.spawnSync('php', [path.join(ROOT, 'api', 'backup-tool.php'), 'decrypt', enc, bad], { env: Object.assign({}, process.env, { MATHUB_BACKUP_PASSPHRASE: 'not the passphrase' }) });
  check('and not without it (nothing is left behind)', t.status === 1 && /Wrong passphrase/.test(t.stderr.toString()) && !fs.existsSync(bad), t.stderr.toString());
  t = cp.spawnSync('php', [path.join(ROOT, 'api', 'backup-tool.php'), 'decrypt', enc, out], { env: Object.assign({}, process.env, { MATHUB_BACKUP_PASSPHRASE: PASS }) });
  check('it never writes over a file that is there', t.status === 1 && /already exists/.test(t.stderr.toString()));
  [enc, out].forEach(f => fs.rmSync(f, { force: true }));
  r = await a.evaluate(async () => { const x = await fetch('api/backup-tool.php'); return x.status; });
  check('the tool is not on the web', r === 404, r);

  // the restore test
  r = await api(a, 'admin_offsite_test', {});
  check('Test a restore: downloaded, decrypted and opened; integrity ok, every member there', r.json && r.json.ok && r.json.tested.name === sent.name && new RegExp(`integrity ok · \\d+ tables · ${users} members`).test(r.json.tested.note), r.json);
  fs.writeFileSync(FAIL, JSON.stringify({ corrupt: true }));
  r = await api(a, 'admin_offsite_test', {});
  check('a copy changed in the bucket fails it, and says why', r.status === 502 && /not the one that was sent/.test(r.json.error), r.json);
  fs.rmSync(FAIL, { force: true });
  r = await api(a, 'admin_offsite'); check('the panel shows the failed test', r.json.last_test && r.json.last_test.ok === false && r.json.last_test_ok && r.json.last_test_ok.ok, r.json.last_test);

  // keeping the newest, none older than 90 days, nothing else touched
  const put = (k, ageDays) => { fs.writeFileSync(fileOf(k), 'old'); fs.writeFileSync(fileOf(k) + '.meta.json', '{}'); if (ageDays) { const d = new Date(Date.now() - ageDays * 86400000); fs.utimesSync(fileOf(k), d, d); } };
  put('nightly/mathub-20260103-0300.sqlite.mhbak'); put('nightly/mathub-20260102-0300.sqlite.mhbak', 100); put('nightly/mathub-20260101-0300.sqlite.mhbak'); put('nightly/notes.txt'); put('other/mathub-20250101-0300.sqlite.mhbak');
  r = await api(a, 'admin_offsite_now', {});
  check('sending again keeps the newest 3, deletes one older than 90 days, and touches nothing else', r.json && r.json.ok && JSON.stringify(inBucket()) === JSON.stringify(['nightly/mathub-20260103-0300.sqlite.mhbak', key, 'nightly/notes.txt', 'other/mathub-20250101-0300.sqlite.mhbak'].sort()) && /2 in the bucket/.test(r.json.sent.note), { bucket: inBucket(), note: r.json.sent && r.json.sent.note });

  // a send that fails
  fs.writeFileSync(FAIL, JSON.stringify({ put: 500 }));
  r = await api(a, 'admin_offsite_now', {});
  check('a failed send says what the storage said', r.status === 502 && /InternalError/.test(r.json.error), r.json);
  r = await api(a, 'admin_offsite'); check('and the panel shows it failed', r.json.last_send && r.json.last_send.ok === false && /InternalError/.test(r.json.last_send.note) && r.json.last_sent.name === sent.name, r.json.last_send);
  fs.rmSync(FAIL, { force: true });

  // housekeeping: a new day's copy goes by itself
  const made = (await api(a, 'admin_backup_now', {})).json.backup.name;
  await api(a, 'admin_config_save', { password: 'password123', values: { cron_key: 'offsite-test-cron-key' } });
  r = await a.evaluate(async () => (await fetch('api/index.php?r=cron&key=offsite-test-cron-key')).json());
  check('housekeeping sends a new copy once', r.ok && r.did.includes('off-site: ' + made + '.mhbak') && inBucket().includes('nightly/' + made + '.mhbak'), r.did);
  r = await a.evaluate(async () => (await fetch('api/index.php?r=cron&key=offsite-test-cron-key')).json());
  check('and not twice', r.ok && !r.did.some(x => /^off-site/.test(x)), r.did);

  // administrators only
  const [c2, b] = await mk(1000, 800); await go(b, '#/'); await login(b, 'alice.a@montana.edu');
  check('members cannot see or start any of it', (await api(b, 'admin_offsite')).status === 403 && (await api(b, 'admin_offsite_now', {})).status === 403 && (await api(b, 'admin_offsite_test', {})).status === 403);
  await c2.close();

  // the Backups tab
  await a.reload(); await a.waitForTimeout(800); await go(a, '#/admin/backups', 1800);
  const tab = await txt(a, '.ops-off');
  check('the Backups tab: where copies go, the newest, the last restore test and the failed send', /Off-site copies/.test(tab) && /127\.0\.0\.1 · mathub-test\/nightly/.test(tab) && new RegExp(made.replace(/\./g, '\\.')).test(tab) && /Last restore test/.test(tab) && /backup-tool\.php/.test(tab), tab.slice(0, 600));
  await a.click('[data-action="off-test"]'); await a.waitForFunction(() => /Restore test passed/.test(document.body.textContent), null, { timeout: 15000 }).catch(() => {});
  check('Test a restore now works from the tab', /Restore test passed/.test(await a.evaluate(() => document.body.textContent)));

  // tidy up: settings, the bucket, the log, the copy made here
  await unset(); clean(); fs.rmSync(path.join(ROOT, 'api', 'data', 'backups', made), { force: true });
  await c.close(); await T.finish();
})();
