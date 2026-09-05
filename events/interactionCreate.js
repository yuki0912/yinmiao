const { 
    Events, 
    MessageFlags, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle 
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

// 控制面板按鈕
function createControlButtons(currentEmbedCount = 0) {
    const isFull = currentEmbedCount >= 10;
    const remaining = 10 - currentEmbedCount;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_add_embed')
            .setLabel(isFull ? '❌ 已達 10 張上限' : `➕ 追加卡片 (還可加 ${remaining} 張)`)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(isFull),
        new ButtonBuilder()
            .setCustomId('btn_finish_embed')
            .setLabel('🚀 發送到頻道')
            .setStyle(ButtonStyle.Success)
    );
}

module.exports = {
    name: Events.InteractionCreate,
    /**
     * @param {import('discord.js').Interaction} interaction 
     * @param {import('discord.js').Client} client 
     */
    async execute(interaction, client) {
        // 1. 斜線指令
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`執行指令 ${interaction.commandName} 出錯:`, error);
                if (error.code === 10062 || error.code === 10008) return;

                const errorResponse = { 
                    content: '❌ 執行指令時出錯，請稍後再試。', 
                    flags: [MessageFlags.Ephemeral] 
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(errorResponse).catch(() => null);
                } else {
                    await interaction.reply(errorResponse).catch(() => null);
                }
            }
        }

        // 2. 按鈕互動
        if (interaction.isButton()) {
            // A. 身份組認證
            if (interaction.customId === 'verify_rules') {
                try {
                    const config = await GuildConfig.findOne({ guildId: interaction.guildId });

                    if (!config || !config.rulesRoleId) {
                        return await interaction.reply({ 
                            content: '❌ 伺服器尚未設定認證身份組，請聯絡管理員喵！', 
                            flags: [MessageFlags.Ephemeral] 
                        });
                    }

                    const role = interaction.guild.roles.cache.get(config.rulesRoleId);
                    if (!role) {
                        return await interaction.reply({ 
                            content: '❌ 找不到設定的身份組，可能已被刪除喵！', 
                            flags: [MessageFlags.Ephemeral] 
                        });
                    }

                    if (interaction.member.roles.cache.has(role.id)) {
                        return await interaction.reply({ 
                            content: `喵？你已經擁有 ${role.name} 身份組了喔！`, 
                            flags: [MessageFlags.Ephemeral] 
                        });
                    }

                    await interaction.member.roles.add(role);
                    await interaction.reply({ 
                        content: `✅ 認證成功！你已獲得 **${role.name}** 身份組。`, 
                        flags: [MessageFlags.Ephemeral] 
                    });

                } catch (error) {
                    console.error('處理規則按鈕出錯:', error);
                    await interaction.reply({ 
                        content: '❌ 給予身份組時發生錯誤，請檢查機器人權限階級喵！', 
                        flags: [MessageFlags.Ephemeral] 
                    }).catch(() => null);
                }
            }

            // B. 追加卡片按鈕 (開啟追加視窗)
            if (interaction.customId === 'btn_add_embed') {
                const currentCount = interaction.message.embeds.length;

                if (currentCount >= 10) {
                    return await interaction.reply({
                        content: '❌ 單次訊息最多只能包含 10 張 Embed 卡片喵！',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                const maxInputs = Math.min(5, 10 - currentCount);

                const addModal = new ModalBuilder()
                    .setCustomId('modal_add_multi_embed')
                    .setTitle(`➕ 追加卡片 (目前 ${currentCount}/10 張)`);

                for (let i = 1; i <= maxInputs; i++) {
                    const cardNum = currentCount + i;
                    const input = new TextInputBuilder()
                        .setCustomId(`add_embed_${i}`)
                        .setLabel(`第 ${cardNum} 張 Embed (選填)`)
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('📢 標題\n這裡是這張卡片的內文...')
                        .setRequired(false);

                    addModal.addComponents(new ActionRowBuilder().addComponents(input));
                }

                await interaction.showModal(addModal);
            }

            // C. 完成並正式發送到頻道
            if (interaction.customId === 'btn_finish_embed') {
                const embedsToSend = interaction.message.embeds;

                // 正式公開發送到該頻道
                await interaction.channel.send({ embeds: embedsToSend });

                // 更新私密預覽訊息，關閉操作按鈕
                await interaction.update({
                    content: '✅ 已成功發送 Embed 卡片到頻道！',
                    embeds: [],
                    components: []
                }).catch(() => null);
            }
        }

        // 3. 表單提交
        if (interaction.isModalSubmit()) {
            const colors = ['#FFB7C5', '#A855F7', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#EC4899', '#14B8A6', '#8B5CF6'];

            // A. 第一批 1~5 張 Modal 提交
            if (interaction.customId === 'customEmbedModal') {
                try {
                    const embeds = [];

                    for (let i = 1; i <= 5; i++) {
                        const rawText = interaction.fields.getTextInputValue(`embed_${i}`)?.trim();
                        if (!rawText) continue;

                        const lines = rawText.split('\n');
                        const title = lines[0].trim();
                        const description = lines.slice(1).join('\n').trim();

                        const embed = new EmbedBuilder()
                            .setTitle(title)
                            .setColor(colors[embeds.length % colors.length])
                            .setTimestamp();

                        if (description.length > 0) {
                            embed.setDescription(description);
                        }

                        embeds.push(embed);
                    }

                    if (embeds.length === 0) {
                        return await interaction.reply({
                            content: '❌ 請至少填寫一張 Embed 的內容喵！',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    // 加入 flags: [MessageFlags.Ephemeral] 確保只有自己看的到預覽
                    await interaction.reply({
                        content: '✨ **[僅你可見的預覽區域]** 請確認預覽內容，可繼續追加卡片，確認無誤後點擊「🚀 發送到頻道」：',
                        embeds,
                        components: [createControlButtons(embeds.length)],
                        flags: [MessageFlags.Ephemeral]
                    });
                } catch (error) {
                    console.error('處理初始 Embed Modal 出錯:', error);
                }
            }

            // B. 第二批追加 1~5 張 Modal 提交
            if (interaction.customId === 'modal_add_multi_embed') {
                try {
                    const existingEmbeds = interaction.message.embeds.map(e => EmbedBuilder.from(e));
                    const newEmbeds = [];

                    for (let i = 1; i <= 5; i++) {
                        try {
                            const rawText = interaction.fields.getTextInputValue(`add_embed_${i}`)?.trim();
                            if (!rawText) continue;

                            const lines = rawText.split('\n');
                            const title = lines[0].trim();
                            const description = lines.slice(1).join('\n').trim();

                            const embed = new EmbedBuilder()
                                .setTitle(title)
                                .setColor(colors[(existingEmbeds.length + newEmbeds.length) % colors.length])
                                .setTimestamp();

                            if (description.length > 0) {
                                embed.setDescription(description);
                            }

                            newEmbeds.push(embed);
                        } catch (e) {
                            break;
                        }
                    }

                    if (newEmbeds.length === 0) {
                        return await interaction.reply({
                            content: '❌ 你沒有輸入任何追加內容喵！',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const finalEmbeds = [...existingEmbeds, ...newEmbeds];

                    await interaction.update({
                        content: '✨ **[僅你可見的預覽區域]** 請確認預覽內容，可繼續追加卡片，確認無誤後點擊「🚀 發送到頻道」：',
                        embeds: finalEmbeds,
                        components: [createControlButtons(finalEmbeds.length)]
                    });
                } catch (error) {
                    console.error('追加 Embed 卡片出錯:', error);
                }
            }
        }
    },
};