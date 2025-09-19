import { respond } from '../response.js';
export const requireBot = (gateway) => (_req, res, next) => {
    if (!gateway.isReady()) {
        respond.unavailable(res);
        return;
    }
    next();
};
