const axios = require('axios');
const Parser = require('rss-parser');
const { TwitterApi } = require('twitter-api-v2');
const { EmbedBuilder } = require('discord.js');
const SocialNotification = require('../models/SocialNotification');

const parser = new Parser();
let timer = null;
let polling = false;

const DEFAULT_INTERVAL = Number(process.env.SOCIAL_NOTIFICATION_INTERVAL || 60000);

function normalizePlatform(value) {
    return String(value || '').trim().toLowerCase().replace(/^x$/, 'twitter');
}

function cleanUsername(platform, username) {
    const value = String(username || '').trim();
    if (platform === 'twitter' || platform === 'twitch') return value.replace(/^@/, '');
    return value;
}

function validHex(color) {
    return /^#[0-9A-F]{6}$/i.test(String(color || ''));
}

async function getTwitchAccessToken() {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
        throw new Error('缺少 TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET');
    }

    const response = await axios.post('https://id.twitch.tv/oauth2/token', null, {
        params: {
            client_id: process.env.TWITCH_CLIENT_ID,
            client_secret: process.env.TWITCH_CLIENT_SECRET,
            grant_type: 'client_credentials'
        },
        timeout: 10000
    });

    return response.data.access_token;
}

async function fetchYouTube(feed) {
    if (!/^UC[a-zA-Z0-9_-]{20,}$/.test(feed.sourceId || '')) {
        throw new Error('YouTube 必須使用 Channel ID，例如 UCxxxxxxxxxxxxxxxxxxxxxx');
    }

    const xml = await axios.get(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(feed.sourceId)}`,
        { timeout: 15000, responseType: 'text' }
    );

    const parsed = await parser.parseString(xml.data);
    const item = parsed.items?.[0];
    if (!item) return null;

    return {
        id: item.id || item.guid,
        title: item.title || 'YouTube 新影片',
        url: item.link,
        author: item.author || parsed.title || feed.username,
        publishedAt: item.isoDate || item.pubDate
    };
}

async function fetchTwitter(feed) {
    if (!process.env.X_BEARER_TOKEN) {
        throw new Error('缺少 X_BEARER_TOKEN');
    }

    const api = new TwitterApi(process.env.X_BEARER_TOKEN);
    let userId = feed.sourceId;

    if (!userId) {
        const result = await api.v2.userByUsername(cleanUsername('twitter', feed.username));
        userId = result.data?.id;
        if (!userId) throw new Error('找不到 X 使用者');
        feed.sourceId = userId;
    }

    const result = await api.v2.userTimeline(userId, {
        max_results: 5,
        exclude: ['replies', 'retweets'],
        'tweet.fields': ['created_at', 'text']
    });

    const tweet = result.data?.data?.[0];
    if (!tweet) return null;

    return {
        id: tweet.id,
        title: `@${cleanUsername('twitter', feed.username)} 的新貼文`,
        url: `https://x.com/${encodeURIComponent(cleanUsername('twitter', feed.username))}/status/${tweet.id}`,
        author: `@${cleanUsername('twitter', feed.username)}`,
        description: tweet.text,
        publishedAt: tweet.created_at
    };
}

async function fetchTwitch(feed, token) {
    if (!token) return null;

    let userId = feed.sourceId;
    const headers = {
        'Client-ID': process.env.TWITCH_CLIENT_ID,
        Authorization: `Bearer ${token}`
    };

    if (!userId) {
        const userResult = await axios.get('https://api.twitch.tv/helix/users', {
            headers,
            params: { login: cleanUsername('twitch', feed.username) },
            timeout: 10000
        });
        userId = userResult.data?.data?.[0]?.id;
        if (!userId) throw new Error('找不到 Twitch 頻道');
        feed.sourceId = userId;
    }

    const streamResult = await axios.get('https://api.twitch.tv/helix/streams', {
        headers,
        params: { user_id: userId },
        timeout: 10000
    });

    const stream = streamResult.data?.data?.[0];
    if (!stream) return null;

    return {
        id: stream.id,
        title: stream.title || `${stream.user_name} 正在直播`,
        url: `https://www.twitch.tv/${encodeURIComponent(stream.user_login)}`,
        author: stream.user_name,
        description: stream.game_name ? `遊戲：${stream.game_name}` : 'Twitch 直播中',
        image: stream.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720'),
        publishedAt: stream.started_at
    };
}

async function sendNotification(client, feed, item) {
    const channel = await client.channels.fetch(feed.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;

    const platformName = feed.platform === 'youtube'
        ? 'YouTube'
        : feed.platform === 'twitter'
            ? 'X / Twitter'
            : 'Twitch';

    const embed = new EmbedBuilder()
        .setTitle(feed.title || `📢 ${platformName} 更新通知`)
        .setURL(item.url)
        .setDescription(
            feed.customMessage
                ? `${feed.customMessage}\n\n${item.description || item.title || ''}`
                : (item.description || item.title || '有新的內容喵！')
        )
        .setAuthor({ name: item.author || feed.username })
        .setColor(validHex(feed.color) ? feed.color : '#FFC8DD')
        .setTimestamp(item.publishedAt ? new Date(item.publishedAt) : new Date())
        .setFooter({ text: `銀喵 YinMiao · ${platformName} 通知` });

    if (item.image) embed.setImage(item.image);

    const content = feed.roleId ? `<@&${feed.roleId}>` : undefined;
    await channel.send({ content, embeds: [embed], allowedMentions: feed.roleId ? { roles: [feed.roleId] } : undefined });
}

async function checkFeed(client, feed, twitchToken) {
    const platform = normalizePlatform(feed.platform);
    let item = null;

    if (platform === 'youtube') item = await fetchYouTube(feed);
    else if (platform === 'twitter') item = await fetchTwitter(feed);
    else if (platform === 'twitch') item = await fetchTwitch(feed, twitchToken);
    else return;

    feed.lastCheckedAt = new Date();

    if (!item) {
        await feed.save();
        return;
    }

    // 第一次建立設定只記錄目前最新項目，避免開機後把舊內容全部洗版。
    if (!feed.lastItemId) {
        feed.lastItemId = item.id;
        await feed.save();
        return;
    }

    if (feed.lastItemId === item.id) {
        await feed.save();
        return;
    }

    await sendNotification(client, feed, item);
    feed.lastItemId = item.id;
    await feed.save();
}

async function poll(client) {
    if (polling || !client?.isReady()) return;
    polling = true;

    try {
        const feeds = await SocialNotification.find({ enabled: true });
        let twitchToken = null;

        if (feeds.some(f => normalizePlatform(f.platform) === 'twitch')) {
            try {
                twitchToken = await getTwitchAccessToken();
            } catch (error) {
                console.error('[SocialNotify] Twitch Token:', error.message);
            }
        }

        for (const feed of feeds) {
            try {
                await checkFeed(client, feed, twitchToken);
            } catch (error) {
                console.error(
                    `[SocialNotify] ${feed.platform}/${feed.username}:`,
                    error.response?.data || error.message
                );
            }
        }
    } finally {
        polling = false;
    }
}

function startSocialNotificationService(client) {
    if (timer) return;

    const run = () => poll(client).catch(error => console.error('[SocialNotify] Poll error:', error));
    timer = setInterval(run, DEFAULT_INTERVAL);
    run();

    console.log(`📡 社群通知服務已啟動（每 ${DEFAULT_INTERVAL / 1000} 秒）`);
}

function stopSocialNotificationService() {
    if (timer) clearInterval(timer);
    timer = null;
}

module.exports = {
    startSocialNotificationService,
    stopSocialNotificationService,
    normalizePlatform,
    cleanUsername,
    poll
};
