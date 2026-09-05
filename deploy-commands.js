require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
const slashCommandsPath = path.join(__dirname, 'commands', 'slash');

// 1. 讀取指令目錄
if (fs.existsSync(slashCommandsPath)) {
    const commandFolders = fs.readdirSync(slashCommandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(slashCommandsPath, folder);
        
        // 處理子資料夾 (Admin, General, Fun 等)
        if (fs.lstatSync(folderPath).isDirectory()) {
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const command = require(path.join(folderPath, file));
                if (command.data && command.execute) {
                    commands.push(command.data.toJSON());
                }
            }
        } 
        // 處理直接放在 slash 下的檔案
        else if (folder.endsWith('.js')) {
            const command = require(folderPath);
            if (command.data && command.execute) {
                commands.push(command.data.toJSON());
            }
        }
    }
}

// 2. 檢查必要變數
const clientId = process.env.CLIENT_ID;
const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID; // 讀取測試群 ID 用於環境清理

if (!clientId || !token) {
    console.error('❌ 錯誤：.env 中缺少 CLIENT_ID 或 DISCORD_TOKEN');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        if (commands.length === 0) {
            styleLog('⚠️ 警告：沒有發現任何指令檔案。', 'yellow');
            return;
        }

        // 🧹 步驟 A：防重疊清理機制
        if (guildId) {
            console.log(`🧹 偵測到 .env 中含有 GUILD_ID，正在清空該測試群 [${guildId}] 的舊指令以防衝突...`);
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
            console.log('✅ 測試群指令已成功清空！');
        }

        // 🚀 步驟 B：強制發布到全體群（全球全域）
        console.log(`\n🚀 正在同步 ${commands.length} 個指令至 「全球所有全體群群組」...`);
        
        // 👈 這裡死鎖全球路由，不論有沒有填 guildId 都不影響全球更新
        const globalRoute = Routes.applicationCommands(clientId); 
        await rest.put(globalRoute, { body: commands });

        console.log('===================================================');
        console.log('✅ 全球全體群指令註冊與更新完成喵！🐾');
        console.log('💡 銀喵小提示：全球指令分發需要一點點時間 (約 1 到 5 分鐘)。');
        console.log('   如果發現群組裡還沒看見新指令，請徹底關閉並重啟 Discord 應用程式刷新快取唷！');
        console.log('===================================================');

    } catch (error) {
        console.error('❌ 註冊失敗，請檢查權限或 token：', error);
    }
})();
