const mongoose = require('mongoose');

const UserProfileSchema = new mongoose.Schema({
    // 🏢 伺服器 ID（已由下方的聯合索引覆蓋，此處不需額外設定 index: true）
    guildId: { 
        type: String, 
        required: true
    },
    // 👤 用戶 Discord ID
    userId: { 
        type: String, 
        required: true,
        index: true // 💡 僅在需要「跨伺服器查詢該用戶」或建立「全域排行榜」時才需要保留
    },
    // 📈 經驗值系統
    xp: { 
        type: Number, 
        default: 0 // 歷史累積總經驗值，只增不減，做為等級判定與歷史榮譽的依據喵！
    },
    weeklyExp: { 
        type: Number, 
        default: 0 // 🐾 新增：當週排行榜經驗值！每週一凌晨會被清空，完全不影響上方的總 xp
    },
    level: { 
        type: Number, 
        default: 1 
    },
    // ⚔️ RPG 基礎屬性系統
    stats: {
        str: { type: Number, default: 10 }, // 力量
        dex: { type: Number, default: 10 }, // 敏捷
        int: { type: Number, default: 10 }, // 智力
        con: { type: Number, default: 10 }, // 體質
    },
    // 💰 經濟系統
    coins: { 
        type: Number, 
        default: 0 
    },
    // 🚩 簽到與冷卻控制
    streak: {
        type: Number,
        default: 0
    },
    lastWork: { 
        type: Date, 
        default: null 
    },
    lastDaily: { 
        type: Date, 
        default: null 
    },
    // 💬 聊天活躍度控制（可用於文字經驗值冷卻防刷）
    lastMessageTimestamp: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true // 自動生成 createdAt 與 updatedAt 欄位
});

// 🔒 建立聯合唯一索引（最核心的安全防線：一個伺服器內一個用戶只會有一筆資料）
UserProfileSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserProfile', UserProfileSchema);
