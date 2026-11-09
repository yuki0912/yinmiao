const { Collection, PermissionFlagsBits } = require('discord.js');

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
const AGE_MARGIN_MS = 60 * 1000;
const REPLY_DELETE_DELAY_MS = 6000;

function parseAmount(value) {
    const input = String(value ?? '').trim();
    if (!/^(?:[1-9]|[1-9][0-9]|100)$/.test(input)) {
        throw new Error('CLEAR_INVALID_AMOUNT');
    }
    return Number(input);
}

async function checkClearPermissions(guild, channel, memberPermissions) {
    if (!memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
        throw new Error('CLEAR_USER_PERMISSION');
    }
    if (!guild || typeof channel?.messages?.fetch !== 'function' ||
        typeof channel.bulkDelete !== 'function') {
        throw new Error('CLEAR_UNSUPPORTED_CHANNEL');
    }

    const botMember = guild.members.me ||
        await guild.members.fetchMe().catch(() => null);
    const permissions = botMember && channel.permissionsFor(botMember);

    if (!permissions?.has([
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.ReadMessageHistory,
        PermissionFlagsBits.ManageMessages
    ])) {
        throw new Error('CLEAR_BOT_PERMISSION');
    }

    // 回傳銀喵自己的 ID，讓兩種 clear 都不會刪到 Bot 的任何訊息。
    if (!botMember?.id) throw new Error('CLEAR_BOT_PERMISSION');
    return botMember.id;
}

// amount 表示「檢查最近 N 則非指令訊息」，不是無限制向前翻找符合條件的訊息。
async function fetchRecentMessages(channel, amount, excludeMessageId = null) {
    const messages = await channel.messages.fetch({
        limit: Math.min(100, amount + (excludeMessageId ? 1 : 0))
    });
    const result = new Collection();

    for (const [id, message] of messages) {
        if (id !== excludeMessageId && result.size < amount) result.set(id, message);
    }

    // 100 則上限下，如果仍抓到前綴指令本身，向前再補抓最多一則。
    if (excludeMessageId && messages.has(excludeMessageId) &&
        result.size < amount && messages.size === 100) {
        const oldest = messages.last();
        if (oldest) {
            const older = await channel.messages.fetch({
                limit: Math.min(100, amount - result.size),
                before: oldest.id
            });
            for (const [id, message] of older) {
                if (id !== excludeMessageId && result.size < amount) result.set(id, message);
            }
        }
    }

    return result;
}

async function clearChannelMessages({
    channel, amount, targetUserId = null, excludeMessageId = null, botUserId
}) {
    // 如果無法識別銀喵的 ID，不冒險執行批次刪除。
    if (!botUserId) throw new Error('CLEAR_BOT_PERMISSION');

    const messages = await fetchRecentMessages(channel, amount, excludeMessageId);
    const selected = messages.filter(m => !targetUserId || m.author?.id === targetUserId);

    // 保護銀喵的所有訊息，包括正在回應的 /clear 公開訊息。
    const skippedBot = selected.filter(m => m.author?.id === botUserId).size;
    const otherMessages = selected.filter(m => m.author?.id !== botUserId);
    const skippedPinned = otherMessages.filter(m => m.pinned).size;
    const unpinned = otherMessages.filter(m => !m.pinned);
    const cutoff = Date.now() - TWO_WEEKS_MS + AGE_MARGIN_MS;
    const skippedOld = unpinned.filter(m => m.createdTimestamp <= cutoff).size;
    const recent = unpinned.filter(m => m.createdTimestamp > cutoff);
    const skippedUndeletable = recent.filter(m => m.deletable === false).size;
    const eligible = recent.filter(m => m.deletable !== false);

    let deleted = 0;
    let disappeared = 0;
    if (eligible.size === 1) {
        try {
            await eligible.first().delete();
            deleted = 1;
        } catch (error) {
            if (error.code !== 10008) throw error;
            disappeared = 1;
        }
    } else if (eligible.size > 1) {
        // Discord 的 bulkDelete 回傳成功刪除的 Collection；不能用請求量代替結果。
        const removed = await channel.bulkDelete(eligible, true);
        deleted = removed.size;
        disappeared = Math.max(0, eligible.size - deleted);
    }

    return {
        requested: amount, inspected: messages.size, matched: selected.size, deleted,
        skippedBot, skippedPinned, skippedOld, skippedUndeletable, disappeared
    };
}

function formatClearResult(result, targetUserId = null, deleteAfterSeconds = 6) {
    const target = targetUserId ? '成員 <@' + targetUserId + '> 的' : '';
    let content = '🧹 清理完成！實際刪除了' + target + ' **' + result.deleted + '** 則訊息。';

    if (result.skippedBot) content += '\n🤖 已保留銀喵自己發出的 ' + result.skippedBot + ' 則訊息。';
    if (result.skippedPinned) content += '\n📌 跳過 ' + result.skippedPinned + ' 則釘選訊息。';
    if (result.skippedOld) content += '\n⏭️ 跳過 ' + result.skippedOld + ' 則接近或超過 14 天的訊息。';
    if (result.skippedUndeletable) content += '\n🔒 跳過 ' + result.skippedUndeletable + ' 則不可刪除的訊息。';
    if (result.disappeared) content += '\nℹ️ ' + result.disappeared + ' 則訊息可能已被其他操作刪除，未計入數量。';

    return content + '\n（此提示將於 ' + deleteAfterSeconds + ' 秒後自動刪除）';
}

function getClearErrorMessage(error) {
    if (error.message === 'CLEAR_INVALID_AMOUNT') return '數量必須是 1～100 的整數。';
    if (error.message === 'CLEAR_INVALID_TARGET') return '指定成員時，請使用 @提及，例如：s!clear 10 @成員。';
    if (error.message === 'CLEAR_USER_PERMISSION') return '你沒有「管理訊息」權限。';
    if (error.message === 'CLEAR_BOT_PERMISSION' || [50013, 50001].includes(error.code)) {
        return '銀喵缺少查看頻道、讀取訊息歷史或管理訊息的權限。';
    }
    if (error.message === 'CLEAR_UNSUPPORTED_CHANNEL') return '此頻道不支援清理訊息。';
    if (error.code === 10008) return '部分訊息可能已被其他操作刪除；實際刪除數量無法確認。';
    if (error.code === 50034) return 'Discord 不允許批次刪除超過 14 天的訊息。';
    if (error.code === 10062 || error.code === 40060) return 'Discord 互動已逾時或被確認，請重新執行。';
    if (error.code === 50027) return 'Discord 互動憑證已失效，請重新執行。';
    if (error.code === 10003) return '找不到指定頻道。';
    return '清理訊息時發生錯誤，可能有部分訊息已刪除，請檢查頻道後重試。' +
        (error.code ? '\n錯誤代碼：' + error.code : '');
}

module.exports = {
    REPLY_DELETE_DELAY_MS, parseAmount, checkClearPermissions,
    clearChannelMessages, formatClearResult, getClearErrorMessage
};
