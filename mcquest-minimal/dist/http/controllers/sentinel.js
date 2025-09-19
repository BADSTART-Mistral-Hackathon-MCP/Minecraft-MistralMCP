import { respond } from '../response.js';
export function createSentinelController(gateway) {
    return {
        // Enable sentinel protection mode
        async enableSentinel(req, res) {
            try {
                const { protectedPlayer, settings } = req.body;
                if (!protectedPlayer || typeof protectedPlayer !== 'string') {
                    return respond.badRequest(res, 'protectedPlayer must be specified as a string');
                }
                // Validate settings if provided
                if (settings) {
                    if (settings.zoneRadius !== undefined) {
                        if (typeof settings.zoneRadius !== 'number' || settings.zoneRadius < 1 || settings.zoneRadius > 50) {
                            return respond.badRequest(res, 'Zone radius must be between 1 and 50');
                        }
                    }
                    if (settings.hungerThreshold !== undefined) {
                        if (typeof settings.hungerThreshold !== 'number' || settings.hungerThreshold < 1 || settings.hungerThreshold > 20) {
                            return respond.badRequest(res, 'Hunger threshold must be between 1 and 20');
                        }
                    }
                    if (settings.healthThreshold !== undefined) {
                        if (typeof settings.healthThreshold !== 'number' || settings.healthThreshold < 1 || settings.healthThreshold > 20) {
                            return respond.badRequest(res, 'Health threshold must be between 1 and 20');
                        }
                    }
                }
                const result = gateway.enableSentinel(protectedPlayer, settings);
                return respond.ok(res, { result, protectedPlayer, settings }, 'Sentinel protection enabled');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to enable sentinel mode');
            }
        },
        // Disable sentinel protection mode
        async disableSentinel(req, res) {
            try {
                const result = gateway.disableSentinel();
                return respond.ok(res, { result }, 'Sentinel protection disabled');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to disable sentinel mode');
            }
        },
        // Set zone defense
        async setZoneDefense(req, res) {
            try {
                const { center, radius } = req.body;
                if (!center || typeof center !== 'object') {
                    return respond.badRequest(res, 'center must be an object with x, y, z coordinates');
                }
                if (typeof center.x !== 'number' || typeof center.y !== 'number' || typeof center.z !== 'number') {
                    return respond.badRequest(res, 'center coordinates must be numbers');
                }
                if (!radius || typeof radius !== 'number' || radius < 1 || radius > 50) {
                    return respond.badRequest(res, 'radius must be a number between 1 and 50');
                }
                const result = gateway.setSentinelZoneDefense(center, radius);
                return respond.ok(res, { result, center, radius }, 'Zone defense established');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to set zone defense');
            }
        },
        // Get current position for zone setup
        async getCurrentPosition(req, res) {
            try {
                const position = gateway.position();
                return respond.ok(res, { position }, 'Current bot position');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to get position');
            }
        },
        // Get sentinel status
        async getSentinelStatus(req, res) {
            try {
                const status = gateway.getSentinelStatus();
                return respond.ok(res, { status }, 'Sentinel status retrieved');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to get sentinel status');
            }
        },
        // Update sentinel settings
        async updateSentinelSettings(req, res) {
            try {
                const settings = req.body;
                // Validate settings
                if (settings.zoneRadius !== undefined) {
                    if (typeof settings.zoneRadius !== 'number' || settings.zoneRadius < 1 || settings.zoneRadius > 50) {
                        return respond.badRequest(res, 'Zone radius must be between 1 and 50');
                    }
                }
                if (settings.hungerThreshold !== undefined) {
                    if (typeof settings.hungerThreshold !== 'number' || settings.hungerThreshold < 1 || settings.hungerThreshold > 20) {
                        return respond.badRequest(res, 'Hunger threshold must be between 1 and 20');
                    }
                }
                if (settings.healthThreshold !== undefined) {
                    if (typeof settings.healthThreshold !== 'number' || settings.healthThreshold < 1 || settings.healthThreshold > 20) {
                        return respond.badRequest(res, 'Health threshold must be between 1 and 20');
                    }
                }
                if (settings.autoEquipArmor !== undefined && typeof settings.autoEquipArmor !== 'boolean') {
                    return respond.badRequest(res, 'autoEquipArmor must be a boolean');
                }
                if (settings.autoEquipWeapon !== undefined && typeof settings.autoEquipWeapon !== 'boolean') {
                    return respond.badRequest(res, 'autoEquipWeapon must be a boolean');
                }
                if (settings.autoEat !== undefined && typeof settings.autoEat !== 'boolean') {
                    return respond.badRequest(res, 'autoEat must be a boolean');
                }
                if (settings.aggressiveMode !== undefined && typeof settings.aggressiveMode !== 'boolean') {
                    return respond.badRequest(res, 'aggressiveMode must be a boolean');
                }
                const result = gateway.updateSentinelSettings(settings);
                return respond.ok(res, { result, settings }, 'Sentinel settings updated');
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to update sentinel settings');
            }
        },
        // Quick protection setup - protect current player at current location
        async quickProtect(req, res) {
            try {
                const { playerName, radius = 10 } = req.body;
                if (!playerName || typeof playerName !== 'string') {
                    return respond.badRequest(res, 'playerName must be specified as a string');
                }
                if (typeof radius !== 'number' || radius < 1 || radius > 50) {
                    return respond.badRequest(res, 'radius must be a number between 1 and 50');
                }
                // Get current position for zone defense
                const position = gateway.position();
                // Enable sentinel with default settings
                const sentinelResult = gateway.enableSentinel(playerName, {
                    autoEquipArmor: true,
                    autoEquipWeapon: true,
                    autoEat: true,
                    aggressiveMode: false
                });
                // Set zone defense at current location
                const zoneResult = gateway.setSentinelZoneDefense(position, radius);
                return respond.ok(res, {
                    sentinelResult,
                    zoneResult,
                    position,
                    playerName,
                    radius
                }, `Quick protection enabled for ${playerName} at current location`);
            }
            catch (error) {
                return respond.error(res, error instanceof Error ? error.message : 'Failed to setup quick protection');
            }
        }
    };
}
