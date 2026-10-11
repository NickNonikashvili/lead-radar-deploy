// Photo slots. Every place the site can show a real photograph has an id here.
// Until a photo exists, the site shows its built-in illustration instead, so nothing ever looks broken.
//
// Ways to fill a slot (see CONTENT-SOURCES.md for the legal side):
//  1. Your own photo: save it as src/assets/photos/<id>.jpg (landscape, 2000px+ wide), then
//     run `npm run photos:optimize`. Add yourself to photo-credits.json if you like.
//  2. Wikimedia Commons: run `npm run photos:commons` — it searches each `commons` query, keeps only
//     freely licensed images (CC0, public domain, CC BY, CC BY-SA), downloads and optimises the best match
//     and records author + licence in photo-credits.json. Always review what it picked.
export const PHOTOS = {
  "region-tbilisi": { alt: "Old Tbilisi with Narikala fortress above the Mtkvari river", commons: "Narikala Tbilisi old town panorama" },
  "region-kazbegi": { alt: "Gergeti Trinity Church below Mount Kazbek", commons: "Gergeti Trinity Church Kazbek" },
  "region-svaneti": { alt: "Svan defensive towers in Ushguli", commons: "Ushguli Svan towers" },
  "region-kakheti": { alt: "Vineyards in the Alazani valley below the Caucasus", commons: "Alazani valley vineyards Kakheti" },
  "region-samtskhe": { alt: "The Vardzia cave monastery carved into the cliff", commons: "Vardzia cave monastery" },
  "region-colchis": { alt: "Gelati Monastery near Kutaisi", commons: "Gelati Monastery" },
  "region-adjara": { alt: "Batumi on the Black Sea coast", commons: "Batumi Botanical Garden sea view" },
  "region-tusheti": { alt: "The tower village of Dartlo in Tusheti", commons: "Dartlo Tusheti" },
  "region-dmanisi": { alt: "The Dmanisi archaeological site", commons: "Dmanisi archaeological site" },
  "history-skull": { alt: "Dmanisi Skull 5, a 1.8-million-year-old early human skull", commons: "Dmanisi skull D4500" },
  "history-qvevri": { alt: "Clay qvevri wine vessels", commons: "Qvevri Georgian wine vessel" },
  "history-tamar": { alt: "Medieval fresco of King Tamar at Vardzia", commons: "Tamar fresco Vardzia" },
  "history-gelati": { alt: "Mosaic of the Virgin in Gelati Monastery", commons: "Gelati mosaic" },
  "history-towers": { alt: "Medieval towers in Mestia, Svaneti", commons: "Mestia towers Svaneti" },
  "history-script": { alt: "Medieval Georgian manuscript", commons: "Georgian manuscript Nuskhuri" },
  "home-supra": { alt: "A Georgian supra feast table", commons: "Georgian supra feast table" },
  "about-founders": { alt: "The founders of Million First Steps" }, // your own photo only
};
