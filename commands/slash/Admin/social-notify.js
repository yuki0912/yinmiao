const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');

const SocialNotification = require('../../../models/SocialNotification');
const {
    normalizePlatform,
    cleanUsername,
    isValidRssUrl,
    poll
} = require('../../../services/socialNotificationService');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('social-notify')
        .setDescription('設定 YouTube / X(Twitter) / Twitch 通知')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('新增社群通知')
            .addStringOption(opt => opt
                .setName('platform')
                .setDescription('通知平台')
                .setRequired(true)
                .addChoices(
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'X / Twitter', value: 'twitter' },
                    { name: 'Twitch', value: 'twitch' }
                ))
            .addStringOption(opt => opt
                .setName('username')
                .setDescription('YouTube Channel ID / X username / Twitch login')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('rss_url')
                .setDescription('X 專用：RSS.app 產生的 RSS Feed URL')
                .setRequired(false))
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('Discord 通知頻道')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true))
            .addRoleOption(opt => opt
                .setName('role')
                .setDescription('可選：通知時標記此身分組')
                .setRequired(false)))
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('移除社群通知')
            .addStringOption(opt => opt
                .setName('platform')
                .setDescription('通知平台')
                .setRequired(true)
                .addChoices(
                    { name: 'YouTube', value: 'youtube' },
                    { name: 'X / Twitter', value: 'twitter' },
                    { name: 'Twitch', value: 'twitch' }
                ))
            .addStringOption(opt => opt
                .setName('username')
                .setDescription('要移除的帳號')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('查看目前的社群通知設定')),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (sub === 'list') {
            const feeds = await SocialNotification.find({ guildId }).sort({ platform: 1, username: 1 });
            if (!feeds.length) {
                return interaction.reply({ content: '📭 目前沒有社群通知設定喵。', ephemeral: true });
            }

            const lines = feeds.map((feed, index) =>
                `${index + 1}. **${feed.platform}** · \`${feed.username}\` → <#${feed.channelId}> ${feed.enabled ? '🟢' : '🔴'}`
            );

            return interaction.reply({
                content: `📡 **社群通知設定**\n\n${lines.join('\n')}`,
                ephemeral: true
            });
        }

        const platform = normalizePlatform(interaction.options.getString('platform'));
        const username = cleanUsername(platform, interaction.options.getString('username'));
        const rssUrl = interaction.options.getString('rss_url');
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        if (sub === 'remove') {
            const deleted = await SocialNotification.deleteOne({ guildId, platform, username });
            return interaction.reply({
                content: deleted.deletedCount
                    ? `🗑️ 已移除 **${platform} / ${username}** 的通知設定。`
                    : '❌ 找不到這個通知設定喵。',
                ephemeral: true
            });
        }

        if (platform === 'twitter' && !isValidRssUrl(rssUrl)) {
            return interaction.reply({
                content: '❌ X / Twitter 需要 RSS Feed URL。請先用 RSS.app 建立公開 X 帳號的 RSS，再把 XML Feed URL 填到 `rss_url`。',
                ephemeral: true
            });
        }

        try {
            const feed = await SocialNotification.findOneAndUpdate(
                { guildId, platform, username, channelId: channel.id },
                {
                    $set: {
                        roleId: role?.id || null,
                        enabled: true,
                        ...(platform === 'twitter' ? { sourceId: rssUrl.trim() } : {})
                    },
                    $setOnInsert: {
                        guildId,
                        platform,
                        username,
                        channelId: channel.id
                    }
                },
                { upsert: true, new: true }
            );

            if (platform === 'twitter' && feed.lastItemId) {
                feed.lastItemId = null;
                await feed.save();
            }

            // 建立後立即做一次掃描，第一次只會建立基準，不會把舊內容洗版。
            await poll(interaction.client);

            await interaction.reply({
                content:
                    `✅ 已新增 **${platform} / ${username}** 通知。\n` +
                    `📢 頻道：<#${channel.id}>\n` +
                    (role ? `🏷️ 標記：<@&${role.id}>\n` : '') +
                    (platform === 'twitter'
                        ? '🔗 X RSS：已設定 RSS Feed URL。'
                        : platform === 'youtube'
                            ? '💡 YouTube 請填 Channel ID（例如 UC...）。'
                            : ''),
                ephemeral: true
            });
        } catch (error) {
            console.error('social-notify add:', error);
            await interaction.reply({
                content: `❌ 建立通知失敗：${error.message}`,
                ephemeral: true
            });
        }
    }
};
