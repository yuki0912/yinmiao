const { EmbedBuilder } = require("discord.js");
const translate = require('google-translate-api-x');

module.exports = {
    name: "translate",
    aliases: ["tr", "翻譯"],
    description: "翻譯文字內容",

    async run(client,message, args) {
        if (!args[0]) return message.reply("⚠️ 請輸入內容！格式: `!translate [語言代碼(選填)] [內容]`");

        // 判斷第一個參數是不是語言代碼 (簡單判定長度是否為 2-5 位)
        let targetLang = 'zh-TW';
        let text = args.join(' ');

        if (args[0].length <= 5 && args[1]) {
            targetLang = args[0];
            text = args.slice(1).join(' ');
        }

        try {
            const res = await translate(text, { to: targetLang });

            const embed = new EmbedBuilder()
                .setTitle("🌐 翻譯結果")
                .setColor("#5865F2")
                .addFields(
                    { name: "📥 原文", value: `\`\`\`${text}\`\`\`` },
                    { name: `📤 翻譯 (${targetLang})`, value: `\`\`\`${res.text}\`\`\`` }
                )
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
        } catch (e) {
            message.channel.send("❌ 翻譯發生錯誤。");
        }
    }
};
