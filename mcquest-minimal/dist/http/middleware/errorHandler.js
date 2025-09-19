import { respond } from '../response.js';
export function notFound(_req, res) {
    respond.notFound(res);
}
export function errorHandler(err, _req, res, _next) {
    console.error('API error:', err);
    respond.error(res, err.message || 'Internal error');
}
