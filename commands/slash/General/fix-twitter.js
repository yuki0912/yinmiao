const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    category: "General",
    data: new SlashCommandBuilder()
        .setName('twitter')
        .setDescription('🔗 自動修復 Twitter / X 及 Pixiv 連結排版預覽')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('url')
                .setDescription('請輸入要轉換的 Twitter 或 Pixiv 網址')
                .setRequired(true)),

    async execute(interaction) {
        const inputUrl = interaction.options.getString('url').trim();

        // 🔍 正規表達式（支援 Twitter/X 與 Pixiv 多語言路徑）
        const twitterRegex = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/g;
        const pixivRegex = /https?:\/\/(?:www\.)?pixiv\.net\/(?:[a-zA-Z]{2}\/)?artworks\/([0-9]+)/g;

        const twitterMatches = [...inputUrl.matchAll(twitterRegex)];
        const pixivMatches = [...inputUrl.matchAll(pixivRegex)];

        if (twitterMatches.length === 0 && pixivMatches.length === 0) {
            return interaction.reply({
                content: '❌ 未找到可修復的 Twitter / X 或 Pixiv 連結喵！',
                ephemeral: true
            });
        }

        const convertedLinks = [];

        // 🐦 處理 Twitter / X 轉換 (FxTwitter)
        for (const match of twitterMatches) {
            const username = match[1];
            const statusId = match[2];
            const fxUrl = `https://fxtwitter.com/${username}/status/${statusId}`;
            const rawUrl = `https://x.com/${username}/status/${statusId}`;
            const usnUrl = `https://x.com/${username}/`;
            
            convertedLinks.push(`**[Tweet](<${rawUrl}>) ‖ [ACC](<${usnUrl}>) ‖ [X URL](${fxUrl})**`);
        }

        // 🎨 處理 Pixiv 轉換 (Phixiv)
        for (const match of pixivMatches) {
            const illustId = match[1];
            const rawUrl = `https://www.pixiv.net/artworks/${illustId}`;
            const phixivUrl = `https://www.phixiv.net/artworks/${illustId}`;
            
            convertedLinks.push(`**[Artwork](<${rawUrl}>) ‖ [Pixiv URL](${phixivUrl})**`);
        }

        await interaction.reply({
            content: convertedLinks.join('\n')
        });
    }
};