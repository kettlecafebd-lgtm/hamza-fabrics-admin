export class HttpError extends Error {
  constructor(status, message, { code, details, expose = status < 500 } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code || `HTTP_${status}`;
    this.details = details;
    this.expose = expose;
  }
}

export const badRequest = (message, details) => new HttpError(400, message, { code: 'BAD_REQUEST', details });
export const unauthorized = (message = 'Authentication required.') => new HttpError(401, message, { code: 'UNAUTHORIZED' });
export const forbidden = (message = 'Not allowed.') => new HttpError(403, message, { code: 'FORBIDDEN' });
export const notFound = (message = 'Not found.') => new HttpError(404, message, { code: 'NOT_FOUND' });
export const gone = (message, details) => new HttpError(410, message, { code: 'GONE', details });
export const badGateway = (message, details) => new HttpError(502, message, { code: 'UPSTREAM_ERROR', details });

/** Wraps an async route so rejected promises reach the express error handler. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default HttpError;
