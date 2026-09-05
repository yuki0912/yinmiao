const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const GuildConfig = require('../../../models/GuildConfig'); // 🐾 請根據您的專案目錄結構微調路徑

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('setup-voice')
        .setDescription('🛠️ 【管理員專用】設定動態語音母頻道與生成規則')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // 🟢 限制只有管理員能看到/執行此指令
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('請選擇要做為自動創房母體的語音頻道喵！')
                .setRequired(true)
                .addChannelTypes(ChannelType.GuildVoice) // 限制只能選純語音頻道
        )
        .addStringOption(option =>
            option.setName('name')
                .setDescription('自訂生成的包廂名稱（前方會自動補上 🐾｜，預設為：專屬包廂）')
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName('limit')
                .setDescription('包廂人數限制（0~99，預設 0 為不限制人數喵）')
                .setRequired(false)
                .setMinValue(0)
                .setMaxValue(99)
        ),

    async execute(interaction) {
        const { guild, options } = interaction;
        const targetChannel = options.getChannel('channel');
        
        // 獲取選填的設定值，如果沒填就給予預設值
        const voiceName = options.getString('name')
        const userLimit = options.getInteger('limit') ?? 0;

        // 使用新版 MessageFlags 回應隱私訊息
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            // 1. 先獲取該伺服器目前的資料庫設定
            let config = await GuildConfig.findOne({ guildId: guild.id });
            
            if (!config) {
                config = new GuildConfig({ guildId: guild.id, voiceSettings: [] });
            }

            // 確保 voiceSettings 欄位一定是陣列
            if (!config.voiceSettings || !Array.isArray(config.voiceSettings)) {
                config.voiceSettings = [];
            }

            // 2. 檢查這次設定的母頻道是否已經存在於現有的動態語音陣列中
            const existingIndex = config.voiceSettings.findIndex(s => s.voiceGeneratorId === targetChannel.id);
            
            if (existingIndex > -1) {
                // 🔄 如果存在，代表是「更新」該頻道的規則
                config.voiceSettings[existingIndex].voiceNameTemplate = voiceName;
                config.voiceSettings[existingIndex].voiceUserLimit = userLimit;
            } else {
                // ➕ 如果不存在，代表是「新增」一個新的動態語音母頻道
                config.voiceSettings.push({
                    voiceGeneratorId: targetChannel.id,
                    voiceNameTemplate: voiceName,
                    voiceUserLimit: userLimit
                });
            }

            // 3. 完美同步回資料庫，並強制剔除舊版 Legacy 欄位，防止跟網頁後台打架！
            await GuildConfig.findOneAndUpdate(
                { guildId: guild.id },
                { 
                    $set: { voiceSettings: config.voiceSettings },
                    $unset: { voiceGeneratorId: 1, voiceNameTemplate: 1, voiceUserLimit: 1 } // 清除舊版單一欄位殘留
                },
                { upsert: true, new: true }
            );

            return interaction.editReply({
                content: `✅ **動態語音設定成功！(已同步至網頁控制台)**\n` +
                         `📍 **母頻道**：${targetChannel} (\`${targetChannel.id}\`)\n` +
                         `✍️ **自訂名稱**：🐾｜${voiceName}\n` +
                         `👥 **人數限制**：${userLimit === 0 ? '無限制' : `${userLimit} 人`}\n\n` +
                         `喵！此指令已成功對接新版多頻道架構。現在成員點擊該頻道，系統就會自動按照新規則建立包廂囉！`
            });
        } catch (error) {
            console.error('[語音指令錯誤] ❌ 無法更新母頻道設定至資料庫:', error);
            return interaction.editReply({
                content: '❌ 設定失敗！寫入資料庫時發生異常，請確認資料庫連線或查看控制台錯誤喵。'
            });
        }
    }
};
