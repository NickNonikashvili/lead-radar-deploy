// How each tour appears on cards (home and tours page): photo, filters and the route line.
// Photos under img/ came with the design; photos/ are ours (credits in photo-credits.json).
export const CARDS = {
  "footsteps-of-the-first-europeans": {
    img: "img/vardzia.webp",
    alt: "Vardzia cave monastery carved into the cliff above the valley",
    stops: ["Tbilisi", "Dmanisi", "Vardzia", "Kutaisi"],
    seasons: ["spring", "summer", "autumn"],
    featured: true,
  },
  "the-grand-journey": {
    img: "img/kazbegi-gergeti.webp",
    alt: "Gergeti Trinity Church below Mount Kazbek",
    stops: ["Tbilisi", "Kazbegi", "Svaneti", "Kakheti"],
    seasons: ["spring", "summer", "autumn"],
    featured: true,
  },
  "cradle-of-wine": {
    img: "photos/region-kakheti-800.webp",
    alt: "Vineyards in Kakheti with mountains behind",
    stops: ["Telavi", "Tsinandali", "Sighnaghi", "David Gareja"],
    seasons: ["spring", "summer", "autumn", "winter"],
    featured: true,
  },
  "into-the-high-caucasus": {
    img: "photos/region-svaneti-800.webp",
    alt: "Svan towers in a high valley of the Caucasus",
    stops: ["Kazbegi", "Kutaisi", "Mestia", "Ushguli"],
    seasons: ["summer", "autumn"],
  },
  "tusheti-the-last-road": {
    img: "photos/tour-tusheti-800.webp",
    alt: "The dirt road winding along a mountain valley towards Tusheti",
    stops: ["Telavi", "Abano Pass", "Omalo", "Dartlo"],
    seasons: ["summer"],
  },
  "tbilisi-and-the-ancient-capital": {
    img: "photos/region-tbilisi-800.webp",
    alt: "Old Tbilisi in the evening light",
    stops: ["Tbilisi", "Mtskheta", "Ananuri", "Gudauri"],
    seasons: ["spring", "summer", "autumn", "winter"],
  },
  "colchis-and-the-black-sea": {
    img: "img/martvili.webp",
    alt: "Turquoise water in Martvili Canyon",
    stops: ["Kutaisi", "Martvili", "Vani", "Batumi"],
    seasons: ["spring", "summer", "autumn"],
  },
};

/** Duration bucket used by the tours page filter. */
export const durationBucket = (d) => (d <= 1 ? "1" : d <= 4 ? "2-4" : d <= 7 ? "5-7" : "8+");
