// Everything about the company that appears on more than one page.
// Contact details and prices are copied from the current evosoft.solutions site (November 2026).

export const site = {
  name: 'EvoSoft',
  legalName: 'EvoSoft Solutions',
  url: 'https://evosoft.solutions',
  email: 'contact@evosoft.solutions',
  phones: ['+995 555 352 218', '+995 599 574 416'],
  responseTime: 'Within 1 business day',
  region: 'Georgia',
  tagline: 'Any kind of project, built properly.',
  description:
    'EvoSoft is a software studio that takes on any kind of project, from websites and online stores to business systems, web apps and the tech behind them. Try our own products live, with real test accounts.',
  year: 2026,
};

export const nav = [
  { href: 'index.html', label: 'Home', key: 'home' },
  { href: 'portfolio.html', label: 'Work', key: 'portfolio' },
  { href: 'demos.html', label: 'Live demos', key: 'demos' },
  { href: 'services.html', label: 'Services', key: 'services' },
  { href: 'pricing.html', label: 'Pricing', key: 'pricing' },
  { href: 'about.html', label: 'About', key: 'about' },
];

// What we do. The site used to say "web development"; it now covers any kind of project.
export const services = [
  {
    icon: 'cpu',
    title: 'Any kind of project, including tech',
    text: 'Custom software, web apps, internal tools, automations and integrations. If it runs on a screen or a server, we can scope it.',
    points: ['Web apps and dashboards', 'Business systems: POS, HR, inventory', 'APIs, automations and integrations'],
  },
  {
    icon: 'globe',
    title: 'Websites',
    text: 'Mobile-friendly, responsive, user-focused sites, hand-coded rather than stacked from templates.',
    points: ['Built mobile-first from the start', 'Clean structure that is easy to extend', 'Fast, lightweight builds'],
  },
  {
    icon: 'cart',
    title: 'Ecommerce',
    text: 'Online stores with secure payment integration and a catalogue that can grow with you.',
    points: ['Secure checkout and payments', 'Product catalogues of any size', 'Inventory-friendly structure'],
  },
  {
    icon: 'refresh',
    title: 'Redesign & maintenance',
    text: 'Keep what you already have fresh, fast and fully up to date.',
    points: ['A fresh design without a full rebuild', 'Content and plugin updates', 'Ongoing monthly support'],
  },
  {
    icon: 'search',
    title: 'SEO optimisation',
    text: 'Better rankings and more organic traffic, built in from day one rather than bolted on.',
    points: ['On-page and technical SEO', 'Speed optimisation', 'Search Console setup and guidance'],
  },
  {
    icon: 'pen',
    title: 'Graphic design',
    text: 'Logos, banners and branding that make an impact, with the source files handed to you.',
    points: ['Logos, banners and icon sets', 'A consistent visual system', 'Source files delivered'],
  },
  {
    icon: 'mail',
    title: 'Microsoft 365 & Outlook',
    text: 'Secure, professional email on your own domain, set up and looked after.',
    points: ['Business email on your domain', 'Outlook on desktop and mobile', 'Migration from your current provider'],
  },
  {
    icon: 'tool',
    title: 'IT & tech support',
    text: 'Domains, DNS, hosting, devices and the everyday tech questions that slow a team down.',
    points: ['Domain, DNS and hosting setup', 'Hardware and software setup', 'Troubleshooting when things break'],
  },
];

// Prices are exactly the current published ones.
export const pricing = {
  lanes: [
    {
      key: 'projects',
      label: 'Websites & projects',
      intro:
        'Clear packages that scale from a first project to an established company. Bigger software and tech work is scoped and quoted for free.',
      tiers: [
        {
          name: 'Basic',
          for: 'For a hobby project',
          price: '$300–500',
          features: [
            'Custom website, up to 5 pages',
            'Mobile-friendly design',
            'Basic SEO setup',
            'Contact form integration',
            'One round of revisions',
            '1 month free maintenance',
          ],
        },
        {
          name: 'Standard',
          for: 'For a small startup or agency',
          price: '$700–1000',
          popular: true,
          features: [
            'Everything in Basic',
            'Up to 10 pages',
            'Custom graphics: banners, icons',
            'On-page SEO optimisation',
            'Blog setup',
            'Social media integration',
            '2 rounds of revisions',
            '2 months free maintenance',
          ],
        },
        {
          name: 'Premium',
          for: 'For an established company',
          price: '$1500–2500',
          features: [
            'Everything in Standard',
            'Ecommerce setup, up to 20 products',
            'Payment gateway integration',
            'Advanced SEO optimisation',
            'Speed optimisation',
            'Custom animations and effects',
            '3 months free maintenance',
          ],
        },
      ],
      custom: {
        name: 'Custom software & tech',
        for: 'Apps, systems, automations, anything else',
        price: 'Free quote',
        text: 'Web apps, business systems like the ones in our live demos, integrations, automations and IT projects. We talk it through, then give you a realistic scope and a fixed price before anything is booked.',
        features: ['Free consultation and written scope', 'Fixed price agreed up front', 'Pay in two installments', 'Hand-over of code and documentation'],
      },
      addons: [
        ['Additional pages', '$50 / page'],
        ['Extra revisions', '$100 / round'],
        ['Monthly maintenance', '$100 / mo'],
        ['Logo & branding package', '$200'],
        ['SEO & audit optimisation', '$50 / page'],
      ],
    },
    {
      key: 'email',
      label: 'Email & Microsoft 365',
      intro: 'Managed business email on your own domain, from a first mailbox to a whole team.',
      tiers: [
        {
          name: 'Basic',
          for: 'For a hobby project',
          price: '$50',
          features: ['Set up Microsoft 365 business email', 'Configure Outlook on desktop and mobile', 'Basic email security settings'],
        },
        {
          name: 'Standard',
          for: 'For a small startup or agency',
          price: '$150',
          popular: true,
          features: [
            'Everything in Basic',
            'Email forwarding and alias configuration',
            'Troubleshooting and issue resolution',
            'Spam filtering and security best practices',
          ],
        },
        {
          name: 'Premium',
          for: 'For an established company',
          price: '$300',
          features: [
            'Everything in Standard',
            'Domain and DNS setup for custom email',
            'Migration from Gmail, Yahoo or others',
            'Group email and shared mailbox setup',
            'Ongoing monthly support (optional)',
          ],
        },
      ],
      addons: [
        ['Extra email accounts', '$20 / account'],
        ['Monthly email maintenance', '$50 / mo'],
        ['Data migration', 'from $100'],
      ],
    },
  ],
};

export const faq = [
  {
    q: 'Do you only build websites?',
    a: 'No. We take on any kind of project, including software and tech: web apps, business systems, integrations, automations and IT setup. The three products in our live demos were built in-house.',
  },
  {
    q: 'How long does a project take?',
    a: 'Most Basic and Standard sites take one to three weeks from kickoff to launch, depending on how much content you have ready. Premium ecommerce builds usually run three to five weeks. Custom software gets a timeline with its quote.',
  },
  {
    q: 'Can I pay in installments?',
    a: 'Yes. For Standard, Premium and custom projects we can split payment into two installments: half to begin, half at launch. Just mention it when you reach out.',
  },
  {
    q: 'What happens after the free maintenance period?',
    a: 'You can move to ongoing monthly maintenance at any time, or handle updates yourself. We hand over everything you need either way.',
  },
  {
    q: 'Can I upgrade my package later?',
    a: 'Absolutely. Many clients start with Basic or Standard and upgrade to add ecommerce, advanced SEO or custom features once they are live and growing.',
  },
  {
    q: 'What should I send before we talk?',
    a: 'A rough idea of what you need, your timeline, and any sites or apps you like. We will follow up with specific questions.',
  },
  {
    q: 'Do you work with clients outside Georgia?',
    a: 'Yes. Most of our work happens remotely over email and calls, so location is not a limitation.',
  },
  {
    q: 'Is the consultation really free?',
    a: 'Yes, no strings attached. We talk through your project and give you a realistic scope and price before anything is booked.',
  },
];

export const process = [
  { title: 'Discover', text: 'We talk through your goals, audience and must-haves before any design or code starts.' },
  { title: 'Design', text: 'You see layout, flows and style directions early, so there are no surprises later.' },
  { title: 'Build', text: 'We build the real thing: responsive, fast, tested and ready to grow.' },
  { title: 'Launch', text: 'We go live together, then stay on for your included maintenance window.' },
];

// Client websites already on the current portfolio page.
export const clients = [
  {
    name: 'Larifan',
    url: 'https://larifan.ge/',
    kind: 'Ecommerce',
    text: 'A clean, mobile-first storefront built for everyday browsing and checkout, with fast load times and clear product presentation.',
    points: ['Custom ecommerce build', 'Mobile-optimised checkout', 'On-page SEO setup'],
  },
  {
    name: 'BabyCalm Georgia',
    url: 'https://babycalmgeorgia.ge/',
    kind: 'Local business',
    text: 'A warm, trustworthy site for a local baby-care brand, designed to make it easy for parents to browse products and get in touch.',
    points: ['Brand-aligned design', 'Product catalogue and inquiry forms', 'Mobile-friendly throughout'],
  },
  {
    name: 'IPG',
    url: 'https://ipg.ge/',
    kind: 'Corporate',
    text: 'A structured, professional site that presents services and company information clearly for a corporate audience.',
    points: ['Multi-page corporate structure', 'Clear service presentation', 'Fast, lightweight build'],
  },
];
