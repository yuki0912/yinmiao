const mongoose = require('mongoose');

const TRPGAchievementSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    name: String,
    description: String,
    rewardGold: { type: Number, default: 0 },
    rewardXp: { type: Number, default: 0 }
});
module.exports = mongoose.model('TRPGAchievement', TRPGAchievementSchema);
