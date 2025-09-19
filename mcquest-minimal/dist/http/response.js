export const respond = {
    ok(res, data, message) {
        res.json({ success: true, message, data });
    },
    error(res, message, status = 500) {
        res.status(status).json({ success: false, error: message });
    },
    badRequest(res, message) {
        respond.error(res, message, 400);
    },
    unavailable(res, message = 'Bot unavailable') {
        respond.error(res, message, 503);
    },
    notFound(res, message = 'Not found') {
        respond.error(res, message, 404);
    },
};
