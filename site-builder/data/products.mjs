// The three in-house products, their live demos and every demo account.
//
// demo.url: where the public demo instance lives. Change it here and rebuild (node site-builder/build.mjs).
// Set it to null to show "Demo coming soon" instead of an Open button. The deploy kits for each demo are in /demos.

export const products = [
  {
    slug: 'evo',
    name: 'Evo',
    accent: '#4F46E5',
    icon: 'assets/img/products/evo.svg',
    category: 'Business system',
    kind: 'Workforce + point of sale',
    tagline: 'Workforce and store in one app.',
    summary:
      'One sign-in for time clock, scheduling, HR and payroll, plus a full point-of-sale register, inventory and back office for a campus store.',
    intro:
      'Evo replaces a stack of separate tools: employees clock in from their phones inside a GPS geofence, HR builds the schedule and approves requests, Payroll locks and exports pay periods, and the store runs on a touch-screen register that keeps selling even when the network drops.',
    stack: ['Node.js', 'Express', 'SQLite', 'React', 'Vite', 'Tailwind'],
    stats: [
      { value: '2-in-1', label: 'Workforce and Store, one sign-in' },
      { value: '7', label: 'roles to sign in as' },
      { value: 'Offline', label: 'register keeps selling' },
    ],
    highlights: [
      { icon: 'pin', title: 'Geofenced time clock', text: 'Clock in from a phone only inside the work site radius, with breaks, notes and late or early flags.' },
      { icon: 'calendar', title: 'Scheduler and approvals', text: 'Week grid, templates, open shifts and trades, with conflict warnings for time off, availability and overtime.' },
      { icon: 'wallet', title: 'Payroll periods', text: 'Review every timesheet, lock the period, mark it paid and export CSV for your payroll provider.' },
      { icon: 'register', title: 'Touch-screen register', text: 'Sales, returns, exchanges, gift cards, department charges, overrides and till X/Z reports.' },
      { icon: 'box', title: 'Inventory and purchasing', text: 'Catalogue with cost history, stock counts, purchase orders, receiving, vendors and promotions.' },
      { icon: 'shield', title: 'Built-in controls', text: 'Separation of duties, two-step sign-in for privileged roles, hash-chained audit records and encrypted backups.' },
    ],
    features: [
      {
        title: 'Workforce',
        items: [
          'Home dashboard with a live clock card, hours, shifts and announcements',
          'GPS geofence per site: block, flag or off',
          'Team schedule with notes on every shift',
          'Shift trades, cover requests and open-shift pickup',
          'Time off balances, accruals and a team absence calendar',
          'Punch corrections and timesheet sign-off',
        ],
      },
      {
        title: 'HR & Payroll',
        items: [
          'Live overview: who is working, late or on break',
          'Approvals inbox for time off, corrections and trades',
          'Employee onboarding with single-use temporary passwords',
          'Effective-dated pay rates and overtime rules',
          'Pay periods: open, locked, paid, with CSV export',
          'Audit log of every change with a tamper check',
        ],
      },
      {
        title: 'Store',
        items: [
          'Register with sign-on by ID and PIN on enrolled devices',
          'Sales journal searchable by receipt, SKU, customer or PO',
          'Items, pricing, shelf labels and stock ledger',
          'Customers (CRM), charge accounts and gift cards',
          'Stock handheld app for scanners',
          'Customer display for a second screen',
        ],
      },
    ],
    demo: {
      url: 'https://evo-demo.evosoft.solutions',
      label: 'evo-demo.evosoft.solutions',
      company: 'Bluefield Market Co.: 17 people, 3 sites, 8 weeks of history, and the Bluefield Campus Store with about five weeks of sales.',
      resets: 'The demo resets every few hours, so feel free to approve, edit and ring up sales.',
      note: 'Use a desktop browser for the Store section. On a phone you get the employee app (clock in, schedule, time off).',
      accounts: [
        { role: 'Owner', name: 'Hannah Reyes', login: 'hr@evo.test', password: 'demo1234', badge: 'Full access', tries: ['See the whole company on Home and the HR overview', 'Switch to Store and open the sales overview', 'Enrol your browser as Register 1 (see below)'] },
        { role: 'HR', name: 'Grace Liu', login: 'grace.liu@evo.test', password: 'demo1234', tries: ['Build next week in the Scheduler', 'Approve a time-off request', 'Edit a geofence on the Locations map'] },
        { role: 'Payroll', name: 'Paul', login: 'payroll@evo.test', password: 'demo1234', tries: ['Review a pay period', 'Fix a missed punch with a reason', 'Lock the period and export CSV'] },
        { role: 'Employee', name: 'Alex Morgan', login: 'employee@evo.test', password: 'demo1234', badge: 'Try on your phone', tries: ['Clock in and start a break', 'Request time off and watch the balance preview', 'Offer a shift to the team'] },
        { role: 'Store manager', name: 'Omar Haddad', login: 'omar.haddad@evo.test', password: 'demo1234', tries: ['Today’s sales, tenders and low stock', 'Search the sales journal', 'Create a purchase order from reorder points'] },
        { role: 'Shift supervisor', name: 'Jordan Lee', login: 'jordan.lee@evo.test', password: 'demo1234', tries: ['Check the team schedule', 'Approve register overrides with ID 2001'] },
        { role: 'Warehouse lead', name: 'Marcus Johnson', login: 'marcus.johnson@evo.test', password: 'demo1234', tries: ['Receive stock and adjust with reason codes', 'Run a cycle count'] },
      ],
      tables: [
        {
          title: 'Register and handheld sign-on',
          text: 'At the register and on the stock handheld, staff sign on with a register ID and PIN. Every demo PIN is 1234.',
          columns: ['Register ID', 'Person', 'Store role'],
          rows: [
            ['1000', 'Hannah Reyes (owner)', 'Administrator'],
            ['1001', 'Alex Morgan', 'Cashier'],
            ['1002', 'Priya Patel', 'Cashier'],
            ['1004', 'Aisha Khan', 'Cashier'],
            ['1005', 'Noah Kim', 'Cashier'],
            ['2001', 'Jordan Lee', 'Supervisor (approves overrides)'],
            ['3001', 'Marcus Johnson', 'Receiving and counts'],
            ['3003', 'Chloe Martin', 'Buyer (items, vendors, POs)'],
            ['5001', 'Omar Haddad', 'Store manager'],
          ],
        },
      ],
      steps: {
        title: 'Try the register',
        items: [
          'Sign in as the owner (hr@evo.test) on a desktop browser.',
          'Open /pos/register/ in the same browser and choose “Use this computer as Register 1”.',
          'Sign on as 1001 with PIN 1234, tap Open till, then scan or key an item.',
          'Need an override? Supervisor 2001, PIN 1234, approves it.',
        ],
      },
      extras: [
        ['Gift card', '6270000000000016 ($50)'],
        ['Charge account', '10-4400 Athletics (tax exempt)'],
        ['Charge account', '10-2210 Biology (PO required)'],
      ],
    },
    shots: [],
  },
  {
    slug: 'mailtabs',
    name: 'Mailtabs',
    accent: '#5B5CF0',
    icon: 'assets/img/products/mailtabs.svg',
    category: 'Web app',
    kind: 'Unified email client',
    tagline: 'Every inbox in one place, in tabs you design.',
    summary:
      'Connect Gmail, Outlook, iCloud, Yahoo or any IMAP account and sort all of it into tabs built from accounts and rules. A complete mail client, not just a reader.',
    intro:
      'Mailtabs is a self-hosted mail client for people with too many inboxes. A tab is a set of accounts plus optional rules, so Work shows only work mail and Receipts collects every order confirmation across every account. Everything you do goes back to the real mailbox, so your phone stays in sync.',
    stack: ['Node.js', 'Express', 'SQLite', 'IMAP', 'SMTP', 'Microsoft Graph', 'Preact'],
    stats: [
      { value: '10+', label: 'providers, plus any IMAP server' },
      { value: 'Tabs', label: 'built from accounts and rules' },
      { value: 'Undo', label: 'send, archive, delete and move' },
    ],
    highlights: [
      { icon: 'layers', title: 'Tabs you design', text: 'Combine accounts and rules like “from contains @company.com” or “subject contains receipt”.' },
      { icon: 'send', title: 'A full mail client', text: 'Write, reply, forward, Cc/Bcc, attachments, formatting, a From picker and address suggestions.' },
      { icon: 'clock', title: 'Undo and schedule send', text: 'A grace period after Send, “tomorrow 8 AM” scheduling and an Outbox with retry.' },
      { icon: 'folder', title: 'Every folder', text: 'Sent, Drafts, Spam, Trash, Archive, your own folders and Gmail labels, with unified views.' },
      { icon: 'key', title: 'Sign in with Google or Microsoft', text: 'OAuth for Gmail and Outlook, or app passwords that are checked before they are saved.' },
      { icon: 'lock', title: 'Encrypted at rest', text: 'Connected passwords and tokens are encrypted with a server key that never leaves your host.' },
    ],
    features: [
      {
        title: 'Reading',
        items: ['Unified Inbox, Starred, Sent, Drafts, Outbox, Spam and Trash', 'Conversation view', 'Search and load older mail', 'Desktop notifications', 'Print or download the original .eml'],
      },
      {
        title: 'Writing',
        items: ['Rich text with formatting and links', 'Per-account signature and sender name', 'Drafts saved to the provider’s real Drafts folder', 'Attachments up to 25 MB', 'Undo send and scheduled send'],
      },
      {
        title: 'Organising',
        items: ['Select many with Shift-click ranges', 'Archive, move, spam, star and mark read in bulk', 'Undo for 10 seconds (or press z)', 'Create, rename and delete folders', 'Keyboard shortcuts for everything'],
      },
    ],
    demo: {
      url: 'https://mail-demo.evosoft.solutions',
      label: 'mail-demo.evosoft.solutions',
      company: 'A demo login with several fictional mailboxes, connected to a private demo mail server. Nothing in the demo can reach real email.',
      resets: 'The demo resets regularly, so feel free to archive, delete and send.',
      note: 'Messages you send in the demo are delivered only to the other demo mailboxes.',
      accounts: [],
      tables: [],
      extras: [],
    },
    shots: [],
  },
  {
    slug: 'studycat',
    name: 'StudyCat',
    accent: '#1F5EFF',
    icon: 'assets/img/products/studycat.svg',
    category: 'Learning platform',
    kind: 'Study hub and community',
    tagline: 'A free study hub for university courses.',
    summary:
      'Notes, formula sheets, flashcards, endless practice problems, interactive tools and a moderated community for eight Montana State University courses, live at studycat.org.',
    intro:
      'StudyCat gives every class the same complete toolkit: a dashboard with the next exam, notes with worked examples, spaced-repetition flashcards, a quizzer that generates new problems forever, and exam prep. Students sign in to sync progress across devices, join discussions and use it offline as an installed app.',
    stack: ['JavaScript', 'PHP 8', 'SQLite', 'PWA / offline', 'MathJax'],
    live: { url: 'https://studycat.org', label: 'studycat.org' },
    stats: [
      { value: '8', label: 'university courses' },
      { value: '7', label: 'languages' },
      { value: 'Offline', label: 'installable app' },
    ],
    highlights: [
      { icon: 'book', title: 'Every class, complete', text: 'Dashboard, calendar, notes, formula sheet, flashcards, quizzer, exam prep and the syllabus rules.' },
      { icon: 'sparkle', title: 'Endless practice', text: 'Procedurally generated problems with typed or multiple-choice answers, practice or timed-exam mode.' },
      { icon: 'chart', title: 'Interactive tools', text: 'Function explorer, unit circle, grapher, Riemann sums, projectile simulator and a Python playground.' },
      { icon: 'chat', title: 'Moderated discussions', text: 'Threaded posts with votes, anonymous posting, reports, blocking, a language filter and a mod queue.' },
      { icon: 'calendar', title: 'Canvas sync and planner', text: 'Real due dates from the Canvas calendar feed and a study planner that spreads work across days.' },
      { icon: 'wifi', title: 'Works offline', text: 'Installs to a phone’s home screen; notes, flashcards and tools open without a connection.' },
    ],
    features: [
      {
        title: 'For students',
        items: ['Spaced review flashcards', 'Smart review weighted to weak topics', 'Study planner per exam', 'Streaks, XP and daily goals', 'GPA calculator and focus room'],
      },
      {
        title: 'Community',
        items: ['Reddit-style boards per class', 'Anonymous posts (moderators still see the author)', 'Reports, blocking and a language filter', 'Reply notifications and a weekly digest', 'Math rendering in posts'],
      },
      {
        title: 'Running the site',
        items: ['Admin panel: members, bans, site settings', 'Class packs: add a course from one file', 'StudyCat Faculty for instructors', 'Static SEO study guides for every topic', 'Backups, cost alerts and a weekly report'],
      },
    ],
    demo: {
      url: 'https://studycat-demo.evosoft.solutions',
      label: 'studycat-demo.evosoft.solutions',
      company: 'A separate demo copy of StudyCat with demo accounts for each role. The real site, with real students, is studycat.org.',
      resets: 'The demo resets nightly.',
      note: 'You can also browse StudyCat without an account: guests get a preview of every class.',
      accounts: [],
      tables: [],
      extras: [],
    },
    shots: [],
  },
];
