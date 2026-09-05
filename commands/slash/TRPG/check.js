const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "TRPG",
    data: new SlashCommandBuilder()
        .setName('check')
        .setDescription('🎲 進行屬性檢定 (D20 + 修正值)')
        .addStringOption(opt => opt.setName('stat').setDescription('選擇檢定屬性').setRequired(true)
            .addChoices(
                { name: '💪 力量 (STR)', value: 'str' },
                { name: '🤸 敏捷 (DEX)', value: 'dex' },
                { name: '🧠 智力 (INT)', value: 'int' },
                { name: '🛡️ 體質 (CON)', value: 'con' }
            ))
        .addIntegerOption(opt => opt.setName('dc').setDescription('目標難度 (DC)，不填則僅顯示結果')),

    async execute(interaction) {
        const statType = interaction.options.getString('stat');
        const dc = interaction.options.getInteger('dc');
        const profile = await UserProfile.findOne({ guildId: interaction.guild.id, userId: interaction.user.id });

        if (!profile) return interaction.reply("❌ 你還沒有建立角色，請先發言獲得 XP 建立資料。");

        // 確保 stats 物件存在
        const statValue = (profile.stats && profile.stats[statType]) ? profile.stats[statType] : 10;
        const modifier = Math.floor((statValue - 10) / 2);
        const dieRoll = Math.floor(Math.random() * 20) + 1;
        const total = dieRoll + modifier;

        let resultText = `🎲 點數: **${dieRoll}** (修正值: ${modifier >= 0 ? '+' : ''}${modifier})\n🎯 總計: **${total}**`;
        let success = null;

        if (dc) {
            success = total >= dc;
            resultText += `\n📌 目標難度 (DC): **${dc}**\n${success ? '✅ **檢定成功！**' : '❌ **檢定失敗...**'}`;
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
            .setTitle(`📜 屬性檢定：${statType.toUpperCase()}`)
            .setColor(success === null ? '#9b59b6' : (success ? '#2ecc71' : '#e74c3c'))
            .setDescription(resultText)
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
