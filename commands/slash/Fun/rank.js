const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const UserProfile = require('../../../models/UserProfile');
const path = require('node:path');
const fs = require('node:fs');

// 卡片專用中文字型；以程式檔位置尋找，避免部署目錄不同而找不到。
const fontPath = path.join(__dirname, '../../../NotoSansTC-Bold.ttf');
let fontFamily = 'sans-serif';

if (fs.existsSync(fontPath)) {
    try {
        GlobalFonts.registerFromPath(fontPath, 'YinMiaoRank');
        fontFamily = 'YinMiaoRank';
    } catch (error) {
        // 靜默略過字型註冊警告
    }
}

function getTotalXpForLevel(level) {
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += 5 * (i ** 2) + 50 * i + 100;
    }
    return total;
}

function roundedFill(ctx, x, y, width, height, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
}

function drawStar(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - size);
    ctx.quadraticCurveTo(x + size * 0.2, y - size * 0.2, x + size, y);
    ctx.quadraticCurveTo(x + size * 0.2, y + size * 0.2, x, y + size);
    ctx.quadraticCurveTo(x - size * 0.2, y + size * 0.2, x - size, y);
    ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.2, x, y - size);
    ctx.fill();
}

function drawCorner(ctx, x, y, directionX, directionY, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + directionX * 22, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + directionY * 22);
    ctx.stroke();
}

function drawStat(ctx, x, label, value, accent) {
    roundedFill(ctx, x, 206, 141, 76, 12, 'rgba(10, 21, 36, 0.67)');
    ctx.fillStyle = '#AFC1CD';
    ctx.font = 'bold 12px ' + fontFamily;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 13, 230, 115);
    ctx.fillStyle = accent;
    ctx.font = 'bold 25px ' + fontFamily;
    ctx.fillText(String(value), x + 13, 264, 115);
}

function drawCard(ctx, data) {
    const W = 1000;
    const H = 330;
    const colors = {
        gold: '#F5D69E',
        pink: '#F2A9B4',
        ice: '#A8E0DC',
        white: '#F8F3EC',
        muted: '#AFC1CD',
        dark: '#0A1524',
        panel: '#122239'
    };

    ctx.clearRect(0, 0, W, H);

    const bg = ctx.createLinearGradient(0, 0, 690, 330);
    bg.addColorStop(0, '#122438');
    bg.addColorStop(0.6, '#18283B');
    bg.addColorStop(1, '#0E1B2F');
    roundedFill(ctx, 0, 0, 690, 330, 23, bg);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, 690, 330, 23);
    ctx.clip();

    ctx.strokeStyle = 'rgba(168, 224, 220, 0.06)';
    ctx.lineWidth = 1;
    for (let i = -330; i < 900; i += 34) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 330, 330);
        ctx.stroke();
    }

    const glow = ctx.createRadialGradient(80, 126, 10, 80, 126, 320);
    glow.addColorStop(0, 'rgba(242,169,180,0.18)');
    glow.addColorStop(1, 'rgba(242,169,180,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 500, 330);

    ctx.fillStyle = colors.gold;
    ctx.textAlign = 'left';
    ctx.font = 'bold 17px ' + fontFamily;
    ctx.fillText('冒険者の記録', 35, 39);
    ctx.fillStyle = colors.muted;
    ctx.font = 'bold 11px ' + fontFamily;
    ctx.fillText('ADVENTURER PROFILE', 202, 38);

    roundedFill(ctx, 504, 18, 148, 30, 14, 'rgba(245, 214, 158, 0.10)');
    ctx.fillStyle = colors.gold;
    ctx.font = 'bold 11px ' + fontFamily;
    ctx.textAlign = 'center';
    ctx.fillText('✦ PERMANENT XP', 578, 38, 135);

    ctx.strokeStyle = 'rgba(245,214,158,0.35)';
    ctx.beginPath();
    ctx.moveTo(33, 60);
    ctx.lineTo(659, 60);
    ctx.stroke();

    drawStar(ctx, 48, 169, 7, colors.pink);
    drawStar(ctx, 182, 104, 5, colors.ice);
    drawStar(ctx, 176, 209, 4, colors.gold);
    drawCorner(ctx, 23, 23, 1, 1, 'rgba(245,214,158,0.7)');
    drawCorner(ctx, 667, 307, -1, -1, 'rgba(245,214,158,0.7)');

    ctx.strokeStyle = colors.gold;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(113, 163, 76, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(242,169,180,0.76)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(113, 163, 82, Math.PI * 0.15, Math.PI * 1.72);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(113, 163, 71, 0, Math.PI * 2);
    ctx.clip();
    if (data.avatar) {
        ctx.drawImage(data.avatar, 42, 92, 142, 142);
    } else {
        roundedFill(ctx, 40, 90, 146, 146, 70, '#3B526B');
        ctx.fillStyle = colors.white;
        ctx.textAlign = 'center';
        ctx.font = 'bold 70px ' + fontFamily;
        ctx.fillText('★', 113, 187);
    }
    ctx.restore();

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.white;
    ctx.font = 'bold 34px ' + fontFamily;
    ctx.fillText(data.username, 213, 124, 441);

    ctx.fillStyle = colors.pink;
    ctx.font = 'bold 14px ' + fontFamily;
    ctx.fillText('✦ 冒險進度 · 永久累積', 216, 155, 420);
    ctx.fillStyle = colors.muted;
    ctx.font = '12px ' + fontFamily;
    ctx.fillText(data.guildName, 216, 179, 400);

    drawStat(ctx, 215, '伺服器排名', data.serverRank, colors.gold);
    drawStat(ctx, 363, '累積 EXP', data.totalXpText, colors.ice);
    drawStat(ctx, 511, '距離下一級', data.remainingText, colors.pink);

    ctx.fillStyle = colors.muted;
    ctx.font = 'bold 11px ' + fontFamily;
    ctx.fillText('LEVEL PROGRESS', 37, 310);

    roundedFill(ctx, 216, 301, 438, 10, 5, '#091522');
    if (data.progress > 0) {
        const bar = ctx.createLinearGradient(216, 0, 654, 0);
        bar.addColorStop(0, colors.pink);
        bar.addColorStop(0.55, colors.gold);
        bar.addColorStop(1, colors.ice);
        roundedFill(ctx, 216, 301, 438 * data.progress, 10, 5, bar);
    }

    ctx.restore();

    const levelBg = ctx.createLinearGradient(710, 0, 1000, 155);
    levelBg.addColorStop(0, '#1B3147');
    levelBg.addColorStop(1, '#101F32');
    roundedFill(ctx, 710, 0, 290, 155, 22, levelBg);
    drawCorner(ctx, 729, 20, 1, 1, colors.gold);

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.muted;
    ctx.font = 'bold 14px ' + fontFamily;
    ctx.fillText('LEVEL', 742, 41);
    ctx.fillStyle = colors.pink;
    ctx.font = '12px ' + fontFamily;
    ctx.fillText('レベル', 938, 41);

    roundedFill(ctx, 733, 57, 244, 76, 13, '#0A1726');
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.gold;
    ctx.font = 'bold 53px ' + fontFamily;
    ctx.fillText(String(data.level), 855, 116, 214);

    const expBg = ctx.createLinearGradient(710, 175, 1000, 330);
    expBg.addColorStop(0, '#1B3147');
    expBg.addColorStop(1, '#101F32');
    roundedFill(ctx, 710, 173, 290, 157, 22, expBg);
    drawCorner(ctx, 979, 310, -1, -1, colors.pink);

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.muted;
    ctx.font = 'bold 14px ' + fontFamily;
    ctx.fillText('EXP', 742, 211);
    ctx.fillStyle = colors.pink;
    ctx.font = '12px ' + fontFamily;
    ctx.fillText('経験値', 932, 211);

    roundedFill(ctx, 733, 225, 244, 56, 13, '#0A1726');
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.white;
    ctx.font = 'bold 22px ' + fontFamily;
    ctx.fillText(data.levelXpText + ' / ' + data.levelMaxText, 855, 262, 218);

    roundedFill(ctx, 733, 293, 244, 10, 5, '#0A1726');
    if (data.progress > 0) {
        const progressBg = ctx.createLinearGradient(733, 0, 977, 0);
        progressBg.addColorStop(0, colors.pink);
        progressBg.addColorStop(1, colors.gold);
        roundedFill(ctx, 733, 293, 244 * data.progress, 10, 5, progressBg);
    }

    ctx.fillStyle = colors.muted;
    ctx.font = 'bold 11px ' + fontFamily;
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(data.progress * 100) + '%', 976, 320);

    ctx.textAlign = 'left';
    ctx.fillStyle = colors.muted;
    ctx.fillText('TO NEXT LEVEL', 735, 320);
}

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('查看日系 RPG 風格的永久等級與 XP 卡片')
        .addUserOption(option => option.setName('user').setDescription('要查看的成員')),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        try {
            if (!interaction.guild) {
                return await interaction.editReply({ content: '請在 Discord 伺服器內使用 /rank 喵。' });
            }

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const username = member ? member.displayName : targetUser.username;
            const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });

            const profile = await UserProfile.findOne({
                userId: targetUser.id,
                guildId: interaction.guild.id
            });

            const level = Math.max(1, Math.floor(Number(profile?.level) || 1));
            const totalXp = Math.max(0, Number(profile?.xp) || 0);
            const levelMax = 5 * (level ** 2) + 50 * level + 100;
            const levelXp = Math.max(0, Math.min(levelMax, totalXp - getTotalXpForLevel(level)));
            const remaining = Math.max(0, levelMax - levelXp);
            const progress = Math.max(0, Math.min(1, levelXp / levelMax));

            const higherXpCount = await UserProfile.countDocuments({
                guildId: interaction.guild.id,
                xp: { $gt: totalXp }
            });

            let avatar = null;
            try {
                avatar = await loadImage(avatarUrl);
            } catch (err) {
                // 如果頭像載入失敗，保持 null 走備用方案
            }

            const canvas = createCanvas(1000, 330);
            const ctx = canvas.getContext('2d');
            drawCard(ctx, {
                avatar,
                username,
                guildName: interaction.guild.name,
                level,
                serverRank: '#' + (higherXpCount + 1).toLocaleString(),
                totalXpText: totalXp.toLocaleString(),
                remainingText: remaining.toLocaleString(),
                levelXpText: levelXp.toLocaleString(),
                levelMaxText: levelMax.toLocaleString(),
                progress
            });

            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), {
                name: 'rank-card.png'
            });

            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            try {
                await interaction.editReply({
                    content: '❌ 產生 XP 卡片時發生錯誤，請稍後再試喵！'
                });
            } catch (e) {
                // 靜默略過
            }
        }
    }
};
