const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'meme',
    aliases: ['梗圖', '迷因'],
    description: '看個梗圖放鬆一下喵！',

    async execute(message, args, client) {
        try {
            const response = await fetch('https://meme-api.com/gimme');
            const data = await response.json();

            const embed = new EmbedBuilder()
                .setTitle(`🤣 ${data.title}`)
                .setURL(data.postLink)
                .setImage(data.url)
                .setColor('#ffb7c5')
                .setFooter({ text: `來自 r/${data.subreddit}` })
                .setTimestamp();

            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error(`[Prefix Meme Error]: ${error.message}`);
            message.reply('❌ 梗圖壞掉了，現在笑不出來喵。');
        }
    }
};
