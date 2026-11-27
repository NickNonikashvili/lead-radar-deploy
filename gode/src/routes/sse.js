// Server-Sent Events for the chat routes.
//
// Framing: `event: <name>\ndata: <one line of JSON>\n\n`, plus a `: ping` comment every 15 s so
// proxies and browsers keep an idle stream open (a slow video job can sit in a queue for minutes).
// JSON.stringify escapes CR and LF inside strings, so every payload is exactly one data line.
//
// Disconnects: the pipeline gets an AbortSignal that fires when the client goes away before we
// finished. We listen on the RESPONSE's 'close' event, not the request's: since Node 16 the
// request emits 'close' as soon as its body has been read (express.json does that before the route
// runs), which would abort every stream immediately. res 'close' fires when the socket closes or
// after we end the response; `ended` tells the two apart.
const { AppError } = require("../util");

const DEFAULT_PING_MS = 15_000;
const EVENT_NAME_RE = /^[a-z][a-z_]{0,31}$/;
// Sent to streams still running when the server shuts down. The UI offers a retry for this code.
const SHUTDOWN_NOTICE = Object.freeze({ error: "The server is restarting. Try again in a moment.", code: "interrupted" });

/**
 * Switch `res` to an event stream.
 * @returns {{ send(event, data): boolean, end(): void, signal: AbortSignal, abort(reason?): void,
 *             readonly open: boolean }}
 */
function openEventStream(req, res, { pingMs = DEFAULT_PING_MS } = {}) {
  const controller = new AbortController();
  let ended = false;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no"); // nginx: don't buffer the stream
  res.flushHeaders();

  const writable = () => !ended && !res.writableEnded && !res.destroyed;

  const ping = setInterval(() => {
    if (writable()) res.write(": ping\n\n");
  }, pingMs);
  ping.unref?.();

  function onClose() {
    clearInterval(ping);
    if (ended) return;
    // The client left (or the socket died) before we finished: stop the work behind the stream.
    ended = true;
    controller.abort(new DOMException("The client disconnected.", "AbortError"));
  }
  res.on("close", onClose);

  /** Write one event. Returns false (and writes nothing) once the stream is over. */
  function send(event, data) {
    if (typeof event !== "string" || !EVENT_NAME_RE.test(event)) throw new TypeError(`sse: bad event name "${String(event)}"`);
    if (!writable()) return false;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data === undefined ? {} : data)}\n\n`);
    return true;
  }

  /** Finish the response normally. Safe to call more than once. */
  function end() {
    clearInterval(ping);
    if (ended) return;
    ended = true;
    res.off("close", onClose);
    if (!res.writableEnded && !res.destroyed) res.end();
  }

  /** Server-side cancel (shutdown): abort the work, then close the stream. */
  function abort(reason) {
    if (!controller.signal.aborted) {
      let r = reason;
      if (!r) {
        r = new DOMException("The server is shutting down.", "AbortError");
        // Tells the pipeline this is our restart, not the user's Stop (DOMException.code is a
        // read-only getter, hence a separate property).
        Object.defineProperty(r, "shutdown", { value: true });
      }
      controller.abort(r);
    }
    end();
  }

  return {
    send,
    end,
    abort,
    signal: controller.signal,
    get open() {
      return writable();
    },
  };
}

/**
 * Registry of the streams that are running, so a graceful shutdown can abort them (the pipeline
 * then releases its credit holds) and wait for that cleanup before the database closes.
 */
function createStreamTracker() {
  const active = new Set(); // { stream, emit, done: Promise }

  return {
    /** emit: the stream's guarded emitter (at most one error event per stream). */
    track(stream, emit, done) {
      const entry = { stream, emit, done };
      active.add(entry);
      done.finally(() => active.delete(entry)).catch(() => {});
    },
    get size() {
      return active.size;
    },
    /** Tell every running stream, abort it, and wait (at most timeoutMs) for its pipeline to settle. */
    async drain({ timeoutMs = 5000 } = {}) {
      const entries = [...active];
      for (const e of entries) {
        e.emit("error", SHUTDOWN_NOTICE);
        e.stream.abort();
      }
      if (!entries.length) return;
      let timer;
      const timeout = new Promise((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref?.();
      });
      await Promise.race([Promise.allSettled(entries.map((e) => e.done)), timeout]);
      clearTimeout(timer);
    },
  };
}

/**
 * Run the chat pipeline behind an event stream. Call only after all pre-stream validation passed:
 * from here on, failures are SSE `error` events, never HTTP statuses.
 *
 * @param {object} opts
 * @param {import('express').Request} opts.req
 * @param {import('express').Response} opts.res
 * @param {{ run: Function }} opts.pipeline
 * @param {object} opts.args      run() arguments without emit/signal
 * @param {ReturnType<typeof createStreamTracker>} [opts.tracker]
 * @param {number} [opts.pingMs]
 * @param {(req, err) => void} [opts.logError]  logs ids/codes/stack only, never text
 */
async function streamPipeline({ req, res, pipeline, args, tracker, pingMs, logError }) {
  const stream = openEventStream(req, res, { pingMs });
  let errorSent = false;
  const emit = (event, data) => {
    if (event === "error") {
      // One error per stream: the first one is the real cause.
      if (errorSent) return false;
      errorSent = true;
    }
    return stream.send(event, data);
  };

  const done = (async () => {
    try {
      await pipeline.run({ ...args, emit, signal: stream.signal });
    } catch (err) {
      // The pipeline reports its own failures as `error` events; this is for what it didn't catch.
      if (stream.signal.aborted) return; // client gone or shutdown: nobody to tell
      // An AppError's message is written for users (no internals), so pass it on. Anything else is
      // a bug: log it (without its message, which could quote content) and say something generic.
      const known = err instanceof AppError;
      if (!known) logError?.(req, err);
      // No-op when the pipeline already emitted its own error event.
      emit("error", known ? { error: err.message, code: err.code } : { error: "Something went wrong.", code: "internal" });
    } finally {
      stream.end();
    }
  })();

  tracker?.track(stream, emit, done);
  return done;
}

module.exports = { openEventStream, streamPipeline, createStreamTracker, DEFAULT_PING_MS, SHUTDOWN_NOTICE };
