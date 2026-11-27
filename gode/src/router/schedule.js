// In-process weekly learner run (LEARN_SCHEDULE=weekly).
//
// Gode runs as one process next to its SQLite file, which is also the only place the learner can
// read the routing log on hosts where a cron job can't mount the web service's disk (Render,
// Railway). So the server itself checks once an hour whether a scheduled run is due (none in the
// last 7 days, judged from the stored learn_runs rows, so a restart neither skips nor repeats a
// week), runs proposeRoutes, stores the run (source 'schedule') for the admin page, and applies the
// proposals only when LEARN_AUTO_APPLY is on. Only counts and ids are logged.
"use strict";

const { proposeRoutes, applyProposals, recordLearnRun, listLearnRuns } = require("./learn");

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
// First check shortly after boot, not during it.
const FIRST_CHECK_MS = 60 * 1000;

/**
 * Start the weekly learner schedule when config.learn.schedule === 'weekly'.
 * @param {{ db: object, config: object, logger?: object, now?: () => number,
 *           checkIntervalMs?: number, firstCheckMs?: number }} deps  (now and the delays are test seams)
 * @returns {{ stop(): void, tick(): object|null }}  tick() runs one due-check now (returns the
 *   stored run when one ran, else null); with the schedule off both are no-ops
 */
function startLearnScheduler({ db, config, logger = console, now = Date.now, checkIntervalMs = CHECK_INTERVAL_MS, firstCheckMs = FIRST_CHECK_MS } = {}) {
  if (!config || !config.learn || config.learn.schedule !== "weekly") return { stop() {}, tick: () => null };
  if (!db) throw new TypeError("startLearnScheduler: db is required");

  const days = Math.max(1, Math.round(Number(config.learn.windowDays) || 28));
  const minSamples = Math.max(1, Math.round(Number(config.learn.minSamples) || 20));
  let running = false;

  function due() {
    const [last] = listLearnRuns(db, { limit: 1, source: "schedule" });
    return !last || now() - last.created_at >= WEEK_MS;
  }

  function tick() {
    if (running) return null;
    running = true;
    try {
      if (!due()) return null;
      const proposals = proposeRoutes(db, { minSamples, sinceMs: now() - days * DAY_MS });
      const applied = config.learn.autoApply && proposals.length ? applyProposals(db, proposals, { source: "learn" }) : 0;
      const id = recordLearnRun(db, { source: "schedule", days, proposals, applied });
      const what = config.learn.autoApply ? `${applied} applied` : "review them on the admin page";
      logger?.info?.(`[learn] weekly run ${id}: ${proposals.length} proposal${proposals.length === 1 ? "" : "s"}, ${what}`);
      return { id, proposals, applied };
    } catch (err) {
      // A failed run is retried at the next hourly check. Error names only: messages can quote SQL.
      logger?.warn?.(`[learn] weekly run failed (${err?.name || "error"})`);
      return null;
    } finally {
      running = false;
    }
  }

  // unref: the schedule never keeps the process (or a test, or a script) alive on its own.
  let interval = null;
  const first = setTimeout(() => {
    tick();
    interval = setInterval(tick, checkIntervalMs);
    interval.unref?.();
  }, firstCheckMs);
  first.unref?.();

  return {
    stop() {
      clearTimeout(first);
      if (interval) clearInterval(interval);
    },
    tick,
  };
}

module.exports = { startLearnScheduler, WEEK_MS };
