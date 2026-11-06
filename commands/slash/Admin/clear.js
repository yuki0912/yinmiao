const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const AUTO_DELETE_DELAY = 5000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 發送指令回覆，等待指定時間後刪除原始互動回覆。
 * 不再使用沒有錯誤記錄的 fire-and-forget setTimeout。
 */
async function replyAndAutoDelete(interaction, content, ephemeral = false) {
    const payload = { content };
    if (ephemeral) payload.flags = MessageFlags.Ephemeral;

    await interaction.reply(payload);
    await delay(AUTO_DELETE_DELAY);

    try {
        await interaction.deleteReply();
        console.log('[clear] 已自動刪除指令回覆。');
    } catch (error) {
        // 10008 = Unknown Message：訊息已經不存在，視為已清除。
        if (error.code !== 10008) {
            console.error('[clear] 自動刪除指令回覆失敗:', error);
        }
    }
}

module.exports = {
    category: 'Admin',
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
            if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
                throw new Error('此指令只能在伺服器文字頻道中使用。');
            }

            const channel = interaction.channel;
            if (!channel.messages?.fetch || typeof channel.bulkDelete !== 'function') {
                throw new Error('目前頻道不支援批量刪除訊息。');
            }

            // 確認銀喵本身具有讀取訊息與管理訊息的權限。
            const botMember = interaction.guild.members.me
                || await interaction.guild.members.fetchMe().catch(() => null);
            const permissions = botMember && channel.permissionsFor(botMember);

            if (!permissions || !permissions.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
            ])) {
                throw new Error('銀喵缺少查看頻道、讀取訊息歷史或管理訊息權限。');
            }

            // 取得最新訊息，並排除釘選訊息。
            const messages = await channel.messages.fetch({ limit: amount });
            let filteredMessages = messages.filter(message => !message.pinned);

            // 若指定成員，只刪除該成員的訊息。
            if (targetUser) {
                filteredMessages = filteredMessages.filter(message => message.author.id === targetUser.id);
            }

            if (filteredMessages.size === 0) {
                const noMessagesText = targetUser
                    ? `🔎 最近 ${amount} 則訊息中，找不到成員 ${targetUser} 可刪除的訊息（釘選訊息不會刪除）。`
                    : '🔎 找不到可刪除的訊息（釘選訊息不會刪除）。';

                await replyAndAutoDelete(interaction, noMessagesText, true);
                return;
            }

            // true：忽略超過 14 天的訊息，避免 Discord 批量刪除 API 拒絕整批請求。
            const deleted = await channel.bulkDelete(filteredMessages, true);

            const replyText = targetUser
                ? `🧹 已成功清理成員 ${targetUser} 的 **${deleted.size}** 則訊息。\n（此提示將於 5 秒後自動刪除）`
                : `🧹 已成功清理 **${deleted.size}** 則訊息。\n（此提示將於 5 秒後自動刪除）`;

            await replyAndAutoDelete(interaction, replyText, false);
        } catch (error) {
            console.error('[clear] 清理訊息時發生錯誤:', error);

            const errorMessage = error.code === 50013
                ? '❌ 銀喵缺少必要權限，請確認已授予「管理訊息」及相關頻道權限。'
                : `❌ 清理訊息失敗：${error.message || '請檢查頻道權限或訊息狀態。'}`;

            // 錯誤提示也會在 5 秒後刪除，避免訊息長期留在頻道。
            if (!interaction.replied && !interaction.deferred) {
                await replyAndAutoDelete(interaction, errorMessage, true).catch(replyError => {
                    console.error('[clear] 無法發送錯誤提示:', replyError);
                });
            } else {
                try {
                    await interaction.followUp({ content: errorMessage, flags: MessageFlags.Ephemeral });
                } catch (replyError) {
                    console.error('[clear] 無法發送後續錯誤提示:', replyError);
                }
            }
        }
    }
};
