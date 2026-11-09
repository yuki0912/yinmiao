const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');

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

    async execute(message, args, client) {
        // 兼容處理：同時支援 Slash Command (interaction) 或直接呼叫
        // 如果是透過 InteractionCreate 觸發，會帶入 interaction 物件作為第一個參數
        const interaction = message;
        
        if (!interaction.isChatInputCommand || !interaction.isChatInputCommand()) {
            return;
        }

        const amount = interaction.options.getInteger('amount');

        try {
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        } catch (error) {
            return;
        }

        try {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                await interaction.editReply({ content: '❌ 你沒有「管理訊息」權限喵！' });
                return;
            }

            if (!interaction.channel || !interaction.channel.bulkDelete) {
                await interaction.editReply({ content: '❌ 此頻道無法執行訊息清理喵！' });
                return;
            }

            // 抓取並刪除訊息 (amount + 1 包含指令本身，透過 bulkDelete 自動過濾超過 14 天的舊訊息)
            const deleted = await interaction.channel.bulkDelete(amount + 1, true).catch(() => null);
            
            const deletedCount = deleted ? Math.max(0, deleted.size - 1) : 0;

            const replyMsg = await interaction.editReply({
                content: `✅ 成功刪除 **${deletedCount}** 則訊息喵！\n（此提示將於 6 秒後自動刪除）`
            });

            setTimeout(() => {
                replyMsg.delete().catch(() => {});
            }, 6000);

        } catch (error) {
            if (error.code === 10008 || error.code === 10062) return;

            try {
                await interaction.editReply({
                    content: '❌ 清理訊息時發生錯誤，請確認 Bot 權限喵！\n（此提示將於 6 秒後自動刪除）'
                }).then(msg => {
                    setTimeout(() => msg.delete().catch(() => {}), 6000);
                });
            } catch (e) {
                // 靜默略過
            }
        }
    },
};
