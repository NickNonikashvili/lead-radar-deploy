'use strict';
// Composer frontend (public/js/compose/): static safety checks plus unit tests of the
// browser-free modules (sanitiser, address parsing, scheduling/quote helpers, API client),
// run in Node. The click-through checks run with Playwright against a mock API outside the repo.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const PUBLIC = path.join(__dirname, '..', 'public');
const COMPOSE = path.join(PUBLIC, 'js', 'compose');
const read = (f) => fs.readFileSync(f, 'utf8');
const composeFiles = fs.readdirSync(COMPOSE).filter((f) => f.endsWith('.js')).map((f) => path.join(COMPOSE, f));

// The package is CommonJS, so copy the browser modules we need to a temp dir as .mjs (with their
// relative imports rewritten) and import them from there. Only modules without DOM/Preact deps.
let tmpRoot = null;
async function load(rel) {
  if (!tmpRoot) {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mailtabs-compose-'));
    const copy = (src, dest) => {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, read(src).replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.js(['"])/g, '$1$2.mjs$3'));
    };
    for (const f of ['api.js', 'format.js']) copy(path.join(PUBLIC, 'js', f), path.join(tmpRoot, 'js', f.replace(/\.js$/, '.mjs')));
    for (const f of ['sanitize.js', 'recipients.js', 'compose-utils.js', 'compose-api.js']) {
      copy(path.join(COMPOSE, f), path.join(tmpRoot, 'js', 'compose', f.replace(/\.js$/, '.mjs')));
    }
  }
  return import(pathToFileURL(path.join(tmpRoot, 'js', rel.replace(/\.js$/, '.mjs'))).href);
}
test.after(() => {
  if (tmpRoot) fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ------------------------------------------------------------------------------------- static

test('composer files exist and are linked as the contract says', () => {
  for (const f of ['compose.js', 'ComposerHost.js', 'SignatureSettings.js', 'compose.css']) {
    assert.ok(fs.existsSync(path.join(COMPOSE, f)), `public/js/compose/${f} exists`);
  }
  const compose = read(path.join(COMPOSE, 'compose.js'));
  assert.match(compose, /export function openComposer\(/);
  assert.match(compose, /export function composerCount\(/);
  assert.match(read(path.join(COMPOSE, 'ComposerHost.js')), /export function ComposerHost\(/);
  assert.match(read(path.join(COMPOSE, 'SignatureSettings.js')), /export function SignatureSettings\(/);
});

test('composer never writes raw markup into the DOM', () => {
  for (const f of composeFiles) {
    const src = read(f);
    const name = path.basename(f);
    for (const banned of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'dangerouslySetInnerHTML', 'document.write', 'createContextualFragment', 'eval(', 'new Function', 'setTimeout("', "setTimeout('"]) {
      assert.ok(!src.includes(banned), `${name} must not use ${banned}`);
    }
    assert.doesNotMatch(src, /\.srcdoc\s*=|srcdoc=\$\{/, `${name} must not set srcdoc`);
    assert.doesNotMatch(src, /setAttribute\(\s*['"`]on/i, `${name} must not set event-handler attributes`);
    // insertHTML (kept for the native undo stack) only ever receives sanitiser output.
    for (const m of src.matchAll(/execCommand\(\s*['"]insertHTML['"]\s*,\s*false\s*,\s*([^)]*)/g)) {
      assert.match(m[1], /^sanitizeHtml\(/, `${name}: insertHTML argument must be sanitizeHtml(...)`);
    }
    // Only the sanitiser parses untrusted markup.
    if (name !== 'sanitize.js') assert.ok(!src.includes('DOMParser'), `${name} must leave parsing to sanitize.js`);
  }
});

test('every way into the editor goes through the sanitiser', () => {
  const editor = read(path.join(COMPOSE, 'editor.js'));
  // setHtml / swapSignature / appendQuote / paste fallback all build nodes via htmlToFragment.
  assert.match(editor, /setHtml\(untrusted\)\s*\{[\s\S]*?htmlToFragment\(untrusted/);
  // The signature swap (in the editor, or on body HTML the editor hasn't loaded yet) shares one helper.
  assert.match(editor, /swapSignature\(signatureHtml\)\s*\{[\s\S]*?swapSignatureIn\(this\.el, signatureHtml\)/);
  assert.match(editor, /function swapSignatureIn\(root, signatureHtml\)\s*\{[\s\S]*?htmlToFragment\(signatureHtml/);
  assert.match(editor, /export function swapSignatureInHtml\(bodyHtml, signatureHtml\)\s*\{[\s\S]*?htmlToFragment\(bodyHtml/);
  assert.match(editor, /appendQuote\(quoteHtml\)\s*\{[\s\S]*?htmlToFragment\(quoteHtml/);
  assert.match(editor, /onPaste\(e\)[\s\S]*?e\.preventDefault\(\)/, 'paste is always intercepted');
  assert.match(editor, /new MutationObserver/, 'a mutation observer scrubs anything else');
  const compose = read(path.join(COMPOSE, 'compose.js'));
  assert.match(compose, /sanitizeTree\(parseUntrusted\(p\.html/, 'server HTML is sanitised before use');
  // Switching From before the editor has shown the body still swaps the signature (in the HTML it loads).
  assert.match(compose, /rt\.editor\.swapSignature\(signature\)\) return \{\};\s*const c = getComposer\(id\);\s*return \{ bodyHtml: swapSignatureInHtml\(c\.bodyHtml, signature\), bodyVersion: c\.bodyVersion \+ 1 \};/);
  assert.match(compose, /export function setFrom\(id, accountId\) \{[\s\S]*?signaturePatch\(id, accountById\(accountId\)\)/);
});

test('composer stylesheet and modules load nothing external; no inline handlers in templates', () => {
  const css = read(path.join(COMPOSE, 'compose.css'));
  assert.doesNotMatch(css, /@import/i);
  assert.doesNotMatch(css, /url\(/i);
  for (const f of composeFiles) {
    const src = read(f);
    assert.doesNotMatch(src, /https?:\/\/(?!www\.w3\.org\/1999\/xhtml)[a-z0-9]/i, `${path.basename(f)} references no external URL`);
    assert.doesNotMatch(src, /\son[a-z]+="/, `${path.basename(f)} has no inline on*="..." attributes`);
  }
});

test('every non-GET request in compose-api.js sends X-Mailtabs (static)', () => {
  const src = read(path.join(COMPOSE, 'compose-api.js'));
  assert.match(src, /if \(method !== 'GET' && method !== 'HEAD'\) \{\s*init\.headers\[CSRF_HEADER\] = '1';/);
  assert.match(src, /xhr\.setRequestHeader\(CSRF_HEADER, '1'\)/);
  assert.match(src, /const CSRF_HEADER = 'X-Mailtabs';/);
  assert.ok(!/fetch\(/.test(src.replace(/res = await fetch\(path, init\);/, '')), 'one fetch call site (the shared request helper)');
});

// ------------------------------------------------------------------------------------- sanitiser

const DANGEROUS = /<script|<style|<iframe|<object|<embed|<svg|<math|<form|<input|<button|<textarea|<meta|<link|<base|<template|<noscript|\son[a-z]+\s*=|javascript:|vbscript:|data:text|expression\(|url\(|srcdoc|formaction|-moz-binding|behavior:/i;

const VECTORS = [
  '<script>alert(1)</script>',
  '<SCRIPT SRC=//evil.example/x.js></SCRIPT>',
  '<img src=x onerror=alert(1)>',
  '<img src="x" ONERROR="alert(1)">',
  '<img src=x onerror\n=alert(1)>',
  '<img/src="x"/onerror="alert(1)">',
  '<svg onload=alert(1)><circle r=1></svg>',
  '<svg><script>alert(1)</script></svg>',
  '<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="JaVaScRiPt:alert(1)">x</a>',
  '<a href="java&#x09;script:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href=" javascript:alert(1)">x</a>',
  '<a href="vbscript:msgbox(1)">x</a>',
  '<a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">x</a>',
  '<iframe src="javascript:alert(1)"></iframe>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<object data="javascript:alert(1)"></object>',
  '<embed src="javascript:alert(1)">',
  '<form action="javascript:alert(1)"><button formaction="javascript:alert(1)">x</button></form>',
  '<input onfocus=alert(1) autofocus>',
  '<details open ontoggle=alert(1)>x</details>',
  '<div style="background:url(javascript:alert(1))">x</div>',
  '<div style="width: expression(alert(1))">x</div>',
  '<div style="behavior: url(x.htc); -moz-binding: url(x.xml#xss)">x</div>',
  '<style>@import "https://evil.example/x.css"; body{background:url(javascript:alert(1))}</style>',
  '<link rel=stylesheet href="https://evil.example/x.css">',
  '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
  '<base href="javascript:alert(1)//">',
  '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
  '<textarea><img src=x onerror=alert(1)></textarea>',
  '<title><img src=x onerror=alert(1)></title>',
  '<xmp><img src=x onerror=alert(1)></xmp>',
  '<template><img src=x onerror=alert(1)></template>',
  '<!--<img src=x onerror=alert(1)>-->',
  '<![CDATA[<img src=x onerror=alert(1)>]]>',
  '<img src="data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+">',
  '<p style="color:red" onmouseover="alert(1)">hover</p>',
  '<<script>alert(1)//<</script>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<div><a href="https://ok.example" target=_blank onclick="x()">ok</a></div>',
  '"><img src=x onerror=alert(1)>',
  '<isindex action="javascript:alert(1)" type=image>',
  '<video><source onerror="alert(1)"></video>',
  '<table background="javascript:alert(1)"><tr><td>x</td></tr></table>',
  '<img src="https://t.example/p.gif" onload="alert(1)" style="position:fixed;top:0">',
];

test('sanitiser: classic XSS vectors come out harmless (both output modes)', async () => {
  const { sanitizeHtml } = await load('compose/sanitize.js');
  for (const v of VECTORS) {
    for (const mode of ['editor', 'send']) {
      const out = sanitizeHtml(v, { mode });
      assert.doesNotMatch(out, DANGEROUS, `${mode}: ${v} -> ${out}`);
    }
  }
});

test('sanitiser: output is stable (re-sanitising changes nothing)', async () => {
  const { sanitizeHtml } = await load('compose/sanitize.js');
  const samples = [
    ...VECTORS,
    '<p>Hello <b>bold</b> <i>it</i> <u>u</u> <s>s</s></p><ul><li>a</li><li>b</li></ul><blockquote type="cite">q</blockquote>',
    '<table width="600" cellpadding="4"><tr><td colspan="2" style="color: #333; padding: 4px">x &amp; y &lt; z</td></tr></table>',
    'plain & <text> with &nbsp; nbsp',
  ];
  for (const s of samples) {
    const once = sanitizeHtml(s);
    assert.equal(sanitizeHtml(once), once, `stable for ${s}`);
  }
});

test('sanitiser: keeps formatting, links, tables and safe styles', async () => {
  const { sanitizeHtml } = await load('compose/sanitize.js');
  assert.equal(sanitizeHtml('<p>Hi <b>there</b> <em>you</em></p>'), '<p>Hi <b>there</b> <em>you</em></p>');
  assert.equal(sanitizeHtml('<a href="https://ex.example/a?b=1&amp;c=2" title="t">l</a>'), '<a href="https://ex.example/a?b=1&amp;c=2" title="t">l</a>');
  assert.equal(sanitizeHtml('<a href="mailto:ada@example.org">m</a>'), '<a href="mailto:ada@example.org">m</a>');
  assert.equal(sanitizeHtml('<ol start="3" type="a"><li>x</li></ol>'), '<ol start="3" type="a"><li>x</li></ol>');
  assert.equal(sanitizeHtml('<div style="color: red; position: fixed; font-weight: bold">x</div>'), '<div style="color: red; font-weight: bold">x</div>');
  assert.equal(sanitizeHtml('<font color="#ff0000">red</font>'), '<span style="color: #ff0000">red</span>');
  assert.equal(sanitizeHtml('<center>c</center><section>s</section>'), '<div>c</div><div>s</div>');
  assert.equal(sanitizeHtml('<o:p></o:p><custom-tag>kept text</custom-tag>'), 'kept text');
  assert.equal(sanitizeHtml('<table><tr><td>a<td>b</table>'), '<table><tr><td>a</td><td>b</td></tr></table>');
  assert.equal(sanitizeHtml('<p>a<p>b'), '<p>a</p><p>b</p>');
  assert.equal(sanitizeHtml('<div data-mt-signature="1" class="x" id="y">sig</div>'), '<div data-mt-signature="1">sig</div>');
  assert.equal(sanitizeHtml('<blockquote type="cite" cite="https://x">q</blockquote>'), '<blockquote type="cite">q</blockquote>');
  assert.equal(sanitizeHtml('<div data-mt-signature="1" data-mt-quote="1">pasted</div>', { markers: false }), '<div>pasted</div>', 'pasted content brings no markers');
  assert.equal(sanitizeHtml('a < b && c > d'), 'a &lt; b &amp;&amp; c &gt; d');
  assert.equal(sanitizeHtml('<img src="x.png" alt="Logo">'), '[Logo]', 'an image that cannot be shown becomes its alt text');
  assert.equal(sanitizeHtml('<a href="javascript:x()">click</a>'), 'click', 'unsafe links become text');
});

test('sanitiser: remote images are held back in the editor and restored for sending', async () => {
  const { sanitizeHtml } = await load('compose/sanitize.js');
  const src = '<img src="https://img.example/a.png" alt="a" width="10">';
  const editor = sanitizeHtml(src, { mode: 'editor' });
  assert.equal(editor, '<img data-mt-src="https://img.example/a.png" alt="a" width="10">');
  assert.equal(sanitizeHtml(editor, { mode: 'send' }), '<img src="https://img.example/a.png" alt="a" width="10">');
  // data: images (pasted screenshots) stay inline; non-image data URLs never survive.
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(sanitizeHtml(`<img src="${png}">`, { mode: 'editor' }), `<img src="${png}">`);
  assert.equal(sanitizeHtml('<img src="data:text/html;base64,PHNjcmlwdD4=" alt="">'), '');
});

test('sanitiser: deep nesting, huge input and odd markup do not throw', async () => {
  const { sanitizeHtml, parseHtml } = await load('compose/sanitize.js');
  const deep = '<div>'.repeat(20000) + 'x' + '</div>'.repeat(20000);
  assert.match(sanitizeHtml(deep), /x/);
  const big = '<p>' + 'word '.repeat(200000) + '</p>';
  assert.ok(sanitizeHtml(big).length > 900000);
  for (const odd of ['<', '<a', '<a href="x', '</', '</>', '<!--', '<!', '<?xml', '&#xFFFFFF;', '&#0;', '\u0000<b>x</b>', '<b\u0000>x</b>']) {
    assert.doesNotThrow(() => sanitizeHtml(odd), odd);
    assert.doesNotThrow(() => parseHtml(odd), odd);
  }
  assert.equal(sanitizeHtml('&#0;&#xD800;&amp;&copy;&unknown;'), '��&amp;©&amp;unknown;');
});

test('sanitiser: cleanUrl and cleanStyle', async () => {
  const { cleanUrl, cleanStyle } = await load('compose/sanitize.js');
  assert.equal(cleanUrl('https://example.com/x'), 'https://example.com/x');
  assert.equal(cleanUrl('  https://example.com/x \n'), 'https://example.com/x');
  assert.equal(cleanUrl('java\tscript:alert(1)'), null);
  assert.equal(cleanUrl('\u0001javascript:alert(1)'), null);
  assert.equal(cleanUrl('//evil.example/x'), null);
  assert.equal(cleanUrl('/relative/path'), null);
  assert.equal(cleanUrl('https:evil'), null);
  assert.equal(cleanUrl('tel:+15551234'), 'tel:+15551234');
  assert.equal(cleanStyle('color: red; background: url(x); font-family: "Segoe UI", Arial'), 'color: red; font-family: "Segoe UI", Arial');
  assert.equal(cleanStyle('position:absolute;z-index:9;opacity:0;display:none'), '');
  assert.equal(cleanStyle('color: re\\64'), '');
  assert.equal(cleanStyle('width: calc(100% - var(--x))'), '');
});

test('sanitiser: DOM adapters (fake DOM) drop foreign content and build nodes without markup', async () => {
  const { domToTree, sanitizeTree, serializeTree, treeToFragment } = await load('compose/sanitize.js');
  const el = (tag, attrs = {}, kids = [], ns = 'http://www.w3.org/1999/xhtml') => {
    const node = { nodeType: 1, localName: tag, namespaceURI: ns, attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })), firstChild: null, nextSibling: null };
    let prev = null;
    for (const k of kids) {
      if (prev) prev.nextSibling = k;
      else node.firstChild = k;
      prev = k;
    }
    return node;
  };
  const text = (v) => ({ nodeType: 3, nodeValue: v, nextSibling: null });
  const root = el('div', {}, [
    el('b', { onclick: 'x()' }, [text('bold')]),
    el('svg', {}, [el('a', { href: 'javascript:x()' }, [text('svg link')], 'http://www.w3.org/2000/svg')], 'http://www.w3.org/2000/svg'),
    el('img', { src: 'https://t.example/p.gif', onerror: 'x()' }),
    text(' & <tail>'),
  ]);
  const tree = sanitizeTree(domToTree(root), { mode: 'editor' });
  assert.equal(serializeTree(tree), '<b>bold</b><img data-mt-src="https://t.example/p.gif"> &amp; &lt;tail&gt;');

  const calls = [];
  const fakeDoc = {
    createDocumentFragment: () => ({ kind: 'frag', children: [], appendChild(c) { this.children.push(c); } }),
    createElement: (tag) => {
      calls.push(['createElement', tag]);
      return { tag, attrs: {}, children: [], setAttribute(n, v) { calls.push(['setAttribute', n, v]); this.attrs[n] = v; }, appendChild(c) { this.children.push(c); } };
    },
    createTextNode: (v) => ({ text: v }),
  };
  const frag = treeToFragment(tree, fakeDoc);
  assert.equal(frag.children.length, 3);
  assert.deepEqual(calls.filter((c) => c[0] === 'setAttribute').map((c) => c[1]), ['data-mt-src']);
  assert.equal(frag.children[2].text, ' & <tail>', 'text stays text');
});

// ------------------------------------------------------------------------------------- recipients

test('recipients: parsing pasted lists, validation, formatting', async () => {
  const r = await load('compose/recipients.js');
  assert.deepEqual(r.parseAddressList('Ada Lovelace <ada@x.org>, "Doe, John" <john@doe.com>; bob@y.com\nmailto:z@q.com'), [
    { name: 'Ada Lovelace', address: 'ada@x.org' },
    { name: 'Doe, John', address: 'john@doe.com' },
    { name: '', address: 'bob@y.com' },
    { name: '', address: 'z@q.com' },
  ]);
  assert.deepEqual(r.parseAddressList('Lovelace, Ada <ada@x.org>'), [{ name: 'Lovelace, Ada', address: 'ada@x.org' }]);
  assert.deepEqual(r.parseAddressList('Bob Smith bob@y.co.uk'), [{ name: 'Bob Smith', address: 'bob@y.co.uk' }]);
  for (const ok of ['a@b.co', 'first.last+tag@sub.example.com', 'ü@例え.jp']) assert.ok(r.isValidEmail(ok), ok);
  for (const bad of ['', 'a@b', 'a@@b.com', 'a b@c.com', '.a@b.com', 'a..b@c.com', 'a@b.c', 'x@localhost', 'a@b.com\r\nBcc: x@y.z', 'a<b>@c.com']) {
    assert.ok(!r.isValidEmail(bad), JSON.stringify(bad));
  }
  assert.deepEqual(r.splitTyped('ada@x.org, "Doe, J" <j@d.com>; bo'), {
    complete: [{ name: '', address: 'ada@x.org' }, { name: 'Doe, J', address: 'j@d.com' }],
    rest: 'bo',
  });
  assert.deepEqual(r.splitTyped('"Doe, J'), { complete: [], rest: '"Doe, J' });
  assert.equal(r.formatRecipient({ name: 'Doe, John', address: 'j@d.com' }), '"Doe, John" <j@d.com>');
  const list = r.addRecipients([r.makeRecipient({ address: 'A@x.org' })], [{ address: 'a@X.org' }, { name: 'B', address: 'b@x.org' }]);
  assert.deepEqual(list.map((x) => x.address), ['A@x.org', 'b@x.org'], 'duplicates (case-insensitive) skipped');
  assert.equal(r.makeRecipient({ address: 'nope' }).valid, false);
});

// ------------------------------------------------------------------------------------- utils

test('utils: schedule presets, local date-times, limits', async () => {
  const u = await load('compose/compose-utils.js');
  const wed = new Date(2026, 10, 11, 15, 0).getTime(); // Wed 11 Nov 2026, 3 PM local
  const opts = u.scheduleOptions(wed);
  assert.deepEqual(opts.map((o) => o.id), ['tomorrow', 'monday']);
  assert.equal(new Date(opts[0].at).getDate(), 12);
  assert.equal(new Date(opts[0].at).getHours(), 8);
  assert.equal(new Date(opts[1].at).getDay(), 1);
  assert.equal(new Date(opts[1].at).getDate(), 16);
  const sun = new Date(2026, 10, 15, 10, 0).getTime();
  assert.deepEqual(u.scheduleOptions(sun).map((o) => o.id), ['tomorrow'], 'Sunday: tomorrow is Monday');
  const mon = new Date(2026, 10, 16, 7, 0).getTime();
  assert.equal(new Date(u.scheduleOptions(mon)[1].at).getDate(), 23, 'Monday -> next Monday');

  const v = u.toLocalInputValue(new Date(2026, 0, 5, 9, 7).getTime());
  assert.equal(v, '2026-01-05T09:07');
  assert.equal(u.parseLocalInputValue(v), new Date(2026, 0, 5, 9, 7).getTime());
  assert.ok(Number.isNaN(u.parseLocalInputValue('2026-02-31T08:00')));
  assert.ok(Number.isNaN(u.parseLocalInputValue('garbage')));
  const now = Date.now();
  assert.equal(u.validateSendAt(now + 3600e3, now), null);
  assert.match(u.validateSendAt(now - 1, now), /future/);
  assert.match(u.validateSendAt(now + 400 * 24 * 3600e3, now), /year/);
  assert.match(u.validateSendAt(NaN, now), /Pick/);
});

test('utils: attachment limits and filenames', async () => {
  const u = await load('compose/compose-utils.js');
  const MB = 1024 * 1024;
  const existing = [{ size: 20 * MB, status: 'done' }, { size: 3 * MB, status: 'error' }];
  const { accepted, rejected } = u.checkAttachmentFiles(existing, [{ name: 'a.pdf', size: 4 * MB }, { name: 'b.pdf', size: 2 * MB }, { name: 'c.mov', size: 30 * MB }]);
  assert.deepEqual(accepted.map((f) => f.name), ['a.pdf']);
  assert.equal(rejected.length, 2);
  assert.match(rejected[0].message, /b\.pdf.*25 MB in total/);
  assert.match(rejected[1].message, /c\.mov.*30 MB/);
  assert.equal(u.cleanFilename('../../etc/passwd'), '.. .. etc passwd');
  assert.equal(u.cleanFilename('a\u0000b<>:"|?*.txt'), 'a b .txt');
  assert.equal(u.cleanFilename('...'), 'attachment');
  assert.match(u.pastedImageName('image/jpeg', new Date(2026, 0, 2, 3, 4, 5).getTime()), /^pasted-image-20260102-030405\.jpg$/);
  assert.equal(u.byteLength('aé€😀'), 1 + 2 + 3 + 4);
  assert.ok(u.mentionsAttachment('Please see the attached file'));
  assert.ok(!u.mentionsAttachment('Thanks for the update'));
});

test('utils: reply quote is split off and signatures are found', async () => {
  const u = await load('compose/compose-utils.js');
  const s = await load('compose/sanitize.js');
  const tree = (h) => s.sanitizeTree(s.parseHtml(h));
  const reply = tree('<p><br></p><div>Sig</div><div>On Mon, Ada &lt;a@x.org&gt; wrote:</div><blockquote type="cite"><p>Hi</p></blockquote><div><br></div>');
  const { body, quote } = u.splitQuote(reply);
  assert.equal(s.serializeTree(body), '<p><br></p><div>Sig</div>');
  assert.equal(s.serializeTree(quote), '<div>On Mon, Ada &lt;a@x.org&gt; wrote:</div><blockquote type="cite"><p>Hi</p></blockquote><div><br></div>');
  // Inline replies (text after the quote) are left alone.
  const inline = tree('<blockquote>q</blockquote><p>my answer</p>');
  assert.equal(u.splitQuote(inline).quote, null);
  // Signature without a marker gets one; with a marker nothing changes.
  const marked = u.markSignature(tree('<div><br></div><b>Sam</b><br>Acme<div>On x wrote:</div>'), '<b>Sam</b><br>Acme');
  assert.equal(s.serializeTree(marked), '<div><br></div><div data-mt-signature="1"><b>Sam</b><br>Acme</div><div>On x wrote:</div>');
  const already = tree('<div data-mt-signature="1">Sam</div>');
  assert.equal(u.markSignature(already, 'Sam'), already);
  // Only our own (first, pre-quote) marker survives; a quoted Mailtabs user's marker is dropped.
  const foreign = tree('<p><br></p><div data-mt-signature="1">Me</div><div>On x, Bo wrote:</div><blockquote><div data-mt-signature="1">Bo sig</div></blockquote><div data-mt-signature="1">late</div>');
  assert.equal(
    s.serializeTree(u.keepOwnSignatureMarker(foreign)),
    '<p><br></p><div data-mt-signature="1">Me</div><div>On x, Bo wrote:</div><blockquote><div>Bo sig</div></blockquote><div>late</div>'
  );
  const fwd = tree('<p><br></p><div>---------- Forwarded message ---------</div><div data-mt-signature="1">Their sig</div>');
  assert.doesNotMatch(s.serializeTree(u.keepOwnSignatureMarker(fwd)), /data-mt-signature/, 'forwarded content keeps no marker');
  assert.equal(u.newMessageHtml(''), '<div><br></div>');
  assert.match(u.newMessageHtml('<b>Sam</b>'), /data-mt-signature="1"><b>Sam<\/b><\/div>$/);
});

// ------------------------------------------------------------------------------------- API client

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('compose-api: every non-GET sends X-Mailtabs + JSON; GETs do not need it', async () => {
  const { composeApi } = await load('compose/compose-api.js');
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return jsonResponse(200, { ok: true });
  };
  try {
    const payload = { accountId: 1, to: [{ name: '', address: 'a@b.co' }], cc: [], bcc: [], subject: 's', html: '<p>x</p>', attachments: [] };
    await composeApi.saveDraft(payload, { folderId: 1, uid: 2 });
    await composeApi.saveDraft(payload, null);
    await composeApi.deleteDraft({ folderId: 1, uid: 2 });
    await composeApi.send(payload, { sendAt: 123, draft: { folderId: 1, uid: 3 } });
    await composeApi.send(payload);
    await composeApi.cancelOutbox(7);
    await composeApi.retryOutbox(7);
    await composeApi.deleteOutbox(7);
    await composeApi.saveSettings({ undoSendSeconds: 5 });
    await composeApi.deleteUpload('abc/def');
    await composeApi.updateAccount(3, { signatureHtml: '<b>x</b>' });
    const writes = calls.slice();
    assert.equal(writes.length, 11);
    for (const c of writes) {
      assert.notEqual(c.init.method, 'GET');
      assert.equal(c.init.headers['X-Mailtabs'], '1', `${c.init.method} ${c.url}`);
      assert.equal(c.init.headers['Content-Type'], 'application/json');
      assert.equal(c.init.credentials, 'same-origin');
      assert.doesNotThrow(() => JSON.parse(c.init.body));
    }
    assert.deepEqual(JSON.parse(writes[0].init.body), { payload, draft: { folderId: 1, uid: 2 } });
    assert.deepEqual(JSON.parse(writes[1].init.body), { payload });
    assert.deepEqual(JSON.parse(writes[2].init.body), { draft: { folderId: 1, uid: 2 } });
    assert.equal(writes[2].init.method, 'DELETE');
    assert.deepEqual(JSON.parse(writes[3].init.body), { payload, sendAt: 123, draft: { folderId: 1, uid: 3 } });
    assert.equal(writes[5].url, '/api/outbox/7/cancel');
    assert.equal(writes[9].url, '/api/uploads/abc%2Fdef');
    assert.equal(writes[10].init.method, 'PATCH');

    calls.length = 0;
    await composeApi.prepare('replyAll', 42);
    await composeApi.contacts('ad a', { limit: 8 });
    await composeApi.outbox();
    await composeApi.settings();
    // The browser's time zone dates the reply quote.
    const tz = new URLSearchParams({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).toString();
    assert.equal(calls[0].url, `/api/compose/prepare?mode=replyAll&messageId=42&${tz}`);
    assert.equal(calls[1].url, '/api/contacts?q=ad+a&limit=8');
    for (const c of calls) {
      assert.equal(c.init.method, 'GET');
      assert.equal(c.init.headers['X-Mailtabs'], undefined);
    }
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('compose-api: errors become ApiError; a lost session goes to the shared 401 handler', async () => {
  const { composeApi } = await load('compose/compose-api.js');
  const apiMod = await load('api.js');
  const realFetch = globalThis.fetch;
  let lost = 0;
  apiMod.setUnauthorizedHandler(() => {
    lost += 1;
  });
  globalThis.fetch = async (url) => {
    if (url === '/api/send') return jsonResponse(400, { error: 'Add at least one recipient.', code: 'INVALID_COMPOSE' });
    if (url === '/api/drafts') return jsonResponse(401, { error: 'Not signed in', code: 'UNAUTHENTICATED' });
    if (url === '/api/accounts') return jsonResponse(401, { error: 'Not signed in', code: 'UNAUTHENTICATED' });
    if (url === '/api/outbox/1/cancel') return jsonResponse(409, { error: 'Too late', code: 'TOO_LATE' });
    if (url === '/api/outbox') throw new TypeError('Failed to fetch');
    return jsonResponse(200, {});
  };
  try {
    await assert.rejects(composeApi.send({}), (e) => e.name === 'ApiError' && e.status === 400 && e.code === 'INVALID_COMPOSE' && e.message === 'Add at least one recipient.');
    await assert.rejects(composeApi.cancelOutbox(1), (e) => e.status === 409 && e.code === 'TOO_LATE');
    await assert.rejects(composeApi.outbox(), (e) => e.code === 'NETWORK');
    await assert.rejects(composeApi.saveDraft({}), (e) => e.status === 401);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(lost, 1, 'the app-wide unauthorized handler ran once');
  } finally {
    globalThis.fetch = realFetch;
    apiMod.setUnauthorizedHandler(null);
  }
});

test('compose-api: uploads use XHR with X-Mailtabs, encoded filename and progress', async () => {
  const { uploadFile } = await load('compose/compose-api.js');
  const instances = [];
  class FakeXHR {
    constructor() {
      this.headers = {};
      this.listeners = {};
      this.upload = { addEventListener: (t, fn) => (this.uploadListener = fn) };
      instances.push(this);
    }
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(k, v) {
      this.headers[k] = v;
    }
    addEventListener(type, fn) {
      this.listeners[type] = fn;
    }
    send(body) {
      this.body = body;
      setTimeout(() => {
        if (this.uploadListener) this.uploadListener({ lengthComputable: true, loaded: 50, total: 100 });
        this.status = this.failWith || 201;
        this.responseText = JSON.stringify(this.failWith ? { error: 'Too big', code: 'TOO_LARGE' } : { upload: { id: 'u1', filename: 'Résumé (final).pdf', contentType: 'application/pdf', size: 100 } });
        this.listeners.load();
      }, 0);
    }
    abort() {
      this.listeners.abort();
    }
  }
  const realXHR = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = FakeXHR;
  try {
    const progress = [];
    const file = { name: 'Résumé (final).pdf', type: 'application/pdf', size: 100 };
    const { promise } = uploadFile(file, { onProgress: (p) => progress.push(p) });
    const upload = await promise;
    const x = instances[0];
    assert.equal(x.method, 'POST');
    assert.equal(x.url, '/api/uploads');
    assert.equal(x.headers['X-Mailtabs'], '1');
    assert.equal(x.headers['Content-Type'], 'application/pdf');
    assert.equal(x.headers['X-Filename'], encodeURIComponent('Résumé (final).pdf'));
    assert.match(x.headers['X-Filename'], /^[\x20-\x7e]+$/, 'header value is ASCII');
    assert.equal(x.body, file);
    assert.deepEqual(progress, [0.5]);
    assert.equal(upload.id, 'u1');

    const second = uploadFile({ name: 'big.bin', type: '', size: 1 });
    instances[1].failWith = 413;
    await assert.rejects(second.promise, (e) => e.status === 413 && e.code === 'TOO_LARGE');
    assert.equal(instances[1].headers['Content-Type'], 'application/octet-stream');

    const third = uploadFile({ name: 'c.txt', type: 'text/plain', size: 1 });
    third.abort();
    await assert.rejects(third.promise, (e) => e.name === 'AbortError');
  } finally {
    globalThis.XMLHttpRequest = realXHR;
  }
});
