const { Events, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isButton()) return;

        const { guild, user, customId, channel } = interaction;

        // --- 建立工單 ---
        if (customId === 'create_ticket') {
            // 使用 flags 代替 ephemeral 消除警告
            await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

            const existingChannel = guild.channels.cache.find(c => c.name === `ticket-${user.username.toLowerCase()}`);
            if (existingChannel) {
                return interaction.editReply({ content: `你已經有一個開啟中的工單了喵：${existingChannel}` });
            }

            try {
                // 🔍 自動抓取擁有「管理員」權限的身分組
                const adminRoles = guild.roles.cache.filter(role => role.permissions.has(PermissionFlagsBits.Administrator));

                const overwrites = [
                    {
                        id: guild.id, // @everyone
                        deny: [PermissionFlagsBits.ViewChannel],
                    },
                    {
                        id: user.id, // 建立者
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    },
                    {
                        id: interaction.client.user.id, // 銀喵
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                    }
                ];

                // 將所有管理員組加入白名單
                adminRoles.forEach(role => {
                    overwrites.push({
                        id: role.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                    });
                });

                const ticketChannel = await guild.channels.create({
                    name: `ticket-${user.username}`,
                    type: ChannelType.GuildText,
                    permissionOverwrites: overwrites,
                });

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle('🎫 工單已建立')
                    .setDescription(`你好 ${user}，請在此說明你的問題。\n管理員會盡快趕來處理喵！`)
                    .setColor('#FFC8DD')
                    .setTimestamp();

                const closeRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('close_ticket')
                        .setLabel('關閉工單')
                        .setEmoji('🔒')
                        .setStyle(ButtonStyle.Danger)
                );

                // 標註第一個管理員組作為提醒
                const adminMention = adminRoles.first() ? `<@&${adminRoles.first().id}>` : '';

                await ticketChannel.send({ 
                    content: `${user} ${adminMention} 歡迎喵！`, 
                    embeds: [welcomeEmbed], 
                    components: [closeRow] 
                });

                await interaction.editReply({ content: `工單已建立！請前往 ${ticketChannel} 喵！` });
            } catch (err) {
                console.error(err);
                await interaction.editReply({ content: '建立頻道時出錯了喵...' });
            }
        }

        // --- 關閉工單 ---
        if (customId === 'close_ticket') {
            await interaction.reply('🔒 此頻道將在 5 秒後關閉並刪除喵...');
            setTimeout(() => {
                channel.delete().catch(() => {});
            }, 5000);
        }
    }
};
