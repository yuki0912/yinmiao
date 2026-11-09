const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const AGE_SAFETY_MARGIN_MS = 60 * 1000;
const REPLY_DELETE_DELAY_MS = 6000;

function logError(label, interaction, error) {
    console.error('[clear] ' + label + ':', {
        interactionId: interaction.id,
        code: error.code,
        message: error.message
    }, error);
}

function scheduleReplyDeletion(interaction, messageId = '@original') {
    setTimeout(async () => {
        try {
            await interaction.deleteReply(messageId);
        } catch (error) {
            if (![10008, 10062, 50027].includes(error.code)) {
                logError('6 秒後刪除提示失敗', interaction, error);
            }
        }
    }, REPLY_DELETE_DELAY_MS);
}

async function sendResult(interaction, content) {
    const payload = { content, allowedMentions: { parse: [] } };
    let replyId = '@original';

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        if (error.code !== 10008 || (!interaction.deferred && !interaction.replied)) throw error;

        // 原始回覆被刪除後，盡可能使用私密 followUp 回報結果。
        console.warn('[clear] 原始回覆不存在，嘗試補發:', interaction.id);
        const followUp = await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
        if (!followUp?.id) {
            console.warn('[clear] 無法取得補發訊息 ID，因此略過自動刪除:', interaction.id);
            return;
        }
        replyId = followUp.id;
    }

    scheduleReplyDeletion(interaction, replyId);
}

function getFailureMessage(error) {
    if (error.message === 'CLEAR_USER_PERMISSION') {
        return '你沒有「管理訊息」權限。';
    }
    if (error.message === 'CLEAR_BOT_PERMISSION' || [50013, 50001].includes(error.code)) {
        return '銀喵缺少「查看頻道」、「讀取訊息歷史」或「管理訊息」權限。';
    }
    if (error.message === 'CLEAR_UNSUPPORTED_CHANNEL') {
        return '這個頻道不支援清理訊息。';
    }
    if (error.message === 'CLEAR_INVALID_AMOUNT') {
        return '請輸入 1 至 100 的訊息數量。';
    }
    if (error.code === 10003) return '找不到頻道，請檢查頻道與 Bot 權限。';
    if (error.code === 10008) return '有訊息已被其他人刪除，可能已有部分訊息清除；無法確認本次實際刪除數量。';
    if (error.code === 50034) return 'Discord 不允許批次刪除超過 14 天的訊息，請重新執行。';
    if (error.code === 10062) return 'Discord 指令互動已過期，請重新執行。';

    return '清理過程發生錯誤，請稍後重試。' +
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
        // Discord 必須在 3 秒內收到初始確認。
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            logError('無法確認互動', interaction, error);
            if (![10062, 40060, 50027].includes(error.code) &&
                !interaction.deferred && !interaction.replied) {
                try {
                    await sendResult(interaction, '❌ 無法確認指令互動，請再試一次。\n（此提示將於 6 秒後自動刪除）');
                } catch (replyError) {
                    logError('無法發送互動確認失敗提示', interaction, replyError);
                }
            }
            // 避免互動失效後仍執行刪除動作。
            return;
        }

        let result;

        try {
            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

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
                matched = matched.filter(message => message.author?.id === targetUser.id);
            }

            // 在 14 天限制前預留 1 分鐘緩衝，避免批次刪除碰到邊界值。
            const cutoff = Date.now() - TWO_WEEKS_MS + AGE_SAFETY_MARGIN_MS;
            const recent = matched.filter(message => message.createdTimestamp > cutoff);
            const skippedOld = matched.size - recent.size;

            let deletedCount = 0;
            let disappearedCount = 0;

            if (recent.size === 1) {
                try {
                    await recent.first().delete();
                    deletedCount = 1;
                } catch (error) {
                    if (error.code !== 10008) throw error;
                    // 訊息在抓取與刪除之間已消失；不能算作 Bot 刪除。
                    disappearedCount = 1;
                }
            } else if (recent.size >= 2) {
                const deleted = await interaction.channel.bulkDelete(recent, true);
                deletedCount = deleted.size;
            }

            const username = targetUser ? String(targetUser.username).slice(0, 80) : null;
            result = targetUser
                ? '🧹 清理完成！已刪除 ' + username + ' 的 **' + deletedCount + '** 則訊息。'
                : '🧹 清理完成！總共刪除了 **' + deletedCount + '** 則訊息。';

            if (skippedOld > 0) {
                result += '\n⏭️ **' + skippedOld + '** 則訊息已超過 14 天（含安全緩衝），未刪除。';
            }
            if (disappearedCount > 0) {
                result += '\nℹ️ **' + disappearedCount + '** 則訊息已由其他操作刪除，未計入數量。';
            }
            result += '\n（此提示將於 6 秒後自動刪除）';

            console.log('[clear] 清理完成:', {
                interactionId: interaction.id,
                guildId: interaction.guild.id,
                requested: amount,
                matched: matched.size,
                deleted: deletedCount,
                skippedOld,
                disappeared: disappearedCount
            });
        } catch (error) {
            logError('清理過程失敗', interaction, error);
            result = '❌ 清理失敗：' + getFailureMessage(error) +
                '\n（此提示將於 6 秒後自動刪除）';
        }

        // 回覆失敗不能反過來把已完成的刪除誤報成失敗，亦不能重複刪除。
        try {
            await sendResult(interaction, result);
        } catch (replyError) {
            logError('清理完成後無法傳送結果', interaction, replyError);
        }
    }
};
