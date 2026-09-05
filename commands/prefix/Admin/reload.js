const { PermissionFlagsBits } = require('discord.js');
const path = require('node:path');
const fs = require('node:fs');

module.exports = {
    name: 'reload',
    aliases: ['重載', 'rl'],
    category: 'Admin',
    description: '重新載入指定或所有指令 (管理員專用)',
    permissions: [PermissionFlagsBits.Administrator],

    // 🌟 核心修正：參數順序改為 (message, args, client)
    async execute(message, args, client) {
        // 確保 message 存在且有 reply 功能
        if (!message || typeof message.reply !== 'function') {
            console.error("❌ 指令參數錯誤：第一個參數不是有效的 Message 物件。");
            return;
        }

        const commandName = args[0]?.toLowerCase();

        if (!commandName) {
            return message.reply('❌ 請輸入要重載的指令名稱，或輸入 `all` 重載全部喵。').catch(() => null);
        }

        // 定義指令根目錄 (根據你的專案結構調整)
        const prefixPath = path.join(__dirname, '../../prefix');

        try {
            // --- 🔄 模式 A：重載全部 ---
            if (commandName === 'all') {
                const folders = fs.readdirSync(prefixPath);
                
                for (const folder of folders) {
                    const folderPath = path.join(prefixPath, folder);
                    if (fs.lstatSync(folderPath).isDirectory()) {
                        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
                        for (const file of files) {
                            const fullPath = path.join(folderPath, file);
                            if (require.cache[require.resolve(fullPath)]) {
                                delete require.cache[require.resolve(fullPath)];
                            }
                            const newCmd = require(fullPath);
                            if (newCmd.name) client.prefixCommands.set(newCmd.name, newCmd);
                        }
                    }
                }
                return message.reply('✅ 所有 **Prefix 指令** 已重新載入喵！').catch(() => null);
            }

            // --- 🎯 模式 B：重載單一指令 ---
            const command = client.prefixCommands.get(commandName) || 
                            client.prefixCommands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

            if (!command) return message.reply(`❌ 找不到指令 \`${commandName}\` 喵。`).catch(() => null);

            // 尋找檔案路徑
            let filePath = null;
            const folders = fs.readdirSync(prefixPath);
            for (const folder of folders) {
                const potentialPath = path.join(prefixPath, folder, `${command.name}.js`);
                if (fs.existsSync(potentialPath)) {
                    filePath = potentialPath;
                    break;
                }
            }

            if (!filePath) return message.reply(`❌ 找不到 \`${command.name}.js\` 的實體檔案。`).catch(() => null);

            // 清除緩存並重載
            delete require.cache[require.resolve(filePath)];
            const reloadedCmd = require(filePath);
            client.prefixCommands.set(reloadedCmd.name, reloadedCmd);

            message.reply(`✅ 指令 \`${reloadedCmd.name}\` 已成功重載喵！`).catch(() => null);

        } catch (error) {
            console.error('[Reload Error]:', error);
            message.reply(`❌ 重載失敗：\`${error.message}\``).catch(() => null);
        }
    },
};
