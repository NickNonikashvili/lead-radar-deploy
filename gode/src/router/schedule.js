// In-process weekly learner run (LEARN_SCHEDULE=weekly).
// Placeholder with the final interface; the routing engineer fills in the implementation.
"use strict";

/**
 * Start the weekly learner schedule when config.learn.schedule === 'weekly'.
 * @param {{ db: object, config: object, logger?: object }} deps
 * @returns {{ stop(): void }}
 */
function startLearnScheduler({ db, config, logger = console } = {}) {
  void db;
  void logger;
  if (!config || !config.learn || config.learn.schedule !== "weekly") return { stop() {} };
  return { stop() {} };
}

module.exports = { startLearnScheduler };
