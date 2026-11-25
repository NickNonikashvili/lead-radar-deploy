/* EvoSoft quote builder: the live preview of a visitor's future website. No dependencies.
   © 2026 EvoSoft Solutions. All rights reserved.

   window.EvoPreview.render(container, design, strings, options)
     Draws a browser window holding a scaled home page built from `design` (the quote builder's design: type, business,
     look, pages, features, ... as described in site-builder/data/pricing.mjs). Call it again with a changed design to
     update it: only what changed is redrawn, and colour changes fade instead of flashing.
     options: { device: 'desktop' | 'tablet' | 'phone', focus: 'top' | 'page:<id>' | 'feature:<id>' | 'products' }
       (focus scrolls the little browser to the part that just changed)
   window.EvoPreview.summary(design, strings)  the same page described in one plain paragraph, for screen readers
   window.EvoPreview.strings                    the English words; a page passes its translation of them as `strings`,
                                                and anything missing falls back to English (so `{}` works)

   The preview is a picture: give its container aria-hidden="true" and put summary() next to it. It holds no links,
   buttons or form fields, only look-alikes. The markup carries no style attributes, so it also works under a strict
   Content-Security-Policy (the admin panel's): colours, fonts and the zoom go in as CSS custom properties, set with
   style.setProperty(). Every "photo" is drawn with CSS gradients and inline SVG; nothing is loaded from elsewhere.
   Styles: assets/css/preview.css, all scoped under .pv. Line icons drawn after Lucide (ISC licence; see /legal). */
(function () {
  'use strict';

  // ---------- the words (English). Placeholders in {braces} are filled in here. ----------
  const EN = {
    locale: 'en-US',
    money: '${n}',
    perMonth: '{price}/month',
    domain: '{slug}.com',
    yourName: 'Your Business',
    nav: { home: 'Home', about: 'About', services: 'Services', gallery: 'Gallery', pricing: 'Pricing', team: 'Team', blog: 'Blog', faq: 'FAQ', contact: 'Contact', testimonials: 'Reviews', careers: 'Careers', locations: 'Locations', shop: 'Shop', product: 'Product', more: 'More', page: 'Page {n}' },
    ui: {
      signIn: 'Sign in', getStarted: 'Get started', seeHow: 'See how it works', shopNow: 'Shop now', seeWork: 'See the work', contactUs: 'Get in touch',
      learnMore: 'Learn more', readMore: 'Read more', readStory: 'Our story', viewAll: 'View all', addToCart: 'Add to cart', search: 'Search the site',
      editBar: 'Signed in as the site owner', editPage: 'Edit this page', dashboard: 'Dashboard', choose: 'Choose', apply: 'Apply',
      send: 'Send message', subscribe: 'Subscribe', emailField: 'Your email address', nameField: 'Your name', messageField: 'How can we help?',
      payNow: 'Pay now', confirm: 'Confirm booking', directions: 'Get directions', chatHello: 'Hi! How can we help today?',
      rights: '© {year} {name}. All rights reserved.', privacy: 'Privacy', terms: 'Terms', follow: 'Follow us', minutes: '{n} min read',
    },
    sec: {
      aboutKicker: 'About us', aboutTitle: 'A little about {name}', aboutPoints: ['Real people, quick replies', 'Proud of every detail'],
      galleryKicker: 'Gallery', portfolioTitle: 'Selected work', projects: ['Brand refresh', 'Summer campaign', 'Product launch', 'Editorial', 'Packaging', 'Exhibition'],
      bookingKicker: 'Booking', bookingText: 'Pick a day and a time that suit you. A confirmation arrives by email straight away.', pickDay: 'Pick a day', pickTime: 'Pick a time',
      pricingKicker: 'Pricing', pricingTitle: 'Simple, clear prices', plans: ['Basic', 'Plus', 'Premium'], planPoints: ['Everything to get started', 'Help when you need it', 'Every feature included'], popular: 'Most popular',
      reviewsKicker: 'Reviews', reviewsTitle: 'Your customer reviews', reviewsNote: 'Real reviews from your customers will go here.',
      teamKicker: 'Our team', teamTitle: 'The people behind {name}', team: ['Ana Silva', 'Founder', 'Marco Díaz', 'Manager', 'Lea Novak', 'Specialist', 'Sam Okafor', 'Assistant'],
      blogKicker: 'Blog', blogTitle: 'News and stories',
      careersKicker: 'Careers', careersTitle: 'Join our team', careersText: 'We’re growing and looking for people who care about good work.', jobs: ['Full-time role', 'Part-time role', 'Internship'], jobMeta: 'On site · Apply by email',
      faqKicker: 'FAQ', faqTitle: 'Good questions', faq: ['What are your opening hours?', 'How can I pay?', 'Can I change or cancel?', 'Do you offer gift cards?'], faqAnswer: 'A short, clear answer goes here, written for your customers.',
      payKicker: 'Payments', payTitle: 'Pay online in a few taps', payText: 'Cards and wallets, through a secure payment provider.',
      newsTitle: 'Stay in the loop', newsText: 'News and offers from {name}, once a month.',
      locationsKicker: 'Locations', locationsTitle: 'Come and see us', locations: ['City centre', 'Riverside'],
      contactKicker: 'Contact', contactTitle: 'Get in touch', hoursLabel: 'Opening hours', hours: 'Mon–Fri, 9:00–18:00', addressLabel: 'Address', address: '12 Market Street', phoneLabel: 'Phone', phone: '+1 555 010 2030',
      mapTitle: 'Find us', shopKicker: 'Shop', shopTitle: 'Shop the collection', filters: ['All', 'New in', 'Best sellers', 'Gifts'], productsCount: '{n} products',
      appKicker: 'The app', appTitle: 'Everything in one dashboard', appNav: ['Overview', 'Customers', 'Orders', 'Reports', 'Settings'],
      kpis: ['Active users', 'Revenue this month', 'Tasks done'], chartTitle: 'This month', tableHead: ['Customer', 'Status', 'Updated'], statuses: ['Active', 'Pending', 'Done'], tableNames: ['Northwind', 'Blue Harbor', 'Oak and Pine', 'Lumen'],
      storeKicker: 'New collection', behind: 'Also included, behind the scenes:',
    },
    types: {
      landing: { label: 'Landing page' },
      portfolio: { label: 'Portfolio', kicker: 'Portfolio', hero: 'Selected work, made with care', sub: 'A few recent projects, and the story behind each one.' },
      business: { label: 'Business website' },
      store: { label: 'Online store' },
      webapp: { label: 'Web app', kicker: 'Web app', hero: 'Everything your team needs, in one place', sub: 'Sign in from anywhere to see what’s happening and get work done.' },
    },
    palettes: { navy: 'Midnight', forest: 'Forest', sunset: 'Sunset', ocean: 'Ocean', mono: 'Black and white', blush: 'Blush', custom: 'Your own colour' },
    fonts: { modern: 'Modern', elegant: 'Elegant', friendly: 'Friendly', bold: 'Bold' },
    layouts: { clean: 'Clean', bold: 'Bold', classic: 'Classic' },
    modes: { light: 'Light', dark: 'Dark' },
    features: { booking: 'Online booking', payments: 'Online payments', cms: 'Edit it yourself', multilingual: 'More languages', accounts: 'Customer accounts', search: 'Site search', newsletter: 'Newsletter sign-up', livechat: 'Live chat', maps: 'Map and directions', reviews: 'Reviews section', seo: 'SEO setup', analytics: 'Visitor statistics' },
    summary: {
      intro: 'Preview of your website: a {type} for {name}, {industry}.',
      look: 'It uses the {palette} colours, {font} type and the {layout} layout, in {mode} mode.',
      sections: 'The home page shows {list}.',
      head: 'The top bar has {list}.',
      parts: {
        nav: 'links to {list}', search: 'a search box', langs: 'a language switch for {n} languages', signIn: 'a sign-in button', cart: 'a cart', edit: 'an editing bar for you', chat: 'a chat button',
        hero: 'a large welcome banner', points: 'three highlights', shop: 'a product grid with prices', app: 'an app dashboard', services: 'your services', about: 'an about section',
        booking: 'a booking calendar with times', gallery: 'a gallery', pricing: 'price plans', reviews: 'a space for customer reviews', team: 'the team', blog: 'the latest posts',
        careers: 'job openings', faq: 'questions and answers', payments: 'online payment', newsletter: 'a newsletter sign-up', locations: 'locations with a map',
        contact: 'a contact form', map: 'a map', footer: 'a footer',
      },
    },
    industries: {
      restaurant: { label: 'Restaurant or café', name: 'Luna Bistro', hero: 'A table for every good evening', sub: 'Seasonal plates, good wine and a warm room in the heart of town.', kicker: 'Open tonight from 18:00', cta: 'Book a table', cta2: 'See the menu', servicesNav: 'Menu', servicesTitle: 'From our kitchen', services: ['Small plates', 'To share, made fresh every day.', 'Mains', 'Seasonal dishes from local farms.', 'Desserts', 'Baked in house every morning.'], about: 'We cook what the season brings, with produce from farms we know by name, and serve it in a room made for long dinners.', galleryTitle: 'A look inside', points: ['Fresh every day', 'Book in seconds', 'Private dining'], products: ['Gift card', 'House olive oil', 'Our cookbook', 'Tasting box'], blog: ['Our new autumn menu', 'Meet the farmers we cook with', 'Wine evenings are back'], book: 'Book a table', bookUnit: '2 guests', shopHero: 'Take a taste of Luna home' },
      clinic: { label: 'Clinic or health', name: 'Harbor Clinic', hero: 'Care that fits around your life', sub: 'Friendly doctors, short waits and appointments you can book online.', kicker: 'New patients welcome', cta: 'Book an appointment', cta2: 'Our services', servicesNav: 'Services', servicesTitle: 'How we can help', services: ['Check-ups', 'Routine care for the whole family.', 'Specialist care', 'Referrals and follow-ups in one place.', 'Tests and results', 'Quick tests, with results online.'], about: 'Our team has looked after families in the area for years, with time to listen and clear advice.', galleryTitle: 'Our clinic', points: ['Appointments this week', 'Book online', 'Calm, bright rooms'], products: ['First aid kit', 'Vitamin pack', 'Gift voucher', 'Travel kit'], blog: ['Getting ready for flu season', 'Five habits for better sleep', 'Meet our new doctor'], book: 'Book an appointment', bookUnit: '30 minutes', shopHero: 'Health essentials, delivered' },
      beauty: { label: 'Beauty and wellness', name: 'Bloom Studio', hero: 'Feel like yourself, only brighter', sub: 'Hair, skin and nails by people who love what they do.', kicker: 'Open six days a week', cta: 'Book a visit', cta2: 'Treatments', servicesNav: 'Treatments', servicesTitle: 'Treatments', services: ['Hair', 'Cuts, colour and styling.', 'Skin', 'Facials for every skin type.', 'Nails', 'Manicures and pedicures.'], about: 'Bloom is a small, bright studio where every appointment starts with a conversation about what you want.', galleryTitle: 'Recent looks', points: ['Gentle products', 'Book online', 'Gift cards'], products: ['Hair oil', 'Face serum', 'Gift card', 'Care set'], blog: ['How to keep colour fresh', 'A simple routine for winter skin', 'This season’s nail trends'], book: 'Book a visit', bookUnit: '45 minutes', shopHero: 'Studio care, at home' },
      construction: { label: 'Construction and trades', name: 'Stonefield Builders', hero: 'Built right, built to last', sub: 'Homes, extensions and renovations, planned clearly from the first visit.', kicker: 'Homes · Renovations · Extensions', cta: 'Request a quote', cta2: 'Our projects', servicesNav: 'Services', servicesTitle: 'What we build', services: ['New homes', 'From the foundations to the finishing touches.', 'Renovations', 'Kitchens, bathrooms and whole floors.', 'Extensions', 'More room, without moving house.'], about: 'A local team of builders, carpenters and project managers who keep you informed at every step.', galleryTitle: 'Recent projects', points: ['Clear written quotes', 'One project manager', 'Tidy sites'], products: ['Site visit', 'Design session', 'Paint set', 'Tool hire'], blog: ['Planning an extension', 'What a renovation really involves', 'Choosing the right materials'], book: 'Book a site visit', bookUnit: '1 hour', shopHero: 'Materials and services, online' },
      consulting: { label: 'Consulting and services', name: 'Northbridge Advisory', hero: 'Clear advice for growing businesses', sub: 'Strategy, finance and operations, from people who have run businesses themselves.', kicker: 'Strategy · Finance · Operations', cta: 'Book a call', cta2: 'How we help', servicesNav: 'Services', servicesTitle: 'How we help', services: ['Strategy', 'A plan your whole team understands.', 'Finance', 'Budgets, forecasts and funding.', 'Operations', 'Simpler processes that save time.'], about: 'We work alongside owners and leadership teams, turning big goals into steps you can act on.', galleryTitle: 'Our work in pictures', points: ['Practical plans', 'Senior advisers', 'Clear fees'], products: ['Strategy session', 'Business review', 'Team workshop', 'Planning template'], blog: ['Three numbers every owner should know', 'Planning the next twelve months', 'When to hire your first manager'], book: 'Book a call', bookUnit: '30 minutes', shopHero: 'Sessions and tools, ready to book' },
      retail: { label: 'Shop or retail', name: 'Maple & Co.', hero: 'Everyday things, beautifully made', sub: 'Homeware, gifts and small treats, chosen with care.', kicker: 'New arrivals every week', cta: 'Shop now', cta2: 'Visit the shop', servicesNav: 'Shop', servicesTitle: 'Shop by category', services: ['Home', 'Linen, ceramics and candles.', 'Gifts', 'Something for everyone.', 'Kitchen', 'Tools you’ll use every day.'], about: 'Maple & Co. started as a corner shop and still picks every product by hand.', galleryTitle: 'In the shop', points: ['Hand-picked products', 'Gift wrapping', 'Easy returns'], products: ['Linen tote', 'Ceramic mug', 'Scented candle', 'Wool throw'], blog: ['Gift ideas for the season', 'How we choose our makers', 'Caring for linen'], book: 'Book a shopping visit', bookUnit: '30 minutes', shopHero: 'New season, new favourites' },
      tourism: { label: 'Travel and tourism', name: 'Wayfarer Tours', hero: 'Small groups, big adventures', sub: 'Guided tours through mountains, old towns and wine country.', kicker: 'Tours all year round', cta: 'Book a tour', cta2: 'Explore tours', servicesNav: 'Tours', servicesTitle: 'Popular tours', services: ['Mountain trails', 'Day hikes with local guides.', 'Old town walks', 'History, food and hidden corners.', 'Wine country', 'Tastings at family vineyards.'], about: 'Our guides grew up here and love showing visitors the places they know best.', galleryTitle: 'From our trips', points: ['Local guides', 'Small groups', 'Flexible dates'], products: ['Day tour', 'Weekend trip', 'Gift voucher', 'Guidebook'], blog: ['What to pack for the mountains', 'The best season to visit', 'A day in the old town'], book: 'Book a tour', bookUnit: '2 people', shopHero: 'Book your next trip' },
      education: { label: 'Education', name: 'Brightpath Academy', hero: 'Learn something new this season', sub: 'Courses and tutoring for every age, in small classes or online.', kicker: 'Enrolment is open', cta: 'Enrol now', cta2: 'See courses', servicesNav: 'Courses', servicesTitle: 'Our courses', services: ['Languages', 'From first words to fluent.', 'Tutoring', 'One-to-one help with school subjects.', 'Workshops', 'Short courses for adults.'], about: 'Brightpath is a small team of teachers who believe learning should feel encouraging, not stressful.', galleryTitle: 'Life at Brightpath', points: ['Small classes', 'Qualified teachers', 'Online or in person'], products: ['Course book', 'Trial lesson', 'Term pass', 'Gift card'], blog: ['Helping with homework', 'Learning a language as an adult', 'Our new evening classes'], book: 'Book a trial lesson', bookUnit: '45 minutes', shopHero: 'Courses and books, online' },
      fitness: { label: 'Fitness and sport', name: 'Pulse Fitness', hero: 'Stronger every week', sub: 'Classes, coaching and an open gym for every level.', kicker: 'Open early, close late', cta: 'Book a class', cta2: 'Class times', servicesNav: 'Classes', servicesTitle: 'Classes', services: ['Strength', 'Build strength with a coach.', 'Cardio', 'Fast, fun group sessions.', 'Yoga', 'Stretch, breathe and reset.'], about: 'Pulse is a friendly gym where beginners and regulars train side by side.', galleryTitle: 'At the gym', points: ['Expert coaches', 'Classes every day', 'Flexible plans'], products: ['Day pass', 'Ten-class pack', 'Water bottle', 'Training tee'], blog: ['Your first week at the gym', 'Five stretches for desk days', 'Meet our coaches'], book: 'Book a class', bookUnit: '1 hour', shopHero: 'Passes and gear, online' },
      realestate: { label: 'Real estate', name: 'Keystone Homes', hero: 'Find the place you’ll call home', sub: 'Homes to buy and rent, with agents who know every street.', kicker: 'New homes every week', cta: 'Book a viewing', cta2: 'See properties', servicesNav: 'Properties', servicesTitle: 'How we help', services: ['Buying', 'Find a home that fits your life.', 'Selling', 'A fair price and a smooth sale.', 'Renting', 'Homes and tenants, well looked after.'], about: 'We are a local agency with honest advice, clear fees and time for every client.', galleryTitle: 'Featured homes', points: ['Local experts', 'Clear fees', 'Viewings any day'], products: ['Home valuation', 'Photo package', 'Moving checklist', 'Buyer’s guide'], blog: ['Is now a good time to buy?', 'Getting your home ready to sell', 'A guide to renting'], book: 'Book a viewing', bookUnit: '30 minutes', shopHero: 'Services for buyers and sellers' },
      tech: { label: 'Tech or software', name: 'Nimbus Labs', hero: 'Software that gets out of your way', sub: 'Simple tools for busy teams, ready in minutes.', kicker: 'Now in public beta', cta: 'Get started', cta2: 'See features', servicesNav: 'Product', servicesTitle: 'Built for busy teams', services: ['Automations', 'Let the busywork run itself.', 'Integrations', 'Connect the tools you already use.', 'Security', 'Your data, carefully protected.'], about: 'Nimbus is a small product team building the tools we always wanted for ourselves.', galleryTitle: 'Inside the product', points: ['Set up in minutes', 'Works with your tools', 'Help when you need it'], products: ['Starter plan', 'Team plan', 'Add-on', 'Setup session'], blog: ['What’s new this month', 'How teams use Nimbus', 'Our approach to security'], book: 'Book a demo', bookUnit: '30 minutes', shopHero: 'Plans and add-ons' },
      other: { label: 'Something else', name: 'Your Business', hero: 'Your business, beautifully online', sub: 'Tell people what you do, show your best work and make it easy to get in touch.', kicker: 'Welcome', cta: 'Get in touch', cta2: 'Learn more', servicesNav: 'Services', servicesTitle: 'What we do', services: ['Your first service', 'A short line about what you offer.', 'Your second service', 'Another reason people choose you.', 'Your third service', 'And one more thing you do well.'], about: 'A short story about who you are, what you care about and why people choose you.', galleryTitle: 'Our work', points: ['Friendly service', 'Quality work', 'Easy to reach'], products: ['First product', 'Second product', 'Third product', 'Gift card'], blog: ['A first post with your news', 'Tips your customers will love', 'Behind the scenes'], book: 'Book an appointment', bookUnit: '30 minutes', shopHero: 'Shop online' },
    },
  };

  // ---------- what isn't words: icons per industry and sample prices ----------
  const KIT = {
    restaurant: { svc: ['utensils', 'chef', 'cake'], art: ['utensils', 'wine', 'coffee'], pts: ['leaf', 'clock', 'users'], prices: [25, 18, 32, 45] },
    clinic: { svc: ['stethoscope', 'heartPulse', 'pill'], art: ['heartPulse', 'stethoscope', 'leaf'], pts: ['calendar', 'clock', 'sparkles'], prices: [29, 19, 50, 24] },
    beauty: { svc: ['scissors', 'droplet', 'sparkles'], art: ['flower', 'sparkles', 'droplet'], pts: ['leaf', 'calendar', 'gift'], prices: [22, 38, 50, 64] },
    construction: { svc: ['house', 'hammer', 'ruler'], art: ['building', 'hardHat', 'ruler'], pts: ['check', 'users', 'shield'], prices: [90, 150, 40, 35] },
    consulting: { svc: ['target', 'trending', 'briefcase'], art: ['trending', 'bulb', 'briefcase'], pts: ['target', 'users', 'check'], prices: [250, 480, 900, 49] },
    retail: { svc: ['house', 'gift', 'coffee'], art: ['bag', 'tag', 'gift'], pts: ['sparkles', 'gift', 'rotate'], prices: [34, 18, 26, 89] },
    tourism: { svc: ['mountain', 'compass', 'wine'], art: ['mountain', 'sun', 'compass'], pts: ['pin', 'users', 'calendar'], prices: [59, 249, 100, 22] },
    education: { svc: ['globe', 'book', 'pen'], art: ['cap', 'book', 'bulb'], pts: ['users', 'check', 'laptop'], prices: [24, 15, 320, 50] },
    fitness: { svc: ['dumbbell', 'activity', 'heart'], art: ['dumbbell', 'activity', 'timer'], pts: ['users', 'calendar', 'zap'], prices: [12, 99, 15, 25] },
    realestate: { svc: ['key', 'tag', 'house'], art: ['house', 'key', 'building'], pts: ['pin', 'check', 'calendar'], prices: [150, 120, 9, 15] },
    tech: { svc: ['zap', 'layers', 'shield'], art: ['cloud', 'cpu', 'code'], pts: ['zap', 'layers', 'chat'], prices: [9, 29, 5, 99] },
    other: { svc: ['sparkles', 'check', 'heart'], art: ['sparkles', 'layers', 'sun'], pts: ['heart', 'check', 'phone'], prices: [24, 39, 59, 50] },
  };
  const PLAN_PRICES = [29, 59, 99];
  const PRODUCT_COUNT = { small: 36, medium: 180, large: 840, huge: 2400 };
  const LANG_CODES = ['EN', 'ES', 'FR', 'DE', 'IT'];

  // Colour schemes: a = main colour, b = second colour, then the page colours. Light and dark versions of each.
  const PALETTES = {
    navy: { light: { a: '#1D3B8B', b: '#F0B429', bg: '#F7F8FB', bg2: '#ECEFF7', ink: '#0F172A' }, dark: { a: '#86A8FF', b: '#F0B429', bg: '#0B1020', bg2: '#121A33', ink: '#E8ECF7' } },
    forest: { light: { a: '#2D6A4F', b: '#E9C46A', bg: '#F6F7F1', bg2: '#EBEFE3', ink: '#13221A' }, dark: { a: '#74C69D', b: '#E9C46A', bg: '#0C1510', bg2: '#13211A', ink: '#E6EFE8' } },
    sunset: { light: { a: '#D9481F', b: '#FFB347', bg: '#FFF8F3', bg2: '#FCECE1', ink: '#2A140C' }, dark: { a: '#FF8A5B', b: '#FFC56E', bg: '#170D0A', bg2: '#23140F', ink: '#FBEDE6' } },
    ocean: { light: { a: '#0F766E', b: '#38BDF8', bg: '#F3FAFA', bg2: '#E3F1F2', ink: '#0B2326' }, dark: { a: '#2DD4BF', b: '#38BDF8', bg: '#06161A', bg2: '#0C2228', ink: '#E2F4F4' } },
    mono: { light: { a: '#141414', b: '#A3A3A3', bg: '#FFFFFF', bg2: '#F2F2F2', ink: '#111111' }, dark: { a: '#F2F2F2', b: '#737373', bg: '#0A0A0A', bg2: '#171717', ink: '#F5F5F5' } },
    blush: { light: { a: '#B93A63', b: '#F7B7C4', bg: '#FFF6F7', bg2: '#FBE7EC', ink: '#2B1218' }, dark: { a: '#F48FB1', b: '#FFD1DC', bg: '#170B0F', bg2: '#241219', ink: '#FBEAF0' } },
  };
  const DEFAULT_ACCENT = '#FF6B5B';
  const FONTS = {
    modern: { head: "'PV Inter', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", body: "'PV Inter', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", hw: '640', track: '-0.035em', r: '16px', br: '10px', up: 'none' },
    elegant: { head: "'Iowan Old Style', 'Palatino Linotype', Palatino, 'Book Antiqua', 'Noto Serif', Georgia, 'Times New Roman', serif", body: "'PV Inter', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", hw: '500', track: '-0.01em', r: '4px', br: '2px', up: 'uppercase' },
    friendly: { head: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'Quicksand', 'Varela Round', 'Arial Rounded MT Bold', 'PV Inter', system-ui, sans-serif", body: "ui-rounded, 'SF Pro Rounded', 'Nunito', 'PV Inter', system-ui, sans-serif", hw: '700', track: '-0.02em', r: '26px', br: '999px', up: 'none' },
    bold: { head: "'PV Inter', 'Inter', 'Arial Black', system-ui, sans-serif", body: "'PV Inter', 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif", hw: '850', track: '-0.055em', r: '8px', br: '8px', up: 'uppercase' },
  };
  const DEVICES = { desktop: 1280, tablet: 820, phone: 390 };
  const TYPES = ['landing', 'portfolio', 'business', 'store', 'webapp'];
  const PAGES = ['home', 'about', 'services', 'gallery', 'pricing', 'team', 'blog', 'faq', 'contact', 'testimonials', 'careers', 'locations'];
  const FEATURES = ['booking', 'payments', 'cms', 'multilingual', 'accounts', 'search', 'newsletter', 'livechat', 'maps', 'reviews', 'seo', 'analytics'];

  // ---------- line icons (24 × 24, drawn with currentColor) ----------
  const I = {
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronL: '<path d="m15 18-6-6 6-6"/>',
    chevronR: '<path d="m9 18 6-6-6-6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
    sparkles: '<path d="M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0l1.58 6.14a2 2 0 0 0 1.44 1.44l6.14 1.58a.5.5 0 0 1 0 .96l-6.14 1.58a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z"/><path d="M20 3v4M22 5h-4"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    heartPulse: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    chef: '<path d="M17 21a1 1 0 0 0 1-1v-5.35c0-.46.32-.84.73-1.04a4 4 0 0 0-2.13-7.59 5 5 0 0 0-9.2 0 4 4 0 0 0-2.13 7.59c.41.2.73.58.73 1.04V20a1 1 0 0 0 1 1Z"/><path d="M6 17h12"/>',
    cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20M7 8v3M12 8v3M17 8v3"/>',
    wine: '<path d="M8 22h8M7 10h10M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/>',
    coffee: '<path d="M10 2v2M14 2v2M6 2v2"/><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"/>',
    stethoscope: '<path d="M11 2v2M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/>',
    leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
    scissors: '<circle cx="6" cy="6" r="3"/><path d="M8.12 8.12 12 12M20 4 8.12 15.88"/><circle cx="6" cy="18" r="3"/><path d="M14.8 14.8 20 20"/>',
    droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    flower: '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9M7.5 12H9M16.5 12H15M12 16.5V15M8 8l1.88 1.88M14.12 9.88 16 8M8 16l1.88-1.88M14.12 14.12 16 16"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
    house: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .71-1.53l7-6a2 2 0 0 1 2.58 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    hammer: '<path d="m15 12-8.37 8.37a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.91-1.91A2 2 0 0 1 19 8.17V7l-2.26-2.26a6 6 0 0 0-4.2-1.76L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.17a2 2 0 0 1 1.42.59L18.5 14.5"/>',
    hardHat: '<path d="M10 10V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M14 6a6 6 0 0 1 6 6v3M4 15v-3a6 6 0 0 1 6-6"/><rect x="2" y="15" width="20" height="4" rx="1"/>',
    ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    trending: '<path d="M22 7 13.5 15.5 8.5 10.5 2 17"/><path d="M16 7h6v6"/>',
    briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6M10 22h4"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    tag: '<path d="M12.59 2.59A2 2 0 0 0 11.17 2H4a2 2 0 0 0-2 2v7.17a2 2 0 0 0 .59 1.42l8.7 8.7a2.43 2.43 0 0 0 3.42 0l6.58-6.58a2.43 2.43 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    mountain: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    compass: '<path d="m16.24 7.76-1.8 5.41a2 2 0 0 1-1.27 1.27L7.76 16.24l1.8-5.41a2 2 0 0 1 1.27-1.27z"/><circle cx="12" cy="12" r="10"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-17.07 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
    cap: '<path d="M21.42 10.92a1 1 0 0 0-.02-1.84L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.83l8.57 3.91a2 2 0 0 0 1.66 0z"/><path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>',
    dumbbell: '<path d="M14.4 14.4 9.6 9.6"/><path d="M18.66 21.49a2 2 0 1 1-2.83-2.83l-1.77 1.77a2 2 0 1 1-2.83-2.83l6.36-6.36a2 2 0 1 1 2.83 2.83l-1.77 1.77a2 2 0 1 1 2.83 2.83z"/><path d="m21.5 21.5-1.4-1.4M3.9 3.9 2.5 2.5"/><path d="M6.4 12.77a2 2 0 1 1-2.83-2.83l1.77-1.77a2 2 0 1 1-2.83-2.83l2.83-2.83a2 2 0 1 1 2.83 2.83l1.77-1.77a2 2 0 1 1 2.83 2.83z"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    laptop: '<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    cpu: '<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
    grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/>',
    file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    quote: '<path d="M3 21c3 0 7-1 7-8V5c0-1.25-.76-2.02-2-2H4c-1.25 0-2 .75-2 1.97V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .01-1 1.03V20c0 1 0 1 1 1z"/>',
  };
  const svg = (name, cls = 'pv-i', sw) => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw || 1.8}" stroke-linecap="round" stroke-linejoin="round" focusable="false">${I[name] || I.sparkles}</svg>`;

  // ---------- small helpers ----------
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  const fill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m));
  const isObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  function merge(base, over) {
    if (!isObj(over)) return base;
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k of Object.keys(base)) {
      const o = over[k];
      if (o === undefined || o === null || o === '') continue;
      if (isObj(base[k])) out[k] = merge(base[k], o);
      else if (Array.isArray(base[k])) out[k] = Array.isArray(o) && o.length === base[k].length && o.every((x) => typeof x === 'string' && x) ? o.slice() : base[k];
      else if (typeof o === 'string') out[k] = o;
    }
    return out;
  }
  const pairs = (arr) => { const out = []; for (let i = 0; i + 1 < arr.length; i += 2) out.push([arr[i], arr[i + 1]]); return out; };

  // colours
  const hex = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '').trim()); return m ? '#' + m[1].toUpperCase() : null; };
  const rgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('').toUpperCase();
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const lum = (h) => { const c = rgb(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const bestInk = (bg, darkInk = '#0B0F19') => (contrast(bg, '#FFFFFF') >= contrast(bg, darkInk) ? '#FFFFFF' : darkInk);
  // nudges `fg` towards black or white until it reads at `min` on every colour in `bgs`
  function readable(fg, bgs, min) {
    const toward = lum(bgs[0]) > 0.4 ? '#000000' : '#FFFFFF';
    let c = fg;
    for (let i = 0; i <= 20 && bgs.some((b) => contrast(c, b) < min); i++) c = mix(fg, toward, i / 20);
    return c;
  }
  function hsl(h) {
    let [r, g, b] = rgb(h).map((v) => v / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let hh = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      hh = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      hh /= 6;
    }
    return [hh * 360, s, l];
  }
  function fromHsl(hh, s, l) {
    hh = ((hh % 360) + 360) % 360 / 360;
    const f = (p, q, t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    if (s === 0) return toHex([l * 255, l * 255, l * 255]);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    return toHex([f(p, q, hh + 1 / 3) * 255, f(p, q, hh) * 255, f(p, q, hh - 1 / 3) * 255]);
  }
  function customScheme(accent, dark) {
    const a0 = hex(accent) || DEFAULT_ACCENT;
    const [h, s] = hsl(a0);
    const b = fromHsl(h + 38, Math.min(0.85, Math.max(0.45, s)), dark ? 0.68 : 0.62);
    if (dark) {
      const bg = mix('#0B0D12', a0, 0.07);
      return { a: lum(a0) < 0.08 ? mix(a0, '#FFFFFF', 0.45) : a0, b, bg, bg2: mix(bg, a0, 0.07), ink: mix('#F4F5F8', a0, 0.06) };
    }
    const bg = mix('#FFFFFF', a0, 0.035);
    return { a: lum(a0) > 0.7 ? mix(a0, '#000000', 0.35) : a0, b, bg, bg2: mix('#FFFFFF', a0, 0.08), ink: mix('#0D1117', a0, 0.12) };
  }
  // every colour the little site uses, worked out so that its text stays readable in any scheme
  function themeVars(look) {
    const dark = look.mode === 'dark';
    const p = look.palette === 'custom' ? customScheme(look.accent, dark) : (PALETTES[look.palette] || PALETTES.navy)[dark ? 'dark' : 'light'];
    const { a, b, bg, bg2, ink } = p;
    const surface = dark ? mix(bg, '#FFFFFF', 0.055) : mix(bg, '#FFFFFF', 0.75);
    const soft = mix(bg, a, dark ? 0.16 : 0.09);
    const deep = dark ? mix(a, '#000000', 0.5) : mix(a, '#000000', 0.38);
    const surfaces = [bg, bg2, surface, soft];
    const aText = readable(a, surfaces, 4.6);
    const muted = readable(mix(ink, bg, dark ? 0.36 : 0.4), surfaces, 4.6);
    const fnt = FONTS[look.font] || FONTS.modern;
    const foot = dark ? mix(bg, '#000000', 0.35) : mix(ink, a, 0.12);
    const footInk = readable(dark ? ink : mix('#FFFFFF', bg, 0.1), [foot], 7);
    const footMuted = readable(dark ? mix(ink, bg, 0.3) : mix('#FFFFFF', ink, 0.28), [foot], 4.6);
    return {
      '--pv-a': a, '--pv-a-ink': bestInk(a), '--pv-a-text': aText, '--pv-b': b, '--pv-b-ink': bestInk(b), '--pv-deep': deep,
      '--pv-bg': bg, '--pv-bg2': bg2, '--pv-surface': surface, '--pv-soft': soft, '--pv-soft-ink': readable(aText, [soft], 4.6),
      '--pv-ink': ink, '--pv-muted': muted, '--pv-line': mix(ink, bg, dark ? 0.84 : 0.88), '--pv-line2': mix(ink, bg, dark ? 0.72 : 0.78),
      '--pv-foot': foot, '--pv-foot-ink': footInk, '--pv-foot-muted': footMuted,
      '--pv-shadow': dark ? '0 18px 40px -22px rgba(0,0,0,.8)' : '0 18px 40px -24px ' + mix(ink, bg, 0.3) + '80',
      '--pv-head': fnt.head, '--pv-body': fnt.body, '--pv-hw': fnt.hw, '--pv-track': fnt.track, '--pv-r': fnt.r, '--pv-br': fnt.br, '--pv-up': fnt.up,
    };
  }

  // A design as far as the preview needs it (the server and estimate.js check it properly).
  function tidy(d) {
    d = d || {};
    const one = (v, list, def) => (list.includes(v) ? v : def);
    const b = d.business || {}, l = d.look || {};
    const pages = ['home'].concat(PAGES.filter((p) => p !== 'home' && Array.isArray(d.pages) && d.pages.includes(p)));
    const features = FEATURES.filter((f) => Array.isArray(d.features) && d.features.includes(f));
    return {
      type: one(d.type, TYPES, 'business'),
      business: { name: String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 60), industry: one(b.industry, Object.keys(KIT), 'other'), tagline: String(b.tagline || '').replace(/\s+/g, ' ').trim().slice(0, 120) },
      look: { palette: one(l.palette, Object.keys(PALETTES).concat('custom'), 'navy'), accent: hex(l.accent) || DEFAULT_ACCENT, font: one(l.font, Object.keys(FONTS), 'modern'), layout: one(l.layout, ['clean', 'bold', 'classic'], 'clean'), mode: one(l.mode, ['light', 'dark'], 'light') },
      pages,
      extraPages: Math.max(0, Math.min(40, Math.floor(Number(d.extraPages) || 0))),
      features,
      languages: features.includes('multilingual') ? Math.max(1, Math.min(LANG_CODES.length, Math.floor(Number(d.languages) || 1))) : 1,
      products: one(d.products, Object.keys(PRODUCT_COUNT), 'small'),
    };
  }

  function slugOf(name) {
    const s = String(name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');
    return s.slice(0, 28);
  }
  function initials(name) {
    const w = String(name).replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
    if (!w.length) return '·';
    const a = Array.from(w[0])[0] || '';
    const b = w.length > 1 ? (Array.from(w[1])[0] || '') : '';
    return (a + b).toUpperCase();
  }

  // ---------- the page, part by part ----------
  // Each part is { k: key (for scrolling to it), html }. `c` holds everything a part needs.
  function context(design, strings, opts) {
    const S = merge(EN, strings || {});
    const d = tidy(design);
    const ind = S.industries[d.business.industry];
    const kit = KIT[d.business.industry];
    const name = d.business.name || ind.name || S.yourName;
    const locale = S.locale || 'en-US';
    let nf;
    try { nf = new Intl.NumberFormat(locale); } catch (e) { nf = new Intl.NumberFormat('en-US'); }
    const f = {};
    d.features.forEach((x) => { f[x] = true; });
    const pg = {};
    d.pages.forEach((x) => { pg[x] = true; });
    if (d.type === 'webapp') { f.accounts = true; f.cms = f.cms || false; }
    return {
      S, d, ind, kit, f, pg, name, locale, nf,
      type: d.type, layout: d.look.layout, device: (opts && DEVICES[opts.device]) ? opts.device : 'desktop',
      money: (n) => fill(S.money, { n: nf.format(n) }),
      year: (opts && opts.year) || new Date().getFullYear(),
      list: (items) => { try { return new Intl.ListFormat(locale, { type: 'conjunction' }).format(items); } catch (e) { return items.join(', '); } },
    };
  }

  const art = (glyph, v, cls = '') => `<div class="pv-art pv-v${v}${cls ? ' ' + cls : ''}"><i class="pv-blob pv-b1"></i><i class="pv-blob pv-b2"></i>${svg(glyph, 'pv-glyph', 0.7)}</div>`;
  const btn = (label, kind = '') => `<span class="pv-btn${kind ? ' pv-btn-' + kind : ''}">${esc(label)}</span>`;
  const kicker = (s) => `<div class="pv-kicker">${esc(s)}</div>`;
  const h2 = (s) => `<div class="pv-h2">${esc(s)}</div>`;
  const lines = (n, cls = '') => `<div class="pv-lines ${cls}">${'<i></i>'.repeat(n)}</div>`;

  function navLabels(c) {
    const { S, d, ind } = c;
    const items = [];
    if (c.type === 'store') items.push(S.nav.shop);
    if (c.type === 'webapp') items.push(S.nav.product);
    d.pages.forEach((p) => {
      if (p === 'home' && (c.type === 'store' || c.type === 'webapp')) return;
      items.push(p === 'services' ? ind.servicesNav : S.nav[p]);
    });
    for (let i = 1; i <= d.extraPages; i++) items.push(fill(S.nav.page, { n: d.pages.length + i }));
    return items;
  }

  function header(c, over) {
    const { S, f, d } = c;
    const items = navLabels(c);
    const max = c.device === 'desktop' ? 6 : c.device === 'tablet' ? 4 : 0;
    const shown = items.length > max ? items.slice(0, Math.max(0, max - 1)) : items;
    const more = items.length > shown.length && max > 0;
    const cta = c.type === 'store' ? '' : c.type === 'webapp' ? S.ui.getStarted : f.booking ? c.ind.book : c.ind.cta;
    const langs = f.multilingual && d.languages > 1 ? `<span class="pv-lang">${svg('globe')}${LANG_CODES[0]}${svg('chevron', 'pv-i pv-i-s')}</span>` : '';
    const tools = [
      f.search ? (c.device === 'desktop' ? `<span class="pv-search">${svg('search')}<span>${esc(S.ui.search)}</span></span>` : `<span class="pv-tool">${svg('search')}</span>`) : '',
      langs,
      f.accounts && c.device !== 'phone' ? `<span class="pv-signin">${svg('user')}<span>${esc(S.ui.signIn)}</span></span>` : (f.accounts ? `<span class="pv-tool">${svg('user')}</span>` : ''),
      c.type === 'store' ? `<span class="pv-tool pv-cart">${svg('bag')}<b>2</b></span>` : '',
      cta && c.device !== 'phone' ? btn(cta) : '',
      c.device === 'phone' ? `<span class="pv-tool pv-burger">${svg('menu')}</span>` : '',
    ].join('');
    const bar = f.cms ? `<div class="pv-editbar"><span><i></i>${esc(S.ui.editBar)}</span><span class="pv-editbar-r"><b>${svg('pen')}${esc(S.ui.editPage)}</b><span>${esc(S.ui.dashboard)}</span></span></div>` : '';
    return `<div class="pv-head${over ? ' pv-head-over' : ''}" data-k="header">${bar}<div class="pv-in pv-head-in">
      <span class="pv-logo"><span class="pv-mark">${esc(initials(c.name))}</span><span class="pv-logo-name">${esc(c.name)}</span></span>
      ${max ? `<span class="pv-nav">${shown.map((x, i) => `<span${i === 0 ? ' class="on"' : ''}>${esc(x)}</span>`).join('')}${more ? `<span>${esc(S.nav.more)}${svg('chevron', 'pv-i pv-i-s')}</span>` : ''}</span>` : ''}
      <span class="pv-tools">${tools}</span>
    </div></div>`;
  }

  function heroCopy(c) {
    const { S, ind, d } = c;
    const t = d.business.tagline;
    if (c.type === 'store') return { k: S.sec.storeKicker, h: t || ind.shopHero, p: ind.sub, b1: S.ui.shopNow, b2: ind.servicesNav === S.nav.shop ? S.ui.viewAll : ind.cta2 };
    if (c.type === 'webapp') return { k: S.types.webapp.kicker, h: t || S.types.webapp.hero, p: S.types.webapp.sub, b1: S.ui.getStarted, b2: S.ui.seeHow };
    if (c.type === 'portfolio') return { k: S.types.portfolio.kicker, h: t || S.types.portfolio.hero, p: S.types.portfolio.sub, b1: S.ui.seeWork, b2: S.ui.contactUs };
    return { k: ind.kicker, h: t || ind.hero, p: ind.sub, b1: c.f.booking ? ind.book : ind.cta, b2: ind.cta2 };
  }

  // a small card that floats over the hero picture, showing the most telling thing about the site
  function floatCard(c) {
    const { S, ind, kit } = c;
    if (c.type === 'store') return `<div class="pv-float-card pv-fc-prod">${art(kit.art[1], 5, 'pv-art-sm')}<div><b>${esc(ind.products[0])}</b><span>${esc(c.money(kit.prices[0]))}</span></div>${btn(S.ui.addToCart, 'sm')}</div>`;
    if (c.type === 'webapp') return `<div class="pv-float-card pv-fc-kpi"><span>${esc(S.sec.kpis[0])}</span><b>${esc(c.nf.format(2481))}</b><svg class="pv-spark" viewBox="0 0 100 30" preserveAspectRatio="none" focusable="false"><path d="M0 24 L15 20 L28 22 L42 14 L58 16 L72 8 L86 10 L100 3"/></svg></div>`;
    if (c.f.booking) return `<div class="pv-float-card pv-fc-book">${svg('calendar')}<div><b>${esc(ind.book)}</b><span>${esc(ind.bookUnit)} · ${esc(timeLabel(c, 19.5))}</span></div><span class="pv-ok">${svg('check')}</span></div>`;
    return `<div class="pv-float-card pv-fc-pts">${ind.points.slice(0, 2).map((p, i) => `<span>${svg(kit.pts[i])}${esc(p)}</span>`).join('')}</div>`;
  }

  function hero(c) {
    const x = heroCopy(c);
    const kit = c.kit;
    const copy = `${kicker(x.k)}<div class="pv-h1">${esc(x.h)}</div><p class="pv-lead">${esc(x.p)}</p><div class="pv-btns">${btn(x.b1)}${btn(x.b2, 'ghost')}</div>`;
    if (c.layout === 'bold') {
      return `<div class="pv-hero pv-hero-bold" data-k="top">${header(c, true)}
        <div class="pv-photo">${art(kit.art[0], 1, 'pv-art-hero')}<svg class="pv-hills" viewBox="0 0 1200 300" preserveAspectRatio="none" focusable="false"><path class="pv-hill1" d="M0 210 C 220 120 420 250 640 170 S 1020 90 1200 160 L1200 300 L0 300Z"/><path class="pv-hill2" d="M0 250 C 260 190 520 290 800 230 S 1100 200 1200 230 L1200 300 L0 300Z"/></svg><i class="pv-sun"></i></div>
        <div class="pv-scrim"></div>
        <div class="pv-in pv-hero-copy">${copy}</div>
        <div class="pv-in"><div class="pv-hero-foot">${c.ind.points.map((p, i) => `<span>${svg(kit.pts[i])}${esc(p)}</span>`).join('')}</div></div>
      </div>`;
    }
    if (c.layout === 'classic') {
      return `${header(c)}<div class="pv-hero pv-hero-classic" data-k="top"><div class="pv-in pv-split">
        <div class="pv-hero-copy">${copy}<div class="pv-hero-pts">${c.ind.points.map((p, i) => `<span>${svg(kit.pts[i])}${esc(p)}</span>`).join('')}</div></div>
        <div class="pv-hero-media">${art(kit.art[0], 1, 'pv-art-tall')}${art(kit.art[1], 5, 'pv-art-inset')}${floatCard(c)}</div>
      </div></div>`;
    }
    return `${header(c)}<div class="pv-hero pv-hero-clean" data-k="top"><i class="pv-glow pv-g1"></i><i class="pv-glow pv-g2"></i>
      <div class="pv-in pv-center pv-hero-copy">${copy}</div>
      <div class="pv-in pv-hero-media">${art(kit.art[0], 1, 'pv-art-wide')}${floatCard(c)}</div>
    </div>`;
  }

  function points(c) {
    if (c.layout === 'bold') return '';
    const { ind, kit } = c;
    return `<div class="pv-sec pv-points" data-k="points"><div class="pv-in pv-grid3">${ind.points.map((p, i) => `<div class="pv-point"><span class="pv-ico">${svg(kit.pts[i])}</span><b>${esc(p)}</b></div>`).join('')}</div></div>`;
  }

  function services(c, alt) {
    const { S, ind, kit } = c;
    const items = pairs(ind.services);
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="services"><div class="pv-in">
      <div class="pv-sec-head">${kicker(ind.servicesNav)}${h2(ind.servicesTitle)}</div>
      <div class="pv-grid3">${items.map(([t, p], i) => `<div class="pv-card pv-svc"><span class="pv-ico">${svg(kit.svc[i])}</span><b class="pv-h3">${esc(t)}</b><p>${esc(p)}</p><span class="pv-link">${esc(S.ui.learnMore)}${svg('arrow', 'pv-i pv-i-s')}</span></div>`).join('')}</div>
    </div></div>`;
  }

  function about(c, alt) {
    const { S, ind, kit } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="about"><div class="pv-in pv-split pv-split-media">
      <div class="pv-about-media">${art(kit.art[2], 2, 'pv-art-tall')}${art(kit.art[0], 6, 'pv-art-inset')}</div>
      <div>${kicker(S.sec.aboutKicker)}${h2(fill(S.sec.aboutTitle, { name: c.name }))}<p class="pv-p">${esc(ind.about)}</p>
        <div class="pv-checks">${S.sec.aboutPoints.map((p) => `<span>${svg('check')}${esc(p)}</span>`).join('')}</div>${btn(S.ui.readStory, 'ghost')}</div>
    </div></div>`;
  }

  function timeLabel(c, h) {
    const dt = new Date(2027, 0, 4, Math.floor(h), Math.round((h % 1) * 60));
    try { return new Intl.DateTimeFormat(c.locale, { hour: 'numeric', minute: '2-digit' }).format(dt); } catch (e) { return `${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`; }
  }

  function booking(c, alt) {
    const { S, ind } = c;
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const first = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const today = now.getDate();
    const pick = Math.min(days, today + 2);
    let month = '', wd = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    try {
      month = new Intl.DateTimeFormat(c.locale, { month: 'long', year: 'numeric' }).format(now);
      const w = new Intl.DateTimeFormat(c.locale, { weekday: 'short' });
      wd = [0, 1, 2, 3, 4, 5, 6].map((i) => w.format(new Date(2024, 0, 1 + i)));
    } catch (e) { /* the defaults above */ }
    const cells = [];
    for (let i = 0; i < first; i++) cells.push('<i class="pv-day pv-day-x"></i>');
    for (let dd = 1; dd <= days; dd++) {
      const cls = dd < today ? ' pv-day-past' : dd === pick ? ' pv-day-on' : ((dd + first) % 7 === 0 ? ' pv-day-past' : '');
      cells.push(`<i class="pv-day${cls}">${c.nf.format(dd)}</i>`);
    }
    const times = [9, 10.5, 12, 13.5, 15, 16.5];
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="booking"><div class="pv-in pv-split pv-split-book">
      <div>${kicker(S.sec.bookingKicker)}${h2(ind.book)}<p class="pv-p">${esc(S.sec.bookingText)}</p>
        <div class="pv-checks"><span>${svg('clock')}${esc(ind.bookUnit)}</span><span>${svg('mail')}${esc(S.ui.confirm)}</span></div></div>
      <div class="pv-card pv-cal">
        <div class="pv-cal-head"><b>${esc(month)}</b><span>${svg('chevronL', 'pv-i pv-i-s')}${svg('chevronR', 'pv-i pv-i-s')}</span></div>
        <div class="pv-cal-grid">${wd.map((w) => `<i class="pv-wd">${esc(w)}</i>`).join('')}${cells.join('')}</div>
        <div class="pv-cal-label">${esc(S.sec.pickTime)}</div>
        <div class="pv-times">${times.map((h, i) => `<span${i === 3 ? ' class="on"' : ''}>${esc(timeLabel(c, h))}</span>`).join('')}</div>
        <div class="pv-cal-foot"><span>${esc(ind.bookUnit)} · ${esc(timeLabel(c, 13.5))}</span>${btn(S.ui.confirm, 'sm')}</div>
      </div>
    </div></div>`;
  }

  function gallery(c, alt) {
    const { S, ind, kit } = c;
    const port = c.type === 'portfolio';
    const vs = [1, 5, 3, 6, 2, 4];
    const tiles = vs.map((v, i) => `<div class="pv-tile pv-tile-${i + 1}">${art(kit.art[i % 3], v)}${port ? `<span class="pv-cap"><b>${esc(S.sec.projects[i])}</b><span>${esc(c.year - (i > 2 ? 1 : 0))}</span></span>` : ''}</div>`).join('');
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="gallery"><div class="pv-in">
      <div class="pv-sec-head pv-sec-row"><div>${kicker(S.sec.galleryKicker)}${h2(port ? S.sec.portfolioTitle : ind.galleryTitle)}</div><span class="pv-link">${esc(S.ui.viewAll)}${svg('arrow', 'pv-i pv-i-s')}</span></div>
      <div class="pv-gallery${port ? ' pv-gallery-port' : ''}">${tiles}</div>
    </div></div>`;
  }

  function shop(c, alt) {
    const { S, ind, kit, d } = c;
    const many = d.products !== 'small';
    const names = many ? ind.products.concat(ind.products) : ind.products;
    const cards = names.map((n, i) => `<div class="pv-prod">${art(kit.art[i % 3], [5, 3, 2, 6, 1, 4, 5, 3][i], 'pv-art-prod')}${i === 1 ? `<span class="pv-badge">${esc(S.sec.filters[1])}</span>` : ''}<b>${esc(n)}</b><span class="pv-price">${esc(c.money(kit.prices[i % 4] + (i > 3 ? 6 : 0)))}</span>${btn(S.ui.addToCart, 'sm')}</div>`).join('');
    const pagesN = Math.ceil(PRODUCT_COUNT[d.products] / (many ? 8 : 4));
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="shop"><div class="pv-in">
      <div class="pv-sec-head pv-sec-row"><div>${kicker(S.sec.shopKicker)}${h2(S.sec.shopTitle)}</div><span class="pv-count">${esc(fill(S.sec.productsCount, { n: c.nf.format(PRODUCT_COUNT[d.products]) }))}</span></div>
      <div class="pv-filters">${S.sec.filters.map((x, i) => `<span${i === 0 ? ' class="on"' : ''}>${esc(x)}</span>`).join('')}${c.f.search ? `<span class="pv-filter-search">${svg('search')}</span>` : ''}</div>
      <div class="pv-prods">${cards}</div>
      ${many ? `<div class="pv-pager"><span class="on">1</span><span>2</span><span>3</span><span>…</span><span>${esc(c.nf.format(pagesN))}</span></div>` : ''}
    </div></div>`;
  }

  function app(c, alt) {
    const { S, nf } = c;
    const k = S.sec.kpis;
    const icons = ['grid', 'users', 'bag', 'chart', 'settings'];
    const rows = S.sec.tableNames.map((n, i) => `<div class="pv-tr"><span><i class="pv-av pv-av-${i + 1}">${esc(initials(n))}</i>${esc(n)}</span><span class="pv-st pv-st-${i % 3}">${esc(S.sec.statuses[i % 3])}</span><span>${esc(timeLabel(c, 9 + i * 2.25))}</span></div>`).join('');
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="app"><div class="pv-in">
      <div class="pv-sec-head pv-center">${kicker(S.sec.appKicker)}${h2(S.sec.appTitle)}</div>
      <div class="pv-appwin">
        <div class="pv-app-side"><span class="pv-logo"><span class="pv-mark">${esc(initials(c.name))}</span></span>${S.sec.appNav.map((x, i) => `<span${i === 0 ? ' class="on"' : ''}>${svg(icons[i])}<em>${esc(x)}</em></span>`).join('')}</div>
        <div class="pv-app-main">
          <div class="pv-app-top"><span class="pv-search">${svg('search')}<span>${esc(S.ui.search)}</span></span><i class="pv-av pv-av-1">${esc(initials(c.name))}</i></div>
          <div class="pv-kpis"><div><span>${esc(k[0])}</span><b>${esc(nf.format(2481))}</b><em>+12%</em></div><div><span>${esc(k[1])}</span><b>${esc(c.money(18240))}</b><em>+8%</em></div><div><span>${esc(k[2])}</span><b>${esc(nf.format(94))}%</b><em>+3%</em></div></div>
          <div class="pv-chart"><div class="pv-chart-head"><b>${esc(S.sec.chartTitle)}</b><span><i></i><i></i></span></div>
            <svg viewBox="0 0 600 160" preserveAspectRatio="none" focusable="false"><path class="pv-grid-l" d="M0 40H600M0 80H600M0 120H600"/><path class="pv-area" d="M0 130 C 60 120 90 90 150 96 S 240 60 300 70 S 400 30 460 44 S 560 20 600 16 L600 160 L0 160Z"/><path class="pv-line" d="M0 130 C 60 120 90 90 150 96 S 240 60 300 70 S 400 30 460 44 S 560 20 600 16"/><path class="pv-line2" d="M0 140 C 80 136 120 120 180 124 S 300 100 360 106 S 480 84 600 70"/></svg></div>
          <div class="pv-table"><div class="pv-tr pv-th">${S.sec.tableHead.map((h) => `<span>${esc(h)}</span>`).join('')}</div>${rows}</div>
        </div>
      </div>
    </div></div>`;
  }

  function pricing(c, alt) {
    const { S } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="pricing"><div class="pv-in">
      <div class="pv-sec-head pv-center">${kicker(S.sec.pricingKicker)}${h2(S.sec.pricingTitle)}</div>
      <div class="pv-grid3 pv-plans">${S.sec.plans.map((p, i) => `<div class="pv-card pv-plan${i === 1 ? ' pv-plan-on' : ''}">${i === 1 ? `<span class="pv-badge">${esc(S.sec.popular)}</span>` : ''}<b class="pv-h3">${esc(p)}</b><div class="pv-plan-price">${esc(fill(S.perMonth, { price: c.money(PLAN_PRICES[i]) }))}</div><div class="pv-checks">${S.sec.planPoints.slice(0, i + 1).map((x) => `<span>${svg('check')}${esc(x)}</span>`).join('')}</div>${btn(c.f.payments ? S.ui.payNow : S.ui.choose, i === 1 ? '' : 'ghost')}</div>`).join('')}</div>
    </div></div>`;
  }

  function reviews(c, alt) {
    const { S } = c;
    const card = `<div class="pv-card pv-review"><span class="pv-review-q">${svg('chat')}</span>${lines(3)}<div class="pv-review-who"><i class="pv-av pv-av-blank"></i>${lines(1, 'pv-lines-s')}</div></div>`;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="reviews"><div class="pv-in">
      <div class="pv-sec-head pv-center">${kicker(S.sec.reviewsKicker)}${h2(S.sec.reviewsTitle)}<p class="pv-p">${esc(S.sec.reviewsNote)}</p></div>
      <div class="pv-grid3">${card}${card}${card}</div>
    </div></div>`;
  }

  function team(c, alt) {
    const { S } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="team"><div class="pv-in">
      <div class="pv-sec-head">${kicker(S.sec.teamKicker)}${h2(fill(S.sec.teamTitle, { name: c.name }))}</div>
      <div class="pv-grid4">${pairs(S.sec.team).map(([n, r], i) => `<div class="pv-person"><span class="pv-face pv-face-${i + 1}">${esc(initials(n))}</span><b>${esc(n)}</b><span>${esc(r)}</span></div>`).join('')}</div>
    </div></div>`;
  }

  function blog(c, alt) {
    const { S, ind, kit } = c;
    let fmt;
    try { fmt = new Intl.DateTimeFormat(c.locale, { day: 'numeric', month: 'short' }); } catch (e) { fmt = null; }
    const now = Date.now();
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="blog"><div class="pv-in">
      <div class="pv-sec-head pv-sec-row"><div>${kicker(S.sec.blogKicker)}${h2(S.sec.blogTitle)}</div><span class="pv-link">${esc(S.ui.viewAll)}${svg('arrow', 'pv-i pv-i-s')}</span></div>
      <div class="pv-grid3">${ind.blog.map((t, i) => `<div class="pv-post">${art(kit.art[(i + 1) % 3], [3, 6, 2][i], 'pv-art-post')}<span class="pv-meta">${esc(fmt ? fmt.format(new Date(now - (i * 9 + 3) * 864e5)) : '')} · ${esc(fill(S.ui.minutes, { n: c.nf.format(4 + i * 2) }))}</span><b class="pv-h3">${esc(t)}</b><span class="pv-link">${esc(S.ui.readMore)}${svg('arrow', 'pv-i pv-i-s')}</span></div>`).join('')}</div>
    </div></div>`;
  }

  function careers(c, alt) {
    const { S } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="careers"><div class="pv-in pv-split">
      <div>${kicker(S.sec.careersKicker)}${h2(S.sec.careersTitle)}<p class="pv-p">${esc(S.sec.careersText)}</p></div>
      <div class="pv-jobs">${S.sec.jobs.map((j) => `<div class="pv-job"><div><b>${esc(j)}</b><span>${esc(S.sec.jobMeta)}</span></div>${btn(S.ui.apply, 'sm')}</div>`).join('')}</div>
    </div></div>`;
  }

  function faq(c, alt) {
    const { S } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="faq"><div class="pv-in pv-narrow">
      <div class="pv-sec-head pv-center">${kicker(S.sec.faqKicker)}${h2(S.sec.faqTitle)}</div>
      <div class="pv-faq">${S.sec.faq.map((q, i) => `<div class="pv-q${i === 0 ? ' on' : ''}"><div><b>${esc(q)}</b>${svg(i === 0 ? 'chevron' : 'plus', 'pv-i')}</div>${i === 0 ? `<p>${esc(S.sec.faqAnswer)}</p>` : ''}</div>`).join('')}</div>
    </div></div>`;
  }

  function payments(c, alt) {
    const { S } = c;
    return `<div class="pv-sec pv-sec-s${alt ? ' pv-alt' : ''}" data-k="payments"><div class="pv-in"><div class="pv-pay">
      <span class="pv-ico">${svg('lock')}</span><div><b class="pv-h3">${esc(S.sec.payTitle)}</b><p>${esc(S.sec.payText)}</p></div>
      <span class="pv-cards"><i class="pv-cc pv-cc1"></i><i class="pv-cc pv-cc2"></i><i class="pv-cc pv-cc3"></i></span>${btn(S.ui.payNow)}
    </div></div></div>`;
  }

  function newsletter(c) {
    const { S } = c;
    return `<div class="pv-sec pv-sec-s" data-k="newsletter"><div class="pv-in"><div class="pv-news">
      <div><b class="pv-h2">${esc(S.sec.newsTitle)}</b><p>${esc(fill(S.sec.newsText, { name: c.name }))}</p></div>
      <div class="pv-news-form"><span class="pv-input">${svg('mail')}${esc(S.ui.emailField)}</span>${btn(S.ui.subscribe, 'inv')}</div>
    </div></div></div>`;
  }

  function mapArt(cls = '') {
    return `<div class="pv-map ${cls}"><svg viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" focusable="false">
      <rect class="pv-m-bg" width="400" height="260"/><path class="pv-m-water" d="M-10 200 C 80 170 140 230 230 196 S 360 150 420 176 L420 270 L-10 270Z"/>
      <rect class="pv-m-park" x="250" y="34" width="96" height="62" rx="10"/>
      <path class="pv-m-road" d="M-10 120 L420 96 M120 -10 L150 270 M280 -10 L262 270 M-10 52 L420 30"/><path class="pv-m-road2" d="M40 -10 L70 270 M200 -10 L206 270 M340 -10 L330 270 M-10 166 L420 140"/>
    </svg><span class="pv-pin">${svg('pin')}</span></div>`;
  }

  function locations(c, alt) {
    const { S } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="locations"><div class="pv-in">
      <div class="pv-sec-head">${kicker(S.sec.locationsKicker)}${h2(S.sec.locationsTitle)}</div>
      <div class="pv-grid2">${S.sec.locations.map((l, i) => `<div class="pv-card pv-loc">${mapArt(i ? 'pv-map-2' : '')}<b class="pv-h3">${esc(l)}</b><span>${svg('pin')}${esc(S.sec.address)}</span><span>${svg('clock')}${esc(S.sec.hours)}</span></div>`).join('')}</div>
    </div></div>`;
  }

  function contact(c, alt) {
    const { S, f } = c;
    const info = `<div class="pv-info"><span>${svg('pin')}<em>${esc(S.sec.addressLabel)}</em>${esc(S.sec.address)}</span><span>${svg('clock')}<em>${esc(S.sec.hoursLabel)}</em>${esc(S.sec.hours)}</span><span>${svg('phone')}<em>${esc(S.sec.phoneLabel)}</em>${esc(S.sec.phone)}</span></div>`;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="contact"><div class="pv-in pv-split">
      <div>${kicker(S.sec.contactKicker)}${h2(S.sec.contactTitle)}${info}${f.maps && !c.pg.locations ? mapArt('pv-map-contact') : ''}</div>
      <div class="pv-card pv-form"><span class="pv-input">${esc(S.ui.nameField)}</span><span class="pv-input">${esc(S.ui.emailField)}</span><span class="pv-input pv-input-tall">${esc(S.ui.messageField)}</span>${btn(S.ui.send)}</div>
    </div></div>`;
  }

  function mapSec(c, alt) {
    const { S } = c;
    return `<div class="pv-sec${alt ? ' pv-alt' : ''}" data-k="map"><div class="pv-in">
      <div class="pv-sec-head pv-sec-row"><div>${kicker(S.sec.locationsKicker)}${h2(S.sec.mapTitle)}</div><span class="pv-link">${esc(S.ui.directions)}${svg('arrow', 'pv-i pv-i-s')}</span></div>
      ${mapArt('pv-map-wide')}
    </div></div>`;
  }

  function footer(c) {
    const { S, f, d } = c;
    const items = navLabels(c).slice(0, 8);
    const langs = f.multilingual && d.languages > 1 ? `<span class="pv-foot-langs">${LANG_CODES.slice(0, d.languages).map((l, i) => `<span${i === 0 ? ' class="on"' : ''}>${l}</span>`).join('')}</span>` : '';
    return `<div class="pv-foot" data-k="footer"><div class="pv-in">
      <div class="pv-foot-grid">
        <div><span class="pv-logo"><span class="pv-mark">${esc(initials(c.name))}</span><span class="pv-logo-name">${esc(c.name)}</span></span><p>${esc(c.d.business.tagline || c.ind.sub)}</p></div>
        <div class="pv-foot-col">${items.map((x) => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="pv-foot-col"><span>${esc(S.sec.address)}</span><span>${esc(S.sec.phone)}</span><span>${esc(S.sec.hours)}</span></div>
        <div class="pv-foot-col"><b>${esc(S.ui.follow)}</b><span class="pv-social"><i></i><i></i><i></i></span></div>
      </div>
      <div class="pv-foot-base"><span>${esc(fill(S.ui.rights, { year: c.year, name: c.name }))}</span><span>${esc(S.ui.privacy)} · ${esc(S.ui.terms)}</span>${langs}</div>
    </div></div>`;
  }

  // the parts of the home page, in order, with the alternating section colours worked out
  function parts(c) {
    const { pg, f, type } = c;
    const order = [];
    const add = (fn, key, on) => { if (on) order.push([fn, key]); };
    add(shop, 'shop', type === 'store');
    add(app, 'app', type === 'webapp');
    add(services, 'services', pg.services || type === 'landing' || type === 'business');
    add(about, 'about', pg.about);
    add(booking, 'booking', f.booking);
    add(gallery, 'gallery', pg.gallery || type === 'portfolio');
    add(pricing, 'pricing', pg.pricing);
    add(reviews, 'reviews', pg.testimonials || f.reviews);
    add(team, 'team', pg.team);
    add(blog, 'blog', pg.blog);
    add(careers, 'careers', pg.careers);
    add(faq, 'faq', pg.faq);
    add(payments, 'payments', f.payments && type !== 'store' && !pg.pricing);
    add(newsletter, 'newsletter', f.newsletter);
    add(locations, 'locations', pg.locations);
    add(contact, 'contact', pg.contact || type === 'landing');
    add(mapSec, 'map', f.maps && !pg.contact && !pg.locations && type !== 'landing');
    const keys = ['top'];
    let alt = true;
    let html = hero(c) + points(c);
    if (c.layout !== 'bold') keys.push('points');
    for (const [fn, key] of order) {
      html += fn(c, alt && key !== 'newsletter');
      if (key !== 'newsletter') alt = !alt;
      keys.push(key);
    }
    html += footer(c);
    keys.push('footer');
    return { html, keys };
  }

  // ---------- the window around it ----------
  const SHELL = '<div class="pv-shell"><div class="pv-chrome"><span class="pv-dots"><i></i><i></i><i></i></span><span class="pv-url"><svg class="pv-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">' + I.lock + '</svg><span class="pv-url-text"></span></span><span class="pv-chrome-end"></span></div><div class="pv-screen"><div class="pv-viewport"><div class="pv-site"></div></div><div class="pv-chatbox"></div></div></div><div class="pv-extras"></div>';

  function setVars(el, vars) { for (const k of Object.keys(vars)) el.style.setProperty(k, vars[k]); }

  function fit(root) {
    const shell = root.querySelector('.pv-shell');
    const site = root.querySelector('.pv-site');
    const dev = root.dataset.device || 'desktop';
    const w = root.clientWidth;
    if (!w) return;
    const max = dev === 'phone' ? 300 : dev === 'tablet' ? 560 : w;
    const sw = Math.min(w, max);
    shell.style.setProperty('width', sw + 'px');
    const inner = shell.querySelector('.pv-screen').clientWidth || sw;
    const z = inner / DEVICES[dev];
    root.style.setProperty('--pv-zoom', String(Math.round(z * 10000) / 10000));
    site.style.setProperty('width', DEVICES[dev] + 'px');
  }

  function scrollToKey(root, key) {
    const vp = root.querySelector('.pv-viewport');
    if (!key || !vp) return;
    const el = key === 'top' ? null : root.querySelector(`.pv-site [data-k="${key}"]`);
    const top = el ? el.getBoundingClientRect().top - vp.getBoundingClientRect().top + vp.scrollTop - 8 : 0;
    const smooth = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    try { vp.scrollTo({ top: Math.max(0, top), behavior: smooth ? 'smooth' : 'auto' }); } catch (e) { vp.scrollTop = Math.max(0, top); }
  }

  // what a change should bring into view: a page or a feature's own section, or the top bar
  function focusKey(c, focus) {
    if (!focus) return null;
    if (focus === 'top' || focus === 'header') return 'top';
    if (focus === 'products') return 'shop';
    const [kind, id] = String(focus).split(':');
    const map = kind === 'page'
      ? { home: 'top', about: 'about', services: 'services', gallery: 'gallery', pricing: 'pricing', team: 'team', blog: 'blog', faq: 'faq', contact: 'contact', testimonials: 'reviews', careers: 'careers', locations: 'locations', extra: 'top' }
      : { booking: 'booking', payments: c.type === 'store' ? 'shop' : c.pg.pricing ? 'pricing' : 'payments', newsletter: 'newsletter', maps: c.pg.locations ? 'locations' : (c.pg.contact || c.type === 'landing') ? 'contact' : 'map', reviews: 'reviews', cms: 'top', multilingual: 'top', accounts: 'top', search: c.type === 'store' ? 'top' : 'top', livechat: null, seo: null, analytics: null };
    return map[id] === undefined ? null : map[id];
  }

  function render(container, design, strings, opts) {
    if (!container) return null;
    opts = opts || {};
    const c = context(design, strings, opts);
    let root = container.firstElementChild;
    if (!root || !root.classList.contains('pv')) {
      container.innerHTML = '<div class="pv">' + SHELL + '</div>';
      root = container.firstElementChild;
      // colours fade from the second drawing on (not from the stylesheet's defaults on the first)
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('pv-ready')));
      if ('ResizeObserver' in window) {
        root._pvRO = new ResizeObserver(() => fit(root));
        root._pvRO.observe(root);
      } else {
        window.addEventListener('resize', () => fit(root));
      }
    }
    const site = root.querySelector('.pv-site');
    const vp = root.querySelector('.pv-viewport');
    // colours, type and zoom: custom properties only, so a change fades instead of redrawing
    setVars(root, themeVars(c.d.look));
    root.dataset.device = c.device;
    site.className = `pv-site pv-d-${c.device} pv-l-${c.layout} pv-f-${c.d.look.font} pv-m-${c.d.look.mode} pv-t-${c.type}`;
    root.querySelector('.pv-url-text').textContent = fill(c.S.domain, { slug: slugOf(c.name) || slugOf(c.S.yourName) || 'yourbusiness' });
    fit(root);

    const { html, keys } = parts(c);
    const sig = c.device + '|' + html;
    let changed = false;
    if (root._pvSig !== sig) {
      const keep = vp.scrollTop;
      const before = root._pvKeys || null;
      site.innerHTML = html;
      vp.scrollTop = keep;
      if (before) {
        keys.filter((k) => !before.includes(k)).forEach((k) => {
          const el = site.querySelector(`[data-k="${k}"]`);
          if (el) el.classList.add('pv-new');
        });
      }
      root._pvKeys = keys;
      root._pvSig = sig;
      changed = true;
    }
    // the chat button floats over the screen, like on a real site
    const chat = root.querySelector('.pv-chatbox');
    chat.innerHTML = c.f.livechat ? `<span class="pv-chat-msg">${esc(c.S.ui.chatHello)}</span><span class="pv-chat-btn">${svg('chat')}</span>` : '';
    chat.className = 'pv-chatbox' + (c.f.livechat ? ' on' : '');
    // features that work behind the scenes still get a mention under the window
    const hidden = ['seo', 'analytics'].filter((x) => c.f[x]).map((x) => c.S.features[x]);
    root.querySelector('.pv-extras').innerHTML = hidden.length ? `<span>${esc(c.S.sec.behind)}</span>${hidden.map((x) => `<b>${svg('check', 'pv-i pv-i-s')}${esc(x)}</b>`).join('')}` : '';
    const key = focusKey(c, opts.focus);
    if (key) requestAnimationFrame(() => scrollToKey(root, key));
    return { keys, changed };
  }

  function summary(design, strings) {
    const c = context(design, strings, {});
    const { S, d, f } = c;
    const P = S.summary.parts;
    const intro = fill(S.summary.intro, { type: S.types[d.type].label.toLowerCase(), name: c.name, industry: c.ind.label.toLowerCase() });
    const look = fill(S.summary.look, { palette: S.palettes[d.look.palette], font: S.fonts[d.look.font].toLowerCase(), layout: S.layouts[d.look.layout].toLowerCase(), mode: S.modes[d.look.mode].toLowerCase() });
    const head = [];
    const nav = navLabels(c);
    if (nav.length) head.push(fill(P.nav, { list: c.list(nav) }));
    if (f.search) head.push(P.search);
    if (f.multilingual && d.languages > 1) head.push(fill(P.langs, { n: c.nf.format(d.languages) }));
    if (f.accounts) head.push(P.signIn);
    if (d.type === 'store') head.push(P.cart);
    if (f.cms) head.push(P.edit);
    const { keys } = parts(c);
    const sec = keys.filter((k) => P[k === 'top' ? 'hero' : k]).map((k) => P[k === 'top' ? 'hero' : k]);
    if (f.livechat) sec.push(P.chat);
    return [intro, look, head.length ? fill(S.summary.head, { list: c.list(head) }) : '', fill(S.summary.sections, { list: c.list(sec) })].filter(Boolean).join(' ');
  }

  window.EvoPreview = { render, summary, strings: EN, palettes: PALETTES, fonts: FONTS, theme: themeVars, version: 1 };
})();
