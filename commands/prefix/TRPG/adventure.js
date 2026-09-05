const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    name: "adventure",
    aliases: ["adv", "冒險", "探險"],
    category: "TRPG",
    description: "🧭 進行一場 TRPG 冒險檢定 (花費 50 幣)",

    async run(client, message, args) {
        try {
            let profile = await UserProfile.findOne({ guildId: message.guild.id, userId: message.author.id });
            if (!profile || (profile.coins || 0) < 50) return message.reply("📖 酒館老闆：『沒錢買乾糧還想去冒險？快去簽到賺錢吧！』");

            const events = [
                { text: "你被一群哥布林包圍了！", stat: "str", dc: 11, win: "你揮舞巨劍殺出血路。", lose: "你被打得鼻青臉腫落荒而逃。" },
                { text: "前方有一座搖搖欲墜的吊橋。", stat: "dex", dc: 13, win: "你輕盈地跨越了斷裂處。", lose: "你差點掉下去，嚇出一身冷汗。" }
            ];
            const event = events[Math.floor(Math.random() * events.length)];

            const mod = Math.floor(((profile.stats[event.stat] || 10) - 10) / 2);
            const roll = Math.floor(Math.random() * 20) + 1;
            const success = (roll + mod) >= event.dc;

            profile.coins -= 50;
            if (success) { profile.coins += 120; profile.xp += 30; } else { profile.xp += 5; }
            await profile.save();

            const embed = new EmbedBuilder()
                .setTitle(`📜 冒險判定：${event.stat.toUpperCase()}`)
                .setColor(success ? '#00ff00' : '#ff0000')
                .setDescription(`${event.text}\n\n🎲 點數: **${roll}** (${mod >= 0 ? '+' : ''}${mod})\n🎯 總計: **${roll + mod}** (DC: ${event.dc})`)
                .addFields({ name: '📜 結果', value: success ? `🏆 ${event.win}` : `💀 ${event.lose}` })
                .setTimestamp();

            message.channel.send({ embeds: [embed] });
        } catch (e) {
            console.error(e);
            message.reply("❌ 冒險地圖丟失了，請回酒館休息。");
        }
    }
};
