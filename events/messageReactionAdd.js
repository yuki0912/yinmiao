const { Events } = require('discord.js');
const ReactionRole = require('../models/ReactionRole');
const PendingRole = require('../models/PendingRole');
require('colors');

module.exports = {
    name: Events.MessageReactionAdd,
    async execute(reaction, user) {
        // 1. 忽略機器人自己的反應
        if (user.bot) return;

        // 2. 處理快取未完全載入的舊訊息反應 (Partial)
        if (reaction.partial) {
            try { 
                await reaction.fetch(); 
            } catch (error) { 
                console.error(`[ReactionRole] 無法拉取快取反應訊息: ${error.message}`.red);
                return; 
            }
        }

        const { message, emoji } = reaction;
        if (!message.guild) return;

        // 🌟 核心修正：移除 Unicode 表情中常見的 \uFE0F 變體提示符，避免網頁端與 Discord API 傳回字串不一致的問題
        let emojiKey = emoji.id || emoji.name;
        if (!emoji.id && emojiKey) {
            emojiKey = emojiKey.replace(/\uFE0F/g, ''); 
        }

        try {
            // 3. 從資料庫撈取是否有對應的訊息 ID 與表情設定
            const data = await ReactionRole.findOne({ 
                messageId: message.id, 
                emoji: emojiKey 
            });

            if (data) {
                const member = await message.guild.members.fetch(user.id).catch(() => null);
                if (!member) return;

                const roleId = data.roleId;

                try {
                    // 4. 取得身分組物件
                    const role = message.guild.roles.cache.get(roleId) || await message.guild.roles.fetch(roleId);
                    
                    if (role) {
                        // 如果成員還沒有這個身分組，則賦予
                        if (!member.roles.cache.has(role.id)) {
                            await member.roles.add(role);
                            console.log(`✅ [ReactionRole] 已為 ${user.username.cyan} (${user.id}) 添加身份組: [${role.name.green}]`);
                        }
                        
                        // 🚩 如果在線加組成功，順手清理該用戶可能的待處理/離線補發記錄
                        await PendingRole.deleteOne({ userId: user.id, roleId: roleId, guildId: message.guild.id });
                    } else {
                        console.log(`⚠️ [ReactionRole] 找不到對應的身分組物件 (ID: ${roleId})，可能已被刪除`.yellow);
                    }
                } catch (addError) {
                    // 5. 萬一權限不足、或者用戶中途退群導致在線加組失敗，丟入補發隊列
                    console.log(`⚠️ [ReactionRole] 在線加組失敗 (${addError.message})，已存入補發隊列: ${user.username}`.yellow);
                    
                    await PendingRole.findOneAndUpdate(
                        { userId: user.id, guildId: message.guild.id, roleId: roleId },
                        { status: 'pending' },
                        { upsert: true }
                    );
                }
            }
        } catch (error) {
            console.error('❌ 給予反應身分組時發生系統錯誤:'.red, error);
        }
    },
};
