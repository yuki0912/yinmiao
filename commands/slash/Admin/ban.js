const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    category:"Admin",
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('【管理員專用】永久封鎖成員')
        .addUserOption(option => option.setName('target').setDescription('要封鎖的對象').setRequired(true))
        .addStringOption(option => option.setName('reason').setDescription('封鎖原因'))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers), // 🚩 限制只有具備封鎖權限的管理員可見

    async execute(interaction) {
        await interaction.deferReply();

        const target = interaction.options.getUser('target');
        const reason = interaction.options.getString('reason') || '未提供原因';

        try {
            await interaction.guild.members.ban(target, { reason });
            await interaction.editReply(`🚫 已永久封鎖 **${target.tag}**。原因：${reason}`);
            
            // 🚩 5 秒後自動刪除機器人的回覆
            setTimeout(() => interaction.deleteReply().catch(() => null), 5000);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ 無法封鎖該成員，請檢查我的權限順序。');
        }
    },
};
