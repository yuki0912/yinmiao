const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    parseAmount, checkClearPermissions, clearChannelMessages,
    formatClearResult, getClearErrorMessage
} = require('../../../utils/clearMessages');

const RESULT_DELETE_MS = 5000;

function reportError(stage, interaction, error) {
    console.error('[clear/slash] ' + stage + ':', {
        interactionId: interaction.id,
        code: error.code,
        message: error.message
    }, error);
}

// 公開回覆，並在 5 秒後只刪除這次的結果訊息。
function deleteResultLater(interaction, messageId = '@original') {
    const timer = setTimeout(async () => {
        try {
            if (messageId === '@original') {
                await interaction.deleteReply();
            } else {
                await interaction.webhook.deleteMessage(messageId);
            }
        } catch (error) {
            if (![10008, 10062, 50027].includes(error.code)) {
                reportError('自動刪除結果失敗', interaction, error);
            }
        }
    }, RESULT_DELETE_MS);
    timer.unref?.();
}

async function replyPublicly(interaction, content) {
    const payload = { content, allowedMentions: { parse: [] } };
    let resultMessageId = '@original';

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (error) {
        // 原始回覆已不存在時，改成公開補發，並記錄補發的訊息 ID。
        if (error.code !== 10008 || (!interaction.deferred && !interaction.replied)) {
            throw error;
        }
        const followUp = await interaction.followUp(payload);
        if (!followUp?.id) {
            console.warn('[clear/slash] 補發回覆沒有訊息 ID，無法自動刪除:', interaction.id);
            return;
        }
        resultMessageId = followUp.id;
    }

    deleteResultLater(interaction, resultMessageId);
}

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('清理頻道訊息（公開顯示數量，5 秒後自動刪除提示）')
        .addIntegerOption(opt => opt.setName('amount')
            .setNameLocalization('zh-TW', '數量')
            .setDescription('希望刪除的訊息數量 (1-100)')
            .setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(opt => opt.setName('user')
            .setNameLocalization('zh-TW', '成員')
            .setDescription('僅刪除指定成員的訊息（選填）')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // Discord 要求 3 秒內回應；不設定 ephemeral，所有成員都能看到結果。
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (error) {
            reportError('確認互動失敗', interaction, error);
            if (![10062, 40060, 50027].includes(error.code) &&
                !interaction.deferred && !interaction.replied) {
                try {
                    await replyPublicly(interaction,
                        '❌ 無法確認指令，請重新執行。\n（此提示將於 5 秒後自動刪除）');
                } catch (replyError) {
                    reportError('確認失敗後無法回覆', interaction, replyError);
                }
            }
            return;
        }

        let result;
        try {
            const amount = parseAmount(interaction.options.getInteger('amount'));
            const targetUserId = interaction.options.getUser('user')?.id || null;
            const botUserId = await checkClearPermissions(
                interaction.guild, interaction.channel, interaction.memberPermissions
            );

            // 保護本次 Slash Command 的公開結果提示，不會把它當作清理目標。
            // 其他普通 Bot 訊息仍可依照 amount 刪除。
            const originalReply = await interaction.fetchReply();
            const summary = await clearChannelMessages({
                channel: interaction.channel, amount, targetUserId, botUserId,
                excludeMessageId: originalReply.id
            });

            result = formatClearResult(summary, targetUserId, 5);
            console.log('[clear/slash] 完成:', {
                guildId: interaction.guild.id,
                interactionId: interaction.id,
                ...summary
            });
        } catch (error) {
            reportError('刪除訊息失敗', interaction, error);
            result = '❌ 清理失敗：' + getClearErrorMessage(error) +
                '\n（此提示將於 5 秒後自動刪除）';
        }

        // 回覆出錯不會再次執行刪除，避免重複清理。
        try {
            await replyPublicly(interaction, result);
        } catch (error) {
            reportError('無法公開顯示結果', interaction, error);
        }
    }
};
