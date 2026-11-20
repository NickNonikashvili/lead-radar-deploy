// Travel guide articles. `card` must match the title on the design's Travel Guide card; the
// article page lives at guide/<slug>.html. Update `reviewed` whenever you check an article.
export const REVIEWED = "20 November 2026";

export const ARTICLES = [
  {
    slug: "georgia-in-ten-points",
    card: "Georgia in ten points: what surprises first-time visitors",
    cat: "Start here",
    intro: "Money, SIM cards, the language, the food and why everyone wants to feed you. A five-minute read before you book anything.",
    body: [
      ["", [
        "<b>1. A guest is a gift from God.</b> Georgians say it and mean it. Expect to be fed, toasted and sent home with a bottle of somebody's grandfather's wine.",
        "<b>2. The alphabet is unique.</b> Thirty-three rounded letters you will see nowhere else on Earth. Gamarjoba means hello, madloba means thank you.",
        "<b>3. Wine is 8,000 years old here.</b> The oldest known traces of grape wine come from villages near Tbilisi, and families still make it in clay qvevri buried in the ground.",
        "<b>4. Cards work in cities, cash in villages.</b> The currency is the lari (GEL). Carry some cash for markets, guesthouses and the mountains.",
        "<b>5. A local SIM costs little.</b> Buy one at the airport with your passport, or use an eSIM. Coverage is good almost everywhere.",
        "<b>6. Khachapuri and khinkali come first.</b> Cheese bread with an egg on top, and soup dumplings you eat with your hands. Georgian cooking is also full of vegetarian dishes.",
        "<b>7. The supra has rules.</b> A feast is led by a tamada, the toastmaster. Wait for the toast before you drink your wine.",
        "<b>8. Churches have a dress code.</b> Cover shoulders and knees; women usually cover their hair. Scarves are often available at the door.",
        "<b>9. Distances are short, roads are slow.</b> Georgia is about the size of Ireland, but mountain roads wind. Plan two or three regions for a week, not six.",
        "<b>10. It feels safe and warm.</b> Georgia is widely regarded as a safe country for travellers. Many older people speak Russian, and more and more young people speak English.",
      ]],
    ],
  },
  {
    slug: "visa",
    card: "Do I need a visa for Georgia?",
    cat: "Before you go",
    intro: "Citizens of many countries, including the EU, UK and US, can visit without a visa. Here’s how to check yours.",
    body: [
      ["Visa-free for many countries", ["Citizens of around 95 countries — including the EU, the UK, the USA, Canada and Australia — can visit Georgia without a visa, most of them for up to a year. Your passport should be valid for the whole of your stay."]],
      ["If you need a visa", ["Visitors from other countries can usually apply online through Georgia's official e-visa portal. Allow a few weeks before you travel, and keep a copy of the visa with your passport."]],
      ["Check before you fly", ["Entry rules change from time to time. Always check the list on the website of Georgia's Ministry of Foreign Affairs, or ask the Georgian embassy in your country. If anything is unclear, tell us your nationality and we'll help you find the current rule.", "Comprehensive travel insurance, including medical cover, is required for every traveller on our journeys."]],
    ],
  },
  {
    slug: "airports",
    card: "Tbilisi, Kutaisi or Batumi: which airport?",
    cat: "Getting there",
    intro: "Three international airports, and which one makes sense for your route and budget.",
    body: [
      ["Tbilisi (TBS)", ["The main gateway, about 20 minutes from the city centre. Most full-service airlines fly here, with connections through Istanbul, Dubai, Doha, Warsaw, Munich and other hubs. The best choice if your trip starts in Tbilisi, Kakheti or Kazbegi."]],
      ["Kutaisi (KUT)", ["In western Georgia, served mainly by low-cost airlines with direct flights from many European cities. Kutaisi is a good start for Imereti, Svaneti and the canyons; the drive to Tbilisi takes about three and a half hours."]],
      ["Batumi (BUS)", ["On the Black Sea coast, with more flights in summer. Convenient for a trip that begins or ends at the sea."]],
      ["Flying in to one, out of another", ["Open-jaw tickets often save a day of driving — for example, arriving in Kutaisi and leaving from Tbilisi. Whichever airport you choose, we meet you at arrivals and see you off when you fly home."]],
    ],
  },
  {
    slug: "seasons",
    card: "When to go: seasons and weather",
    cat: "Before you go",
    intro: "Spring blossoms, summer in the mountains, the autumn harvest and winter skiing, region by region.",
    body: [
      ["Spring (April–May)", ["Green valleys, blossom and comfortable temperatures — lovely for Tbilisi, Kakheti, the cave towns and the canyons. The high mountains still have snow."]],
      ["Summer (June–August)", ["The season for the high Caucasus: Kazbegi, Svaneti and Tusheti, whose only road opens roughly from mid-June to early October. Tbilisi can be hot in July and August, and the Black Sea is warm enough for swimming from June to September."]],
      ["Autumn (September–October)", ["Many people's favourite: golden light, mild days and the grape harvest, rtveli, in Kakheti. The mountains are still open until early October."]],
      ["Winter (November–March)", ["Skiing in Gudauri and Svaneti, quiet snowy monasteries and cosy wine cellars. The road to Kazbegi can close for a few hours in storms, and Tusheti is cut off until spring."]],
    ],
  },
  {
    slug: "getting-around",
    card: "Getting around: drivers, trains and marshrutkas",
    cat: "Getting around",
    intro: "How locals travel, how long it takes and when a private driver is worth it.",
    body: [
      ["Private driver", ["The easiest way to see the country, and how all our journeys work: a driver who knows the roads, stops where you want and waits while you explore. Mountain roads are narrow and winding, and local driving can be lively, so we don't recommend renting a car for a first visit."]],
      ["Trains", ["Comfortable modern trains link Tbilisi with Batumi in about five hours, with slower services to Kutaisi and a scenic narrow-gauge line from Borjomi. Tickets sell out in summer, so book ahead."]],
      ["Marshrutkas", ["Minibuses that connect almost every town and village. They are cheap and frequent but crowded, with no fixed timetable on many routes — an adventure rather than a plan."]],
      ["In the cities", ["Taxis booked through ride-hailing apps are inexpensive in Tbilisi and Batumi, and Tbilisi has a metro. The old town is best explored on foot."]],
    ],
  },
  {
    slug: "money",
    card: "Money, cards and tipping",
    cat: "Money & connection",
    intro: "The Georgian lari, where cards work, cash for villages and how much to tip.",
    body: [
      ["The lari", ["Georgia's currency is the lari (GEL, ₾). Exchange offices in cities offer fair rates, and ATMs are easy to find in every town."]],
      ["Cards and cash", ["Cards and contactless payments work almost everywhere in cities, hotels and restaurants. Carry some cash for village guesthouses, markets, small shops and the mountains."]],
      ["Tipping", ["Many restaurants add a 10% service charge to the bill, so check before you tip. Otherwise, rounding up is appreciated but never expected. For guides and drivers, a tip at the end of the trip is a kind gesture, not an obligation."]],
    ],
  },
  {
    slug: "sim",
    card: "SIM cards and internet",
    cat: "Money & connection",
    intro: "Get a local SIM at the airport in minutes, or use an eSIM. Coverage is good almost everywhere.",
    body: [
      ["A local SIM", ["The main mobile networks have desks at Tbilisi airport and shops in every town. Bring your passport; a SIM with plenty of data costs little and works in minutes."]],
      ["eSIM", ["If your phone supports eSIM, you can buy a Georgian or regional data plan online before you fly and be connected the moment you land."]],
      ["Coverage", ["Mobile internet is fast in towns and along the main roads. In remote mountain valleys like Tusheti, coverage is patchy — part of the charm. Most hotels, cafés and guesthouses have Wi-Fi."]],
    ],
  },
  {
    slug: "safety",
    card: "Staying safe and emergency numbers",
    cat: "Safety",
    intro: "Georgia is considered safe for travellers. What to know on the road and in the mountains.",
    body: [
      ["A safe, welcoming country", ["Georgia is widely regarded as a safe destination, and violent crime against visitors is rare. Use the same common sense as anywhere: keep an eye on your belongings in crowded places and use registered taxis at night."]],
      ["Emergency number", ["Dial 112 for police, ambulance or fire. On our journeys, our team is reachable 24/7, and your guide is with you on the road."]],
      ["In the mountains", ["Mountain weather changes fast and roads wind — which is why we drive. Bring warm layers even in summer, and follow your guide's advice on trails and river crossings."]],
      ["Before you go", ["Check your own government's travel advice before you travel. Two regions, Abkhazia and Samachablo (South Ossetia), are not under the control of the Georgian government and can't be visited from Georgia."]],
    ],
  },
  {
    slug: "supra",
    card: "Supra etiquette: toasts and the tamada",
    cat: "Culture",
    intro: "What happens at a Georgian feast, when to drink and how to say no politely.",
    body: [
      ["The tamada", ["Every supra — a Georgian feast — is led by a tamada, the toastmaster. He or she proposes toasts in a traditional order: to peace, to the ancestors, to friendship, to the guests and much more. A supra can last all night. Pace yourself."]],
      ["How to toast", ["Wait for the tamada's toast before you drink your wine, then raise your glass: gaumarjos, cheers! Never toast with beer — that is traditionally reserved for enemies. If you'd rather not drink, a sip, or water, is perfectly fine; a polite no is always respected."]],
      ["At the table", ["Dishes keep arriving and plates are stacked on top of each other — it's a sign of generosity, not a mistake. Eat khinkali with your hands: hold the knot, bite, sip the broth, then eat the rest, and leave the knot on your plate."]],
    ],
  },
  {
    slug: "packing",
    card: "What to pack (and what to wear in churches)",
    cat: "Before you go",
    intro: "Layers for the mountains, comfortable shoes and a scarf for monasteries.",
    body: [
      ["Clothes", ["Bring layers: days can be warm and nights cool, especially in the mountains, where you'll want a fleece and a light rain jacket even in summer. Comfortable walking shoes are essential for old towns and trails."]],
      ["For churches and monasteries", ["Cover shoulders and knees. Women usually cover their hair, so a light scarf is handy; scarves and wraps are often available at the door. Men take off their hats."]],
      ["Useful extras", ["Sun protection, a refillable water bottle and a power adapter for European two-pin plugs (types C and F, 220 V). Medicines you need, with a copy of the prescription."]],
    ],
  },
];
