const mongoose = require('mongoose');

const BirthdaySchema = new mongoose.Schema({
    guildId: { 
        type: String, 
        required: true 
    },
    userId: { 
        type: String, 
        required: true 
    },
    birthday: { 
        type: String, 
        required: true // 儲存格式如 "05/17"
    },
    channel: {
        type: String,
        required: false // 建議設為 false，避免一般成員設定生日時因未傳送頻道 ID 而報錯
    }
}, { timestamps: true });

// 1. 複合唯一索引：確保「同一個伺服器裡的同一個成員」只有一筆資料
BirthdaySchema.index({ guildId: 1, userId: 1 }, { unique: true });

// 2. 日期索引（優化項目）：大幅提升每日 00:00 廣播排程搜尋壽星的效能
BirthdaySchema.index({ birthday: 1 });

module.exports = mongoose.model('Birthday', BirthdaySchema);