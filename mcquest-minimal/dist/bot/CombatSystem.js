import pathfinderModule from 'mineflayer-pathfinder';
const { goals } = pathfinderModule;
export class CombatSystem {
    constructor(bot) {
        this.isActive = false;
        this.currentTarget = null;
        this.lastAttacker = null;
        this.combatLoop = null;
        this.recentAttackers = new Set();
        this.autoStopAfterKill = true; // New setting to auto-stop after killing target
        this.bot = bot;
        this.settings = {
            aggressiveMode: false,
            selfDefenseMode: true,
            targetPlayers: false,
            targetMobs: true,
            maxAttackDistance: 4,
            fleeWhenLowHealth: true,
            healthThreshold: 6,
            retaliationEnabled: true
        };
        this.setupEventListeners();
    }
    setupEventListeners() {
        try {
            // Listen for damage
            this.bot.on('health', () => {
                try {
                    if (this.bot.health <= this.settings.healthThreshold && this.settings.fleeWhenLowHealth) {
                        this.flee();
                    }
                }
                catch (e) {
                    console.error('[combat] Health event error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Listen for when bot takes damage
            this.bot.on('entityHurt', (entity) => {
                try {
                    if (entity === this.bot.entity) {
                        this.onTakeDamage();
                    }
                }
                catch (e) {
                    console.error('[combat] EntityHurt event error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Monitor nearby entities (safer approach)
            this.bot.on('entitySpawn', (entity) => {
                try {
                    if (!entity || !this.bot.entity)
                        return;
                    if (this.shouldTargetEntity(entity) && this.isActive) {
                        const distance = this.bot.entity.position.distanceTo(entity.position);
                        if (distance <= this.settings.maxAttackDistance + 5) {
                            // Consider this as a potential target
                            if (!this.currentTarget || distance < this.bot.entity.position.distanceTo(this.currentTarget.position)) {
                                this.currentTarget = entity;
                            }
                        }
                    }
                }
                catch (e) {
                    console.error('[combat] EntitySpawn event error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Listen for entity death/removal
            this.bot.on('entityGone', (entity) => {
                try {
                    if (entity === this.currentTarget) {
                        console.log(`[combat] Target ${entity.username || entity.name || 'entity'} died or left. Stopping combat.`);
                        this.stopCombatAfterKill();
                    }
                }
                catch (e) {
                    console.error('[combat] EntityGone event error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Listen for bot death
            this.bot.on('death', () => {
                try {
                    console.log('[combat] Bot died. Stopping combat until next attack.');
                    this.stopCombatAfterDeath();
                }
                catch (e) {
                    console.error('[combat] Death event error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Listen for bot respawn
            this.bot.on('spawn', () => {
                try {
                    console.log('[combat] Bot respawned. Combat will only restart if attacked.');
                    // Reset but don't auto-activate combat
                    this.currentTarget = null;
                }
                catch (e) {
                    console.error('[combat] Spawn event error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Remove physicsTick listener as it's too frequent and causes crashes
            // We'll use the interval-based combat loop instead
        }
        catch (e) {
            console.error('[combat] Event listener setup error:', e instanceof Error ? e.message : String(e));
        }
    }
    enableCombatMode(settings) {
        if (settings) {
            this.settings = { ...this.settings, ...settings };
        }
        this.isActive = true;
        this.startCombatLoop();
        const mode = this.settings.aggressiveMode ? 'aggressive' :
            this.settings.selfDefenseMode ? 'defensive' : 'passive';
        console.log(`[combat] Combat mode enabled: ${mode}`);
        return `Combat system activated in ${mode} mode`;
    }
    disableCombatMode() {
        this.isActive = false;
        this.currentTarget = null;
        if (this.combatLoop) {
            clearInterval(this.combatLoop);
            this.combatLoop = null;
        }
        console.log('[combat] Combat mode disabled');
        return 'Combat system deactivated';
    }
    enableAggressiveMode(targetPlayer) {
        this.settings.aggressiveMode = true;
        this.settings.targetPlayers = true;
        this.isActive = true;
        if (targetPlayer) {
            this.setSpecificTarget(targetPlayer);
        }
        this.startCombatLoop();
        console.log('[combat] AGGRESSIVE MODE ACTIVATED - READY TO FIGHT!');
        return `Aggressive mode enabled${targetPlayer ? ` targeting ${targetPlayer}` : ''}`;
    }
    enableRetaliationMode() {
        this.settings.retaliationEnabled = true;
        this.settings.selfDefenseMode = true;
        this.isActive = true;
        console.log('[combat] Retaliation mode - I will fight back if attacked!');
        return 'Retaliation mode enabled - bot will fight back when attacked';
    }
    startCombatLoop() {
        if (this.combatLoop) {
            clearInterval(this.combatLoop);
        }
        this.combatLoop = setInterval(() => {
            this.updateCombat();
        }, 100); // Update every 100ms for responsive combat
    }
    updateCombat() {
        try {
            if (!this.isActive || !this.bot.entity)
                return;
            // Check for new targets
            if (!this.currentTarget || !this.isValidTarget(this.currentTarget)) {
                this.currentTarget = this.findBestTarget();
            }
            // Attack current target
            if (this.currentTarget) {
                this.attackTarget(this.currentTarget);
            }
            // Scan for threats if in aggressive mode
            if (this.settings.aggressiveMode) {
                this.scanForTargets();
            }
        }
        catch (e) {
            console.error('[combat] updateCombat error:', e instanceof Error ? e.message : String(e));
        }
    }
    onTakeDamage() {
        try {
            if (!this.settings.retaliationEnabled && !this.settings.selfDefenseMode)
                return;
            if (!this.bot.entity)
                return;
            console.log('[combat] Bot took damage! Looking for attacker...');
            // Try to identify attacker
            const nearbyEntities = Object.values(this.bot.entities)
                .filter(entity => {
                if (!entity || entity === this.bot.entity || !entity.position)
                    return false;
                try {
                    const distance = this.bot.entity.position.distanceTo(entity.position);
                    return distance <= 10;
                }
                catch (e) {
                    return false;
                }
            })
                .sort((a, b) => {
                try {
                    const distA = this.bot.entity.position.distanceTo(a.position);
                    const distB = this.bot.entity.position.distanceTo(b.position);
                    return distA - distB;
                }
                catch (e) {
                    return 0;
                }
            });
            if (nearbyEntities.length > 0) {
                const attacker = nearbyEntities[0];
                if (attacker.type === 'player' && attacker.username) {
                    this.lastAttacker = attacker.username;
                    this.recentAttackers.add(this.lastAttacker);
                    console.log(`[combat] ${this.lastAttacker} attacked me! Retaliating!`);
                }
                this.currentTarget = attacker;
                this.isActive = true;
                this.startCombatLoop();
                console.log(`[combat] Found attacker: ${attacker.username || attacker.name || 'unknown'} (${attacker.type})`);
            }
            else {
                console.log('[combat] No nearby entities found as potential attackers');
            }
        }
        catch (e) {
            console.error('[combat] onTakeDamage error:', e instanceof Error ? e.message : String(e));
        }
    }
    findBestTarget() {
        const entities = Object.values(this.bot.entities);
        const potentialTargets = [];
        for (const entity of entities) {
            if (!this.shouldTargetEntity(entity))
                continue;
            const distance = this.bot.entity.position.distanceTo(entity.position);
            if (distance > this.settings.maxAttackDistance + 5)
                continue;
            const threatLevel = this.calculateThreatLevel(entity);
            potentialTargets.push({
                entity,
                distance,
                threatLevel,
                isPlayer: entity.type === 'player'
            });
        }
        // Sort by threat level (highest first)
        potentialTargets.sort((a, b) => b.threatLevel - a.threatLevel);
        return potentialTargets.length > 0 ? potentialTargets[0].entity : null;
    }
    shouldTargetEntity(entity) {
        try {
            if (!entity || entity === this.bot.entity || !entity.position)
                return false;
            // Check if entity is a player
            if (entity.type === 'player') {
                if (!this.settings.targetPlayers)
                    return false;
                // Always target recent attackers
                if (entity.username && this.recentAttackers.has(entity.username))
                    return true;
                // In aggressive mode, target all players
                return this.settings.aggressiveMode;
            }
            // Check if entity is a hostile mob
            if (this.settings.targetMobs && entity.name) {
                const hostileMobs = [
                    'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
                    'witch', 'vindicator', 'pillager', 'evoker'
                ];
                return hostileMobs.some(mob => entity.name?.includes(mob));
            }
            return false;
        }
        catch (e) {
            return false;
        }
    }
    calculateThreatLevel(entity) {
        let threat = 0;
        // Base threat for different entity types
        if (entity.type === 'player') {
            threat += 100;
            // Higher threat for recent attackers
            if (this.recentAttackers.has(entity.username || '')) {
                threat += 200;
            }
        }
        else {
            // Mob threat levels
            const mobThreats = {
                'creeper': 150,
                'skeleton': 80,
                'zombie': 60,
                'spider': 40,
                'enderman': 120
            };
            for (const [mobType, value] of Object.entries(mobThreats)) {
                if (entity.name?.includes(mobType)) {
                    threat += value;
                    break;
                }
            }
        }
        // Distance factor (closer = higher threat)
        const distance = this.bot.entity.position.distanceTo(entity.position);
        threat += Math.max(0, 50 - distance * 5);
        return threat;
    }
    isValidTarget(entity) {
        try {
            if (!entity || !entity.position || !this.bot.entity)
                return false;
            // Check if entity still exists in bot.entities
            const entityExists = Object.values(this.bot.entities).includes(entity);
            if (!entityExists) {
                console.log('[combat] Target entity no longer exists, removing from targets.');
                return false;
            }
            const distance = this.bot.entity.position.distanceTo(entity.position);
            return distance <= this.settings.maxAttackDistance + 10;
        }
        catch (e) {
            return false;
        }
    }
    attackTarget(target) {
        try {
            if (!target || !target.position || !this.bot.entity)
                return;
            const distance = this.bot.entity.position.distanceTo(target.position);
            // Move closer if too far
            if (distance > this.settings.maxAttackDistance) {
                this.moveTowardsTarget(target);
                return;
            }
            // Look at target
            try {
                const targetPos = target.position.offset(0, target.height ? target.height * 0.5 : 1, 0);
                this.bot.lookAt(targetPos);
            }
            catch (e) {
                console.error('[combat] Failed to look at target:', e instanceof Error ? e.message : String(e));
                return;
            }
            // Attack
            try {
                this.bot.attack(target);
                console.log(`[combat] Attacked ${target.username || target.name || 'entity'} at distance ${distance.toFixed(1)}`);
                if (target.type === 'player' && target.username) {
                    console.log(`[combat] Attacking ${target.username}!`);
                }
            }
            catch (error) {
                console.error('[combat] Attack failed:', error instanceof Error ? error.message : String(error));
            }
        }
        catch (e) {
            console.error('[combat] attackTarget error:', e instanceof Error ? e.message : String(e));
        }
    }
    moveTowardsTarget(target) {
        const goal = new goals.GoalNear(target.position.x, target.position.y, target.position.z, this.settings.maxAttackDistance - 1);
        this.bot.pathfinder.setGoal(goal);
    }
    scanForTargets() {
        const entities = Object.values(this.bot.entities);
        for (const entity of entities) {
            if (!this.shouldTargetEntity(entity))
                continue;
            const distance = this.bot.entity.position.distanceTo(entity.position);
            if (distance <= 20 && entity.type === 'player') {
                console.log(`[combat] Player spotted: ${entity.username} at ${distance.toFixed(1)} blocks`);
            }
        }
    }
    flee() {
        console.log('[combat] Low health! Fleeing from combat!');
        // Stop current combat
        this.currentTarget = null;
        // Find escape direction (away from threats)
        const currentPos = this.bot.entity.position;
        let escapeX = currentPos.x;
        let escapeZ = currentPos.z;
        // Move away from nearby threats
        const threats = Object.values(this.bot.entities)
            .filter(entity => this.shouldTargetEntity(entity))
            .filter(entity => {
            const distance = this.bot.entity.position.distanceTo(entity.position);
            return distance <= 15;
        });
        for (const threat of threats) {
            const dx = currentPos.x - threat.position.x;
            const dz = currentPos.z - threat.position.z;
            escapeX += dx * 2;
            escapeZ += dz * 2;
        }
        // Move to escape position
        const goal = new goals.GoalBlock(Math.floor(escapeX), currentPos.y, Math.floor(escapeZ));
        this.bot.pathfinder.setGoal(goal);
        // Temporarily disable combat
        this.isActive = false;
        setTimeout(() => {
            if (this.bot.health > this.settings.healthThreshold) {
                this.isActive = true;
            }
        }, 10000); // Re-enable after 10 seconds
    }
    setSpecificTarget(playerName) {
        // Find specific player to target
        const targetEntity = Object.values(this.bot.entities)
            .find(entity => entity.type === 'player' &&
            entity.username?.toLowerCase() === playerName.toLowerCase());
        if (targetEntity) {
            this.currentTarget = targetEntity;
            console.log(`[combat] Targeting ${playerName} specifically!`);
        }
    }
    stopCombatAfterKill() {
        console.log('[combat] Target eliminated. Stopping combat mode.');
        this.currentTarget = null;
        this.isActive = false;
        if (this.combatLoop) {
            clearInterval(this.combatLoop);
            this.combatLoop = null;
        }
        // Clear recent attackers after a successful kill
        setTimeout(() => {
            this.recentAttackers.clear();
            console.log('[combat] Cleared attackers list after target elimination.');
        }, 5000); // Wait 5 seconds before clearing
    }
    stopCombatAfterDeath() {
        console.log('[combat] Bot died. Resetting combat state.');
        this.currentTarget = null;
        this.isActive = false;
        if (this.combatLoop) {
            clearInterval(this.combatLoop);
            this.combatLoop = null;
        }
        // Keep attackers list so bot remembers who killed it
        console.log('[combat] Keeping attackers list for revenge after respawn.');
    }
    // Public methods for external control
    getCombatStatus() {
        return {
            active: this.isActive,
            mode: this.settings.aggressiveMode ? 'aggressive' :
                this.settings.selfDefenseMode ? 'defensive' : 'passive',
            currentTarget: this.currentTarget?.username || this.currentTarget?.name || null,
            settings: { ...this.settings },
            recentAttackers: Array.from(this.recentAttackers)
        };
    }
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        return `Combat settings updated: ${JSON.stringify(newSettings)}`;
    }
    clearRecentAttackers() {
        this.recentAttackers.clear();
        console.log('[combat] Cleared recent attackers list');
        return 'Recent attackers list cleared';
    }
    attackPlayer(playerName) {
        const targetEntity = Object.values(this.bot.entities)
            .find(entity => entity.type === 'player' &&
            entity.username?.toLowerCase() === playerName.toLowerCase());
        if (!targetEntity) {
            return `Player ${playerName} not found`;
        }
        this.currentTarget = targetEntity;
        this.enableAggressiveMode(playerName);
        return `Now targeting and attacking ${playerName}!`;
    }
}
