const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const randomAnime = require('random-anime');

function getAnimeImageUrl() {
    const image = randomAnime.anime();
    if (typeof image !== 'string' || !image.trim()) return null;
    try {
        const url = new URL(image.trim());
        return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
    } catch {
        return null;
    }
}

// 原本沒有 deferred 回覆時直接 reply，避免多餘的 editReply 引發 10008。
async function sendResponse(interaction, payload) {
    if (interaction.replied) return interaction.followUp(payload);
    if (interaction.deferred) {
        try {
            return await interaction.editReply(payload);
        } catch (error) {
            if (error.code !== 10008) throw error;
            console.warn('[anime] 原始互動回覆不存在，改用 followUp:', interaction.id);
            return interaction.followUp(payload);
        }
    }
    return interaction.reply(payload);
}

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('anime')
        .setDescription('取得隨機動漫圖片 :D'),

    async execute(interaction) {
        try {
            // random-anime 同步產生圖片網址，無須先 deferReply。
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
                .setImage(imageUrl)
                .setColor('#F2A9B4')
                .setFooter({
                    text: '由 ' + (user.tag || user.username) + ' 請求',
                    iconURL: user.displayAvatarURL({ extension: 'png', size: 128 })
                })
                .setTimestamp();

            await sendResponse(interaction, { embeds: [embed] });
        } catch (error) {
            console.error('[anime] 執行失敗:', {
                interactionId: interaction.id,
                code: error.code,
                message: error.message
            }, error);

            // 互動逾時、已被確認或 token 失效時不再重複回覆。
            if ([10062, 40060, 50027].includes(error.code)) return;

            try {
                await sendResponse(interaction, {
                    content: '❌ 動漫圖片指令執行失敗，請稍後再試。',
                    embeds: []
                });
            } catch (replyError) {
                console.error('[anime] 錯誤提示發送失敗:', {
                    interactionId: interaction.id,
                    code: replyError.code,
                    message: replyError.message
                }, replyError);
            }
        }
    }
};
