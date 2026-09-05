const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'clear',
    aliases: ['purge', '清除', '🧹'],
    category: 'Admin',
    description: '清理訊息 (管理員專用)',
    permissions: [PermissionFlagsBits.ManageMessages],

    // 🌟 重點：參數順序一定要是 (message, args, client)
    async execute(message, args, client) {
        const amount = parseInt(args[0]);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            // 使用 try-catch 確保訊息還在才刪除
            const reply = await message.reply('❌ 請輸入要清除的訊息數量 (1-100) 喵。').catch(() => null);
            if (reply) setTimeout(() => reply.delete().catch(() => null), 3000);
            return;
        }

        try {
            // 🌟 修正點：先刪除訊息，再回報結果
            // 注意：為了避免 Unknown Message 報錯，我們不要在刪除後回覆(reply)
            // 而是直接在頻道發送(send)
            
            // 先嘗試刪除使用者的指令訊息
            await message.delete().catch(() => null);

            const deleted = await message.channel.bulkDelete(amount, true);

            const res = await message.channel.send(`🧹 **銀喵已成功清理 ${deleted.size} 則訊息喵！**`);
            setTimeout(() => res.delete().catch(() => null), 5000);

        } catch (error) {
            console.error('[Clear Command Error]:', error);
            // 發生錯誤時，用 send 而不是 reply，防止訊息已被刪除導致的報錯
            message.channel.send('❌ 清理失敗喵。可能原因：我缺少權限，或是訊息超過 14 天喵。')
                .then(msg => setTimeout(() => msg.delete().catch(() => null), 5000))
                .catch(() => null);
        }
    },
};
