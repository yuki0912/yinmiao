const {
    Events,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits
} = require('discord.js');
const GuildConfig = require('../models/GuildConfig');

function createEmbedControls(channelId, count) {
    return [
        new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('embed:add:' + channelId)
                .setLabel(count >= 10 ? '已達 10 張上限' : '➕ 追加卡片（還可加 ' + (10 - count) + ' 張）')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(count >= 10),
            new ButtonBuilder()
                .setCustomId('embed:send:' + channelId)
                .setLabel('🚀 發送到頻道')
                .setStyle(ButtonStyle.Success)
        )
    ];
}

function validateHttpUrl(value, label) {
    if (value === undefined || value === null || value === '') return undefined;
    if (typeof value !== 'string') throw new Error(label + '必須是網址字串。');

    let parsed;
    try {
        parsed = new URL(value.trim());
    } catch {
        throw new Error(label + '網址格式不正確。');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(label + '網址必須使用 http:// 或 https://。');
    }

    return parsed.href;
}

function getEmbedTextLength(embed) {
    const data = embed.toJSON();
    const parts = [data.title, data.description, data.author?.name, data.footer?.text];

    for (const field of data.fields || []) {
        parts.push(field.name, field.value);
    }

    return parts.reduce((total, value) => total + (typeof value === 'string' ? value.length : 0), 0);
}

function buildEmbedFromJson(rawText, index) {
    let data;
    try {
        data = JSON.parse(rawText);
    } catch {
        throw new Error('JSON 格式錯誤。請使用雙引號，並確認逗號及大括號正確。');
    }

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Embed 設定必須是一個 JSON 物件。');
    }

    const embed = new EmbedBuilder();

    try {
        if (data.color !== undefined) embed.setColor(data.color);

        if (data.title !== undefined) {
            if (typeof data.title !== 'string' || data.title.length > 256) {
                throw new Error('title 最多 256 個字元，而且必須是文字。');
            }
            embed.setTitle(data.title);
        }

        if (data.url !== undefined) {
            const url = validateHttpUrl(data.url, 'title 的 url');
            if (url) embed.setURL(url);
        }

        if (data.author !== undefined) {
            if (!data.author || typeof data.author !== 'object' || Array.isArray(data.author)) {
                throw new Error('author 必須是物件。');
            }

            const author = data.author;
            if (typeof author.name !== 'string' || !author.name.trim()) {
                throw new Error('author.name 為必填文字。');
            }
            if (author.name.length > 256) throw new Error('author.name 最多 256 個字元。');

            const authorData = { name: author.name };
            const authorIcon = validateHttpUrl(author.icon_url || author.iconURL, 'author.icon_url');
            const authorUrl = validateHttpUrl(author.url, 'author.url');
            if (authorIcon) authorData.iconURL = authorIcon;
            if (authorUrl) authorData.url = authorUrl;
            embed.setAuthor(authorData);
        }

        if (data.description !== undefined) {
            if (typeof data.description !== 'string' || data.description.length > 4096) {
                throw new Error('description 最多 4096 個字元，而且必須是文字。');
            }
            embed.setDescription(data.description);
        }

        if (data.thumbnail !== undefined) {
            if (!data.thumbnail || typeof data.thumbnail !== 'object') {
                throw new Error('thumbnail 必須是包含 url 的物件。');
            }
            const url = validateHttpUrl(data.thumbnail.url, 'thumbnail.url');
            if (url) embed.setThumbnail(url);
        }

        if (data.fields !== undefined) {
            if (!Array.isArray(data.fields) || data.fields.length > 25) {
                throw new Error('fields 必須是陣列，而且最多 25 個欄位。');
            }

            const fields = data.fields.map((field, fieldIndex) => {
                if (!field || typeof field !== 'object' || Array.isArray(field)) {
                    throw new Error('fields 第 ' + (fieldIndex + 1) + ' 項必須是物件。');
                }
                if (typeof field.name !== 'string' || !field.name.length || field.name.length > 256) {
                    throw new Error('fields 第 ' + (fieldIndex + 1) + ' 項的 name 必須為 1 至 256 個字元。');
                }
                if (typeof field.value !== 'string' || !field.value.length || field.value.length > 1024) {
                    throw new Error('fields 第 ' + (fieldIndex + 1) + ' 項的 value 必須為 1 至 1024 個字元。');
                }
                if (field.inline !== undefined && typeof field.inline !== 'boolean') {
                    throw new Error('fields 第 ' + (fieldIndex + 1) + ' 項的 inline 必須是 true 或 false。');
                }

                return {
                    name: field.name,
                    value: field.value,
                    inline: field.inline === true
                };
            });

            if (fields.length) embed.addFields(fields);
        }

        if (data.image !== undefined) {
            if (!data.image || typeof data.image !== 'object') {
                throw new Error('image 必須是包含 url 的物件。');
            }
            const url = validateHttpUrl(data.image.url, 'image.url');
            if (url) embed.setImage(url);
        }

        if (data.timestamp !== undefined && data.timestamp !== false && data.timestamp !== null) {
            if (data.timestamp === true) {
                embed.setTimestamp();
            } else {
                const date = new Date(data.timestamp);
                if (Number.isNaN(date.getTime())) throw new Error('timestamp 必須是有效日期或 true。');
                embed.setTimestamp(date);
            }
        }

        if (data.footer !== undefined) {
            if (!data.footer || typeof data.footer !== 'object' || Array.isArray(data.footer)) {
                throw new Error('footer 必須是物件。');
            }
            if (typeof data.footer.text !== 'string' || !data.footer.text.length || data.footer.text.length > 2048) {
                throw new Error('footer.text 必須為 1 至 2048 個字元。');
            }

            const footerData = { text: data.footer.text };
            const footerIcon = validateHttpUrl(data.footer.icon_url || data.footer.iconURL, 'footer.icon_url');
            if (footerIcon) footerData.iconURL = footerIcon;
            embed.setFooter(footerData);
        }
    } catch (error) {
        throw new Error('第 ' + (index + 1) + ' 張卡片：' + error.message);
    }

    const built = embed.toJSON();
    const hasVisibleContent = Boolean(
        built.title || built.description || built.author || built.thumbnail ||
        built.image || built.footer || (built.fields && built.fields.length)
    );

    if (!hasVisibleContent) {
        throw new Error('第 ' + (index + 1) + ' 張卡片沒有可顯示的內容，請至少設定 title、description、author、fields、image、thumbnail 或 footer。');
    }

    return embed;
}

async function fetchSendableChannel(guild, channelId) {
    if (!guild) throw new Error('無法取得伺服器資料，請重新使用 /embed。');

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.guildId !== guild.id) {
        throw new Error('找不到原本設定的目標文字頻道，請重新使用 /embed。');
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
        throw new Error('銀喵缺少查看頻道、發送訊息或嵌入連結權限。');
    }

    return channel;
}

function addCardModal(channelId, currentCount) {
    const inputCount = Math.min(5, 10 - currentCount);
    const modal = new ModalBuilder()
        .setCustomId('embed:modal:' + channelId)
        .setTitle('追加 Embed 卡片（目前 ' + currentCount + '/10 張）');

    for (let i = 1; i <= inputCount; i++) {
        const input = new TextInputBuilder()
            .setCustomId('embed_card_' + i)
            .setLabel('第 ' + (currentCount + i) + ' 張 Embed JSON')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('{"title":"標題","description":"內容","color":"#0099ff"}')
            .setMaxLength(4000)
            .setRequired(false);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }

    return modal;
}

async function replyWithPreview(interaction, channelId, embeds) {
    const totalTextLength = embeds.reduce((total, embed) => total + getEmbedTextLength(embed), 0);
    if (embeds.length > 10) throw new Error('單次訊息最多只能包含 10 張 Embed。');
    if (totalTextLength > 6000) throw new Error('所有卡片的文字總長度超過 Discord 的 6000 字元限制。');

    await interaction.reply({
        content: '✨ **Embed 卡片預覽**\n目前 ' + embeds.length + '/10 張。可追加卡片，確認外觀後再發送到指定頻道。',
        embeds,
        components: createEmbedControls(channelId, embeds.length),
        flags: [MessageFlags.Ephemeral]
    });
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        // 1. 斜線指令
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error('執行指令 ' + interaction.commandName + ' 出錯:', error);
                if (error.code === 10062 || error.code === 10008) return;

                const response = {
                    content: '❌ 執行指令時出錯，請稍後再試。',
                    flags: [MessageFlags.Ephemeral]
                };

                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(response).catch(() => null);
                } else {
                    await interaction.reply(response).catch(() => null);
                }
            }
            return;
        }

        // 2. 按鈕互動
        if (interaction.isButton()) {
            // A. 身份組認證
            if (interaction.customId === 'verify_rules') {
                try {
                    const config = await GuildConfig.findOne({ guildId: interaction.guildId });

                    if (!config || !config.rulesRoleId) {
                        return interaction.reply({
                            content: '❌ 伺服器尚未設定認證身份組，請聯絡管理員喵！',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    const role = interaction.guild.roles.cache.get(config.rulesRoleId);
                    if (!role) {
                        return interaction.reply({
                            content: '❌ 找不到設定的身份組，可能已被刪除喵！',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    if (interaction.member.roles.cache.has(role.id)) {
                        return interaction.reply({
                            content: '喵？你已經擁有 ' + role.name + ' 身份組了喔！',
                            flags: [MessageFlags.Ephemeral]
                        });
                    }

                    await interaction.member.roles.add(role);
                    await interaction.reply({
                        content: '✅ 認證成功！你已獲得 **' + role.name + '** 身份組。',
                        flags: [MessageFlags.Ephemeral]
                    });
                } catch (error) {
                    console.error('處理規則按鈕出錯:', error);
                    await interaction.reply({
                        content: '❌ 給予身份組時發生錯誤，請檢查機器人權限階級喵！',
                        flags: [MessageFlags.Ephemeral]
                    }).catch(() => null);
                }
                return;
            }

            // B. 追加卡片
            if (interaction.customId.startsWith('embed:add:')) {
                const channelId = interaction.customId.slice('embed:add:'.length);
                const currentCount = interaction.message?.embeds?.length || 0;

                if (!currentCount || currentCount >= 10) {
                    return interaction.reply({
                        content: currentCount ? '❌ 單次訊息最多只能包含 10 張 Embed 卡片喵！' : '❌ 找不到 Embed 預覽，請重新使用 /embed。',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                return interaction.showModal(addCardModal(channelId, currentCount));
            }

            // C. 確認並發送
            if (interaction.customId.startsWith('embed:send:')) {
                const channelId = interaction.customId.slice('embed:send:'.length);
                const previewEmbeds = interaction.message?.embeds || [];

                if (!previewEmbeds.length) {
                    return interaction.reply({
                        content: '❌ 找不到 Embed 預覽，請重新使用 /embed。',
                        flags: [MessageFlags.Ephemeral]
                    });
                }

                await interaction.deferUpdate();

                try {
                    const channel = await fetchSendableChannel(interaction.guild, channelId);
                    const embeds = previewEmbeds.map(item => EmbedBuilder.from(item));
                    const totalTextLength = embeds.reduce((total, embed) => total + getEmbedTextLength(embed), 0);

                    if (embeds.length > 10 || totalTextLength > 6000) {
                        throw new Error('卡片數量或文字總長度超過 Discord 限制。');
                    }

                    await channel.send({ embeds });

                    await interaction.editReply({
                        content: '✅ 已成功將 ' + embeds.length + ' 張 Embed 卡片發送至 ' + channel + '！',
                        embeds: [],
                        components: []
                    });
                } catch (error) {
                    console.error('發送 Embed 卡片失敗:', error);
                    await interaction.editReply({
                        content: '❌ 發送失敗：' + (error.message || '請檢查銀喵的頻道權限。') + '\n預覽內容已保留，你可以修正權限後再試。',
                        embeds: previewEmbeds,
                        components: createEmbedControls(channelId, previewEmbeds.length)
                    }).catch(() => null);
                }
                return;
            }
        }

        // 3. 初次建立 Embed 的 Modal 提交
        if (interaction.isModalSubmit() && interaction.customId.startsWith('embed:create:')) {
            const channelId = interaction.customId.slice('embed:create:'.length);

            try {
                const rawJson = interaction.fields.getTextInputValue('embed_json_1').trim();
                const embed = buildEmbedFromJson(rawJson, 0);
                await fetchSendableChannel(interaction.guild, channelId);
                await replyWithPreview(interaction, channelId, [embed]);
            } catch (error) {
                console.error('建立 Embed 卡片失敗:', error);
                await interaction.reply({
                    content: '❌ ' + (error.message || '建立 Embed 卡片時發生錯誤。') + '\n請檢查 JSON 格式後重新使用 /embed。',
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => null);
            }
            return;
        }

        // 4. 追加卡片的 Modal 提交
        if (interaction.isModalSubmit() && interaction.customId.startsWith('embed:modal:')) {
            const channelId = interaction.customId.slice('embed:modal:'.length);
            const existingEmbeds = (interaction.message?.embeds || []).map(item => EmbedBuilder.from(item));

            if (!existingEmbeds.length) {
                return interaction.reply({
                    content: '❌ 這份 Embed 預覽已經失效，請重新使用 /embed。',
                    flags: [MessageFlags.Ephemeral]
                });
            }

            try {
                const addedEmbeds = [];
                const inputCount = Math.min(5, 10 - existingEmbeds.length);

                for (let i = 1; i <= inputCount; i++) {
                    const rawJson = interaction.fields.getTextInputValue('embed_card_' + i).trim();
                    if (!rawJson) continue;
                    addedEmbeds.push(buildEmbedFromJson(rawJson, existingEmbeds.length + addedEmbeds.length));
                }

                if (!addedEmbeds.length) throw new Error('請至少填寫一張新卡片喵！');

                const finalEmbeds = [...existingEmbeds, ...addedEmbeds];
                const totalTextLength = finalEmbeds.reduce((total, embed) => total + getEmbedTextLength(embed), 0);

                if (finalEmbeds.length > 10) throw new Error('單次訊息最多只能包含 10 張 Embed。');
                if (totalTextLength > 6000) throw new Error('所有卡片的文字總長度超過 Discord 的 6000 字元限制，請減少部分文字。');

                await interaction.update({
                    content: '✨ **Embed 卡片預覽**\n目前 ' + finalEmbeds.length + '/10 張。可繼續追加卡片，確認外觀後再發送到指定頻道。',
                    embeds: finalEmbeds,
                    components: createEmbedControls(channelId, finalEmbeds.length)
                });
            } catch (error) {
                console.error('追加 Embed 卡片失敗:', error);
                await interaction.reply({
                    content: '❌ ' + (error.message || '追加卡片時發生錯誤，請檢查 JSON 設定。'),
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => null);
            }
        }
    }
};