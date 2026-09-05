const mongoose = require('mongoose');

const tempChannelSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    channelId: { type: String, required: true, unique: true },
    ownerId: { type: String, required: true }
});

module.exports = mongoose.model('TempChannel', tempChannelSchema);
