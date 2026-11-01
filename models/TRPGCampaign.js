const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    characterId: { type: mongoose.Schema.Types.ObjectId, ref: 'TRPG', required: true },
    role: { type: String, enum: ['gm','player'], default: 'player' },
    joinedAt: { type: Date, default: Date.now }
}, { _id: false });

const QuestSchema = new mongoose.Schema({
    id: String,
    title: String,
    description: String,
    rewardXp: { type: Number, default: 0 },
    rewardGold: { type: Number, default: 0 },
    status: { type: String, enum: ['available','active','completed'], default: 'available' }
}, { _id: false });

const TRPGCampaignSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    gmId: { type: String, required: true },
    status: { type: String, enum: ['lobby','active','ended'], default: 'lobby' },
    chapter: { type: Number, default: 1, min: 1 },
    location: { type: String, default: '村莊廣場' },
    map: { type: [[String]], default: () => [
        ['🏠','🌲','🌲','🪨','🌲','🌲','🏰'],
        ['🌲','🌿','🌿','🌿','🌿','🌿','🌲'],
        ['🌲','🌿','🏕️','🌿','💧','🌿','🌲'],
        ['🌲','🌿','🌿','⚔️','🌿','🌿','🌲'],
        ['🌲','🌿','🌿','🌿','🌿','🌿','🌲'],
        ['🌲','🌲','🌲','🌉','🌲','🌲','🌲']
    ]},
    party: { type: [MemberSchema], default: [] },
    quests: { type: [QuestSchema], default: [] },
    currentQuestId: { type: String, default: null },
    storyLog: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

TRPGCampaignSchema.index({ guildId: 1, name: 1 }, { unique: true });
module.exports = mongoose.model('TRPGCampaign', TRPGCampaignSchema);
