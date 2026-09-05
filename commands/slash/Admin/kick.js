const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category:"Admin",
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('【管理員專用】將成員踢出伺服器')
        .addUserOption(option => option.setName('target').setDescription('要踢出的對象').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('踢出原因'))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers), // 🚩 限制只有具備踢人權限的管理員可見

    async execute(interaction) {
        // 先告訴 Discord 正在處理中
        await interaction.deferReply();

        const target = interaction.options.getMember('target');
        const reason = interaction.options.getString('reason') || '未提供原因';

        // 安全檢查
        if (!target) return interaction.editReply('❌ 找不到該成員。');
        if (!target.kickable) return interaction.editReply('❌ 我沒有權限踢出此人（他的職位可能比我高）。');

        try {
            await target.kick(reason);
            const reply = await interaction.editReply(`👢 成功踢出 **${target.user.tag}**。原因：${reason}`);
            
            // 🚩 5 秒後自動刪除機器人的回覆
            setTimeout(() => interaction.deleteReply().catch(() => null), 5000);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ 執行踢出指令時發生錯誤。');
        }
    },
};
