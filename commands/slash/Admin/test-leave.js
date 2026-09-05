const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig');
const welcomeEvent = require('../../../events/guildMemberRemove'); 

module.exports = {
    category: "Admin",
    // isNew: true, // 如果你想手動強制標記為 NEW，可以解開這行；否則系統會按檔案日期自動判斷
    data: new SlashCommandBuilder()
        .setName('test-leave')
        .setDescription('🛠️ 預覽歡迎訊息效果 (測試當前 Canvas 與內容配置)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option => 
            option.setName('target')
                .setDescription('要模擬的成員 (預設為你自己)')),

    async execute(interaction) {
        // 使用新版的 MessageFlags.Ephemeral
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const user = interaction.options.getUser('target') || interaction.user;
            // 確保成員資料最新
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                return await interaction.editReply({ content: "❌ 找不到該成員喵！" });
            }

            const config = await GuildConfig.findOne({ guildId: interaction.guild.id });
            
            // 🟢 同步 guildMemberAdd.js 的頻道判定邏輯 (如果有設定就用設定，沒有就找系統預設頻道)
            const targetChannel = interaction.guild.channels.cache.get(config?.leaveChannelId) || interaction.guild.systemChannel;

            if (!targetChannel) {
                return await interaction.editReply({
                    content: `❌ **測試失敗**：妳還沒在控制台設定歡迎頻道，且此伺服器也沒有內建的「系統公告頻道」供銀喵發送喵！`
                });
            }

            // 執行歡迎事件 (它會自己去讀取我們剛剛寫好的 sendCanvas 開關邏輯喔！)
            await welcomeEvent.execute(member);

            await interaction.editReply({
                content: `✅ **測試發送成功喵！**\n🔹 模擬對象：${user.tag}\n🔹 發送頻道：<#${targetChannel.id}>\n💡 *提示：發送效果會根據網頁控制台是否啟用 Canvas / Embed 呈現。*`
            });

        } catch (error) {
            console.error('Welcome Test Error:', error);
            await interaction.editReply({
                content: `💥 **出錯了喵！** \`\`\`${error.message}\`\`\``
            });
        }
    },
};
