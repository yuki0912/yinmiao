const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ComponentType 
} = require("discord.js");
const GuildConfig = require("../../../models/GuildConfig"); 

module.exports = {
    name: "help",
    aliases: ["h", "幫助", "帮助", "指令"],
    category: "Admin",
    description: "展示銀喵的所有指令，讓主人更了解我喵！",

    // 🌟 修正參數順序：(message, args, client)
    run: async (message, args, client) => {
        try {
            // 🛡️ 安全檢查：防止 client 遺失
            if (!client || !client.prefixCommands) {
                return message.channel.send("❌ 銀喵暫時找不到指令清單，請檢查後台載入狀況喵！");
            }

            // 1. 取得前綴 (優先級：資料庫 > .env > 預設值)
            let currentPrefix = process.env.PREFIX || "s!";
            try {
                const guildData = await GuildConfig.findOne({ guildId: message.guild.id });
                if (guildData && guildData.prefix) currentPrefix = guildData.prefix;
            } catch (dbErr) {
                // 保持預設
            }

            const allCommands = client.prefixCommands;

            // 2. 提取分類並排序
            const categories = [...new Set(allCommands.map(cmd => 
                (cmd.category || "未分類").trim()
            ))].sort().slice(0, 25);

            const catEmojis = {
                "Admin": "🛡️",
                "Fun": "🎨",
                "System": "⚙️",
                "Info": "📢",
                "未分類": "📦"
            };

            // 3. 建立下拉選單
            const menuOptions = categories.map(cat => ({
                label: `${cat} 分類`,
                value: cat.toLowerCase(),
                description: `查看銀喵的 ${cat} 類指令`,
                emoji: catEmojis[cat] || "🐾"
            }));

            const menu = new StringSelectMenuBuilder()
                .setCustomId('help_menu')
                .setPlaceholder('請選擇一個分類看看喵...')
                .addOptions(menuOptions);

            const row = new ActionRowBuilder().addComponents(menu);

            // 4. 初始主頁 Embed
            const mainEmbed = new EmbedBuilder()
                .setTitle("🐾 銀喵助手 | 指令幫助手冊")
                .setDescription(`主人您好！我是 **${client.user.username}** 喵！\n目前我學會了 **${allCommands.size}** 個指令喔！\n\n請從下方選單挑選想看的分類喵～✨`)
                .setColor("#ffb7c5")
                .addFields(
                    { name: "💡 當前前綴", value: `\`${currentPrefix}\``, inline: true },
                    { name: "⚡ 斜線指令", value: `輸入 \`/\` 也可以召喚我`, inline: true }
                )
                .setThumbnail(client.user.displayAvatarURL())
                .setFooter({ text: `請求者: ${message.author.username} 🐾`, iconURL: message.author.displayAvatarURL() })
                .setTimestamp();

            const helpMessage = await message.reply({ 
                embeds: [mainEmbed], 
                components: [row] 
            });

            // 5. 建立互動收集器
            const collector = helpMessage.createMessageComponentCollector({ 
                filter: (i) => i.user.id === message.author.id,
                componentType: ComponentType.StringSelect,
                time: 60000 
            });

            collector.on('collect', async (interaction) => {
                const selectedCat = interaction.values[0];
                
                const cmds = allCommands.filter(cmd => 
                    (cmd.category || "未分類").trim().toLowerCase() === selectedCat
                );

                const desc = cmds.map(cmd => {
                    const aliasStr = cmd.aliases && cmd.aliases.length > 0 ? ` (\`${cmd.aliases.join(', ')}\`)` : '';
                    return `**${currentPrefix}${cmd.name}**${aliasStr}\n└ 🐾 ${cmd.description || "這招還沒有描述喵..."}`;
                }).join("\n\n");

                const categoryEmbed = new EmbedBuilder()
                    .setTitle(`${catEmojis[Object.keys(catEmojis).find(k => k.toLowerCase() === selectedCat)] || "🐾"} 分類: ${selectedCat.toUpperCase()}`)
                    .setColor("#ffb7c5")
                    .setDescription(`這是 **${selectedCat}** 分類的清單喵：\n\n${desc || "這個箱子是空的喵..."}`)
                    .setTimestamp();

                await interaction.update({ embeds: [categoryEmbed] });
            });

            collector.on('end', () => {
                const disabledRow = new ActionRowBuilder().addComponents(
                    menu.setDisabled(true).setPlaceholder('選單已失效，請重新輸入 help 指令喵！')
                );
                helpMessage.edit({ components: [disabledRow] }).catch(() => null);
            });

        } catch (error) {
            console.error("Help Command Error:", error);
            // 🌟 這裡也改成最安全的 channel.send
            message.channel.send("❌ 哎呀！銀喵的大腦剛才斷線了，請再試一次喵！").catch(() => null);
        }
    }
};
