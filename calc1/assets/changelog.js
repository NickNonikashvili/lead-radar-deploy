/* ============================================================
   MatHub — what's new
   One entry per release, newest first. Shown in the app at #/whatsnew
   (with a dot in the account menu until it has been seen) and as a
   static page at learn/whats-new.html built by scripts/build-seo.js.
   ============================================================ */
(function (global) {
  'use strict';
  const LOG = [
    { v: '2026.09.25.2', d: '2026-09-25', t: 'Today, problem reports, notifications and faster loading', items: ['A Today page with one plan across every class: due flashcards on a spacing schedule, a lesson on your weakest topic, the daily challenge and anything due in the next 48 hours.', 'A flag on every question, lesson step, flashcard and topic page to report a wrong answer or a typo.', 'Push notifications the evening before something is due and when a streak is at risk (Settings → Account).', 'Only the class you open is downloaded now, so the site starts about twice as fast on a phone.', 'Search works across every class, with class chips to narrow it down.', 'An install prompt for the home screen, empty states with Bo, nightly database backups for the admin, and preferences that follow your account between devices.', 'Accessibility pass: a skip link, named controls, announced dialogs and AA contrast for small text and chips in both themes; a public release-notes page and a social card per class.'] },
    { v: '2026.09.25.1', d: '2026-09-25', t: 'Study guides for search engines and a UI polish', items: ['115 public study pages under /learn, one per topic of every class, plus a sitemap and social cards.', 'A mobile tab bar, a breadcrumb in the top bar, a “pick up where you left off” card, class-colored switcher dots, keyboard shortcuts on ? and a back-to-top button.'] },
    { v: '2026.09.24.1', d: '2026-09-24', t: 'CSCI 127 and the Python playground', items: ['CSCI 127 Joy and Beauty of Data: syllabus, labs, programs and exams on the calendar, 18 topic notes with runnable examples, cheat sheet, flashcards and endless practice.', 'Code playground: Python in the browser with streamed output, input(), turtle drawings and matplotlib charts.', 'The landing grid fills its last row and the class switcher shows every class.'] },
    { v: '2026.09.23.1', d: '2026-09-23', t: 'GPA calculator', items: ['Semester and cumulative GPA on the MSU scale, prefilled from your classes and grade calculators, with a goal planner and what-if table.'] },
    { v: '2026.09.22.2', d: '2026-09-22', t: 'Focus sounds, your music, phonetics lab', items: ['Every focus soundscape rebuilt, plus soft piano and an ambient drone.', 'My music: up to ten of your own MP3s, kept on your device.', 'The English Phonetics Lab rebuilt natively inside WRIT 101: practice, minimal pairs, symbols, charts, a transcription tool and a word explorer.'] },
    { v: '2026.09.22.1', d: '2026-09-22', t: 'WRIT 101 with read-along audiobooks', items: ['College Writing I: the week-by-week plan, deadlines and the class readings read aloud with highlighting.', 'A floating focus-sounds bubble on every page.'] },
    { v: '2026.09.21', d: '2026-09-21', t: 'Lessons, quests, leagues and a tidier layout', items: ['One-question lessons, daily and weekly quests, a double-XP boost, weekly leagues with promotion, celebrations and sound effects.', 'Dashboards reorganized into tabs so nothing feels overloaded; collapsible sidebar groups.'] },
    { v: '2026.09.20', d: '2026-09-20', t: 'Account menu, People, badges and Bo', items: ['Settings from the start page, a clearer account page, a People directory with badges, an admin badge editor, XP and levels, streak and goal rings, a live background and Bo the bobcat.'] }
  ];
  global.MATHUB_CHANGELOG = LOG;
  const App = global.App; if (!App) return;
  const { esc, icon, settings, setSetting } = App;
  App.changelogUnseen = () => (settings().seenChangelog || '') !== LOG[0].v;
  App.views.whatsnew = {
    title: "What's new",
    render(root, param, query, standalone) {
      setSetting('seenChangelog', LOG[0].v);
      const head = standalone !== false ? `<header class="landing-top"><div><div class="eyebrow">MatHub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>What's new</h1><p class="muted">Every release, newest first. MatHub ships most weeks; tell us what to build next on the <a href="#/forum">board</a> or with the flag on any page.</p></div><div class="row gap-sm"><span id="landing-account"></span><a class="btn" href="#/">${icon('left', 14)} All classes</a></div></header>` : App.pageHead("What's new", 'Every release, newest first.');
      root.innerHTML = `${standalone !== false ? '<div class="landing-wrap contact-wrap">' : ''}${head}<div class="stack changelog">${LOG.map((r, i) => `<section class="panel${i === 0 ? ' lift' : ''}"><div class="panel-h"><div class="panel-title">${i === 0 ? icon('zap') : icon('flag')} ${esc(r.t)}</div><span class="chip${i === 0 ? ' accent' : ''}">${esc(r.d)} · build ${esc(r.v)}</span></div><ul class="list">${r.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>`).join('')}</div>${standalone !== false ? '</div>' : ''}`;
      const slot = root.querySelector('#landing-account'); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      if (App.auth && App.auth.paintAccount) App.auth.paintAccount();
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
