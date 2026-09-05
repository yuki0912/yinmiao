const mongoose = require('mongoose');

const TRPGSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    guildId: { 
        type: String 
    },
    name: { 
        type: String, 
        required: true,
        trim: true
    },
    level: {
        type: Number,
        default: 1,
        min: 1
    },
    // 💡 新增經驗值欄位
    exp: {
        type: Number,
        default: 0,
        min: 0
    },
    race: {
        name: { type: String, default: '人類' },
        emoji: { type: String, default: '👤' }
    },
    class: {
        name: { type: String, default: '冒險者' },
        emoji: { type: String, default: '⚔️' },
        weapon: { type: String, default: '徒手' },
        skill: { type: String, default: '無' },
        proficiency: { type: String, default: 'STR' }
    },
    attributes: {
        str: { type: Number, default: 10, min: 1, max: 30 },
        dex: { type: Number, default: 10, min: 1, max: 30 },
        con: { type: Number, default: 10, min: 1, max: 30 },
        int: { type: Number, default: 10, min: 1, max: 30 },
        wis: { type: Number, default: 10, min: 1, max: 30 },
        cha: { type: Number, default: 10, min: 1, max: 30 }
    },
    hp: { type: Number, default: 10 },
    maxHp: { type: Number, default: 10 },
    ac: { type: Number, default: 10 }
}, { timestamps: true });

// 複合唯一索引：同一位玩家不能創建重複名稱的角色卡
TRPGSchema.index({ userId: 1, name: 1 }, { unique: true });

// 💡 實例方法：自動計算指定屬性的修正值 (Modifier)
TRPGSchema.methods.getModifier = function (statName) {
    const score = this.attributes?.[statName] ?? 10;
    return Math.floor((score - 10) / 2);
};

// 💡 實例方法：自動取得帶符號的修正值字串 (例如 +2 或 -1)
TRPGSchema.methods.getModifierString = function (statName) {
    const mod = this.getModifier(statName);
    return mod >= 0 ? `+${mod}` : `${mod}`;
};

module.exports = mongoose.model('TRPG', TRPGSchema);