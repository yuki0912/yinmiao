const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    name: "stats",
    aliases: ["屬性", "面板", "st"],
    category: "TRPG",
    description: "📜 查看你詳細的角色屬性面板",

    async run(client, message, args) {
        try {
            const profile = await UserProfile.findOne({ guildId: message.guild.id, userId: message.author.id });

            if (!profile) return message.reply("你還沒有角色資料。");

            const s = profile.stats;
            // 計算修正值的函數 (属性-10)/2
            const mod = (val) => {
                const m = Math.floor((val - 10) / 2);
                return m >= 0 ? `+${m}` : m;
            };

            const embed = new EmbedBuilder()
                .setTitle(`📜 ${message.author.username} 的冒險者面板`)
                .setColor('#9b59b6')
                .setThumbnail(message.author.displayAvatarURL())
                .addFields(
                    { name: '💪 力量 (STR)', value: `\`${s.str}\` (修正: ${mod(s.str)})`, inline: true },
                    { name: '🤸 敏捷 (DEX)', value: `\`${s.dex}\` (修正: ${mod(s.dex)})`, inline: true },
                    { name: '🧠 智力 (INT)', value: `\`${s.int}\` (修正: ${mod(s.int)})`, inline: true },
                    { name: '🛡️ 體質 (CON)', value: `\`${s.con}\` (修正: ${mod(s.con)})`, inline: true }
                )
                .setFooter({ text: `等級: Lv.${profile.level} | 財富: $${profile.coins}` })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (e) {
            console.error(e);
            message.reply("❌ 無法讀取羊皮卷。");
        }
    }
};
