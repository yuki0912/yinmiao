const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'waifu',
    aliases: ['老婆'],
    description: '召喚一位二次元老婆喵！',

    async execute(message, args, client) {
        try {
            // 使用 fetch 抓取 waifu.pics API
            const response = await fetch('https://api.waifu.pics/sfw/waifu');
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setTitle("💖 你的專屬老婆")
                .setImage(data.url)
                .setColor('#ffb7c5')
                .setFooter({ text: `這是銀喵幫你挑選的老婆喵！` })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error(`[Prefix Waifu Error]: ${error.message}`);
            message.channel.send('❌ 老婆出遠門了喵。');
        }
    }
};
