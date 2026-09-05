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
const GuildConfig = require('../../../models/GuildConfig');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('rule')
        .setDescription('📜 設定規則驗證 (支援發布新訊息或綁定舊訊息)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('target_channel')
                .setDescription('規則所在的頻道')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        )
        .addRoleOption(option =>
            option.setName('target_role')
                .setDescription('通過驗證後要給予的身分組')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('想要監聽的舊訊息 ID (若留空則會開啟彈窗建立新訊息)')
                .setRequired(false)
        ),

    async execute(interaction, client) {
        const targetChannel = interaction.options.getChannel('target_channel');
        const targetRole = interaction.options.getRole('target_role');
        const messageId = interaction.options.getString('message_id');

        // 檢查權限：機器人是否能在該頻道發話 & 做出反應
        const botPermissions = targetChannel.permissionsFor(client.user);
        if (!botPermissions.has([PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.EmbedLinks])) {
            return await interaction.reply({
                content: `❌ 銀喵在 ${targetChannel} 缺少必要權限（發送訊息、嵌入連結、添加反應）喵！`,
                ephemeral: true
            });
        }

        // --- 情況 A：手動綁定現有訊息 ---
        if (messageId) {
            try {
                const targetMsg = await targetChannel.messages.fetch(messageId);
                
                await GuildConfig.findOneAndUpdate(
                    { guildId: interaction.guildId },
                    { 
                        $set: { 
                            rulesChannelId: targetChannel.id,
                            rulesMessageId: targetMsg.id,
                            rulesRoleId: targetRole.id // 記得存入身分組 ID
                        } 
                    },
                    { upsert: true }
                );

                await targetMsg.react('✅');

                return await interaction.reply({
                    content: `✅ 已成功綁定現有訊息！\n📍 頻道：${targetChannel}\n🎭 身分組：${targetRole}\n🆔 訊息 ID：${messageId}\n💡 成員現在點擊該訊息的 ✅ 即可領取身份組。`,
                    ephemeral: true
                });
            } catch (err) {
                return await interaction.reply({
                    content: `❌ 找不到該訊息喵！請確認 ID 是否正確且該訊息位於 ${targetChannel}。`,
                    ephemeral: true
                });
            }
        }

        // --- 情況 B：開啟 Modal 建立新訊息 ---
        const modal = new ModalBuilder()
            .setCustomId(`rule_modal_${targetChannel.id}`)
            .setTitle('📜 設定伺服器規則');

        const titleInput = new TextInputBuilder()
            .setCustomId('rule_title')
            .setLabel('規範標題')
            .setPlaceholder('例如：🌸 萌萌伺服器守則')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const contentInput = new TextInputBuilder()
            .setCustomId('rule_content')
            .setLabel('詳細規範內容')
            .setPlaceholder('1. 請保持友善喵...\n2. 禁止洗頻喵...')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(titleInput),
            new ActionRowBuilder().addComponents(contentInput)
        );

        await interaction.showModal(modal);

        // 接收提交
        const filter = (i) => i.customId === `rule_modal_${targetChannel.id}` && i.user.id === interaction.user.id;
        
        try {
            const modalInt = await interaction.awaitModalSubmit({ filter, time: 600000 });
            const title = modalInt.fields.getTextInputValue('rule_title');
            const content = modalInt.fields.getTextInputValue('rule_content');

            // 存入資料庫
            const config = await GuildConfig.findOneAndUpdate(
                { guildId: interaction.guildId },
                { 
                    $set: { 
                        rulesChannelId: targetChannel.id,
                        rulesTitle: title,
                        rulesDescription: content,
                        rulesRoleId: targetRole.id
                    } 
                },
                { upsert: true, new: true }
            );

            const ruleEmbed = new EmbedBuilder()
                .setTitle(title)
                .setDescription(content)
                .setColor('#FFC8DD')
                .addFields({ name: '\u200B', value: `✨ 請點擊下方的 ✅ 反應來領取 **${targetRole.name}** 身份組喵！` })
                .setTimestamp()
                .setFooter({ 
                    text: `管理員：${interaction.user.username}`, 
                    iconURL: interaction.user.displayAvatarURL() 
                });

            const sentMsg = await targetChannel.send({ embeds: [ruleEmbed] });
            await sentMsg.react('✅');

            config.rulesMessageId = sentMsg.id;
            await config.save();

            await modalInt.reply({ 
                content: `✅ 規範已發布至 ${targetChannel}！\n🎭 驗證身分組：${targetRole}`, 
                ephemeral: true 
            });

        } catch (err) {
            // 處理超時或關閉視窗
            if (interaction.replied || interaction.deferred) return;
            console.error('規則發布出錯:', err);
        }
    }
};
