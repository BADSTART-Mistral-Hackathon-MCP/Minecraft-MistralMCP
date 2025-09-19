import dotenv from 'dotenv';
dotenv.config();
function ensure(name, value, fallback) {
    if (value && value.length > 0) {
        return value;
    }
    if (fallback !== undefined) {
        return fallback;
    }
    throw new Error(`Missing environment variable: ${name}`);
}
function parsePort(name, fallback) {
    const raw = process.env[name];
    if (!raw || raw.length === 0) {
        return fallback;
    }
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) {
        throw new Error(`Environment variable ${name} must be a number`);
    }
    return parsed;
}
export const config = {
    port: parsePort('PORT', 3003),
    bot: {
        host: ensure('MC_HOST', process.env.MC_HOST, 'localhost'),
        port: parsePort('MC_PORT', 25565),
        username: ensure('MC_USERNAME', process.env.MC_USERNAME, 'McQuestBot'),
        password: process.env.MC_PASSWORD || undefined,
        version: ensure('MC_VERSION', process.env.MC_VERSION, '1.21.1'),
    },
};
