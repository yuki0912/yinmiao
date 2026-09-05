const { 
    SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, 
    MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle 
} = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('broadcast')
        .setDescription('🚀 [開發者專用] 發送全體官方公告 (帶預覽功能)')
        // 🟢 核心優化：設為 0 代表阻斷所有預設權限，讓一般管理員在選單中直接「隱形」，只有妳能呼叫！
        .setDefaultMemberPermissions(0)
        .addStringOption(opt => opt.setName('標題').setRequired(true).setDescription('公告的大標題 | Title'))
        .addStringOption(opt => opt.setName('更新內容').setRequired(true).setDescription('詳細內容 (支援 \\n 換行) | Content'))
        .addAttachmentOption(opt => opt.setName('預覽圖').setDescription('上傳一張功能展示圖 | Upload Image')),

    async execute(interaction) {
        // 🚩 安全檢查：主人的開發者 Discord ID
        const developerId = '467017842672271360'; 
        if (interaction.user.id !== developerId) {
            return interaction.reply({ content: '❌ 權限不足：此功能為銀喵核心開發者專用機密指令喵！', flags: [MessageFlags.Ephemeral] });
        }

        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        const title = interaction.options.getString('標題');
        const content = interaction.options.getString('更新內容');
        const image = interaction.options.getAttachment('預覽圖');

        // 🎨 1. 建立預覽 Embed (完美格式化換行)
        const formattedContent = content.replace(/\\n/gi, '\n');
        
        const previewEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`📢 ${title}`)
            .setAuthor({ name: `銀喵系統公告 | System Announcement`, iconURL: interaction.client.user.displayAvatarURL() })
            .setDescription(formattedContent)
            .addFields(
                { name: '✨ 如何使用？', value: '管理員可以使用 `/set-welcome` 等指令調整最新設定，或透過控制台網頁隨時變更配置喵！', inline: false },
                { name: '🔗 官方連結', value: '[加入銀喵支援伺服器](https://discord.gg)', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `來自 銀喵 開發團隊 • 目前服務於 ${interaction.client.guilds.cache.size} 個伺服器` });

        if (image) previewEmbed.setImage(image.url);

        // 2. 建立確認按鈕
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('confirm_broadcast').setLabel('🚀 正式全球發送').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('cancel_broadcast').setLabel('❌ 取消發送').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.editReply({
            content: '👀 **主人，這是您的全域公告預覽。請確認內容是否完美，確定要發送給所有伺服器嗎？**',
            embeds: [previewEmbed],
            components: [row]
        });

        // 3. 建立按鈕收集器
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_broadcast') {
                await i.update({ content: '📡 **正在全力同步發送至全球伺服器中，請稍候喵...**', components: [] });

                let successCount = 0;
                let failCount = 0;

                // 🟢 效能優化：收集所有發送任務同步處理，避免單一伺服器卡死導致後續全部塞車
                const sendPromises = Array.from(interaction.client.guilds.cache.values()).map(async (guild) => {
                    try {
                        const config = await GuildConfig.findOne({ guildId: guild.id }).catch(() => null);
                        let targetChannel = null;

                        // A. 優先嘗試在設定的「分類 (Category)」下尋找聊天頻道
                        if (config?.welcomeCategoryId) {
                            const category = guild.channels.cache.get(config.welcomeCategoryId);
                            if (category && category.type === ChannelType.GuildCategory) {
                                targetChannel = category.children.cache.find(c => 
                                    c.type === ChannelType.GuildText && 
                                    ['聊天', 'chat', 'general', '大廳', 'main'].some(k => c.name.toLowerCase().includes(k)) &&
                                    c.permissionsFor(guild.members.me)?.has('SendMessages')
                                ) || category.children.cache.find(c => c.type === ChannelType.GuildText && c.permissionsFor(guild.members.me)?.has('SendMessages'));
                            }
                        }

                        // B. 如果分類找不到，改用原本的自動尋路 (設定頻道 > 關鍵字搜尋 > 系統頻道)
                        if (!targetChannel) {
                            targetChannel = 
                                guild.channels.cache.get(config?.chatChannelId) || 
                                guild.channels.cache.get(config?.welcomeChannelId) || 
                                guild.channels.cache.find(c => 
                                    c.type === ChannelType.GuildText && 
                                    ['聊天', 'chat', 'general', '大廳', 'main', '交流'].some(k => c.name.toLowerCase().includes(k)) &&
                                    c.permissionsFor(guild.members.me)?.has('SendMessages')
                                ) || 
                                guild.systemChannel;
                        }

                        // 確保頻道存在且擁有發言權限
                        if (targetChannel && targetChannel.permissionsFor(guild.members.me)?.has('SendMessages')) {
                            await targetChannel.send({ embeds: [previewEmbed] });
                            successCount++;
                        } else {
                            failCount++;
                        }
                    } catch (err) {
                        failCount++;
                    }
                });

                // 等待所有發送任務執行完畢
                await Promise.all(sendPromises);

                await interaction.editReply(`✅ **全域公告已同步完成喵！**\n📡 成功發送: **${successCount}** 個群組 | ⚠️ 失敗/無權限: **${failCount}**`);
            } else {
                await i.update({ content: '👌 **已安全取消本次公告發送。**', embeds: [], components: [] });
            }
            collector.stop();
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                interaction.editReply({ content: '⏱️ **預覽逾時，已自動取消發送喵。**', components: [] }).catch(() => null);
            }
        });
    },
};
