const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ChannelType } = require('discord.js');
const ReactionRole = require('../../../models/ReactionRole');

module.exports = {
    category: "Admin", 
    data: new SlashCommandBuilder()
        .setName('add-reaction-role')
        .setDescription('🔗 綁定反應身份組 (支援跨頻道)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        // 🚩 新增：選擇目標頻道
        .addChannelOption(opt => 
            opt.setName('target_channel')
                .setDescription('訊息所在的頻道')
                .addChannelTypes(ChannelType.GuildText) // 限制只能選擇文字頻道
                .setRequired(true)
        )
        .addStringOption(opt => opt.setName('message_id').setDescription('訊息 ID').setRequired(true))
        .addRoleOption(opt => opt.setName('role').setDescription('要給予的身分组').setRequired(true))
        .addStringOption(opt => opt.setName('emoji').setDescription('表情符號').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });
        
        const { options, guild } = interaction;
        // 🚩 獲取使用者選取的頻道，而非當前頻道
        const targetChannel = options.getChannel('target_channel');
        const messageId = options.getString('message_id');
        const role = options.getRole('role');
        const rawEmoji = options.getString('emoji');

        // 解析表情符號
        const customEmoji = rawEmoji.match(/<a?:.+:(\d+)>/);
        const emojiData = customEmoji ? customEmoji[1] : rawEmoji;

        try {
            // 1. 🚩 在「目標頻道」中尋找訊息
            const message = await targetChannel.messages.fetch(messageId);
            
            // 2. 機器人嘗試添加反應
            await message.react(emojiData);
            
            // 3. 儲存至 MongoDB
            await ReactionRole.findOneAndUpdate(
                { 
                    guildId: guild.id, 
                    messageId: messageId, 
                    emoji: emojiData 
                },
                { 
                    roleId: role.id,
                    channelId: targetChannel.id // 🚩 儲存目標頻道的 ID
                },
                { 
                    upsert: true, 
                    returnDocument: 'after' 
                }
            );

            await interaction.editReply({
                content: `✅ **反應身份組設定成功！**\n▫️ 目標頻道: <#${targetChannel.id}>\n▫️ 訊息 ID: \`${messageId}\`\n▫️ 表情: ${rawEmoji}\n▫️ 對應身份組: ${role.name}`
            });

        } catch (error) {
            console.error('Reaction Role Setup Error:', error);
            
            let errorMsg = '❌ **設定失敗**：\n';
            if (error.code === 10008) errorMsg += `1. 在 <#${targetChannel.id}> 找不到該訊息 ID。`;
            else if (error.code === 50013) errorMsg += '1. 機器人缺少該頻道的「查看訊息」或「添加反應」權限。';
            else errorMsg += `錯誤原因：\`${error.message}\``;

            await interaction.editReply({ content: errorMsg });
        }
    }
};