const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "General",
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('🏆 查看伺服器等級排行榜'),

    async execute(interaction) {
        // 从数据库抓取 XP 最高的前 10 名
        const topUsers = await UserProfile.find({ guildId: interaction.guild.id })
            .sort({ level: -1, xp: -1 }) // 先比等级，等级一样比 XP
            .limit(10);

        if (topUsers.length === 0) {
            return await interaction.reply('目前還沒有人上榜喔，快去聊天吧！💬');
        }

        // 构建排行榜文字列表
        const leaderboardList = await Promise.all(topUsers.map(async (data, index) => {
            let userTag;
            try {
                const user = await interaction.client.users.fetch(data.userId);
                userTag = user.username;
            } catch {
                userTag = "未知成員";
            }

            // 前三名加个皇冠图标
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `\`#${index + 1}\``;
            return `${medal} **${userTag}** - Lv. ${data.level} (XP: ${data.xp})`;
        }));

        const lbEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🏆 ${interaction.guild.name} 等級排行榜`)
            .setDescription(leaderboardList.join('\n'))
            .setFooter({ text: '多多聊天就能提升排名喔！' })
            .setTimestamp();

        await interaction.reply({ embeds: [lbEmbed] });
    }
};
