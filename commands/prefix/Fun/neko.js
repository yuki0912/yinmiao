const { EmbedBuilder } = require("discord.js");
const axios = require("axios");

module.exports = {
    name: "neko",
    aliases: ["貓貓", "貓耳", "喵"],
    category: "Fun", // 🌟 設定分類，讓 help 指令能抓到它
    description: "從 nekos.best 獲取一張可愛的貓耳少女圖片喵 🐱",
    
    // 🌟 修正參數順序：(message, args, client)
    async run(message, args, client) {
        // 先發送一個讀取中的提示
        const loadingMsg = await message.channel.send("🐈 正在為主人召喚貓貓中，請等我一下喵...");

        try {
            // 1. 獲取 API 資料
            const res = await axios.get("https://nekos.best/api/v2/neko", { 
                timeout: 5000,
                headers: { 'User-Agent': 'YinMiaoBot/1.0' } 
            });
            
            const data = res.data?.results?.[0];

            if (!data || !data.url) {
                return loadingMsg.edit("❌ 哎呀... 無法從圖片伺服器獲取內容，請稍後再試喵。");
            }

            // 2. 建立 Embed (使用銀喵粉色調)
            const embed = new EmbedBuilder()
                .setTitle("🏮 Neko! 喵~ 🐱")
                .setURL(data.url)
                .setImage(data.url)
                .setColor("#ffb7c5") // 統一使用銀喵粉
                .addFields(
                    { name: "🎨 繪師", value: `\`${data.artist_name || "未知"}\``, inline: true },
                    { name: "🔗 來源", value: `[點擊查看](${data.artist_href || data.source_url || "https://nekos.best/"})`, inline: true }
                )
                .setFooter({ 
                    text: `請求者：${message.author.username} 🐾`, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                })
                .setTimestamp();

            // 💡 直接編輯原本的讀取訊息，畫面更絲滑喵！
            await loadingMsg.edit({ content: null, embeds: [embed] });

        } catch (e) {
            console.error(`[Neko Command Error]: ${e.stack}`);
            
            const errorMsg = e.code === 'ECONNABORTED' ? "❌ 伺服器回應超時，召喚失敗了喵..." : "❌ 獲取貓貓圖片時發生錯誤喵！";
            
            if (loadingMsg) {
                loadingMsg.edit(errorMsg).catch(() => null);
            } else {
                message.channel.send(errorMsg).catch(() => null);
            }
        }
    }
};
