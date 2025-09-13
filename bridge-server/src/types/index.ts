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
    username: string; // used in offline mode
    version: string;
    auth: 'offline' | 'microsoft';
    email?: string;   // optional Microsoft account email for MS auth
    profilesDir?: string; // token cache directory for MS auth
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
    playerName: string;
    distance?: number;
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
