/* Store data for the MSU Bookstore redesign.
 * Product names, links and prices come from the live catalog at msubookstore.org.
 * price: null means the store did not list one we could confirm; the UI shows "See price".
 * url: the product page when known, otherwise the closest category page on the real store.
 * art: which illustration to show when no photo has been downloaded for the product.
 */
(function () {
  const SITE = 'https://www.msubookstore.org';

  const links = {
    site: SITE,
    search: SITE + '/catalogsearch/result/',
    textbookSearch: SITE + '/textbook/index/search/',
    cart: SITE + '/checkout/cart/',
    account: SITE + '/customer/account/',
    cm101: SITE + '/course-materials-101',
    cm201: SITE + '/coursematerials201',
    inclusiveAccess: SITE + '/inclusive_access',
    faq: SITE + '/faq',
    returns: SITE + '/returns',
    about: SITE + '/about',
    hours: SITE + '/store-hours',
    contact: SITE + '/contact',
    techServices: SITE + '/bobcattechservices',
    facebook: 'https://www.facebook.com/msubookstore/'
  };

  // Shop categories. `store` is the matching page on the real site.
  const categories = [
    { id: 'champs',     name: 'National Champions', blurb: '2025 title gear',               icon: 'trophy', store: SITE + '/category/10006391' },
    { id: 'sweatshirts', name: 'Hoodies & Crews',   blurb: 'Nike, Champion & more',          icon: 'shirt',  store: SITE + '/category/10004936' },
    { id: 'tees',       name: 'Tees',               blurb: "Men's & women's",                icon: 'shirt',  store: SITE + '/category/10004935' },
    { id: 'hats',       name: 'Hats & Beanies',     blurb: 'New Era, Richardson & more',     icon: 'cap',    store: SITE + '/fan-zone/accessories/hats-beanies' },
    { id: 'kids',       name: 'Kids',               blurb: 'Youth tees, jackets, beanies',   icon: 'star',   store: SITE + '/apparel/kids-apparel' },
    { id: 'gifts',      name: 'Gifts',              blurb: 'Blankets, plush, stickers',      icon: 'gift',   store: SITE + '/category/10004969' },
    { id: 'tech',       name: 'Computers & Tech',   blurb: 'MacBook, calculators, audio',    icon: 'laptop', store: SITE + '/category/10005001' },
    { id: 'supplies',   name: 'Art & Lab Supplies', blurb: 'Pencils, tools, drafting',       icon: 'brush',  store: SITE + '/art-school/lab-materials' },
    { id: 'books',      name: 'Books',              blurb: 'General interest reading',       icon: 'book',   store: SITE + '/catalogsearch/result/?q=book' }
  ];
  const cat = Object.fromEntries(categories.map(c => [c.id, c]));

  const p = (id, name, opts) => Object.assign({ id, name, price: null, tags: [] }, opts);
  const prod = path => SITE + path;

  const products = [
    // National Champions
    p('10153841', 'Youth MSU Football 2025 National Champions State Shape Navy Tee', { cat: 'champs', brand: 'Youth', price: 25, url: prod('/product/gm/10153841'), art: 'tee-navy', badge: 'Champs', tags: ['kids', 'featured'], desc: 'Navy youth tee with the Montana state shape celebrating the 2025 national title.' }),
    p('champs-basic', 'MSU Football 2025 National Champions State Shape Basic Tee', { cat: 'champs', brand: 'Unisex', price: 30, url: cat.champs.store, art: 'tee-navy', badge: 'Champs', tags: ['featured'], desc: 'Basic tee with the state shape design marking the 2025 championship season.' }),
    p('champs-ladies', 'MSU Football 2025 National Champions State Shape Ladies Navy Basic Tee', { cat: 'champs', brand: "Women's", price: 30, url: cat.champs.store, art: 'tee-navy', badge: 'Champs', tags: ['womens'], desc: "Women's cut navy tee with the 2025 National Champions state shape graphic." }),
    p('champs-indigo', 'MSU Football 2025 National Champions Football Bobcat Head Indigo Short Sleeve Tee', { cat: 'champs', brand: 'Unisex', price: 40, url: cat.champs.store, art: 'tee-indigo', badge: 'Champs', desc: 'Indigo short sleeve tee with the football Bobcat head championship design.' }),
    p('ua-trophy', 'Under Armour 2025 National Champions Trophy Tee', { cat: 'champs', brand: 'Under Armour', price: 45, url: cat.champs.store, art: 'tee-gold', badge: 'Champs', tags: ['featured'], desc: 'Under Armour tee featuring the national championship trophy.' }),
    p('ua-tech', 'Under Armour 2025 National Champions Bobcat Football Tech Stretch Tee', { cat: 'champs', brand: 'Under Armour', price: 50, url: cat.champs.store, art: 'tee-slate', badge: 'Champs', desc: 'Stretch performance tee from Under Armour for the 2025 title team.' }),
    p('10153644', '2025 Football Championship Game Nashville Skyline Tee', { cat: 'champs', brand: 'Clearance', price: 35, url: prod('/product/gm/10153644'), art: 'tee-slate', badge: 'Clearance', tags: ['featured'], desc: 'Commemorates the championship game with a Nashville skyline graphic.' }),
    p('cardiac-cats', '2025 National Champions Cardiac Cats Tee', { cat: 'champs', brand: 'Unisex', price: 25, url: cat.champs.store, art: 'tee-gold', badge: 'Champs', desc: 'A nod to the comeback-heavy "Cardiac Cats" championship run.' }),

    // Hoodies & crews
    p('10115115', 'MSU Bobcats 3D Embroidered Big Cotton Hood', { cat: 'sweatshirts', brand: 'Big Cotton', url: prod('/product/10115115'), art: 'hoodie-navy', tags: ['featured'], desc: 'Heavyweight 9 oz fleece hood (80% cotton, 20% polyester) with 3D embroidery.' }),
    p('10102542', 'Nike Bobcat MSU Club Fleece Full Zip Hoodie', { cat: 'sweatshirts', brand: 'Nike', url: prod('/product/10102542'), art: 'zip', tags: ['featured'], desc: "Men's Club Fleece full zip with a full color Bobcat logo over MSU." }),
    p('10116039', 'Nike Bobcats Dri Fit Lightweight Hoodie', { cat: 'sweatshirts', brand: 'Nike', url: prod('/product/10116039'), art: 'hoodie-gray', desc: 'Lightweight Dri-FIT hoodie for everyday wear and workouts.' }),
    p('10098645', 'Champion Montana State Bobcat Rodeo Powerblend Hood', { cat: 'sweatshirts', brand: 'Champion', url: prod('/product/gm/10098645'), art: 'hoodie-gold', desc: 'Powerblend 50/50 fleece with a double-layer hood and kangaroo pocket.' }),
    p('10105189', 'BCC Bobcat Crew', { cat: 'sweatshirts', brand: 'BCC', url: prod('/product/10105189'), art: 'crew-navy', desc: 'A basic 100% cotton crewneck with the Bobcat logo on the front.' }),
    p('10100847', 'Nike Womens Bobcat Phoenix Fleece Crew', { cat: 'sweatshirts', brand: 'Nike', url: prod('/product/10100847'), art: 'crew-gray', tags: ['womens'], desc: 'Extra-oversized women\'s crew with a full color Bobcat logo on the chest.' }),
    p('10121078', '2024 Big Sky Conference Champions Football Crew', { cat: 'sweatshirts', brand: 'Big Sky Champions', url: prod('/product/10121078'), art: 'crew-gold', desc: "Honors the Bobcats' perfect 12-0 regular season in 2024." }),

    // Tees
    p('10115754', "Women's Montana State Bobcat 93 Intramural Classic Tee", { cat: 'tees', brand: 'League', url: prod('/product/10115754'), art: 'tee-cream', tags: ['womens'], desc: 'Soft cotton crewneck with Bobcats logo and "93 Intramural" graphics.' }),
    p('womens-primetime', "Women's Montana State Grey Primetime Tee", { cat: 'tees', brand: "Women's", price: 40, url: SITE + '/category/10004687', art: 'tee-gray', tags: ['womens'], desc: 'Grey Montana State tee from the women\'s collection.' }),
    p('champion-crop', "Champion Women's Montana State University Boyfriend Crop Tee", { cat: 'tees', brand: 'Champion', price: 35, url: SITE + '/category/10004687', art: 'tee-cream', tags: ['womens'], desc: 'Relaxed boyfriend fit, cropped length.' }),
    p('ua-icon', "Under Armour Women's Montana State W/Bobcat White Icon Tee", { cat: 'tees', brand: 'Under Armour', price: 44.95, url: SITE + '/category/10004687', art: 'tee-white', tags: ['womens'], desc: 'White Under Armour tee with Montana State wordmark and Bobcat icon.' }),
    p('10103788', "2024 Men's Lacrosse National Champion Short Sleeve Tee", { cat: 'tees', brand: 'Lacrosse', url: prod('/product/10103788'), art: 'tee-navy', desc: "Celebrates the 2024 men's lacrosse national championship." }),

    // Hats
    p('10146725', 'New Era Bobcats Montana State 9FORTY A-Frame Snapback Hat', { cat: 'hats', brand: 'New Era', url: prod('/product/gm/10146725'), art: 'cap-navy', tags: ['featured'], desc: 'Structured A-frame snapback with an adjustable fit.' }),
    p('10115893', 'New Era Montana State Bobcats Camo Monbob', { cat: 'hats', brand: 'New Era', url: prod('/product/10115893'), art: 'cap-camo', desc: 'Camo New Era cap with Montana State Bobcats branding.' }),
    p('10117102', 'New Era Bobcats Fitted with M Side Script', { cat: 'hats', brand: 'New Era', url: prod('/product/gm/10117102'), art: 'cap-gold', desc: 'Fitted New Era cap with an M script on the side.' }),
    p('richardson', 'Richardson Bobcat Fitted Cap', { cat: 'hats', brand: 'Richardson', url: cat.hats.store, art: 'cap-gray', desc: 'Fitted Richardson cap with a Bobcat logo.' }),
    p('10098288', 'Youth Bobcat North Pole Beanie', { cat: 'hats', brand: 'Youth', url: prod('/product/gm/10098288'), art: 'beanie', tags: ['kids'], desc: 'Charcoal grey youth beanie with a full color Bobcat head logo.' }),

    // Kids
    p('10101054', 'Youth Bobcat Maggie Fur Sherpa Full Zip Jacket', { cat: 'kids', brand: 'Youth', url: prod('/product/10101054'), art: 'jacket', desc: 'Cozy sherpa full zip for girls with an embroidered logo.' }),
    p('10132801', 'Nike Youth Bobcat Velocity Tee', { cat: 'kids', brand: 'Nike · Clearance', url: prod('/product/gm/10132801'), art: 'tee-indigo', badge: 'Clearance', desc: 'Cross-dyed youth tee with the Montana State Bobcat logo.' }),

    // Gifts
    p('10094800', 'Bobcat All Weather Blanket', { cat: 'gifts', brand: 'Blanket', price: 75, url: prod('/product/10094800'), art: 'blanket', tags: ['featured'], desc: '60" x 80" with a water-resistant outside and fleece inside. Built for game days.' }),
    p('10103529', 'Bobcat Montana State 50" x 60" Raschel Throw Blanket', { cat: 'gifts', brand: 'Blanket', price: 45, url: prod('/product/10103529'), art: 'blanket', desc: 'Soft raschel throw with Bobcat and Montana State graphics.' }),
    p('10096420', 'Graduation Bobcat', { cat: 'gifts', brand: 'Plush', price: 37.99, url: prod('/product/10096420'), art: 'plush', tags: ['featured'], desc: 'A 12" plush bobcat ready for commencement.' }),
    p('10096356', 'Rugged 3.5" Bobcat Sticker', { cat: 'gifts', brand: 'Sticker', price: 6.99, url: prod('/product/10096356'), art: 'sticker', desc: 'Durable 3.5" sticker with the full color Bobcat logo.' }),
    p('10101345', 'Rugged 2" Bozeman, MT Bobcat Sticker', { cat: 'gifts', brand: 'Sticker', price: 3.99, url: prod('/product/10101345'), art: 'sticker', desc: 'Small 2" sticker featuring a light blue Bobcat and Bozeman, MT.' }),
    p('tea-towel', 'Julia Gash Campus Art Tea Towel', { cat: 'gifts', brand: 'Julia Gash', price: 22.99, url: SITE + '/category/10006395', art: 'towel', desc: 'Illustrated campus art tea towel.' }),
    p('sweater-mug', 'Montana State Bobcats Holiday Sweater 16oz Ceramic Sandstone Mug', { cat: 'gifts', brand: 'Mug', price: 17.99, url: SITE + '/category/10006395', art: 'mug', desc: '16 oz sandstone ceramic mug with a holiday sweater pattern.' }),
    p('slate-ornament', 'Bobcat Montana State Shaped Slate Ornament', { cat: 'gifts', brand: 'Holiday', price: 14.99, url: SITE + '/category/10006395', art: 'ornament', desc: 'Slate ornament cut in the shape of Montana.' }),
    p('fuzzy-socks', 'Bobcata Fuzzy Dot Socks', { cat: 'gifts', brand: 'Socks', price: 15, url: SITE + '/category/10006395', art: 'socks', desc: 'Soft fuzzy socks with a dot pattern.' }),

    // Tech
    p('10124299', 'MacBook Air (M4)', { cat: 'tech', brand: 'Apple', price: 799, url: prod('/product/gm/10124299'), art: 'laptop', tags: ['featured'], desc: 'Apple MacBook Air with the M4 chip, available through the bookstore.' }),
    p('10096529', 'TI-84 Plus Graphing Calculator', { cat: 'tech', brand: 'Texas Instruments', price: 110, url: prod('/product/10096529'), art: 'calculator', desc: 'The graphing calculator many MSU math and science courses ask for.' }),
    p('10123656', 'Shokz OpenRun Pro 2 Wireless Headphones', { cat: 'tech', brand: 'Shokz', url: prod('/product/gm/10123656'), art: 'headphones', desc: 'Open-ear wireless headphones that leave you aware of your surroundings.' }),
    p('10123802', 'Logitech R500 Wireless Presenter with Laser Pointer', { cat: 'tech', brand: 'Logitech', url: prod('/product/gm/10123802'), art: 'presenter', desc: 'Advance slides from up to 65 feet away.' }),
    p('10121946', 'Apple Thunderbolt 5 Pro Cable 1m', { cat: 'tech', brand: 'Apple', url: prod('/product/gm/10121946'), art: 'cable', desc: 'One-meter Thunderbolt 5 Pro cable from Apple.' }),
    p('10095159', 'Apple USB-C to Lightning Cable', { cat: 'tech', brand: 'Apple', url: prod('/product/10095159'), art: 'cable', desc: 'Charge and sync Lightning devices from USB-C.' }),

    // Art & lab supplies
    p('10098275', 'Prismacolor Verithin Red/Blue Colored Pencil', { cat: 'supplies', brand: 'Prismacolor', url: prod('/product/gm/10098275'), art: 'pencil', desc: 'Double-ended pencil with one red end and one blue end.' }),
    p('10131744', 'Grumbacher Miskit Liquid Frisket 1.2oz', { cat: 'supplies', brand: 'Grumbacher', url: prod('/product/gm/10131744'), art: 'bottle', desc: 'Bright orange masking fluid for watercolor paper.' }),
    p('10118561', 'Colour Shaper', { cat: 'supplies', brand: 'Art tools', url: prod('/product/gm/10118561'), art: 'brush', desc: 'Brush-handled shaping tool for painting, printmaking and sculpting.' }),
    p('10116623', 'Utility Tweezers', { cat: 'supplies', brand: 'Jewelry & metals', url: prod('/product/gm/10116623'), art: 'tweezers', desc: 'Long curved tips for small parts, soldering and metal clay.' }),
    p('10123157', 'LINECO Methyl Cellulose Adhesive Powder', { cat: 'supplies', brand: 'LINECO', url: prod('/product/gm/10123157'), art: 'jar', desc: 'Neutral pH, water-reversible adhesive for book and paper arts.' }),
    p('10092644', 'Pacific Arc Vinyl Drawing Board Cover (VYCO)', { cat: 'supplies', brand: 'Pacific Arc', url: prod('/product/gm/10092644'), art: 'board', desc: 'Industry-standard drafting mat for drawing boards.' }),

    // Books
    p('10105296', "We Are Each Other's Harvest", { cat: 'books', brand: 'Natalie Baszile', url: prod('/product/gm/10105296'), art: 'book', desc: 'Celebrating African American farmers, land and legacy.' })
  ];

  // Semester and summer hours (Mountain time). [open, close] in decimal hours; null = closed.
  const hours = {
    semester: { 1: [7.75, 17.5], 2: [7.75, 17.5], 3: [7.75, 17.5], 4: [7.75, 17.5], 5: [7.75, 17.5], 6: [10, 16.5], 0: null },
    summer:   { 1: [8, 16.5], 2: [8, 16.5], 3: [8, 16.5], 4: [8, 16.5], 5: [8, 16.5], 6: null, 0: null }
  };

  const STORE = { links, categories, products, hours };
  if (typeof module !== 'undefined' && module.exports) module.exports = STORE;
  else window.STORE = STORE;
})();
