// API Response wrapper
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

// Bot configuration
export interface BotConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    version: string;
}

// Bot status information
export interface BotStatus {
    connected: boolean;
    spawned: boolean;
    username?: string;
    health?: number;
    food?: number;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    gameMode?: string;
    playersOnline?: number;
}

// API request types
export interface MoveRequest {
    x: number;
    y: number;
    z: number;
}

export interface SayRequest {
    message: string;
}

export interface MineRequest {
    blockType: string;
    maxDistance?: number;
}

export interface CraftRequest {
    item: string;
    count?: number;
}

// Inventory item
export interface InventoryItem {
    name: string;
    displayName: string;
    count: number;
    slot: number;
}