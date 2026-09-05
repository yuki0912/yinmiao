const { EmbedBuilder } = require('discord.js');
const randomanime = require('random-anime');

module.exports = {
    name: 'anime',
    category: "Fun",
    aliases: ["ani", "Anime"],
    description: '取得隨機動漫圖片 :D',

    // 🌟 注意：參數順序必須與 messageCreate.js 一致
    async execute(message, args, client) {
        try {
            const animeImg = randomanime.anime();
            const user = message.author;

            if (!animeImg || !animeImg.startsWith('http')) {
                return message.reply("❌ 暫時無法取得圖片喵。").catch(() => null);
            }

            const embed = new EmbedBuilder()
                .setTitle("🎌 隨機動漫圖片")
                .setImage(animeImg)
                .setColor('#ffb7c5')
                .setFooter({ 
                    text: `由 ${user.tag} 請求`, 
                    iconURL: user.displayAvatarURL({ forceStatic: false }) 
                })
                .setTimestamp();

            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error(`[Prefix Anime Error]: ${error.message}`);
            message.reply("❌ 發生內部錯誤喵。").catch(() => null);
        }
    }
};
