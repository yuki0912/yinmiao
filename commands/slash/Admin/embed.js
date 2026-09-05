const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('發送一張標準的 Embed 內嵌卡片')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt =>
            opt.setName('title')
               .setDescription('卡片標題')
               .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('description')
               .setDescription('內文描述（支援 \\n 換行與 Markdown 語法）')
               .setRequired(true)
        )
        .addChannelOption(opt =>
            opt.setName('channel')
               .setDescription('要發送的頻道（未填則發送至當前頻道）')
               .addChannelTypes(ChannelType.GuildText)
               .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('color')
               .setDescription('色碼（例如: #FFC8DD，預設為暗色系）')
               .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('url')
               .setDescription('點擊標題可跳轉的網址（需包含 http:// 或 https://）')
               .setRequired(false)
        )
        .addAttachmentOption(opt =>
            opt.setName('image')
               .setDescription('附加大圖')
               .setRequired(false)
        ),

    async execute(interaction) {
        // 先延遲回應，防止發送過程超過 3 秒導致指令逾時
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description').replace(/\\n/g, '\n');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const rawColor = interaction.options.getString('color');
        const url = interaction.options.getString('url');
        const image = interaction.options.getAttachment('image');

        // 色碼格式驗證
        const embedColor = (rawColor && /^#[0-9A-F]{6}$/i.test(rawColor)) ? rawColor : '#2F3136';

        // 建立 Embed 卡片
        const embed = new EmbedBuilder()
            .setAuthor({ 
                name: interaction.guild.name, 
                iconURL: interaction.guild.iconURL() || undefined 
            })
            .setTitle(title)
            .setDescription(description)
            .setColor(embedColor)
            .setTimestamp()
            .setFooter({ 
                text: `發送者：${interaction.user.tag}`, 
                iconURL: interaction.user.displayAvatarURL() 
            });

        // URL 格式驗證（防範未帶 http/https 導致 Discord API 報錯）
        if (url) {
            try {
                const parsedUrl = new URL(url);
                if (['http:', 'https:'].includes(parsedUrl.protocol)) {
                    embed.setURL(parsedUrl.href);
                } else {
                    return interaction.editReply('⚠️ 網址必須以 `http://` 或 `https://` 開頭喵！');
                }
            } catch (e) {
                return interaction.editReply('⚠️ 提供的網址格式不正確，請檢查後重試喵！');
            }
        }

        if (image) {
            embed.setImage(image.url);
        }

        // 發送訊息與權限捕獲
        try {
            await targetChannel.send({ embeds: [embed] });
            await interaction.editReply(`✅ 訊息已成功發送至 ${targetChannel} 囉喵！`);
        } catch (err) {
            console.error('發送 Embed 失敗:', err);
            await interaction.editReply(`❌ 發送失敗，請確認銀喵在 ${targetChannel} 是否擁有「發送訊息」與「嵌入連結」權限喵！`);
        }
    }
};