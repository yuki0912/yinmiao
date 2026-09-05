const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    PermissionFlagsBits,
    ChannelType
} = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('set-ticket')
        .setDescription('發送工單建立訊息（管理員專用）')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('請選擇要發送工單訊息的目標頻道（選填，預設為後台設定或當前頻道）')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('title')
                .setDescription('自訂工單卡片標題（選填）')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('自訂工單卡片說明內文（選填，可輸入 \\n 換行）')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('footer')
                .setDescription('自訂工單卡片頁尾（選填）')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('color')
                .setDescription('自訂卡片顏色（選填，例如：#FFC8DD）')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('button_label')
                .setDescription('自訂按鈕文字（選填，預設：建立工單）')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    isNew: true,

    async execute(interaction) {
        const guildId = interaction.guild.id;

        // 1. 取得玩家輸入的自訂選項
        const inputTitle = interaction.options.getString('title');
        const inputDescription = interaction.options.getString('description')?.replace(/\\n/g, '\n');
        const inputFooter = interaction.options.getString('footer');
        const inputColor = interaction.options.getString('color');
        const inputButtonLabel = interaction.options.getString('button_label');

        // 2. 從資料庫撈取既有設定
        let config = await GuildConfig.findOne({ guildId });

        // 3. 計算最終顯示的文字內容（優先度：指令輸入 > DB既有設定 > 系統預設）
        const embedTitle = inputTitle || config?.ticketTitle || '📩 聯絡支援 / 建立工單';
        const embedDescription = inputDescription || config?.ticketDescription || '如果你需要管理員協助、舉報玩家或提出建議，請點擊下方按鈕喵！\n\n點擊後，銀喵會為你開一個專屬的私密頻道。';
        const embedFooter = inputFooter || config?.ticketFooter || '銀喵 YinMiao 工單系統';
        const embedColor = inputColor || config?.ticketColor || '#FFC8DD';
        const buttonLabel = inputButtonLabel || config?.ticketButtonLabel || '建立工單';

        // 4. 組裝動態 Embed 卡片與按鈕
        const embed = new EmbedBuilder()
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setThumbnail(interaction.client.user.displayAvatarURL())
            .setFooter({
                text: embedFooter,
                iconURL: interaction.client.user.displayAvatarURL()
            });

        // 驗證並設定色號 (防止無效 Hex 顏色導致崩潰)
        try {
            embed.setColor(embedColor);
        } catch {
            embed.setColor('#FFC8DD');
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('create_ticket')
                .setLabel(buttonLabel)
                .setEmoji('🎫')
                .setStyle(ButtonStyle.Primary)
        );

        // 5. 判斷要發送的目標頻道
        const chosenChannel = interaction.options.getChannel('channel');
        let targetChannel = chosenChannel || interaction.channel;

        if (!chosenChannel && config?.ticketChannelId) {
            const fetchChannel = await interaction.guild.channels.fetch(config.ticketChannelId).catch(() => null);
            if (fetchChannel && fetchChannel.isTextBased()) {
                targetChannel = fetchChannel;
            }
        }

        // 6. 安全發送卡片並將最新設定同步儲存至資料庫
        try {
            const sentMessage = await targetChannel.send({ embeds: [embed], components: [row] });

            // 如果資料庫尚無設定檔，建立一份新的
            if (!config) {
                config = new GuildConfig({ guildId });
            }

            // 同步最新修改的文字與訊息綁定至 DB
            config.ticketTitle = embedTitle;
            config.ticketDescription = embedDescription;
            config.ticketFooter = embedFooter;
            config.ticketColor = embedColor;
            config.ticketButtonLabel = buttonLabel;
            config.ticketChannelId = targetChannel.id;
            config.ticketMessageId = sentMessage.id;

            await config.save();

            // 7. 私密成功回覆
            await interaction.reply({
                content: `✨ **喵！工單面板發送成功！**\n📢 投放目標頻道：<#${targetChannel.id}>\n🏷️ 卡片標題：\`${embedTitle}\`\n🎨 主題色彩：\`${embedColor}\`\n\n*(💡 提示：銀喵已將這些自訂設定同步儲存至資料庫！之後在網頁修改也能自動連動唷！)*`,
                ephemeral: true
            });
        } catch (error) {
            console.error("發送工單卡片失敗喵：", error);
            await interaction.reply({
                content: `❌ 哇西了！銀喵沒辦法把工單卡片發送到 <#${targetChannel.id}> 喵！請檢查銀喵在該頻道是否有「觀看頻道」和「發送訊息」的權限唷！`,
                ephemeral: true
            });
        }
    }
};