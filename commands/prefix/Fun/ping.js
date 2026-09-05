module.exports = {
    name: 'ping', // 這是指令名稱
    description: 'Ping!',
    async execute(message, args, client) { // 確保名稱是 execute
        await message.reply('Pong! 🏓');
    },
};
