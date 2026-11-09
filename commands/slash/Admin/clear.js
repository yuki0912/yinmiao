const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const REPLY_DELETE_DELAY_MS = 6000;

function scheduleReplyDeletion(interaction, replyId = '@original') {
    setTimeout(async () => {
        try {
            await interaction.deleteReply(replyId);
        } catch (error) {
            // 回覆已被刪除、互動過期或 Token 失效時無需重複處理。
            if (![10008, 10062, 50027].includes(error.code)) {
                console.error('[clear] 6 秒自動刪除提示失敗:', error);
            }
        }
    }, REPLY_DELETE_DELAY_MS);
}

// 顯示清理結果（僅自己可見），並針對已不存在的原始回覆嘗試補發。
async function sendResult(interaction, content) {
    let replyId = '@original';

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content, allowedMentions: { parse: [] } });
        } else {
            await interaction.reply({
                content,
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] }
            });
        }
    } catch (error) {
        if (error.code !== 10008 || (!interaction.deferred && !interaction.replied)) {
            throw error;
        }

        console.warn('[clear] 原始回覆已不存在，嘗試使用 followUp:', interaction.id);
        const followUp = await interaction.followUp({
            content,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] }
        });

        // followUp 的訊息 ID 必須指定，避免誤刪其他回覆。
        if (!followUp?.id) {
            console.warn('[clear] followUp 沒有可用的訊息 ID，無法安排自動刪除:', interaction.id);
            return;
        }
        replyId = followUp.id;
    }

    scheduleReplyDeletion(interaction, replyId);
}

function getFailureMessage(error) {
    if ([50013, 50001].includes(error.code) || error.message === 'CLEAR_BOT_PERMISSION') {
        return '銀喵缺少「查看頻道」、「讀取訊息歷史」或「管理訊息」權限。';
    }
    if (error.message === 'CLEAR_USER_PERMISSION') {
        return '你沒有「管理訊息」權限。';
    }
    if (error.message === 'CLEAR_UNSUPPORTED_CHANNEL') {
        return '這個頻道不支援清理訊息。';
    }
    if (error.code === 10003) return '頻道可能已被刪除或無法存取。';
    if (error.code === 10008) return '部分訊息可能已被其他人或 Bot 刪除，請重新執行。';
    if (error.code === 10062) return 'Discord 指令互動已過期，請重新執行。';

    return '清理訊息時發生錯誤，請稍後再試。' +
        (error.code ? '\n錯誤代碼：' + error.code : '');
}

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('清理頻道訊息 (管理員專用)')
        .addIntegerOption(option => option
            .setName('amount')
            .setNameLocalization('zh-TW', '數量')
            .setDescription('檢查最近的訊息數量 (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100))
        .addUserOption(option => option
            .setName('user')
            .setNameLocalization('zh-TW', '成員')
            .setDescription('僅刪除指定成員的訊息 (選填)')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');
        const targetUser = interaction.options.getUser('user');

        // 第一時間確認互動；若確認失敗，務必記錄錯誤原因。
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } catch (error) {
            console.error('[clear] 無法確認互動:', {
                interactionId: interaction.id,
                code: error.code,
                message: error.message
            }, error);

            if ([10062, 40060, 50027].includes(error.code)) return;
            if (!interaction.deferred && !interaction.replied) {
                try {
                    await sendResult(interaction, '❌ 指令互動確認失敗，請重新執行。\n（此提示將於 6 秒後自動刪除）');
                } catch (replyError) {
                    console.error('[clear] 無法回覆互動確認錯誤:', replyError);
                }
            }
            return;
        }

        try {
            if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
                throw new Error('CLEAR_INVALID_AMOUNT');
            }
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                throw new Error('CLEAR_USER_PERMISSION');
            }
            if (!interaction.guild || !interaction.channel?.messages?.fetch ||
                typeof interaction.channel.bulkDelete !== 'function') {
                throw new Error('CLEAR_UNSUPPORTED_CHANNEL');
            }

            const botMember = interaction.guild.members.me ||
                await interaction.guild.members.fetchMe().catch(() => null);
            const botPermissions = botMember && interaction.channel.permissionsFor(botMember);

            if (!botPermissions?.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
            ])) {
                throw new Error('CLEAR_BOT_PERMISSION');
            }

            const messages = await interaction.channel.messages.fetch({ limit: amount });
            let matched = messages.filter(message => !message.pinned);

            if (targetUser) {
                matched = matched.filter(message => message.author.id === targetUser.id);
            }

            // Discord Bulk Delete 僅適用 14 天內、一次至少 2 則的訊息。
            const cutoff = Date.now() - TWO_WEEKS_MS;
            const recent = matched.filter(message => message.createdTimestamp > cutoff);
            const skippedOld = matched.size - recent.size;

            let deletedCount = 0;
            if (recent.size === 1) {
                await recent.first().delete();
                deletedCount = 1;
            } else if (recent.size >= 2) {
                const deleted = await interaction.channel.bulkDelete(recent, true);
                deletedCount = deleted.size;
            }

            let result;
            if (targetUser) {
                result = deletedCount > 0
                    ? '🧹 清理完成！已刪除 ' + targetUser.username + ' 的 **' + deletedCount + '** 則訊息。'
                    : '🧹 沒有找到可刪除的 ' + targetUser.username + ' 訊息，實際刪除 **0** 則。';
            } else {
                result = deletedCount > 0
                    ? '🧹 清理完成！總共刪除了 **' + deletedCount + '** 則訊息。'
                    : '🧹 沒有找到可刪除的訊息，實際刪除 **0** 則。';
            }

            if (skippedOld > 0) {
                result += '\n⏭️ 另有 **' + skippedOld + '** 則超過 14 天的訊息未刪除。';
            }

            console.log('[clear] 清理完成:', {
                interactionId: interaction.id,
                guildId: interaction.guild.id,
                requested: amount,
                matched: matched.size,
                deleted: deletedCount,
                skippedOld
            });
            await sendResult(interaction, result + '\n（此提示將於 6 秒後自動刪除）');

        } catch (error) {
            console.error('[clear] 清理失敗:', {
                interactionId: interaction.id,
                code: error.code,
                message: error.message
            }, error);

            try {
                await sendResult(
                    interaction,
                    '❌ 清理失敗：' + getFailureMessage(error) +
                        '\n（此提示將於 6 秒後自動刪除）'
                );
            } catch (replyError) {
                console.error('[clear] 無法顯示失敗提示:', {
                    interactionId: interaction.id,
                    code: replyError.code,
                    message: replyError.message
                }, replyError);
            }
        }
    }
};
