const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // 基礎過濾：機器人發送或私訊直接忽略
        if (message.author.bot || !message.guild) return;

        const content = message.content;
        const convertedLinks = [];

        // 🎨 Pixiv (phixiv.net)
        const pixivRegex = /https?:\/\/(?:www\.)?pixiv\.net\/(?:[a-zA-Z]{2}\/)?artworks\/([0-9]+)/g;
        for (const match of content.matchAll(pixivRegex)) {
            const rawUrl = `https://pixiv.net/artworks/${match[1]}`;
            const phixivUrl = `https://phixiv.net/artworks/${match[1]}`;
            convertedLinks.push(`**[Pixiv](<${rawUrl}>) ‖ [Phixiv](${phixivUrl})**`);
        }

        // 📺 Bilibili (vxbilibili.com)
        const bilibiliRegex = /https?:\/\/(?:www\.|m\.)?bilibili\.com\/(?!.*vxbilibili\.com)([^\s]+)/g;
        for (const match of content.matchAll(bilibiliRegex)) {
            const rawUrl = match[0];
            const vxUrl = rawUrl.replace(/https?:\/\/(?:www\.|m\.)?bilibili\.com\//, 'https://www.vxbilibili.com/');
            convertedLinks.push(`**[Bilibili](<${rawUrl}>) ‖ [BiliFix](${vxUrl})**`);
        }

        // 🧵 Threads (vxthreads.net)
        const threadsRegex = /https?:\/\/(?:www\.)?(?:threads|fixthreads)\.com\/([^\s]+)/g;
        for (const match of content.matchAll(threadsRegex)) {
            const rawUrl = match[0];
            const vxUrl = rawUrl.replace(/https?:\/\/(?:www\.)?threads\.com\//, 'https://fixthreads.seria.moe/');
            convertedLinks.push(`**[Threads](<${rawUrl}>) ‖ [FixThreads](${vxUrl})**`);
        }
        
        // 發送轉換後的超連結並關閉原始預覽
        if (convertedLinks.length > 0) {
            try {
                // 發送修復訊息
                await message.channel.send({
                    content: convertedLinks.join('\n'),
                    allowedMentions: { repliedUser: false }
                }).catch(() => { });

                // 1. 立即關閉原訊息預覽
                await message.suppressEmbeds(true).catch(() => { });

                // 2. 延遲 1.5 秒再次關閉（防止 Discord 異步載入原生預覽的時間差）
                setTimeout(async () => {
                    await message.suppressEmbeds(true).catch(() => { });
                }, 1500);

            } catch (error) {
                // 靜默略過
            }
        }
    },
};