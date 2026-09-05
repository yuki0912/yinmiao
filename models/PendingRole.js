const mongoose = require('mongoose');

const pendingRoleSchema = new mongoose.Schema({
    // 用戶 ID
    userId: { type: String, required: true },
    
    // 伺服器 ID
    guildId: { type: String, required: true },
    
    // 要補發的身分組 ID
    roleId: { type: String, required: true },
    
    // 補發狀態
    status: { 
        type: String, 
        enum: ['pending', 'completed', 'failed'], 
        default: 'pending'
    },
    
    // 建立時間（內建 7 天自動刪除過期資料）
    createdAt: { 
        type: Date, 
        default: Date.now,
        expires: 60 * 60 * 24 * 7 
    }
});

/**
 * 🌟 核心升級：建立符合業務場景的「複合索引」
 * 在實際執行離線補發時（例如用戶重新入群 `guildMemberAdd`），
 * 機器人需要同時用 userId + guildId + status 去撈取該伺服器這名用戶的所有待處理身分組。
 * 改用複合索引可以大幅提升大型群組在高併發時的查詢速度（查詢效率從 O(N) 變成 O(1)）！
 */
pendingRoleSchema.index({ userId: 1, guildId: 1, status: 1 });

// 🚩 這裡很重要！不要在這裡 require 自己，防止重複編譯與循環依賴
module.exports = mongoose.models.PendingRole || mongoose.model('PendingRole', pendingRoleSchema);
