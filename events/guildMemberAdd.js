const { Events, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const GuildConfig = require('../models/GuildConfig');
const path = require('node:path');
const fs = require('node:fs');

const fontPath = path.join(__dirname, '../NotoSansTC-Bold.ttf');
let fontFamily = 'sans-serif';
if (fs.existsSync(fontPath)) {
    try {
        GlobalFonts.registerFromPath(fontPath, 'YinMiaoWelcome');
        fontFamily = 'YinMiaoWelcome';
    } catch (e) { }
}

function roundedFill(ctx, x, y, width, height, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
}

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        try {
            const config = await GuildConfig.findOne({ guildId: member.guild.id });
            if (!config || !config.welcomeChannelId) return;

            const channel = await member.guild.channels.fetch(config.welcomeChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) return;

            const displayName = member.displayName || member.user.username;
            const rawUsername = member.user.username;
            const userId = member.user.id;
            const userMention = `<@${member.user.id}>`;
            const guildName = member.guild.name;
            const memberCount = member.guild.memberCount.toString();

            const parseText = (text) => {
                if (!text) return '';
                return text
                    .replace(/{user}/g, userMention)
                    .replace(/{user_mention}/g, userMention)
                    .replace(/{user_name}/g, displayName)
                    .replace(/{display_name}/g, displayName)
                    .replace(/{username}/g, rawUsername)
                    .replace(/{user_id}/g, userId)
                    .replace(/{server}/g, guildName)
                    .replace(/{guild}/g, guildName)
                    .replace(/{guild_name}/g, guildName)
                    .replace(/{count}/g, memberCount)
                    .replace(/{member_count}/g, memberCount);
            };

            if (config.sendCanvas) {
                const canvas = createCanvas(900, 300);
                const ctx = canvas.getContext('2d');

                if (config.canvasBg && config.canvasBg.trim() !== '') {
                    try {
                        const bgImage = await loadImage(config.canvasBg.trim());
                        ctx.drawImage(bgImage, 0, 0, 900, 300);
                    } catch (err) {
                        roundedFill(ctx, 0, 0, 900, 300, 20, '#0B0F19');
                    }
                } else {
                    roundedFill(ctx, 0, 0, 900, 300, 20, '#0B0F19');
                }

                const overlayOpacity = typeof config.canvasOverlayOpacity === 'number' ? config.canvasOverlayOpacity : 0.6;
                if (overlayOpacity > 0) {
                    roundedFill(ctx, 0, 0, 900, 300, 20, `rgba(0, 0, 0, ${overlayOpacity})`);
                }

                const showAvatar = config.canvasShowAvatar !== false;

                if (showAvatar) {
                    const avatarRadius = Math.max(30, Math.min(120, Number(config.canvasAvatarSize) || 75));
                    const avatarX = 130;
                    const avatarY = 150;

                    ctx.strokeStyle = config.canvasColor || '#34D399';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.arc(avatarX, avatarY, avatarRadius + 5, 0, Math.PI * 2);
                    ctx.stroke();

                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
                    ctx.clip();

                    try {
                        const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 256 });
                        const avatarImage = await loadImage(avatarUrl);
                        ctx.drawImage(avatarImage, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
                    } catch (e) {
                        roundedFill(ctx, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2, avatarRadius, '#334155');
                    }
                    ctx.restore();

                    const textStartX = Math.max(250, avatarX + avatarRadius + 40);
                    const maxTextWidth = 900 - textStartX - 50;

                    ctx.textAlign = 'left';
                    ctx.fillStyle = config.canvasColor || '#F472B6';
                    ctx.font = `bold 50px "${fontFamily}", sans-serif`;
                    ctx.fillText(parseText(config.canvasText || 'Welcome 歡迎 {server}'), textStartX, 120, maxTextWidth);

                    ctx.fillStyle = config.canvasSubColor || '#FFFFFF';
                    ctx.font = `bold 50px "${fontFamily}", sans-serif`;
                    ctx.fillText(parseText(config.canvasSubText || displayName), textStartX, 185, maxTextWidth);
                } else {
                    const maxTextWidth = 800;

                    ctx.textAlign = 'center';
                    ctx.fillStyle = config.canvasColor || '#F472B6';
                    ctx.font = `bold 50px "${fontFamily}", sans-serif`;
                    ctx.fillText(parseText(config.canvasText || 'Welcome 歡迎 {server}'), 450, 125, maxTextWidth);

                    ctx.fillStyle = config.canvasSubColor || '#FFFFFF';
                    ctx.font = `bold 50px "${fontFamily}", sans-serif`;
                    ctx.fillText(parseText(config.canvasSubText || displayName), 450, 190, maxTextWidth);
                }

                const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome-card.png' });
                const contentText = parseText(config.welcomeContent || '');

                await channel.send({
                    content: contentText || undefined,
                    files: [attachment],
                    allowedMentions: { parse: ['users'] }
                });
                return;
            }

            if (config.sendEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle(parseText(config.welcomeTitle || '歡迎加入！'))
                    .setDescription(parseText(config.welcomeDescription || '歡迎 {user} 來到 {server}！'))
                    .setColor(config.welcomeEmbedColor || '#F472B6')
                    .setTimestamp();

                if (config.welcomeImageUrl) embed.setImage(config.welcomeImageUrl);
                if (config.showFooter) embed.setFooter({ text: parseText(config.welcomeFooter || member.guild.name) });

                const contentText = parseText(config.welcomeContent || '');
                await channel.send({
                    content: contentText || undefined,
                    embeds: [embed],
                    allowedMentions: { parse: ['users'] }
                });
            }

        } catch (error) {
            // 靜默略過
        }
    }
};