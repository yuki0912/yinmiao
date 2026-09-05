const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('view-config')
        .setDescription('📊 查看歡迎系統詳細設定與顏色配置')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const config = await GuildConfig.findOne({ guildId: interaction.guild.id });

        // 🚩 對應你的 Schema 欄位名稱
        const embedColor = config?.embedColor || '#00ffcc';
        const canvasColor = config?.canvasColor || '#00ffcc';

        const configEmbed = new EmbedBuilder()
            .setColor(embedColor) // Embed 邊條反映設定的主題色
            .setTitle(`📊 ${interaction.guild.name} 歡迎系統配置`)
            .addFields(
                { 
                    name: '📍 基礎狀態', 
                    value: `> **發送頻道:** ${config?.welcomeChannelId ? `<#${config.welcomeChannelId}>` : '`未設定 (系統頻道)`'}\n` +
                           `> **顯示卡片:** ${config?.sendEmbed === false ? '❌ 關閉' : '✅ 開啟'}`,
                    inline: false 
                },
                { 
                    name: '🎨 顏色配置', 
                    value: `▫️ 卡片側邊: \`${embedColor}\`\n` +
                           `▫️ 圖片文字: \`${canvasColor}\``,
                    inline: true 
                },
                { 
                    name: '🖼️ 視覺資源', 
                    value: config?.welcomeImageUrl ? `[點擊查看背景圖](${config.welcomeImageUrl})` : '🎨 系統預設漸層',
                    inline: true
                },
                { 
                    name: '✍️ 文字內容 (變數預覽)',
                    value: `**圖片大字:** \`${config?.canvasText || 'Welcome'}\`\n` +
                           `**卡片標題:** \`${config?.welcomeTitle || '✨ 歡迎新成員入駐'}\`\n` +
                           `**卡片描述:** \`${config?.welcomeDescription || '很高興你能加入我們。'}\``,
                    inline: false
                },
                { 
                    name: '🏷️ 額外欄位 (Fields)', 
                    value: config?.fieldTitle ? `**標題:** \`${config.fieldTitle}\`\n**內容:** \`${config.fieldValue}\`` : '`未設定`',
                    inline: false 
                }
            )
            .setFooter({ text: '💡 提示：使用 /setup 修改設定 | 使用 /test-welcome 測試效果' })
            .setTimestamp();

        // 設置縮圖預覽背景
        if (config?.welcomeImageUrl?.startsWith('http')) {
            configEmbed.setThumbnail(config.welcomeImageUrl);
        }

        await interaction.editReply({ embeds: [configEmbed] });
    },
};
