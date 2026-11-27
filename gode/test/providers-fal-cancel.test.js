// fal: what a caller's Stop tells the pipeline. The cancel answer decides whether fal bills the job
// (200 OK: it left the queue unrun; 202 CANCELLATION_REQUESTED or 400 ALREADY_COMPLETED: billed), and
// the AbortError carries it as `upstreamBilled`. A job fal finished anyway hands back its result.
const { describe, it, before, after, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

const { loadConfig } = require("../src/config");
const { createFalProvider } = require("../src/providers/fal");
const { startMockUpstream } = require("./helpers/mock-upstream");

const KLEIN = {
  id: "fal:blackforestlabs/flux-3/klein/text-to-image", label: "FLUX.3 Klein", gateway: "fal",
  slug: "blackforestlabs/flux-3/klein/text-to-image", jobs: ["image"], enabled: true, price_unit: "image", price_per_unit: 0.009,
  params: { image_size: "square_hd", num_images: 1 },
};

describe("fal: stopping a submitted job", () => {
  let up;
  let fal;
  before(async () => {
    up = await startMockUpstream();
    fal = createFalProvider(loadConfig({ ...up.env, GODE_MOCK: "0", FAL_KEY: "fal-test-key", FAL_POLL_INTERVAL_MS: "20" }));
  });
  after(() => up.close());
  beforeEach(() => up.reset());

  /** Run a job and abort it on the first progress report that matches; resolve with the outcome. */
  async function stopOn(scenario, status) {
    up.setScenario(scenario);
    const ac = new AbortController();
    const progress = [];
    const p = fal.generateMedia({
      model: KLEIN,
      prompt: "a fox",
      signal: ac.signal,
      onProgress: (e) => {
        progress.push(e.status);
        if (e.status === status) ac.abort();
      },
    });
    try {
      return { result: await p, progress };
    } catch (err) {
      return { err, progress };
    }
  }

  it("queued: cancel 200 OK -> AbortError with upstreamBilled false", async () => {
    const { err } = await stopOn({ fal: { mode: "queued" } }, "queued");
    assert.equal(err.name, "AbortError");
    assert.equal(err.upstreamBilled, false);
    assert.equal(up.find("/cancel").length, 1);
  });

  it("running: cancel 202 CANCELLATION_REQUESTED -> upstreamBilled true", async () => {
    const { err } = await stopOn({ fal: { polls: 50 } }, "running");
    assert.equal(err.name, "AbortError");
    assert.equal(err.upstreamBilled, true);
  });

  it("cancel unreachable or 404: billed only if the job had been reported running", async () => {
    assert.equal((await stopOn({ fal: { mode: "queued", cancel: "error" } }, "queued")).err.upstreamBilled, false);
    assert.equal((await stopOn({ fal: { polls: 50, cancel: "error" } }, "running")).err.upstreamBilled, true);
    assert.equal((await stopOn({ fal: { polls: 50, cancel: "not_found" } }, "running")).err.upstreamBilled, true);
  });

  it("forced 202 while queued is still billed (fal says it started)", async () => {
    assert.equal((await stopOn({ fal: { mode: "queued", cancel: "requested" } }, "queued")).err.upstreamBilled, true);
  });

  it("ALREADY_COMPLETED: the finished result is fetched and returned instead of an abort", async () => {
    const { result, err } = await stopOn({ fal: { polls: 50, cancel: "completed" } }, "running");
    assert.equal(err, undefined, String(err));
    assert.equal(result.media.length, 1);
    assert.equal(result.units, 1);
  });

  it("an abort before the submit answered carries no billing verdict", async () => {
    up.setScenario({ fal: { mode: "queued" } });
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(fal.generateMedia({ model: KLEIN, prompt: "a fox", signal: ac.signal }), (e) => e.name === "AbortError" && e.upstreamBilled === undefined);
  });
});
