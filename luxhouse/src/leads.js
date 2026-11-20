"use strict";

/**
 * Enquiry ("lead") storage: a JSON file on disk, written atomically and
 * serialized through a queue so concurrent requests cannot corrupt it.
 * Swap this module for a database when the volume outgrows a file.
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

const FILE = path.join(config.dataDir, "inquiries.json");
const TYPES = ["viewing", "contact", "valuation"];
const STATUSES = ["new", "contacted", "closed"];

let queue = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

async function readAll() {
  try {
    const raw = await fsp.readFile(FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err.code === "ENOENT") return [];
    throw err;
  }
}

async function writeAll(list) {
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
  const tmp = `${FILE}.${process.pid}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(list, null, 2));
  await fsp.rename(tmp, FILE);
}

function add(lead) {
  return enqueue(async () => {
    const list = await readAll();
    const record = Object.assign(
      { id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: "new", notes: "" },
      lead
    );
    list.unshift(record);
    await writeAll(list);
    return record;
  });
}

function list() {
  return enqueue(readAll);
}

function update(id, patch) {
  return enqueue(async () => {
    const all = await readAll();
    const item = all.find((x) => x.id === id);
    if (!item) return null;
    if (patch.status !== undefined && STATUSES.includes(patch.status)) item.status = patch.status;
    if (patch.notes !== undefined) item.notes = String(patch.notes).slice(0, 4000);
    item.updatedAt = new Date().toISOString();
    await writeAll(all);
    return item;
  });
}

function remove(id) {
  return enqueue(async () => {
    const all = await readAll();
    const next = all.filter((x) => x.id !== id);
    if (next.length === all.length) return false;
    await writeAll(next);
    return true;
  });
}

/** Make sure the data directory is writable before accepting enquiries. */
function selfCheck() {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.accessSync(config.dataDir, fs.constants.W_OK);
}

module.exports = { add, list, update, remove, selfCheck, TYPES, STATUSES, FILE };
