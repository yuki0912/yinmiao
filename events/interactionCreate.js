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
    return [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('embed:add:' + channelId)
            .setLabel(count >= 10 ? '已達 10 張上限' : '➕ 追加卡片（還可加 ' + (10 - count) + ' 張）')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(count >= 10),
        new ButtonBuilder()
            .setCustomId('embed:send:' + channelId)
            .setLabel('🚀 發送到頻道')
            .setStyle(ButtonStyle.Success)
    )];
}

function validateUrl(value, label) {
    if (!value) return undefined;
    let parsed;
    try { parsed = new URL(value.trim()); }
    catch { throw new Error(label + '網址格式不正確。'); }
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(label + '必須使用 http:// 或 https://。');
    return parsed.href;
}

function applyUserFooter(embed, interaction) {
    const displayName = interaction.member?.displayName || interaction.user.globalName || interaction.user.username;
    embed.setFooter({
        text: displayName,
        iconURL: interaction.user.displayAvatarURL({ size: 256 })
    });
}

function getEmbedTextLength(embed) {
    const data = embed.toJSON();
    const parts = [data.title, data.description, data.author?.name, data.footer?.text];
    for (const field of data.fields || []) parts.push(field.name, field.value);
    return parts.reduce((total, value) => total + (typeof value === 'string' ? value.length : 0), 0);
}

function getEmbedFromModal(fields, index, interaction) {
    const read = id => fields.getTextInputValue(id).trim();
    const embed = new EmbedBuilder();
    const title = read('card_title');
    const description = read('card_description');
    const color = read('card_color');
    const image = validateUrl(read('card_image'), 'Image');
    const advanced = read('card_advanced');

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (color) {
        if (!/^#[0-9A-F]{6}$/i.test(color)) throw new Error('Color 請使用六位色碼，例如 #0099ff。');
        embed.setColor(color);
    }

    const settings = { fields: [] };
    for (const line of advanced.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const splitAt = line.indexOf(':');
        if (splitAt < 1) throw new Error('進階設定每行請使用「項目: 內容」格式。');
        const key = line.slice(0, splitAt).trim().toLowerCase();
        const value = line.slice(splitAt + 1).trim();

        if (key === 'url') settings.url = value;
        else if (key === 'author') settings.author = value;
        else if (key === 'author icon') settings.authorIcon = value;
        else if (key === 'author url') settings.authorUrl = value;
        else if (key === 'thumbnail') settings.thumbnail = value;
        else if (key === 'timestamp') settings.timestamp = value.toLowerCase();
        else if (key === 'footer' || key === 'footer icon') {
            throw new Error('Footer 已自動顯示執行指令的使用者名稱和頭像，請移除 Footer 設定。');
        }
        else if (key === 'field') settings.fields.push(value);
        else throw new Error('不認識的進階設定項目：「' + key + '」。');
    }

    const url = validateUrl(settings.url, 'URL');
    if (url) embed.setURL(url);
    if (settings.author) {
        const author = { name: settings.author };
        const iconURL = validateUrl(settings.authorIcon, 'Author Icon');
        const authorURL = validateUrl(settings.authorUrl, 'Author URL');
        if (iconURL) author.iconURL = iconURL;
        if (authorURL) author.url = authorURL;
        embed.setAuthor(author);
    } else if (settings.authorIcon || settings.authorUrl) {
        throw new Error('填寫 Author Icon 或 Author URL 時，也必須填寫 Author。');
    }

    const thumbnail = validateUrl(settings.thumbnail, 'Thumbnail');
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (image) embed.setImage(image);
    if (settings.timestamp === 'true' || settings.timestamp === 'yes') embed.setTimestamp();
    else if (settings.timestamp && settings.timestamp !== 'false' && settings.timestamp !== 'no') {
        const date = new Date(settings.timestamp);
        if (Number.isNaN(date.getTime())) throw new Error('Timestamp 請填 true、false 或有效日期。');
        embed.setTimestamp(date);
    }

    if (settings.fields.length) {
        if (settings.fields.length > 25) throw new Error('每張卡片最多 25 個 Fields。');
        embed.addFields(settings.fields.map((field, fieldIndex) => {
            const parts = field.split('|').map(part => part.trim());
            if (parts.length < 2 || !parts[0] || !parts[1]) {
                throw new Error('Field ' + (fieldIndex + 1) + ' 格式為：名稱 | 內容 | inline。');
            }
            const inline = (parts[2] || '').toLowerCase();
            if (inline && !['true', 'false', 'yes', 'no'].includes(inline)) {
                throw new Error('Field ' + (fieldIndex + 1) + ' 的 inline 請填 true 或 false。');
            }
            return { name: parts[0], value: parts[1], inline: inline === 'true' || inline === 'yes' };
        }));
    }

    applyUserFooter(embed, interaction);

    const data = embed.toJSON();
    if (![data.title, data.description, data.author, data.thumbnail, data.image, data.footer, ...(data.fields || [])].some(Boolean)) {
        throw new Error('第 ' + (index + 1) + ' 張卡片沒有可顯示的內容。');
    }
    return embed;
}

async function fetchSendableChannel(guild, channelId) {
    if (!guild) throw new Error('無法取得伺服器資料，請重新使用 /embed。');
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased() || channel.guildId !== guild.id) throw new Error('找不到原本設定的目標文字頻道。');

    const botMember = guild.members.me || await guild.members.fetchMe().catch(() => null);
    const permissions = botMember && channel.permissionsFor(botMember);
    const sendPermission = typeof channel.isThread === 'function' && channel.isThread()
        ? PermissionFlagsBits.SendMessagesInThreads
        : PermissionFlagsBits.SendMessages;

    if (!permissions || !permissions.has([PermissionFlagsBits.ViewChannel, sendPermission, PermissionFlagsBits.EmbedLinks])) {
        throw new Error('銀喵缺少查看頻道、發送訊息或嵌入連結權限。');
    }
    return channel;
}

function addCardModal(channelId, currentCount) {
    const modal = new ModalBuilder()
        .setCustomId('embed:modal:' + channelId)
        .setTitle('追加 Embed 卡片（目前 ' + currentCount + '/10 張）');

    const inputs = [
        ['card_title', 'Title（標題）', TextInputStyle.Short, false],
        ['card_description', 'Description（內文）', TextInputStyle.Paragraph, false],
        ['card_color', 'Color（例如 #0099ff）', TextInputStyle.Short, false],
        ['card_image', 'Image URL（大圖網址）', TextInputStyle.Short, false],
        ['card_advanced', '其他設定（見欄位說明）', TextInputStyle.Paragraph, false]
    ];

    for (const [id, label, style, required] of inputs) {
        const input = new TextInputBuilder()
            .setCustomId(id)
            .setLabel(label)
            .setStyle(style)
            .setRequired(required)
            .setMaxLength(style === TextInputStyle.Paragraph ? 4000 : 2000);
        if (id === 'card_advanced') {
            input.setPlaceholder('Author: 銀喵\\nThumbnail: https://...\\nTimestamp: true\\nField: 名稱 | 內容 | true\\nFooter 自動顯示你的名稱和頭像');
        }
        modal.addComponents(new ActionRowBuilder().addComponents(input));
    }
    return modal;
}

module.exports = {
    name: Events.InteractionCreate,

    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.slashCommands.get(interaction.commandName);
            if (!command) return;
            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error('執行指令 ' + interaction.commandName + ' 出錯:', error);
                if (error.code === 10062 || error.code === 10008) return;
                const response = { content: '❌ 執行指令時出錯，請稍後再試。', flags: [MessageFlags.Ephemeral] };
                if (interaction.replied || interaction.deferred) await interaction.followUp(response).catch(() => null);
                else await interaction.reply(response).catch(() => null);
            }
            return;
        }

        if (interaction.isButton()) {
            if (interaction.customId === 'verify_rules') {
                try {
                    const config = await GuildConfig.findOne({ guildId: interaction.guildId });
                    if (!config || !config.rulesRoleId) return interaction.reply({ content: '❌ 伺服器尚未設定認證身份組，請聯絡管理員喵！', flags: [MessageFlags.Ephemeral] });
                    const role = interaction.guild.roles.cache.get(config.rulesRoleId);
                    if (!role) return interaction.reply({ content: '❌ 找不到設定的身份組，可能已被刪除喵！', flags: [MessageFlags.Ephemeral] });
                    if (interaction.member.roles.cache.has(role.id)) return interaction.reply({ content: '喵？你已經擁有 ' + role.name + ' 身份組了喔！', flags: [MessageFlags.Ephemeral] });
                    await interaction.member.roles.add(role);
                    await interaction.reply({ content: '✅ 認證成功！你已獲得 **' + role.name + '** 身份組。', flags: [MessageFlags.Ephemeral] });
                } catch (error) {
                    console.error('處理規則按鈕出錯:', error);
                    await interaction.reply({ content: '❌ 給予身份組時發生錯誤，請檢查機器人權限階級喵！', flags: [MessageFlags.Ephemeral] }).catch(() => null);
                }
                return;
            }

            if (interaction.customId.startsWith('embed:add:')) {
                const channelId = interaction.customId.slice('embed:add:'.length);
                const count = interaction.message?.embeds?.length || 0;
                if (!count || count >= 10) return interaction.reply({ content: '❌ 找不到有效預覽，或已達 10 張上限。', flags: [MessageFlags.Ephemeral] });
                return interaction.showModal(addCardModal(channelId, count));
            }

            if (interaction.customId.startsWith('embed:send:')) {
                const channelId = interaction.customId.slice('embed:send:'.length);
                const previewEmbeds = interaction.message?.embeds || [];
                if (!previewEmbeds.length) return interaction.reply({ content: '❌ 找不到 Embed 預覽，請重新使用 /embed。', flags: [MessageFlags.Ephemeral] });

                await interaction.deferUpdate();
                try {
                    const channel = await fetchSendableChannel(interaction.guild, channelId);
                    const embeds = previewEmbeds.map(item => EmbedBuilder.from(item));
                    const total = embeds.reduce((sum, embed) => sum + getEmbedTextLength(embed), 0);
                    if (embeds.length > 10 || total > 6000) throw new Error('卡片數量或文字總長度超過 Discord 限制。');
                    await channel.send({ embeds });
                    await interaction.editReply({ content: '✅ 已成功將 ' + embeds.length + ' 張 Embed 卡片發送至 ' + channel + '！', embeds: [], components: [] });
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

        if (interaction.isModalSubmit() && interaction.customId.startsWith('embed:modal:')) {
            const channelId = interaction.customId.slice('embed:modal:'.length);
            const existing = (interaction.message?.embeds || []).map(item => EmbedBuilder.from(item));
            if (!existing.length) return interaction.reply({ content: '❌ 這份 Embed 預覽已失效，請重新使用 /embed。', flags: [MessageFlags.Ephemeral] });

            try {
                const added = getEmbedFromModal(interaction.fields, existing.length, interaction);
                const finalEmbeds = [...existing, added];
                const total = finalEmbeds.reduce((sum, embed) => sum + getEmbedTextLength(embed), 0);
                if (finalEmbeds.length > 10) throw new Error('單次訊息最多只能包含 10 張 Embed。');
                if (total > 6000) throw new Error('所有卡片的文字總長度超過 Discord 的 6000 字元限制。');

                await interaction.update({
                    content: '✨ **Embed 卡片預覽**\n目前 ' + finalEmbeds.length + '/10 張。可繼續追加卡片，確認外觀後再發送到指定頻道。',
                    embeds: finalEmbeds,
                    components: createEmbedControls(channelId, finalEmbeds.length)
                });
            } catch (error) {
                console.error('追加 Embed 卡片失敗:', error);
                await interaction.reply({ content: '❌ ' + (error.message || '追加卡片時發生錯誤。'), flags: [MessageFlags.Ephemeral] }).catch(() => null);
            }
        }
    }
};