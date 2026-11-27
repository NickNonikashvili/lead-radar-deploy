"use strict";
// The `Buffer` global of Node, as far as the bundled modules use it: src/routes/validate.js asks
// Buffer.isBuffer(req.body) to refuse raw bodies. In the preview a request body is always parsed
// JSON (or {}), never a Buffer. The bundler passes this object to every module as `Buffer`.

module.exports = {
  isBuffer: () => false,
  byteLength: (s) => new TextEncoder().encode(String(s)).length,
  from() {
    throw new Error("preview: Buffer.from is not available in the browser preview");
  },
  alloc() {
    throw new Error("preview: Buffer.alloc is not available in the browser preview");
  },
};
