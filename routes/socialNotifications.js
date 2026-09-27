const SocialNotification = require('../models/SocialNotification');
const { normalizePlatform, cleanUsername, poll } = require('../services/socialNotificationService');

function registerSocialNotificationRoutes(app, { client, checkAuth }) {
    app.get('/manage/:guildId/social-notify', checkAuth, async (req, res) => {
        const { guildId } = req.params;
        if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send('無權限喵！');

        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return res.status(404).send('銀喵不在這個伺服器喵！');

        const feeds = await SocialNotification.find({ guildId }).sort({ platform: 1, username: 1 });

        const fetchedChannels = await guild.channels.fetch().catch(() => new Map());
        const channels = fetchedChannels
            .filter(c => c && (c.type === 0 || c.type === 5))
            .map(c => ({ id: c.id, name: c.name }));

        const roles = guild.roles.cache
            .filter(r => r.name !== '@everyone' && !r.managed)
            .map(r => ({ id: r.id, name: r.name }));

        res.render('social-notify', {
            pageTitle: '社群通知設定',
            botName: '銀喵 YinMiao',
            user: req.session.user,
            guildId,
            guildName: guild.name,
            feeds,
            channels,
            roles
        });
    });

    app.post('/api/social-notify/add', checkAuth, async (req, res) => {
        try {
            const { guildId, platform, username, channelId, roleId, title, customMessage, color } = req.body;

            if (!guildId || !platform || !username || !channelId) {
                return res.status(400).json({ status: 'error', message: '缺少必要欄位喵！' });
            }

            if (!req.session.guilds?.some(g => g.id === guildId)) {
                return res.status(403).json({ status: 'error', message: '無權限操作此伺服器喵！' });
            }

            const normalizedPlatform = normalizePlatform(platform);
            if (!['youtube', 'twitter', 'twitch'].includes(normalizedPlatform)) {
                return res.status(400).json({ status: 'error', message: '不支援的平台喵！' });
            }

            const normalizedUsername = cleanUsername(normalizedPlatform, username);

            const feed = await SocialNotification.findOneAndUpdate(
                { guildId, platform: normalizedPlatform, username: normalizedUsername, channelId },
                {
                    $set: {
                        roleId: roleId || null,
                        title: title || '',
                        customMessage: customMessage || '',
                        color: /^#[0-9A-F]{6}$/i.test(color || '') ? color : '#FFC8DD',
                        enabled: true
                    },
                    $setOnInsert: {
                        guildId,
                        platform: normalizedPlatform,
                        username: normalizedUsername,
                        channelId
                    }
                },
                { upsert: true, new: true }
            );

            await poll(client);
            res.json({ status: 'success', feed });
        } catch (error) {
            console.error('社群通知設定錯誤:', error);
            res.status(500).json({ status: 'error', message: error.message });
        }
    });

    app.post('/api/social-notify/delete', checkAuth, async (req, res) => {
        try {
            const { guildId, id } = req.body;
            if (!req.session.guilds?.some(g => g.id === guildId)) {
                return res.status(403).json({ status: 'error', message: '無權限操作此伺服器喵！' });
            }

            const deleted = await SocialNotification.deleteOne({ _id: id, guildId });
            res.json({ status: deleted.deletedCount ? 'success' : 'error' });
        } catch (error) {
            res.status(500).json({ status: 'error', message: error.message });
        }
    });
}

module.exports = registerSocialNotificationRoutes;
