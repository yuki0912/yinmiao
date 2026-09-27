const mongoose = require('mongoose');

const SocialNotificationSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    platform: { type: String, enum: ['youtube', 'twitter', 'twitch'], required: true, index: true },
    username: { type: String, required: true },
    sourceId: { type: String, default: null },
    channelId: { type: String, required: true },
    roleId: { type: String, default: null },
    enabled: { type: Boolean, default: true },
    lastItemId: { type: String, default: null },
    lastCheckedAt: { type: Date, default: null },
    title: { type: String, default: '' },
    customMessage: { type: String, default: '' },
    color: { type: String, default: '#FFC8DD' }
}, { timestamps: true });

SocialNotificationSchema.index({ guildId: 1, platform: 1, username: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.model('SocialNotification', SocialNotificationSchema);
