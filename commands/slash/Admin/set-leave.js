const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig');
const welcomeEvent = require('../../../events/guildMemberRemove'); 

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('set-leave')
        .setDescription('🛠️ 離開通知系統頻道與文字設定')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // --- 功能設定 ---
        .addChannelOption(opt => opt.setName('channel').setDescription('📍 離開訊息發送頻道'))
        .addStringOption(opt => opt.setName('text').setDescription('💬 自訂文字。支援: {user_name}, {member_count}'))
        .addBooleanOption(opt => opt.setName('status').setDescription('📡 是否開啟離開通知功能'))
        .addBooleanOption(opt => opt.setName('reset').setDescription('⚠️ 是否重置所有離開設定（清空資料）')),

    async execute(interaction) {
        // 先告訴 Discord 正在處理中，並設為隱密回覆
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        const { options, guild } = interaction;

        const channel = options.getChannel('channel');
        const text = options.getString('text');
        const status = options.getBoolean('status');
        const reset = options.getBoolean('reset');

        // 1. 如果管理員選擇重置設定
        if (reset === true) {
            const config = await GuildConfig.findOneAndUpdate(
                { guildId: guild.id },
                { 
                    $set: {
                        leaveChannelId: null,
                        leaveContent: '成員 {user_name} 離開了我們喵... 伺服器目前剩餘 {member_count} 人。',
                        sendLeave: false // 關閉開關
                    } 
                },
                { upsert: true, new: true }
            );

            const resetEmbed = new EmbedBuilder()
                .setAuthor({ name: '離開系統已成功重置', iconURL: guild.iconURL() })
                .setColor('#E53E3E')
                .setDescription('⚠️ 已將該伺服器的離開通知完全關閉，並將文字內容恢復為初始預設值喵！');

            return await interaction.editReply({ embeds: [resetEmbed] });
        }

        // 2. 正常更新邏輯
        const updateData = {};
        if (channel) updateData.leaveChannelId = channel.id;
        if (text) updateData.leaveContent = text;
        if (status !== null) updateData.sendLeave = status; // 對應資料庫開關欄位，假設命名為 sendLeave

        // 防呆：如果什麼選項都沒選，提醒管理員
        if (Object.keys(updateData).length === 0) {
            return interaction.editReply('⚠️ 妳必須至少選擇一個要設定的項目，或是選擇重置設定喵！');
        }

        // 3. 寫入資料庫
        const config = await GuildConfig.findOneAndUpdate(
            { guildId: guild.id },
            { $set: updateData },
            { upsert: true, new: true }
        );

        // 4. 動態模擬預覽文字給管理員看
        const rawContent = config.leaveContent || '成員 {user_name} 離開了我們喵... 伺服器目前剩餘 {member_count} 人。';
        const previewContent = rawContent
            .replace(/{user_name}/g, interaction.user.username)
            .replace(/{member_count}/g, guild.memberCount);

        // 5. 渲染成功的內嵌卡片
        const successEmbed = new EmbedBuilder()
            .setAuthor({ name: '離開系統設定完成', iconURL: guild.iconURL() })
            .setColor(config.embedColor || '#A0AEC0') // 自動適應妳在網頁或歡迎設定裡配好的 Embed 顏色
            .addFields(
                { 
                    name: '📡 功能開關狀態', 
                    value: `離開通知系統: ${config.sendLeave !== false ? '🟢 開啟' : '🔴 關閉'}`, 
                    inline: false 
                },
                { 
                    name: '📍 通知頻道', 
                    value: config.leaveChannelId ? `<#${config.leaveChannelId}>` : '`❌ 未設定 (將無法發送)`', 
                    inline: true 
                },
                { 
                    name: '📝 原始設定內容', 
                    value: `\`\`\`${rawContent}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '👁️ 實際發送預覽', 
                    value: previewContent, 
                    inline: false 
                }
            )
            .setFooter({ text: '💡 小提示：妳可以隨時在網頁控制台進行更細緻的調整喔喵！' });

        await interaction.editReply({ embeds: [successEmbed] });
    },
};
