/* No tracking, kept that way: nothing StudyCat ships can watch its visitors for someone else.
   - No tracking pixels, analytics, tag managers, session recorders or chat widgets in any page, script or server file
     (Meta Pixel, Google Analytics and Tag Manager, TikTok, LinkedIn, Snap, Pinterest, Hotjar, Clarity, Segment,
     Mixpanel, PostHog, FullStory, LogRocket, Intercom and the like).
   - The pages' Content-Security-Policy (index.html and every static page in learn/) lets scripts load only from StudyCat and
     the pinned math renderer, and pictures only from StudyCat (and data:/blob:), so a pasted pixel or tag cannot run or call
     out; connections go only to StudyCat and the services the privacy policy names.
   - One cookie (the sign-in session), HttpOnly, Secure over HTTPS, SameSite; emails carry no pictures (no open tracking).
   - The privacy policy says so, and names every outside service the pages contact. */
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
let n = 0, bad = 0; const check = (label, cond, extra) => { n++; if (!cond) bad++; console.log(`  ${cond ? '✓' : '✗'} ${label}${cond ? '' : ' ' + JSON.stringify(extra === undefined ? null : extra)}`); };
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const walk = (dir, re) => { const out = []; for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) { const f = path.join(dir, e.name); if (e.isDirectory()) out.push(...walk(f, re)); else if (re.test(e.name)) out.push(f); } return out; };

// what a tracker leaves in a page: its script host, its pixel endpoint or its global function
const TRACKERS = [/connect\.facebook\.net/i, /facebook\.com\/tr\b/i, /\bfbq\s*\(/, /googletagmanager\.com/i, /google-analytics\.com/i, /\bgtag\s*\(/, /\bga\s*\(\s*['"](create|send)/, /analytics\.tiktok\.com/i, /\bttq\./, /snap\.licdn\.com|px\.ads\.linkedin/i, /sc-static\.net|\bsnaptr\s*\(/i, /\bpintrk\s*\(/, /static\.hotjar\.com|\bhj\s*\(\s*['"]/i, /clarity\.ms/i, /cdn\.segment\.com|analytics\.load\(/i, /cdn\.mxpnl\.com|mixpanel\.init/i, /posthog\.(com|init)|i\.posthog/i, /fullstory\.com|\bFS\.identify/i, /cdn\.logrocket|LogRocket\.init/i, /widget\.intercom\.io|Intercom\(/, /doubleclick\.net|googlesyndication|adsbygoogle/i, /plausible\.io\/js|cdn\.usefathom|umami\.is\/script/i, /cdn\.amplitude\.com|amplitude\.getInstance/i, /bat\.bing\.com|\buetq\b/i, /quantserve|scorecardresearch|criteo/i];
const shipped = ['index.html', ...walk('assets', /\.(js|css)$/).filter(f => !/[\\/]i18n[\\/]/.test(f)), ...walk('learn', /\.html$/), ...walk('api', /\.php$/)];
const hits = [];
for (const f of shipped) { const s = read(f); for (const re of TRACKERS) { const m = re.exec(s); if (m) hits.push(`${f}: ${m[0]}`); } }
check(`no tracking pixels, analytics, tag managers or session recorders in ${shipped.length} shipped files`, hits.length === 0, hits.slice(0, 10));

// the pages' policies
const csp = html => { const m = /<meta http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html); if (!m) return null; const o = {}; for (const part of m[1].split(';')) { const [k, ...v] = part.trim().split(/\s+/); if (k) o[k] = v; } return o; };
const MATHJAX = 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/';
const strict = (o, where) => {
  const why = [];
  if (!o) return ['no Content-Security-Policy'];
  if ((o['default-src'] || []).join(' ') !== "'self'") why.push('default-src is not self');
  const scripts = o['script-src'] || []; if (scripts.some(s => s !== "'self'" && s !== MATHJAX)) why.push('script-src: ' + scripts.join(' '));
  const imgs = o['img-src'] || []; if (imgs.some(s => !["'self'", 'data:', 'blob:'].includes(s))) why.push('img-src: ' + imgs.join(' '));
  const conn = o['connect-src'] || ["'self'"]; if (conn.some(s => !["'self'", MATHJAX, 'https://api.dictionaryapi.dev'].includes(s))) why.push('connect-src: ' + conn.join(' '));
  const frames = o['frame-src'] || ["'self'"]; if (frames.some(s => !["'self'", 'blob:'].includes(s))) why.push('frame-src: ' + frames.join(' '));
  return why.map(w => where + ': ' + w);
};
const app = strict(csp(read('index.html')), 'index.html');
check('the app page lets scripts load only from StudyCat and the math renderer, pictures only from StudyCat, and connects only to named services', app.length === 0, app);
const learn = walk('learn', /\.html$/); const loose = learn.flatMap(f => strict(csp(read(f)), f));
check(`all ${learn.length} static study pages have the same strict policy`, learn.length > 100 && loose.length === 0, loose.slice(0, 5));
const seo = read('scripts/build-seo.js'); check('and the script that builds them writes it (img-src without https:)', /img-src 'self' data:;/.test(seo) && !/img-src[^;"]*https:/.test(seo));

// cookies and email
const php = walk('api', /\.php$/).map(f => [f, read(f)]);
const cookies = php.flatMap(([f, s]) => [...s.matchAll(/setcookie\(\s*([^,]+),/g)].map(m => m[1].trim()));
check('one cookie only, the sign-in session (set and cleared in one place)', cookies.length > 0 && cookies.every(c => c === 'MH_COOKIE'), cookies);
const lib = read('api/lib.php'); check('it is HttpOnly, Secure over HTTPS and SameSite', /setcookie\(MH_COOKIE, \$tok, \[[^\]]*'secure' => mh_https\(\), 'httponly' => true, 'samesite' => 'Lax'\]/.test(lib));
const mailImgs = php.filter(([f, s]) => /mh_mail|mail\(/.test(s) && /<img\b/i.test(s)).map(([f]) => f);
check('emails carry no pictures, so no open-tracking pixel', mailImgs.length === 0, mailImgs);
check('no tracked links (utm_ tags) in emails or pages', !shipped.some(f => /utm_(source|medium|campaign)=/.test(read(f))));

// the policy says it, and names what the pages contact
const pol = read('assets/policy.js');
check('the privacy policy says there are no ads, analytics, tracking pixels, session recording or third-party cookies', /no ads, no analytics, no tracking pixels/.test(pol) && /no session recording and no third-party cookies/.test(pol) && /no open-tracking pixels/.test(pol));
check('and names every outside service the pages load from or send to (MathJax and Pyodide on jsDelivr, the Free Dictionary API)', /MathJax\) loads from the jsDelivr CDN/.test(pol) && /Pyodide/.test(pol) && /dictionaryapi\.dev/.test(pol));
const hosts = new Set(); for (const f of ['index.html', ...walk('assets', /\.js$/).filter(f => !/[\\/](i18n|vendor)[\\/]/.test(f))]) for (const m of read(f).matchAll(/fetch\(\s*[`'"](https:\/\/[^/`'"$]+)/g)) hosts.add(m[1]);
const unnamed = [...hosts].filter(h => !/dictionaryapi\.dev|cdn\.jsdelivr\.net/.test(h));
check('the pages fetch from no outside host the policy does not name', unnamed.length === 0, [...hosts]);

console.log(`\nchecks: ${n - bad}/${n} passed`); if (bad) { console.log('FAILED'); process.exit(1); }
