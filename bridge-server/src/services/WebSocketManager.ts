import { Server as SocketIOServer, Socket } from 'socket.io';
import { BotManager } from './BotManager';

export class WebSocketManager {
    private io: SocketIOServer;
    private botManager: BotManager;
    private connectedClients: Map<string, Socket> = new Map();

    constructor(io: SocketIOServer, botManager: BotManager) {
        this.io = io;
        this.botManager = botManager;
    }

    initialize(): void {
        this.io.on('connection', (socket: Socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectedClients.set(socket.id, socket);

            // Send current bot state if connected
            if (this.botManager.isConnected()) {
                socket.emit('bot_state', this.botManager.getBotState());
                socket.emit('bot_connected', { timestamp: Date.now() });
            }

            // Handle client events
            this.setupClientEventHandlers(socket);

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.connectedClients.delete(socket.id);
            });
        });

        // Setup periodic broadcasts
        this.setupPeriodicBroadcasts();
    }

    private setupClientEventHandlers(socket: Socket): void {
        // Client requesting current status
        socket.on('request_status', () => {
            if (this.botManager.isConnected()) {
                socket.emit('bot_state', this.botManager.getBotState());
            } else {
                socket.emit('bot_disconnected', { timestamp: Date.now() });
            }
        });

        // Client requesting chat history
        socket.on('request_chat_history', (data) => {
            const { limit = 20, username } = data;
            const history = this.botManager.getChatHistory(limit, username);
            socket.emit('chat_history', { history, limit, username });
        });

        // Client wants to simulate chat (for testing)
        socket.on('simulate_chat', (data) => {
            const { username, message, timestamp } = data;
            socket.broadcast.emit('chat_message', { username, message, timestamp });
        });

        // Client requesting nearby entities
        socket.on('request_nearby', (data) => {
            const { radius = 16 } = data;
            if (this.botManager.isConnected()) {
                const nearbyData = this.botManager.getNearbyEntities(radius);
                socket.emit('nearby_entities', nearbyData);
            }
        });

        // Client requesting inventory
        socket.on('request_inventory', () => {
            if (this.botManager.isConnected()) {
                const inventory = this.botManager.getInventory();
                const summary = this.botManager.getInventorySummary();
                socket.emit('inventory_update', { inventory, summary });
            }
        });

        // Client requesting combat status
        socket.on('request_combat_status', () => {
            if (this.botManager.isConnected()) {
                const combatStatus = this.botManager.getCombatStatus();
                socket.emit('combat_status', combatStatus);
            }
        });

        // Handle client errors
        socket.on('error', (error) => {
            console.error(`Socket error from ${socket.id}:`, error);
        });
    }

    private setupPeriodicBroadcasts(): void {
        // Broadcast bot state every 5 seconds to all connected clients
        setInterval(() => {
            if (this.botManager.isConnected() && this.connectedClients.size > 0) {
                const state = this.botManager.getBotState();
                this.io.emit('bot_state', state);
            }
        }, 5000);

        // Broadcast system health every 30 seconds
        setInterval(() => {
            if (this.connectedClients.size > 0) {
                const health = {
                    botConnected: this.botManager.isConnected(),
                    clientsConnected: this.connectedClients.size,
                    uptime: this.botManager.getBotUptime(),
                    lastActivity: this.botManager.getLastActivity(),
                    timestamp: Date.now()
                };
                this.io.emit('system_health', health);
            }
        }, 30000);
    }

    // Public methods for broadcasting events
    broadcastToAll(event: string, data: any): void {
        this.io.emit(event, data);
    }

    broadcastToClient(clientId: string, event: string, data: any): void {
        const client = this.connectedClients.get(clientId);
        if (client) {
            client.emit(event, data);
        }
    }

    getConnectedClientsCount(): number {
        return this.connectedClients.size;
    }

    getConnectedClientIds(): string[] {
        return Array.from(this.connectedClients.keys());
    }
}