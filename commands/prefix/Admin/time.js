const { EmbedBuilder } = require('discord.js');

const UPDATE_INTERVAL_MS = 5000;
const MAX_RUNNING_TIME_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = process.env.TZ || 'Asia/Kuala_Lumpur';

function createClockEmbed(now = new Date(), isStopped = false) {
    const dateText = new Intl.DateTimeFormat('zh-TW', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long'
    }).format(now);

    const timeText = new Intl.DateTimeFormat('zh-TW', {
        timeZone: TIME_ZONE,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).format(now);

    return new EmbedBuilder()
        .setColor(isStopped ? '#808080' : '#ffb7c5')
        .setTitle(isStopped ? '⏱️ 銀喵實時時鐘已停止' : '⏱️ 銀喵實時時鐘')
        .setDescription(
            isStopped
                ? '本次時鐘已連續運行 24 小時並自動停止。再次輸入 `s!time` 即可重新啟動喵～'
                : '以下時間會自動更新，讓你隨時掌握現在的時間喵！'
        )
        .addFields(
            { name: '📅 當前日期', value: dateText, inline: true },
            { name: '🕒 馬來西亞時間', value: `**${timeText}**`, inline: true },
            {
                name: '🌏 時區',
                value: TIME_ZONE,
                inline: true
            }
        )
        .setThumbnail('https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/512x512/23f1.png')
        .setFooter({
            text: isStopped
                ? '時鐘已停止 · 需要時可重新輸入指令'
                : '每 5 秒自動更新一次 · 最長連續運行 24 小時'
        })
        .setTimestamp(now);
}

module.exports = {
    name: 'time',
    aliases: ['clock', '時間', '時鐘', '實時時間'],
    category: 'Admin',
    description: '顯示每 5 秒自動更新的實時時鐘',

    // Prefix Command 的參數順序必須是 (message, args, client)。
    async execute(message, args, client) {
        let clockMessage;

        try {
            // Prefix 指令需要使用 message.channel.send，而不是 interaction.reply。
            clockMessage = await message.channel.send({
                embeds: [createClockEmbed()]
            });
        } catch (error) {
            console.error('[Time Command] 無法發送時鐘訊息:', error);
            return;
        }

        const startedAt = Date.now();
        let isUpdating = false;

        const timer = setInterval(async () => {
            if (isUpdating) return;
            isUpdating = true;

            try {
                const elapsed = Date.now() - startedAt;
                const isStopped = elapsed >= MAX_RUNNING_TIME_MS;

                if (isStopped) {
                    clearInterval(timer);
                }

                await clockMessage.edit({
                    embeds: [createClockEmbed(new Date(), isStopped)]
                });

                if (isStopped) {
                    console.log(
                        `[Time Command] 時鐘已停止：guild=${message.guild?.id || 'DM'}，user=${message.author.id}`
                    );
                }
            } catch (error) {
                // 訊息已刪除、頻道不存在或 Bot 失去存取權時，停止更新以免持續重試。
                clearInterval(timer);

                if (![10003, 10008, 50001].includes(error.code)) {
                    console.error('[Time Command] 更新時鐘失敗:', error);
                }
            } finally {
                isUpdating = false;
            }
        }, UPDATE_INTERVAL_MS);
    }
};
