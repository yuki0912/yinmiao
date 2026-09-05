const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    name: "coinflip",
    aliases: ["cf", "擲硬幣", "賭博"],
    category: "Economy",
    description: "🪙 擲硬幣賭博 - 贏了翻倍，輸了歸零！",

    async run(client, message, args) {
        const userId = message.author.id;
        const guildId = message.guild.id;

        // 1. 解析參數
        // 格式: k!coinflip <金額> <heads/tails>
        const bet = parseInt(args[0]);
        const userChoice = args[1] ? args[1].toLowerCase() : null;

        // 2. 參數檢查
        if (isNaN(bet) || bet < 10) {
            return message.reply("❌ 請輸入有效的賭注金額 (最少 10 幣)！\n用法: `k!coinflip 50 heads` (或 tails)")
                .then(msg => setTimeout(() => msg.delete().catch(() => null), 5000));
        }

        const validChoices = ['heads', 'tails', '正面', '反面'];
        if (!userChoice || !validChoices.includes(userChoice)) {
            return message.reply("❌ 請選擇正反面！\n用法: `k!coinflip 50 heads` (或 tails)")
                .then(msg => setTimeout(() => msg.delete().catch(() => null), 5000));
        }

        // 統一轉換成英文邏輯處理
        const choice = (userChoice === '正面' || userChoice === 'heads') ? 'heads' : 'tails';

        try {
            const profile = await UserProfile.findOne({ guildId, userId });

            // 3. 檢查餘額
            if (!profile || profile.coins < bet) {
                return message.reply(`❌ 你的銀喵幣不足！你目前只有 \`$${profile ? profile.coins : 0}\`。`);
            }

            // 4. 進行隨機判定
            const result = Math.random() < 0.5 ? 'heads' : 'tails';
            const win = (choice === result);

            // 5. 更新資料庫
            if (win) {
                profile.coins += bet;
            } else {
                profile.coins -= bet;
            }
            await profile.save();

            // 6. 建立回饋 Embed
            const resultEmoji = result === 'heads' ? '🟡 (正面)' : '⚪ (反面)';
            const embed = new EmbedBuilder()
                .setTitle(win ? '🎉 贏了！翻倍！' : '💀 輸了... 歸零')
                .setColor(win ? '#2ecc71' : '#e74c3c')
                .setThumbnail(message.author.displayAvatarURL({ dynamic: true }))
                .setDescription(`${message.author.username} 選擇了 **${choice === 'heads' ? '正面' : '反面'}**\n硬幣落下的結果是：**${resultEmoji}**`)
                .addFields(
                    { name: win ? '💰 贏得金額' : '💸 損失金額', value: `\`$${bet}\` 銀喵幣`, inline: true },
                    { name: '💳 當前餘額', value: `\`$${profile.coins}\``, inline: true }
                )
                .setFooter({ text: '賭博有風險，請適度參與' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

        } catch (error) {
            console.error('Prefix Coinflip Error:', error);
            message.reply('❌ 賭場維修中，請稍後再試。');
        }
    }
};
