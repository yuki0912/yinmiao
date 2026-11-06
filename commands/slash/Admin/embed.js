const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags
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
    const footer = get('footer');
    const footerIcon = validateUrl(get('footer_icon_url'), 'Footer 圖示');

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

    if (footer) {
        const footerData = { text: footer };
        if (footerIcon) footerData.iconURL = footerIcon;
        embed.setFooter(footerData);
    } else if (footerIcon) {
        throw new Error('設定 Footer 圖示時，必須同時填寫 Footer 文字。');
    }

    const fields = [];
    for (let i = 1; i <= 4; i++) {
        const name = get('field' + i + '_name');
        const value = get('field' + i + '_value');
        const inline = interaction.options.getBoolean('field' + i + '_inline');

        if (name || value) {
            if (!name || !value) throw new Error('Field ' + i + ' 的名稱和內容必須同時填寫。');
            fields.push({ name, value, inline: inline === true });
        } else if (inline) {
            throw new Error('Field ' + i + ' 設定 Inline 前，請先填寫名稱和內容。');
        }
    }
    if (fields.length) embed.addFields(fields);

    const data = embed.toJSON();
    if (![data.title, data.description, data.author, data.thumbnail, data.image, data.footer, ...(data.fields || [])].some(Boolean)) {
        throw new Error('請至少填寫 Title、Description、Author、Field、Image、Thumbnail 或 Footer 其中一項。');
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
        .addStringOption(option => option.setName('footer').setDescription('Footer：頁尾文字').setMaxLength(2048).setRequired(false))
        .addStringOption(option => option.setName('footer_icon_url').setDescription('Footer：頁尾圖示網址').setMaxLength(2000).setRequired(false))
        .addStringOption(option => option.setName('field1_name').setDescription('Field 1：欄位名稱').setMaxLength(256).setRequired(false))
        .addStringOption(option => option.setName('field1_value').setDescription('Field 1：欄位內容').setMaxLength(1024).setRequired(false))
        .addBooleanOption(option => option.setName('field1_inline').setDescription('Field 1：是否 Inline').setRequired(false))
        .addStringOption(option => option.setName('field2_name').setDescription('Field 2：欄位名稱').setMaxLength(256).setRequired(false))
        .addStringOption(option => option.setName('field2_value').setDescription('Field 2：欄位內容').setMaxLength(1024).setRequired(false))
        .addBooleanOption(option => option.setName('field2_inline').setDescription('Field 2：是否 Inline').setRequired(false))
        .addStringOption(option => option.setName('field3_name').setDescription('Field 3：欄位名稱').setMaxLength(256).setRequired(false))
        .addStringOption(option => option.setName('field3_value').setDescription('Field 3：欄位內容').setMaxLength(1024).setRequired(false))
        .addBooleanOption(option => option.setName('field3_inline').setDescription('Field 3：是否 Inline').setRequired(false))
        .addStringOption(option => option.setName('field4_name').setDescription('Field 4：欄位名稱').setMaxLength(256).setRequired(false))
        .addStringOption(option => option.setName('field4_value').setDescription('Field 4：欄位內容').setMaxLength(1024).setRequired(false))
        .addBooleanOption(option => option.setName('field4_inline').setDescription('Field 4：是否 Inline').setRequired(false)),

    async execute(interaction) {
        try {
            if (!interaction.inGuild() || !interaction.guild) {
                throw new Error('/embed 只能在伺服器內使用喵！');
            }

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            await checkChannel(interaction.guild, channel);

            const embed = buildInitialEmbed(interaction);
            const { createEmbedControls, getEmbedTextLength } = require('../../../utils/embedBuilder');
            const totalTextLength = getEmbedTextLength(embed);
            if (totalTextLength > 6000) throw new Error('Embed 文字總長度超過 Discord 的 6000 字元限制。');

            await interaction.reply({
                content: '✨ **Embed 卡片預覽**\n目前 1/10 張。可追加卡片，確認外觀後再發送到指定頻道。',
                embeds: [embed],
                components: [createEmbedControls(channel.id, 1)],
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