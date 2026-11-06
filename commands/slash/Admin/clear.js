const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

const AUTO_DELETE_DELAY = 5000;
const MAX_HISTORY_SCAN = 1000;
const DISCORD_BULK_DELETE_AGE = 14 * 24 * 60 * 60 * 1000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 更新原始互動回覆，並在 5 秒後刪除。
 * clear 會先 deferReply，因此進度、結果和錯誤都沿用同一則回覆。
 */
async function replyAndAutoDelete(interaction, content) {
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content });
    } else {
        await interaction.reply({ content });
    }

    await delay(AUTO_DELETE_DELAY);

    try {
        await interaction.deleteReply();
        console.log('[clear] 已自動刪除指令回覆。');
    } catch (error) {
        // 10008 = Unknown Message：訊息已不存在，不需要再處理。
        if (error.code !== 10008) {
            console.error('[clear] 自動刪除指令回覆失敗:', error);
        }
    }
}

/**
 * 往頻道較早的訊息分頁搜尋，直到找到 amount 則符合條件的訊息。
 * amount 指的是「符合條件且非釘選」的訊息數，不是搜尋訊息總數。
 * 為避免搜尋整個頻道造成過多 API 請求，最多檢查最近 1,000 則。
 */
async function fetchMessagesToClear(channel, amount, targetUserId) {
    const selected = [];
    let scannedCount = 0;
    let before;

    while (selected.length < amount && scannedCount < MAX_HISTORY_SCAN) {
        const limit = Math.min(100, MAX_HISTORY_SCAN - scannedCount);
        const options = { limit };
        if (before) options.before = before;

        const batch = await channel.messages.fetch(options);
        if (!batch.size) {
            break;
        }

        // 以時間排序，確保分頁游標永遠指向本頁最舊的一則訊息。
        const page = Array.from(batch.values())
            .sort((a, b) => b.createdTimestamp - a.createdTimestamp);

        for (const message of page) {
            scannedCount++;

            if (message.pinned) continue;
            if (targetUserId && message.author.id !== targetUserId) continue;

            selected.push(message);
            if (selected.length >= amount) break;
        }

        if (selected.length >= amount) break;

        const oldestMessage = page[page.length - 1];
        if (!oldestMessage || page.length < limit) break;

        before = oldestMessage.id;
    }

    return {
        messages: selected,
        scannedCount,
        scanLimitReached: scannedCount >= MAX_HISTORY_SCAN && selected.length < amount
    };
}

async function deleteSelectedMessages(channel, messages) {
    const cutoff = Date.now() - DISCORD_BULK_DELETE_AGE;
    const recentMessages = [];
    const oldMessages = [];

    for (const message of messages) {
        if (message.createdTimestamp > cutoff) recentMessages.push(message);
        else oldMessages.push(message);
    }

    let deletedCount = 0;
    let failedCount = 0;

    const deleteOneByOne = async messageList => {
        for (const message of messageList) {
            try {
                await message.delete();
                deletedCount++;
            } catch (error) {
                failedCount++;
                console.error('[clear] 單則訊息刪除失敗:', message.id, error);
            }
        }
    };

    // Discord 批量刪除最多處理 100 則，且不接受超過 14 天的訊息。
    if (recentMessages.length >= 2 && typeof channel.bulkDelete === 'function') {
        try {
            const deleted = await channel.bulkDelete(recentMessages, false);
            deletedCount += deleted.size;

            // 批量結果若未包含所有指定訊息，剩餘訊息再逐則嘗試。
            const deletedIds = new Set(deleted.keys());
            const remainingMessages = recentMessages.filter(message => !deletedIds.has(message.id));
            if (remainingMessages.length) {
                await deleteOneByOne(remainingMessages);
            }
        } catch (error) {
            console.error('[clear] 批量刪除失敗，改為逐則刪除:', error);
            await deleteOneByOne(recentMessages);
        }
    } else {
        await deleteOneByOne(recentMessages);
    }

    // 超過 14 天的訊息只能逐則刪除。
    await deleteOneByOne(oldMessages);

    return {
        deletedCount,
        failedCount,
        oldMessageCount: oldMessages.length
    };
}

module.exports = {
    category: 'Admin',
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
            if (!interaction.inGuild() || !interaction.guild || !interaction.channel) {
                throw new Error('此指令只能在伺服器文字頻道中使用。');
            }

            const channel = interaction.channel;
            if (!channel.messages || typeof channel.messages.fetch !== 'function') {
                throw new Error('目前頻道不支援讀取訊息。');
            }

            // 先確認互動，避免搜尋歷史訊息時超過 Discord 的回覆期限。
            await interaction.deferReply();

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                throw new Error('你需要「管理訊息」權限才能使用此指令。');
            }

            const botMember = interaction.guild.members.me
                || await interaction.guild.members.fetchMe().catch(() => null);
            const permissions = botMember && channel.permissionsFor(botMember);

            if (!permissions || !permissions.has([
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.ManageMessages
            ])) {
                throw new Error('銀喵缺少查看頻道、讀取訊息歷史或管理訊息權限。');
            }

            await interaction.editReply({
                content: targetUser
                    ? '🔎 正在搜尋 ' + targetUser + ' 的訊息，請稍候喵！'
                    : '🔎 正在搜尋可清理的訊息，請稍候喵！'
            });

            const searchResult = await fetchMessagesToClear(
                channel,
                amount,
                targetUser ? targetUser.id : null
            );
            const filteredMessages = searchResult.messages;

            if (!filteredMessages.length) {
                let noMessagesText = targetUser
                    ? '🔎 已搜尋 ' + searchResult.scannedCount + ' 則訊息，沒有找到成員 ' + targetUser + ' 可刪除的訊息（釘選訊息會保留）。'
                    : '🔎 已搜尋 ' + searchResult.scannedCount + ' 則訊息，沒有找到可刪除的訊息（釘選訊息會保留）。';

                if (searchResult.scanLimitReached) {
                    noMessagesText += '\n已達最近 ' + MAX_HISTORY_SCAN + ' 則訊息的搜尋上限。';
                }

                noMessagesText += '\n（此提示將於 5 秒後自動刪除）';
                await replyAndAutoDelete(interaction, noMessagesText);
                return;
            }

            await interaction.editReply({
                content: '🧹 找到 ' + filteredMessages.length + ' 則符合條件的訊息，正在清理喵！'
            });

            const result = await deleteSelectedMessages(channel, filteredMessages);
            const targetText = targetUser ? '成員 ' + targetUser + ' 的 ' : '';
            let replyText = '🧹 已成功刪除 ' + targetText + '**' + result.deletedCount + '** / **' + filteredMessages.length + '** 則訊息。';

            if (filteredMessages.length < amount) {
                replyText += '\n只找到 ' + filteredMessages.length + ' 則符合條件的訊息，已搜尋 ' + searchResult.scannedCount + ' 則歷史訊息。';
            }
            if (result.oldMessageCount > 0) {
                replyText += '\n其中 ' + result.oldMessageCount + ' 則超過 14 天，已改為逐則刪除。';
            }
            if (result.failedCount > 0) {
                replyText += '\n⚠️ 另有 ' + result.failedCount + ' 則訊息刪除失敗，請檢查後台 Log 及 Bot 權限。';
            }
            if (searchResult.scanLimitReached) {
                replyText += '\n⚠️ 已達最近 ' + MAX_HISTORY_SCAN + ' 則訊息的搜尋上限，未必涵蓋更早的訊息。';
            }
            replyText += '\n（此提示將於 5 秒後自動刪除）';

            await replyAndAutoDelete(interaction, replyText);
        } catch (error) {
            console.error('[clear] 清理訊息時發生錯誤:', error);

            const errorMessage = error.code === 50013
                ? '❌ 銀喵缺少必要權限，請確認已授予「管理訊息」及相關頻道權限。'
                : '❌ 清理訊息失敗：' + (error.message || '請檢查頻道權限或訊息狀態。');

            await replyAndAutoDelete(interaction, errorMessage).catch(replyError => {
                console.error('[clear] 無法發送錯誤提示:', replyError);
            });
        }
    }
};
