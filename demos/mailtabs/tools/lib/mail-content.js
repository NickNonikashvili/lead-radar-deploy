'use strict';

/**
 * The seeded demo mail: ~60 messages across four fictional mailboxes.
 * All people, companies and domains are invented; every domain is under the reserved .test TLD.
 * Dates are relative to `now`, so the inbox always looks current after a reset.
 */

const { makePdf, heroMockPng, lakePhotoPng, signupChartPng } = require('./attachments');

const BOX = {
  work: 'alex@work.demo.test',
  personal: 'alex.personal@demo.test',
  side: 'alex@sideproject.demo.test',
  club: 'alex@runclub.demo.test',
};

const ME = 'Alex Morgan';
const P = {
  priya: { name: 'Priya Raman', address: 'priya.raman@work.demo.test' },
  jonas: { name: 'Jonas Weber', address: 'jonas.weber@work.demo.test' },
  maya: { name: 'Maya Chen', address: 'maya.chen@work.demo.test' },
  tom: { name: 'Tom Okafor', address: 'tom.okafor@work.demo.test' },
  lena: { name: 'Lena Fischer', address: 'lena.fischer@work.demo.test' },
  people: { name: 'Fernhill People Team', address: 'people@work.demo.test' },
  metrics: { name: 'Fernhill Metrics', address: 'metrics@work.demo.test' },
  code: { name: 'Fernhill Code Review', address: 'code-review@work.demo.test' },
  legal: { name: 'Hana Ito (Legal)', address: 'hana.ito@work.demo.test' },
  travel: { name: 'Fernhill Travel Desk', address: 'travel@work.demo.test' },
  finance: { name: 'Fernhill Finance', address: 'finance@work.demo.test' },
  it: { name: 'Fernhill IT', address: 'it@work.demo.test' },
  saltmarsh: { name: 'Ruth Calloway', address: 'ruth@saltmarsh.demo.test' },
  oakridge: { name: 'Dr. Imran Shah', address: 'imran.shah@oakridge-clinic.demo.test' },
  spam1: { name: 'Prize Desk', address: 'winner@luckycruise.demo.test' },

  sam: { name: 'Sam Morgan', address: 'sam.morgan@demo.test' },
  dad: { name: 'Dad', address: 'peter.morgan@demo.test' },
  noor: { name: 'Noor Haddad', address: 'noor.h@demo.test' },
  landlord: { name: 'Elm Street Lettings', address: 'office@elmstreet-lettings.demo.test' },
  larkspur: { name: 'Larkspur Outdoor', address: 'orders@larkspur.demo.test' },
  larkspurNews: { name: 'Larkspur Field Notes', address: 'newsletter@larkspur.demo.test' },
  pantry: { name: 'Pantry & Co', address: 'receipts@pantry.demo.test' },
  pantryNews: { name: 'Pantry Weekly', address: 'newsletter@pantry.demo.test' },
  lantern: { name: 'Lantern Theatre Box Office', address: 'boxoffice@lantern-theatre.demo.test' },
  tuneloop: { name: 'Tuneloop', address: 'billing@tuneloop.demo.test' },
  hopcab: { name: 'Hopcab', address: 'rides@hopcab.demo.test' },
  skylark: { name: 'Skylark Air', address: 'e-ticket@skylark-air.demo.test' },
  bank: { name: 'Juniper Bank', address: 'statements@juniperbank.demo.test' },
  slowread: { name: 'The Slow Read', address: 'newsletter@slowread.demo.test' },
  spam2: { name: 'Account Security', address: 'security@verify-account.demo.test' },

  bot: { name: 'Tidepool Bot', address: 'bot@tidepool.demo.test' },
  jamie: { name: 'Jamie Rivera', address: 'jamie.rivera@demo.test' },
  kai: { name: 'Kai Nakamura', address: 'kai@nakamura.demo.test' },
  cloudnine: { name: 'Cloudnine Hosting', address: 'billing@cloudnine.demo.test' },
  ledgerly: { name: 'Ledgerly Payouts', address: 'payouts@ledgerly.demo.test' },
  domainly: { name: 'Domainly', address: 'renewals@domainly.demo.test' },
  rosa: { name: 'Rosa Lindqvist', address: 'rosa@brightnote.demo.test' },
  indie: { name: 'Indie Makers Weekly', address: 'newsletter@indiemakers.demo.test' },
  ines: { name: 'Inês Carvalho', address: 'ines.c@demo.test' },
  ollie: { name: 'Ollie Brandt', address: 'ollie@brandt.demo.test' },

  club: { name: 'Riverside Runners', address: 'hello@riverside-runners.demo.test' },
  coach: { name: 'Coach Dana', address: 'dana@riverside-runners.demo.test' },
};

const me = (box) => ({ name: ME, address: BOX[box] });

// --- small HTML helpers ------------------------------------------------------------------------

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function receiptHtml({ brand, color, heading, intro, rows, total, footer }) {
  const lines = rows
    .map(
      ([label, qty, price]) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef0f4">${esc(label)}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #eef0f4;text-align:center;color:#64748b">${esc(qty)}</td>` +
        `<td style="padding:8px 0;border-bottom:1px solid #eef0f4;text-align:right">${esc(price)}</td></tr>`
    )
    .join('');
  return `<div style="font-family:Helvetica,Arial,sans-serif;background:#f4f5f8;padding:24px">
<table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:10px;border-collapse:separate;overflow:hidden">
<tr><td style="background:${color};color:#ffffff;padding:18px 24px;font-size:20px;font-weight:bold;letter-spacing:.3px">${esc(brand)}</td></tr>
<tr><td style="padding:24px">
<h2 style="margin:0 0 8px;font-size:20px;color:#0f172a">${esc(heading)}</h2>
<p style="margin:0 0 18px;color:#475569;line-height:1.5">${esc(intro)}</p>
<table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;color:#0f172a">
<tr><th align="left" style="padding-bottom:6px;color:#64748b;font-weight:normal">Item</th><th style="padding-bottom:6px;color:#64748b;font-weight:normal">Qty</th><th align="right" style="padding-bottom:6px;color:#64748b;font-weight:normal">Price</th></tr>
${lines}
<tr><td style="padding:12px 0;font-weight:bold">Total</td><td></td><td style="padding:12px 0;text-align:right;font-weight:bold">${esc(total)}</td></tr>
</table>
<p style="margin:18px 0 0;color:#64748b;font-size:13px;line-height:1.5">${esc(footer)}</p>
</td></tr></table></div>`;
}

function receiptText({ brand, heading, intro, rows, total, footer }) {
  return [brand, '', heading, intro, '', ...rows.map(([l, q, p]) => `${l}  x${q}  ${p}`), '', `Total: ${total}`, '', footer].join('\n');
}

function newsletterHtml({ brand, color, issue, title, lead, sections, pixel }) {
  const body = sections
    .map(
      (s) =>
        `<h3 style="margin:22px 0 6px;font-size:17px;color:#0f172a">${esc(s.h)}</h3><p style="margin:0;color:#334155;line-height:1.6">${esc(s.p)}</p>`
    )
    .join('');
  return `<div style="font-family:Georgia,'Times New Roman',serif;background:#faf7f2;padding:24px">
<table role="presentation" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px">
<tr><td style="padding:22px 28px;border-bottom:3px solid ${color}">
<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${color}">${esc(brand)} · ${esc(issue)}</div>
<h1 style="margin:8px 0 0;font-size:26px;color:#0f172a">${esc(title)}</h1></td></tr>
<tr><td style="padding:8px 28px 26px"><p style="margin:16px 0 0;color:#334155;line-height:1.6;font-size:16px">${esc(lead)}</p>${body}
<p style="margin:28px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#94a3b8">You're receiving this because you subscribed to ${esc(brand)}. <a href="https://example.invalid/unsubscribe" style="color:#94a3b8">Unsubscribe</a> · <a href="https://example.invalid/preferences" style="color:#94a3b8">Email preferences</a></p>
${pixel ? '<img src="https://pixel.newsletter.demo.test/open.gif?u=8812" width="1" height="1" alt="">' : ''}
</td></tr></table></div>`;
}

function newsletterText({ brand, issue, title, lead, sections }) {
  return [
    `${brand} · ${issue}`,
    title,
    '',
    lead,
    ...sections.flatMap((s) => ['', s.h, s.p]),
    '',
    `You're receiving this because you subscribed to ${brand}. Unsubscribe: https://example.invalid/unsubscribe`,
  ].join('\n');
}

const para = (...ps) => ps.join('\n\n');

// --- dates --------------------------------------------------------------------------------------

function makeClock(now) {
  const day = 24 * 60 * 60 * 1000;
  return {
    /** `d` days ago at hh:mm UTC. */
    at(d, hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      const t = new Date(now.getTime() - d * day);
      t.setUTCHours(h, m, Math.floor(Math.random() * 50), 0);
      // Never in the future (a "today 17:00" seeded at 09:00 becomes an hour ago).
      return t.getTime() > now.getTime() - 60 * 1000 ? new Date(now.getTime() - (90 + d) * 60 * 1000) : t;
    },
    hoursAgo(h) {
      return new Date(now.getTime() - h * 60 * 60 * 1000);
    },
    /** The next given weekday (0=Sun) at hh:mm UTC, at least two days away. */
    next(weekday, hhmm) {
      const [h, m] = hhmm.split(':').map(Number);
      const t = new Date(now.getTime() + 2 * day);
      while (t.getUTCDay() !== weekday) t.setTime(t.getTime() + day);
      t.setUTCHours(h, m, 0, 0);
      return t;
    },
  };
}

function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (d) => `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

// --- the messages -------------------------------------------------------------------------------

/**
 * @returns {{ folders: Record<string,string[]>, messages: Array<object> }}
 * Each message: { key, box, folder, from, to, cc?, subject, date, text, html?, attachments?,
 *                 icalEvent?, headers?, replyTo? (key of the parent), flags: string[] }
 */
function buildDemoMail(now = new Date()) {
  const c = makeClock(now);
  const reviewStart = c.next(4, '13:00'); // Thursday 14:00 CET
  const reviewEnd = new Date(reviewStart.getTime() + 60 * 60 * 1000);
  const raceDay = c.next(0, '08:30');
  const flightDay = new Date(now.getTime() + 28 * 24 * 3600 * 1000);
  const week = Math.ceil(((now - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);

  const m = [];
  const add = (msg) => {
    m.push({ folder: 'INBOX', flags: ['\\Seen'], ...msg });
    return msg.key;
  };
  const unread = (msg) => add({ ...msg, flags: [] });

  // =============================== WORK: alex@work.demo.test =================================
  add({
    key: 'w-plan-1',
    box: 'work',
    from: P.priya,
    to: [me('work')],
    cc: [P.jonas, P.maya],
    subject: 'Homepage refresh: Q4 launch plan',
    date: c.at(4, '08:12'),
    flags: ['\\Seen', '\\Answered', '\\Flagged'],
    text: para(
      'Hi all,',
      "Here's the plan for the homepage refresh. The goal is simple: explain what Fernhill does in one screen, and get more teams to start a trial.",
      'Timeline\n- Next Tuesday: final copy from Marketing\n- The week after: design freeze\n- First Monday of December: launch',
      'Owners\n- Hero section and illustration: Alex + Jonas\n- Pricing table and FAQ: Maya\n- Analytics and A/B test setup: me',
      "Alex, could you own the hero? I'd love a first pass we can react to by the end of this week. Shout if the timeline looks too tight.",
      'Thanks!\nPriya'
    ),
  });
  add({
    key: 'w-plan-2',
    box: 'work',
    folder: 'Sent',
    replyTo: 'w-plan-1',
    from: me('work'),
    to: [P.priya],
    cc: [P.jonas, P.maya],
    subject: 'Re: Homepage refresh: Q4 launch plan',
    date: c.at(4, '09:03'),
    text: para(
      'Happy to own the hero.',
      "Jonas and I will pair on it tomorrow morning. I'll share a first pass by Thursday with two headline options, so we can test them against each other.",
      'One question: do we keep the product screenshot above the fold, or go with an illustration this time?',
      'Alex'
    ),
  });
  add({
    key: 'w-plan-3',
    box: 'work',
    replyTo: 'w-plan-2',
    from: P.jonas,
    to: [me('work'), P.priya],
    cc: [P.maya],
    subject: 'Re: Homepage refresh: Q4 launch plan',
    date: c.at(3, '15:40'),
    text: para(
      'First pass of the hero is attached (hero-v3.png).',
      'We went with an illustration on the right and two calls to action: "Start free trial" and "Book a demo". The card row underneath is for the three main use cases.',
      'Still rough around the edges: spacing on mobile and the gradient need another pass.',
      'Jonas'
    ),
    attachments: [{ filename: 'hero-v3.png', contentType: 'image/png', content: heroMockPng() }],
  });
  add({
    key: 'w-plan-4',
    box: 'work',
    replyTo: 'w-plan-3',
    from: P.maya,
    to: [P.jonas, me('work'), P.priya],
    subject: 'Re: Homepage refresh: Q4 launch plan',
    date: c.at(2, '10:05'),
    text: para(
      'Love the direction! Two small notes:',
      '1. The secondary button ("Book a demo") needs more contrast: it fails AA on the light background.\n2. Could the card icons use our product colours instead of pastels?',
      "Otherwise I think we're close. I'll send an invite for a proper design review on Thursday.",
      'Maya'
    ),
  });
  unread({
    key: 'w-plan-5',
    box: 'work',
    replyTo: 'w-plan-4',
    from: P.priya,
    to: [me('work'), P.jonas, P.maya],
    subject: 'Re: Homepage refresh: Q4 launch plan',
    date: c.hoursAgo(3.2),
    text: para(
      'Great progress, everyone. Locking the timeline as proposed.',
      "Alex, Jonas: if you can fold in Maya's contrast fix before Thursday's review, we can take the hero straight to the A/B test.",
      'Priya'
    ),
  });
  unread({
    key: 'w-invite',
    box: 'work',
    from: P.maya,
    to: [me('work'), P.jonas, P.priya],
    subject: `Invitation: Homepage design review @ ${dayLabel(reviewStart)}, 14:00–15:00`,
    date: c.hoursAgo(5.5),
    text: para(
      `Maya Chen has invited you to: Homepage design review`,
      `When: ${dayLabel(reviewStart)}, 14:00–15:00 (CET)\nWhere: Room Juniper / video link in the calendar entry`,
      "Agenda\n- Hero v3 with the contrast fix\n- Pricing table\n- Open questions for launch",
      'Please accept or decline in your calendar app.'
    ),
    icalEvent: {
      method: 'REQUEST',
      filename: 'invite.ics',
      content: [
        'BEGIN:VCALENDAR',
        'PRODID:-//Mailtabs demo//EN',
        'VERSION:2.0',
        'METHOD:REQUEST',
        'BEGIN:VEVENT',
        `UID:design-review-${reviewStart.getTime()}@work.demo.test`,
        `DTSTAMP:${icsDate(now)}`,
        `DTSTART:${icsDate(reviewStart)}`,
        `DTEND:${icsDate(reviewEnd)}`,
        'SUMMARY:Homepage design review',
        'LOCATION:Room Juniper',
        'DESCRIPTION:Hero v3\\, pricing table\\, open questions for launch.',
        'ORGANIZER;CN=Maya Chen:mailto:maya.chen@work.demo.test',
        'ATTENDEE;CN=Alex Morgan;RSVP=TRUE:mailto:alex@work.demo.test',
        'ATTENDEE;CN=Jonas Weber;RSVP=TRUE:mailto:jonas.weber@work.demo.test',
        'ATTENDEE;CN=Priya Raman;RSVP=TRUE:mailto:priya.raman@work.demo.test',
        'END:VEVENT',
        'END:VCALENDAR',
      ].join('\r\n'),
    },
  });
  unread({
    key: 'w-metrics',
    box: 'work',
    from: P.metrics,
    to: [me('work')],
    subject: `Weekly product metrics: week ${week}`,
    date: c.at(1, '06:00'),
    text: 'Weekly product metrics\n\nTrials started: 1,284 (+9%)\nTrial to paid: 14.2% (+0.6 pt)\nWeekly active teams: 8,930 (+3%)\nChurn: 1.1% (-0.2 pt)',
    html: `<div style="font-family:Helvetica,Arial,sans-serif;color:#0f172a;max-width:560px">
<h2 style="margin:0 0 4px">Weekly product metrics</h2><p style="margin:0 0 16px;color:#64748b">Week ${week} · all regions</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<tr style="background:#f1f5f9"><th align="left" style="padding:8px">Metric</th><th align="right" style="padding:8px">This week</th><th align="right" style="padding:8px">Change</th></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Trials started</td><td align="right" style="padding:8px;border-bottom:1px solid #e2e8f0">1,284</td><td align="right" style="padding:8px;border-bottom:1px solid #e2e8f0;color:#059669">+9%</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Trial → paid</td><td align="right" style="padding:8px;border-bottom:1px solid #e2e8f0">14.2%</td><td align="right" style="padding:8px;border-bottom:1px solid #e2e8f0;color:#059669">+0.6 pt</td></tr>
<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0">Weekly active teams</td><td align="right" style="padding:8px;border-bottom:1px solid #e2e8f0">8,930</td><td align="right" style="padding:8px;border-bottom:1px solid #e2e8f0;color:#059669">+3%</td></tr>
<tr><td style="padding:8px">Churn</td><td align="right" style="padding:8px">1.1%</td><td align="right" style="padding:8px;color:#059669">−0.2 pt</td></tr>
</table><p style="color:#64748b;font-size:12px;margin-top:16px">Sent automatically every Monday by the Fernhill metrics service.</p></div>`,
  });
  add({
    key: 'w-pr-1',
    box: 'work',
    from: P.code,
    to: [me('work')],
    subject: '[fernhill/web] PR #812: Tab rules editor (review requested)',
    date: c.at(1, '13:22'),
    text: para(
      'Lena Fischer requested your review on #812 "Tab rules editor".',
      '+412 −96 across 14 files\n\n- Adds the rules editor dialog\n- Moves rule matching into a shared helper\n- Screenshots in the description',
      'View the pull request in the code review tool.'
    ),
  });
  unread({
    key: 'w-pr-2',
    box: 'work',
    from: P.code,
    to: [me('work')],
    subject: '[fernhill/web] PR #812 merged: Tab rules editor',
    date: c.hoursAgo(1.4),
    text: para('Lena Fischer merged #812 "Tab rules editor" into main.', 'Deployed to staging 4 minutes later.'),
  });
  add({
    key: 'w-welcome',
    box: 'work',
    from: P.people,
    to: [{ name: 'Everyone at Fernhill', address: 'everyone@work.demo.test' }],
    subject: 'Please welcome Lena Fischer to the design team 🎉',
    date: c.at(2, '08:30'),
    text: para(
      'Hi everyone,',
      "Please give a warm welcome to Lena Fischer, who joins the design team as a Senior Product Designer this week. Lena spent the last four years designing accessible public-service apps, and she's already shipped her first pull request.",
      'Say hello in the kitchen, or ask her about her collection of vintage maps.',
      'The People Team'
    ),
  });
  add({
    key: 'w-lunch',
    box: 'work',
    from: P.lena,
    to: [{ name: 'Design & Product', address: 'design@work.demo.test' }],
    subject: 'Lunch & learn: accessibility basics (Wednesday 12:30)',
    date: c.at(1, '15:02'),
    text: para(
      'Hi all,',
      "I'm running a 30-minute lunch & learn on Wednesday: colour contrast, focus states and how to test with a screen reader in five minutes. Pizza is on me.",
      'Room Juniper, 12:30. Bring the screen you are working on!',
      'Lena'
    ),
  });
  add({
    key: 'w-interview',
    box: 'work',
    from: P.tom,
    to: [me('work'), P.priya],
    subject: 'Interview notes: Oakridge Clinic (customer call)',
    date: c.at(5, '16:48'),
    flags: ['\\Seen', '\\Flagged'],
    text: para(
      'Notes from today’s call with Dr. Imran Shah at Oakridge Clinic:',
      '- They run 6 locations; front-desk staff share one shared inbox per location\n- Biggest pain: patients email three different addresses and things slip through\n- They loved the idea of one view with tabs per location\n- Concern: who can see what (patient data). Wants per-tab permissions eventually',
      'Recording and transcript are in the research folder. Happy to walk anyone through it.',
      'Tom'
    ),
  });
  add({
    key: 'w-msa-1',
    box: 'work',
    from: P.legal,
    to: [me('work')],
    subject: 'Contract draft for review: Saltmarsh Co. MSA v2',
    date: c.at(6, '11:15'),
    flags: ['\\Seen', '\\Answered'],
    text: para(
      'Hi Alex,',
      'Attached is v2 of the master services agreement with Saltmarsh Co. The design-deliverables section (4.2) is the part I need you to check: does the revision limit of two rounds match how you actually work with them?',
      'If you can reply by Friday we can send it back to Ruth on Monday.',
      'Thanks,\nHana'
    ),
    attachments: [
      {
        filename: 'Saltmarsh-MSA-v2.pdf',
        contentType: 'application/pdf',
        content: makePdf({
          title: 'Master Services Agreement (draft v2)',
          lines: [
            { text: 'Between Fernhill Labs and Saltmarsh Co.', bold: true, size: 13 },
            { text: 'DRAFT FOR REVIEW. Not for signature.', size: 10, gap: 22 },
            { text: '1. Scope', bold: true, gap: 30 },
            'Fernhill Labs provides product design and front-end development services',
            'as described in each Statement of Work.',
            { text: '4.2 Design deliverables', bold: true, gap: 28 },
            'Each deliverable includes up to two (2) rounds of revisions. Further rounds',
            'are billed at the hourly rate in the Statement of Work.',
            { text: '7. Term', bold: true, gap: 28 },
            'Twelve (12) months from the effective date, renewing unless cancelled',
            'with thirty (30) days written notice.',
            { text: 'This document is fictional and was generated for the Mailtabs demo.', size: 9, gap: 60 },
          ],
          accent: [0.15, 0.39, 0.92],
        }),
      },
    ],
  });
  add({
    key: 'w-msa-2',
    box: 'work',
    folder: 'Sent',
    replyTo: 'w-msa-1',
    from: me('work'),
    to: [P.legal],
    subject: 'Re: Contract draft for review: Saltmarsh Co. MSA v2',
    date: c.at(6, '14:40'),
    text: para(
      'Hi Hana,',
      'Two rounds matches what we do in practice. One request: could 4.2 say "two rounds per deliverable" explicitly? Last year we had a debate about whether it was per project.',
      'Everything else looks good to me.',
      'Alex'
    ),
  });
  add({
    key: 'w-offsite',
    box: 'work',
    from: P.travel,
    to: [me('work')],
    subject: 'Booking confirmation & receipt: team offsite in Porto',
    date: c.at(7, '10:30'),
    text: receiptText({
      brand: 'Fernhill Travel Desk',
      heading: 'Your offsite booking is confirmed',
      intro: 'Hotel Ribeira Azul, Porto. 2 nights, check-in Thursday 15:00.',
      rows: [['Double room, river view', '2 nights', '€236.00'], ['Breakfast', '2', '€28.00']],
      total: '€264.00 (charged to the company card)',
      footer: 'Booking reference FH-77120. No action needed: this is your receipt.',
    }),
    html: receiptHtml({
      brand: 'Fernhill Travel Desk',
      color: '#2563eb',
      heading: 'Your offsite booking is confirmed',
      intro: 'Hotel Ribeira Azul, Porto. 2 nights, check-in Thursday 15:00.',
      rows: [['Double room, river view', '2 nights', '€236.00'], ['Breakfast', '2', '€28.00']],
      total: '€264.00',
      footer: 'Charged to the company card. Booking reference FH-77120. No action needed: this is your receipt.',
    }),
  });
  add({
    key: 'w-expense',
    box: 'work',
    from: P.finance,
    to: [me('work')],
    subject: 'Expense report #4471 approved',
    date: c.at(8, '09:10'),
    text: 'Your expense report #4471 (Client workshop, €86.40) was approved by Priya Raman and will be paid with your next salary.',
  });
  add({
    key: 'w-maint',
    box: 'work',
    from: P.it,
    to: [{ name: 'Everyone at Fernhill', address: 'everyone@work.demo.test' }],
    subject: 'Scheduled maintenance this Saturday, 07:00–09:00',
    date: c.at(9, '12:00'),
    text: 'The VPN and the file server will be unavailable on Saturday between 07:00 and 09:00 while we upgrade the network. Nothing else is affected.',
  });
  add({
    key: 'w-slides',
    box: 'work',
    folder: 'Sent',
    from: me('work'),
    to: [P.priya],
    subject: "Slides for Monday's roadmap review",
    date: c.at(2, '17:20'),
    text: para('Hi Priya,', "Here's the outline for Monday: 1) what we shipped, 2) what we learned from the Oakridge call, 3) the homepage plan. I'll send the deck on Sunday evening.", 'Alex'),
  });
  add({
    key: 'w-draft',
    box: 'work',
    folder: 'Drafts',
    flags: ['\\Seen', '\\Draft'],
    from: me('work'),
    to: [P.priya],
    subject: 'Notes for our 1:1',
    date: c.at(1, '18:05'),
    text: para('- Hiring: second designer for Q1?\n- Conference talk proposal (deadline next month)\n- Time off over the holidays'),
  });
  add({
    key: 'w-retro',
    box: 'work',
    folder: 'Archive',
    from: P.priya,
    to: [{ name: 'Product team', address: 'product@work.demo.test' }],
    subject: 'Q3 retro notes',
    date: c.at(13, '16:00'),
    text: para('Thanks for a great retro! Summary:', 'Keep: weekly demos, design crits\nStop: launching on Fridays\nStart: writing release notes as we go', 'Priya'),
  });
  add({
    key: 'w-benefits',
    box: 'work',
    folder: 'Archive',
    from: P.people,
    to: [{ name: 'Everyone at Fernhill', address: 'everyone@work.demo.test' }],
    subject: 'Benefits enrollment closes Friday',
    date: c.at(12, '09:00'),
    text: 'A reminder that the yearly benefits enrollment closes this Friday. If you want to change your plan, do it in the HR portal before then.',
  });
  add({
    key: 'w-salt-kickoff',
    box: 'work',
    folder: 'Clients/Saltmarsh',
    from: P.saltmarsh,
    to: [me('work')],
    subject: 'Kickoff notes and next steps',
    date: c.at(11, '15:30'),
    text: para('Hi Alex,', 'Thanks for a great kickoff. As discussed: we start with the onboarding flow, then the account settings. Our brand guidelines are on the shared drive.', 'Best,\nRuth Calloway\nSaltmarsh Co.'),
  });
  add({
    key: 'w-oak-brand',
    box: 'work',
    folder: 'Clients',
    from: P.oakridge,
    to: [me('work'), P.tom],
    subject: 'Our brand colours and logo files',
    date: c.at(10, '10:45'),
    text: para('Hello Alex and Tom,', 'As promised on the call, here is a summary of our brand colours: deep teal #0f766e, warm sand #f5e6c8 and charcoal #1f2937. The logo files follow from our agency next week.', 'Kind regards,\nImran Shah'),
  });
  add({
    key: 'w-spam',
    box: 'work',
    folder: 'Junk',
    from: P.spam1,
    to: [me('work')],
    subject: "Congratulations!!! You've been selected for a FREE cruise",
    date: c.at(3, '03:12'),
    text: 'You are our lucky winner! Claim your free Caribbean cruise now, just pay the small port fee. Offer ends today!!!',
  });

  // ============================ PERSONAL: alex.personal@demo.test =============================
  add({
    key: 'p-dinner-1',
    box: 'personal',
    from: P.sam,
    to: [me('personal')],
    subject: 'Dinner Saturday?',
    date: c.at(2, '18:30'),
    flags: ['\\Seen', '\\Answered'],
    text: para('Hey!', "Mum's in town this weekend. Dinner on Saturday? I was thinking that new place by the river, Casa Lume. 8 pm?", 'Sam x'),
  });
  add({
    key: 'p-dinner-2',
    box: 'personal',
    folder: 'Sent',
    replyTo: 'p-dinner-1',
    from: me('personal'),
    to: [P.sam],
    subject: 'Re: Dinner Saturday?',
    date: c.at(2, '19:02'),
    text: para("Yes! Saturday works. 8 pm is perfect. I'll bring dessert.", "Should we invite Dad too, or is he still at the lake?", 'A'),
  });
  unread({
    key: 'p-dinner-3',
    box: 'personal',
    replyTo: 'p-dinner-2',
    from: P.sam,
    to: [me('personal')],
    subject: 'Re: Dinner Saturday?',
    date: c.hoursAgo(2.3),
    flags: ['\\Flagged'],
    text: para('Booked! Casa Lume, Saturday 8 pm, table for four. Dad is driving back on Friday, so he\'s in.', 'Sam'),
  });
  add({
    key: 'p-lake',
    box: 'personal',
    from: P.dad,
    to: [me('personal'), P.sam],
    subject: 'Photos from the lake',
    date: c.at(3, '19:45'),
    flags: ['\\Seen', '\\Flagged'],
    text: para('Hi both,', 'The sunsets here have been unreal this week. Here is my favourite one. The cabin is cosy, the fish are not biting.', 'Love,\nDad'),
    attachments: [{ filename: 'lake-sunset.png', contentType: 'image/png', content: lakePhotoPng() }],
  });
  add({
    key: 'p-book',
    box: 'personal',
    from: P.noor,
    to: [me('personal'), { name: 'Ben Ortiz', address: 'ben.ortiz@demo.test' }],
    subject: 'Book club: next pick?',
    date: c.at(4, '20:10'),
    text: para('Okay, we finished the lighthouse one (finally). My vote for next month is something short. Ideas?', 'Noor'),
  });
  add({
    key: 'p-heating',
    box: 'personal',
    from: P.landlord,
    to: [me('personal')],
    subject: 'Heating check on Tuesday morning',
    date: c.at(8, '09:40'),
    text: 'Dear tenant, our engineer will check the boiler in your flat on Tuesday between 9 and 11 am. Please let us know if that time does not suit you. Elm Street Lettings',
  });
  unread({
    key: 'p-larkspur',
    box: 'personal',
    from: P.larkspur,
    to: [me('personal')],
    subject: 'Your order #LK-10482 has shipped',
    date: c.at(1, '08:20'),
    text: receiptText({
      brand: 'Larkspur Outdoor',
      heading: 'Good news: your order is on its way',
      intro: 'Estimated delivery: in 2–3 working days. Tracking number LK10482-77.',
      rows: [['Ridgeline trail jacket, M, moss', '1', '€149.00'], ['Merino hiking socks', '2', '€36.00'], ['Shipping', '', '€0.00']],
      total: '€185.00',
      footer: 'Questions about your order? Just reply to this email.',
    }),
    html: receiptHtml({
      brand: 'LARKSPUR OUTDOOR',
      color: '#166534',
      heading: 'Good news: your order is on its way',
      intro: 'Estimated delivery: in 2–3 working days. Tracking number LK10482-77.',
      rows: [['Ridgeline trail jacket, M, moss', '1', '€149.00'], ['Merino hiking socks', '2', '€36.00'], ['Shipping', '', '€0.00']],
      total: '€185.00',
      footer: 'Questions about your order? Just reply to this email.',
    }),
  });
  add({
    key: 'p-pantry',
    box: 'personal',
    from: P.pantry,
    to: [me('personal')],
    subject: 'Receipt for your Pantry & Co order',
    date: c.at(3, '17:55'),
    text: receiptText({
      brand: 'Pantry & Co',
      heading: 'Thanks for shopping with us',
      intro: 'Delivered Tuesday evening to your door.',
      rows: [['Sourdough loaf', '1', '€4.20'], ['Seasonal veg box', '1', '€18.50'], ['Oat milk, 1 L', '3', '€6.30'], ['Delivery', '', '€2.90']],
      total: '€31.90',
      footer: 'Paid with card ending 4412.',
    }),
    html: receiptHtml({
      brand: 'Pantry & Co',
      color: '#b45309',
      heading: 'Thanks for shopping with us',
      intro: 'Delivered Tuesday evening to your door.',
      rows: [['Sourdough loaf', '1', '€4.20'], ['Seasonal veg box', '1', '€18.50'], ['Oat milk, 1 L', '3', '€6.30'], ['Delivery', '', '€2.90']],
      total: '€31.90',
      footer: 'Paid with card ending 4412.',
    }),
  });
  add({
    key: 'p-lantern',
    box: 'personal',
    from: P.lantern,
    to: [me('personal')],
    subject: 'Your tickets for "The Lighthouse Keeper" (order #LT-2291)',
    date: c.at(5, '12:14'),
    flags: ['\\Seen', '\\Flagged'],
    text: receiptText({
      brand: 'Lantern Theatre',
      heading: 'Your tickets are confirmed',
      intro: 'The Lighthouse Keeper. Doors open 19:15. Show your QR code at the entrance.',
      rows: [['Stalls, row F, seats 11–12', '2', '€58.00'], ['Booking fee', '', '€2.50']],
      total: '€60.50',
      footer: 'Order #LT-2291. Tickets can be exchanged up to 48 hours before the show.',
    }),
    html: receiptHtml({
      brand: 'LANTERN THEATRE',
      color: '#7c2d12',
      heading: 'Your tickets are confirmed',
      intro: 'The Lighthouse Keeper. Doors open 19:15. Show your QR code at the entrance.',
      rows: [['Stalls, row F, seats 11–12', '2', '€58.00'], ['Booking fee', '', '€2.50']],
      total: '€60.50',
      footer: 'Order #LT-2291. Tickets can be exchanged up to 48 hours before the show.',
    }),
  });
  add({
    key: 'p-tuneloop',
    box: 'personal',
    from: P.tuneloop,
    to: [me('personal')],
    subject: 'Your Tuneloop receipt for this month',
    date: c.at(6, '04:00'),
    text: 'Tuneloop Duo plan, monthly: €12.99. Paid with card ending 4412. Thanks for listening!',
  });
  add({
    key: 'p-hopcab',
    box: 'personal',
    from: P.hopcab,
    to: [me('personal')],
    subject: 'Your Sunday evening ride receipt',
    date: c.at(7, '22:41'),
    text: 'Thanks for riding with Hopcab. Central Station → Elm Street, 4.8 km, 14 min. Total €11.40 (incl. €1.50 tip).',
  });
  add({
    key: 'p-skylark',
    box: 'personal',
    from: P.skylark,
    to: [me('personal')],
    subject: `E-ticket receipt & itinerary: LIS → BER, ${flightDay.getUTCDate()} ${MONTHS[flightDay.getUTCMonth()]}`,
    date: c.at(9, '14:05'),
    flags: ['\\Seen', '\\Flagged'],
    text: receiptText({
      brand: 'Skylark Air',
      heading: 'Your e-ticket',
      intro: `Flight SK 418, Lisbon (LIS) 09:40 → Berlin (BER) 14:05 on ${dayLabel(flightDay)}. Booking code QX7TRM.`,
      rows: [['Economy Light, 1 adult', '1', '€94.00'], ['Seat 14A', '1', '€9.00'], ['Taxes and fees', '', '€31.20']],
      total: '€134.20',
      footer: 'Online check-in opens 30 hours before departure.',
    }),
    html: receiptHtml({
      brand: 'SKYLARK AIR',
      color: '#0e7490',
      heading: 'Your e-ticket',
      intro: `Flight SK 418, Lisbon (LIS) 09:40 → Berlin (BER) 14:05 on ${dayLabel(flightDay)}. Booking code QX7TRM.`,
      rows: [['Economy Light, 1 adult', '1', '€94.00'], ['Seat 14A', '1', '€9.00'], ['Taxes and fees', '', '€31.20']],
      total: '€134.20',
      footer: 'Online check-in opens 30 hours before departure.',
    }),
  });
  add({
    key: 'p-bank',
    box: 'personal',
    from: P.bank,
    to: [me('personal')],
    subject: 'Your monthly statement is ready',
    date: c.at(2, '06:30'),
    text: 'Your current account statement for last month is ready to view in online banking. For your security, we never send statements as attachments. Juniper Bank',
  });
  add({
    key: 'p-slowread',
    box: 'personal',
    from: P.slowread,
    to: [me('personal')],
    subject: 'The Slow Read #112: Why we walk',
    date: c.at(2, '07:00'),
    headers: { 'List-Unsubscribe': '<https://example.invalid/unsubscribe>' },
    ...(() => {
      const n = {
        brand: 'The Slow Read',
        color: '#9a3412',
        issue: 'Issue #112',
        title: 'Why we walk',
        lead: 'This week: the quiet science of walking, a city that pays people to take the long way home, and one very patient tortoise.',
        sections: [
          { h: 'The long way home', p: 'A twenty-minute walk does more for focus than a second coffee, and the effect lasts longer. We looked at five studies and one very convincing grandmother.' },
          { h: 'Worth your time', p: 'An essay on maps that leave things out on purpose, and why the best ones are never complete.' },
          { h: 'One more thing', p: 'Reply and tell us your favourite walk. We read every email.' },
        ],
        pixel: true,
      };
      return { text: newsletterText(n), html: newsletterHtml(n) };
    })(),
  });
  add({
    key: 'p-larkspur-news',
    box: 'personal',
    from: P.larkspurNews,
    to: [me('personal')],
    subject: 'Field Notes: 5 autumn trails worth the drive',
    date: c.at(4, '10:00'),
    headers: { 'List-Unsubscribe': '<https://example.invalid/unsubscribe>' },
    ...(() => {
      const n = {
        brand: 'Larkspur Field Notes',
        color: '#166534',
        issue: 'November',
        title: '5 autumn trails worth the drive',
        lead: 'Crisp mornings, empty car parks and the best colours of the year. Here are our staff picks for the season.',
        sections: [
          { h: '1. The Beech Ridge loop', p: '11 km, mostly shaded, with a café at the halfway point. Muddy after rain: bring proper shoes.' },
          { h: '2. Heron Lake circuit', p: 'Flat and family-friendly. Go early for the mist on the water.' },
          { h: 'Gear tip', p: 'Layer up: a thin merino base, a fleece and a light shell beat one heavy jacket.' },
        ],
      };
      return { text: newsletterText(n), html: newsletterHtml(n) };
    })(),
  });
  add({
    key: 'p-pantry-news',
    box: 'personal',
    from: P.pantryNews,
    to: [me('personal')],
    subject: 'Pantry Weekly: soups for cold evenings',
    date: c.at(6, '16:00'),
    headers: { 'List-Unsubscribe': '<https://example.invalid/unsubscribe>' },
    ...(() => {
      const n = {
        brand: 'Pantry Weekly',
        color: '#b45309',
        issue: 'Week ' + week,
        title: 'Soups for cold evenings',
        lead: 'Three one-pot recipes that take 30 minutes and use whatever is left in your veg box.',
        sections: [
          { h: 'Roasted squash & ginger', p: 'Roast, blend, done. Top with toasted seeds.' },
          { h: 'Lentil & lemon', p: 'Cheap, filling, and better the next day.' },
        ],
      };
      return { text: newsletterText(n), html: newsletterHtml(n) };
    })(),
  });
  add({
    key: 'p-lease',
    box: 'personal',
    folder: 'Archive',
    from: P.landlord,
    to: [me('personal')],
    subject: 'Lease renewal for next year',
    date: c.at(12, '11:20'),
    text: 'Dear tenant, your lease ends in February. We are happy to renew on the same terms. Please confirm by the end of the month. Elm Street Lettings',
  });
  add({
    key: 'p-spam',
    box: 'personal',
    folder: 'Junk',
    from: P.spam2,
    to: [me('personal')],
    subject: 'URGENT: your account has been suspended, verify now',
    date: c.at(5, '02:47'),
    text: 'We detected unusual activity. Verify your account within 24 hours or it will be closed. (This is a fake phishing email for the demo.)',
  });

  // ========================= SIDE PROJECT: alex@sideproject.demo.test =========================
  unread({
    key: 's-signups',
    box: 'side',
    from: P.bot,
    to: [me('side')],
    subject: 'Weekly report: 18 new beta testers 📈',
    date: c.at(1, '07:30'),
    text: para(
      'Tidepool weekly report',
      'New beta testers: 18 (best week yet)\nActive this week: 214\nHabits checked off: 6,902\nCrash-free sessions: 99.4%',
      'Signups per week are attached as a chart.'
    ),
    attachments: [{ filename: 'signups-per-week.png', contentType: 'image/png', content: signupChartPng() }],
  });
  unread({
    key: 's-jamie',
    box: 'side',
    from: P.jamie,
    to: [me('side')],
    subject: 'Feedback: the streak reminder is perfect',
    date: c.at(2, '21:14'),
    text: para(
      'Hi Alex,',
      "Just wanted to say: the gentle evening reminder is exactly right. Every other habit app I've tried nags me until I delete it. Tidepool feels calm.",
      'One wish: a widget for the home screen?',
      'Jamie'
    ),
  });
  add({
    key: 's-kai',
    box: 'side',
    from: P.kai,
    to: [me('side')],
    subject: 'Bug: CSV export crashes on Safari 17',
    date: c.at(3, '13:37'),
    flags: ['\\Seen', '\\Flagged'],
    text: para(
      'Hey,',
      'Steps to reproduce:\n1. Open Settings → Export\n2. Choose CSV, "all time"\n3. Click Download: the tab freezes, then reloads',
      'Works fine in Firefox. Happy to test a fix.',
      'Kai'
    ),
  });
  add({
    key: 's-cloudnine',
    box: 'side',
    from: P.cloudnine,
    to: [me('side')],
    subject: 'Your receipt from Cloudnine Hosting (INV-2026-0311)',
    date: c.at(4, '05:00'),
    text: 'Thanks for your payment of €24.00 for the Starter VPS plan (1 month). Your invoice is attached as a PDF.',
    attachments: [
      {
        filename: 'Cloudnine-INV-2026-0311.pdf',
        contentType: 'application/pdf',
        content: makePdf({
          title: 'Cloudnine Hosting: Invoice INV-2026-0311',
          lines: [
            { text: 'Billed to: Alex Morgan, Tidepool', bold: true, size: 12 },
            'alex@sideproject.demo.test',
            { text: 'Starter VPS (2 vCPU, 4 GB RAM), 1 month      EUR 20.00', gap: 34 },
            'Daily backups                                             EUR  4.00',
            { text: 'Total paid                                                EUR 24.00', bold: true, gap: 26 },
            { text: 'Paid by card ending 9031. Thank you!', gap: 26 },
            { text: 'Fictional company and invoice, generated for the Mailtabs demo.', size: 9, gap: 60 },
          ],
          accent: [0.85, 0.47, 0.02],
        }),
      },
    ],
  });
  add({
    key: 's-ledgerly',
    box: 'side',
    from: P.ledgerly,
    to: [me('side')],
    subject: 'Payout receipt: €482.10 is on its way',
    date: c.at(5, '09:00'),
    text: 'Your payout of €482.10 (37 subscriptions, minus fees) is on its way to your bank account ending 2207. It usually arrives in 1–2 working days.',
  });
  add({
    key: 's-domain',
    box: 'side',
    from: P.domainly,
    to: [me('side')],
    subject: 'Receipt: tidepool.demo.test renewed for 1 year',
    date: c.at(10, '03:30'),
    text: 'Your domain tidepool.demo.test was renewed for 1 year (€13.00). Auto-renew stays on.',
  });
  add({
    key: 's-rosa-1',
    box: 'side',
    from: P.rosa,
    to: [me('side')],
    subject: 'Partnership idea: Tidepool × Brightnote',
    date: c.at(6, '10:20'),
    flags: ['\\Seen', '\\Answered'],
    text: para(
      'Hi Alex,',
      "I make Brightnote, a journaling app with a similar crowd to yours. What would you think of a small bundle: a month of each for subscribers of the other? No money changes hands, just a coupon code each way.",
      'Rosa'
    ),
  });
  add({
    key: 's-rosa-2',
    box: 'side',
    folder: 'Sent',
    replyTo: 's-rosa-1',
    from: me('side'),
    to: [P.rosa],
    subject: 'Re: Partnership idea: Tidepool × Brightnote',
    date: c.at(6, '18:45'),
    text: para('Hi Rosa,', "I love this. Brightnote is one of the apps my testers mention most. Let's try it in January? I can set up the coupon on my side this week.", 'Alex'),
  });
  add({
    key: 's-rosa-3',
    box: 'side',
    replyTo: 's-rosa-2',
    from: P.rosa,
    to: [me('side')],
    subject: 'Re: Partnership idea: Tidepool × Brightnote',
    date: c.at(5, '08:05'),
    text: para('January is perfect. I drafted a short blurb for both newsletters; I\'ll send it over next week.', 'Rosa'),
  });
  add({
    key: 's-indie',
    box: 'side',
    from: P.indie,
    to: [me('side')],
    subject: 'Indie Makers Weekly #58: pricing your first app',
    date: c.at(3, '06:00'),
    headers: { 'List-Unsubscribe': '<https://example.invalid/unsubscribe>' },
    ...(() => {
      const n = {
        brand: 'Indie Makers Weekly',
        color: '#7c3aed',
        issue: '#58',
        title: 'Pricing your first app',
        lead: 'Most makers charge too little. This week: three founders on raising prices without losing customers.',
        sections: [
          { h: 'Charge for outcomes, not features', p: 'Your customers buy the result. Price the result.' },
          { h: 'Run the experiment', p: 'Raise the price for new customers only, and watch conversion for four weeks before deciding.' },
        ],
      };
      return { text: newsletterText(n), html: newsletterHtml(n) };
    })(),
  });
  add({
    key: 's-fb-1',
    box: 'side',
    folder: 'Feedback',
    from: P.ines,
    to: [me('side')],
    subject: 'Dark mode please!',
    date: c.at(13, '22:10'),
    text: 'I check my habits in bed and the white screen is blinding. Dark mode would make my day.',
  });
  add({
    key: 's-fb-2',
    box: 'side',
    folder: 'Feedback',
    from: P.ollie,
    to: [me('side')],
    subject: 'Feature request: weekly goals',
    date: c.at(11, '12:30'),
    text: 'Some habits are "3 times a week", not daily. Would love weekly goals!',
  });

  // ============================ RUN CLUB: alex@runclub.demo.test ==============================
  // Not connected by seed-demo.js: visitors can add this one themselves with "Add account".
  add({
    key: 'c-welcome',
    box: 'club',
    from: P.club,
    to: [me('club')],
    subject: 'Welcome to Riverside Runners!',
    date: c.at(13, '18:00'),
    text: 'Welcome to the club! We run Tuesdays at 18:30 (intervals) and Saturdays at 08:00 (long run) from the boathouse. All paces welcome.',
  });
  add({
    key: 'c-kit',
    box: 'club',
    from: P.club,
    to: [me('club')],
    subject: 'Club kit order receipt #RR-0193',
    date: c.at(6, '12:00'),
    text: 'Thanks for your order! Club running vest (M) €25.00, club cap €12.00. Total €37.00. Pick it up at Saturday\'s run.',
  });
  add({
    key: 'c-long',
    box: 'club',
    from: P.coach,
    to: [{ name: 'Riverside Runners', address: 'members@riverside-runners.demo.test' }],
    subject: 'Saturday long run: 14 km river loop',
    date: c.at(2, '19:30'),
    text: 'This Saturday we do the full river loop, 14 km. Two pace groups (5:30 and 6:15 per km). Coffee after at the boathouse.',
  });
  unread({
    key: 'c-race',
    box: 'club',
    from: P.coach,
    to: [{ name: 'Riverside Runners', address: 'members@riverside-runners.demo.test' }],
    subject: `Race day logistics: Harbour 10K on ${dayLabel(raceDay)}`,
    date: c.hoursAgo(6),
    text: 'Bib pick-up from 07:30 at the harbour tent. Start at 08:30. We meet at the club flag by the fountain at 07:45 for a group warm-up. Good luck everyone!',
  });

  const folders = {
    work: ['Clients', 'Clients/Saltmarsh'],
    personal: [],
    side: ['Feedback'],
    club: [],
  };
  return { folders, messages: m, BOX };
}

module.exports = { buildDemoMail, BOX, ME };
