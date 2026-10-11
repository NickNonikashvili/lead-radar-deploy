// Photo slots. Every place the site can show a real photograph has an id here.
// Until a photo exists, the site shows its built-in illustration instead, so nothing ever looks broken.
//
// Ways to fill a slot (see CONTENT-SOURCES.md for the legal side):
//  1. Your own photo: save it as src/assets/photos/<id>.jpg (2000px+ wide), then run
//     `npm run photos:optimize`.
//  2. Wikimedia Commons: `npm run photos:commons` searches each `commons` query in order, keeps only
//     freely licensed images (CC0, public domain, CC BY, CC BY-SA), downloads and optimises the best
//     match and records author + licence in photo-credits.json. Always review what it picked.
//     Found a better one? Set `file: "File:<name on Commons>"` and run it again with --force.
//
// orientation: "any" allows portrait images (used where the photo is shown small or cropped square).
export const PHOTOS = {
  "region-tbilisi": { alt: "Old Tbilisi with Narikala fortress above the Mtkvari river", commons: ["Narikala Tbilisi old town panorama", "Tbilisi old town view"] },
  "region-kazbegi": { alt: "Gergeti Trinity Church below Mount Kazbek", commons: ["Gergeti Trinity Church Kazbek", "Gergeti Trinity Church"] },
  "region-svaneti": { alt: "Svan defensive towers in Ushguli", commons: ["Ushguli towers Shkhara", "Ushguli"] },
  "region-kakheti": { alt: "Vineyards in the Alazani valley below the Caucasus", commons: ["Alazani valley vineyards", "Kakheti vineyard Caucasus"] },
  "region-samtskhe": { alt: "The Vardzia cave monastery carved into the cliff", commons: ["Vardzia cave monastery", "Vardzia"] },
  "region-colchis": { alt: "Gelati Monastery near Kutaisi", commons: ["Gelati Monastery", "Gelati Monastery Kutaisi"] },
  "region-adjara": { alt: "Batumi on the Black Sea coast", commons: ["Batumi seaside panorama", "Batumi Botanical Garden"] },
  "region-tusheti": { alt: "The tower village of Dartlo in Tusheti", commons: ["Dartlo Tusheti", "Tusheti village towers"] },
  "region-dmanisi": { alt: "The Dmanisi archaeological site", commons: ["Dmanisi archaeological site", "Dmanisi"] },
  "history-skull": { alt: "Dmanisi Skull 5, a 1.8-million-year-old early human skull", commons: ["Dmanisi skull", "Dmanisi hominin"], orientation: "any", minWidth: 900 },
  "history-qvevri": { alt: "Clay qvevri wine vessels", commons: ["Qvevri", "Georgian qvevri wine"], orientation: "any", minWidth: 1000 },
  "history-tamar": { alt: "Medieval fresco of King Tamar at Vardzia", commons: ["Tamar fresco Vardzia", "Queen Tamar fresco"], orientation: "any", minWidth: 900 },
  "history-gelati": { alt: "Mosaic of the Virgin in Gelati Monastery", commons: ["Gelati mosaic Virgin", "Gelati Monastery mosaic"], orientation: "any", minWidth: 1000 },
  "history-towers": { alt: "Medieval towers in Mestia, Svaneti", commons: ["Mestia towers", "Svan towers Mestia"] },
  "history-script": { alt: "Medieval Georgian manuscript", commons: ["Georgian manuscript", "Asomtavruli inscription"], orientation: "any", minWidth: 900 },
  "about-founders": { alt: "The founders of Million First Steps" }, // your own photo only
};
