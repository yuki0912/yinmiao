const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    category: "General",
    data: new SlashCommandBuilder()
        .setName('url')
        .setDescription('🔗 手動修復並轉換各社群平台的連結排版預覽')
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('url')
                .setDescription('請輸入要轉換的 Twitter/X、Pixiv、Bilibili、Threads 或 IG 網址')
                .setRequired(true)),

    async execute(interaction) {
        const inputUrl = interaction.options.getString('url').trim();

        // 各平台正規表達式
        const twitterRegex = /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)\/status\/([0-9]+)/g;
        const pixivRegex = /https?:\/\/(?:www\.)?pixiv\.net\/(?:[a-zA-Z]{2}\/)?artworks\/([0-9]+)/g;
        const bilibiliRegex = /https?:\/\/(?:www\.|m\.)?bilibili\.com\/([^\s]+)/g;
        const threadsRegex = /https?:\/\/(?:www\.)?threads\.net\/([^\s]+)/g;
        const igRegex = /https?:\/\/(?:www\.)?instagram\.com\/([^\s]+)/g;

        const twitterMatches = [...inputUrl.matchAll(twitterRegex)];
        const pixivMatches = [...inputUrl.matchAll(pixivRegex)];
        const bilibiliMatches = [...inputUrl.matchAll(bilibiliRegex)];
        const threadsMatches = [...inputUrl.matchAll(threadsRegex)];
        const igMatches = [...inputUrl.matchAll(igRegex)];

        if (
            twitterMatches.length === 0 &&
            pixivMatches.length === 0 &&
            bilibiliMatches.length === 0 &&
            threadsMatches.length === 0 &&
            igMatches.length === 0
        ) {
            return interaction.reply({
                content: '❌ 未找到可修復的支援平台連結喵！',
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

        // 📺 處理 Bilibili 轉換 (BiliFix)
        for (const match of bilibiliMatches) {
            const rawUrl = match[0];
            const vxUrl = rawUrl.replace(/https?:\/\/(?:www\.|m\.)?bilibili\.com\//, 'https://www.vxbilibili.com/');
            convertedLinks.push(`**[Bilibili](<${rawUrl}>) ‖ [BiliFix](${vxUrl})**`);
        }

        // 🧵 處理 Threads 轉換 (FixThreads)
        for (const match of threadsMatches) {
            const rawUrl = match[0];
            const vxUrl = rawUrl.replace(/https?:\/\/(?:www\.)?threads\.net\//, 'https://fixthreads.seria.moe//');
            convertedLinks.push(`**[Threads](<${rawUrl}>) ‖ [FixThreads](${vxUrl})**`);
        }

        // 📸 處理 Instagram 轉換 (DDInstagram)
        for (const match of igMatches) {
            const rawUrl = match[0];
            const ogUrl = rawUrl.replace(/https?:\/\/(?:www\.)?instagram\.com\//, 'https://www.oginstagram.com/');
            convertedLinks.push(`**[Instagram](<${rawUrl}>) ‖ [OGIG](${ogUrl})**`);
        }

        await interaction.reply({
            content: convertedLinks.join('\n')
        });
    }
};