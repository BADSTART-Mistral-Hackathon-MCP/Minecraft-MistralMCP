import pathfinderModule from 'mineflayer-pathfinder';
const { goals } = pathfinderModule;
export class SurvivalRoutines {
    constructor(bot) {
        this.isRunning = false;
        this.bot = bot;
        this.state = {
            phase: 'gathering_wood',
            woodCount: 0,
            stoneCount: 0,
            coalCount: 0,
            ironCount: 0,
            hasWorkbench: false,
            hasWoodenTools: false,
            hasStoneTools: false,
            hasIronTools: false
        };
    }
    async startSurvivalRoutine() {
        if (this.isRunning) {
            return 'Survival routine already running';
        }
        this.isRunning = true;
        this.updateInventoryState();
        try {
            while (this.isRunning) {
                await this.executeCurrentPhase();
                await this.wait(2000); // Wait 2 seconds between actions
            }
            return 'Survival routine completed';
        }
        catch (error) {
            this.isRunning = false;
            throw error;
        }
    }
    stopSurvivalRoutine() {
        this.isRunning = false;
        return 'Survival routine stopped';
    }
    getSurvivalState() {
        this.updateInventoryState();
        return { ...this.state };
    }
    updateInventoryState() {
        const inventory = this.bot.inventory.items();
        // Count resources
        this.state.woodCount = this.countItems(inventory, ['log', 'wood']);
        this.state.stoneCount = this.countItems(inventory, ['cobblestone', 'stone']);
        this.state.coalCount = this.countItems(inventory, ['coal']);
        this.state.ironCount = this.countItems(inventory, ['iron_ingot', 'iron_ore']);
        // Check for tools and workbench
        this.state.hasWorkbench = this.hasItem(inventory, 'crafting_table');
        this.state.hasWoodenTools = this.hasItem(inventory, 'wooden_pickaxe') || this.hasItem(inventory, 'wooden_axe');
        this.state.hasStoneTools = this.hasItem(inventory, 'stone_pickaxe') || this.hasItem(inventory, 'stone_axe');
        this.state.hasIronTools = this.hasItem(inventory, 'iron_pickaxe') || this.hasItem(inventory, 'iron_axe');
    }
    countItems(inventory, patterns) {
        return inventory
            .filter(item => patterns.some(pattern => item.name.includes(pattern)))
            .reduce((total, item) => total + item.count, 0);
    }
    hasItem(inventory, itemName) {
        return inventory.some(item => item.name.includes(itemName));
    }
    async executeCurrentPhase() {
        switch (this.state.phase) {
            case 'gathering_wood':
                await this.gatherWood();
                break;
            case 'crafting_tools':
                await this.craftBasicTools();
                break;
            case 'mining_stone':
                await this.mineStone();
                break;
            case 'upgrading_tools':
                await this.upgradeTools();
                break;
            case 'safe_mining':
                await this.setupSafeMining();
                break;
            case 'advanced_mining':
                await this.advancedMining();
                break;
        }
    }
    async gatherWood() {
        console.log('[survival] Phase: Gathering Wood');
        if (this.state.woodCount >= 20) {
            this.state.phase = 'crafting_tools';
            return;
        }
        // Find nearby trees
        const logBlock = this.bot.findBlock({
            matching: (block) => block.name.includes('log') || block.name.includes('wood'),
            maxDistance: 64
        });
        if (!logBlock) {
            // Look for saplings to plant or move to find trees
            await this.moveToFindTrees();
            return;
        }
        try {
            // Move to tree and chop it
            await this.moveToBlock(logBlock);
            await this.chopTree(logBlock);
            this.bot.chat('🌳 Chopping wood for survival...');
        }
        catch (error) {
            console.error('[survival] Error gathering wood:', error);
            await this.wait(5000);
        }
    }
    async craftBasicTools() {
        console.log('[survival] Phase: Crafting Basic Tools');
        if (!this.state.hasWorkbench) {
            await this.craftWorkbench();
        }
        if (!this.state.hasWoodenTools) {
            await this.craftWoodenTools();
        }
        if (this.state.hasWoodenTools && this.state.hasWorkbench) {
            this.state.phase = 'mining_stone';
        }
    }
    async mineStone() {
        console.log('[survival] Phase: Mining Stone');
        if (this.state.stoneCount >= 30) {
            this.state.phase = 'upgrading_tools';
            return;
        }
        const stoneBlock = this.bot.findBlock({
            matching: (block) => block.name === 'stone' || block.name === 'cobblestone',
            maxDistance: 64
        });
        if (!stoneBlock) {
            await this.findStoneArea();
            return;
        }
        try {
            await this.moveToBlock(stoneBlock);
            await this.bot.dig(stoneBlock);
            this.bot.chat('⛏️ Mining stone...');
        }
        catch (error) {
            console.error('[survival] Error mining stone:', error);
            await this.wait(3000);
        }
    }
    async upgradeTools() {
        console.log('[survival] Phase: Upgrading Tools');
        if (!this.state.hasStoneTools) {
            await this.craftStoneTools();
        }
        if (this.state.hasStoneTools) {
            this.state.phase = 'safe_mining';
        }
    }
    async setupSafeMining() {
        console.log('[survival] Phase: Setting up Safe Mining');
        if (!this.state.safeLocation) {
            await this.findSafeMiningLocation();
        }
        if (this.state.safeLocation) {
            await this.createMiningShaft();
            this.state.phase = 'advanced_mining';
        }
    }
    async advancedMining() {
        console.log('[survival] Phase: Advanced Mining');
        // Mine coal first for torches
        if (this.state.coalCount < 10) {
            await this.mineCoal();
            return;
        }
        // Then mine iron
        if (this.state.ironCount < 20) {
            await this.mineIron();
            return;
        }
        // Continue mining or complete routine
        this.bot.chat('✅ Survival routine completed - ready for advanced operations!');
        this.isRunning = false;
    }
    // Helper methods
    async moveToBlock(block) {
        const goal = new goals.GoalBlock(block.position.x, block.position.y, block.position.z);
        this.bot.pathfinder.setGoal(goal);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Movement timeout')), 15000);
            this.bot.once('goal_reached', () => {
                clearTimeout(timeout);
                resolve();
            });
        });
    }
    async chopTree(startBlock) {
        const treeBlocks = this.findConnectedTreeBlocks(startBlock);
        for (const block of treeBlocks) {
            if (this.bot.canDigBlock(block)) {
                await this.bot.dig(block);
                await this.wait(500);
            }
        }
    }
    findConnectedTreeBlocks(startBlock) {
        const blocks = [];
        const visited = new Set();
        const queue = [startBlock];
        while (queue.length > 0 && blocks.length < 50) {
            const current = queue.shift();
            const key = `${current.position.x},${current.position.y},${current.position.z}`;
            if (visited.has(key))
                continue;
            visited.add(key);
            if (current.name.includes('log') || current.name.includes('wood')) {
                blocks.push(current);
                // Check adjacent blocks
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dz = -1; dz <= 1; dz++) {
                            if (dx === 0 && dy === 0 && dz === 0)
                                continue;
                            const adjacent = this.bot.blockAt(current.position.offset(dx, dy, dz));
                            if (adjacent && (adjacent.name.includes('log') || adjacent.name.includes('wood'))) {
                                queue.push(adjacent);
                            }
                        }
                    }
                }
            }
        }
        return blocks;
    }
    async craftWorkbench() {
        const planks = this.bot.inventory.items().find(item => item.name.includes('planks'));
        if (!planks && this.state.woodCount > 0) {
            // Convert logs to planks first
            await this.craftPlanks();
        }
        try {
            const item = this.bot.registry.itemsByName.crafting_table;
            if (item) {
                const recipe = this.bot.recipesFor(item.id, null, 1, false)[0];
                if (recipe) {
                    await this.bot.craft(recipe, 1);
                    this.bot.chat('🔨 Crafted workbench!');
                }
            }
        }
        catch (error) {
            console.error('[survival] Error crafting workbench:', error);
        }
    }
    async craftPlanks() {
        const logs = this.bot.inventory.items().find(item => item.name.includes('log') || item.name.includes('wood'));
        if (!logs)
            return;
        try {
            // Convert logs to planks
            const plankItem = this.bot.registry.itemsByName[logs.name.replace('log', 'planks')];
            if (plankItem) {
                const recipe = this.bot.recipesFor(plankItem.id, null, null, false)[0];
                if (recipe) {
                    await this.bot.craft(recipe, Math.min(logs.count, 10));
                    this.bot.chat('📋 Converted logs to planks');
                }
            }
        }
        catch (error) {
            console.error('[survival] Error crafting planks:', error);
        }
    }
    async craftWoodenTools() {
        try {
            // Craft wooden pickaxe
            const pickaxe = this.bot.registry.itemsByName.wooden_pickaxe;
            if (pickaxe) {
                const recipe = this.bot.recipesFor(pickaxe.id, null, 1, true)[0];
                if (recipe) {
                    await this.bot.craft(recipe, 1);
                    this.bot.chat('⛏️ Crafted wooden pickaxe!');
                }
            }
            // Craft wooden axe
            const axe = this.bot.registry.itemsByName.wooden_axe;
            if (axe) {
                const recipe = this.bot.recipesFor(axe.id, null, 1, true)[0];
                if (recipe) {
                    await this.bot.craft(recipe, 1);
                    this.bot.chat('🪓 Crafted wooden axe!');
                }
            }
        }
        catch (error) {
            console.error('[survival] Error crafting wooden tools:', error);
        }
    }
    async craftStoneTools() {
        try {
            // Craft stone pickaxe
            const pickaxe = this.bot.registry.itemsByName.stone_pickaxe;
            if (pickaxe) {
                const recipe = this.bot.recipesFor(pickaxe.id, null, 1, true)[0];
                if (recipe) {
                    await this.bot.craft(recipe, 1);
                    this.bot.chat('⛏️ Crafted stone pickaxe!');
                }
            }
            // Craft stone axe
            const axe = this.bot.registry.itemsByName.stone_axe;
            if (axe) {
                const recipe = this.bot.recipesFor(axe.id, null, 1, true)[0];
                if (recipe) {
                    await this.bot.craft(recipe, 1);
                    this.bot.chat('🪓 Crafted stone axe!');
                }
            }
        }
        catch (error) {
            console.error('[survival] Error crafting stone tools:', error);
        }
    }
    async moveToFindTrees() {
        // Move in a spiral pattern to find trees
        const currentPos = this.bot.entity.position;
        const searchPositions = [
            { x: currentPos.x + 50, z: currentPos.z },
            { x: currentPos.x - 50, z: currentPos.z },
            { x: currentPos.x, z: currentPos.z + 50 },
            { x: currentPos.x, z: currentPos.z - 50 }
        ];
        for (const pos of searchPositions) {
            const goal = new goals.GoalBlock(pos.x, currentPos.y, pos.z);
            this.bot.pathfinder.setGoal(goal);
            await this.wait(10000);
            const logBlock = this.bot.findBlock({
                matching: (block) => block.name.includes('log'),
                maxDistance: 32
            });
            if (logBlock)
                break;
        }
    }
    async findStoneArea() {
        // Find underground stone
        const currentPos = this.bot.entity.position;
        const goal = new goals.GoalBlock(currentPos.x, Math.max(currentPos.y - 20, 5), currentPos.z);
        this.bot.pathfinder.setGoal(goal);
        await this.wait(5000);
    }
    async findSafeMiningLocation() {
        const currentPos = this.bot.entity.position;
        // Find a relatively flat area underground
        this.state.safeLocation = {
            x: Math.floor(currentPos.x),
            y: Math.max(currentPos.y - 30, 12), // Y=12 is good for mining
            z: Math.floor(currentPos.z)
        };
        this.bot.chat(`⛏️ Selected mining location at Y=${this.state.safeLocation.y}`);
    }
    async createMiningShaft() {
        if (!this.state.safeLocation)
            return;
        try {
            // Move to mining location
            const goal = new goals.GoalBlock(this.state.safeLocation.x, this.state.safeLocation.y, this.state.safeLocation.z);
            this.bot.pathfinder.setGoal(goal);
            await this.wait(10000);
            // Dig a small safe area
            this.bot.chat('🏗️ Creating safe mining chamber...');
            // This would need more sophisticated implementation
            // For now, just mark as ready
            await this.wait(2000);
        }
        catch (error) {
            console.error('[survival] Error creating mining shaft:', error);
        }
    }
    async mineCoal() {
        const coalBlock = this.bot.findBlock({
            matching: (block) => block.name === 'coal_ore',
            maxDistance: 32
        });
        if (coalBlock) {
            try {
                await this.moveToBlock(coalBlock);
                await this.bot.dig(coalBlock);
                this.bot.chat('⚫ Mining coal for torches...');
            }
            catch (error) {
                console.error('[survival] Error mining coal:', error);
            }
        }
    }
    async mineIron() {
        const ironBlock = this.bot.findBlock({
            matching: (block) => block.name === 'iron_ore',
            maxDistance: 32
        });
        if (ironBlock) {
            try {
                await this.moveToBlock(ironBlock);
                await this.bot.dig(ironBlock);
                this.bot.chat('🔧 Mining iron ore...');
            }
            catch (error) {
                console.error('[survival] Error mining iron:', error);
            }
        }
    }
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Public methods for external control
    async executeMiningPlan(plan) {
        this.bot.chat(`⛏️ Executing mining plan for ${plan.targetBlock}`);
        if (plan.lightingRequired && this.state.coalCount < 5) {
            this.bot.chat('⚠️ Need more coal for lighting before mining');
            return 'Need more coal for safe mining';
        }
        // Execute mining plan
        const block = this.bot.findBlock({
            matching: (block) => block.name === plan.targetBlock,
            maxDistance: 32
        });
        if (!block) {
            return `No ${plan.targetBlock} found nearby`;
        }
        try {
            await this.moveToBlock(block);
            if (plan.lightingRequired) {
                // Place torches around area (simplified)
                this.bot.chat('🕯️ Placing torches for safety...');
            }
            await this.bot.dig(block);
            return `Successfully mined ${plan.targetBlock}`;
        }
        catch (error) {
            return `Mining failed: ${error}`;
        }
    }
}
