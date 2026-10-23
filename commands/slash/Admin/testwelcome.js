const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const welcomeEvent = require('../../../events/guildMemberAdd');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('testwelcome')
        .setDescription('🛠️ 測試目前設定的歡迎訊息（會實際發送至歡迎頻道）')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('target')
                .setDescription('要模擬的成員（預設為你自己）')
        ),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            if (!interaction.guild || !interaction.guildId) {
                return await interaction.editReply({
                    content: '❌ 此指令只能在 Discord 伺服器內使用喵！'
                });
            }

            const user = interaction.options.getUser('target') || interaction.user;
            const member = await interaction.guild.members.fetch(user.id).catch(() => null);

            if (!member) {
                return await interaction.editReply({
                    content: '❌ 找不到這位伺服器成員，請確認對方仍在伺服器內喵！'
                });
            }

            if (typeof welcomeEvent.sendWelcomeMessage !== 'function') {
                throw new Error('歡迎事件尚未載入共用發送函式，請確認程式版本並重新部署。');
            }

            // 直接呼叫實際發送函式；若頻道、權限或訊息發送失敗，會進入 catch，不會誤報成功。
            const result = await welcomeEvent.sendWelcomeMessage(member);

            if (!result?.success || !result.channelId) {
                throw new Error('發送函式沒有回傳成功結果，請查看機器人主控台日誌。');
            }

            const messageLink = result.messageId
                ? `https://discord.com/channels/${interaction.guildId}/${result.channelId}/${result.messageId}`
                : null;

            const lines = [
                '✅ **歡迎訊息測試發送成功喵！**',
                `🔹 模擬對象：${user.tag || user.username}`,
                `🔹 實際發送頻道：<#${result.channelId}>`
            ];

            if (messageLink) {
                lines.push(`🔗 [查看已發送的訊息](${messageLink})`);
            }

            lines.push('💡 這次測試會真的在歡迎頻道發送訊息，不只是私密預覽。');

            await interaction.editReply({ content: lines.join('\n') });
        } catch (error) {
            console.error('❌ Welcome Test Error:', error);

            const reason = String(error?.message || error || '未知錯誤').slice(0, 1200);
            await interaction.editReply({
                content: `❌ **歡迎訊息測試失敗喵！**\n原因：${reason}\n\n請確認歡迎頻道設定、機器人頻道權限，並查看主控台日誌。`
            }).catch(replyError => {
                console.error('回覆 Welcome Test 錯誤時再次失敗:', replyError);
            });
        }
    }
};
