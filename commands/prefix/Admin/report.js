const { EmbedBuilder } = require("discord.js");

module.exports = {
    name: "report",
    aliases: ["回報"],
    category: "Admin",
    description: "向開發者回報錯誤或提供建議喵！",

    // 🌟 核心修正：確保參數順序是 (message, args, client)
    async execute(message, args, client) {
        // 現在 args 是正確的數組了，.join(" ") 就不會報錯
        const query = args.join(" ");
        const attachment = message.attachments.first();

        // 1. 檢查輸入
        if (!query && !attachment) {
            return message.reply("💡 請輸入回報內容或上傳截圖喵！").catch(() => null);
        }

        // 2. 獲取日誌頻道
        const logChannelId = process.env.REPORT_LOG_ID;
        if (!logChannelId) {
            return message.reply("❌ 系統未設定回報頻道 (REPORT_LOG_ID) 喵。").catch(() => null);
        }

        try {
            const logChannel = await client.channels.fetch(logChannelId).catch(() => null);
            if (!logChannel) {
                return message.reply("❌ 找不到回報接收頻道，請聯絡管理員喵。").catch(() => null);
            }

            // 3. 建立回報資訊
            const reportId = Math.random().toString(36).substring(2, 7).toUpperCase();
            const embed = new EmbedBuilder()
                .setAuthor({
                    name: `來自 ${message.author.tag}`,
                    iconURL: message.author.displayAvatarURL()
                })
                .setTitle(`🚨 新回報 [#${reportId}]`)
                .setColor(0xff3333)
                .addFields(
                    { name: "📝 描述", value: query || "*(僅圖片)*" },
                    { name: "📍 來源", value: `${message.guild.name} (<#${message.channel.id}>)` }
                )
                .setTimestamp();

            if (attachment?.contentType?.startsWith("image/")) {
                embed.setImage(attachment.url);
            }

            // 4. 發送回報
            await logChannel.send({ embeds: [embed] });

            // 5. 回覆使用者
            await message.reply(`✅ 回報已送出！編號：**#${reportId}**`).catch(() => null);

        } catch (error) {
            console.error(`[Report Command Error]:`, error);
            message.reply("❌ 執行回報時出錯，請稍後再試喵。").catch(() => null);
        }
    }
};
