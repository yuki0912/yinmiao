const mongoose = require('mongoose');

/**
 * 🐾 ReactionRole Schema
 * 用於儲存反應身份組的配置資訊
 */
const ReactionRoleSchema = new mongoose.Schema({
    // 伺服器 ID
    guildId: { type: String, required: true },
    
    // 訊息所在的頻道 ID (支援跨頻道功能的關鍵)
    channelId: { type: String, required: true },
    
    // 訊息 ID
    messageId: { type: String, required: true },
    
    // 反應表情 (可以是 Unicode 表情或自定義表情 ID)
    emoji: { 
        type: String, 
        required: true,
        // 🌟 核心升級：自動預處理！只要寫入或更新這個欄位，會自動拔除 \uFE0F 變體字元
        set: function(val) {
            if (typeof val === 'string') {
                return val.replace(/\uFE0F/g, '');
            }
            return val;
        }
    },
    
    // 點擊後要給予的身份組 ID
    roleId: { type: String, required: true }
});

/**
 * 🚩 建立複合唯一索引
 * 確保在同一個伺服器中，同一個訊息的同一個表情只會綁定一個身份組。
 * 包含 guildId 確保多伺服器環境下的資料獨立性。
 */
ReactionRoleSchema.index({ guildId: 1, messageId: 1, emoji: 1 }, { unique: true });

// 防止模型重複編譯
const ReactionRole = mongoose.models.ReactionRole || mongoose.model('ReactionRole', ReactionRoleSchema);

module.exports = ReactionRole;
