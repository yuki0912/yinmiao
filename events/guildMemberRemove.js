const { Events, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig');
const UserProfile = require('../models/UserProfile');

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        try {
            const config = await GuildConfig.findOne({ guildId: member.guild.id });
            if (!config || !config.sendLeave || !config.leaveChannelId) return;

            const channel = await member.guild.channels.fetch(config.leaveChannelId).catch(() => null);
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
                    .replace(/{user}/g, rawUsername)
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

            const embeds = [];

            if (config.sendLeaveEmbed) {
                const embed = new EmbedBuilder()
                    .setTitle(parseText(config.leaveTitle || '{username} 離開了伺服器...'))
                    .setDescription(parseText(config.leaveDescription || '希望 {username} 未來旅途順利！'))
                    .setColor(config.leaveEmbedColor || '#A0AEC0')
                    .setThumbnail(member.user.displayAvatarURL({ extension: 'png', size: 256 }));

                if (config.showLeaveTimestamp) embed.setTimestamp();
                if (config.showLeaveFooter) {
                    embed.setFooter({ text: parseText(config.leaveFooter || member.guild.name) });
                }

                embeds.push(embed);
            }

            const contentText = parseText(config.leaveContent || '');

            if (!contentText && embeds.length === 0) return;

            await channel.send({
                content: contentText || undefined,
                embeds,
                allowedMentions: { parse: [] }
            });

        } catch (error) {
            // 靜默略過
        }
    }
};