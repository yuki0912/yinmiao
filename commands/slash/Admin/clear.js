const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('清理頻道訊息 (管理員專用)')
        .addIntegerOption(opt =>
            opt.setName('amount')
                .setNameLocalization('zh-TW', '數量')
                .setDescription('要刪除的訊息數量 (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(opt =>
            opt.setName('user')
                .setNameLocalization('zh-TW', '成員')
                .setDescription('僅刪除特定成員的訊息 (選填)')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        try {
            // 1. 抓取頻道內最新的訊息
            const messages = await interaction.channel.messages.fetch({ limit: amount });

            // 2. 過濾訊息：自動排除「釘選訊息」
            let filteredMessages = messages.filter(msg => !msg.pinned);

            // 3. 若有指定特定成員，則進一步過濾
            if (targetUser) {
                filteredMessages = filteredMessages.filter(msg => msg.author.id === targetUser.id);
            }

            // 4. 執行批量刪除 (true 代表自動忽略超過 14 天的舊訊息)
            const deleted = await interaction.channel.bulkDelete(filteredMessages, true);

            // 5. 組合提示文字
            let replyText = `🧹 已成功清理 **${deleted.size}** 則訊息。`;
            if (targetUser) {
                replyText = `🧹 已成功清理成員 ${targetUser} 的 **${deleted.size}** 則訊息。`;
            }
            replyText += `\n（此訊息將於 5 秒後自動刪除）`;

            // 6. 發送公開回覆
            await interaction.reply({ content: replyText });

            // 7. 5 秒後自動刪除機器人的這條回覆
            setTimeout(() => {
                interaction.deleteReply().catch(() => null);
            }, 5000);

        } catch (error) {
            console.error('清理訊息時發生錯誤:', error);

            const errorMessage = '❌ 清理訊息失敗（可能包含超過 14 天前的訊息或缺乏權限）。';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};