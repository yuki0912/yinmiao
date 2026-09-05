const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, registerFont } = require('canvas');
const GuildConfig = require('../models/GuildConfig');
const path = require('node:path');
const fs = require('node:fs');

// --- 1. 字體註冊與繪圖輔助工具 ---
const fontPath = path.join(__dirname, '../NotoSansTC-Bold.ttf');
let fontName = 'sans-serif';

if (fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: "CustomFont" });
    fontName = "CustomFont";
}

// 動態調整字體大小以適應最大寬度
const applyText = (canvas, text, maxWidth, baseSize) => {
    const ctx = canvas.getContext('2d');
    let fontSize = baseSize;
    do {
        ctx.font = `bold ${fontSize}px "${fontName}"`;
        fontSize -= 2;
    } while (ctx.measureText(text).width > maxWidth && fontSize > 10);
    return ctx.font;
};

// 背景圖片 Cover 裁切繪製
const drawCoverImage = (ctx, img, canvasWidth, canvasHeight) => {
    const imgRatio = img.width / img.height;
    const canvasRatio = canvasWidth / canvasHeight;
    let sx, sy, sWidth, sHeight;

    if (imgRatio > canvasRatio) {
        sHeight = img.height;
        sWidth = img.height * canvasRatio;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = img.width;
        sHeight = img.width / canvasRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }

    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, canvasWidth, canvasHeight);
};

// 預設深色漸層背景
const drawDefaultBg = (ctx, width = 800, height = 250) => {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#101426');
    gradient.addColorStop(1, '#080a14');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
};

const isValidHex = (color) => /^#[0-9A-F]{6}$/i.test(color);

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const { guild, user } = member;

        try {
            const config = await GuildConfig.findOne({ guildId: guild.id }) || {};
            const welcomeChannel = guild.channels.cache.get(config.welcomeChannelId) || guild.systemChannel;
            if (!welcomeChannel) return;

            // 變數替換解析
            const replaceVars = (str, isMention = false, isCanvas = false) => {
                if (!str) return "";
                
                const displayName = member.displayName || user.globalName || user.username; // 伺服器顯示名稱 / 暱稱
                const rawUsername = user.username;                                            // 原始帳號名稱 (例如: xinolan.fualiekesi)
                const userId = user.id;                                                       // Discord 純數字 ID

                const userReplacement = isCanvas 
                    ? displayName 
                    : (isMention ? `<@${user.id}>` : displayName);

                return str
                    .replace(/{user}/g, userReplacement)
                    .replace(/{user_name}/g, displayName)
                    .replace(/{username}/g, rawUsername)          // 新增：原始帳號名稱
                    .replace(/{user_id}/g, userId)               // 新增：Discord 數字 ID
                    .replace(/{display_name}/g, displayName)     // 新增：顯示暱稱
                    .replace(/{user_mention}/g, `<@${user.id}>`)
                    .replace(/{guild}/g, guild.name)
                    .replace(/{guild_name}/g, guild.name)
                    .replace(/{count}/g, guild.memberCount.toString())
                    .replace(/{member_count}/g, guild.memberCount.toString());
            };

            // 外顯文字預設值
            const rawWelcomeContent = config.welcomeContent || "🐾 歡迎 {user} 降落到了 {guild} 喵！您是本群第 {count} 位小萌新！";
            const textContent = replaceVars(rawWelcomeContent, true);

            // Canvas 卡片文字保底預設值處理
            let rawMainText = config.canvasMainText || config.canvasText;
            if (!rawMainText || rawMainText.trim() === '') {
                rawMainText = "Welcome {guild}";
            }

            let rawSubText = config.canvasSubText;
            if (!rawSubText || rawSubText.trim() === '' || rawSubText.trim() === '{user}') {
                rawSubText = "歡迎 {user} 加入伺服器！";
            }

            const imgMainText = replaceVars(rawMainText, false, true);
            const imgSubText = replaceVars(rawSubText, false, true);

            const messagePayload = { content: textContent, files: [] };
            let hasCanvas = false;
            let attachment = null;

            // --- Canvas 卡片繪製 ---
            if (config.sendCanvas) {
                hasCanvas = true;
                const canvasWidth = 800;
                const canvasHeight = 250;
                const canvas = createCanvas(canvasWidth, canvasHeight);
                const ctx = canvas.getContext('2d');

                // 背景處理
                let bgLoaded = false;
                const customBgUrl = config.canvasBg || config.canvasBackgroundUrl || config.customBg;

                if (customBgUrl) {
                    try {
                        const bgImage = await loadImage(customBgUrl);
                        drawCoverImage(ctx, bgImage, canvasWidth, canvasHeight);

                        const opacity = (config.canvasOverlayOpacity !== undefined && !isNaN(config.canvasOverlayOpacity))
                            ? Number(config.canvasOverlayOpacity) 
                            : 0;

                        if (opacity > 0) {
                            ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
                            ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                        }
                        bgLoaded = true;
                    } catch (e) {
                        console.warn("⚠️ 背景圖片載入失敗，退回預設背景");
                    }
                }

                if (!bgLoaded) {
                    drawDefaultBg(ctx, canvasWidth, canvasHeight);
                }

                // 顏色與樣式設定
                const mainTextColor = isValidHex(config.canvasColor) ? config.canvasColor : '#00FFA3';
                const subTextColor = isValidHex(config.canvasSubColor) ? config.canvasSubColor : '#FFFFFF';
                const avatarBorderColor = isValidHex(config.avatarBorderColor) ? config.avatarBorderColor : '#00FFA3';

                ctx.textBaseline = 'middle';

                // 繪製主標題
                if (imgMainText && imgMainText.trim() !== '') {
                    ctx.fillStyle = mainTextColor;
                    ctx.font = applyText(canvas, imgMainText, 500, 42);
                    ctx.fillText(imgMainText, 250, 95);
                }

                // 繪製副標題
                if (imgSubText && imgSubText.trim() !== '') {
                    ctx.fillStyle = subTextColor;
                    ctx.font = applyText(canvas, imgSubText, 500, 38);
                    ctx.fillText(imgSubText, 250, 155);
                }

                // 繪製圓形頭像
                const ax = 125, ay = 125, r = 75;
                ctx.save();
                ctx.beginPath();
                ctx.arc(ax, ay, r, 0, Math.PI * 2, true);
                ctx.clip();

                try {
                    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
                    const av = await loadImage(avatarUrl);
                    ctx.drawImage(av, ax - r, ay - r, r * 2, r * 2);
                } catch (e) {
                    ctx.fillStyle = '#333333';
                    ctx.fill();
                }
                ctx.restore();

                // 頭像外框線條
                ctx.strokeStyle = avatarBorderColor;
                ctx.lineWidth = 5;
                ctx.beginPath();
                ctx.arc(ax, ay, r, 0, Math.PI * 2);
                ctx.stroke();

                attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome-card.png' });
            }

            // --- Embed 組裝 ---
            if (config.sendEmbed) {
                const welcomeEmbed = new EmbedBuilder();

                const rawColor = config.welcomeEmbedColor || config.embedColor;
                if (isValidHex(rawColor)) {
                    welcomeEmbed.setColor(rawColor);
                }

                const formattedTitle = replaceVars(config.welcomeTitle);
                if (formattedTitle && formattedTitle.trim() !== '') {
                    welcomeEmbed.setTitle(formattedTitle.trim());
                }

                const formattedDesc = replaceVars(config.welcomeDescription);
                if (formattedDesc && formattedDesc.trim() !== '') {
                    welcomeEmbed.setDescription(formattedDesc.trim());
                }

                if (hasCanvas && attachment) {
                    messagePayload.files.push(attachment);
                    welcomeEmbed.setImage('attachment://welcome-card.png');
                }

                if (config.showTimestamp) welcomeEmbed.setTimestamp();

                if (config.showFooter) {
                    const emFooter = replaceVars(config.welcomeFooter);
                    if (emFooter && emFooter.trim() !== '') {
                        welcomeEmbed.setFooter({
                            text: emFooter.trim(),
                            iconURL: config.welcomeFooterIcon || guild.iconURL()
                        });
                    }
                }

                messagePayload.embeds = [welcomeEmbed];
            } else if (hasCanvas && attachment) {
                messagePayload.files.push(attachment);
            }

            await welcomeChannel.send(messagePayload);

        } catch (error) {
            console.error(`❌ 發送歡迎訊息時發生錯誤:`, error);
        }
    },
};