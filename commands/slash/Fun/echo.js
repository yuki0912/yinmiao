const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // 定義指令內容
    category:"Fun",
    data: new SlashCommandBuilder()
        .setName('echo')
        .setDescription('讓機器人重複你說的話')
        .addStringOption(option => 
            option.setName('input')      // 參數名稱
                .setDescription('你要機器人說什麼？') // 參數說明
                .setRequired(true)      // 是否為必填
        ),
    
    // 執行邏輯
    async execute(interaction) {
        // 從互動中取得使用者輸入的字串
        const message = interaction.options.getString('input');
        
        // 回覆使用者
        await interaction.reply(`你說了：${message}`);
    },
};
