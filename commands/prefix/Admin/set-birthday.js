const { EmbedBuilder } = require('discord.js');
// 🐾 引入共用的日期驗證工具
const { parseAndValidateDate } = require('../../../utils/birthdayScheduler.js');
// 🐾 引入生日資料庫模型
const BirthdayModel = require('../../../models/Birthday.js');

module.exports = {
    name: 'set-birthday',
    description: '🐾 設定你的生日，讓銀喵在當天為你慶生！',
    category: 'Admin',
    aliases: ['setbirthday', 'sbday'], // 順便設定一些縮寫別名，方便使用者輸入喵
    
    async execute(message, args) {
        // 檢查使用者有沒有輸入參數（args[0] 就是第一個空格後面的文字）
        if (!args[0]) {
            return message.reply('❌ 喵！請告訴我你的生日，範例格式：`s!set-birthday 05/17` 或 `s!set-birthday 2000/05/17`');
        }
        
        const dateInput = args[0];
        // 🐾 呼叫方案 B 的工具箱進行驗證
        const validDate = parseAndValidateDate(dateInput);
        
        if (!validDate) {
            return message.reply('❌ 喵嗚！這份日期好像怪怪的？請使用 `MM/DD` 格式（如：05/17）再試一次！');
        }
        
        const userId = message.author.id;
        const guildId = message.guild.id;
        
        try {
            // 🐾 真正執行資料庫儲存邏輯（有資料就更新，沒資料就全新建立）
            await BirthdayModel.findOneAndUpdate(
                { guildId, userId },
                { birthday: validDate },
                { upsert: true, new: true }
            );

            // 前綴指令配上活潑的元氣橘色
            const embed = new EmbedBuilder()
                .setColor('#FF9E5E')
                .setTitle('🎂 傳統魔法・生日紀錄成功！')
                .setDescription(`收到！銀喵成功把 <@${userId}> 的生日刻在資料庫魔法陣上了！\n生日日期：**${validDate}** 🐾`)
                .setFooter({ text: '到時候記得上線吃蛋糕喵！' })
                .setTimestamp();
                
            await message.reply({ embeds: [embed] });

        } catch (error) {
            console.error('Prefix 儲存生日時發生錯誤喵：', error);
            await message.reply('❌ 喵嗚... 儲存生日時，資料庫的魔法能量好像有點不穩定，請等一下再試試看！');
        }
    },
};