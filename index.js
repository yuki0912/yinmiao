require('dotenv').config();
process.env.TZ = process.env.TZ || 'Asia/Kuala_Lumpur';

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const OAuth2 = require('discord-oauth2');
const crypto = require('node:crypto');
const {
    Client,
    Collection,
    GatewayIntentBits,
    REST,
    Routes,
    Partials,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Events,
    MessageFlags
} = require('discord.js');

// --- 1. 初始化 Express 與 MongoDB 連線 Promise ---
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_NAME = '銀喵 YinMiao';
const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';

// SESSION_SECRET 必須在本機 .env 或 Render Environment 中設定，禁止使用硬編碼預設值。
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || !sessionSecret.trim()) {
    throw new Error('缺少 SESSION_SECRET 環境變數，請在 .env 或 Render Environment 中設定。');
}

// 建立共用 Mongoose 連線 Promise，避免 MongoStore 重覆建立連線池
const mongooseConnectionPromise = mongoose.connect(process.env.MONGODB_URI);

// --- 2. 初始化 Discord Bot ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates // 🎙️ 保留動態語音頻道狀態偵測
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember]
});

client.slashCommands = new Collection();
client.prefixCommands = new Collection();

// 引入 MongoDB Models
const GuildConfig = require('./models/GuildConfig');
const PendingRole = require('./models/PendingRole');
const ReactionRole = require('./models/ReactionRole');

// --- 3. Express 中間件與 Session ---
app.disable('x-powered-by');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);

app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        clientPromise: mongooseConnectionPromise.then(m => m.connection.getClient()),
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1天
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax'
    }
}));

function getBaseUrl(req) {
    return `${req.protocol}://${req.get('host')}`;
}

function getRedirectUri(req) {
    if (process.env.REDIRECT_URI && process.env.REDIRECT_URI.trim() !== '') {
        return process.env.REDIRECT_URI.trim();
    }
    return `${getBaseUrl(req)}/auth/callback`;
}

app.use((req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();

    const originHeader = req.get('origin');
    const refererHeader = req.get('referer');
    let sourceOrigin = originHeader;

    if (!sourceOrigin && refererHeader) {
        try {
            sourceOrigin = new URL(refererHeader).origin;
        } catch {
            return res.status(403).json({ status: 'error', message: '請求來源無效。' });
        }
    }

    const expectedOrigin = new URL(getBaseUrl(req)).origin;
    if (!sourceOrigin || sourceOrigin !== expectedOrigin) {
        return res.status(403).json({ status: 'error', message: '禁止跨站修改後台設定。' });
    }

    next();
});

app.use((req, res, next) => {
    const fullUrl = `${getBaseUrl(req)}${req.originalUrl}`;
    const currentAvatar = client.user ? client.user.displayAvatarURL({ size: 512, extension: 'png' }) : 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/512x512/1f431.png';

    res.locals.seo = {
        title: '銀喵 YinMiao | 妳的專屬 Discord 伺服器萌寵夥伴',
        description: '銀喵是一隻多功能 Discord 機器人，內建流暢的網頁後台控制台。',
        url: fullUrl,
        image: `${getBaseUrl(req)}/images/og-preview.png`,
        botAvatar: currentAvatar
    };

    res.locals.botAvatar = currentAvatar;
    next();
});

const oauth = new OAuth2({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
});

function checkAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// --- 5. 核心同步功能 ---
async function syncRulesMessage(guildId) {
    try {
        const config = await GuildConfig.findOne({ guildId });
        if (!config || !config.rulesChannelId) return;

        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(config.rulesChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const targetEmoji = (config.rulesEmoji && config.rulesEmoji.trim().replace(/\uFE0F/g, '')) || '✅';

        const ruleEmbed = new EmbedBuilder()
            .setTitle(config.rulesTitle || '📜 伺服器守則')
            .setDescription(config.rulesDescription || '請遵守規範喵～')
            .setColor(config.rulesEmbedColor || '#FFC8DD');

        if (config.embedAuthorName && config.embedAuthorName.trim().length > 0) {
            ruleEmbed.setAuthor({
                name: config.embedAuthorName,
                iconURL: config.embedAuthorIcon || undefined,
                url: config.embedAuthorUrl || undefined
            });
        }

        if (config.embedThumbnail && config.embedThumbnail.trim().length > 0) ruleEmbed.setThumbnail(config.embedThumbnail);
        if (config.embedImage && config.embedImage.trim().length > 0) ruleEmbed.setImage(config.embedImage);

        if (config.embedFooterText && config.embedFooterText.trim().length > 0) {
            ruleEmbed.setFooter({
                text: config.embedFooterText,
                iconURL: config.embedFooterIcon || undefined
            });
        }

        if (config.embedTimestamp) {
            ruleEmbed.setTimestamp();
        }

        let targetMsg = null;

        if (config.rulesMessageId && config.rulesMessageId.trim().length > 0) {
            try {
                targetMsg = await channel.messages.fetch(config.rulesMessageId);
            } catch (e) {
                config.rulesMessageId = "";
                await config.save();
            }
        }

        if (targetMsg) {
            if (targetMsg.author.id === client.user.id) {
                await targetMsg.edit({ embeds: [ruleEmbed] }).catch(() => {});
            }
            await targetMsg.react(targetEmoji).catch(() => { });
            return;
        }

        if (config.rulesTitle || config.rulesDescription) {
            const sentMsg = await channel.send({ embeds: [ruleEmbed] }).catch(() => null);
            if (sentMsg) {
                await sentMsg.react(targetEmoji).catch(() => { });
                config.rulesMessageId = sentMsg.id;
                await config.save();
            }
        }
    } catch (err) {
        // 靜默略過
    }
}

async function syncTicketMessage(guildId) {
    try {
        const config = await GuildConfig.findOne({ guildId });
        if (!config || !config.ticketChannelId || !config.ticketMessageId) return;

        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return;

        const channel = await guild.channels.fetch(config.ticketChannelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return;

        const targetMsg = await channel.messages.fetch(config.ticketMessageId).catch(() => null);

        if (targetMsg) {
            const botAvatar = client.user ? client.user.displayAvatarURL() : 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/512x512/1f431.png';

            const embed = new EmbedBuilder()
                .setTitle(config.ticketTitle || '📩 聯絡支援 / 建立工單')
                .setDescription(config.ticketDescription || '請點擊下方按鈕建立工單')
                .setColor(config.ticketColor || '#FFC8DD')
                .setThumbnail(botAvatar)
                .setFooter({ text: config.ticketFooter || '銀喵 YinMiao 工單系統', iconURL: botAvatar });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('create_ticket').setLabel('建立工單').setEmoji('🎫').setStyle(ButtonStyle.Primary)
            );

            await targetMsg.edit({ embeds: [embed], components: [row] }).catch(() => {});
        }
    } catch (err) {
        // 靜默略過
    }
}

// --- 6. 🌐 網頁頁面路由 ---
app.get('/', (req, res) => {
    res.render('index', {
        botName: BOT_NAME,
        user: req.session.user || null,
        inviteLink: `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`
    });
});

app.get('/login', (req, res) => {
    const redirectUri = getRedirectUri(req);
    const state = crypto.randomBytes(32).toString('hex');
    req.session.discordOAuthState = state;
    req.session.discordOAuthExpiresAt = Date.now() + 10 * 60 * 1000;

    const url = oauth.generateAuthUrl({
        scope: ['identify', 'guilds'],
        responseType: 'code',
        redirectUri,
        state
    });

    req.session.save(error => {
        if (error) {
            return res.status(500).send('登入暫時無法使用，請稍後再試。');
        }
        res.redirect(url);
    });
});

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const receivedState = typeof req.query.state === 'string' ? req.query.state : '';
    const expectedState = req.session?.discordOAuthState;
    const expiresAt = req.session?.discordOAuthExpiresAt || 0;

    delete req.session.discordOAuthState;
    delete req.session.discordOAuthExpiresAt;

    const validState = typeof expectedState === 'string'
        && /^[a-f0-9]{64}$/.test(expectedState)
        && /^[a-f0-9]{64}$/.test(receivedState)
        && Date.now() < expiresAt
        && crypto.timingSafeEqual(Buffer.from(receivedState, 'hex'), Buffer.from(expectedState, 'hex'));

    if (!validState) {
        return res.status(403).send('登入驗證已過期，請返回首頁後重新登入。');
    }

    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) return res.redirect('/');

    try {
        const redirectUri = getRedirectUri(req);
        const tokenData = await oauth.tokenRequest({
            code,
            scope: 'identify guilds',
            grantType: 'authorization_code',
            redirectUri
        });
        const user = await oauth.getUser(tokenData.access_token);
        const guilds = await oauth.getUserGuilds(tokenData.access_token);

        await new Promise((resolve, reject) => {
            req.session.regenerate(error => error ? reject(error) : resolve());
        });
        req.session.user = user;
        req.session.guilds = guilds.filter(g => g.owner === true || (BigInt(g.permissions) & 8n) === 8n);

        await new Promise((resolve, reject) => {
            req.session.save(error => error ? reject(error) : resolve());
        });
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send('認證失敗，請重新登入。');
    }
});

app.get('/commands', (req, res) => {
    const slashCmds = client.slashCommands.map(cmd => ({ name: cmd.data?.name || '未命名指令', description: cmd.data?.description || '這個指令目前沒有描述喵～' }));
    const prefixCmds = client.prefixCommands.map(cmd => ({ name: cmd.name || '未命名指令', description: cmd.description || '這個指令目前沒有描述喵～' }));
    res.render('commands', { pageTitle: '指令手冊', botName: BOT_NAME, user: req.session.user || null, inviteLink: `https://discord.com/api/oauth2/authorize?client_id=${process.env.CLIENT_ID}&permissions=8&scope=bot%20applications.commands`, slashCmds, prefixCmds });
});

app.get('/dashboard', checkAuth, (req, res) => {
    const processedGuilds = (req.session.guilds || []).map(guild => ({ ...guild, botInGuild: client.guilds.cache.has(guild.id) }));
    res.render('dashboard', { pageTitle: '控制台首頁', botName: BOT_NAME, user: req.session.user, guilds: processedGuilds, clientId: process.env.CLIENT_ID });
});

app.get('/manage/:guildId', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("銀喵不在這裡喵！");
    let config = await GuildConfig.findOne({ guildId }) || await GuildConfig.create({ guildId });
    res.render('manage', { pageTitle: '功能選擇', botName: BOT_NAME, user: req.session.user, guildId, guildName: guild.name, config });
});

app.get('/manage/:guildId/rules', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("請先邀請銀喵喵！");
    const fetchedChannels = await guild.channels.fetch().catch(() => new Collection());
    const fetchedRoles = await guild.roles.fetch().catch(() => new Collection());
    const channels = fetchedChannels.filter(c => c && c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name }));
    const roles = fetchedRoles.filter(r => r && r.name !== '@everyone' && !r.managed).map(r => ({ id: r.id, name: r.name }));
    let config = await GuildConfig.findOne({ guildId }) || await GuildConfig.create({ guildId });
    res.render('rules', { pageTitle: '守則設定', botName: BOT_NAME, user: req.session.user, guildId, guildName: guild.name, channels, roles, config });
});

app.get('/manage/:guildId/welcome', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("請先邀請銀喵喵！");
    const fetchedChannels = await guild.channels.fetch().catch(() => new Collection());
    const channels = fetchedChannels.filter(c => c && c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name }));
    let config = await GuildConfig.findOne({ guildId }) || await GuildConfig.create({ guildId });

    res.render('welcome', {
        pageTitle: '歡迎訊息設定',
        botName: BOT_NAME,
        user: req.session.user,
        guildId,
        guildName: guild.name,
        guild: { id: guild.id, name: guild.name, icon: guild.icon },
        channels,
        config
    });
});

app.get('/manage/:guildId/ticket', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("請先邀請銀喵喵！");
    const fetchedChannels = await guild.channels.fetch().catch(() => new Collection());
    const channels = fetchedChannels.filter(c => c && c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name }));
    let config = await GuildConfig.findOne({ guildId }) || await GuildConfig.create({ guildId });
    res.render('ticket', { pageTitle: '工單系統設定', botName: BOT_NAME, user: req.session.user, guildId, guildName: guild.name, channels, config });
});

app.get('/manage/:guildId/reaction-role', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("請先邀請銀喵喵！");
    try {
        const fetchedChannels = await guild.channels.fetch().catch(() => new Collection());
        const fetchedRoles = await guild.roles.fetch().catch(() => new Collection());
        const channels = fetchedChannels.filter(c => c && c.type === ChannelType.GuildText).map(c => ({ id: c.id, name: c.name }));
        const roles = fetchedRoles.filter(r => r && r.name !== '@everyone' && !r.managed).map(r => ({ id: r.id, name: r.name }));

        const existingRoles = await ReactionRole.find({ guildId });

        const configs = {};
        existingRoles.forEach(item => {
            if (!configs[item.messageId]) {
                configs[item.messageId] = { channelId: item.channelId, pairs: [] };
            }
            configs[item.messageId].pairs.push({ emoji: item.emoji, roleId: item.roleId });
        });

        res.render('reaction-role', {
            pageTitle: '反應身分組設定', botName: BOT_NAME, user: req.session.user, guildId, guildName: guild.name, channels, roles, configs
        });
    } catch (err) {
        res.status(500).send("載入網頁時出錯了喵...");
    }
});

app.get('/manage/:guildId/voice', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("請先邀請銀喵喵！");
    const fetchedChannels = await guild.channels.fetch().catch(() => new Collection());
    const channels = fetchedChannels.filter(c => c && c.type === ChannelType.GuildVoice).map(c => ({ id: c.id, name: c.name }));
    let config = await GuildConfig.findOne({ guildId }) || await GuildConfig.create({ guildId });
    config.voiceSettings = config.voiceSettings || [];
    res.render('voice', { pageTitle: '動態語音設定', botName: BOT_NAME, user: req.session.user, guildId, guildName: guild.name, channels, config });
});

app.get('/manage/:guildId/embed', checkAuth, async (req, res) => {
    const { guildId } = req.params;
    if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).send("無權限喵！");

    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return res.send("請先邀請銀喵喵！");

    try {
        const fetchedChannels = await guild.channels.fetch().catch(() => new Collection());
        const channels = fetchedChannels
            .filter(c => c && c.type === ChannelType.GuildText)
            .map(c => ({ id: c.id, name: c.name }));

        res.render('embed', {
            pageTitle: 'Embed 多卡片廣播',
            botName: BOT_NAME,
            user: req.session.user,
            guildId,
            guildName: guild.name,
            channels
        });
    } catch (err) {
        res.status(500).send("載入網頁時出錯了喵...");
    }
});

// --- 7. 📡 API POST 路由 ---
app.post('/api/save-config', async (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ status: 'error', message: '未登入喵！' });
    try {
        const { guildId, voiceSettings, ...rawData } = req.body;
        if (!guildId) return res.status(400).json({ status: 'error', message: '缺少伺服器 ID 喵！' });
        if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).json({ status: 'error', message: '無權限操作此伺服器喵！' });

        const updateData = {};

        const welcomeFieldMap = {
            welcomeChannelId: 'welcomeChannelId',
            welcomeContent: 'welcomeContent',
            welcomeTitle: 'welcomeTitle',
            welcomeDescription: 'welcomeDescription',
            welcomeEmbedColor: 'welcomeEmbedColor',
            embedColor: 'welcomeEmbedColor',
            welcomeImageUrl: 'welcomeImageUrl',
            canvasText: 'canvasText',
            canvasMainText: 'canvasText',
            canvasSubText: 'canvasSubText',
            canvasColor: 'canvasColor',
            canvasSubColor: 'canvasSubColor',
            canvasBg: 'canvasBg',
            canvasBackgroundUrl: 'canvasBg',
            customBg: 'canvasBg',
            canvasOverlayOpacity: 'canvasOverlayOpacity',
            welcomeFooter: 'welcomeFooter',
            leaveChannelId: 'leaveChannelId',
            leaveContent: 'leaveContent',
            leaveTitle: 'leaveTitle',
            leaveDescription: 'leaveDescription',
            leaveEmbedColor: 'leaveEmbedColor',
            leaveFooter: 'leaveFooter'
        };

        const welcomeBooleanKeys = [
            'sendCanvas', 'sendEmbed', 'sendLeave', 'sendLeaveEmbed',
            'showTimestamp', 'showFooter', 'showLeaveTimestamp', 'showLeaveFooter'
        ];

        const rulesKeys = [
            'rulesChannelId', 'rulesRoleId', 'rulesTitle', 'rulesDescription',
            'rulesEmoji', 'rulesMessageId', 'rulesEmbedColor', 'embedTimestamp',
            'embedAuthorName', 'embedAuthorIcon', 'embedAuthorUrl',
            'embedThumbnail', 'embedImage', 'embedFooterText', 'embedFooterIcon'
        ];

        const ticketKeys = [
            'ticketChannelId', 'ticketMessageId', 'ticketTitle',
            'ticketDescription', 'ticketFooter', 'ticketColor'
        ];

        const isWelcomeForm =
            Object.keys(welcomeFieldMap).some(key => rawData[key] !== undefined)
            || welcomeBooleanKeys.some(key => rawData[key] !== undefined);
        const isRulesForm = rulesKeys.some(key => rawData[key] !== undefined);
        const isTicketForm = ticketKeys.some(key => rawData[key] !== undefined);
        const isVoiceForm = voiceSettings !== undefined;

        if (isWelcomeForm) {
            for (const [inputKey, dbKey] of Object.entries(welcomeFieldMap)) {
                if (rawData[inputKey] === undefined) continue;

                if (inputKey === 'embedColor' && rawData.welcomeEmbedColor !== undefined) continue;
                if (inputKey === 'canvasMainText' && rawData.canvasText !== undefined) continue;
                if (['canvasBackgroundUrl', 'customBg'].includes(inputKey) && rawData.canvasBg !== undefined) continue;

                const value = rawData[inputKey];

                if (dbKey === 'canvasOverlayOpacity') {
                    if (value === '' || value === null) {
                        updateData[dbKey] = null;
                    } else {
                        const opacity = Number(value);
                        if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) {
                            return res.status(400).json({
                                status: 'error',
                                message: 'Canvas 背景遮罩透明度必須介於 0 到 1 之間。'
                            });
                        }
                        updateData[dbKey] = opacity;
                    }
                } else {
                    updateData[dbKey] = value === '' ? null : value;
                }
            }

            for (const key of welcomeBooleanKeys) {
                if (rawData[key] === undefined) continue;
                if (typeof rawData[key] !== 'boolean' && rawData[key] !== 'true' && rawData[key] !== 'false') {
                    return res.status(400).json({
                        status: 'error',
                        message: `設定欄位 ${key} 必須是布林值。`
                    });
                }
                updateData[key] = rawData[key] === true || rawData[key] === 'true';
            }

            if (rawData.sendEmbed === false || rawData.sendEmbed === 'false') {
                updateData.showTimestamp = false;
                updateData.showFooter = false;
            }
        }
        if (isRulesForm) {
            for (const key of rulesKeys) {
                if (rawData[key] === undefined) continue;

                if (key === 'embedTimestamp') {
                    if (typeof rawData[key] !== 'boolean' && rawData[key] !== 'true' && rawData[key] !== 'false') {
                        return res.status(400).json({
                            status: 'error',
                            message: '守則時間戳記設定必須是布林值。'
                        });
                    }
                    updateData[key] = rawData[key] === true || rawData[key] === 'true';
                } else {
                    updateData[key] = rawData[key] === '' ? null : rawData[key];
                }
            }
            if (updateData.rulesEmoji) updateData.rulesEmoji = updateData.rulesEmoji.trim().replace(/\uFE0F/g, '');
        }

        if (isTicketForm) {
            ticketKeys.forEach(key => {
                if (rawData[key] !== undefined) {
                    updateData[key] = rawData[key] === '' ? null : rawData[key];
                }
            });
        }
        if (isVoiceForm) {
            let finalVoiceSettings = [];
            if (voiceSettings && Array.isArray(voiceSettings)) {
                finalVoiceSettings = voiceSettings
                    .map(setting => ({ voiceGeneratorId: setting.voiceGeneratorId ? String(setting.voiceGeneratorId).trim() : null, voiceNameTemplate: setting.voiceNameTemplate ? String(setting.voiceNameTemplate).trim() : '專屬包廂', voiceUserLimit: parseInt(setting.voiceUserLimit, 10) >= 0 ? parseInt(setting.voiceUserLimit, 10) : 0 }))
                    .filter(setting => setting.voiceGeneratorId !== null && setting.voiceGeneratorId !== '');
            }
            updateData.voiceSettings = finalVoiceSettings;
        }

        if (Object.keys(updateData).length === 0) return res.json({ status: 'success', message: '沒有變更。' });

        await GuildConfig.findOneAndUpdate(
            { guildId },
            { $set: updateData, $unset: { voiceGeneratorId: 1, voiceNameTemplate: 1, voiceUserLimit: 1 } },
            { upsert: true, new: true }
        );

        if (isRulesForm) await syncRulesMessage(guildId);
        if (isTicketForm) await syncTicketMessage(guildId);

        res.json({ status: 'success', message: '✅ 設定已成功同步至資料庫與 Discord 囉喵！🐾' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: '內部錯誤。' });
    }
});

app.post('/api/save-reaction-roles', async (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ status: 'error', message: '未登入' });
    try {
        const { guildId, channelId, messageId, oldMessageId, pairs } = req.body;
        if (!guildId || !channelId || !messageId) return res.status(400).json({ status: 'error', message: '缺少參數' });
        if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).json({ status: 'error', message: '無權限' });

        if (oldMessageId && oldMessageId !== messageId) {
            await ReactionRole.deleteMany({ guildId, messageId: oldMessageId });
        }

        await ReactionRole.deleteMany({ guildId, messageId });

        if (pairs && pairs.length > 0) {
            const docs = pairs.map(pair => ({
                guildId, channelId, messageId,
                emoji: pair.emoji.trim().replace(/\uFE0F/g, ''),
                roleId: pair.roleId
            }));
            await ReactionRole.insertMany(docs);

            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                const channel = await guild.channels.fetch(channelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const targetMsg = await channel.messages.fetch(messageId).catch(() => null);
                    if (targetMsg) {
                        for (const doc of docs) {
                            await targetMsg.react(doc.emoji).catch(() => { });
                        }
                    }
                }
            }
        }
        res.json({ status: 'success', message: '反應身分組已更新！🐾' });
    } catch (err) { res.status(500).json({ status: 'error', message: err.message }); }
});

app.post('/api/send-embed', async (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ status: 'error', message: '未登入喵！' });

    try {
        const { guildId, channelId, embeds } = req.body;
        if (!guildId || !channelId || !embeds) return res.status(400).json({ status: 'error', message: '缺少必要參數喵！' });
        if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).json({ status: 'error', message: '無權限操作此伺服器喵！' });

        const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) return res.status(404).json({ status: 'error', message: '找不到伺服器喵！' });

        const channel = await guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) return res.status(404).json({ status: 'error', message: '找不到目標文字頻道喵！' });

        const embedList = Array.isArray(embeds) ? embeds : Object.values(embeds);
        if (embedList.length === 0) return res.status(400).json({ status: 'error', message: '至少需要填寫一張卡片喵！' });

        const discordEmbeds = embedList.map(item => {
            const embed = new EmbedBuilder().setTimestamp();

            if (item.title && item.title.trim()) embed.setTitle(item.title.trim());
            if (item.description && item.description.trim()) embed.setDescription(item.description.replace(/\\n/g, '\n'));
            if (item.url && /^https?:\/\//i.test(item.url)) embed.setURL(item.url.trim());

            const embedColor = (item.color && /^#[0-9A-F]{6}$/i.test(item.color)) ? item.color : '#3B82F6';
            embed.setColor(embedColor);

            if (item.image && item.image.trim()) embed.setImage(item.image.trim());
            if (item.thumbnail && item.thumbnail.trim()) embed.setThumbnail(item.thumbnail.trim());

            if (item.author && item.author.trim()) {
                embed.setAuthor({
                    name: item.author.trim(),
                    iconURL: item.authorIcon?.trim() || undefined,
                    url: item.authorUrl?.trim() || undefined
                });
            }

            if (item.footer && item.footer.trim()) {
                embed.setFooter({
                    text: item.footer.trim(),
                    iconURL: item.footerIcon?.trim() || undefined
                });
            }

            return embed;
        });

        const chunkSize = 10;
        for (let i = 0; i < discordEmbeds.length; i += chunkSize) {
            const chunk = discordEmbeds.slice(i, i + chunkSize);
            await channel.send({ embeds: chunk });
        }

        res.json({ status: 'success', message: '✅ Embed 卡片已成功發送至指定頻道囉喵！🐾' });

    } catch (err) {
        res.status(500).json({ status: 'error', message: `發送失敗：${err.message}` });
    }
});

app.post('/api/delete-reaction-role', async (req, res) => {
    if (!req.session || !req.session.user) return res.status(401).json({ status: 'error', message: '未登入喵！' });
    try {
        const { guildId, messageId } = req.body;
        if (!guildId || !messageId) return res.status(400).json({ status: 'error', message: '缺少伺服器或訊息 ID 喵！' });
        if (!req.session.guilds?.some(g => g.id === guildId)) return res.status(403).json({ status: 'error', message: '無權限操作此伺服器喵！' });

        await ReactionRole.deleteMany({ guildId, messageId });
        res.json({ status: 'success', message: '反應身分組配置已成功移除喵！🐾' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// --- 8. 指令載入與服務啟動邏輯 ---
const commandLoadErrors = [];
function loadAllCommands(baseDir, collection) {
    if (!fs.existsSync(baseDir)) {
        return;
    }

    const files = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(baseDir, file.name);
        if (file.isDirectory()) {
            loadAllCommands(filePath, collection);
        } else if (file.name.endsWith('.js')) {
            try {
                const command = require(filePath);
                const commandName = command.data?.name || command.name;

                if (!commandName || typeof command.execute !== 'function' && typeof command.run !== 'function') {
                    throw new Error('缺少有效的指令名稱或執行函數');
                }
                if (collection.has(commandName)) {
                    continue;
                }
                collection.set(commandName, command);
            } catch (error) {
                commandLoadErrors.push(filePath);
            }
        }
    }
}

function loadHandlers() {
    const eventsPath = path.join(__dirname, 'events');
    if (!fs.existsSync(eventsPath)) {
        return;
    }

    const files = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    for (const file of files) {
        const eventPath = path.join(eventsPath, file);

        try {
            delete require.cache[require.resolve(eventPath)];
            const event = require(eventPath);

            if (!event || !event.name || typeof event.execute !== 'function') {
                continue;
            }

            const listener = (...args) => {
                let execution;

                try {
                    execution = event.execute(...args, client);
                } catch (error) {
                    execution = Promise.reject(error);
                }

                Promise.resolve(execution).catch(async error => {
                    if (event.name !== Events.InteractionCreate) return;

                    const interaction = args[0];
                    if (!interaction || typeof interaction.isRepliable !== 'function' || !interaction.isRepliable()) return;

                    if (
                        interaction.__yinmiaoAckHandled
                        || error.code === 10062
                        || error.code === 40060
                    ) {
                        return;
                    }

                    const response = {
                        content: '❌ 銀喵處理互動時發生未預期錯誤，請稍後再試。',
                        flags: [MessageFlags.Ephemeral]
                    };

                    try {
                        if (interaction.deferred || interaction.replied) {
                            await interaction.followUp(response);
                        } else {
                            await interaction.reply(response);
                        }
                    } catch (replyError) {
                        // 靜默略過
                    }
                });
            };

            if (event.once) {
                client.once(event.name, listener);
            } else {
                client.on(event.name, listener);
            }

        } catch (error) {
            // 靜默略過
        }
    }
}

async function startServer() {
    try {
        await mongooseConnectionPromise;

        loadHandlers();
        loadAllCommands(path.join(__dirname, 'commands/slash'), client.slashCommands);
        loadAllCommands(path.join(__dirname, 'commands/prefix'), client.prefixCommands);

        app.listen(PORT, '0.0.0.0', () => {});

        client.once(Events.ClientReady, async () => {
            try {
                const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
                const slashCommandsData = Array.from(client.slashCommands.values())
                    .filter(c => c && c.data && typeof c.data.toJSON === 'function')
                    .map(c => c.data.toJSON());

                if (commandLoadErrors.length === 0) {
                    await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommandsData });
                }
            } catch (restErr) {
                // 靜默略過
            }
        });

        await client.login(process.env.DISCORD_TOKEN);

    } catch (err) {
        process.exit(1);
    }
}

startServer();

process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {
    process.exit(1);
});
