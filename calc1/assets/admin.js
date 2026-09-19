/* ============================================================
   MatHub — admin panel (#/admin, or inside a class)
   Overview, members, reports, contributions queue, mock exams,
   site settings (Canvas feed, announcement, staff roles), digest.
   Admins see everything; moderators see reports, contributions and mocks.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { $, $$, esc, icon, bind, on, toast, pageHead } = App;
  const API = 'api/index.php?r=';
  const user = () => (App.auth && App.auth.user) || null; const isAdmin = () => !!(user() && user().admin); const isMod = () => !!(user() && user().mod);
  const NAMES = { calc: 'Calc I', physics: 'Physics I', precalc: 'Precalc', general: 'General' };
  const courseChip = id => `<span class="chip course-${esc(id)}">${esc((global.Courses[id] && global.Courses[id].short) || NAMES[id] || id)}</span>`;
  const timeAgo = ts => { const s = Math.max(0, Date.now() / 1000 - ts); if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`; return `${Math.floor(s / 86400)}d ago`; };
  const fmtWhen = ts => new Date(ts * 1000).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  async function api(route, body, method) {
    const opts = { method: method || (body ? 'POST' : 'GET'), credentials: 'same-origin', headers: { 'X-Requested-With': 'MatHub', 'Accept': 'application/json' }, cache: 'no-store' };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    let res, json; try { res = await fetch(API + route, opts); json = await res.json(); } catch (e) { throw new Error('Cannot reach the server.'); }
    if (!json || json.ok === false) { const err = new Error((json && json.error) || 'Request failed.'); err.data = json; throw err; }
    return json;
  }
  const TABS = [['overview', 'Overview', 'grid', 'admin'], ['members', 'Members', 'info', 'admin'], ['reports', 'Reports', 'flag', 'mod'], ['contrib', 'Contributions', 'pen', 'mod'], ['mocks', 'Mock exams', 'target', 'mod'], ['settings', 'Site settings', 'sliders', 'admin'], ['digest', 'Digest & cron', 'clock', 'admin']];

  App.views.admin = {
    title: 'Admin panel',
    render(root, param, query, standalone) {
      const tabs = TABS.filter(t => t[3] === 'mod' ? isMod() : isAdmin()); const tab = tabs.find(t => t[0] === param) ? param : (tabs[0] ? tabs[0][0] : 'overview');
      const head = standalone ? `<header class="landing-top"><div><div class="eyebrow">MatHub</div><h1 class="landing-title"><span class="logo-mark">${App.logoSvg(44)}</span>Admin panel</h1><p class="muted">${isAdmin() ? 'Everything about the site, in one place.' : 'Moderation tools.'}</p></div><div class="row gap-sm"><span id="landing-account"></span><a class="btn" href="#/">${icon('left', 14)} All classes</a><button class="icon-btn theme-btn" data-action="theme" aria-label="Toggle theme"></button></div></header>` : pageHead('Admin panel', isAdmin() ? 'Everything about the site, in one place.' : 'Moderation tools.');
      root.innerHTML = `${standalone ? '<div class="landing-wrap admin-wrap">' : ''}${head}${!isMod() ? App.lockCard('Staff only', 'Log in with a moderator or administrator account to open the admin panel.') : `<div class="admin-layout"><nav class="admin-tabs">${tabs.map(t => `<a class="admin-tab${t[0] === tab ? ' active' : ''}" href="${standalone ? '#/admin/' + t[0] : App.link('admin', t[0])}">${icon(t[2], 15)}<span>${t[1]}</span></a>`).join('')}</nav><div class="admin-body" id="adm-body"><div class="empty">Loading…</div></div></div>`}${standalone ? '</div>' : ''}`;
      const slot = $('#landing-account', root); if (slot && App.auth && App.auth.ready) App.auth.paintLandingAccount(slot);
      bind(root, { theme: () => App.toggleTheme(), 'auth-signup': () => App.auth.open('signup'), 'auth-login': () => App.auth.open('login') });
      if (isMod()) this[tab]($('#adm-body', root), root);
    },

    async overview(el) {
      try {
        const [st, act] = await Promise.all([api('admin_stats'), api('activity')]);
        const stat = (n, l, ic) => `<div class="stat admin-stat"><div class="stat-num">${n}</div><div class="stat-label">${icon(ic, 12)} ${l}</div></div>`;
        el.innerHTML = `<div class="grid cols-4 mb-2">${stat(st.users, 'members', 'info')}${stat(st.active_7d, 'active this week', 'fire')}${stat(st.online, 'online now', 'eye')}${stat(st.challenges_today, 'challenges today', 'target')}${stat(st.posts, 'posts', 'chat')}${stat(st.comments, 'comments', 'reply')}${stat(st.reports, 'open reports', 'flag')}${stat(st.contrib_pending, 'submissions to review', 'pen')}${stat(st.meets, 'upcoming sessions', 'clock')}${stat(st.mocks, 'upcoming mocks', 'flag')}${stat(st.bans, 'active bans', 'lock')}${stat(st.pending, 'unverified sign-ups', 'x')}</div>
          <div class="grid cols-2"><div class="panel"><div class="panel-h"><div class="panel-title">${icon('bulb')} Latest activity</div></div>${act.items.length ? `<div class="act-feed">${act.items.slice(0, 12).map(i => `<a class="act-row" href="${esc(i.link || '#/')}"><span class="act-ic">${icon('bulb', 12)}</span><span class="act-text">${esc(i.text)}</span><span class="act-when">${timeAgo(i.created)}</span></a>`).join('')}</div>` : '<div class="empty">Nothing yet.</div>'}</div>
          <div class="panel"><div class="panel-h"><div class="panel-title">${icon('shield')} Staff</div></div><div class="row gap-sm" style="flex-wrap:wrap">${st.moderators.map(m => `<span class="chip ${st.admins.includes(m) ? 'accent' : ''}">${esc(m)}${st.admins.includes(m) ? ' · admin' : ''}</span>`).join('')}${st.roles.map(r => `<span class="chip staff">${esc(r.email)} · ${esc(r.role)}</span>`).join('')}</div><p class="small muted mt-2">Moderators and admins are set in <code>api/config.php</code> (or <code>config.local.php</code>). Instructor and TA badges are set under Site settings.</p>
            <div class="divider"></div><div class="eyebrow mb-1">Canvas</div><p class="small">${st.settings.canvas.configured ? `${st.settings.canvas.count} events · last sync ${st.settings.canvas.fetched ? timeAgo(st.settings.canvas.fetched) : 'never'}${st.settings.canvas.error ? ` · <span style="color:var(--bad)">${esc(st.settings.canvas.error)}</span>` : ''}` : 'No feed configured yet. Add it under Site settings.'}</p></div></div>`;
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },

    async members(el, root, q, page) {
      try {
        const us = await api('admin_users&q=' + encodeURIComponent(q || '') + '&page=' + (page || 0));
        el.innerHTML = `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('info')} Members</div><input class="input" id="adm-q" placeholder="Search email or name…" value="${esc(q || '')}" style="max-width:260px"></div>
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Member</th><th>Joined</th><th class="num">Posts</th><th class="num">Comments</th><th>Status</th><th></th></tr></thead><tbody>${us.users.map(x => `<tr><td><div><b>${esc(x.name || x.email.split('@')[0])}</b>${x.admin ? ' <span class="chip accent">admin</span>' : x.mod ? ' <span class="chip">mod</span>' : ''}</div><div class="mono small muted">${esc(x.email)}</div></td><td class="small">${new Date(x.created * 1000).toLocaleDateString()}<div class="muted">last login ${x.last_login ? timeAgo(x.last_login) : 'never'}</div></td><td class="num">${x.posts}</td><td class="num">${x.comments}</td><td class="small">${!x.verified ? '<span class="chip warn">unverified</span>' : x.banned_until ? `<span class="chip bad">banned until ${new Date(x.banned_until * 1000).toLocaleDateString()}</span>` : '<span class="chip good">active</span>'}${x.terms ? '' : ' <span class="chip">no rules yet</span>'}</td><td><div class="row gap-sm" style="flex-wrap:nowrap;justify-content:flex-end">${x.admin ? '' : `${x.banned_until ? `<button class="btn xs" data-action="user" data-a="unban" data-u="${x.id}">Unban</button>` : `<button class="btn xs" data-action="user" data-a="ban" data-u="${x.id}">Ban</button>`}${!x.verified ? `<button class="btn xs" data-action="user" data-a="verify" data-u="${x.id}">Verify</button>` : ''}<button class="btn xs danger ghost" data-action="user" data-a="delete" data-u="${x.id}" data-e="${esc(x.email)}">Delete</button>`}</div></td></tr>`).join('') || '<tr><td colspan="6"><div class="empty">No members match.</div></td></tr>'}</tbody></table></div>
          ${us.more ? `<div class="row mt-2" style="justify-content:center"><button class="btn" data-action="page" data-p="${(page || 0) + 1}" data-q="${esc(q || '')}">Next page</button></div>` : ''}</div>`;
        const inp = $('#adm-q', el); let t; inp.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => this.members(el, root, inp.value.trim(), 0), 350); });
        bind(el, {
          page: b => this.members(el, root, b.dataset.q, +b.dataset.p),
          user: async b => { const a = b.dataset.a, body = { action: a, user_id: +b.dataset.u }; if (a === 'delete' && !confirm('Delete the account ' + b.dataset.e + ' and everything they posted? This cannot be undone.')) return; if (a === 'ban') { const days = prompt('Ban for how many days?', '30'); if (!days) return; body.days = +days; body.reason = prompt('Reason (shown to the user):', 'Breaking the community rules') || ''; } try { await api('admin_user', body); toast('Done'); this.members(el, root, $('#adm-q', el).value.trim(), 0); } catch (e) { toast(e.message, 3500); } }
        });
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },

    async reports(el) {
      try {
        const r = await api('forum_reports');
        el.innerHTML = `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('flag')} Open reports</div><span class="chip">${r.reports.length}</span></div>
          ${r.reports.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th>Reason</th><th>Author</th><th></th></tr></thead><tbody>${r.reports.map(x => `<tr><td><span class="chip">${x.kind === 'p' ? 'post' : 'comment'}</span> <a href="#/forum/${x.post_id}">${esc(x.snippet.slice(0, 110))}${x.snippet.length > 110 ? '…' : ''}</a>${x.removed ? ' <span class="chip bad">removed</span>' : ''}</td><td class="small">${esc(x.reason)}<div class="muted">by ${esc(x.reporter)} · ${timeAgo(x.created)}</div></td><td class="small mono">${esc(x.author)}</td><td><div class="row gap-sm" style="flex-wrap:nowrap">${x.removed ? '' : `<button class="btn xs danger" data-action="mod" data-a="remove" data-kind="${x.kind}" data-id="${x.item_id}">Remove</button>`}<button class="btn xs" data-action="ban" data-kind="${x.kind}" data-id="${x.item_id}">Ban</button>${isAdmin() ? `<button class="btn xs danger ghost" data-action="purge" data-kind="${x.kind}" data-id="${x.item_id}">Delete</button>` : ''}<button class="btn xs ghost" data-action="mod" data-a="resolve" data-report="${x.id}">Dismiss</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nothing reported. Nice community.</div>'}</div>
          <div class="panel mt-2"><div class="panel-h"><div class="panel-title">${icon('lock')} Active bans</div></div>${r.bans.length ? `<div class="table-wrap"><table class="table compact"><tbody>${r.bans.map(b => `<tr><td class="mono small">${esc(b.email)}</td><td class="small">until ${new Date(b.until * 1000).toLocaleDateString()}${b.reason ? ' · ' + esc(b.reason) : ''}</td><td><button class="btn xs" data-action="mod" data-a="unban" data-user="${b.user_id}">Unban</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">No active bans.</div>'}</div>`;
        bind(el, {
          mod: async b => { const body = { action: b.dataset.a, kind: b.dataset.kind, id: +b.dataset.id || 0 }; if (b.dataset.report) body.report_id = +b.dataset.report; if (b.dataset.user) body.user_id = +b.dataset.user; if (body.action === 'remove' && !confirm('Remove this item?')) return; try { await api('forum_mod', body); toast('Done'); this.reports(el); } catch (e) { toast(e.message, 3000); } },
          ban: async b => { const days = prompt('Ban the author for how many days?', '7'); if (!days) return; const reason = prompt('Reason:', 'Breaking the community rules') || ''; try { await api('forum_mod', { action: 'ban', kind: b.dataset.kind, id: +b.dataset.id, days: +days, reason }); toast('User banned'); this.reports(el); } catch (e) { toast(e.message, 3000); } },
          purge: async b => { if (!confirm('Permanently delete this item? This cannot be undone.')) return; try { await api('admin_purge', { kind: b.dataset.kind, id: +b.dataset.id }); toast('Deleted'); this.reports(el); } catch (e) { toast(e.message, 3000); } }
        });
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },

    async contrib(el) {
      try {
        const r = await api('contrib_queue');
        el.innerHTML = `<div class="panel"><div class="panel-h"><div class="panel-title">${icon('pen')} Submissions to review</div><span class="chip">${r.items.length}</span></div>${r.items.length ? `<div class="stack">${r.items.map(i => `<div class="panel contrib" id="cq-${i.id}"><div class="fa-meta">${courseChip(i.course)}<span class="chip">${i.kind === 'card' ? 'flashcard' : 'problem'}</span>${i.sec ? `<span class="chip">§${esc(i.sec)}</span>` : i.unit ? `<span class="chip">Unit ${i.unit}</span>` : ''}<span class="sep">·</span><span class="muted small">${esc(i.author)} · ${timeAgo(i.created)}</span></div><div class="q-prompt mt-1"><b>${i.kind === 'card' ? 'Front' : 'Problem'}:</b> ${i.front}</div><div class="mt-1"><b>${i.kind === 'card' ? 'Back' : 'Answer'}:</b> ${i.back}</div>${i.explanation ? `<div class="small muted mt-1"><b>Explanation:</b> ${i.explanation}</div>` : ''}<div class="row gap-sm mt-2"><button class="btn sm primary" data-action="cm" data-a="approve" data-id="${i.id}">${icon('check', 13)} Approve</button><button class="btn sm" data-action="cm" data-a="reject" data-id="${i.id}">Reject</button><button class="btn sm danger ghost" data-action="cm" data-a="delete" data-id="${i.id}">Delete</button></div></div>`).join('')}</div>` : '<div class="empty">Queue is empty.</div>'}</div>`;
        App.typeset(el);
        bind(el, { cm: async b => { try { await api('contrib_mod', { id: +b.dataset.id, action: b.dataset.a }); toast(b.dataset.a === 'approve' ? 'Approved and published' : 'Done'); this.contrib(el); } catch (e) { toast(e.message, 3000); } } });
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },

    async mocks(el) {
      const courses = App.COURSE_ORDER.filter(id => global.Courses[id]); const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0);
      try {
        const r = await api('mock_list&course=all');
        el.innerHTML = `<div class="panel mb-2"><div class="panel-h"><div class="panel-title">${icon('flag')} Schedule a community mock exam</div></div>
          <div class="grid cols-3" style="gap:12px"><div class="field"><label for="mk-course">Class</label><select class="select" id="mk-course">${courses.map(c => `<option value="${c}">${esc(global.Courses[c].short)}</option>`).join('')}</select></div><div class="field"><label for="mk-exam">Exam topics</label><select class="select" id="mk-exam"></select></div><div class="field"><label for="mk-title">Title</label><input class="input" id="mk-title" maxlength="80" placeholder="e.g. Exam 2 mock"></div>
            <div class="field"><label for="mk-date">Date</label><input class="input" type="date" id="mk-date" value="${App.toISO(d)}" min="${App.todayISO()}"></div><div class="field"><label for="mk-time">Start</label><input class="input" type="time" id="mk-time" value="18:00"></div><div class="grid cols-2" style="gap:8px"><div class="field"><label for="mk-min">Minutes</label><input class="input" type="number" id="mk-min" value="50" min="15" max="180"></div><div class="field"><label for="mk-count">Questions</label><input class="input" type="number" id="mk-count" value="15" min="5" max="30"></div></div></div>
          <div class="row gap-sm mt-1"><button class="btn primary" data-action="mk-create">${icon('calendar', 14)} Schedule</button><span class="small muted">Everyone gets the same questions; rankings unlock when the window closes (plus a 15-minute grace period for submissions).</span></div></div>
          <div class="panel"><div class="panel-h"><div class="panel-title">${icon('list')} Scheduled and recent</div></div>${r.mocks.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Mock</th><th>When</th><th class="num">Registered</th><th class="num">Finished</th><th></th></tr></thead><tbody>${r.mocks.map(m => `<tr><td>${courseChip(m.course)} <b>${esc(m.title)}</b> <span class="muted small">· ${m.count} q · ${m.minutes} min</span></td><td class="small">${esc(fmtWhen(m.start))} ${m.ended ? '<span class="chip">ended</span>' : m.open ? '<span class="chip good">open</span>' : ''}</td><td class="num">${m.registered}</td><td class="num">${m.results}</td><td><div class="row gap-sm" style="justify-content:flex-end"><a class="btn xs" href="#/${m.course}/mock/${m.id}">Results</a>${m.ended ? '' : `<button class="btn xs danger ghost" data-action="mk-cancel" data-id="${m.id}">Cancel</button>`}</div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">None yet.</div>'}</div>`;
        const cs = $('#mk-course', el), es = $('#mk-exam', el); const fillExams = () => { const C = global.Courses[cs.value]; es.innerHTML = C.EXAMS.map(e => `<option value="${e.id}"${e.date >= App.todayISO() && !es.dataset.set ? ' selected' : ''}>${esc(e.name)} · ${esc(e.covers.slice(0, 50))}${e.covers.length > 50 ? '…' : ''}</option>`).join(''); es.dataset.set = '1'; const nx = C.EXAMS.find(e => (e.endDate || e.date) >= App.todayISO()); if (nx) es.value = nx.id; $('#mk-title', el).value = (nx ? nx.name : C.EXAMS[0].name) + ' mock'; }; cs.addEventListener('change', fillExams); fillExams();
        bind(el, {
          'mk-create': async b => { const start = Math.floor(new Date($('#mk-date', el).value + 'T' + $('#mk-time', el).value).getTime() / 1000); b.disabled = true; try { await api('mock_create', { course: cs.value, exam_id: es.value, title: $('#mk-title', el).value, start, minutes: +$('#mk-min', el).value, count: +$('#mk-count', el).value }); toast('Mock exam scheduled'); this.mocks(el); } catch (e) { b.disabled = false; toast(e.message, 3500); } },
          'mk-cancel': async b => { if (!confirm('Cancel this mock exam?')) return; try { await api('mock_cancel', { id: +b.dataset.id }); this.mocks(el); } catch (e) { toast(e.message); } }
        });
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },

    async settings(el) {
      try {
        const st = await api('admin_stats'); const s = st.settings;
        el.innerHTML = `<div class="panel mb-2"><div class="panel-h"><div class="panel-title">${icon('canvas')} Canvas calendar feed</div></div>
            <div class="row gap-sm"><input class="input mono" id="adm-canvas" placeholder="https://montana.instructure.com/feeds/calendars/user_….ics" value="${esc(s.canvas_feed || '')}" ${s.canvas_from_config ? 'disabled' : ''} style="flex:1;min-width:240px"><button class="btn sm primary" data-action="save" data-k="canvas_feed" data-i="adm-canvas" ${s.canvas_from_config ? 'disabled' : ''}>Save &amp; sync</button></div>
            <p class="small muted mt-1">${s.canvas_from_config ? 'Set in api/config.php, so it cannot be changed here.' : 'In Canvas: Calendar → “Calendar Feed” → copy the link. Due dates for the mapped classes then show on every dashboard, refreshed hourly.'} ${s.canvas.configured ? `Last sync: ${s.canvas.fetched ? timeAgo(s.canvas.fetched) : 'never'} · ${s.canvas.count} events${s.canvas.error ? ` · <span style="color:var(--bad)">${esc(s.canvas.error)}</span>` : ''}` : ''}</p></div>
          <div class="panel mb-2"><div class="panel-h"><div class="panel-title">${icon('flag')} Announcement banner</div></div><div class="row gap-sm"><input class="input" id="adm-ann" maxlength="240" value="${esc(s.announcement || '')}" placeholder="Shown on the landing page and dashboards until each student dismisses it. Leave empty to hide." style="flex:1;min-width:240px"><button class="btn sm" data-action="save" data-k="announcement" data-i="adm-ann">Save</button></div></div>
          <div class="panel"><div class="panel-h"><div class="panel-title">${icon('shield')} Verified instructors and TAs</div></div><p class="small muted mb-2">Their posts and comments show an Instructor or TA badge. They still need a normal account (the email must be allowed to sign up; add it to <code>extra_allowed_emails</code> in config if it is not a montana.edu address).</p>
            <div class="row gap-sm"><input class="input" id="adm-role-email" type="email" placeholder="name@montana.edu" style="max-width:280px"><select class="select" id="adm-role" style="max-width:160px"><option value="Instructor">Instructor</option><option value="TA">TA</option></select><button class="btn sm primary" data-action="role-add">Add</button></div>
            <div class="mt-2">${st.roles.length || Object.keys(st.staff_config).length ? `<table class="table compact"><tbody>${Object.entries(st.staff_config).map(([e, r]) => `<tr><td class="mono small">${esc(e)}</td><td><span class="chip staff">${esc(r)}</span></td><td class="small muted">from config.php</td></tr>`).join('')}${st.roles.map(r => `<tr><td class="mono small">${esc(r.email)}</td><td><span class="chip staff">${esc(r.role)}</span></td><td><button class="btn xs ghost" data-action="role-del" data-e="${esc(r.email)}">Remove</button></td></tr>`).join('')}</tbody></table>` : '<div class="empty small">No staff badges yet.</div>'}</div></div>`;
        bind(el, {
          save: async b => { const value = $('#' + b.dataset.i, el).value.trim(); b.disabled = true; try { const r = await api('admin_setting', { key: b.dataset.k, value }); if (App.Canvas) { App.Canvas.data = null; App.Canvas.at = 0; } toast(r.canvas ? (r.canvas.error ? r.canvas.error : `Synced ${r.canvas.count} Canvas events`) : 'Saved', 4000); this.settings(el); } catch (e) { b.disabled = false; toast(e.message, 4000); } },
          'role-add': async () => { try { await api('admin_role', { email: $('#adm-role-email', el).value.trim(), role: $('#adm-role', el).value }); toast('Saved'); this.settings(el); } catch (e) { toast(e.message, 3500); } },
          'role-del': async b => { try { await api('admin_role', { email: b.dataset.e, role: '' }); this.settings(el); } catch (e) { toast(e.message); } }
        });
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    },

    async digest(el) {
      try {
        const st = await api('admin_stats');
        el.innerHTML = `<div class="panel mb-2"><div class="panel-h"><div class="panel-title">${icon('clock')} Weekly digest</div><span class="chip ${st.digest_window ? 'good' : ''}">${st.digest_window ? 'sending window open' : 'next window: Sunday 5 pm'}</span></div>
            <p class="small">Every member who has not turned it off gets one email a week: what is due (from Canvas), the most upvoted posts, their own stats against the class average, and upcoming sessions and mock exams. Sent this week: <b>${st.digest_sent_week}</b>.</p>
            <p class="small muted">Emails go out a few at a time whenever someone uses the site during the window. For a reliable Sunday send, add a cron job in hPanel (Advanced → Cron Jobs) that runs every 10 minutes on Sunday evening:</p>
            <pre class="mono small" style="white-space:pre-wrap;background:var(--surface-2);padding:10px;border-radius:8px">curl -s "https://mathub.space/api/index.php?r=cron&amp;key=YOUR_CRON_KEY"</pre>
            <p class="small muted">Set <code>cron_key</code> in <code>api/config.local.php</code> to any long random string and use the same value in the URL. ${st.cron_configured ? '<span class="chip good">cron key set</span>' : '<span class="chip warn">cron key not set</span>'} The cron call also refreshes the Canvas cache and prunes old presence rows.</p>
            <div class="row gap-sm mt-2"><button class="btn sm primary" data-action="test">${icon('reply', 13)} Send me a test digest now</button></div></div>`;
        bind(el, { test: async b => { b.disabled = true; try { const r = await api('admin_digest_test', {}); toast(r.message, 4000); } catch (e) { toast(e.message, 5000); } b.disabled = false; } });
      } catch (e) { el.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
    }
  };
})(window);
