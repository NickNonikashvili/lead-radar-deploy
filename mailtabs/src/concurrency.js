'use strict';

/**
 * Small concurrency limits for work that holds a lot of memory while it runs (downloading whole
 * message sources): callers beyond the limit wait their turn instead of all running at once.
 */

/** Run at most `max` tasks at once; the others wait (first come, first served). */
function createLimiter(max) {
  const limit = Math.max(1, Math.floor(Number(max)) || 1);
  let active = 0;
  const waiting = [];
  const next = () => {
    while (active < limit && waiting.length) {
      const { fn, resolve, reject } = waiting.shift();
      active += 1;
      // The slot is free (and the next task started) before the caller hears the result.
      const settle = (done, value) => {
        active -= 1;
        next();
        done(value);
      };
      Promise.resolve()
        .then(fn)
        .then(
          (value) => settle(resolve, value),
          (err) => settle(reject, err)
        );
    }
  };
  const run = (fn) =>
    new Promise((resolve, reject) => {
      waiting.push({ fn, resolve, reject });
      next();
    });
  run.pending = () => active + waiting.length;
  return run;
}

/** createLimiter with its own limit per key (e.g. per user); idle keys are forgotten. */
function createKeyedLimiter(max) {
  const byKey = new Map();
  return (key, fn) => {
    let limiter = byKey.get(key);
    if (!limiter) {
      limiter = createLimiter(max);
      byKey.set(key, limiter);
    }
    return limiter(fn).finally(() => {
      if (byKey.get(key) === limiter && limiter.pending() === 0) byKey.delete(key);
    });
  };
}

module.exports = { createLimiter, createKeyedLimiter };
