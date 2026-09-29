const mongoose = require('mongoose');

const ItemSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    type: { type: String, default: 'misc' },
    quantity: { type: Number, default: 1, min: 0 },
    effect: { type: Number, default: 0 },
    description: { type: String, default: '' }
}, { _id: false });

const TRPGSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String },
    name: { type: String, required: true, trim: true },
    level: { type: Number, default: 1, min: 1 },
    exp: { type: Number, default: 0, min: 0 },
    race: { name: { type: String, default: '人類' }, emoji: { type: String, default: '👤' } },
    class: {
        name: { type: String, default: '冒險者' },
        emoji: { type: String, default: '⚔️' },
        weapon: { type: String, default: '徒手' },
        skill: { type: String, default: '無' },
        proficiency: { type: String, default: 'STR' },
        damage: { type: String, default: '1d6' }
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
    ac: { type: Number, default: 10 },
    gold: { type: Number, default: 100, min: 0 },
    inventory: { type: [ItemSchema], default: [] },
    conditions: { type: [String], default: [] },
    victories: { type: Number, default: 0, min: 0 },
    defeats: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

TRPGSchema.index({ userId: 1, name: 1 }, { unique: true });

TRPGSchema.methods.getModifier = function (statName) {
    const score = this.attributes?.[statName] ?? 10;
    return Math.floor((score - 10) / 2);
};

TRPGSchema.methods.getModifierString = function (statName) {
    const value = this.getModifier(statName);
    return value >= 0 ? '+' + value : String(value);
};

module.exports = mongoose.model('TRPG', TRPGSchema);
