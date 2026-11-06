const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');

function validateUrl(value, label) {
    if (!value) return null;
    let parsed;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error(label + '網址格式不正確。');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(label + '網址必須使用 http:// 或 https://。');
    }
    return parsed.href;
}

function createControls(channelId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('embed:add:' + channelId)
            .setLabel('➕ 追加卡片')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('embed:send:' + channelId)
            .setLabel('🚀 發送到頻道')
            .setStyle(ButtonStyle.Success)
    );
}

async function checkChannel(guild, channel) {
    if (!channel || !channel.isTextBased() || channel.guildId !== guild.id) {
        throw new Error('找不到有效的伺服器文字頻道。');
    }
    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const permissions = me && channel.permissionsFor(me);
    const required = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
    ];
    if (!permissions || !permissions.has(required)) {
        throw new Error('銀喵缺少查看頻道、發送訊息或嵌入連結權限。');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('建立多張 Embed 卡片，預覽後再發送')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(opt => opt.setName('title').setDescription('第一張卡片標題').setMaxLength(256).setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('第一張卡片內文').setMaxLength(4096).setRequired(true))
        .addChannelOption(opt => opt.setName('channel').setDescription('目標頻道（未填則使用目前頻道）').addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(false))
        .addStringOption(opt => opt.setName('color').setDescription('卡片顏色，例如 #F43F5E').setMaxLength(7).setRequired(false))
        .addStringOption(opt => opt.setName('url').setDescription('點擊標題後開啟的網址').setMaxLength(2000).setRequired(false))
        .addAttachmentOption(opt => opt.setName('image').setDescription('上傳卡片大圖（只接受圖片）').setRequired(false))
        .addStringOption(opt => opt.setName('image_url').setDescription('卡片大圖網址').setMaxLength(2000).setRequired(false))
        .addStringOption(opt => opt.setName('thumbnail').setDescription('卡片縮圖網址').setMaxLength(2000).setRequired(false))
        .addStringOption(opt => opt.setName('footer').setDescription('卡片頁尾文字').setMaxLength(2048).setRequired(false)),

    async execute(interaction) {
        try {
            if (!interaction.inGuild() || !interaction.guild) {
                return interaction.reply({ content: '❌ /embed 只能在伺服器內使用喵！', flags: [MessageFlags.Ephemeral] });
            }

            const title = interaction.options.getString('title', true).trim();
            const description = interaction.options.getString('description', true).replace(/\\n/g, '\n').trim();
            const channel = interaction.options.getChannel('channel') || interaction.channel;
            const color = interaction.options.getString('color');
            const url = validateUrl(interaction.options.getString('url'), '標題連結');
            const imageUrl = validateUrl(interaction.options.getString('image_url'), '圖片');
            const thumbnail = validateUrl(interaction.options.getString('thumbnail'), '縮圖');
            const attachment = interaction.options.getAttachment('image');
            const footer = interaction.options.getString('footer');

            if (!title || title.length > 256) throw new Error('標題不可空白，且最多 256 個字元。');
            if (!description || description.length > 4096) throw new Error('內文不可空白，且最多 4096 個字元。');
            if (color && !/^#[0-9A-F]{6}$/i.test(color.trim())) throw new Error('顏色請使用六位色碼，例如 #F43F5E。');

            if (attachment && !imageUrl) {
                const isImage = (attachment.contentType && attachment.contentType.startsWith('image/'))
                    || /\\.(png|jpe?g|gif|webp|avif)$/i.test(attachment.name || '');
                if (!isImage) throw new Error('上傳的附件不是可辨識的圖片格式。');
            }

            await checkChannel(interaction.guild, channel);

            const embed = new EmbedBuilder()
                .setAuthor({ name: interaction.guild.name, iconURL: interaction.guild.iconURL() || undefined })
                .setTitle(title)
                .setDescription(description)
                .setColor(color ? color.trim() : '#F43F5E')
                .setTimestamp()
                .setFooter({
                    text: footer && footer.trim() ? footer.trim() : '發送者：' + interaction.user.tag,
                    iconURL: interaction.user.displayAvatarURL()
                });

            if (url) embed.setURL(url);
            if (imageUrl || attachment) embed.setImage(imageUrl || attachment.url);
            if (thumbnail) embed.setThumbnail(thumbnail);

            await interaction.reply({
                content: '✨ **Embed 卡片預覽**\n目前 1/10 張。可追加卡片，確認後再發送到指定頻道。',
                embeds: [embed],
                components: [createControls(channel.id)],
                flags: [MessageFlags.Ephemeral]
            });
        } catch (error) {
            console.error('建立 Embed 預覽失敗:', error);
            const response = { content: '❌ ' + (error.message || '建立 Embed 時發生錯誤。'), flags: [MessageFlags.Ephemeral] };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(response).catch(() => null);
            } else {
                await interaction.reply(response).catch(() => null);
            }
        }
    }
};