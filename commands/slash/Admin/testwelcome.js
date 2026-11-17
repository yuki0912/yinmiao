const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const GuildConfig = require('../../../models/GuildConfig');
const path = require('node:path');
const fs = require('node:fs');

const fontPath = path.join(__dirname, '../../../NotoSansTC-Bold.ttf');
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
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('testwelcome')
        .setDescription('🧪 測試伺服器歡迎卡片與訊息效果')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .setDMPermission(false)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('模擬加入的成員（預設為你自己）')
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('指定要發送測試訊息的頻道（預設為後台設定的歡迎頻道）')
                .addChannelTypes(ChannelType.GuildText)
        ),

    async execute(interaction) {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        try {
            if (!interaction.guild) {
                return await interaction.editReply({ content: '請在 Discord 伺服器內使用 /testwelcome 喵。' });
            }

            const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
            if (!config) {
                return await interaction.editReply({ content: '❌ 找不到此伺服器的歡迎設定，請先至網頁後台儲存設定喵！' });
            }

            const targetChannel = interaction.options.getChannel('channel')
                || (config.welcomeChannelId ? await interaction.guild.channels.fetch(config.welcomeChannelId).catch(() => null) : null)
                || interaction.channel;

            if (!targetChannel || !targetChannel.isTextBased()) {
                return await interaction.editReply({ content: '❌ 找不到有效的文字頻道來發送測試歡迎訊息喵！' });
            }

            const targetUser = interaction.options.getUser('user') || interaction.user;
            const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
            const displayName = member ? member.displayName : targetUser.username;
            const rawUsername = targetUser.username;
            const userId = targetUser.id;
            const userMention = `<@${targetUser.id}>`;
            const guildName = interaction.guild.name;
            const memberCount = interaction.guild.memberCount.toString();

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

            const files = [];
            const embeds = [];

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
                        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
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

                files.push(new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'welcome-card.png' }));
            }

            if (config.sendEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle(parseText(config.welcomeTitle || '歡迎加入！'))
                    .setDescription(parseText(config.welcomeDescription || '歡迎 {user} 來到 {server}！'))
                    .setColor(config.welcomeEmbedColor || '#F472B6');

                if (config.showTimestamp) embed.setTimestamp();
                if (config.welcomeImageUrl) embed.setImage(config.welcomeImageUrl);
                if (config.sendCanvas) embed.setImage('attachment://welcome-card.png');
                if (config.showFooter) {
                    embed.setFooter({ text: parseText(config.welcomeFooter || interaction.guild.name) });
                }

                embeds.push(embed);
            }

            const contentText = parseText(config.welcomeContent || '');

            if (!contentText && embeds.length === 0 && files.length === 0) {
                return await interaction.editReply({
                    content: '⚠️ 目前沒有啟用任何歡迎內容喵！'
                });
            }

            await targetChannel.send({
                content: contentText || undefined,
                embeds,
                files,
                allowedMentions: { parse: ['users'] }
            });

            await interaction.editReply({
                content: `✅ 測試歡迎訊息已成功發送至 ${targetChannel} 頻道囉喵！🐾`
            });

        } catch (error) {
            try {
                await interaction.editReply({
                    content: '❌ 測試歡迎卡片時發生錯誤，請檢查圖片網址是否有效喵！'
                });
            } catch (e) { }
        }
    }
};