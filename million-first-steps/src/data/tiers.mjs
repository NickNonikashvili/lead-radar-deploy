// The three ways to travel. Every tour is offered at all three levels;
// the itinerary stays the same, the car, beds and tables change.
export const TIERS = [
  {
    id: "wanderer",
    name: "Wanderer",
    tagline: "The real Georgia, on a sensible budget",
    summary:
      "Family guesthouses, home cooking and a driver-guide who knows every shortcut. Simple, warm and honest — the way most Georgians would host you.",
    vehicle: {
      title: "Comfortable hybrid sedan",
      text: "A Toyota Prius or similar for 1–3 guests, a Mercedes Sprinter minibus for larger parties. 4×4 Mitsubishi Delica on mountain roads.",
    },
    stay: {
      title: "Guesthouses & 2–3★ hotels",
      text: "Clean, characterful family-run guesthouses and small hotels — usually with the host's breakfast and a view thrown in.",
    },
    dining: {
      title: "Home cooking & family taverns",
      text: "Breakfast daily plus guesthouse dinners, roadside bakeries and the local taverns where drivers eat. Several dinners at your own pace.",
    },
    guide: {
      title: "English-speaking driver-guide",
      text: "One person who drives, explains and knows which village bakery is still warm at 8 a.m.",
    },
    extras: ["Entrance fees on the itinerary", "Bottled water in the car", "24/7 local phone support"],
  },
  {
    id: "explorer",
    name: "Explorer",
    tagline: "Boutique stays, great tables, a dedicated guide",
    summary:
      "Boutique hotels with views, celebrated local restaurants and wineries, a licensed guide plus a separate driver. Our most popular way to travel.",
    vehicle: {
      title: "Land Cruiser Prado or Mercedes Vito",
      text: "Spacious, air-conditioned and 4×4 where the road demands it. Room for luggage, cameras and the wine you will buy.",
    },
    stay: {
      title: "Boutique 3–4★ hotels",
      text: "Hand-picked boutique hotels with personality — restored merchant houses in Tbilisi, mountain lodges with big windows, winery stays in Kakheti.",
    },
    dining: {
      title: "Celebrated local restaurants",
      text: "Breakfast and dinner daily at the places locals book for birthdays, winery lunches, and a hands-on khinkali and khachapuri cooking class.",
    },
    guide: {
      title: "Licensed guide + driver",
      text: "A professional guide focused entirely on you, and a driver focused entirely on the road.",
    },
    extras: ["Two winery tastings", "Cooking class", "Airport transfers", "Entrance fees", "24/7 local support"],
  },
  {
    id: "golden-fleece",
    name: "Golden Fleece",
    tagline: "The finest Georgia has to offer — privately",
    summary:
      "Five-star and design hotels, chef's tables, a private supra with polyphonic singers and a senior expert guide. Named after the treasure the Argonauts sailed here for.",
    vehicle: {
      title: "Mercedes V-Class or Land Cruiser 300",
      text: "Chauffeur-driven, with Wi-Fi, chilled water and snacks on board. Domestic flights or helicopter transfers on request, where they operate.",
    },
    stay: {
      title: "The finest 5★ & design hotels",
      text: "The best hotels available on your route — and the best rooms in them. Where no luxury hotel exists, the finest guesthouse, privately booked.",
    },
    dining: {
      title: "Chef's tables & a private supra",
      text: "All meals included: tasting menus, rare qvevri wines with the winemakers who made them, and a private supra with a tamada and polyphonic singers.",
    },
    guide: {
      title: "Senior expert guide",
      text: "A historian or sommelier-guide matched to your interests, a chauffeur, and a concierge on call around the clock.",
    },
    extras: ["Private tastings & after-hours visits where possible", "VIP airport service where available", "All meals & house wines", "Personal concierge"],
  },
];

export const TIER_BY_ID = Object.fromEntries(TIERS.map((t) => [t.id, t]));

// Included in every tier.
export const ALWAYS_INCLUDED = [
  "Private vehicle and driver for the whole trip — no shared coaches",
  "All accommodation, with breakfast",
  "Entrance fees for every site on the itinerary",
  "Airport pick-up and drop-off",
  "24/7 support from our team in Georgia",
];
export const NOT_INCLUDED = ["International flights", "Travel insurance (required)", "Personal expenses and souvenirs", "Tips — always optional"];
