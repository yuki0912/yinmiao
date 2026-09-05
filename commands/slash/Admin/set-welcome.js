const {
    SlashCommandBuilder,
    EmbedBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig');
const welcomeEvent = require('../../../events/guildMemberAdd');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('set-welcome')
        .setDescription('🛠️ 歡迎系統視覺與功能設定')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // --- 核心設定 ---
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('📍 訊息發送頻道')
                .addChannelTypes(ChannelType.GuildText)
        )
        .addBooleanOption(opt => opt.setName('show_embed').setDescription('🖼️ 是否開啟 Embed 內嵌卡片模式'))
        .addStringOption(opt => opt.setName('text').setDescription('💬 頻道純文字內容'))
        .addStringOption(opt => opt.setName('title').setDescription('🏷️ 卡片標題'))
        .addStringOption(opt => opt.setName('desc').setDescription('📝 卡片描述')),

    async execute(interaction) {
        // 使用 Ephemeral 確保設定過程不會洗版
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const { options, guild } = interaction;

        // --- 1. 數據封裝與映射 ---
        const updateData = {};
        const mapping = {
            'channel': 'welcomeChannelId',
            'show_embed': 'sendEmbed',
            'text': 'welcomeContent',
            'title': 'welcomeTitle',
            'desc': 'welcomeDescription'
        };

        // 遍歷 mapping 找出有被填寫的選項
        for (const [optName, dbKey] of Object.entries(mapping)) {
            const val = options.get(optName);
            if (val !== null) {
                updateData[dbKey] = (optName === 'channel') ? val.channel.id : val.value;
            }
        }

        // 防呆機制：如果管理員叫出指令卻什麼都沒填，直接回傳提示
        if (Object.keys(updateData).length === 0) {
            return interaction.editReply('⚠️ 妳沒有提供任何要更新的設定喵！請至少填寫一個選項。');
        }

        // --- 2. 寫入資料庫 ---
        const config = await GuildConfig.findOneAndUpdate(
            { guildId: guild.id },
            { $set: updateData },
            { upsert: true, new: true }
        );

        // --- 3. 成功回應 ---
        const fallbackColor = /^#[0-9A-F]{6}$/i.test(config.embedColor) ? config.embedColor : '#FFC8DD';

        const successEmbed = new EmbedBuilder()
            .setAuthor({ name: '歡迎系統同步完成', iconURL: guild.iconURL() || undefined })
            .setDescription(`設定已更新。你可以使用 \`/testwelcome\` 來測試正式發送效果喔喵！`)
            .setColor(fallbackColor)
            .addFields(
                {
                    name: '📡 功能開關狀態',
                    value: `內嵌卡片 (Embed): ${config.sendEmbed !== false ? '🟢' : '🔴'}`,
                    inline: false
                },
                {
                    name: '📍 投遞頻道',
                    value: config.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '`尚未設定頻道`',
                    inline: true
                }
            );

        await interaction.editReply({ embeds: [successEmbed] });
    },
};