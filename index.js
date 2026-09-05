require('dotenv').config();
process.env.TZ = process.env.TZ;

const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const mongoose = require('mongoose');
const OAuth2 = require('discord-oauth2');
const cors = require('cors');
const cron = require('node-cron');
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
    Events
} = require('discord.js');

// 🎵 --- 引入 DisTube 音樂模組 ---
const { DisTube } = require('distube');
const { YouTubePlugin } = require('@distube/youtube');

// 🐾 --- 處理 YouTube Cookie (JSON 陣列解析) ---
let youtubeCookies;
if (process.env.YOUTUBE_COOKIE) {
    try {
        youtubeCookies = JSON.parse(process.env.YOUTUBE_COOKIE);
        console.log('✅ 已成功解析環境變數 YOUTUBE_COOKIE (JSON 陣列) 喵！');
    } catch (e) {
        console.error('⚠️ 解析 YOUTUBE_COOKIE 失敗，請確認格式是否為有效的 JSON 陣列:', e.message);
    }
}

// --- 1. 初始化 Express ---
const app = express();
const PORT = process.env.PORT || 3000;
const BOT_NAME = '銀喵 YinMiao';

// --- 2. 初始化 Discord Bot ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates // 🔊 DisTube 必備語音狀態 Intent
    ],
    partials: [Partials.Message, Partials.Reaction, Partials.User, Partials.GuildMember]
});

// 🎵 --- 初始化 DisTube 並掛載至 client ---
client.distube = new DisTube(client, {
    emitNewSongOnly: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    plugins: [
        new YouTubePlugin({
            cookies: youtubeCookies
        })
    ]
});

client.slashCommands = new Collection();
client.prefixCommands = new Collection();

// 引入 MongoDB Models
const GuildConfig = require('./models/GuildConfig');
const PendingRole = require('./models/PendingRole');
const ReactionRole = require('./models/ReactionRole');
const UserProfile = require('./models/UserProfile');

// --- 3. Express 中間件與 Session ---
app.use(cors());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('trust proxy', 1);

app.use(session({
    secret: process.env.SESSION_SECRET || 'yinmiao-secret-cat',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 14 * 24 * 60 * 60
    }),
    cookie: {
        maxAge: 1000 * 60 * 60 * 24, // 1天
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    }
}));

// --- 🐾 全域社群分享設定中間件 (OG Meta Data) ---
app.use((req, res, next) => {
    const protocol = req.protocol;
    const host = req.get('host');
    const fullUrl = `${protocol}://${host}${req.originalUrl}`;

    const currentAvatar = client.user ? client.user.displayAvatarURL({ size: 512, extension: 'png' }) : 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/512x512/1f431.png';

    res.locals.seo = {
        title: '銀喵 YinMiao | 妳的專屬 Discord 伺服器萌寵夥伴',
        description: '銀喵是一隻多功能 Discord 機器人，內建流暢的網頁後台控制台。',
        url: fullUrl,
        image: `${protocol}://${host}/images/og-preview.png`,
        botAvatar: currentAvatar
    };

    res.locals.botAvatar = currentAvatar;
    next();
});

// --- 4. OAuth2 工具與登入驗證中間件 ---
const oauth = new OAuth2({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    redirectUri: process.env.REDIRECT_URI
});

function checkAuth(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// 🐾 變數替換輔助函式
function parsePreviewText(text, member, guild) {
    if (!text) return '';
    return text
        .replace(/{user}/g, `<@${member.id}>`)
        .replace(/{username}/g, member.user.username)
        .replace(/{server}/g, guild.name)
        .replace(/{count}/g, guild.memberCount);
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
                await targetMsg.edit({ embeds: [ruleEmbed] }).catch(console.error);
            }
            await targetMsg.react(targetEmoji).catch(() => { });
            console.log(`✨ [${guild.name}] 已成功同步更新規則訊息 ID: ${targetMsg.id}`);
            return;
        }

        if (config.rulesTitle || config.rulesDescription) {
            const sentMsg = await channel.send({ embeds: [ruleEmbed] }).catch(() => null);
            if (sentMsg) {
                await sentMsg.react(targetEmoji).catch(() => { });
                config.rulesMessageId = sentMsg.id;
                await config.save();
                console.log(`✨ [${guild.name}] 已發送新規則訊息 ID: ${sentMsg.id}`);
            }
        }
    } catch (err) {
        console.error("❌ 同步規則訊息出錯:", err);
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

            await targetMsg.edit({ embeds: [embed], components: [row] }).catch(console.error);
        }
    } catch (err) {
        console.error("❌ 自動同步工單訊息出錯:", err);
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
    const url = oauth.generateAuthUrl({ scope: ["identify", "guilds"], responseType: "code" });
    res.redirect(url);
});

app.get('/auth/callback/', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.redirect('/');
    try {
        const tokenData = await oauth.tokenRequest({ code, scope: "identify guilds", grantType: "authorization_code" });
        const user = await oauth.getUser(tokenData.access_token);
        const guilds = await oauth.getUserGuilds(tokenData.access_token);

        req.session.user = user;
        req.session.guilds = guilds.filter(g => g.owner === true || (BigInt(g.permissions) & 8n) === 8n);

        res.redirect('/dashboard');
    } catch (err) {
        console.error("Auth Error:", err);
        res.status(500).send("認證失敗喵...");
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
        console.error("載入反應身分組頁面錯誤:", err);
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
        console.error("載入 Embed 廣播頁面錯誤:", err);
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

        const isWelcomeForm = rawData.welcomeChannelId !== undefined || rawData.welcomeContent !== undefined || rawData.embedColor !== undefined || rawData.welcomeEmbedColor !== undefined || rawData.canvasMainText !== undefined || rawData.canvasSubText !== undefined;
        const isRulesForm = rawData.rulesChannelId !== undefined || rawData.rulesTitle !== undefined;
        const isTicketForm = rawData.ticketChannelId !== undefined || rawData.ticketTitle !== undefined;
        const isVoiceForm = voiceSettings !== undefined;

        if (isWelcomeForm) {
            // 🐾 包含所有 Canvas 與歡迎訊息設定的鍵值
            const welcomeKeys = [
                'welcomeChannelId', 'welcomeContent', 'welcomeTitle', 'welcomeDescription',
                'embedColor', 'welcomeEmbedColor', 'welcomeImageUrl', 
                'canvasText', 'canvasMainText', 'canvasSubText', 
                'canvasColor', 'canvasSubColor', 'avatarBorderColor', 
                'canvasBg', 'canvasBackgroundUrl', 'customBg', 'canvasOverlayOpacity',
                'welcomeFooter', 'welcomeFooterIcon',
                'leaveChannelId', 'leaveContent', 'leaveTitle', 'leaveDescription',
                'leaveEmbedColor', 'leaveFooter'
            ];
            welcomeKeys.forEach(key => { if (rawData[key] !== undefined) updateData[key] = rawData[key] === '' ? null : rawData[key]; });
            updateData.sendCanvas = rawData.sendCanvas === true || rawData.sendCanvas === 'true';
            updateData.sendEmbed = rawData.sendEmbed === true || rawData.sendEmbed === 'true';
            updateData.sendLeave = rawData.sendLeave === true || rawData.sendLeave === 'true';
            updateData.sendLeaveEmbed = rawData.sendLeaveEmbed === true || rawData.sendLeaveEmbed === 'true';
            updateData.showLeaveTimestamp = rawData.showLeaveTimestamp === true || rawData.showLeaveTimestamp === 'true';
            updateData.showLeaveFooter = rawData.showLeaveFooter === true || rawData.showLeaveFooter === 'true';
            if (!updateData.sendEmbed) { updateData.showTimestamp = false; updateData.showFooter = false; } else { updateData.showTimestamp = rawData.showTimestamp === true || rawData.showTimestamp === 'true'; updateData.showFooter = rawData.showFooter === true || rawData.showFooter === 'true'; }
        }
        if (isRulesForm) {
            const rulesKeys = [
                'rulesChannelId', 'rulesRoleId', 'rulesTitle', 'rulesDescription', 'rulesEmoji', 'rulesMessageId',
                'rulesEmbedColor', 'embedTimestamp', 'embedAuthorName', 'embedAuthorIcon', 'embedAuthorUrl',
                'embedThumbnail', 'embedImage', 'embedFooterText', 'embedFooterIcon'
            ];
            rulesKeys.forEach(key => {
                if (rawData[key] !== undefined) {
                    if (key === 'embedTimestamp') {
                        updateData[key] = rawData[key] === true || rawData[key] === 'true';
                    } else {
                        updateData[key] = rawData[key] === '' ? null : rawData[key];
                    }
                }
            });
            if (updateData.rulesEmoji) updateData.rulesEmoji = updateData.rulesEmoji.trim().replace(/\uFE0F/g, '');
        }
        if (isTicketForm) {
            const ticketKeys = ['ticketChannelId', 'ticketMessageId', 'ticketTitle', 'ticketDescription', 'ticketFooter', 'ticketColor'];
            ticketKeys.forEach(key => { if (rawData[key] !== undefined) updateData[key] = rawData[key] === '' ? null : rawData[key]; });
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

        await GuildConfig.findOneAndUpdate({ guildId }, { $set: updateData, $unset: { voiceGeneratorId: 1, voiceNameTemplate: 1, voiceUserLimit: 1 } }, { upsert: true, new: true });

        if (isRulesForm) await syncRulesMessage(guildId);
        if (isTicketForm) await syncTicketMessage(guildId);

        res.json({ status: 'success', message: '✅ 設定已成功同步至資料庫與 Discord 囉喵！🐾' });
    } catch (err) {
        console.error(err);
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
            const embed = new EmbedBuilder()
                .setTitle(item.title || '')
                .setColor(item.color || '#3B82F6')
                .setTimestamp();

            if (item.description) embed.setDescription(item.description);
            if (item.image) embed.setImage(item.image);
            if (item.footer) embed.setFooter({ text: item.footer });

            return embed;
        });

        const chunkSize = 10;
        for (let i = 0; i < discordEmbeds.length; i += chunkSize) {
            const chunk = discordEmbeds.slice(i, i + chunkSize);
            await channel.send({ embeds: chunk });
        }

    } catch (err) {
        console.error("網頁發送 Embed 卡片失敗:", err);
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
        console.error("刪除反應身分組出錯:", err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.get('/logout', (req, res) => { req.session.destroy(() => res.redirect('/')); });

// 🎵 --- DisTube 事件監聽器 (音樂播報與狀態機制) ---
client.distube
    .on('playSong', (queue, song) => {
        queue.textChannel?.send({
            embeds: [
                new EmbedBuilder()
                    .setTitle('🎶 開始播放音樂喵！')
                    .setDescription(`[${song.name}](${song.url})`)
                    .addFields(
                        { name: '⏱️ 時長', value: `\`${song.formattedDuration}\``, inline: true },
                        { name: '👤 點歌者', value: `${song.user}`, inline: true }
                    )
                    .setThumbnail(song.thumbnail)
                    .setColor('#FFC8DD')
            ]
        });
    })
    .on('addSong', (queue, song) => {
        queue.textChannel?.send(`✅ 已將 **[${song.name}](${song.url})** 加入播放清單喵！`);
    })
    .on('addList', (queue, playlist) => {
        queue.textChannel?.send(`✅ 已將播放清單 **${playlist.name}** (${playlist.songs.length} 首歌) 加入佇列喵！`);
    })
    .on('finish', (queue) => {
        queue.textChannel?.send('🎵 佇列中的音樂全部播放完畢囉喵！');
    })
    .on('empty', (queue) => {
        queue.textChannel?.send('🚪 語音頻道裡面沒有人了，銀喵先離開囉喵！🐾');
    })
    .on('error', (channel, error) => {
        console.error('❌ DisTube 錯誤:', error);
        if (channel && typeof channel.send === 'function') {
            channel.send(`❌ 播放音樂時發生錯誤喵：${error.message.slice(0, 1900)}`).catch(() => { });
        }
    });

// --- 8. 指令載入與服務啟動邏輯 ---
function loadAllCommands(baseDir, collection) {
    if (!fs.existsSync(baseDir)) return;
    const files = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const file of files) {
        const filePath = path.join(baseDir, file.name);
        if (file.isDirectory()) { loadAllCommands(filePath, collection); }
        else if (file.name.endsWith('.js')) {
            const command = require(filePath);
            const commandName = command.data?.name || command.name;
            if (commandName) collection.set(commandName, command);
        }
    }
}

function loadHandlers() {
    const eventsPath = path.join(__dirname, 'events');
    if (!fs.existsSync(eventsPath)) return;

    fs.readdirSync(eventsPath).forEach(file => {
        if (!file.endsWith('.js')) return;
        const eventPath = path.join(eventsPath, file);

        delete require.cache[require.resolve(eventPath)];
        const event = require(eventPath);

        if (event.name) {
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        }
    });
}

async function startServer() {
    try {
        console.log('⏳ 正在連接資料庫...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ 資料庫連接成功！');

        cron.schedule('0 0 * * 1', async () => {
            try {
                console.log('📝 [系統排程] 開始重置本週排行榜經驗值...');
                const result = await UserProfile.updateMany({}, { $set: { weeklyExp: 0 } });
                console.log(`✅ 本週排行榜已重置成功！已歸零 ${result.modifiedCount} 筆用戶的當週數據，歷史總 XP 完好無損喵！🐾`);
            } catch (cronErr) {
                console.error('❌ 重置當週排行數據時出錯:', cronErr);
            }
        }, {
            scheduled: true,
            timezone: "Asia/Kuala_Lumpur"
        });

        loadHandlers();
        loadAllCommands(path.join(__dirname, 'commands/slash'), client.slashCommands);
        loadAllCommands(path.join(__dirname, 'commands/prefix'), client.prefixCommands);

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🌐 網頁伺服器已啟動: http://localhost:${PORT}`);
        });

        client.once(Events.ClientReady, async () => {
            try {
                const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
                const slashCommandsData = Array.from(client.slashCommands.values())
                    .filter(c => c && c.data && typeof c.data.toJSON === 'function')
                    .map(c => c.data.toJSON());

                await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: slashCommandsData });
                console.log('✅ 斜線指令(Slash Commands)已成功同步至 Discord 全域！');
            } catch (restErr) {
                console.error('⚠️ 同步斜線指令時發生錯誤:', restErr);
            }
            console.log(`✅ 銀喵機器人 (${client.user.tag}) 準備就緒喵！🐾`);
        });

        console.log('⏳ 正在登入 Discord Bot...');
        await client.login(process.env.DISCORD_TOKEN);

    } catch (err) {
        console.error('💥 系統啟動失敗:', err);
        process.exit(1);
    }
}

startServer();

process.on('unhandledRejection', (reason) => { console.error('⚠️ 未處理的非同步拒絕:', reason); });
process.on('uncaughtException', (err) => { console.error('💥 未捕獲的嚴重例外:', err); });