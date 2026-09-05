const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('♻️ 重新載入斜線指令邏輯 (管理員專用)')
        .addStringOption(opt => opt.setName('command').setDescription('指令名稱 (或輸入 all)').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const commandName = interaction.options.getString('command').toLowerCase();

        // 1. 先告訴 Discord：我收到指令了，請給我一點時間處理 (解決 10062 超時錯誤)
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const slashPath = path.join(__dirname, '../../slash');

            if (commandName === 'all') {
                const folders = fs.readdirSync(slashPath);
                let count = 0;

                for (const folder of folders) {
                    const folderPath = path.join(slashPath, folder);
                    if (fs.lstatSync(folderPath).isDirectory()) {
                        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
                        for (const file of files) {
                            const filePath = path.join(folderPath, file);
                            
                            // 清除快取並重新要求檔案
                            delete require.cache[require.resolve(filePath)];
                            try {
                                const newCmd = require(filePath);
                                if (newCmd.data && newCmd.data.name) {
                                    client.slashCommands.set(newCmd.data.name, newCmd);
                                    count++;
                                }
                            } catch (e) {
                                console.error(`[Reload Error] 載入 ${file} 失敗: ${e.message}`);
                            }
                        }
                    }
                }
                // 2. 使用 editReply 進行最終回應
                return await interaction.editReply({ content: `✅ 所有 **Slash 指令** 邏輯已刷新！(共 ${count} 個)` });
            }

            // 單一指令刷新邏輯
            let commandPath;
            const folders = fs.readdirSync(slashPath);
            for (const folder of folders) {
                const checkPath = path.join(slashPath, folder, `${commandName}.js`);
                if (fs.existsSync(checkPath)) {
                    commandPath = checkPath;
                    break;
                }
            }

            if (!commandPath) {
                return await interaction.editReply({ content: `❌ 找不到或無法定位指令 \`${commandName}\` 的原始檔案。` });
            }

            // 執行重新載入
            delete require.cache[require.resolve(commandPath)];
            const reloadedCmd = require(commandPath);
            
            if (!reloadedCmd.data || !reloadedCmd.data.name) {
                throw new Error('該指令檔案格式不正確。');
            }

            client.slashCommands.set(reloadedCmd.data.name, reloadedCmd);

            await interaction.editReply({ content: `✅ 斜線指令 \`/${reloadedCmd.data.name}\` 邏輯已更新！` });

        } catch (error) {
            console.error(error);
            // 發生錯誤時也使用 editReply 告知使用者
            await interaction.editReply({ content: `❌ 重載過程中發生錯誤：\`${error.message}\`` });
        }
    }
};
