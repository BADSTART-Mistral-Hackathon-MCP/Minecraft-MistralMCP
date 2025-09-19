import pathfinderModule from 'mineflayer-pathfinder';
const { goals } = pathfinderModule;
export class SentinelSystem {
    constructor(bot) {
        this.isActive = false;
        this.monitoringLoop = null;
        this.protectedPlayerEntity = null;
        this.threats = new Set();
        this.lastEatTime = 0;
        this.lastEquipCheck = 0;
        this.bot = bot;
        this.settings = {
            enabled: false,
            protectedPlayer: null,
            zoneCenter: null,
            zoneRadius: 10,
            autoEquipArmor: true,
            autoEquipWeapon: true,
            autoEat: true,
            hungerThreshold: 16, // Eat when food is below 16/20
            healthThreshold: 14, // Be more aggressive when health is below 14/20
            aggressiveMode: false
        };
        this.setupEventListeners();
    }
    setupEventListeners() {
        try {
            // Monitor entity damage to detect attacks on protected player
            this.bot.on('entityHurt', (entity) => {
                try {
                    if (!this.isActive || !entity)
                        return;
                    // Check if protected player is being attacked
                    if (this.protectedPlayerEntity && entity === this.protectedPlayerEntity) {
                        console.log(`[sentinel] Protected player ${this.settings.protectedPlayer} is under attack!`);
                        this.defendProtectedPlayer();
                    }
                    // Check if bot is being attacked
                    if (entity === this.bot.entity) {
                        console.log('[sentinel] Bot is under attack! Retaliating...');
                        this.defendSelf();
                    }
                }
                catch (e) {
                    console.error('[sentinel] EntityHurt error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Monitor entity spawns for threats
            this.bot.on('entitySpawn', (entity) => {
                try {
                    if (!this.isActive || !entity)
                        return;
                    this.evaluateNewEntity(entity);
                }
                catch (e) {
                    console.error('[sentinel] EntitySpawn error:', e instanceof Error ? e.message : String(e));
                }
            });
            // Monitor player join/leave
            this.bot.on('playerJoined', (player) => {
                try {
                    if (this.settings.protectedPlayer === player.username) {
                        console.log(`[sentinel] Protected player ${player.username} joined. Starting protection.`);
                        this.findProtectedPlayer();
                    }
                }
                catch (e) {
                    console.error('[sentinel] PlayerJoined error:', e instanceof Error ? e.message : String(e));
                }
            });
            this.bot.on('playerLeft', (player) => {
                try {
                    if (this.settings.protectedPlayer === player.username) {
                        console.log(`[sentinel] Protected player ${player.username} left. Stopping protection.`);
                        this.protectedPlayerEntity = null;
                    }
                }
                catch (e) {
                    console.error('[sentinel] PlayerLeft error:', e instanceof Error ? e.message : String(e));
                }
            });
        }
        catch (e) {
            console.error('[sentinel] Event listener setup error:', e instanceof Error ? e.message : String(e));
        }
    }
    enableSentinel(protectedPlayer, settings) {
        try {
            if (settings) {
                this.settings = { ...this.settings, ...settings };
            }
            this.settings.enabled = true;
            this.settings.protectedPlayer = protectedPlayer;
            this.isActive = true;
            this.findProtectedPlayer();
            this.startMonitoring();
            // Initial equipment check
            this.checkAndEquipGear();
            console.log(`[sentinel] Sentinel mode activated. Protecting ${protectedPlayer}`);
            return `Sentinel system activated. Now protecting ${protectedPlayer}.`;
        }
        catch (e) {
            console.error('[sentinel] Enable error:', e instanceof Error ? e.message : String(e));
            return 'Failed to enable Sentinel system.';
        }
    }
    disableSentinel() {
        try {
            this.isActive = false;
            this.settings.enabled = false;
            this.settings.protectedPlayer = null;
            this.protectedPlayerEntity = null;
            this.threats.clear();
            if (this.monitoringLoop) {
                clearInterval(this.monitoringLoop);
                this.monitoringLoop = null;
            }
            console.log('[sentinel] Sentinel mode deactivated');
            return 'Sentinel system deactivated.';
        }
        catch (e) {
            console.error('[sentinel] Disable error:', e instanceof Error ? e.message : String(e));
            return 'Failed to disable Sentinel system.';
        }
    }
    setZoneDefense(center, radius) {
        try {
            this.settings.zoneCenter = center;
            this.settings.zoneRadius = radius;
            console.log(`[sentinel] Zone defense set at ${center.x}, ${center.y}, ${center.z} with radius ${radius}`);
            return `Zone defense established at coordinates (${center.x}, ${center.y}, ${center.z}) with radius ${radius} blocks.`;
        }
        catch (e) {
            console.error('[sentinel] Zone defense error:', e instanceof Error ? e.message : String(e));
            return 'Failed to set zone defense.';
        }
    }
    startMonitoring() {
        if (this.monitoringLoop) {
            clearInterval(this.monitoringLoop);
        }
        this.monitoringLoop = setInterval(() => {
            try {
                if (!this.isActive)
                    return;
                this.monitorThreats();
                this.checkProtectedPlayer();
                this.checkZoneIntruders();
                this.manageSurvival();
            }
            catch (e) {
                console.error('[sentinel] Monitoring error:', e instanceof Error ? e.message : String(e));
            }
        }, 1000); // Check every second
    }
    findProtectedPlayer() {
        try {
            if (!this.settings.protectedPlayer)
                return;
            const player = Object.values(this.bot.entities).find(entity => entity.type === 'player' &&
                entity.username === this.settings.protectedPlayer);
            if (player) {
                this.protectedPlayerEntity = player;
                console.log(`[sentinel] Found protected player: ${this.settings.protectedPlayer}`);
            }
            else {
                console.log(`[sentinel] Protected player ${this.settings.protectedPlayer} not found nearby`);
            }
        }
        catch (e) {
            console.error('[sentinel] Find player error:', e instanceof Error ? e.message : String(e));
        }
    }
    defendProtectedPlayer() {
        try {
            if (!this.protectedPlayerEntity)
                return;
            // Find nearby hostile entities
            const threats = this.findThreatsNear(this.protectedPlayerEntity.position, 8);
            if (threats.length > 0) {
                const closestThreat = threats[0];
                console.log(`[sentinel] Defending ${this.settings.protectedPlayer} from ${closestThreat.name || 'unknown entity'}`);
                this.engageThreat(closestThreat);
            }
        }
        catch (e) {
            console.error('[sentinel] Defend player error:', e instanceof Error ? e.message : String(e));
        }
    }
    defendSelf() {
        try {
            // Find nearby threats
            const threats = this.findThreatsNear(this.bot.entity.position, 6);
            if (threats.length > 0) {
                const closestThreat = threats[0];
                console.log(`[sentinel] Defending self from ${closestThreat.name || 'unknown entity'}`);
                this.engageThreat(closestThreat);
            }
        }
        catch (e) {
            console.error('[sentinel] Defend self error:', e instanceof Error ? e.message : String(e));
        }
    }
    findThreatsNear(position, radius) {
        try {
            const threats = [];
            Object.values(this.bot.entities).forEach(entity => {
                if (!entity || entity === this.bot.entity)
                    return;
                if (!entity.position)
                    return;
                const distance = position.distanceTo(entity.position);
                if (distance > radius)
                    return;
                // Check if entity is hostile
                if (this.isHostileEntity(entity)) {
                    threats.push(entity);
                }
            });
            // Sort by distance (closest first)
            threats.sort((a, b) => {
                const distA = position.distanceTo(a.position);
                const distB = position.distanceTo(b.position);
                return distA - distB;
            });
            return threats;
        }
        catch (e) {
            console.error('[sentinel] Find threats error:', e instanceof Error ? e.message : String(e));
            return [];
        }
    }
    isHostileEntity(entity) {
        try {
            if (!entity || !entity.name)
                return false;
            const hostileMobs = [
                'zombie', 'skeleton', 'creeper', 'spider', 'enderman',
                'witch', 'vindicator', 'pillager', 'evoker', 'wither',
                'blaze', 'ghast', 'slime', 'magma_cube', 'phantom'
            ];
            return hostileMobs.some(mob => entity.name?.toLowerCase().includes(mob));
        }
        catch (e) {
            return false;
        }
    }
    engageThreat(threat) {
        try {
            this.threats.add(threat);
            // Ensure we have a weapon equipped
            this.equipBestWeapon();
            // Navigate to threat and attack
            const distance = this.bot.entity.position.distanceTo(threat.position);
            if (distance > 4) {
                // Move closer
                const goal = new goals.GoalNear(threat.position.x, threat.position.y, threat.position.z, 2);
                this.bot.pathfinder.setGoal(goal);
            }
            else {
                // Attack
                this.bot.lookAt(threat.position.offset(0, threat.height ? threat.height * 0.5 : 1, 0));
                this.bot.attack(threat);
                console.log(`[sentinel] Attacking ${threat.name || 'entity'}`);
            }
        }
        catch (e) {
            console.error('[sentinel] Engage threat error:', e instanceof Error ? e.message : String(e));
        }
    }
    monitorThreats() {
        try {
            // Remove dead/gone threats
            this.threats.forEach(threat => {
                if (!threat || !Object.values(this.bot.entities).includes(threat)) {
                    this.threats.delete(threat);
                }
            });
            // Look for new threats around protected player
            if (this.protectedPlayerEntity) {
                const nearbyThreats = this.findThreatsNear(this.protectedPlayerEntity.position, 12);
                nearbyThreats.forEach(threat => {
                    if (!this.threats.has(threat)) {
                        console.log(`[sentinel] New threat detected: ${threat.name || 'unknown'}`);
                        this.engageThreat(threat);
                    }
                });
            }
        }
        catch (e) {
            console.error('[sentinel] Monitor threats error:', e instanceof Error ? e.message : String(e));
        }
    }
    checkProtectedPlayer() {
        try {
            if (!this.protectedPlayerEntity || !this.settings.protectedPlayer)
                return;
            // Check if player is still online
            const currentPlayer = Object.values(this.bot.entities).find(entity => entity.type === 'player' &&
                entity.username === this.settings.protectedPlayer);
            if (!currentPlayer) {
                console.log(`[sentinel] Lost sight of protected player ${this.settings.protectedPlayer}`);
                this.protectedPlayerEntity = null;
                this.findProtectedPlayer();
            }
            else {
                this.protectedPlayerEntity = currentPlayer;
            }
        }
        catch (e) {
            console.error('[sentinel] Check player error:', e instanceof Error ? e.message : String(e));
        }
    }
    checkZoneIntruders() {
        try {
            if (!this.settings.zoneCenter)
                return;
            Object.values(this.bot.entities).forEach(entity => {
                if (!entity || !entity.position)
                    return;
                if (entity === this.bot.entity)
                    return;
                const distance = this.settings.zoneCenter.x !== undefined ?
                    Math.sqrt(Math.pow(entity.position.x - this.settings.zoneCenter.x, 2) +
                        Math.pow(entity.position.z - this.settings.zoneCenter.z, 2)) : Infinity;
                if (distance <= this.settings.zoneRadius) {
                    if (this.isHostileEntity(entity)) {
                        console.log(`[sentinel] Zone intruder detected: ${entity.name || 'unknown'}`);
                        this.engageThreat(entity);
                    }
                }
            });
        }
        catch (e) {
            console.error('[sentinel] Zone check error:', e instanceof Error ? e.message : String(e));
        }
    }
    manageSurvival() {
        try {
            const now = Date.now();
            // Check equipment every 5 seconds
            if (now - this.lastEquipCheck > 5000) {
                this.checkAndEquipGear();
                this.lastEquipCheck = now;
            }
            // Check food every 3 seconds
            if (now - this.lastEatTime > 3000) {
                this.checkAndEat();
                this.lastEatTime = now;
            }
        }
        catch (e) {
            console.error('[sentinel] Survival management error:', e instanceof Error ? e.message : String(e));
        }
    }
    checkAndEquipGear() {
        try {
            if (this.settings.autoEquipArmor) {
                this.equipBestArmor();
            }
            if (this.settings.autoEquipWeapon) {
                this.equipBestWeapon();
            }
        }
        catch (e) {
            console.error('[sentinel] Equip gear error:', e instanceof Error ? e.message : String(e));
        }
    }
    equipBestArmor() {
        try {
            const armorSlots = [
                { name: 'head', destination: 'head' },
                { name: 'torso', destination: 'torso' },
                { name: 'legs', destination: 'legs' },
                { name: 'feet', destination: 'feet' }
            ];
            armorSlots.forEach(({ name, destination }) => {
                try {
                    const currentItem = this.bot.inventory.slots[this.getArmorSlotId(name)];
                    const bestArmor = this.findBestArmorForSlot(name);
                    if (bestArmor && (!currentItem || this.getArmorValue(bestArmor) > this.getArmorValue(currentItem))) {
                        this.bot.equip(bestArmor, destination);
                        console.log(`[sentinel] Equipped ${bestArmor.name} to ${name}`);
                    }
                }
                catch (slotError) {
                    console.warn(`[sentinel] Could not equip armor to ${name}:`, slotError instanceof Error ? slotError.message : String(slotError));
                }
            });
        }
        catch (e) {
            console.error('[sentinel] Equip armor error:', e instanceof Error ? e.message : String(e));
        }
    }
    equipBestWeapon() {
        try {
            const currentWeapon = this.bot.heldItem;
            const bestWeapon = this.findBestWeapon();
            if (bestWeapon && (!currentWeapon || this.getWeaponDamage(bestWeapon) > this.getWeaponDamage(currentWeapon))) {
                this.bot.equip(bestWeapon, 'hand');
                console.log(`[sentinel] Equipped ${bestWeapon.name} as weapon`);
            }
        }
        catch (e) {
            console.error('[sentinel] Equip weapon error:', e instanceof Error ? e.message : String(e));
        }
    }
    checkAndEat() {
        try {
            if (!this.settings.autoEat)
                return;
            if (this.bot.food >= this.settings.hungerThreshold)
                return;
            const food = this.findBestFood();
            if (food) {
                console.log(`[sentinel] Eating ${food.name} (hunger: ${this.bot.food}/${this.settings.hungerThreshold})`);
                this.bot.equip(food, 'hand').then(() => {
                    this.bot.consume();
                }).catch(e => {
                    console.error('[sentinel] Eat error:', e);
                });
            }
        }
        catch (e) {
            console.error('[sentinel] Check eat error:', e instanceof Error ? e.message : String(e));
        }
    }
    getArmorSlotId(slot) {
        const slots = {
            'head': 5,
            'torso': 6,
            'legs': 7,
            'feet': 8
        };
        return slots[slot];
    }
    findBestArmorForSlot(slot) {
        try {
            const armorTypes = {
                'head': ['helmet', '_helmet'],
                'torso': ['chestplate', '_chestplate'],
                'legs': ['leggings', '_leggings'],
                'feet': ['boots', '_boots']
            };
            const validTypes = armorTypes[slot] || [];
            let bestArmor = null;
            let bestValue = 0;
            this.bot.inventory.items().forEach(item => {
                if (validTypes.some(type => item.name.includes(type))) {
                    const value = this.getArmorValue(item);
                    if (value > bestValue) {
                        bestArmor = item;
                        bestValue = value;
                    }
                }
            });
            return bestArmor;
        }
        catch (e) {
            return null;
        }
    }
    findBestWeapon() {
        try {
            let bestWeapon = null;
            let bestDamage = 0;
            this.bot.inventory.items().forEach(item => {
                if (this.isWeapon(item)) {
                    const damage = this.getWeaponDamage(item);
                    if (damage > bestDamage) {
                        bestWeapon = item;
                        bestDamage = damage;
                    }
                }
            });
            return bestWeapon;
        }
        catch (e) {
            return null;
        }
    }
    findBestFood() {
        try {
            const foods = this.bot.inventory.items().filter(item => this.isFood(item));
            // Prioritize by hunger restoration value
            foods.sort((a, b) => this.getFoodValue(b) - this.getFoodValue(a));
            return foods.length > 0 ? foods[0] : null;
        }
        catch (e) {
            return null;
        }
    }
    isWeapon(item) {
        if (!item || !item.name)
            return false;
        const weapons = ['sword', 'axe', 'trident', 'bow', 'crossbow'];
        return weapons.some(weapon => item.name.includes(weapon));
    }
    isFood(item) {
        if (!item || !item.name)
            return false;
        const foods = [
            'bread', 'apple', 'carrot', 'potato', 'beef', 'pork', 'chicken',
            'mutton', 'cod', 'salmon', 'cookie', 'melon', 'steak', 'pie'
        ];
        return foods.some(food => item.name.includes(food));
    }
    getArmorValue(item) {
        if (!item || !item.name)
            return 0;
        const armorValues = {
            'leather': 1,
            'chainmail': 2,
            'iron': 3,
            'diamond': 4,
            'netherite': 5
        };
        for (const [material, value] of Object.entries(armorValues)) {
            if (item.name.includes(material)) {
                return value;
            }
        }
        return 0;
    }
    getWeaponDamage(item) {
        if (!item || !item.name)
            return 1;
        const weaponDamage = {
            'wooden_sword': 4,
            'stone_sword': 5,
            'iron_sword': 6,
            'diamond_sword': 7,
            'netherite_sword': 8,
            'wooden_axe': 7,
            'stone_axe': 9,
            'iron_axe': 9,
            'diamond_axe': 9,
            'netherite_axe': 10
        };
        return weaponDamage[item.name] || 1;
    }
    getFoodValue(item) {
        if (!item || !item.name)
            return 0;
        const foodValues = {
            'bread': 5,
            'cooked_beef': 8,
            'cooked_porkchop': 8,
            'cooked_chicken': 6,
            'apple': 4,
            'carrot': 3,
            'potato': 1,
            'baked_potato': 5
        };
        return foodValues[item.name] || 1;
    }
    evaluateNewEntity(entity) {
        try {
            if (this.isHostileEntity(entity) && this.protectedPlayerEntity) {
                const distanceToPlayer = entity.position.distanceTo(this.protectedPlayerEntity.position);
                if (distanceToPlayer <= 15) {
                    console.log(`[sentinel] Hostile entity ${entity.name} detected near protected player`);
                    this.engageThreat(entity);
                }
            }
        }
        catch (e) {
            console.error('[sentinel] Evaluate entity error:', e instanceof Error ? e.message : String(e));
        }
    }
    // Public methods for external control
    getSentinelStatus() {
        return {
            active: this.isActive,
            protectedPlayer: this.settings.protectedPlayer,
            zoneCenter: this.settings.zoneCenter,
            zoneRadius: this.settings.zoneRadius,
            threats: this.threats.size,
            settings: { ...this.settings }
        };
    }
    updateSettings(newSettings) {
        try {
            this.settings = { ...this.settings, ...newSettings };
            console.log('[sentinel] Settings updated:', newSettings);
            return `Sentinel settings updated: ${JSON.stringify(newSettings)}`;
        }
        catch (e) {
            return 'Failed to update sentinel settings.';
        }
    }
}
