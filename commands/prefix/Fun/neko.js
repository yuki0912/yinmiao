const { EmbedBuilder } = require('discord.js');
const { fetchNekosBest, httpUrl, errorDescription } =
    require('../../../utils/axiosMedia');

module.exports = {
    name: 'neko',
    aliases: ['貓貓', '貓耳', '喵'],
    category: 'Fun',
    description: '從 nekos.best 取得貓耳少女圖片 🐱',

    // Prefix 指令由 messageCreate.js 使用 execute(message, args, client) 呼叫。
    async execute(message, args, client) {
        let loadingMessage = null;
        try {
            loadingMessage = await message.reply('🐈 正在召喚貓耳少女圖片...');
            const data = await fetchNekosBest('neko');
            const artistName = String(data.artist_name || '未知繪師').slice(0, 150);
            const artistUrl = httpUrl(data.artist_href) || httpUrl(data.source_url);

            const embed = new EmbedBuilder()
                .setTitle('🐱 Neko！貓耳少女')
                .setURL(data.url)
                .setImage(data.url)
                .setColor('#F2A9B4')
                .setDescription(
                    artistUrl
                        ? '🎨 **繪師：** [' + artistName + '](' + artistUrl + ')'
                        : '🎨 **繪師：** ' + artistName
                )
                .setFooter({
                    text: '由 ' + message.author.username + ' 請求',
                    iconURL: message.author.displayAvatarURL({ extension: 'png', size: 128 })
                })
                .setTimestamp();

            try {
                await loadingMessage.edit({
                    content: '',
                    embeds: [embed],
                    allowedMentions: { parse: [] }
                });
            } catch (error) {
                if (error.code !== 10008) throw error;
                await message.reply({
                    embeds: [embed],
                    allowedMentions: { parse: [] }
                });
            }
        } catch (error) {
            console.error('[prefix neko] 圖片取得或回覆失敗:', {
                code: error.code,
                status: error.response?.status,
                message: error.message
            }, error);

            const reply = errorDescription(error, '貓耳少女圖片');
            try {
                if (loadingMessage) {
                    await loadingMessage.edit({ content: reply, embeds: [] });
                } else {
                    await message.reply(reply);
                }
            } catch (replyError) {
                await message.reply(reply).catch(secondError => {
                    console.error('[prefix neko] 無法回覆失敗提示:', secondError);
                });
            }
        }
    }
};
