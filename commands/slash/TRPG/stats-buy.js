const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "TRPG",
    data: new SlashCommandBuilder()
        .setName('stats-buy')
        .setDescription('💊 消耗銀喵幣提升你的屬性點 (1000幣/點)')
        .addStringOption(opt => opt.setName('stat').setDescription('選擇要提升的屬性').setRequired(true)
            .addChoices(
                { name: '💪 力量 (STR)', value: 'str' },
                { name: '🤸 敏捷 (DEX)', value: 'dex' },
                { name: '🧠 智力 (INT)', value: 'int' },
                { name: '🛡️ 體質 (CON)', value: 'con' }
            )),

    async execute(interaction) {
        const statType = interaction.options.getString('stat');
        const upgradeCost = 1000;

        await interaction.deferReply();

        try {
            const profile = await UserProfile.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });

            if (!profile || profile.coins < upgradeCost) {
                return interaction.editReply(`❌ 你的銀喵幣不足！提升屬性需要 \`$${upgradeCost}\`。`);
            }

            // 初始化 stats 物件（防止舊資料報錯）
            if (!profile.stats) {
                profile.stats = { str: 10, dex: 10, int: 10, con: 10 };
            }

            // 執行升級
            profile.coins -= upgradeCost;
            profile.stats[statType] = (profile.stats[statType] || 10) + 1;
            
            // 標記欄位已修改 (Mongoose 對混合物件的必要操作)
            profile.markModified('stats'); 
            await profile.save();

            const statNames = { str: '力量 (STR)', dex: '敏捷 (DEX)', int: '智力 (INT)', con: '體質 (CON)' };

            const embed = new EmbedBuilder()
                .setTitle('✨ 屬性突破！')
                .setColor('#f1c40f')
                .setDescription(`你感受到了體內湧現的力量...`)
                .addFields(
                    { name: '📈 提升屬性', value: `**${statNames[statType]}**`, inline: true },
                    { name: '📊 當前數值', value: `\`${profile.stats[statType]}\``, inline: true },
                    { name: '💳 剩餘餘額', value: `\`$${profile.coins}\` 銀喵幣` }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ 強化失敗，請聯繫管理員。');
        }
    }
};
