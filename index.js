const mineflayer = require('mineflayer')

const bot = mineflayer.createBot({
    host: 'localhost', // Minecraft server IP
    port: 53781,       // Minecraft server
    username: 'Bot',    // Minecraft username
    password: '',        // Minecraft password, leave blank for offline mode
})

function lookAtNearestPlayer() {
    const nearestPlayer = bot.nearestEntity(entity => entity.type === 'player')
    if (nearestPlayer) {
        bot.lookAt(nearestPlayer.position.offset(0, nearestPlayer.height, 0))
    }
}


bot.on('physicsTick', lookAtNearestPlayer)