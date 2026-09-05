const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    category:"Fun",
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('這是斜線指令'),
    async execute(interaction) {
        await interaction.reply('bong bong');
    },
};
