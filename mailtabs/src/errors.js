'use strict';

/**
 * An error that maps directly to an HTTP response.
 * throw new HttpError(400, 'Human readable message', 'MACHINE_CODE')
 */
class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.expose = true;
  }
}

module.exports = { HttpError };
