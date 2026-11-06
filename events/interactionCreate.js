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

const EMBED_COLORS = ['#FFB7C5', '#F43F5E', '#FB7185', '#F472B6', '#E879F9', '#38BDF8', '#34D399', '#FBBF24', '#A78BFA', '#14B8A6'];

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
    if (!value) return null;
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

function buildEmbedFromModal(rawText, index, guild, user) {
    const values = { title: '', description: [], color: '', image: '', thumbnail: '', footer: '', url: '' };
    const aliases = {
        '標題': 'title', 'title': 'title',
        '描述': 'description', '內文': 'description', 'description': 'description',
        '顏色': 'color', 'color': 'color',
        '圖片': 'image', '大圖': 'image', 'image': 'image',
        '縮圖': 'thumbnail', 'thumbnail': 'thumbnail',
        '頁尾': 'footer', 'footer': 'footer',
        '網址': 'url', '連結': 'url', 'url': 'url'
    };
    let currentField = 'description';

    for (const line of rawText.split(/\r?\n/)) {
        const match = line.match(/^\s*(標題|title|描述|內文|description|顏色|color|圖片|大圖|image|縮圖|thumbnail|頁尾|footer|網址|連結|url)\s*[：:]\s*(.*)$/i);
        if (match) {
            const field = aliases[match[1].toLowerCase()] || aliases[match[1]];
            currentField = field;
            if (field === 'description') {
                if (match[2]) values.description.push(match[2]);
            } else {
                values[field] = match[2].trim();
            }
        } else if (!values.title && line.trim()) {
            values.title = line.trim();
            currentField = 'description';
        } else if (currentField === 'description') {
            values.description.push(line);
        }
    }

    if (!values.title.trim()) throw new Error('第 ' + (index + 1) + ' 張卡片缺少標題。');
    if (values.title.length > 256) throw new Error('第 ' + (index + 1) + ' 張卡片標題最多 256 個字元。');

    const description = values.description.join('\n').trim();
    if (description.length > 4096) throw new Error('第 ' + (index + 1) + ' 張卡片內文最多 4096 個字元。');

    const color = values.color.trim() || EMBED_COLORS[index % EMBED_COLORS.length];
    if (!/^#[0-9A-F]{6}$/i.test(color)) throw new Error('第 ' + (index + 1) + ' 張卡片色碼格式錯誤，請使用 #F43F5E 格式。');

    const image = validateHttpUrl(values.image, '第 ' + (index + 1) + ' 張卡片圖片');
    const thumbnail = validateHttpUrl(values.thumbnail, '第 ' + (index + 1) + ' 張卡片縮圖');
    const url = validateHttpUrl(values.url, '第 ' + (index + 1) + ' 張卡片連結');

    const embed = new EmbedBuilder()
        .setAuthor({ name: guild.name, iconURL: guild.iconURL() || undefined })
        .setTitle(values.title.trim())
        .setColor(color)
        .setTimestamp()
        .setFooter({
            text: values.footer.trim() || '發送者：' + user.tag,
            iconURL: user.displayAvatarURL()
        });

    if (description) embed.setDescription(description);
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (url) embed.setURL(url);
    return embed;
}

function getEmbedTextLength(embed) {
    const data = embed.toJSON();
    const parts = [data.title, data.description, data.author?.name, data.footer?.text];
    for (const field of data.fields || []) parts.push(field.name, field.value);
    return parts.reduce((total, value) => total + (typeof value === 'string' ? value.length : 0), 0);
}

async function fetchSendableChannel(guild, channelId) {
    if (!guild) throw new Error('無法取得伺服器資料，請重新使用 /embed。');

    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.guildId !== guild.id) {
        throw new Error('找不到原本設定的目標文字頻道，請重新使用 /embed。');
    }

    const me = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const permissions = me && channel.permissionsFor(me);
    const required = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks
    ];

    if (!permissions || !permissions.has(required)) {
        throw new Error('銀喵缺少查看頻道、發送訊息或嵌入連結權限。');
    }
    return channel;
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

                const inputCount = Math.min(5, 10 - currentCount);
                const modal = new ModalBuilder()
                    .setCustomId('embed:modal:' + channelId)
                    .setTitle('追加 Embed 卡片（目前 ' + currentCount + '/10 張）');

                for (let i = 1; i <= inputCount; i++) {
                    const input = new TextInputBuilder()
                        .setCustomId('embed_card_' + i)
                        .setLabel('第 ' + (currentCount + i) + ' 張卡片設定')
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder('標題：活動公告\n描述：輸入卡片內容\n顏色：#F43F5E')
                        .setMaxLength(4000)
                        .setRequired(true);
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                }

                return interaction.showModal(modal);
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
                    const totalTextLength = embeds.reduce((total, item) => total + getEmbedTextLength(item), 0);

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

        // 3. 追加卡片表單提交
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
                    const rawText = interaction.fields.getTextInputValue('embed_card_' + i).trim();
                    if (!rawText) continue;
                    addedEmbeds.push(buildEmbedFromModal(
                        rawText,
                        existingEmbeds.length + addedEmbeds.length,
                        interaction.guild,
                        interaction.user
                    ));
                }

                if (!addedEmbeds.length) throw new Error('請至少填寫一張新卡片喵！');

                const finalEmbeds = [...existingEmbeds, ...addedEmbeds];
                const totalTextLength = finalEmbeds.reduce((total, item) => total + getEmbedTextLength(item), 0);
                if (totalTextLength > 6000) {
                    throw new Error('所有卡片的文字總長度超過 Discord 的 6000 字元限制，請減少部分文字。');
                }

                await interaction.update({
                    content: '✨ **Embed 卡片預覽**\n目前 ' + finalEmbeds.length + '/10 張。可以繼續追加，或按「發送到頻道」正式發布。',
                    embeds: finalEmbeds,
                    components: createEmbedControls(channelId, finalEmbeds.length)
                });
            } catch (error) {
                console.error('追加 Embed 卡片失敗:', error);
                await interaction.reply({
                    content: '❌ ' + (error.message || '追加卡片時發生錯誤，請檢查輸入內容。'),
                    flags: [MessageFlags.Ephemeral]
                }).catch(() => null);
            }
        }
    }
};