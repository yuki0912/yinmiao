const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const randomAnime = require('random-anime');

function getAnimeImageUrl() {
    // 沿用 random-anime，圖片網址偶爾無效時再嘗試幾次。
    for (let attempt = 0; attempt < 3; attempt++) {
        const image = randomAnime.anime();
        if (typeof image !== 'string' || !image.trim()) continue;
        try {
            const url = new URL(image.trim());
            if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
        } catch {
            // 無效網址不傳給 Discord，避免 Embed 驗證失敗。
        }
    }
    return null;
}

async function sendResponse(interaction, payload) {
    if (interaction.replied) return interaction.followUp(payload);

    if (interaction.deferred) {
        try {
            return await interaction.editReply(payload);
        } catch (error) {
            if (error.code !== 10008) throw error;
            console.warn('[anime] 原始互動回覆不存在，嘗試補發:', interaction.id);
            return interaction.followUp(payload);
        }
    }

    return interaction.reply(payload);
}

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('使用 random-anime 取得隨機動漫圖片'),

    async execute(interaction) {
        try {
            // random-anime 的 anime() 同步產生網址，直接 reply 以避免多餘的等待。
            const imageUrl = getAnimeImageUrl();

            if (!imageUrl) {
                await sendResponse(interaction, {
                    content: '❌ 暫時無法取得動漫圖片，請稍後再試。'
                });
                return;
            }

            const user = interaction.user;
            const embed = new EmbedBuilder()
                .setTitle('🎌 隨機動漫圖片')
                .setURL(imageUrl)
                .setDescription('如果圖片沒有顯示，可點擊標題開啟原圖。')
                .setImage(imageUrl)
                .setColor('#F2A9B4')
                .setFooter({
                    text: '由 ' + (user.tag || user.username) + ' 請求',
                    iconURL: user.displayAvatarURL({ extension: 'png', size: 128 })
                })
                .setTimestamp();

            await sendResponse(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('[anime] 指令執行失敗:', {
                interactionId: interaction.id,
                code: error.code,
                message: error.message
            }, error);

            // 互動超時、已由別的程序確認、Token 失效時不重複發送回覆。
            if ([10062, 40060, 50027].includes(error.code)) return;

            try {
                await sendResponse(interaction, {
                    content: '❌ 動漫圖片指令發生錯誤，請稍後再試。',
                    embeds: []
                });
            } catch (replyError) {
                console.error('[anime] 無法發送錯誤提示:', {
                    interactionId: interaction.id,
                    code: replyError.code,
                    message: replyError.message
                }, replyError);
            }
        }
    }
};
