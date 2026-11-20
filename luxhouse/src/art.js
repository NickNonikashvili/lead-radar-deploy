"use strict";

/**
 * Art direction: which photographs a residence is shown with, and how they are framed.
 *
 * Everything here works from the photographs a listing actually has (their proportions come
 * from content/generated/media.json), so a new listing looks right without any extra work.
 * Hand-picked frames and focal points are optional. They live under "art" in site.config.json,
 * keyed by listing slug; a listing file may carry the same object as its own "art" field, which
 * then wins:
 *
 *   "art": {
 *     "<slug>": {
 *       "hero":  { "focus": "50% 20%", "focusNarrow": "80% 50%" },
 *       "reel":  [{ "photo": "04", "focus": "50% 59%" }],
 *       "stage": { "photo": "06", "light": "70% 52%", "enter": "73% 46%", "floor": "74.5% 73%",
 *                  "lightNarrow": "60% 50%", "originNarrow": "66%" },
 *       "band":  { "photo": "02", "focus": "50% 30%" }
 *     }
 *   }
 *
 * "photo" is a photo file id of the listing ("01", "02", ...); positions are CSS percentages
 * measured from the left and the top of the photograph.
 */

const config = require("./config");

const POSITION = /^\d{1,3}(?:\.\d+)?% \d{1,3}(?:\.\d+)?%$/;
const PERCENT = /^\d{1,3}(?:\.\d+)?%$/;

function position(value, fallback) {
  return typeof value === "string" && POSITION.test(value.trim()) ? value.trim() : fallback;
}

function percent(value, fallback) {
  return typeof value === "string" && PERCENT.test(value.trim()) ? value.trim() : fallback;
}

function artOf(view) {
  return Object.assign({}, config.art[view.slug], view.raw && view.raw.art);
}

function photoMap(view) {
  return new Map(view.photos.map((p) => [p.file, p]));
}

/** The four shapes the photographs come in. */
function shape(photo) {
  const ratio = photo.w / photo.h;
  if (ratio >= 1.45) return "scope"; // 3:2 and wider: professional frames
  if (ratio >= 1.15) return "landscape"; // 4:3
  if (ratio >= 0.9) return "square";
  return "portrait"; // 3:4 phone frames
}

const upright = (photo) => shape(photo) === "portrait";

const REEL_SIZES = { 1: "100vw", 2: "(min-width: 900px) 50vw, 84vw", 3: "(min-width: 900px) 34vw, 60vw" };
const CARD_SIZES = { 1: "(min-width: 900px) 50vw, 100vw", 2: "(min-width: 900px) 25vw, 50vw" };

/**
 * The stills of one residence, as a strip that fills a wide band whatever the photographs are:
 * one landscape professional frame runs alone, 4:3 and square frames run as a pair, portrait
 * frames as three. `compact` is the small card: one frame, or two when they are portrait.
 *
 * Returns { form: 1 | 2 | 3, frames: [{ photo, focus, sizes }] }.
 */
function reel(view, opts = {}) {
  const compact = Boolean(opts.compact);
  const photos = view.photos;
  const byFile = photoMap(view);
  const first = view.cover || photos[0];

  let frames = (Array.isArray(artOf(view).reel) ? artOf(view).reel : [])
    .map((f) => ({ photo: byFile.get(String(f && f.photo)), focus: f && f.focus }))
    .filter((f) => f.photo);

  if (!frames.length) {
    const kind = shape(first);
    const wanted = kind === "scope" ? 1 : kind === "portrait" ? 3 : 2;
    const chosen = [first];
    // Frames of one strip share an orientation; a different room each time while the listing allows it.
    const fits = (p) => !chosen.includes(p) && upright(p) === upright(first) && (kind === "scope") === (shape(p) === "scope");
    for (const distinct of [true, false]) {
      for (const p of photos) {
        if (chosen.length >= wanted) break;
        if (fits(p) && (!distinct || !chosen.some((c) => c.room === p.room))) chosen.push(p);
      }
    }
    frames = chosen.map((photo) => ({ photo, focus: "" }));
  }

  if (compact) frames = frames.slice(0, upright(frames[0].photo) && frames[1] && upright(frames[1].photo) ? 2 : 1);
  frames = frames.slice(0, 3);

  const form = frames.length;
  const sizes = (compact ? CARD_SIZES : REEL_SIZES)[form];
  // A lone landscape frame is cropped to a scope band: keep the ground rather than the sky.
  const fallback = form === 1 && !compact ? "50% 60%" : "50% 50%";
  return {
    form,
    frames: frames.map((f) => ({ photo: f.photo, focus: position(f.focus, fallback), sizes })),
  };
}

/** The opening photograph of a residence and where it should be held when it is cropped. */
function hero(view) {
  const a = artOf(view).hero || {};
  const photo = photoMap(view).get(String(a.photo)) || view.cover || view.photos[0];
  return { photo, focus: position(a.focus, "50% 40%"), focusNarrow: position(a.focusNarrow, "50% 50%") };
}

/** A second exterior view, for bands that sit beside text. */
function band(view) {
  const a = artOf(view).band || {};
  const cover = view.cover || view.photos[0];
  const photo =
    photoMap(view).get(String(a.photo)) ||
    view.photos.find((p) => p !== cover && p.room === "exterior" && !upright(p)) ||
    cover;
  return { photo, focus: position(a.focus, "50% 40%") };
}

const STAGE_ROOMS = ["living", "dining", "fireplace", "patio", "winterGarden", "terrace", "hall", "kitchen"];

/**
 * The lit room that leads into a residence's 3D tour: the photograph, where the light rests,
 * where the way in sits, and one thumbnail for each kind of space in the tour.
 * Returns null when the residence has no tour.
 */
function stage(view) {
  if (!view.hasTour || !view.tour) return null;
  const a = artOf(view).stage || {};
  const byFile = photoMap(view);
  const scenes = view.tour.scenes.filter((s) => byFile.has(s.photo));
  if (!scenes.length) return null;

  const scenePhotos = scenes.map((s) => byFile.get(s.photo));
  const photo =
    (a.photo && byFile.get(String(a.photo))) ||
    (view.raw && view.raw.showcasePhoto && byFile.get(String(view.raw.showcasePhoto))) ||
    STAGE_ROOMS.map((room) => scenePhotos.find((p) => p.room === room && !upright(p))).find(Boolean) ||
    STAGE_ROOMS.map((room) => scenePhotos.find((p) => p.room === room)).find(Boolean) ||
    scenePhotos[0];
  const scene = scenes.find((s) => s.photo === photo.file) || null;

  const seen = new Set();
  const spaces = [];
  for (const s of scenes) {
    const p = byFile.get(s.photo);
    if (!p.room || seen.has(p.room)) continue;
    seen.add(p.room);
    // The thumbnail of the room on stage is the frame on stage.
    const shown = p.room === photo.room && scene ? { s: scene, p: photo } : { s, p };
    spaces.push({ label: shown.p.roomLabel, photo: shown.p, url: `${view.tourUrl}#scene=${encodeURIComponent(shown.s.id)}`, current: p.room === photo.room });
  }

  const light = position(a.light, "60% 55%").split(" ");
  const enter = position(a.enter, "60% 50%").split(" ");
  const lightNarrow = position(a.lightNarrow, "60% 50%").split(" ");
  const floor = position(a.floor, `${enter[0]} 76%`).split(" ").map(parseFloat);
  return {
    photo,
    roomLabel: photo.roomLabel,
    url: scene ? `${view.tourUrl}#scene=${encodeURIComponent(scene.id)}` : view.tourUrl,
    count: view.tour.scenes.length,
    spaces: spaces.slice(0, 8),
    // Custom properties read by .stage in site.css.
    style: `--sx-d:${light[0]};--sy-d:${light[1]};--ex:${enter[0]};--ey:${enter[1]};--ox-m:${percent(a.originNarrow, "60%")};--sx-m:${lightNarrow[0]};--sy-m:${lightNarrow[1]}`,
    floor: { x: Math.round(floor[0] * 15), y: Math.round(floor[1] * 10) }, // in the 1500 x 1000 drawing
  };
}

module.exports = { reel, hero, band, stage, shape };
