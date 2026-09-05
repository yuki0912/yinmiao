const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'info',
    aliases: ['botinfo', '關於', '关于'],
    category: 'Fun',
    description: '查看機器人資訊、服務條款與隱私政策',

    async run(client, message, args) {
        // 🚩 請替換成你實際的 GitHub 連結
        const tosUrl = "https://github.com";
        const privacyUrl = "https://github.com";
        const githubUrl = "https://github.com";

        const infoEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setTitle(`🤖 關於 ${client.user.username}`)
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(`你好！我是 **${client.user.username}**，一個整合了等級、經濟與管理功能的助手。`)
            .addFields(
                { name: '📊 統計', value: `伺服器數: \`${client.guilds.cache.size}\`\n總用戶數: \`${client.users.cache.size}\``, inline: true },
                { name: '⏳ 運行時間', value: `<t:${Math.floor(client.readyTimestamp / 1000)}:R>`, inline: true },
                { name: '📜 法律資訊', value: '我們重視您的隱私與權益，您可以透過下方的按鈕查看詳細條款。' }
            )
            .setFooter({ text: `版本 v1.0.0 | 請求者: ${message.author.tag}` })
            .setTimestamp();

        // 建立按鈕連結
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('服務條款 (ToS)')
                .setStyle(ButtonStyle.Link)
                .setURL(tosUrl),
            new ButtonBuilder()
                .setLabel('隱私政策')
                .setStyle(ButtonStyle.Link)
                .setURL(privacyUrl),
            new ButtonBuilder()
                .setLabel('GitHub 原始碼')
                .setStyle(ButtonStyle.Link)
                .setURL(githubUrl)
        );

        await message.reply({ embeds: [infoEmbed], components: [row] });
    }
};
