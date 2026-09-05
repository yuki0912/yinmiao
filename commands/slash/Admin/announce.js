const {
    SlashCommandBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType
} = require('discord.js');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('announce公告')
        .setDescription('發布正式公告')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option =>
            option.setName('target_channel')
                .setDescription('公告發送的頻道')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('ping_role')
                .setDescription('要標記的身分組')
                .setRequired(false)
        )
        .addAttachmentOption(option => // 📷 新增上傳照片/圖片選項
            option.setName('image')
                .setDescription('公告附圖 (照片/圖片)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const targetChannel = interaction.options.getChannel('target_channel');
        const pingRole = interaction.options.getRole('ping_role');
        const image = interaction.options.getAttachment('image'); // 📷 取得上傳的照片

        // 1. 建立 Modal 彈窗
        const modal = new ModalBuilder()
            .setCustomId(`ann_modal_${interaction.id}`)
            .setTitle('撰寫公告內容');

        modal.addComponents(
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('title')
                    .setLabel('公告標題')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                    .setCustomId('content')
                    .setLabel('詳細公告內容')
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
            )
        );

        await interaction.showModal(modal);

        // 2. 接收彈窗提交
        const filter = (i) => i.customId === `ann_modal_${interaction.id}`;

        try {
            const modalInt = await interaction.awaitModalSubmit({ filter, time: 300000 });

            const title = modalInt.fields.getTextInputValue('title');
            const messageBody = modalInt.fields.getTextInputValue('content');

            // 🚩 紅色點點的核心邏輯：
            let mentionText = '';
            if (pingRole) {
                // 如果選擇的是 @everyone (ID 等於伺服器 ID)
                if (pingRole.id === interaction.guild.id) {
                    mentionText = '@everyone';
                } else {
                    mentionText = `<@&${pingRole.id}>`;
                }
            }

            // 製作漂亮的公告框框
            const annEmbed = new EmbedBuilder()
                .setTitle(`${title}`)
                .setDescription(messageBody)
                .setColor('#FFD700')
                .setTimestamp()
                .setFooter({
                    text: `由管理員 ${interaction.user.tag} 發布`,
                    iconURL: interaction.user.displayAvatarURL()
                });

            // 📷 如果有上傳照片，嵌入到公告 Embed 大圖中
            if (image) {
                annEmbed.setImage(image.url);
            }

            // 發送至目標頻道
            await targetChannel.send({
                content: mentionText,
                embeds: [annEmbed]
            });

            await modalInt.reply({ content: `✅ 公告已發布並成功觸發通知！`, ephemeral: true });

        } catch (err) {
            console.error('公告發送出錯:', err);
        }
    },
};