// API Response wrapper
export interface ApiResponse<T = any> {
    success: boolean;
    message?: string;
    data?: T;
    error?: string;
}

export interface BotConfig {
    host: string;
    port: number;
    username: string;
    password?: string;
    version: string;
}

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

export interface MoveRequest {
    x: number;
    y: number;
    z: number;
}

export interface FollowRequest {
    playerName?: string;
    distance?: number;
    continuous?: boolean;
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

// Quest system types
export interface Quest {
    name: string;
    description: string;
    steps: QuestStep[];
    requirements?: string[];
    rewards?: string[];
}

export interface QuestStep {
    id: string;
    description: string;
    action: string;
    parameters?: any;
    completed: boolean;
}

export interface QuestProgress {
    questName: string;
    currentStep: number;
    completed: boolean;
    steps: QuestStep[];
    startTime: number;
    endTime?: number;
}

export interface QuestRequest {
    questName: string;
}

export interface AutonomousConfig {
    enabled: boolean;
    maxIdleTime: number; // seconds
    priorities: string[];
    safetyChecks: boolean;
}
