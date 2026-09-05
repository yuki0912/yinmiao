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
               .setDescription('點擊標題可跳轉的網址')
               .setRequired(false)
        )
        .addAttachmentOption(opt =>
            opt.setName('image')
               .setDescription('附加大圖')
               .setRequired(false)
        ),

    async execute(interaction) {
        const title = interaction.options.getString('title');
        const description = interaction.options.getString('description').replace(/\\n/g, '\n');
        const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
        const rawColor = interaction.options.getString('color');
        const url = interaction.options.getString('url');
        const image = interaction.options.getAttachment('image');

        // 色碼格式檢查 (無填寫或格式錯誤時使用預設色)
        const embedColor = (rawColor && /^#[0-9A-F]{6}$/i.test(rawColor)) ? rawColor : '#2F3136';

        // 建立基本 Embed 卡片
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

        // 條件式加入可選參數
        if (url) embed.setURL(url);
        if (image) embed.setImage(image.url);

        // 發送至指定頻道
        await targetChannel.send({ embeds: [embed] });

        // 私密回應提示
        await interaction.reply({ 
            content: `✅ 訊息已發送至 ${targetChannel} 囉喵！`, 
            flags: [MessageFlags.Ephemeral] 
        });
    }
};