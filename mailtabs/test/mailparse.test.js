'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseRawMessage,
  sanitizeEmailHtml,
  rewriteCidLinks,
  makeSnippet,
  renderBodyDocument,
  countRemoteImages,
  linkifyText,
} = require('../src/mailparse');
const { buildMessage, TINY_PNG } = require('./engine-helpers');

// ---------------------------------------------------------------------------------------------
// XSS hardening
// ---------------------------------------------------------------------------------------------

const XSS_CASES = [
  ['<script>alert(1)</script><p>hi</p>', /<script|alert/i],
  ['<img src="x" onerror="alert(1)">', /onerror|alert/i],
  ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
  ['<a href="JaVa&#115;cript:alert(1)">x</a>', /javascript|alert/i],
  ['<a href="  javascript:alert(1)">x</a>', /javascript/i],
  ['<a href="vbscript:msgbox(1)">x</a>', /vbscript/i],
  ['<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>', /data:/i],
  ['<iframe src="https://evil.example/"></iframe>', /<iframe|evil/i],
  ['<form action="https://evil.example/"><input name="pw"><button>Go</button></form>', /<form|<input|<button|evil/i],
  ['<svg onload="alert(1)"><circle r="1"/></svg>', /<svg|onload|alert/i],
  ['<svg><style><img src=x onerror=alert(1)></style></svg>', /<svg|onerror/i],
  // sanitize-html turns the '<' into a CSS escape inside <style>, so only a real tag would be a problem.
  ['<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>', /<img[^>]*onerror|<math|<mglyph/i],
  ['<meta http-equiv="refresh" content="0;url=https://evil.example/">', /<meta|refresh|evil/i],
  ['<base href="https://evil.example/">', /<base|evil/i],
  ['<link rel="stylesheet" href="https://evil.example/x.css">', /<link|evil/i],
  ['<object data="https://evil.example/x.swf"></object><embed src="https://evil.example/y">', /<object|<embed|evil/i],
  ['<video src="https://evil.example/v.mp4"></video><audio src="https://evil.example/a.mp3"></audio>', /<video|<audio|evil/i],
  ['<div onclick="alert(1)" onmouseover="alert(2)">x</div>', /onclick|onmouseover|alert/i],
  ['<noscript><img src=x onerror=alert(1)></noscript>', /onerror|<noscript/i],
  ['<textarea><img src=x onerror=alert(1)></textarea>', /onerror|<textarea/i],
  ['<template><img src=x onerror=alert(1)></template>', /onerror|<template/i],
  ['<img src="javascript:alert(1)">', /javascript/i],
  ['<img src="data:text/html,<script>alert(1)</script>">', /data:text|script/i],
  ['<p style="background:url(javascript:alert(1))">x</p>', /javascript/i],
  ['<style>@import url("https://evil.example/x.css"); p{color:red}</style>', /@import|evil/i],
];

for (const [input, forbidden] of XSS_CASES) {
  test(`sanitizeEmailHtml neutralises: ${input.slice(0, 60)}`, () => {
    const out = sanitizeEmailHtml(input);
    assert.doesNotMatch(out, forbidden, out);
  });
}

test('sanitizeEmailHtml keeps ordinary email formatting', () => {
  const html =
    '<table width="600" cellpadding="4" bgcolor="#ffffff" border="0"><tr><td align="center" valign="top" colspan="2" style="color:#333">' +
    '<h1>Hi</h1><p><b>bold</b> <i>it</i> <u>u</u> <font color="red" face="Arial" size="3">font</font></p>' +
    '<center>c</center><blockquote>q</blockquote><ul><li>one</li></ul><pre><code>x</code></pre>' +
    '<img src="https://img.example/logo.png" alt="Logo" width="100" height="20"><img src="cid:abc@x">' +
    '<img src="data:image/png;base64,AAAA"></td></tr></table><style>.a{color:red}</style>';
  const out = sanitizeEmailHtml(html);
  for (const fragment of [
    '<table width="600" cellpadding="4" bgcolor="#ffffff" border="0">',
    'align="center"',
    'valign="top"',
    'colspan="2"',
    'style="color:#333"',
    '<h1>Hi</h1>',
    '<b>bold</b>',
    '<font color="red" face="Arial" size="3">',
    '<center>',
    '<blockquote>',
    '<img src="https://img.example/logo.png" alt="Logo" width="100" height="20" />',
    '<img src="cid:abc@x" />',
    '<img src="data:image/png;base64,AAAA" />',
    '<style>.a{color:red}</style>',
  ]) {
    assert.ok(out.includes(fragment), `missing ${fragment} in ${out}`);
  }
});

test('links open in a new tab without referrer/opener; relative URLs are dropped', () => {
  const out = sanitizeEmailHtml(
    '<a href="https://example.com/x" target="_self" rel="opener">a</a><a href="mailto:a@b.c">m</a><a href="#top">t</a><a href="/api/auth/logout">rel</a><img src="/api/x">'
  );
  assert.ok(out.includes('<a href="https://example.com/x" target="_blank" rel="noopener noreferrer">a</a>'), out);
  assert.ok(out.includes('<a href="mailto:a@b.c" target="_blank" rel="noopener noreferrer">m</a>'), out);
  assert.ok(out.includes('href="#top"'), out);
  assert.doesNotMatch(out, /\/api\//);
});

test('CSS url() pointing at relative paths is neutralised, remote ones kept', () => {
  const out = sanitizeEmailHtml(
    '<div style="background-image:url(/api/oauth/google/start);color:red">a</div><style>body{background:url(\'/api/x\')} .b{background:url(https://img.example/bg.png)}</style>'
  );
  assert.doesNotMatch(out, /\/api\//);
  assert.ok(out.includes('color:red'));
  assert.ok(out.includes('url(https://img.example/bg.png)'));
});

test('<title> text and <head> clutter do not leak into the body; <body> becomes a div', () => {
  const out = sanitizeEmailHtml('<html><head><title>Secret title</title></head><body bgcolor="#eee"><p>Body</p></body></html>');
  assert.doesNotMatch(out, /Secret title/);
  assert.ok(out.includes('<div bgcolor="#eee"><p>Body</p></div>'), out);
});

// ---------------------------------------------------------------------------------------------
// Remote images / cid / document
// ---------------------------------------------------------------------------------------------

test('countRemoteImages counts http(s) and protocol-relative images and CSS urls', () => {
  assert.equal(countRemoteImages(''), 0);
  assert.equal(countRemoteImages(null), 0);
  assert.equal(
    countRemoteImages('<img src="https://a/x.png"><img src="http://b/y.gif"><img src="//c/z.png"><img src="cid:q"><img src="data:image/png;base64,AA">'),
    3
  );
  assert.equal(countRemoteImages('<div style="background:url(https://t.example/p.gif)">x</div>'), 1);
});

test('rewriteCidLinks points cid: references at the attachment endpoint', () => {
  const atts = [
    { index: 0, cid: 'other@x' },
    { index: 2, cid: 'logo@example.com' },
  ];
  const html = '<img src="cid:logo@example.com"><div style="background:url(cid:other@x)"></div><img src="cid:unknown@x"><p>text mentioning cid:logo@example.com</p>';
  const out = rewriteCidLinks(html, 17, atts);
  assert.ok(out.includes('<img src="/api/messages/17/attachments/2">'), out);
  assert.ok(out.includes('url(/api/messages/17/attachments/0)'), out);
  assert.ok(out.includes('src="cid:unknown@x"'), 'unknown cid untouched');
  assert.ok(out.includes('text mentioning cid:logo@example.com'), 'plain text untouched');
  assert.equal(rewriteCidLinks(html, 17, []), html);
  assert.equal(rewriteCidLinks(null, 1, atts), '');
});

test('renderBodyDocument blocks remote images unless showImages, keeps alt and inline images', () => {
  const html = sanitizeEmailHtml(
    '<p>Hello</p><img src="https://tracker.example/p.gif" alt="pixel" width="1"><img src="//cdn.example/a.png"><img src="cid:x@y"><img src="data:image/png;base64,AAAA">'
  );
  const withCid = rewriteCidLinks(html, 5, [{ index: 0, cid: 'x@y' }]);

  const blocked = renderBodyDocument({ html: withCid, subject: 'Hi' }, { showImages: false });
  assert.doesNotMatch(blocked, /tracker\.example|cdn\.example/);
  assert.ok(blocked.includes('alt="pixel"'));
  assert.ok(blocked.includes('data-blocked="1"'));
  assert.ok(blocked.includes('src="/api/messages/5/attachments/0"'), 'inline cid image still shown');
  assert.ok(blocked.includes('src="data:image/png;base64,AAAA"'));

  const shown = renderBodyDocument({ html: withCid, subject: 'Hi' }, { showImages: true });
  assert.ok(shown.includes('src="https://tracker.example/p.gif"'));
  assert.ok(shown.includes('src="//cdn.example/a.png"'));
  assert.doesNotMatch(shown, /data-blocked="1"/);
});

test('renderBodyDocument document skeleton', () => {
  const doc = renderBodyDocument({ html: '<p>x</p>', subject: '<script>alert(1)</script>' }, {});
  assert.match(doc, /^<!DOCTYPE html>/);
  assert.ok(doc.includes('<meta charset="utf-8">'));
  assert.ok(doc.includes('<base target="_blank">'));
  assert.ok(doc.includes('font-family:system-ui'));
  assert.ok(doc.includes('img{max-width:100%}'));
  assert.ok(doc.includes('color-scheme:light'));
  assert.ok(doc.includes('word-wrap:break-word'));
  assert.ok(doc.includes('padding:16px'));
  assert.ok(doc.includes('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>'));
  assert.doesNotMatch(doc, /<script/);
});

test('renderBodyDocument re-sanitizes stored HTML defensively', () => {
  const doc = renderBodyDocument({ html: '<p>ok</p><script>alert(1)</script><img src=x onerror=alert(1)>' }, { showImages: true });
  assert.doesNotMatch(doc, /<script|onerror/);
  assert.ok(doc.includes('<p>ok</p>'));
});

test('plain-text messages are escaped and linkified', () => {
  const doc = renderBodyDocument({ text: 'Hi <b>there</b> & "you"\nSee https://example.com/a?b=1&c=2. Or (www.example.org/path).\n<script>x</script>' }, {});
  assert.ok(doc.includes('<pre class="mt-text">'));
  assert.ok(doc.includes('Hi &lt;b&gt;there&lt;/b&gt; &amp; &quot;you&quot;'), doc);
  assert.ok(doc.includes('<a href="https://example.com/a?b=1&amp;c=2" target="_blank" rel="noopener noreferrer">https://example.com/a?b=1&amp;c=2</a>.'), doc);
  assert.ok(doc.includes('(<a href="http://www.example.org/path" target="_blank" rel="noopener noreferrer">www.example.org/path</a>)'), doc);
  assert.ok(doc.includes('&lt;script&gt;x&lt;/script&gt;'));
  assert.doesNotMatch(doc, /<script>/);
});

test('linkifyText keeps balanced parentheses and refuses javascript: text', () => {
  assert.ok(linkifyText('https://en.wikipedia.org/wiki/Foo_(bar)').includes('href="https://en.wikipedia.org/wiki/Foo_(bar)"'));
  assert.doesNotMatch(linkifyText('javascript:alert(1)'), /<a /);
  assert.ok(linkifyText('https://x.example/"onmouseover="alert(1)').includes('href="https://x.example/"'));
});

test('empty body renders a placeholder', () => {
  assert.ok(renderBodyDocument({ html: '', text: '  ' }, {}).includes('This message has no text.'));
});

// ---------------------------------------------------------------------------------------------
// Snippets
// ---------------------------------------------------------------------------------------------

test('makeSnippet collapses whitespace, drops invisible padding and caps at 200 chars', () => {
  assert.equal(makeSnippet(''), '');
  assert.equal(makeSnippet(null), '');
  assert.equal(makeSnippet('  Hello\n\n\tworld  '), 'Hello world');
  assert.equal(makeSnippet('Preview‌ ‌ ͏ text'), 'Preview text');
  assert.equal(makeSnippet('Click [https://example.com/x] now'), 'Click now');
  const long = makeSnippet('word '.repeat(100));
  assert.ok(long.length <= 200, String(long.length));
  assert.ok(long.endsWith('…'));
  const emoji = makeSnippet('😀'.repeat(150));
  assert.ok(emoji.length <= 200);
  assert.doesNotMatch(emoji, /[\ud800-\udbff]…$/, 'no dangling surrogate');
});

// ---------------------------------------------------------------------------------------------
// MIME parsing
// ---------------------------------------------------------------------------------------------

test('parseRawMessage: multipart/alternative with inline cid image and an attachment', async () => {
  const raw = buildMessage({
    from: '"Ann Example" <ann@example.com>',
    to: 'alice@test.local, "Bob" <bob@example.com>',
    cc: 'carol@example.com',
    subject: 'Quarterly report ✓',
    text: 'Plain version',
    html: '<p>Hello <b>there</b></p><img src="cid:logo@ex"><img src="https://tracker.example/p.gif"><script>alert(1)</script>',
    date: new Date('2026-01-02T03:04:05Z'),
    messageId: '<report-1@example.com>',
    attachments: [
      { filename: 'logo.png', contentType: 'image/png', content: TINY_PNG, cid: 'logo@ex' },
      { filename: 'report.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-1.4 fake') },
    ],
  });
  const p = await parseRawMessage(raw);
  assert.equal(p.messageId, '<report-1@example.com>');
  assert.equal(p.subject, 'Quarterly report ✓');
  assert.deepEqual(p.from, { name: 'Ann Example', address: 'ann@example.com' });
  assert.deepEqual(p.to, [
    { name: '', address: 'alice@test.local' },
    { name: 'Bob', address: 'bob@example.com' },
  ]);
  assert.deepEqual(p.cc, [{ name: '', address: 'carol@example.com' }]);
  assert.deepEqual(p.replyTo, []);
  assert.equal(p.date, Date.parse('2026-01-02T03:04:05Z'));
  assert.equal(p.text, 'Plain version');
  assert.ok(p.html.includes('src="cid:logo@ex"'), 'cid links are not rewritten yet');
  assert.doesNotMatch(p.html, /<script/);
  assert.equal(p.snippet, 'Plain version');
  assert.equal(p.remoteImageCount, 1);
  assert.equal(p.attachments.length, 2);
  const [logo, pdf] = p.attachments;
  assert.equal(logo.index, 0);
  assert.equal(logo.filename, 'logo.png');
  assert.equal(logo.contentType, 'image/png');
  assert.equal(logo.cid, 'logo@ex');
  assert.equal(logo.inline, true);
  assert.ok(Buffer.isBuffer(logo.content));
  assert.ok(logo.content.equals(TINY_PNG));
  assert.equal(logo.size, TINY_PNG.length);
  assert.equal(pdf.index, 1);
  assert.equal(pdf.inline, false);
  assert.equal(pdf.cid, null);
  assert.equal(p.hasAttachments, true);
});

test('parseRawMessage: inline-only images do not count as attachments; unreferenced cid parts do', async () => {
  const inlineOnly = await parseRawMessage(
    buildMessage({ html: '<img src="cid:a@b">', attachments: [{ filename: 'a.png', contentType: 'image/png', content: TINY_PNG, cid: 'a@b' }] })
  );
  assert.equal(inlineOnly.hasAttachments, false);
  const unreferenced = await parseRawMessage(
    buildMessage({ html: '<p>no image here</p>', attachments: [{ filename: 'a.png', contentType: 'image/png', content: TINY_PNG, cid: 'a@b' }] })
  );
  assert.equal(unreferenced.attachments[0].inline, false);
  assert.equal(unreferenced.hasAttachments, true);
});

test('parseRawMessage: HTML-only message gets text and a clean snippet', async () => {
  const p = await parseRawMessage(
    buildMessage({
      html: '<html><head><style>p{color:red}</style><title>T</title></head><body><div style="display:none">Your weekly digest &zwnj;&nbsp;&zwnj;&nbsp;</div><h1>Hello</h1><p>World <a href="https://ex.com/x">link</a></p><img src="https://t.example/p.gif"></body></html>',
    })
  );
  assert.ok(p.text.includes('World'));
  assert.doesNotMatch(p.snippet, /<|color:red|https:\/\/t\.example/);
  assert.match(p.snippet, /^Your weekly digest HELLO World link$/i);
  assert.equal(p.remoteImageCount, 1);
  assert.equal(p.hasAttachments, false);
});

test('parseRawMessage: ISO-8859-1 body, Q/B-encoded headers, groups, missing date', async () => {
  const head =
    'From: =?ISO-8859-1?Q?Andr=E9_M=FCller?= <andre@example.com>\r\n' +
    'To: undisclosed: a@example.com, b@example.com;\r\n' +
    'Reply-To: replies@example.com\r\n' +
    'Subject: =?UTF-8?B?w4ljb2xlIOKAlCByw6lzdW3DqQ==?=\r\n' +
    'Message-ID: <latin1@example.com>\r\n' +
    'MIME-Version: 1.0\r\n' +
    'Content-Type: text/plain; charset=ISO-8859-1\r\n' +
    'Content-Transfer-Encoding: 8bit\r\n\r\n';
  const body = Buffer.from([0x43, 0x61, 0x66, 0xe9, 0x20, 0x26, 0x20, 0x63, 0x72, 0xe8, 0x6d, 0x65, 0x0d, 0x0a]); // "Café & crème"
  const p = await parseRawMessage(Buffer.concat([Buffer.from(head, 'latin1'), body]));
  assert.equal(p.subject, 'École — résumé');
  assert.deepEqual(p.from, { name: 'André Müller', address: 'andre@example.com' });
  assert.deepEqual(p.to.map((a) => a.address), ['a@example.com', 'b@example.com']);
  assert.deepEqual(p.replyTo, [{ name: '', address: 'replies@example.com' }]);
  assert.equal(p.text, 'Café & crème');
  assert.equal(p.html, null);
  assert.equal(p.snippet, 'Café & crème');
  assert.equal(p.date, null);
  assert.deepEqual(p.attachments, []);
});

test('parseRawMessage: quoted-printable windows-1252 HTML', async () => {
  const raw =
    'From: shop@example.com\r\nSubject: =?windows-1252?Q?=93Smart=94_quotes?=\r\nMIME-Version: 1.0\r\n' +
    'Content-Type: text/html; charset=windows-1252\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\n' +
    '<p>Price: =8020 =96 caf=E9</p>\r\n';
  const p = await parseRawMessage(Buffer.from(raw, 'latin1'));
  assert.equal(p.subject, '“Smart” quotes');
  assert.ok(p.html.includes('Price: €20 – café'), p.html);
  assert.equal(p.snippet, 'Price: €20 – café');
});

test('parseRawMessage: attachment without a filename gets a sensible default', async () => {
  const raw =
    'From: a@example.com\r\nSubject: noname\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="b"\r\n\r\n' +
    '--b\r\nContent-Type: text/plain\r\n\r\nhello\r\n' +
    '--b\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment\r\nContent-Transfer-Encoding: base64\r\n\r\nJVBERi0=\r\n--b--\r\n';
  const p = await parseRawMessage(Buffer.from(raw));
  assert.equal(p.attachments.length, 1);
  assert.equal(p.attachments[0].filename, 'attachment-1.pdf');
  assert.equal(p.hasAttachments, true);
});

test('URL forms browsers normalise (https:host, backslashes, whitespace) cannot dodge image blocking', () => {
  const html = sanitizeEmailHtml(
    '<img src="https:tracker.example/a.gif"><img src="\\\\evil.example/b.gif"><img src="/\\evil.example/c.gif"><img src="  HTTPS://T.EXAMPLE/d.gif">'
  );
  assert.doesNotMatch(html, /\\\\|\/\\/, 'backslash forms are dropped');
  assert.equal(countRemoteImages(html), 2);
  const blocked = renderBodyDocument({ html }, { showImages: false });
  assert.doesNotMatch(blocked, /tracker\.example|T\.EXAMPLE|evil\.example/i);
  const shown = renderBodyDocument({ html }, { showImages: true });
  assert.ok(shown.includes('tracker.example'));
});

test('CSS escapes cannot smuggle url() or @import past the scrubber; legit unicode escapes survive', () => {
  const out = sanitizeEmailHtml(
    '<style>@\\69mport "https://evil.example/x.css"; .a{background:\\75 rl(/api/x)} .b{background:u\\72l(/api/y)} .q:before{content:"\\201C"}</style>' +
      '<div style="background:\\75\\72\\6c(/api/z)">x</div>'
  );
  assert.doesNotMatch(out, /\/api\/|evil\.example|import/i, out);
  assert.ok(out.includes('content:"\\201C"'), out);
});
