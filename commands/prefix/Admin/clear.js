const { PermissionFlagsBits } = require('discord.js');
const {
    REPLY_DELETE_DELAY_MS, parseAmount, checkClearPermissions,
    clearChannelMessages, formatClearResult, getClearErrorMessage
} = require('../../../utils/clearMessages');

async function sendTemporary(channel, content) {
    const reply = await channel.send({
        content,
        allowedMentions: { parse: [] }
    });
    setTimeout(() => {
        reply.delete().catch(error => {
            if (![10008, 10062].includes(error.code)) {
                console.error('[clear/prefix] 6 秒後刪除提示失敗:', error);
            }
        });
    }, REPLY_DELETE_DELAY_MS);
}

module.exports = {
    name: 'clear',
    aliases: ['purge', '清除', '🧹'],
    category: 'Admin',
    description: '刪除最近訊息：s!clear 10 [@成員]（管理訊息權限、提示 6 秒自動刪除）',

    async execute(message, args, client) {
        let text;
        try {
            const amount = parseAmount(args[0]);
            let targetUserId = null;

            if (args.length > 2) throw new Error('CLEAR_INVALID_TARGET');
            if (args.length === 2) {
                const match = /^<@!?([0-9]{15,25})>$/.exec(args[1]);
                if (!match) throw new Error('CLEAR_INVALID_TARGET');
                targetUserId = match[1];
            }

            await checkClearPermissions(
                message.guild, message.channel, message.member?.permissions
            );

            // 清除指令訊息本身（不算進使用者要求的 amount）。
            // 即使訊息已被其他 Bot 刪除，仍可繼續執行清理。
            let deletedCommand = false;
            try {
                await message.delete();
                deletedCommand = true;
            } catch (error) {
                if (error.code !== 10008) {
                    console.warn('[clear/prefix] 無法刪除指令訊息:', error);
                }
            }

            const stats = await clearChannelMessages({
                channel: message.channel,
                amount, targetUserId,
                excludeMessageId: message.id
            });
            text = formatClearResult(stats, targetUserId);

            console.log('[clear/prefix] 清理完成:', {
                guildId: message.guild.id, moderator: message.author.id,
                commandDeleted: deletedCommand, ...stats
            });
        } catch (error) {
            console.error('[clear/prefix] 清理失敗:', {
                guildId: message.guild?.id, code: error.code, message: error.message
            }, error);
            text = '❌ 清理失敗：' + getClearErrorMessage(error) +
                '\n（此提示將於 6 秒後自動刪除）';
        }

        // 不使用 message.reply()：原本的指令訊息可能已被刪除。
        try {
            await sendTemporary(message.channel, text);
        } catch (error) {
            console.error('[clear/prefix] 無法傳送結果:', error);
        }
    }
};
