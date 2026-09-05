const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('manage-user')
        .setDescription('🛠️ 管理用戶的等級、經驗或金幣')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // 子指令：調整金幣
        .addSubcommand(sub =>
            sub.setName('add-coins')
                .setDescription('【管理員專用】💰 為用戶增加金幣')
                .addUserOption(opt => opt.setName('target').setDescription('目標成員').setRequired(true))
                .addIntegerOption(opt => opt.setName('amount').setDescription('增加的數量').setRequired(true).setMinValue(1))
        )
        // 子指令：調整等級
        .addSubcommand(sub =>
            sub.setName('set-level')
                .setDescription('【管理員專用】✨ 直接修改用戶等級')
                .addUserOption(opt => opt.setName('target').setDescription('目標成員').setRequired(true))
                .addIntegerOption(opt => opt.setName('level').setDescription('設定的等級').setRequired(true).setMinValue(1))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('target');
        const guildId = interaction.guild.id;

        try {
            if (subcommand === 'add-coins') {
                const amount = interaction.options.getInteger('amount');
                const profile = await UserProfile.findOneAndUpdate(
                    { guildId, userId: target.id },
                    { $inc: { coins: amount } },
                    { upsert: true, returnDocument: 'after' }
                );

                const embed = new EmbedBuilder()
                    .setColor('#f1c40f')
                    .setDescription(`✅ 已成功為 ${target} 增加 **${amount}** 金幣！\n目前總額：\`$${profile.coins}\``);
                return await interaction.reply({ embeds: [embed] });
            }

            if (subcommand === 'set-level') {
                const newLevel = interaction.options.getInteger('level');
                await UserProfile.findOneAndUpdate(
                    { guildId, userId: target.id },
                    { level: newLevel, xp: 0 },
                    { upsert: true }
                );

                const embed = new EmbedBuilder()
                    .setColor('#3498db')
                    .setDescription(`✅ 已將 ${target} 的等級設定為 **Lv. ${newLevel}** (經驗值已重置)`);
                return await interaction.reply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('管理指令執行失敗:', error);
            await interaction.reply({ content: '❌ 執行操作時發生資料庫錯誤。', ephemeral: true });
        }
    }
};
