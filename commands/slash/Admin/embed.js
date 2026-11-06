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
    if (!value) return undefined;
    let parsed;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error(label + '網址格式不正確。');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(label + '必須使用 http:// 或 https://。');
    }
    return parsed.href;
}

async function checkChannel(guild, channel) {
    if (!channel || !channel.isTextBased() || channel.guildId !== guild.id) {
        throw new Error('找不到有效的伺服器文字頻道。');
    }

    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const permissions = botMember && channel.permissionsFor(botMember);
    const sendPermission = typeof channel.isThread === 'function' && channel.isThread()
        ? PermissionFlagsBits.SendMessagesInThreads
        : PermissionFlagsBits.SendMessages;

    if (!permissions || !permissions.has([
        PermissionFlagsBits.ViewChannel,
        sendPermission,
        PermissionFlagsBits.EmbedLinks
    ])) {
        throw new Error('銀喵在 ' + channel + ' 缺少查看頻道、發送訊息或嵌入連結權限。');
    }
}

function buildInitialEmbed(interaction) {
    const get = name => interaction.options.getString(name);
    const embed = new EmbedBuilder();

    const title = get('title');
    const description = get('description');
    const color = get('color');
    const url = validateUrl(get('url'), '標題連結');
    const authorName = get('author');
    const authorIcon = validateUrl(get('author_icon_url'), 'Author 圖示');
    const authorUrl = validateUrl(get('author_url'), 'Author 連結');
    const thumbnail = validateUrl(get('thumbnail'), 'Thumbnail');
    const image = validateUrl(get('image'), 'Image');

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description.replace(/\\n/g, '\n'));
    if (color) {
        if (!/^#[0-9A-F]{6}$/i.test(color)) throw new Error('Color 請使用六位色碼，例如 #0099ff。');
        embed.setColor(color);
    }
    if (url) embed.setURL(url);

    if (authorName) {
        const author = { name: authorName };
        if (authorIcon) author.iconURL = authorIcon;
        if (authorUrl) author.url = authorUrl;
        embed.setAuthor(author);
    } else if (authorIcon || authorUrl) {
        throw new Error('設定 Author 圖示或連結時，必須同時填寫 Author 名稱。');
    }

    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);

    const timestamp = interaction.options.getBoolean('timestamp');
    if (timestamp) embed.setTimestamp();

    const footerName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
    embed.setFooter({
        text: footerName,
        iconURL: interaction.user.displayAvatarURL({ size: 256 })
    });

    const data = embed.toJSON();
    if (![data.title, data.description, data.author, data.thumbnail, data.image].some(Boolean)) {
        throw new Error('請至少填寫 Title、Description、Author、Image 或 Thumbnail 其中一項。');
    }

    return embed;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('建立完整 Embed 卡片，預覽後再發送')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(option => option
            .setName('channel')
            .setDescription('Embed 的目標發送頻道（未填則使用目前頻道）')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
            .setRequired(false))
        .addStringOption(option => option.setName('title').setDescription('Title：卡片標題').setMaxLength(256).setRequired(false))
        .addStringOption(option => option.setName('description').setDescription('Description：卡片內文').setMaxLength(4096).setRequired(false))
        .addStringOption(option => option.setName('color').setDescription('Color：色碼，例如 #0099ff').setMaxLength(7).setRequired(false))
        .addStringOption(option => option.setName('url').setDescription('URL：點擊標題開啟的網址').setMaxLength(2000).setRequired(false))
        .addStringOption(option => option.setName('author').setDescription('Author：作者名稱').setMaxLength(256).setRequired(false))
        .addStringOption(option => option.setName('author_icon_url').setDescription('Author：作者圖示網址').setMaxLength(2000).setRequired(false))
        .addStringOption(option => option.setName('author_url').setDescription('Author：作者連結網址').setMaxLength(2000).setRequired(false))
        .addStringOption(option => option.setName('thumbnail').setDescription('Thumbnail：右上角縮圖網址').setMaxLength(2000).setRequired(false))
        .addStringOption(option => option.setName('image').setDescription('Image：卡片底部大圖網址').setMaxLength(2000).setRequired(false))
        .addBooleanOption(option => option.setName('timestamp').setDescription('Timestamp：是否顯示目前時間').setRequired(false))
        .addBooleanOption(option => option.setName('timestamp').setDescription('Timestamp：是否顯示目前時間').setRequired(false)),

    async execute(interaction) {
        try {
            if (!interaction.inGuild() || !interaction.guild) {
                throw new Error('/embed 只能在伺服器內使用喵！');
            }

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            await checkChannel(interaction.guild, channel);

            const embed = buildInitialEmbed(interaction);
            const data = embed.toJSON();
            const textParts = [data.title, data.description, data.author?.name, data.footer?.text];
            const totalTextLength = textParts.reduce((sum, value) => sum + (typeof value === 'string' ? value.length : 0), 0);
            if (totalTextLength > 6000) throw new Error('Embed 文字總長度超過 Discord 的 6000 字元限制。');

            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('embed:add:' + channel.id).setLabel('➕ 追加卡片（還可加 9 張）').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('embed:send:' + channel.id).setLabel('🚀 發送到頻道').setStyle(ButtonStyle.Success)
            );

            await interaction.reply({
                content: '✨ **Embed 卡片預覽**\\n目前 1/10 張。可追加卡片，確認外觀後再發送到指定頻道。',
                embeds: [embed],
                components: [controls],
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