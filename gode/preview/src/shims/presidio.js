"use strict";
// Stands in for src/redact/presidio.js. The preview has no Presidio analyzer (config has no
// PRESIDIO_ANALYZER_URL), so src/redact/index.js never creates a client: only the built-in
// recognizers run, exactly as on a server without Presidio. This module only has to load.

class PresidioError extends Error {
  constructor(message) {
    super(message);
    this.name = "PresidioError";
  }
}

function createPresidioClient() {
  throw new PresidioError("Presidio is not available in the browser preview");
}

module.exports = { createPresidioClient, PresidioError };
