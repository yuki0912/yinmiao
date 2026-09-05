const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pinterest')
        .setDescription('🔍 快速搜尋 Pinterest 日本站的流行靈感與萌圖喵！')
        .addStringOption(option =>
            option.setName('關鍵字')
                .setDescription('輸入妳想搜尋的關鍵字（例如：貓咪、室內設計、動漫桌布）')
                .setRequired(true)),

    async execute(interaction) {
        const query = interaction.options.getString('關鍵字');
        
        // 將關鍵字進行網址編碼，確保中文或日文在網址中不會變成亂碼
        const encodedQuery = encodeURIComponent(query);
        
        // 建立直達 Pinterest 日本站搜尋結果的連結
        const searchUrl = `https://pinterest.jp/search/pins/?q=${encodedQuery}`;

        // 1. 建立精美的圖文內嵌訊息 (Embed)
        const embed = new EmbedBuilder()
            .setTitle(`📌 Pinterest 日本站 ‧ 靈感搜尋`)
            .setDescription(`主人！銀喵已經幫妳把關鍵字打包好囉！\n點擊下方的 **「前往 Pinterest」** 按鈕，或是直接點擊直達連結，就能去尋找好看的圖片與穿搭設計靈感了喵！🐾`)
            .setColor('#E60023') // Pinterest 官方經典紅色
            .addFields(
                { name: '🔍 搜尋關鍵字', value: `\`${query}\``, inline: true },
                { name: '🌐 搜尋地區', value: `🇯🇵 Pinterest Japan`, inline: true },
                { name: '🔗 直達連結', value: `[點我前往 pinterest.jp](${searchUrl})`, inline: false }
            )
            .setThumbnail('https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f4cc.png') // 萌萌的圖釘 Emoji
            .setTimestamp()

        // 2. 建立更高級的「互動式網址按鈕」(Button Component)
        const button = new ButtonBuilder()
            .setLabel(`前往 Pinterest 觀看「${query}」`)
            .setURL(searchUrl)
            .setStyle(ButtonStyle.Link)
            .setEmoji('📌');

        const row = new ActionRowBuilder().addComponents(button);

        // 回傳給使用者（包含內嵌訊息與漂亮的按鈕組件）
        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
