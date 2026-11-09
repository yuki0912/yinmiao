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

    // 回傳機器人 ID，保留對既有指令的相容性。
    if (!botMember?.id) throw new Error('CLEAR_BOT_PERMISSION');
    return botMember.id;
}

// amount 是「最多實際刪除 N 則訊息」，而不是只檢查最新 N 則。
// 向前翻頁找可清理的訊息，避免最新訊息都是銀喵發出時刪除 0 則。
const MAX_SCAN_MESSAGES = 1000;

async function clearChannelMessages({
    channel, amount, targetUserId = null, excludeMessageId = null, botUserId
}) {
    // botUserId 保留供舊版呼叫端相容；只保護明確指定的訊息 ID。
    const candidates = new Collection();
    const cutoff = Date.now() - TWO_WEEKS_MS + AGE_MARGIN_MS;
    const limitPerPage = 100;

    let scanned = 0;
    let matched = 0;
    let skippedBot = 0;
    let skippedPinned = 0;
    let skippedOld = 0;
    let skippedUndeletable = 0;
    let before;
    let stoppedAtOldMessage = false;

    while (candidates.size < amount && scanned < MAX_SCAN_MESSAGES) {
        const limit = Math.min(limitPerPage, MAX_SCAN_MESSAGES - scanned);
        const query = { limit };
        if (before) query.before = before;

        const page = await channel.messages.fetch(query);
        if (!page?.size) break;

        scanned += page.size;
        const oldestMessage = page.last();

        for (const [id, message] of page) {
            if (id === excludeMessageId) continue;

            // 訊息由新到舊排序；遇到超過 14 天的訊息即可停止搜尋。
            if (message.createdTimestamp <= cutoff) {
                stoppedAtOldMessage = true;
                if (!targetUserId || message.author?.id === targetUserId) skippedOld++;
                break;
            }

            if (targetUserId && message.author?.id !== targetUserId) continue;
            matched++;

            if (message.pinned) {
                skippedPinned++;
                continue;
            }
            if (message.deletable === false) {
                skippedUndeletable++;
                continue;
            }

            candidates.set(id, message);
            if (candidates.size >= amount) break;
        }

        if (stoppedAtOldMessage || candidates.size >= amount || page.size < limit) break;
        if (!oldestMessage?.id || oldestMessage.id === before) break;

        before = oldestMessage.id;
    }

    let deleted = 0;
    let disappeared = 0;

    if (candidates.size === 1) {
        try {
            await candidates.first().delete();
            deleted = 1;
        } catch (error) {
            if (error.code !== 10008) throw error;
            disappeared = 1;
        }
    } else if (candidates.size > 1) {
        const removed = await channel.bulkDelete([...candidates.keys()], true);
        deleted = Array.isArray(removed) ? removed.length : removed?.size;
        if (!Number.isInteger(deleted)) {
            throw new Error('CLEAR_UNKNOWN_DELETE_RESULT');
        }
        disappeared = Math.max(0, candidates.size - deleted);
    }

    return {
        requested: amount,
        inspected: scanned,
        matched,
        deleted,
        skippedBot,
        skippedPinned,
        skippedOld,
        skippedUndeletable,
        disappeared,
        scanLimitReached: scanned >= MAX_SCAN_MESSAGES && candidates.size < amount,
        stoppedAtOldMessage
    };
}

function formatClearResult(result, targetUserId = null, deleteAfterSeconds = 6) {
    const target = targetUserId ? '成員 <@' + targetUserId + '> 的' : '';
    let content = result.deleted
        ? '🧹 清理完成！實際刪除了' + target + ' **' + result.deleted + '** 則訊息。'
        : '🧹 沒有找到可刪除的訊息，實際刪除 **0** 則。';

    if (!result.deleted) {
        if (!result.inspected) {
            content += '\nℹ️ 頻道內沒有可供檢查的訊息。';
        } else if (targetUserId && !result.matched) {
            content += '\nℹ️ 搜尋範圍內沒有找到指定成員近期可刪除的訊息。';
        }
    }


    if (result.skippedPinned) content += '\n📌 跳過 ' + result.skippedPinned + ' 則釘選訊息。';
    if (result.skippedOld) content += '\n⏭️ 跳過 ' + result.skippedOld + ' 則接近或超過 14 天的訊息。';
    if (result.skippedUndeletable) content += '\n🔒 跳過 ' + result.skippedUndeletable + ' 則不可刪除的訊息。';
    if (result.disappeared) content += '\nℹ️ ' + result.disappeared + ' 則訊息可能已被其他操作刪除，未計入數量。';

    if (result.scanLimitReached) {
        content += '\n🔎 已搜尋最多 1000 則歷史訊息，未繼續向前清理。';
    }
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
