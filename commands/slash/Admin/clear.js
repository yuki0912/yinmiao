const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const REPLY_DELETE_DELAY_MS = 6000;

function scheduleReplyDeletion(interaction) {
    setTimeout(() => {
        interaction.deleteReply().catch(() => {});
    }, REPLY_DELETE_DELAY_MS);
}

async function editReplyAndScheduleDeletion(interaction, content) {
    await interaction.editReply({ content });
    scheduleReplyDeletion(interaction);
}

function getFailureMessage(error) {
    if (error.code === 50013 || error.code === 50001) {
        return '銀喵缺少必要權限。請確認 Bot 擁有「查看頻道」、「讀取訊息歷史」及「管理訊息」權限。';
    }

    if (error.code === 10003) {
        return '找不到目前頻道，請確認頻道仍然存在且銀喵有權限存取。';
    }

    if (error.message === 'CLEAR_USER_PERMISSION') {
        return '你沒有「管理訊息」權限，無法使用此指令。';
    }

    if (error.message === 'CLEAR_BOT_PERMISSION') {
        return '銀喵缺少「查看頻道」、「讀取訊息歷史」或「管理訊息」權限。';
    }

    return '清理訊息時發生錯誤，請確認頻道及 Bot 權限後再試。' +
        (error.code ? '\n錯誤代碼：' + error.code : '');
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

        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            return;
        }

        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                throw new Error('CLEAR_USER_PERMISSION');
            }

            if (!interaction.guild || !interaction.channel?.messages) {
                throw new Error('目前頻道不支援訊息清理。');
            }

            const botMember = interaction.guild.members.me ||
                await interaction.guild.members.fetchMe().catch(() => null);
            const botPermissions = botMember &&
                interaction.channel.permissionsFor(botMember);

            if (!botPermissions || !botPermissions.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
            ])) {
                throw new Error('CLEAR_BOT_PERMISSION');
            }

            const messages = await interaction.channel.messages.fetch({ limit: amount });

            let matchedMessages = messages.filter(message => !message.pinned);

            if (targetUser) {
                matchedMessages = matchedMessages.filter(
                    message => message.author.id === targetUser.id
                );
            }

            const cutoff = Date.now() - TWO_WEEKS_MS;
            const recentMessages = matchedMessages.filter(
                message => message.createdTimestamp >= cutoff
            );
            const skippedOldCount = matchedMessages.size - recentMessages.size;

            let deletedCount = 0;

            if (recentMessages.size === 1) {
                await recentMessages.first().delete();
                deletedCount = 1;
            } else if (recentMessages.size >= 2) {
                const deletedMessages = await interaction.channel.bulkDelete(
                    recentMessages,
                    true
                );
                deletedCount = deletedMessages.size;
            }

            let replyText;

            if (targetUser) {
                replyText = deletedCount > 0
                    ? `🧹 清理完成！已刪除成員 ${targetUser} 的 **${deletedCount}** 則訊息。`
                    : `🧹 沒有找到可清理的 ${targetUser} 訊息，實際刪除 **0** 則。`;
            } else {
                replyText = deletedCount > 0
                    ? `🧹 清理完成！總共刪除了 **${deletedCount}** 則訊息。`
                    : '🧹 沒有找到可清理的訊息，實際刪除 **0** 則。';
            }

            if (skippedOldCount > 0) {
                replyText += `\n⏭️ 另有 **${skippedOldCount}** 則超過 14 天的訊息未刪除。`;
            }

            replyText += '\n（此提示將於 6 秒後自動刪除）';

            await editReplyAndScheduleDeletion(interaction, replyText);

        } catch (error) {
            if (error.code === 10008 || error.code === 10062) {
                return;
            }

            const errorMessage =
                '❌ 清理失敗：' + getFailureMessage(error) +
                '\n（此提示將於 6 秒後自動刪除）';

            try {
                await editReplyAndScheduleDeletion(interaction, errorMessage);
            } catch (replyError) {
                // 略過
            }
        }
    },
};