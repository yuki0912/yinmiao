const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

async function checkChannel(guild, channel) {
    if (!channel || !channel.isTextBased() || channel.guildId !== guild.id) {
        throw new Error('找不到有效的伺服器文字頻道。');
    }

    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const permissions = botMember && channel.permissionsFor(botMember);
    const sendPermission = typeof channel.isThread === 'function' && channel.isThread()
        ? PermissionFlagsBits.SendMessagesInThreads
        : PermissionFlagsBits.SendMessages;

    const requiredPermissions = [
        PermissionFlagsBits.ViewChannel,
        sendPermission,
        PermissionFlagsBits.EmbedLinks
    ];

    if (!permissions || !permissions.has(requiredPermissions)) {
        throw new Error('銀喵在 ' + channel + ' 缺少「查看頻道」、「發送訊息」或「嵌入連結」權限。');
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('依照 discord.js Guide 格式建立 Embed，預覽後再發送')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addChannelOption(option =>
            option
                .setName('channel')
                .setDescription('Embed 的目標發送頻道（未填則使用目前頻道）')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(false)
        ),

    async execute(interaction) {
        try {
            if (!interaction.inGuild() || !interaction.guild) {
                throw new Error('/embed 只能在伺服器內使用喵！');
            }

            const channel = interaction.options.getChannel('channel') || interaction.channel;
            await checkChannel(interaction.guild, channel);

            const modal = new ModalBuilder()
                .setCustomId('embed:create:' + channel.id)
                .setTitle('建立 Embed 卡片');

            const jsonInput = new TextInputBuilder()
                .setCustomId('embed_json_1')
                .setLabel('Embed JSON 物件')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('{"title":"標題","description":"內容","color":"#0099ff"}')
                .setMaxLength(4000)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(jsonInput));
            await interaction.showModal(modal);
        } catch (error) {
            console.error('開啟 Embed 編輯器失敗:', error);
            const response = {
                content: '❌ ' + (error.message || '開啟 Embed 編輯器時發生錯誤。'),
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(response).catch(() => null);
            } else {
                await interaction.reply(response).catch(() => null);
            }
        }
    }
};