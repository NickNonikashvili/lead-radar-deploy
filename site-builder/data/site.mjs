// Everything about the company that appears on more than one page, and what the chat assistant knows.
// Contact details come from the original evosoft.solutions site (November 2026).

export const site = {
  name: 'EvoSoft',
  legalName: 'EvoSoft Solutions',
  // The company as registered in Georgia: a limited liability company (შპს). Fill in the identification code and the
  // registered address when they should be published; empty values are left off the legal notice and the structured data.
  legalForm: 'LLC',
  companyId: '',
  address: { street: '', city: '', postalCode: '' },
  vatPayer: null, // true or false once known; null leaves it off
  legalUpdated: '2026-11-25', // date shown on the legal page; change it only when that text changes
  // How long the website keeps a quote request (api/quote.php deletes older ones; keep in step with quote_keep_months)
  quoteKeepMonths: 12,
  url: 'https://evosoft.solutions',
  email: 'contact@evosoft.solutions',
  phones: ['+995 555 352 218', '+995 599 574 416'],
  responseTime: 'within one business day',
  region: 'Georgia',
  countryCode: 'GE',
  year: 2026,
  copyright: '© 2026 EvoSoft Solutions. All rights reserved.',
  // The company's slogan: the home page headline, the footer, the share image and the structured data.
  slogan: 'Your digital evolution starts here',
  // Used for the home page <title> and meta description, and as the company summary everywhere else.
  title: 'EvoSoft | Software, Web & App Development Studio in Georgia',
  description:
    'EvoSoft is a software development studio in Georgia. We build websites, online stores, web apps and business software, and we look after them after launch. Free quotes, replies within one business day.',
  // Shown in Google results: keep under ~160 characters.
  metaDescription: 'Software development studio in Georgia. Websites, online stores, web apps and business software, built to order. Free quotes and replies within one business day.',
  short:
    'A software development studio in Georgia building websites, online stores, web apps and business systems for clients at home and abroad.',
};

export const nav = [
  { href: 'portfolio', label: 'Work', key: 'portfolio' },
  { href: 'demos', label: 'Demos', key: 'demos' },
  { href: 'services', label: 'Services', key: 'services' },
  { href: 'about', label: 'About', key: 'about' },
];

export const services = [
  {
    name: 'Websites',
    line: 'Fast, hand-built sites that are easy to update, with search-friendly code and on-page SEO.',
    text: 'Company sites, landing pages and portfolios, written by hand rather than stacked from templates. Mobile-first, quick to load, with on-page SEO and a contact form that reaches you.',
    examples: ['Company websites', 'Landing pages', 'Blogs and portfolios'],
  },
  {
    name: 'Online stores',
    line: 'Catalogue, checkout and payments, set up so you can run the shop yourself.',
    text: 'Product catalogues small or large, checkout through an established payment gateway (it handles the card details), and an admin you can actually use. Built to load quickly on phones, where many customers shop.',
    examples: ['Ecommerce sites', 'Payment integration', 'Product catalogues'],
  },
  {
    name: 'Web apps and custom software',
    line: 'Booking systems, portals, dashboards and internal tools, shaped around how you work.',
    text: 'When off-the-shelf software gets in the way, we build the tool you actually need: customer portals, booking and ordering systems, dashboards and internal admin tools.',
    examples: ['Customer portals', 'Booking and ordering', 'Dashboards and admin tools'],
  },
  {
    name: 'Business systems',
    line: 'Point of sale, inventory, scheduling, HR and payroll, like our own Evo.',
    text: 'Systems that run the day-to-day: registers and inventory, staff scheduling and time clocks, approvals, payroll exports and reports. Evo, one of our products, is a working example you can sign in to.',
    examples: ['POS and inventory', 'Scheduling and time clocks', 'HR and payroll tools'],
  },
  {
    name: 'Integrations and automation',
    line: 'Connect the tools you already use and stop copying data between them by hand.',
    text: 'APIs, data imports and exports, email and calendar integrations, and small automations that cut repetitive copy-and-paste work.',
    examples: ['API integrations', 'Data imports and exports', 'Workflow automation'],
  },
  {
    name: 'SEO and redesigns',
    line: 'Technical SEO, speed work and a fresh look that keeps what already works.',
    text: 'On-page and technical SEO, site speed, Search Console setup, and redesigns that modernise a site without a full rebuild. Nobody can promise a Google ranking, but we fix what is in your control.',
    examples: ['Technical SEO audits', 'Speed optimisation', 'Redesigns'],
  },
  {
    name: 'Branding and graphic design',
    line: 'Logos, icons and banners, with the source files handed to you.',
    text: 'Logos, icon sets, banners and a simple visual system so everything you publish looks like it belongs together.',
    examples: ['Logos', 'Icon sets and banners', 'Brand guidelines'],
  },
  {
    name: 'Microsoft 365, email and IT',
    line: 'Business email on your domain, Outlook everywhere, and help when tech breaks.',
    text: 'Microsoft 365 business email on your own domain, Outlook on desktop and mobile, migrations from Gmail or Yahoo, shared mailboxes, DNS and day-to-day tech support.',
    examples: ['Microsoft 365 setup', 'Email migration', 'Domains, DNS and support'],
  },
  {
    name: 'Maintenance and support',
    line: 'Updates, backups and fixes after launch, monthly or when you need them.',
    text: 'Every project comes with a period of free support after launch. After that you can move to monthly maintenance, or take over yourself with the handover your quote sets out.',
    examples: ['Monthly maintenance', 'Content updates', 'Fixes and improvements'],
  },
];

export const process = [
  { title: 'Talk', text: 'A free call or a few emails about what you need, who it is for and when you need it.' },
  { title: 'Quote', text: 'You get a written scope, timeline and price. Nothing is booked until you agree to it.' },
  { title: 'Build', text: 'You see working progress early and often. Most websites take one to three weeks.' },
  { title: 'Launch and support', text: 'We go live together and stay around for fixes, updates and new features.' },
];

export const promises = [
  ['A reply within one business day', 'Email, phone or the quote form. A person reads it and answers.'],
  ['A clear quote before any work', 'Scope, timeline and price in writing, before anything is booked.'],
  ['Progress you can see', 'Working previews during the build, not just a reveal at the end.'],
  ['Everything handed over', 'For work we build for you: source files, logins and notes on how it all fits together. Your quote says exactly what you get.'],
  ['Help after launch', 'A period of free fixes after go-live (your quote says how long), then optional monthly maintenance.'],
  ['Many kinds of project', 'A five-page site, an online store, a POS system or an email migration: one team for all of it.'],
];

export const faq = [
  {
    q: 'How much does a project cost?',
    a: 'It depends on what you need, so every project gets its own quote. Quotes are free, and you will know the price before anything is booked. Send a few lines through the quote form to get one.',
  },
  {
    q: 'How long does a project take?',
    a: 'Most websites take one to three weeks from kickoff to launch, depending on how much content is ready. Online stores usually take three to five weeks. Larger software is planned in stages, and the timeline in your written quote is the one that counts.',
  },
  {
    q: 'Do you only build websites?',
    a: 'No. We also take on software and IT work: web apps, business systems, integrations, Microsoft 365 and email. Evo, Mailtabs and StudyCat on this site are our own products.',
  },
  {
    q: 'Can I pay in installments?',
    a: 'Yes. Larger projects can be split into two payments: half to begin and half at launch. Just mention it when you get in touch.',
  },
  {
    q: 'What happens after launch?',
    a: 'Every project includes a period of free support. After that you can move to monthly maintenance at any time, or handle updates yourself. Your quote says exactly what we hand over.',
  },
  {
    q: 'Do you work with clients outside Georgia?',
    a: 'Yes. Most of our work happens remotely over email and calls, so location is not a limitation.',
  },
  {
    q: 'What should I send before we talk?',
    a: 'A rough idea of what you need, your timeline, and any sites or apps you like. We will follow up with specific questions.',
  },
  {
    q: 'Is the quote really free?',
    a: 'Yes, no strings attached. We talk through your project and give you a realistic scope and price before anything is booked.',
  },
];

// Client websites from the original portfolio page. A screenshot can be added as `shot: 'clients/<file>.jpg'` (saved in
// evosoft-site/assets/shots/clients/, then run site-builder/images.mjs); without one the card shows the site's name.
export const clients = [
  { name: 'Larifan', url: 'https://larifan.ge/', kind: 'Online store', text: 'A mobile-first storefront built for everyday browsing and a quick checkout.' },
  { name: 'BabyCalm Georgia', url: 'https://babycalmgeorgia.ge/', kind: 'Local business', text: 'A warm site for a baby-care brand, with a product catalogue and inquiry forms.' },
  { name: 'IPG', url: 'https://ipg.ge/', kind: 'Corporate website', text: 'A clear multi-page site presenting a company and its services.' },
];

// What the quote form offers. Keep in sync with api/quote.php (it accepts any of these labels).
export const quoteTypes = [
  'Website',
  'Online store',
  'Web app or custom software',
  'Business system (POS, HR, inventory)',
  'Integration or automation',
  'SEO or redesign',
  'Branding or graphic design',
  'Microsoft 365, email or IT',
  'Something else',
];
export const quoteTimelines = ['Flexible', 'As soon as possible', 'Within a month', 'In 1 to 3 months', 'Later this year'];

// Chat assistant: what it suggests first.
export const chat = {
  name: 'EvoSoft assistant',
  greeting: 'Hi! Ask me anything about EvoSoft: what we build, the live demos and their test accounts, or how to get a quote.',
  suggestions: ['What can you build?', 'How do I try the Evo demo?', 'How do I get a quote?', 'What have you built?'],
};
