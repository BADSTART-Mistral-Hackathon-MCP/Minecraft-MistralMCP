import { Experience } from "mineflayer";

export interface BotState {
    health: number;
    food: number;
    experience: number | Experience;
    position: Position;
    inventory: InventoryItem[];
    nearbyPlayers: NearbyPlayer[];
    nearbyMobs: NearbyEntity[];
    isAlive: boolean;
    gameMode: string;
    dimension: string;
    weather: WeatherInfo;
}

export interface Position {
    x: number;
    y: number;
    z: number;
}

export interface InventoryItem {
    name: string;
    count: number;
    slot: number;
}

export interface NearbyPlayer {
    username: string;
    position: Position;
    distance: number;
}

export interface NearbyEntity {
    type: string;
    position: Position;
    id: number;
    distance: number;
}

export interface WeatherInfo {
    raining: boolean;
    thundering: boolean;
}

export interface BotCapabilities {
    canMove: boolean;
    canJump: boolean;
    canFly: boolean;
    canCraft: boolean;
    canMine: boolean;
    canAttack: boolean;
    canUseItems: boolean;
    canChat: boolean;
    pathfinding: boolean;
    inventoryManagement: boolean;
}

export interface ChatMessage {
    username: string;
    message: string;
    timestamp: number;
}

export interface CombatStatus {
    inCombat: boolean;
    target: NearbyEntity | null;
    health: number;
    armor: number;
    weapon: InventoryItem | null;
    shield: InventoryItem | null;
    threats: NearbyEntity[];
    defensiveMode: boolean;
}

export interface MiningResult {
    mined: number;
    requested: number;
    blocksFound: Position[];
    timeElapsed: number;
    success: boolean;
}

export interface CraftingResult {
    crafted: boolean;
    item: string;
    quantity: number;
    materialsUsed: InventoryItem[];
    timeElapsed: number;
    error?: string;
}

export interface MovementResult {
    success: boolean;
    startPosition: Position;
    endPosition: Position;
    distance: number;
    timeElapsed: number;
    pathFound: boolean;
}

export interface ApiResponse<T = any> {
    success: boolean;
    message: string;
    data?: T;
    timestamp: number;
}

export interface ValidationError {
    field: string;
    message: string;
    value?: any;
}