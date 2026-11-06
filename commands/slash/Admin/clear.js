const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

function scheduleReplyDeletion(interaction) {
    setTimeout(() => {
        interaction.deleteReply().catch(error => {
            // 訊息已被刪除或互動回覆已不存在時，不需要再次處理。
            if (error.code !== 10008 && error.code !== 10062) {
                console.error('[clear] 自動刪除回覆失敗:', error);
            }
        });
    }, 5000);
}

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

        // 必須先確認互動，避免後續抓取訊息時超過 Discord 的 3 秒期限。
        try {
            await interaction.deferReply();
        } catch (error) {
            console.error('[clear] 無法確認指令互動，停止執行:', error);
            // 例如 10062 (Unknown Interaction) 或 40060 (已確認互動)。
            // 此時不再嘗試 reply，避免重複確認。
            return;
        }

        try {
            if (!interaction.channel || !interaction.channel.messages) {
                throw new Error('目前頻道不支援訊息清理。');
            }

            // 抓取頻道內最新的訊息。
            const messages = await interaction.channel.messages.fetch({ limit: amount });

            // 自動排除釘選訊息。
            let filteredMessages = messages.filter(msg => !msg.pinned);

            // 若有指定成員，只清理該成員的訊息。
            if (targetUser) {
                filteredMessages = filteredMessages.filter(msg => msg.author.id === targetUser.id);
            }

            // 批量刪除；Discord 會自動忽略超過 14 天的舊訊息。
            const deleted = await interaction.channel.bulkDelete(filteredMessages, true);

            let replyText = `🧹 已成功清理 **${deleted.size}** 則訊息。`;
            if (targetUser) {
                replyText = `🧹 已成功清理成員 ${targetUser} 的 **${deleted.size}** 則訊息。`;
            }

            await interaction.editReply({
                content: `${replyText}\n（此提示將於 5 秒後自動刪除）`
            });
            scheduleReplyDeletion(interaction);

        } catch (error) {
            console.error('[clear] 清理訊息時發生錯誤:', error);

            const errorMessage = '❌ 清理訊息失敗，請確認 Bot 擁有「管理訊息」權限，且頻道及訊息可供清理。\n（此提示將於 5 秒後自動刪除）';

            try {
                await interaction.editReply({ content: errorMessage });
                scheduleReplyDeletion(interaction);
            } catch (replyError) {
                console.error('[clear] 無法發送清理失敗提示:', replyError);
            }
        }
    },
};
