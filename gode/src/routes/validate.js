// Small request-validation helpers shared by the routers. Every failure is a 400 bad_request with a
// short message that is safe to show in the UI. Messages name fields, never echo the values (a
// value may be a prompt, a password or an email).
const { AppError } = require("../util");

function badRequest(message) {
  return new AppError(400, "bad_request", message);
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * The JSON body as a plain object. A missing body (no Content-Type, or an empty POST) counts as {}
 * so routes without fields accept a bare POST; arrays and scalars are refused.
 */
function bodyObject(req) {
  const body = req.body;
  if (body === undefined || body === null) return {};
  if (Buffer.isBuffer(body) || !isPlainObject(body)) throw badRequest("Request body must be a JSON object.");
  return body;
}

/** Refuse fields the route does not know, so a typo never silently does nothing. */
function onlyKeys(obj, allowed, where = "body") {
  const allow = new Set(allowed);
  for (const key of Object.keys(obj)) {
    if (!allow.has(key)) throw badRequest(`Unknown field "${String(key).slice(0, 40)}" in ${where}.`);
  }
}

/**
 * A string field. Returns the (optionally trimmed) string, or `null` when the field is absent or
 * null and not required.
 */
function stringField(value, name, { required = false, trim = true, min = required ? 1 : 0, max = 1000 } = {}) {
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${name} is required.`);
    return null;
  }
  if (typeof value !== "string") throw badRequest(`${name} must be a string.`);
  const s = trim ? value.trim() : value;
  if (s.length < min) throw badRequest(required && min === 1 ? `${name} is required.` : `${name} is too short.`);
  if (s.length > max) throw badRequest(`${name} is too long (at most ${max} characters).`);
  return s;
}

/** An id-shaped string (UUIDs, model ids). Optional ids return null when absent. */
function idField(value, name, { required = false, max = 200 } = {}) {
  const s = stringField(value, name, { required, max });
  if (s === null) return null;
  if (s === "") {
    if (required) throw badRequest(`${name} is required.`);
    return null;
  }
  return s;
}

function booleanField(value, name) {
  if (typeof value !== "boolean") throw badRequest(`${name} must be true or false.`);
  return value;
}

/** A finite number, or null when allowed. */
function numberField(value, name, { nullable = false, min = -Infinity, max = Infinity, integer = false } = {}) {
  if (value === null && nullable) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw badRequest(`${name} must be a number.`);
  if (integer && !Number.isInteger(value)) throw badRequest(`${name} must be a whole number.`);
  if (value < min || value > max) throw badRequest(`${name} must be between ${min} and ${max}.`);
  return value;
}

/** An integer query-string parameter in [min, max]; absent or empty gives the default. */
function intQuery(value, name, { min, max, dflt }) {
  if (value === undefined || value === "") return dflt;
  if (typeof value !== "string" || !/^\d{1,9}$/.test(value)) throw badRequest(`${name} must be a whole number.`);
  const n = Number(value);
  if (n < min || n > max) throw badRequest(`${name} must be between ${min} and ${max}.`);
  return n;
}

/** A query-string flag: "1"/"true" is on, absent/"0"/"false" is off, anything else is a 400. */
function flagQuery(value, name) {
  if (value === undefined || value === "" || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  throw badRequest(`${name} must be 1 or 0.`);
}

module.exports = {
  badRequest,
  isPlainObject,
  bodyObject,
  onlyKeys,
  stringField,
  idField,
  booleanField,
  numberField,
  intQuery,
  flagQuery,
};
