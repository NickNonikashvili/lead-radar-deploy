'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  COMPOSE_LIMITS,
  validatePayload,
  buildMime,
  prepareCompose,
  parseDraft,
  sanitizeOutgoingHtml,
  normalizeAddress,
  replySubject,
  forwardSubject,
  internalImageRefs,
  replaceInternalImages,
} = require('../src/compose');
const { parseRawMessage } = require('../src/mailparse');
const { parse, headerBlock, headerLines, buildMessage, TINY_PNG } = require('./send-helpers');

const ACCOUNT = { id: 7, user_id: 1, email: 'me@example.com', sender_name: 'Mia Example', imap_user: 'me@example.com', signature_html: '<p>-- <br>Mia</p>' };

function payload(extra = {}) {
  return { accountId: 7, to: [{ name: 'Bob', address: 'bob@example.org' }], subject: 'Hello', html: '<p>Hi <b>Bob</b></p>', ...extra };
}

// ---------------------------------------------------------------------------------------------
// validatePayload
// ---------------------------------------------------------------------------------------------

test('validatePayload normalises and keeps only known fields', () => {
  const p = validatePayload({
    ...payload(),
    to: [{ name: ' Bob ', address: 'Bob@EXAMPLE.org' }, 'Carol <carol@example.org>', 'bob@example.org'],
    cc: [{ address: 'carol@example.org' }, { address: 'dan@example.org' }],
    bcc: ['eve@example.org'],
    attachments: [{ uploadId: 'abcdefghijklmnopqrstuvwx' }, { messageId: '12', index: 1 }, { uploadId: 'abcdefghijklmnopqrstuvwx' }],
    inReplyTo: 'orig@example.org',
    references: ['<a@x>', 'not valid <x>', '<a@x>', 'b@x'],
    replyToMessageId: '12',
    evil: 'dropped',
  });
  assert.deepEqual(p.to, [
    { name: 'Bob', address: 'Bob@example.org' },
    { name: 'Carol', address: 'carol@example.org' },
  ]);
  assert.deepEqual(p.cc, [{ name: '', address: 'dan@example.org' }], 'duplicates across fields are removed (To wins)');
  assert.deepEqual(p.bcc, [{ name: '', address: 'eve@example.org' }]);
  assert.deepEqual(p.attachments, [{ uploadId: 'abcdefghijklmnopqrstuvwx' }, { messageId: 12, index: 1 }]);
  assert.equal(p.inReplyTo, '<orig@example.org>');
  assert.deepEqual(p.references, ['<a@x>', '<b@x>']);
  assert.equal(p.replyToMessageId, 12);
  assert.equal(p.forwardOfMessageId, null);
  assert.equal(p.mode, 'new');
  assert.equal(p.evil, undefined);
});

test('validatePayload refuses what it cannot send safely', () => {
  const bad = (extra, re) => assert.throws(() => validatePayload(payload(extra)), (err) => err.status === 400 && err.code === 'INVALID_COMPOSE' && re.test(err.message));
  bad({ to: [] }, /at least one recipient/);
  bad({ to: [{ address: 'not-an-address' }] }, /not a valid email address/);
  bad({ to: [{ address: 'bob@example.org\r\nBcc: evil@example.com' }] }, /not a valid email address/);
  bad({ to: ['bob@example.org\nBcc: evil@example.com'] }, /invalid characters/);
  bad({ to: [{ address: 'a@b' }] }, /not a valid/);
  bad({ to: [{ address: 'two words@example.org' }] }, /not a valid/);
  bad({ to: [{ name: 5, address: 'bob@example.org' }] }, /names must be text/);
  bad({ to: 'bob@example.org' }, /must be a list/);
  bad({ to: Array.from({ length: 101 }, (_, i) => `u${i}@example.org`) }, /Too many recipients/);
  bad({ to: Array.from({ length: 60 }, (_, i) => `u${i}@example.org`), cc: Array.from({ length: 41 }, (_, i) => `c${i}@example.org`) }, /Too many recipients/);
  bad({ subject: 'x'.repeat(COMPOSE_LIMITS.maxSubject + 1) }, /subject is too long/);
  bad({ subject: { x: 1 } }, /subject must be text/);
  bad({ html: 'x'.repeat(COMPOSE_LIMITS.maxHtmlBytes + 1) }, /too long/);
  bad({ attachments: [{ uploadId: '../../etc/passwd' }] }, /Invalid attachment/);
  bad({ attachments: [{ messageId: 1, index: -1 }] }, /Invalid attachment/);
  bad({ mode: 'spam' }, /Invalid compose mode/);
  bad({ accountId: 'x' }, /Invalid From account/);
  assert.throws(() => validatePayload(null), /missing/);
  // Drafts may be saved before any recipient is entered.
  assert.deepEqual(validatePayload(payload({ to: [] }), { draft: true }).to, []);
});

test('CR/LF in the subject and names can never become headers', async () => {
  const p = validatePayload(payload({ subject: 'Hi\r\nBcc: evil@example.com\r\n\r\nbody', to: [{ name: 'Bob\r\nBcc: evil@example.com', address: 'bob@example.org' }] }));
  assert.equal(p.subject, 'Hi Bcc: evil@example.com body');
  assert.equal(p.to[0].name, 'Bob Bcc: evil@example.com');
  const { raw } = await buildMime({
    account: ACCOUNT,
    payload: p,
    fromName: 'Mia\r\nBcc: evil@example.com',
    attachments: [{ filename: 'a\r\nContent-Type: text/html\r\n\r\n<script>.txt', contentType: 'text/plain\r\nX-Evil: 1', content: Buffer.from('x') }],
  });
  const head = headerBlock(raw);
  assert.ok(!/^bcc:/im.test(head), 'no injected Bcc header');
  assert.ok(!/^x-evil:/im.test(raw.toString()), 'no injected header in the attachment part');
  for (const line of raw.toString().split('\r\n')) assert.ok(!/^Bcc:/i.test(line));
  const parsed = await parse(raw);
  assert.equal(parsed.bcc, undefined);
  assert.deepEqual(parsed.to.value.map((a) => a.address), ['bob@example.org']);
  assert.equal(parsed.attachments.length, 1);
  assert.match(raw.toString(), /\r\nContent-Type: application\/octet-stream; name=htmlscript\.txt\r\n/, 'invalid content type replaced, filename cleaned');
  assert.ok(!/[\r\n]/.test(parsed.attachments[0].filename));
});

test('normalizeAddress accepts real addresses (incl. international) and rejects the rest', () => {
  assert.equal(normalizeAddress('first.last+tag@Sub.Example.COM'), 'first.last+tag@sub.example.com');
  assert.equal(normalizeAddress("o'brien@example.ie"), "o'brien@example.ie");
  assert.equal(normalizeAddress('josé@exämple.de'), 'josé@exämple.de');
  for (const bad of ['', 'plain', '@example.com', 'a@', 'a@b', 'a..b@example.com', '.a@example.com', 'a@-x.com', 'a@example.123', 'a b@c.de', '<a@b.cd>', 'a@b.cd>', 'a@[127.0.0.1]', `${'a'.repeat(65)}@example.com`]) {
    assert.equal(normalizeAddress(bad), null, bad);
  }
});

// ---------------------------------------------------------------------------------------------
// HTML sanitising
// ---------------------------------------------------------------------------------------------

test('outgoing HTML keeps formatting and inline styles but nothing active', () => {
  const html = sanitizeOutgoingHtml(
    '<html><head><title>t</title><style>p{color:red}</style></head><body style="background:#fff">' +
      '<p style="color: #123456; font-weight: bold" class="x" id="y" onclick="steal()">Hello <u>u</u> <s>s</s></p>' +
      '<ul><li>one</li></ul><ol start="3"><li>two</li></ol><blockquote type="cite">q</blockquote>' +
      '<a href="https://example.com" target="_blank">ok</a><a href="javascript:alert(1)">js</a><a href="mailto:x@example.com">m</a>' +
      '<img src="https://example.com/i.png" alt="remote"><img src="cid:abc@x"><img src="data:image/png;base64,iVBORw0KGgo="><img src="data:image/svg+xml;base64,PHN2Zz4=" alt="vector"><img src="file:///etc/passwd">' +
      '<script>alert(1)</script><iframe src="https://evil"></iframe><form action="https://evil"><input name="p"></form><object data="x"></object>' +
      '<div style="position: fixed; top: 0; z-index: 99; color: blue; background: url(javascript:alert(1)); width: expression(alert(1))">overlay</div>' +
      '<span style="background-image: url(https://example.com/bg.png)">bg</span><table border="1"><tr><td colspan="2">c</td></tr></table>' +
      '<div data-mt-signature="whatever" data-evil="1">sig</div></body></html>'
  );
  assert.match(html, /^<div style="background:#fff">/);
  assert.match(html, /<p style="color:#123456;font-weight:bold">Hello <u>u<\/u> <s>s<\/s><\/p>/);
  assert.ok(!/class=|id=|onclick|<style|<script|<iframe|<form|<input|<object|<title|javascript:|expression|position|z-index|file:|svg/i.test(html), html);
  assert.match(html, /<a href="https:\/\/example.com" target="_blank" rel="noopener noreferrer">ok<\/a><a>js<\/a><a href="mailto:x@example.com">m<\/a>/);
  assert.match(html, /<img src="https:\/\/example.com\/i.png" alt="remote" \/><img src="cid:abc@x" \/><img src="data:image\/png;base64,iVBORw0KGgo=" \/><img alt="vector" \/><img \/>/);
  assert.match(html, /<div style="top:0;color:blue">overlay<\/div>/);
  assert.match(html, /url\(&quot;https:\/\/example.com\/bg.png&quot;\)|url\("https:\/\/example.com\/bg.png"\)/);
  assert.match(html, /<td colspan="2">c<\/td>/);
  assert.match(html, /<div data-mt-signature="1">sig<\/div>/);
  // CSS escapes cannot smuggle a forbidden property back in.
  assert.ok(!/position/.test(sanitizeOutgoingHtml('<p style="\\70 osition: fixed; color: red">x</p>')));
  assert.equal(sanitizeOutgoingHtml(null), '');
});

test('images of stored messages are found and replaced by cid: (or dropped)', () => {
  const html = sanitizeOutgoingHtml('<p><img src="/api/messages/12/attachments/0" alt="a"><img src="/api/messages/12/attachments/0"><img src="/api/messages/13/attachments/2" alt="b"><img src="/api/other"></p>');
  assert.deepEqual(internalImageRefs(html).map((r) => [r.messageId, r.index]), [[12, 0], [13, 2]]);
  const out = replaceInternalImages(html, { '/api/messages/12/attachments/0': 'c1@x' });
  assert.equal((out.match(/src="cid:c1@x"/g) || []).length, 2);
  assert.ok(!out.includes('/api/messages/13'), 'unresolved internal image dropped');
});

// ---------------------------------------------------------------------------------------------
// buildMime
// ---------------------------------------------------------------------------------------------

test('buildMime: From name, html + text alternatives, threading headers, attachments, Bcc only in the envelope', async () => {
  const p = validatePayload(
    payload({
      cc: ['carol@example.org'],
      bcc: ['hidden@example.org'],
      subject: 'Grüße & Re: plans',
      html: '<p>Hello <b>Bob</b>,</p><p>see <a href="https://example.com">this</a> <img src="data:image/png;base64,' + TINY_PNG.toString('base64') + '" alt="dot"></p>',
      inReplyTo: '<orig@example.org>',
      references: ['<root@example.org>', '<orig@example.org>'],
    })
  );
  const date = new Date('2026-11-13T09:30:00Z');
  const { raw, messageId, envelope } = await buildMime({
    account: ACCOUNT,
    payload: p,
    date,
    attachments: [{ filename: 'report.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 test') }],
  });
  assert.match(messageId, /^<[0-9a-f-]{36}@example\.com>$/);
  assert.deepEqual(envelope, { from: 'me@example.com', to: ['bob@example.org', 'carol@example.org', 'hidden@example.org'] });
  assert.ok(raw.toString().includes('\r\n'), 'CRLF line endings');
  assert.ok(!/(^|[^\r])\n/.test(raw.toString()), 'no bare LF');

  const head = headerBlock(raw);
  assert.deepEqual(headerLines(raw, 'Message-ID'), [`Message-ID: ${messageId}`]);
  assert.deepEqual(headerLines(raw, 'In-Reply-To'), ['In-Reply-To: <orig@example.org>']);
  assert.deepEqual(headerLines(raw, 'References'), ['References: <root@example.org> <orig@example.org>']);
  assert.ok(!/^bcc:/im.test(head), 'Bcc is never in the headers of sent mail');
  assert.ok(!/^x-mailer:/im.test(head), 'no X-Mailer');

  const parsed = await parse(raw);
  assert.equal(parsed.from.value[0].name, 'Mia Example');
  assert.equal(parsed.from.value[0].address, 'me@example.com');
  assert.equal(parsed.subject, 'Grüße & Re: plans');
  assert.equal(parsed.date.toISOString(), date.toISOString());
  assert.deepEqual(parsed.cc.value.map((a) => a.address), ['carol@example.org']);
  assert.match(parsed.html, /<b>Bob<\/b>/);
  assert.match(parsed.text, /Hello Bob,/);
  assert.match(parsed.text, /this \[https:\/\/example.com\]/);
  // The data: image became an embedded part; the PDF is a regular attachment.
  const inline = parsed.attachments.find((a) => a.contentType === 'image/png');
  assert.ok(inline && inline.cid, 'data: image embedded with a Content-ID');
  assert.ok(parsed.html.includes(`cid:${inline.cid}`));
  assert.ok(!parsed.html.includes('data:image'));
  const pdf = parsed.attachments.find((a) => a.filename === 'report.pdf');
  assert.equal(pdf.contentType, 'application/pdf');
  assert.equal(pdf.contentDisposition, 'attachment');
  assert.equal(pdf.content.toString(), '%PDF-1.4 test');
  assert.match(raw.toString(), /Content-Type: multipart\/mixed/);
  assert.match(raw.toString(), /Content-Type: multipart\/alternative/);
});

test('buildMime: drafts keep the Bcc header but not in the envelope; size limit', async () => {
  const p = validatePayload(payload({ bcc: ['hidden@example.org'] }));
  const { raw, envelope } = await buildMime({ account: ACCOUNT, payload: p, draft: true });
  assert.deepEqual(headerLines(raw, 'Bcc'), ['Bcc: hidden@example.org']);
  assert.deepEqual(envelope.to, ['bob@example.org']);

  // A draft without recipients is fine.
  const empty = await buildMime({ account: ACCOUNT, payload: validatePayload(payload({ to: [] }), { draft: true }), draft: true });
  assert.equal(headerLines(empty.raw, 'To').length, 0);

  await assert.rejects(
    buildMime({ account: ACCOUNT, payload: p, attachments: [{ filename: 'big.bin', contentType: 'application/octet-stream', content: Buffer.alloc(COMPOSE_LIMITS.maxAttachmentBytes + 1) }] }),
    (err) => err.status === 400 && err.code === 'ATTACHMENTS_TOO_LARGE'
  );
});

test('buildMime never sends app-internal image URLs', async () => {
  const p = validatePayload(payload({ html: '<p>x<img src="/api/messages/5/attachments/0" alt="logo"></p>' }));
  const { raw } = await buildMime({ account: ACCOUNT, payload: p });
  assert.ok(!raw.toString().includes('/api/messages/'));
});

// ---------------------------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------------------------

test('Re: / Fwd: are added once, never stacked', () => {
  assert.equal(replySubject('Lunch'), 'Re: Lunch');
  assert.equal(replySubject('Re: Lunch'), 'Re: Lunch');
  assert.equal(replySubject('RE: re: Re:Lunch'), 'Re: Lunch');
  assert.equal(replySubject('Aw: Lunch'), 'Re: Lunch');
  assert.equal(replySubject('Re[2]: Lunch'), 'Re: Lunch');
  assert.equal(replySubject('Fwd: Lunch'), 'Re: Fwd: Lunch');
  assert.equal(replySubject(null), 'Re:');
  assert.equal(forwardSubject('Lunch'), 'Fwd: Lunch');
  assert.equal(forwardSubject('FW: Fwd: Lunch'), 'Fwd: Lunch');
  assert.equal(forwardSubject('Re: Lunch'), 'Fwd: Re: Lunch');
});

// ---------------------------------------------------------------------------------------------
// prepareCompose
// ---------------------------------------------------------------------------------------------

const ACCOUNTS = [ACCOUNT, { id: 8, email: 'me@work.example', imap_user: 'me@work.example' }];

function original(extra = {}) {
  return {
    id: 42,
    account_id: 7,
    message_id: '<orig@example.org>',
    in_reply_to: '<parent@example.org>',
    references_json: JSON.stringify(['<root@example.org>', '<parent@example.org>']),
    from_name: 'Bob Sender',
    from_address: 'bob@example.org',
    to_json: JSON.stringify([{ name: 'Mia', address: 'ME@example.com' }, { name: 'Carol', address: 'carol@example.org' }]),
    cc_json: JSON.stringify([{ name: '', address: 'dan@example.org' }, { name: 'Work me', address: 'me@work.example' }, { name: 'Carol again', address: 'CAROL@example.org' }]),
    reply_to_json: '[]',
    subject: 'Re: Plans',
    date: Date.UTC(2026, 10, 12, 14, 5),
    html_body: '<style>p{color:red}</style><p class="x">See you <b>soon</b></p><img src="/api/messages/42/attachments/1" alt="logo">',
    text_body: 'See you soon',
    snippet: 'See you soon',
    attachments_json: JSON.stringify([
      { index: 0, filename: 'agenda.pdf', contentType: 'application/pdf', size: 1234, inline: false },
      { index: 1, filename: 'logo.png', contentType: 'image/png', size: 70, inline: true },
    ]),
    ...extra,
  };
}

test('prepareCompose new: empty message with the signature block', () => {
  const p = prepareCompose({ mode: 'new', account: ACCOUNT, accounts: ACCOUNTS });
  assert.equal(p.accountId, 7);
  assert.deepEqual([p.to, p.cc, p.bcc, p.subject, p.attachments], [[], [], [], '', []]);
  assert.equal(p.html, '<p><br></p><div><br></div><div data-mt-signature="1"><p>-- <br />Mia</p></div>');
  assert.equal(prepareCompose({ mode: 'new', account: { ...ACCOUNT, signature_html: '' } }).html, '<p><br></p>');
});

test('prepareCompose reply: Reply-To or From, threading, quote', () => {
  const p = prepareCompose({ mode: 'reply', original: original(), account: ACCOUNT, accounts: ACCOUNTS });
  assert.deepEqual(p.to, [{ name: 'Bob Sender', address: 'bob@example.org' }]);
  assert.deepEqual(p.cc, []);
  assert.equal(p.subject, 'Re: Plans');
  assert.equal(p.inReplyTo, '<orig@example.org>');
  assert.deepEqual(p.references, ['<root@example.org>', '<parent@example.org>', '<orig@example.org>']);
  assert.equal(p.replyToMessageId, 42);
  assert.equal(p.mode, 'reply');
  assert.equal(p.accountId, 7);
  assert.ok(p.html.startsWith('<p><br></p><div><br></div><div data-mt-signature="1">'));
  assert.match(p.html, /<div>On Thu, Nov 12, 2026, 2:05 PM UTC, Bob Sender &lt;bob@example.org&gt; wrote:<br><\/div><blockquote type="cite"/);
  assert.match(p.html, /<blockquote[^>]*><p>See you <b>soon<\/b><\/p><img src="\/api\/messages\/42\/attachments\/1" alt="logo" \/><\/blockquote>$/);
  assert.ok(!/<style|class=/.test(p.html), 'quoted mail cannot restyle the app');
  assert.deepEqual(p.attachments, [], 'replies do not carry attachments');

  // Reply-To wins over From.
  const withReplyTo = prepareCompose({ mode: 'reply', original: original({ reply_to_json: JSON.stringify([{ name: 'List', address: 'list@example.org' }]) }), account: ACCOUNT, accounts: ACCOUNTS });
  assert.deepEqual(withReplyTo.to, [{ name: 'List', address: 'list@example.org' }]);

  // A time zone can be given for the attribution line.
  const tz = prepareCompose({ mode: 'reply', original: original(), account: ACCOUNT, accounts: ACCOUNTS, timeZone: 'Europe/Berlin' });
  assert.match(tz.html, /On Thu, Nov 12, 2026, 3:05 PM, Bob/);

  // Plain-text originals are escaped.
  const text = prepareCompose({ mode: 'reply', original: original({ html_body: null, text_body: 'a < b\nhttps://example.com/x' }), account: ACCOUNT, accounts: ACCOUNTS });
  assert.match(text.html, /<blockquote[^>]*><div>a &lt; b<br><a href="https:\/\/example.com\/x"/);
});

test('prepareCompose: a huge original is quoted as (shortened) text, so the reply stays sendable', () => {
  const big = original({ html_body: `<p>${'x'.repeat(1_600_000)}</p>`, text_body: 'y'.repeat(1_000_000) });
  const p = prepareCompose({ mode: 'reply', original: big, account: ACCOUNT, accounts: ACCOUNTS });
  assert.ok(Buffer.byteLength(p.html) < COMPOSE_LIMITS.maxHtmlBytes);
  assert.match(p.html, /y{1000}/);
  assert.match(p.html, /\[…\]<\/div><\/blockquote>$/);
  assert.ok(validatePayload({ ...p, to: p.to }).html.length > 0);
});

test('prepareCompose replyAll: everyone except all of my addresses, deduped', () => {
  const p = prepareCompose({ mode: 'replyAll', original: original(), account: ACCOUNT, accounts: ACCOUNTS });
  assert.deepEqual(p.to.map((r) => r.address), ['bob@example.org', 'carol@example.org']);
  assert.deepEqual(p.cc.map((r) => r.address), ['dan@example.org'], 'own work address and duplicate Carol removed');
  assert.equal(p.mode, 'replyAll');

  // Replying to my own sent message goes to its recipients.
  const sent = original({ from_name: 'Mia', from_address: 'me@example.com', to_json: JSON.stringify([{ name: 'Zed', address: 'zed@example.org' }]), cc_json: '[]' });
  assert.deepEqual(prepareCompose({ mode: 'reply', original: sent, account: ACCOUNT, accounts: ACCOUNTS }).to.map((r) => r.address), ['zed@example.org']);
  assert.deepEqual(prepareCompose({ mode: 'replyAll', original: sent, account: ACCOUNT, accounts: ACCOUNTS }).to.map((r) => r.address), ['zed@example.org']);

  // A note to self stays addressed to self.
  const self = original({ from_address: 'me@example.com', to_json: JSON.stringify([{ address: 'me@example.com' }]), cc_json: '[]' });
  assert.deepEqual(prepareCompose({ mode: 'replyAll', original: self, account: ACCOUNT, accounts: ACCOUNTS }).to.map((r) => r.address), ['me@example.com']);

  // Garbage addresses in the stored lists are skipped.
  const junk = original({ cc_json: JSON.stringify([{ address: 'undisclosed-recipients:;' }, { address: 'x\r\n@y' }, 'str']) });
  assert.deepEqual(prepareCompose({ mode: 'replyAll', original: junk, account: ACCOUNT, accounts: ACCOUNTS }).cc, []);
});

test('prepareCompose forward: header block, original body, non-inline attachments', () => {
  const p = prepareCompose({ mode: 'forward', original: original({ subject: 'Plans' }), account: ACCOUNT, accounts: ACCOUNTS });
  assert.equal(p.subject, 'Fwd: Plans');
  assert.deepEqual([p.to, p.cc], [[], []]);
  assert.equal(p.forwardOfMessageId, 42);
  assert.equal(p.inReplyTo, null);
  assert.match(
    p.html,
    /<div>---------- Forwarded message ---------<br>From: Bob Sender &lt;bob@example.org&gt;<br>Date: Thu, Nov 12, 2026, 2:05 PM UTC<br>Subject: Plans<br>To: Mia &lt;ME@example.com&gt;, Carol &lt;carol@example.org&gt;<br>Cc: dan@example.org, Work me &lt;me@work.example&gt;, Carol again &lt;CAROL@example.org&gt;<br><br><\/div>/
  );
  assert.match(p.html, /<div><p>See you <b>soon<\/b><\/p><img src="\/api\/messages\/42\/attachments\/1" alt="logo" \/><\/div>$/);
  assert.deepEqual(p.attachments, [{ messageId: 42, index: 0, filename: 'agenda.pdf', contentType: 'application/pdf', size: 1234 }]);
  // The prepared payload validates as-is once a recipient is added.
  const v = validatePayload({ ...p, to: ['zed@example.org'] });
  assert.deepEqual(v.attachments, [{ messageId: 42, index: 0 }]);
  assert.equal(v.mode, 'forward');

  // Escaped subject/names in the header block.
  const evil = prepareCompose({ mode: 'forward', original: original({ subject: '<script>x</script>', from_name: '<img src=x onerror=alert(1)>' }), account: ACCOUNT });
  assert.ok(!/<script|<img src=x/.test(evil.html));
});

// ---------------------------------------------------------------------------------------------
// parseDraft
// ---------------------------------------------------------------------------------------------

test('parseDraft turns a saved draft back into a payload', async () => {
  const raw = buildMessage({
    from: 'Mia <me@example.com>',
    to: 'Bob <bob@example.org>',
    cc: 'carol@example.org',
    subject: 'Draft subject',
    html: '<p>Draft <b>body</b><img src="cid:logo@x"></p>',
    attachments: [
      { filename: 'notes.txt', contentType: 'text/plain', content: 'n' },
      { filename: 'logo.png', contentType: 'image/png', content: TINY_PNG, cid: 'logo@x' },
    ],
  });
  const parsed = await parseRawMessage(raw);
  const p = parseDraft({ ...parsed, bcc: [{ name: '', address: 'hidden@example.org' }], inReplyTo: '<orig@example.org>', references: ['<orig@example.org>'] }, { id: 99, account_id: 7 });
  assert.equal(p.accountId, 7);
  assert.deepEqual(p.to, [{ name: 'Bob', address: 'bob@example.org' }]);
  assert.deepEqual(p.cc, [{ name: '', address: 'carol@example.org' }]);
  assert.deepEqual(p.bcc, [{ name: '', address: 'hidden@example.org' }]);
  assert.equal(p.subject, 'Draft subject');
  assert.equal(p.mode, 'reply');
  assert.equal(p.inReplyTo, '<orig@example.org>');
  assert.match(p.html, /<b>body<\/b><img src="\/api\/messages\/99\/attachments\/\d" \/>/, 'inline image shown from the draft itself');
  assert.deepEqual(p.attachments.map((a) => [a.messageId, a.filename]), [[99, 'notes.txt']]);
  assert.deepEqual(validatePayload(p).attachments, [{ messageId: 99, index: p.attachments[0].index }]);
});
