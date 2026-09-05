const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: "General",
    data: new SlashCommandBuilder()
        .setName("pixiv")
        .setDescription("🎨 輸入關鍵字，自動搜尋並生成 Pixiv 精美插畫與二創圖喵！")
        .addStringOption(option =>
            option.setName('keyword')
                .setDescription('輸入你想搜尋的動漫作品、角色或標籤（例如：初音未來、貓娘）')
                .setRequired(true)),

    async execute(interaction) {
        // 1. 先延遲回覆，因為呼叫外部 API 需要 1~2 秒的時間
        await interaction.deferReply();

        const query = interaction.options.getString('keyword');
        const encodedQuery = encodeURIComponent(query);
        const user = interaction.user;

        // 預留一個備用的手動搜尋網址（當 API 找不到圖時降級使用）
        const backupSearchUrl = `https://www.pixiv.net/tags/${encodedQuery}/artworks`;

        try {
            // 2. 呼叫 Lolicon 公開 API 進行關鍵字搜尋 (強制限制 r18=0 確保絕對安全！)
            const apiUrl = `https://api.lolicon.app/setu/v2?keyword=${encodedQuery}&r18=0`;
            
            // 使用 Node.js 內建的 fetch 獲取資料
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`API 回應失敗 (狀態碼: ${response.status})`);
            
            const result = await response.json();

            // 3. 🚩 判斷有沒有成功撈到插畫
            if (result.data && result.data.length > 0) {
                // 隨機拿取搜尋結果的第一張圖 (通常是最符合關鍵字的熱門圖)
                const artwork = result.data[0];
                const pid = artwork.pid;         // 作品 ID
                const p = artwork.p || 0;        // 圖片分頁 (0 代表第一張)
                const authorUid = artwork.uid;   // 作者 ID
                
                // 🟢 使用 pixiv.cat 代理網址，完美破解 Discord 的 403 圖片阻擋封鎖
                const proxyImageUrl = `https://pixiv.cat/${pid}${p > 0 ? `-${p}` : ''}.jpg`;
                const pixivArtworkUrl = `https://www.pixiv.net/artworks/${pid}`;
                const pixivAuthorUrl = `https://www.pixiv.net/users/${authorUid}`;

                // 4. 建立帶有自動生成插畫的精美 Embed 卡片
                const embed = new EmbedBuilder()
                    .setTitle(`🎨 Pixiv 插畫現形：${artwork.title || '無題'}`)
                    .setURL(pixivArtworkUrl) // 點擊標題直接前往該作品頁面
                    .setDescription(`主人！銀喵用關鍵字 \`${query}\` 幫您召喚出大大的神作囉喵！🐾`)
                    .setColor('#0096FF') // Pixiv 經典天藍色
                    .setImage(proxyImageUrl) // 🟢 自動生成並展示圖片！
                    .addFields(
                        { name: '👤 繪師 / 作者', value: `[${artwork.author || '未知繪師'}](${pixivAuthorUrl})`, inline: true },
                        { name: '🆔 作品 ID', value: `\`${pid}\``, inline: true },
                        { name: '🏷️ 主要標籤', value: artwork.tags ? `\`${artwork.tags.slice(0, 3).join('` `')}\`` : '\`無\`', inline: false }
                    )
                    .setFooter({ 
                        text: `由 ${user.username} 請求 ‧ 插畫自動生成系統`, 
                        iconURL: user.displayAvatarURL({ size: 256 }) 
                    })
                    .setTimestamp();

                // 5. 建立直達按鈕組組件
                const artworkButton = new ButtonBuilder()
                    .setLabel('前往 Pixiv 觀看原作')
                    .setURL(pixivArtworkUrl)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🌐');

                const authorButton = new ButtonBuilder()
                    .setLabel('追蹤這位繪師')
                    .setURL(pixivAuthorUrl)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('❤️');

                const row = new ActionRowBuilder().addComponents(artworkButton, authorButton);

                // 發送完美結晶！
                return await interaction.editReply({ embeds: [embed], components: [row] });

            } else {
                // 6. 降級安全閥：如果該關鍵字在 API 中找不到「全年齡安全圖」
                // 則自動切換回原本的「純搜尋連結模式」，確保功能絕對不會壞掉！
                const safeQuery = query.length > 50 ? `${query.slice(0, 47)}...` : query;

                const fallbackEmbed = new EmbedBuilder()
                    .setTitle("🔍 Pixiv 插畫特輯 ‧ 搜尋傳送門")
                    .setDescription(`主人，目前的自動生成庫裡暫時沒有 \`${query}\` 的全年齡插畫喵...\n不過銀喵已經幫您打包好官方搜尋標籤了！點擊下方按鈕一樣可以去官網看美圖喔！🐾`)
                    .setColor('#FFA500') // 提示橘色
                    .setThumbnail('https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f3a8.png')
                    .addFields({ name: '🔍 搜尋標籤', value: `\`${query}\`` })
                    .setFooter({ text: `由 ${user.username} 請求`, iconURL: user.displayAvatarURL({ size: 256 }) })
                    .setTimestamp();

                const fallbackButton = new ButtonBuilder()
                    .setLabel(`手工搜尋「${safeQuery}」`)
                    .setURL(backupSearchUrl)
                    .setStyle(ButtonStyle.Link)
                    .setEmoji('🎨');

                const row = new ActionRowBuilder().addComponents(fallbackButton);

                return await interaction.editReply({ embeds: [fallbackEmbed], components: [row] });
            }

        } catch (error) {
            console.error(`[Slash Pixiv Auto-Gen Error]: ${error.message}`);
            
            // 🔒 終極出錯防禦：哪怕連網路都斷了，也給玩家一個手動直達連結，體驗不受影響！
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff3333')
                .setTitle('❌ 自動生成插畫時發生突發狀況')
                .setDescription(`主人嗚嗚...圖庫反應不及，自動生成失敗了喵。\n您可以直接點選下方按鈕，走手動傳送門前往 Pixiv 喔！`)
                .setTimestamp();

            const errorButton = new ButtonBuilder()
                .setLabel(`直接前往 Pixiv 搜尋`)
                .setURL(backupSearchUrl)
                .setStyle(ButtonStyle.Link)
                .setEmoji('🔗');

            const row = new ActionRowBuilder().addComponents(errorButton);

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed], components: [row] });
            } else {
                await interaction.reply({ embeds: [errorEmbed], components: [row], ephemeral: true });
            }
        }
    }
};
