#!/usr/bin/env node
/* ============================================================
   MatHub — static study-guide pages for search engines
   The app itself is a hash-routed single page, which search engines
   index as one URL. This script renders every topic of every class
   into a plain HTML page under learn/, plus a class page per course,
   a hub page, sitemap.xml and robots.txt, so "M171 chain rule notes"
   or "PHSX 220 exam 2" can rank and lead students into the app.
   Run from calc1/:  node scripts/build-seo.js
   ============================================================ */
'use strict';
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://mathub.space';
const SITE = 'MatHub';
const BUILD = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').match(/data-build="([^"]+)"/) || [])[1] || 'dev';
const TODAY = new Date().toISOString().slice(0, 10);

global.window = {};
['calc-data', 'calc-quiz', 'physics-data', 'physics-quiz', 'precalc-data', 'precalc-quiz', 'writ-data', 'csci-data', 'csci-quiz'].forEach(f => require(path.join(ROOT, 'assets', f + '.js')));
const Courses = window.Courses; const ORDER = ['calc', 'physics', 'precalc', 'writ', 'csci'].filter(id => Courses[id]);

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const text = html => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\$\$?([^$]*)\$\$?/g, '$1').replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
const slug = s => String(s).toLowerCase().replace(/§/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const fmtDate = iso => { const d = new Date(iso + 'T00:00:00'); return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); };
const LOGO = '<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mh-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B55B8"/><stop offset="1" stop-color="#0E7C86"/></linearGradient></defs><rect width="64" height="64" rx="15" fill="url(#mh-g)"/><path d="M15 46V21l17 17 17-17v25" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="38" r="4.2" fill="#F2C14E"/><circle cx="15" cy="21" r="3.4" fill="#F2C14E"/><circle cx="49" cy="21" r="3.4" fill="#F2C14E"/></svg>';
const KIND = { calc: 'math', physics: 'physics', precalc: 'math', writ: 'writing', csci: 'programming' };
const BLURB = {
  calc: 'Limits, derivatives, integrals and everything in between, section by section from Active Calculus.',
  physics: 'Kinematics, forces, energy, momentum and rotation, with simulators and worked problems.',
  precalc: 'Functions, exponentials, logarithms and trigonometry, section by section from the course text.',
  writ: 'Week-by-week guide to the writing projects, the notebook, the readings and the portfolio.',
  csci: 'Python from data types to classes, then NumPy, matplotlib and pandas, with a code playground.'
};
const topicSlug = s => slug(`${s.label || s.id}-${s.title}`);
const courseDir = c => path.join(ROOT, 'learn', c);
const courseUrl = c => `/learn/${c}/`;
const topicUrl = (c, s) => `/learn/${c}/${topicSlug(s)}.html`;
const quizTopics = (C, secId) => C.quiz ? Object.keys(C.quiz.TOPICS).filter(t => C.quiz.TOPICS[t].sec === secId) : [];
const meets = C => C.COURSE.lectures || C.COURSE.meets || C.COURSE.classDays || '';
const instructor = C => C.COURSE.instructor || (Array.isArray(C.COURSE.instructors) ? C.COURSE.instructors.map(i => i.name || i).join(', ') : '');

const ogFor = c => (c && fs.existsSync(path.join(ROOT, 'assets', `og-${c}.png`)) ? `/assets/og-${c}.png` : '/assets/og.png');
function page(o) {
  const hasTex = /\$/.test(o.body); const image = o.image || ogFor(o.course);
  const crumbs = [{ n: SITE, u: '/' }, { n: 'Study guides', u: '/learn/' }].concat(o.crumbs || []);
  const breadcrumbLd = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.n, item: SITE_URL + c.u })) };
  const ld = [breadcrumbLd].concat(o.ld || []);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${SITE_URL}${o.url}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta property="og:type" content="${o.type === 'website' ? 'website' : 'article'}">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(o.ogTitle || o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${SITE_URL}${o.url}">
<meta property="og:image" content="${SITE_URL}${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(o.ogTitle || o.title)}">
<meta name="twitter:description" content="${esc(o.desc)}">
<meta name="twitter:image" content="${SITE_URL}${image}">
<meta name="theme-color" content="#2B55B8">
<link rel="icon" type="image/svg+xml" href="/assets/icon.svg">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icon-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/seo.css?v=${BUILD}">
${hasTex ? `<script>window.MathJax = { tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']], displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']], processEscapes: true }, svg: { fontCache: 'global' }, options: { skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'] } };</script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-svg.js"></script>` : ''}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body class="${o.course ? 'course-' + o.course : ''}">
<header class="s-head"><a class="s-brand" href="/">${LOGO}<span><b>Mat<i>Hub</i></b><small>Montana State · Fall 2026</small></span></a><nav class="s-nav"><a href="/learn/">Study guides</a>${o.course ? `<a href="${courseUrl(o.course)}">${esc(Courses[o.course].short)}</a>` : ''}<a class="s-btn" href="${o.appLink || '/'}">Open MatHub</a></nav></header>
<main class="s-wrap">
<nav class="s-crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => i < crumbs.length - 1 ? `<a href="${c.u}">${esc(c.n)}</a><span>›</span>` : `<span aria-current="page">${esc(c.n)}</span>`).join('')}</nav>
${o.body}
</main>
<footer class="s-foot"><div><b>${SITE}</b> is a free, independent study site made by a Montana State student. It is not affiliated with Montana State University; syllabus details come from each class and can change, so confirm dates on Canvas.</div><div class="s-foot-links">${ORDER.map(c => `<a href="${courseUrl(c)}">${esc(Courses[c].code)}</a>`).join('')}<a href="/learn/whats-new.html">What's new</a><a href="/#/contact">Contact</a><a href="/#/policy">Terms &amp; Privacy</a></div></footer>
</body>
</html>
`;
}

function topicBody(c, C, s, i) {
  const unit = C.UNITS.find(u => u.n === s.unit); const prev = C.SECTIONS[i - 1], next = C.SECTIONS[i + 1]; const topics = quizTopics(C, s.id);
  const exam = C.EXAMS.find(e => e.sections && e.sections.includes(s.id));
  const ideas = s.ideas && s.ideas.length ? s.ideas : (s.bullets || []);
  const parts = [];
  parts.push(`<div class="s-eyebrow">${esc(C.code)} ${esc(C.name)}${unit ? ` · Unit ${unit.n}: ${esc(unit.title)}` : ''}${exam ? ` · on ${esc(exam.name)}` : ''}</div>`);
  parts.push(`<h1>${esc(s.label && s.label !== s.id ? s.label + ' ' : (s.label || ''))}${esc(s.title)}</h1>`);
  parts.push(`<p class="s-lead">${C.kind === 'writing' ? `What happens in ${esc(s.label)} of ${esc(C.code)} ${esc(C.name)} at Montana State University, with the notebook prompts and project deadlines for the week.` : `Study notes for <b>${esc(s.title)}</b> in ${esc(C.code)} ${esc(C.name)} at Montana State University: the big ideas, ${s.formulas && s.formulas.length ? 'key formulas, ' : ''}${s.code && s.code.length ? 'code you should know, ' : ''}a worked example, common mistakes and an exam tip. The same topic has endless practice questions and flashcards in MatHub.`}</p>`);
  if (ideas.length) parts.push(`<section><h2>${C.kind === 'writing' ? 'This week' : 'Big ideas'}</h2><ul class="s-list">${ideas.map(x => `<li>${x}</li>`).join('')}</ul></section>`);
  if (s.formulas && s.formulas.length) parts.push(`<section><h2>Key formulas</h2>${s.formulas.map(f => `<div class="s-formula"><div class="s-fname">${esc(f.n)}</div><div class="s-tex">$$${f.t}$$</div></div>`).join('')}</section>`);
  if (s.code && s.code.length) parts.push(`<section><h2>Code you should know</h2>${s.code.map(x => `<div class="s-code"><div class="s-code-h">${esc(x.t)}</div><pre><code>${esc(x.c)}</code></pre>${x.out ? `<div class="s-out"><span>Output</span><pre>${esc(x.out)}</pre></div>` : ''}</div>`).join('')}</section>`);
  if (s.example && s.example.p) parts.push(`<section><h2>Worked example</h2><div class="s-callout"><div>${s.example.p}</div>${s.example.s ? `<details><summary>Show the solution</summary><div class="s-solution">${s.example.s}</div></details>` : ''}</div></section>`);
  if (s.pitfalls && s.pitfalls.length) parts.push(`<section><h2>Common mistakes</h2><ul class="s-list">${s.pitfalls.map(x => `<li>${x}</li>`).join('')}</ul></section>`);
  if (s.tip) parts.push(`<section><div class="s-tip"><span class="s-eyebrow">Exam tip</span>${s.tip}</div></section>`);
  const cta = [`<a class="s-btn primary" href="/#/${c}/notes/${encodeURIComponent(s.id)}">Open these notes in MatHub</a>`];
  if (topics.length) cta.push(`<a class="s-btn" href="/#/${c}/practice?topics=${encodeURIComponent(topics.join(','))}">Practice questions on this topic</a>`);
  if (C.FLASHCARDS && C.FLASHCARDS.some(f => f.sec === s.id)) cta.push(`<a class="s-btn" href="/#/${c}/flashcards?sec=${encodeURIComponent(s.id)}">Flashcards</a>`);
  if (C.kind === 'code') cta.push(`<a class="s-btn" href="/#/${c}/playground">Python playground</a>`);
  if (C.kind === 'writing') cta.push(`<a class="s-btn" href="/#/${c}/readings">Readings as audiobooks</a>`);
  parts.push(`<section class="s-cta"><h2>Keep going in MatHub</h2><p>MatHub is free for Montana State students: ${C.quiz ? 'an endless quizzer with worked explanations, one-question lessons, ' : ''}flashcards, exam prep checklists, the class calendar with every deadline, a grade calculator and a study board for ${esc(C.code)}.</p><div class="s-btns">${cta.join('')}</div></section>`);
  parts.push(`<nav class="s-prevnext" aria-label="Previous and next topic">${prev ? `<a href="${topicUrl(c, prev)}">← ${esc(prev.label || '')} ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${topicUrl(c, next)}">${esc(next.label || '')} ${esc(next.title)} →</a>` : '<span></span>'}</nav>`);
  return parts.join('\n');
}

function coursePage(c, C) {
  const exams = C.EXAMS.map(e => `<tr><td><b>${esc(e.name)}</b></td><td>${esc(e.dateLabel || fmtDate(e.date))}</td><td>${esc(e.covers || '')}</td></tr>`).join('');
  const units = C.UNITS.map(u => `<section class="s-unit"><h2>Unit ${u.n}: ${esc(u.title)}</h2><ol class="s-topics">${u.sections.map(id => C.SECTIONS.find(s => s.id === id)).filter(Boolean).map(s => `<li><a href="${topicUrl(c, s)}"><span class="s-num">${esc(s.label && s.label !== s.id ? s.label : '')}</span>${esc(s.title)}</a></li>`).join('')}</ol></section>`).join('');
  const offers = { calc: ['Section notes with formulas, worked examples and exam tips', 'Endless quizzer with 30+ procedural question types and worked explanations', 'Flashcards, learning path and one-question lessons', 'Exam prep checklists and practice sets', 'Grapher, labs and a grade calculator', 'Calendar with every WebWork, homework, lab and exam date'], physics: ['Section notes with formulas and worked problems', 'Endless quizzer and one-question lessons', 'Projectile, motion and force simulators', 'Exam prep checklists and practice sets', 'Grade calculator and study planner', 'Calendar with labs, homework and exams'], precalc: ['Section notes with formulas and worked examples', 'Endless quizzer with worked explanations', 'Unit circle and grapher tools', 'Exam prep, flashcards and learning path', 'Grade calculator', 'Calendar with every quiz and exam'], writ: ['Week-by-week guide to all three projects and the portfolio', 'The class readings as read-along audiobooks', 'English Phonetics Lab: IPA practice, minimal pairs, symbols and a transcription tool', 'Deadline calendar and grade calculator', 'Writer’s notebook reminders'], csci: ['Topic notes with runnable code examples', 'Code playground: Python in the browser with turtle drawings and matplotlib charts', 'Endless "what does this print" questions and lessons', 'Cheat sheet, flashcards and practice sets for all three exams', 'Calendar with every lab, program and exam', 'Grade calculator with the syllabus weights'] }[c] || [];
  const body = `<div class="s-eyebrow">Montana State University · ${esc(C.term)} · ${KIND[c] || ''}</div>
<h1>${esc(C.code)} ${esc(C.name)}: study guide</h1>
<p class="s-lead">${esc(BLURB[c] || C.tagline || '')} Every topic below is a free study page; the same material lives in the MatHub app with practice, flashcards, the calendar and a grade calculator for this class.</p>
<div class="s-facts">${instructor(C) ? `<div><span>Instructor</span><b>${esc(instructor(C))}</b></div>` : ''}${meets(C) ? `<div><span>Meets</span><b>${esc(meets(C))}</b></div>` : ''}${C.COURSE.credits ? `<div><span>Credits</span><b>${esc(C.COURSE.credits)}</b></div>` : ''}<div><span>Topics</span><b>${C.SECTIONS.length}</b></div></div>
${exams ? `<section><h2>Exams and major deadlines</h2><div class="s-table"><table><thead><tr><th>Exam</th><th>When</th><th>Covers</th></tr></thead><tbody>${exams}</tbody></table></div></section>` : ''}
<section class="s-cta"><h2>What MatHub gives you for ${esc(C.code)}</h2><ul class="s-list">${offers.map(x => `<li>${esc(x)}</li>`).join('')}</ul><div class="s-btns"><a class="s-btn primary" href="/#/${c}">Open ${esc(C.short)} in MatHub</a><a class="s-btn" href="/#/${c}/calendar">Class calendar</a></div></section>
${units}`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: `${C.code} ${C.name} study guide`, url: SITE_URL + courseUrl(c), description: BLURB[c] || C.tagline, isPartOf: { '@type': 'WebSite', name: SITE, url: SITE_URL + '/' }, about: { '@type': 'Thing', name: `${C.code} ${C.name}, Montana State University` }, hasPart: C.SECTIONS.map(s => ({ '@type': 'LearningResource', name: `${s.label && s.label !== s.id ? s.label + ' ' : ''}${s.title}`, url: SITE_URL + topicUrl(c, s) })) }];
  return page({ title: `${C.code} ${C.name} study guide · Montana State · ${SITE}`, desc: clip(`${C.code} ${C.name} at Montana State University: ${BLURB[c] || ''} ${C.SECTIONS.length} topic pages, exam dates and free practice in MatHub.`, 158), url: courseUrl(c), type: 'website', course: c, appLink: `/#/${c}`, crumbs: [{ n: C.short, u: courseUrl(c) }], body, ld });
}

function hubPage() {
  const cards = ORDER.map(c => { const C = Courses[c]; return `<a class="s-card" href="${courseUrl(c)}"><div class="s-eyebrow">${esc(C.code)} · ${esc(KIND[c] || '')}</div><h2>${esc(C.name)}</h2><p>${esc(BLURB[c] || C.tagline || '')}</p><small>${C.SECTIONS.length} topics${C.FLASHCARDS && C.FLASHCARDS.length ? ` · ${C.FLASHCARDS.length} flashcards` : ''}${C.quiz ? ' · endless practice' : ''}</small></a>`; }).join('');
  const body = `<div class="s-eyebrow">Montana State University · Bozeman · Fall 2026</div>
<h1>Free study guides for Montana State classes</h1>
<p class="s-lead">MatHub turns each class syllabus into topic-by-topic notes, practice questions, flashcards and a deadline calendar. Pick a class below to read the study pages, or open the app to practice.</p>
<div class="s-cards">${cards}</div>
<section class="s-cta"><h2>How MatHub works</h2><ul class="s-list"><li><b>Notes</b> for every section with big ideas, formulas, a worked example, common mistakes and an exam tip.</li><li><b>Endless practice</b>: procedurally generated questions with worked explanations, one-question lessons, daily challenges and mock exams.</li><li><b>The calendar</b> with every homework, lab, quiz, exam and drop date from the syllabus, plus a study planner.</li><li><b>Tools</b>: grade calculators, a GPA calculator, graphers, physics simulators, a Python playground and read-along audiobooks.</li><li><b>A class board</b> to ask questions and study with classmates, with streaks, XP, badges and leagues to keep you going.</li></ul><div class="s-btns"><a class="s-btn primary" href="/">Open MatHub</a></div></section>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Study guides for Montana State classes', url: SITE_URL + '/learn/', isPartOf: { '@type': 'WebSite', name: SITE, url: SITE_URL + '/' }, hasPart: ORDER.map(c => ({ '@type': 'CollectionPage', name: `${Courses[c].code} ${Courses[c].name} study guide`, url: SITE_URL + courseUrl(c) })) }];
  return page({ title: `Study guides for Montana State classes: M171, PHSX 220, M151Q, WRIT 101, CSCI 127 · ${SITE}`, desc: 'Free topic-by-topic study notes, practice questions, flashcards and deadline calendars for Montana State University classes: Calculus I, Physics I, Precalculus, College Writing I and Joy and Beauty of Data.', url: '/learn/', type: 'website', appLink: '/', body, ld });
}

function whatsNewPage() {
  require(path.join(ROOT, 'assets', 'changelog.js')); const LOG = (global.MATHUB_CHANGELOG || window.MATHUB_CHANGELOG || []);
  const body = `<div class="s-eyebrow">MatHub · release notes</div>
<h1>What's new in MatHub</h1>
<p class="s-lead">Every release, newest first. MatHub ships most weeks; the current build is ${esc(LOG[0] ? LOG[0].v : BUILD)}. Ideas and bug reports are welcome on the class board or with the flag on any page.</p>
${LOG.map((r, i) => `<section class="s-release${i === 0 ? ' latest' : ''}"><h2>${esc(r.t)}</h2><div class="s-eyebrow">${esc(fmtDate(r.d))} · build ${esc(r.v)}</div><ul class="s-list">${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}
<section class="s-cta"><div class="s-btns"><a class="s-btn primary" href="/#/whatsnew">Open in the app</a><a class="s-btn" href="/learn/">All study guides</a></div></section>`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'WebPage', name: "What's new in MatHub", url: SITE_URL + '/learn/whats-new.html', dateModified: LOG[0] ? LOG[0].d : TODAY, isPartOf: { '@type': 'WebSite', name: SITE, url: SITE_URL + '/' } }];
  return page({ title: `What's new · release notes · ${SITE}`, desc: clip(`MatHub release notes: ${LOG.slice(0, 3).map(r => r.t).join('; ')}.`, 158), url: '/learn/whats-new.html', type: 'website', crumbs: [{ n: "What's new", u: '/learn/whats-new.html' }], body, ld });
}

/* ---------- write everything ---------- */
const written = [];
const out = (rel, content) => { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); written.push(rel); };
fs.rmSync(path.join(ROOT, 'learn'), { recursive: true, force: true });
out('learn/index.html', hubPage());
out('learn/.htaccess', '# Static study pages: cache for an hour, revalidate after\n<IfModule mod_headers.c>\n  <FilesMatch "\\.html$">\n    Header set Cache-Control "public, max-age=3600, must-revalidate"\n  </FilesMatch>\n</IfModule>\n');
const urls = [{ u: '/', p: '1.0', f: 'daily' }, { u: '/learn/', p: '0.9', f: 'weekly' }];
out('learn/whats-new.html', whatsNewPage()); urls.push({ u: '/learn/whats-new.html', p: '0.6', f: 'weekly' });
for (const c of ORDER) {
  const C = Courses[c]; out(`learn/${c}/index.html`, coursePage(c, C)); urls.push({ u: courseUrl(c), p: '0.8', f: 'weekly' });
  C.SECTIONS.forEach((s, i) => {
    const ideas = (s.ideas && s.ideas.length ? s.ideas : s.bullets || []).map(text);
    const title = `${s.label && s.label !== s.id ? s.label + ' ' : ''}${s.title} · ${C.code} ${C.name} · ${SITE}`;
    const desc = clip(`${C.code} ${s.title}: ${ideas.slice(0, 2).join(' ')}`.replace(/\s+/g, ' '), 158);
    const ld = [{ '@context': 'https://schema.org', '@type': 'LearningResource', name: `${s.label && s.label !== s.id ? s.label + ' ' : ''}${s.title}`, description: desc, url: SITE_URL + topicUrl(c, s), inLanguage: 'en', learningResourceType: 'Study guide', educationalLevel: 'Undergraduate', dateModified: TODAY, about: { '@type': 'Thing', name: `${C.code} ${C.name}, Montana State University` }, isPartOf: { '@type': 'CollectionPage', name: `${C.code} ${C.name} study guide`, url: SITE_URL + courseUrl(c) }, publisher: { '@type': 'Organization', name: SITE, url: SITE_URL + '/' } }];
    out(`learn/${c}/${topicSlug(s)}.html`, page({ title, desc, url: topicUrl(c, s), course: c, appLink: `/#/${c}/notes/${encodeURIComponent(s.id)}`, crumbs: [{ n: C.short, u: courseUrl(c) }, { n: `${s.label && s.label !== s.id ? s.label + ' ' : ''}${s.title}`, u: topicUrl(c, s) }], body: topicBody(c, C, s, i), ld }));
    urls.push({ u: topicUrl(c, s), p: '0.7', f: 'monthly' });
  });
}
out('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(x => `  <url><loc>${SITE_URL}${x.u}</loc><lastmod>${TODAY}</lastmod><changefreq>${x.f}</changefreq><priority>${x.p}</priority></url>`).join('\n')}\n</urlset>\n`);
out('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
console.log(`Wrote ${written.length} files: ${urls.length - 3} topic and class pages, learn/index.html, learn/whats-new.html, sitemap.xml, robots.txt (build ${BUILD}).`);
