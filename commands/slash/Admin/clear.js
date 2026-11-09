const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const {
    REPLY_DELETE_DELAY_MS, parseAmount, checkClearPermissions,
    clearChannelMessages, formatClearResult, getClearErrorMessage
} = require('../../../utils/clearMessages');

function logClearError(stage, interaction, error) {
    console.error('[clear/slash] ' + stage + ':', {
        interactionId: interaction.id,
        code: error.code,
        message: error.message
    }, error);
}

function autoDeleteReply(interaction, messageId = '@original') {
    setTimeout(async () => {
        try {
            await interaction.deleteReply(messageId);
        } catch (error) {
            if (![10008, 10062, 50027].includes(error.code)) {
                logClearError('自動刪除提示失敗', interaction, error);
            }
        }
    }, REPLY_DELETE_DELAY_MS);
}

async function sendClearResult(interaction, content) {
    const payload = { content, allowedMentions: { parse: [] } };
    let messageId = '@original';

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        }
    } catch (error) {
        if (error.code !== 10008 || (!interaction.deferred && !interaction.replied)) throw error;

        const followUp = await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral });
        if (!followUp?.id) {
            console.warn('[clear/slash] 補發回覆沒有可刪除的訊息 ID:', interaction.id);
            return;
        }
        messageId = followUp.id;
    }

    autoDeleteReply(interaction, messageId);
}

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('刪除最近訊息（管理訊息權限）')
        .addIntegerOption(option => option.setName('amount')
            .setNameLocalization('zh-TW', '數量')
            .setDescription('檢查最近 1～100 則訊息')
            .setRequired(true).setMinValue(1).setMaxValue(100))
        .addUserOption(option => option.setName('user')
            .setNameLocalization('zh-TW', '成員')
            .setDescription('只刪除指定成員在範圍內的訊息（選填）')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            // 必須先在 Discord 的 3 秒期限內確認互動，再進行訊息存取。
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            logClearError('互動確認失敗', interaction, error);
            // 無法確認互動就不執行刪除，避免已刪除卻不能回報。
            if (![10062, 40060, 50027].includes(error.code) &&
                !interaction.deferred && !interaction.replied) {
                try {
                    await sendClearResult(interaction,
                        '❌ 無法確認指令，請重新執行。\n（此提示將於 6 秒後自動刪除）');
                } catch (replyError) {
                    logClearError('互動確認失敗提示無法發送', interaction, replyError);
                }
            }
            return;
        }

        let resultText;
        try {
            const amount = parseAmount(interaction.options.getInteger('amount'));
            const targetUserId = interaction.options.getUser('user')?.id || null;

            await checkClearPermissions(
                interaction.guild, interaction.channel, interaction.memberPermissions
            );
            const stats = await clearChannelMessages({
                channel: interaction.channel, amount, targetUserId
            });
            resultText = formatClearResult(stats, targetUserId);

            console.log('[clear/slash] 清理完成:', {
                interactionId: interaction.id, guildId: interaction.guild.id, ...stats
            });
        } catch (error) {
            logClearError('清理失敗', interaction, error);
            resultText = '❌ 清理失敗：' + getClearErrorMessage(error) +
                '\n（此提示將於 6 秒後自動刪除）';
        }

        // 清理與回覆分開處理：Discord 回覆失敗不代表訊息沒刪除。
        try {
            await sendClearResult(interaction, resultText);
        } catch (error) {
            logClearError('傳送結果失敗', interaction, error);
        }
    }
};
