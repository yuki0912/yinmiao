const { Events } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');
const GuildConfig = require('../models/GuildConfig'); // ⬅️ 新增這行

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        try {
            // 1. 清理 Reaction Role 資料庫
            const result = await ReactionRole.deleteMany({ messageId: message.id });
            if (result.deletedCount > 0) {
                console.log(`[清理] 訊息 ${message.id} 被刪除，已移除 ${result.deletedCount} 筆反應身分組設定。`);
            }

            // 2. 🚩 額外清理：如果刪除的是「守則訊息」或「工單訊息」，同步清空 GuildConfig 中的 ID
            const config = await GuildConfig.findOne({ 
                $or: [{ rulesMessageId: message.id }, { ticketMessageId: message.id }] 
            });

            if (config) {
                if (config.rulesMessageId === message.id) config.rulesMessageId = null;
                if (config.ticketMessageId === message.id) config.ticketMessageId = null;
                await config.save();
                console.log(`[清理] 已將伺服器 ${message.guild.id} 的功能訊息 ID 清空，因為該訊息已被刪除喵。`);
            }
            
        } catch (error) {
            console.error('清理失效反應身分組與功能訊息資料失敗:', error);
        }
    },
};
