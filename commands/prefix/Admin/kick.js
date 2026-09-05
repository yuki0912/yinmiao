const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'kick',
    aliases: ['踢人', '踢出'],
    category: 'Admin',
    description: '將指定的成員踢出伺服器喵！',
    permissions: [PermissionFlagsBits.KickMembers], // 🚩 權限限制

    // 🌟 核心：統一參數順序 (message, args, client)
    async execute(message, args, client) {
        // 1. 取得目標成員
        const target = message.mentions.members.first() || message.guild.members.cache.get(args[0]);

        // 2. 檢查是否有標記對象
        if (!target) {
            return message.reply('💡 請標記一位成員，或輸入他們的 ID 喵！').catch(() => null);
        }

        // 3. 檢查權限順序 (防止踢掉比自己高等的人)
        if (!target.kickable) {
            return message.reply('❌ 銀喵踢不動這個人喵... 他的職位可能比我高，或是我的權限不夠。').catch(() => null);
        }

        try {
            // 取得理由 (選填)
            const reason = args.slice(1).join(" ") || "未提供理由";

            // 4. 執行踢出
            await target.kick(reason);

            // 5. 發送回饋訊息
            const res = await message.channel.send(`👢 **已成功將 ${target.user.tag} 踢出喵！**\n理由：\`${reason}\``);
            
            // 5 秒後刪除回饋訊息，保持頻道整潔
            setTimeout(() => res.delete().catch(() => null), 5000);

        } catch (error) {
            console.error('[Kick Command Error]:', error);
            message.reply('❌ 踢人時發生預料之外的錯誤，請檢查後台 Log 喵。').catch(() => null);
        }
    },
};
