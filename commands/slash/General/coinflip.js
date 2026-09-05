const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "General",
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('🪙 擲硬幣賭博 - 贏了翻倍，輸了歸零！')
        .addIntegerOption(opt => opt.setName('bet').setDescription('你想下注的金額').setRequired(true).setMinValue(10))
        .addStringOption(opt => opt.setName('choice').setDescription('選擇正反面').setRequired(true)
            .addChoices(
                { name: '正面 (Heads)', value: 'heads' },
                { name: '反面 (Tails)', value: 'tails' }
            )),

    async execute(interaction) {
        const { user, guild, options } = interaction;
        const bet = options.getInteger('bet');
        const choice = options.getString('choice');

        await interaction.deferReply();

        try {
            const profile = await UserProfile.findOne({ guildId: guild.id, userId: user.id });

            // 1. 檢查餘額
            if (!profile || profile.coins < bet) {
                return interaction.editReply(`❌ 你的銀喵幣不足！你目前只有 \`$${profile ? profile.coins : 0}\`。`);
            }

            // 2. 進行隨機判定 (50% 機率)
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = (choice === result);

            // 3. 更新資料庫
            if (win) {
                profile.coins += bet; // 贏了獲得等同賭注的獎金
            } else {
                profile.coins -= bet; // 輸了扣除賭注
            }
            await profile.save();

            // 4. 建立回饋 Embed
            const resultEmoji = result === 'heads' ? '🟡 (正面)' : '⚪ (反面)';
            const embed = new EmbedBuilder()
                .setTitle(win ? '🎉 贏了！翻倍！' : '💀 輸了... 下次再來')
                .setColor(win ? '#2ecc71' : '#e74c3c')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(`你選擇了 **${choice === 'heads' ? '正面' : '反面'}**\n硬幣落下的結果是：**${resultEmoji}**`)
                .addFields(
                    { name: win ? '💰 贏得金額' : '💸 損失金額', value: `\`$${bet}\` 銀喵幣`, inline: true },
                    { name: '💳 當前餘額', value: `\`$${profile.coins}\``, inline: true }
                )
                .setFooter({ text: win ? '運氣真好！要再賭一把嗎？' : '天台風很大，請保持冷靜。' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Coinflip Error:', error);
            await interaction.editReply('❌ 賭場維修中，請稍後再試。');
        }
    }
};
