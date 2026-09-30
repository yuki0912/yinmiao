const mongoose = require('mongoose');

const TRPGMonsterSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    emoji: { type: String, default: '👾' },
    description: { type: String, default: '' },
    hp: { type: Number, default: 10 },
    ac: { type: Number, default: 10 },
    attack: { type: Number, default: 2 },
    damage: { type: String, default: '1d6' },
    xp: { type: Number, default: 10 },
    gold: { type: Number, default: 5 },
    level: { type: Number, default: 1 },
    skills: { type: [String], default: [] },
    loot: { type: [String], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('TRPGMonster', TRPGMonsterSchema);
