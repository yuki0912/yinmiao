const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('刪除指定數量的頻道訊息')
        .addIntegerOption(option =>
            option.setName('amount')
                .setNameLocalization('zh-TW', '數量')
                .setDescription('要刪除的訊息數量 (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option.setName('user')
                .setNameLocalization('zh-TW', '成員')
                .setDescription('只刪除指定成員在範圍內的訊息（選填）')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                return await interaction.reply({
                    content: '❌ 你沒有「管理訊息」權限',
                    ephemeral: true
                });
            }

            if (!interaction.channel || !interaction.channel.messages) {
                return await interaction.reply({
                    content: '❌ 此頻道無法執行訊息清理',
                    ephemeral: true
                });
            }

            const fetchLimit = Math.min(amount + (targetUser ? 20 : 0), 100);
            const messages = await interaction.channel.messages.fetch({ limit: fetchLimit });

            let matchedMessages = messages.filter(msg => !msg.pinned);

            if (targetUser) {
                matchedMessages = matchedMessages.filter(msg => msg.author.id === targetUser.id);
            }

            const targetMessages = Array.from(matchedMessages.values()).slice(0, amount);

            let deletedCount = 0;
            if (targetMessages.length === 1) {
                await targetMessages[0].delete();
                deletedCount = 1;
            } else if (targetMessages.length >= 2) {
                const deleted = await interaction.channel.bulkDelete(targetMessages, true).catch(() => null);
                deletedCount = deleted ? deleted.size : 0;
            }

            // 公開回覆（未設定 ephemeral），並在 6 秒後自動刪除
            const replyMsg = await interaction.reply({
                content: `已刪除 ${deletedCount} 則訊息`,
                fetchReply: true
            });

            setTimeout(() => {
                replyMsg.delete().catch(() => {});
            }, 6000);

        } catch (error) {
            if (error.code === 10008 || error.code === 10062) return;

            try {
                const errMsg = await interaction.reply({
                    content: `已刪除 0 則訊息`,
                    fetchReply: true
                });
                setTimeout(() => errMsg.delete().catch(() => {}), 6000);
            } catch (e) {
                // 靜默略過
            }
        }
    },
};
