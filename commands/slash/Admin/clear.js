const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('刪除指定數量的頻道訊息')
        .addIntegerOption(option =>
            option.setName('amount')
                .setNameLocalization('zh-TW', '數量')
                .setDescription('要刪除的訊息數量 (1-100)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const amount = interaction.options.getInteger('amount');

        try {
            if (!interaction.channel || !interaction.channel.bulkDelete) {
                return;
            }

            const deleted = await interaction.channel.bulkDelete(amount, true).catch(() => null);
            const deletedCount = deleted ? deleted.size : 0;

            const response = await interaction.reply({
                content: `✅ Successfully deleted **${deletedCount}** messages!`,
                withResponse: true
            });

            const replyMessage = response.resource?.message;
            if (replyMessage) {
                setTimeout(() => {
                    replyMessage.delete().catch(() => {});
                }, 5000);
            }

        } catch (error) {
            // 靜默略過
        }
    },
};
