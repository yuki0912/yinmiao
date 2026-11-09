const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const {
    parseAmount, checkClearPermissions, clearChannelMessages,
    formatClearResult, getClearErrorMessage
} = require('../../../utils/clearMessages');

const REPLY_DELETE_DELAY_MS = 5000;

function logClearError(stage, interaction, error) {
    console.error('[clear/slash] ' + stage + ':', {
        interactionId: interaction.id,
        code: error.code,
        message: error.message
    }, error);
}

function deleteResultAfterFiveSeconds(interaction, replyId = '@original') {
    setTimeout(async () => {
        try {
            await interaction.deleteReply(replyId);
        } catch (error) {
            if (![10008, 10062, 50027].includes(error.code)) {
                logClearError('5 秒後自動刪除提示失敗', interaction, error);
            }
        }
    }, REPLY_DELETE_DELAY_MS);
}

// 公開回覆：不設定 MessageFlags.Ephemeral，所有能看到頻道的成員都能看見。
async function sendPublicResult(interaction, content) {
    const payload = { content, allowedMentions: { parse: [] } };
    let replyId = '@original';

    try {
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(payload);
        } else {
            await interaction.reply(payload);
        }
    } catch (error) {
        if (error.code !== 10008 || (!interaction.deferred && !interaction.replied)) {
            throw error;
        }

        console.warn('[clear/slash] 原始回覆不存在，改為公開補發:', interaction.id);
        const reply = await interaction.followUp(payload);
        if (!reply?.id) {
            console.warn('[clear/slash] 無法取得補發訊息 ID，無法安排自動刪除:', interaction.id);
            return;
        }
        replyId = reply.id;
    }

    deleteResultAfterFiveSeconds(interaction, replyId);
}

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('刪除頻道訊息，公開顯示數量，5 秒後刪除提示')
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
            .setDescription('只刪除指定成員的訊息 (選填)')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            // Discord 要求 3 秒內確認互動；這是公開的延遲回覆。
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (error) {
            logClearError('互動確認失敗', interaction, error);
            if (![10062, 40060, 50027].includes(error.code) &&
                !interaction.deferred && !interaction.replied) {
                try {
                    await sendPublicResult(
                        interaction,
                        '❌ 無法確認清理指令，請重新執行。\n（此提示將於 5 秒後自動刪除）'
                    );
                } catch (replyError) {
                    logClearError('無法回覆互動確認失敗', interaction, replyError);
                }
            }
            return;
        }

        let resultText;

        try {
            const amount = parseAmount(interaction.options.getInteger('amount'));
            const targetUserId = interaction.options.getUser('user')?.id || null;

            const botUserId = await checkClearPermissions(
                interaction.guild, interaction.channel, interaction.memberPermissions
            );

            // 公開 deferReply 產生的 Bot 回覆也在頻道中：排除這則訊息，
            // 並同時保護銀喵以往發過的所有訊息。
            const originalReply = await interaction.fetchReply().catch(error => {
                console.warn('[clear/slash] 取得原始回覆 ID 失敗，仍會保護 Bot 訊息:', error.code);
                return null;
            });
            const stats = await clearChannelMessages({
                channel: interaction.channel, amount, targetUserId,
                botUserId, excludeMessageId: originalReply?.id || null
            });
            resultText = formatClearResult(stats, targetUserId, 5);

            console.log('[clear/slash] 清理完成:', {
                interactionId: interaction.id,
                guildId: interaction.guild.id,
                ...stats
            });
        } catch (error) {
            logClearError('清理失敗', interaction, error);
            resultText = '❌ 清理失敗：' + getClearErrorMessage(error) +
                '\n（此提示將於 5 秒後自動刪除）';
        }

        // 刪除與回覆分開；回覆失敗不代表已刪除的訊息需要重試。
        try {
            await sendPublicResult(interaction, resultText);
        } catch (error) {
            logClearError('公開回覆清理結果失敗', interaction, error);
        }
    }
};
