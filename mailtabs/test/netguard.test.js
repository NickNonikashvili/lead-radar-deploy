'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { assertAllowedHost, isPrivateAddress, normalizeHost, parseIPv6 } = require('../src/netguard');
const { HttpError } = require('../src/errors');

test('isPrivateAddress: IPv4 private, loopback, link-local, CGNAT and reserved ranges', () => {
  const blocked = [
    '127.0.0.1', '127.255.255.254', '10.0.0.1', '10.255.255.255', '172.16.0.1', '172.31.255.255',
    '192.168.1.1', '169.254.169.254', '100.64.0.1', '100.127.255.255', '0.0.0.0', '0.1.2.3',
    '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255', '192.0.0.8', '192.0.2.1',
    '198.18.0.1', '198.51.100.7', '203.0.113.9',
  ];
  for (const ip of blocked) assert.equal(isPrivateAddress(ip), true, ip);

  const allowed = ['8.8.8.8', '1.1.1.1', '142.250.1.108', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '192.169.0.1', '11.0.0.1'];
  for (const ip of allowed) assert.equal(isPrivateAddress(ip), false, ip);
});

test('isPrivateAddress: IPv6 loopback, ULA, link-local, multicast and mapped/embedded IPv4', () => {
  const blocked = [
    '::1', '::', 'fc00::1', 'fd12:3456:789a::1', 'fe80::1', 'fe80::1%eth0', 'febf::1', 'fec0::1', 'ff02::1',
    '::ffff:127.0.0.1', '::ffff:7f00:1', '::ffff:10.0.0.1', '::ffff:169.254.169.254', '::ffff:192.168.0.1',
    '::127.0.0.1', '64:ff9b::a00:1', '64:ff9b::127.0.0.1', '2002:7f00:1::1', '2002:c0a8:101::', '2001:db8::1',
    '[::1]', '0:0:0:0:0:0:0:1',
  ];
  for (const ip of blocked) assert.equal(isPrivateAddress(ip), true, ip);

  const allowed = ['2607:f8b0:4004:c1b::6d', '2a00:1450:4001:82a::200e', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1', '2620:fe::fe'];
  for (const ip of allowed) assert.equal(isPrivateAddress(ip), false, ip);
});

test('isPrivateAddress fails closed on garbage', () => {
  for (const v of ['', 'not-an-ip', '999.1.1.1', '1.2.3', null, undefined, 42, '::ffff::1']) {
    assert.equal(isPrivateAddress(v), true, String(v));
  }
});

test('parseIPv6 expands compressed forms and IPv4 tails', () => {
  assert.deepEqual(parseIPv6('::1'), [0, 0, 0, 0, 0, 0, 0, 1]);
  assert.deepEqual(parseIPv6('::ffff:1.2.3.4'), [0, 0, 0, 0, 0, 0xffff, 0x0102, 0x0304]);
  assert.deepEqual(parseIPv6('2001:db8::8:800:200c:417a'), [0x2001, 0xdb8, 0, 0, 8, 0x800, 0x200c, 0x417a]);
  assert.equal(parseIPv6('1.2.3.4'), null);
});

test('normalizeHost accepts host names / IP literals and rejects junk', () => {
  assert.equal(normalizeHost('  IMAP.Example.COM. '), 'imap.example.com');
  assert.equal(normalizeHost('[::1]'), '::1');
  assert.equal(normalizeHost('127.0.0.1'), '127.0.0.1');
  assert.equal(normalizeHost('mail.bücher.de'), 'mail.xn--bcher-kva.de');
  for (const bad of ['', '   ', 'imap.example.com:993', 'https://imap.example.com', 'user@imap.example.com', 'a b.com', 'a/b', '-bad.com', 'x'.repeat(300), null, 5]) {
    assert.equal(normalizeHost(bad), null, String(bad));
  }
});

async function rejectsWith(promise, code) {
  await assert.rejects(promise, (err) => {
    assert.ok(err instanceof HttpError, `expected HttpError, got ${err && err.name}`);
    assert.equal(err.status, 400);
    assert.equal(err.code, code);
    assert.ok(err.message.length > 10);
    return true;
  });
}

test('assertAllowedHost rejects empty/invalid hosts even when private hosts are allowed', async () => {
  await rejectsWith(assertAllowedHost('', { allowPrivate: true }), 'HOST_NOT_ALLOWED');
  await rejectsWith(assertAllowedHost('   ', {}), 'HOST_NOT_ALLOWED');
  await rejectsWith(assertAllowedHost('http://x.com/', {}), 'HOST_NOT_ALLOWED');
  await rejectsWith(assertAllowedHost(undefined, {}), 'HOST_NOT_ALLOWED');
});

test('assertAllowedHost blocks localhost and private literals unless allowPrivate', async () => {
  for (const host of ['localhost', 'LOCALHOST', 'foo.localhost', '127.0.0.1', '10.1.2.3', '192.168.0.10', '169.254.169.254', '::1', '[::1]', '::ffff:127.0.0.1', 'fd00::5', '100.64.1.1', '0.0.0.0']) {
    await rejectsWith(assertAllowedHost(host, { allowPrivate: false }), 'HOST_NOT_ALLOWED');
  }
  const ok = await assertAllowedHost('127.0.0.1', { allowPrivate: true });
  assert.deepEqual(ok, { host: '127.0.0.1', addresses: [] });
  const ok2 = await assertAllowedHost('localhost', { allowPrivate: true });
  assert.equal(ok2.host, 'localhost');
});

test('assertAllowedHost allows public literals and returns them as the checked addresses', async () => {
  const res = await assertAllowedHost('8.8.8.8', { allowPrivate: false });
  assert.deepEqual(res, { host: '8.8.8.8', addresses: [{ address: '8.8.8.8', family: 4 }] });
  const res6 = await assertAllowedHost('[2607:f8b0:4004:c1b::6d]', {});
  assert.equal(res6.addresses[0].family, 6);
});

test('assertAllowedHost: DNS failure gives a friendly HOST_NOT_FOUND error', async () => {
  // .invalid is reserved and never resolves (RFC 6761).
  await assert.rejects(assertAllowedHost('no-such-server.invalid', { allowPrivate: false }), (err) => {
    assert.ok(err instanceof HttpError);
    assert.equal(err.status, 400);
    assert.equal(err.code, 'HOST_NOT_FOUND');
    assert.match(err.message, /no-such-server\.invalid/);
    return true;
  });
});

test('assertAllowedHost checks every resolved address (a name resolving to loopback is blocked)', async (t) => {
  const dns = require('dns');
  const original = dns.lookup;
  t.after(() => {
    dns.lookup = original;
  });
  dns.lookup = (host, opts, cb) => {
    if (host === 'rebind.example') return cb(null, [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    if (host === 'public.example') return cb(null, [{ address: '2a00:1450:4001:82a::200e', family: 6 }, { address: '93.184.216.34', family: 4 }]);
    if (host === 'mapped.example') return cb(null, [{ address: '::ffff:10.0.0.7', family: 6 }]);
    if (host === 'empty.example') return cb(null, []);
    return original(host, opts, cb);
  };
  await rejectsWith(assertAllowedHost('rebind.example', {}), 'HOST_NOT_ALLOWED');
  await rejectsWith(assertAllowedHost('mapped.example', {}), 'HOST_NOT_ALLOWED');
  await rejectsWith(assertAllowedHost('empty.example', {}), 'HOST_NOT_FOUND');
  const res = await assertAllowedHost('Public.Example', {});
  assert.equal(res.host, 'public.example');
  assert.equal(res.addresses.length, 2);
});
