const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'ban',
    aliases: ['封鎖', 'hammer'],
    category: 'Admin',
    description: '永久封鎖成員 (管理員專用)',
    permissions: [PermissionFlagsBits.BanMembers],

    // 🌟 核心修正：參數順序必須是 (message, args, client)
    async execute(message, args, client) {
        // 1. 取得目標對象
        const target = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);
        
        if (!target) {
            const reply = await message.reply('❌ 請標記要封鎖的人，或提供用戶 ID 喵！').catch(() => null);
            if (reply) setTimeout(() => reply.delete().catch(() => null), 3000);
            return;
        }

        // 2. 取得成員對象 (用於檢查權限)
        const targetMember = await message.guild.members.fetch(target.id).catch(() => null);

        // 3. 安全檢查
        if (targetMember) {
            if (!targetMember.bannable) {
                return message.reply('❌ 銀喵封鎖不了這個人喵... 他的權限可能比我高。').catch(() => null);
            }
            if (targetMember.id === message.author.id) {
                return message.reply('❌ 你不能封鎖你自己喵！').catch(() => null);
            }
        }

        const reason = args.slice(1).join(' ') || '未提供原因';

        try {
            // 4. 執行封鎖 (deleteMessageSeconds: 604800 代表刪除過去 7 天的訊息)
            await message.guild.members.ban(target, { 
                reason: `${message.author.tag}: ${reason}`,
                deleteMessageSeconds: 604800 
            });

            // 5. 建立美化 Embed
            const embed = new EmbedBuilder()
                .setColor('#ff0000') // 強烈的紅色
                .setTitle('🔨 法律制裁已送達！')
                .setThumbnail(target.displayAvatarURL())
                .addFields(
                    { name: '👤 被封鎖者', value: `${target.tag} (\`${target.id}\`)`, inline: false },
                    { name: '👮 執行判官', value: `${message.author.tag}`, inline: true },
                    { name: '📝 理由', value: reason, inline: true }
                )
                .setFooter({ text: '這是一次永久性的封鎖動作喵。' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });
            
            // 6. 刪除原始指令訊息
            await message.delete().catch(() => null);

        } catch (e) {
            console.error('[Ban Command Error]:', e);
            // 再次檢查：如果訊息已經被刪除，就改用 channel.send
            message.channel.send('❌ 封鎖過程中發生錯誤喵。請確認銀喵是否擁有「封鎖成員」權限。').catch(() => null);
        }
    },
};
