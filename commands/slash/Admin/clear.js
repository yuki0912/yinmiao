const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const AUTO_DELETE_DELAY = 5000;
const BULK_DELETE_AGE = 14 * 24 * 60 * 60 * 1000;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 只編輯已 defer 的原始互動回覆，不會再次呼叫 reply()。
 * 成功顯示結果後，5 秒再刪除這則回覆。
 */
async function finishInteraction(interaction, content) {
    try {
        await interaction.editReply({ content });
    } catch (error) {
        console.error('[clear] 更新結果訊息失敗:', error);
        return;
    }

    await sleep(AUTO_DELETE_DELAY);

    try {
        await interaction.deleteReply();
        console.log('[clear] 結果提示已自動刪除。');
    } catch (error) {
        if (error.code !== 10008 && error.code !== 10015) {
            console.error('[clear] 自動刪除結果提示失敗:', error);
        }
    }
}

/**
 * 由最新訊息往前分頁搜尋，取得指定數量的非釘選訊息。
 * 指定 user 時，會繼續往前找該成員的訊息，不只檢查第一頁。
 */
async function collectMessages(channel, amount, userId) {
    // 只檢查頻道最新 100 則訊息，不往更早的歷史訊息分頁搜尋。
    const batch = await channel.messages.fetch({ limit: 100 });
    const page = [...batch.values()]
        .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

    const messages = [];
    for (const message of page) {
        if (message.pinned) continue;
        if (userId && message.author.id !== userId) continue;

        messages.push(message);
        if (messages.length >= amount) break;
    }

    return {
        messages,
        scanned: page.length,
        reachedLimit: false
    };
}

/**
 * 刪除訊息：
 * - 14 天內且至少兩則：批量刪除。
 * - 單則或超過 14 天：逐則刪除。
 * - 10008 表示訊息已不存在，視為已達成刪除結果。
 */
async function deleteMessages(channel, messages) {
    const cutoff = Date.now() - BULK_DELETE_AGE;
    const recent = [];
    const old = [];

    for (const message of messages) {
        if (message.createdTimestamp > cutoff) recent.push(message);
        else old.push(message);
    }

    let deleted = 0;
    let failed = 0;

    async function deleteIndividually(list) {
        for (const message of list) {
            try {
                await message.delete();
                deleted++;
            } catch (error) {
                if (error.code === 10008) {
                    deleted++;
                } else {
                    failed++;
                    console.error('[clear] 刪除單則訊息失敗：' + message.id, error);
                }
            }
        }
    }

    if (recent.length >= 2 && typeof channel.bulkDelete === 'function') {
        try {
            const result = await channel.bulkDelete(recent, false);
            const deletedIds = new Set(result.keys());
            deleted += deletedIds.size;

            const remaining = recent.filter(message => !deletedIds.has(message.id));
            if (remaining.length) {
                await deleteIndividually(remaining);
            }
        } catch (error) {
            console.error('[clear] 批量刪除失敗，改為逐則刪除:', error);
            await deleteIndividually(recent);
        }
    } else {
        await deleteIndividually(recent);
    }

    await deleteIndividually(old);

    return {
        deleted,
        failed,
        oldCount: old.length
    };
}

module.exports = {
    category: 'Admin',

    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('清理頻道訊息（管理員專用）')
        .addIntegerOption(option =>
            option.setName('amount')
                .setNameLocalization('zh-TW', '數量')
                .setDescription('要刪除的訊息數量（1-100）')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .addUserOption(option =>
            option.setName('user')
                .setNameLocalization('zh-TW', '成員')
                .setDescription('只刪除指定成員的訊息（選填）')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        // 重要：整個指令只在這裡確認一次互動。
        // deferReply 若失敗，絕不再呼叫 reply()，避免 10062 / 40060 連鎖錯誤。
        try {
            await interaction.deferReply();
        } catch (error) {
            interaction.__yinmiaoAckHandled = true;

            if (error.code === 10062) {
                console.error('[clear] Discord 互動已逾時（10062），本次沒有開始刪除訊息。');
            } else if (error.code === 40060) {
                console.error('[clear] 互動已被其他處理程序確認（40060），為避免重複清理，本次停止。');
            } else {
                console.error('[clear] deferReply 確認互動失敗，本次停止：', error);
            }
            return;
        }

        try {
            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            await interaction.editReply({
                content: '⏳ 已收到清理請求，正在檢查權限喵！'
            });

            if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
                throw new Error('此指令只能在伺服器文字頻道中使用。');
            }

            const channel = interaction.channel;
            if (!channel.isTextBased?.() || !channel.messages?.fetch) {
                throw new Error('目前頻道不支援讀取訊息。');
            }

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                throw new Error('你沒有「管理訊息」權限，無法使用此指令。');
            }

            const botMember = interaction.guild.members.me
                || await interaction.guild.members.fetchMe().catch(() => null);
            const botPermissions = botMember && channel.permissionsFor(botMember);

            if (!botPermissions || !botPermissions.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
            ])) {
                throw new Error('銀喵缺少查看頻道、讀取訊息歷史或管理訊息權限。');
            }

            await interaction.editReply({
                content: targetUser
                    ? '🔎 正在搜尋 ' + targetUser.username + ' 的訊息喵！'
                    : '🔎 正在搜尋可刪除的訊息喵！'
            });

            const search = await collectMessages(
                channel,
                amount,
                targetUser ? targetUser.id : null
            );

            if (search.messages.length === 0) {
                let message = targetUser
                    ? 'ℹ️ 最新 100 則訊息中，沒有找到 ' + targetUser.username + ' 可刪除的訊息。'
                    : 'ℹ️ 最新 100 則訊息中，沒有找到可刪除的訊息。';

                message += '（釘選訊息會保留；不會搜尋更早的歷史訊息。）';
                message += '\n此提示將於 5 秒後自動刪除。';

                await finishInteraction(interaction, message);
                return;
            }

            await interaction.editReply({
                content: '🧹 找到 ' + search.messages.length + ' 則訊息，正在刪除喵！'
            });

            const result = await deleteMessages(channel, search.messages);
            const requestedBy = targetUser ? targetUser.username + ' 的 ' : '';
            let summary = result.failed === 0
                ? '✅ **清理成功！**\n🧹 已刪除 ' + requestedBy + '**' + result.deleted + '** / **' + search.messages.length + '** 則訊息。'
                : '⚠️ **清理部分完成**\n🧹 已刪除 ' + requestedBy + '**' + result.deleted + '** / **' + search.messages.length + '** 則訊息。';

            if (search.messages.length < amount) {
                summary += '\n最新 100 則訊息中只有 ' + search.messages.length + ' 則符合條件；不會繼續搜尋更早的歷史訊息。';
            }
            if (result.oldCount > 0) {
                summary += '\n其中 ' + result.oldCount + ' 則超過 14 天，已逐則刪除。';
            }
            if (result.failed > 0) {
                summary += '\n⚠️ ' + result.failed + ' 則訊息刪除失敗，請檢查 Bot 權限及後台 Log。';
            }
            summary += '\n此提示將於 5 秒後自動刪除。';

            await finishInteraction(interaction, summary);
        } catch (error) {
            console.error('[clear] 指令執行失敗:', error);

            const message = error.code === 50013
                ? '❌ 銀喵缺少必要權限，請確認頻道權限設定。'
                : '❌ 清理訊息失敗：' + (error.message || '未知錯誤。');

            // deferReply 已成功，錯誤處理只准 editReply，不可再次 reply。
            await finishInteraction(interaction, message);
        }
    }
};
