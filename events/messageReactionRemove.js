const { Events } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');
const PendingRole = require('../models/PendingRole'); // 🚩 引入補發模型
require('colors');

module.exports = {
    name: Events.MessageReactionRemove,
    async execute(reaction, user) {
        // 1. 忽略機器人
        if (user.bot) return;

        // 2. 處理 Partial (確保能讀取到舊訊息數據)
        if (reaction.partial) {
            try { 
                await reaction.fetch(); 
            } catch (error) { 
                console.error(`[ReactionRole] 無法拉取快取移除訊息: ${error.message}`.red);
                return; 
            }
        }

        const { message, emoji } = reaction;
        if (!message.guild) return;

        // 🌟 核心修正：同步移除 Unicode 表情中常見的 \uFE0F 變體提示符，確保與網頁寫入資料庫的字串完美對齊！
        let emojiKey = emoji.id || emoji.name;
        if (!emoji.id && emojiKey) {
            emojiKey = emojiKey.replace(/\uFE0F/g, ''); 
        }

        try {
            // 3. 從資料庫尋找匹配設定
            const data = await ReactionRole.findOne({ 
                messageId: message.id, 
                emoji: emojiKey 
            });

            if (data) {
                const member = await message.guild.members.fetch(user.id).catch(() => null);
                if (!member) return;

                const roleId = data.roleId;

                // 🚩 [關鍵邏輯]：如果用戶取消了反應，立即從「離線補發佇列」中移除
                // 防止機器人離線期間用戶點了又取消，結果機器人上線又給加回去
                await PendingRole.deleteOne({ 
                    userId: user.id, 
                    guildId: message.guild.id, 
                    roleId: roleId 
                });

                // 4. 移除身份組
                try {
                    // 優先從快取取，沒有則 fetch
                    const role = message.guild.roles.cache.get(roleId) || await message.guild.roles.fetch(roleId);
                    
                    if (role) {
                        // 檢查用戶是否有這個身分組，有的話才執行移除
                        if (member.roles.cache.has(role.id)) {
                            await member.roles.remove(role);
                            console.log(`❌ [ReactionRole] 已從 ${user.username.cyan} (${user.id}) 移除身分組: [${role.name.red}]`);
                        }
                    } else {
                        console.log(`⚠️ [ReactionRole] 找不到要移除的身分組物件 (ID: ${roleId})`.yellow);
                    }
                } catch (roleError) {
                    console.error(`⚠️ [ReactionRole] 移除身份組執行失敗: ${roleError.message}`.yellow);
                }
            }
        } catch (error) {
            console.error('❌ 移除反應身份組時發生系統錯誤:'.red, error);
        }
    },
};
