const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "Economy",
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('💸 轉帳銀喵幣給其他成員')
        .addUserOption(opt => opt.setName('target').setDescription('要轉帳的對象').setRequired(true))
        .addIntegerOption(opt => opt.setName('amount').setDescription('要轉帳的金額').setRequired(true).setMinValue(1)),

    async execute(interaction) {
        const { user, guild, options } = interaction;
        const targetUser = options.getUser('target');
        const amount = options.getInteger('amount');

        // 1. 安全檢查：不能轉給自己
        if (targetUser.id === user.id) {
            return interaction.reply({ content: '❌ 你不能轉帳給自己！', flags: [MessageFlags.Ephemeral] });
        }

        // 2. 安全檢查：不能轉給機器人
        if (targetUser.bot) {
            return interaction.reply({ content: '❌ 機器人不需要銀喵幣！', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply();

        try {
            // 3. 取得發送者與接收者的資料
            const [senderProfile, receiverProfile] = await Promise.all([
                UserProfile.findOne({ guildId: guild.id, userId: user.id }),
                UserProfile.findOneAndUpdate(
                    { guildId: guild.id, userId: targetUser.id },
                    { $setOnInsert: { xp: 0, level: 1, coins: 0 } },
                    { upsert: true, returnDocument: 'after' }
                )
            ]);

            // 4. 檢查餘額
            if (!senderProfile || senderProfile.coins < amount) {
                return interaction.editReply(`❌ 你的餘額不足！你目前擁有 \`$${senderProfile ? senderProfile.coins : 0}\` 銀喵幣。`);
            }

            // 5. 執行轉帳 (扣除與增加)
            senderProfile.coins -= amount;
            receiverProfile.coins += amount;

            await Promise.all([senderProfile.save(), receiverProfile.save()]);

            // 6. 發送成功 Embed
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('💸 轉帳成功')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }))
                .setDescription(`你已成功轉帳給 **${targetUser.username}**！`)
                .addFields(
                    { name: '💰 轉帳金額', value: `\`$${amount}\` 銀喵幣`, inline: true },
                    { name: '👤 接收者', value: targetUser.toString(), inline: true },
                    { name: '🧧 你的剩餘餘額', value: `\`$${senderProfile.coins}\``, inline: false }
                )
                .setFooter({ text: '感謝你的慷慨大方！' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Pay Command Error:', error);
            await interaction.editReply('❌ 轉帳過程中發生錯誤，請稍後再試。');
        }
    }
};
