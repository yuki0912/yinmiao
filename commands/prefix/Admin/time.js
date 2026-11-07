const { EmbedBuilder } = require('discord.js');

const UPDATE_INTERVAL_MS = 5000;
const TIME_ZONE = process.env.TZ || 'Asia/Kuala_Lumpur';

function createClockEmbed(now = new Date()) {
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
        .setColor('#ffb7c5')
        .setTitle('⏱️ 銀喵實時時鐘')
        .setDescription('以下時間會持續自動更新，讓你隨時掌握現在的時間喵！')
        .addFields(
            { name: '📅 當前日期', value: dateText, inline: true },
            { name: '🕒 馬來西亞時間', value: `**${timeText}**`, inline: true },
            { name: '🌏 時區', value: TIME_ZONE, inline: true }
        )
        .setThumbnail('https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/512x512/23f1.png')
        .setFooter({ text: '每 5 秒自動更新 · 24/7 持續運行' })
        .setTimestamp(now);
}

module.exports = {
    name: 'time',
    aliases: ['clock', '時間', '時鐘', '實時時間'],
    category: 'Admin',
    description: '顯示 24/7 持續更新的實時時鐘',

    // Prefix Command 的參數順序必須是 (message, args, client)。
    async execute(message, args, client) {
        let clockMessage;

        try {
            clockMessage = await message.channel.send({
                embeds: [createClockEmbed()]
            });
        } catch (error) {
            console.error('[Time Command] 無法發送時鐘訊息:', error);
            return;
        }

        // 使用遞迴 setTimeout：每次成功更新後才安排下一次，避免更新重疊。
        let timer = null;
        let stopped = false;

        const updateClock = async () => {
            if (stopped) return;

            try {
                await clockMessage.edit({
                    embeds: [createClockEmbed(new Date())]
                });

                if (!stopped) {
                    timer = setTimeout(updateClock, UPDATE_INTERVAL_MS);
                }
            } catch (error) {
                stopped = true;
                if (timer) clearTimeout(timer);

                // 訊息被刪除或 Bot 失去頻道存取權時，停止重試。
                if (![10003, 10008, 50001].includes(error.code)) {
                    console.error('[Time Command] 更新時鐘失敗:', error);
                } else {
                    console.log(
                        `[Time Command] 時鐘已停止更新：guild=${message.guild?.id || 'DM'}，channel=${message.channel.id}`
                    );
                }
            }
        };

        timer = setTimeout(updateClock, UPDATE_INTERVAL_MS);

        console.log(
            `[Time Command] 已啟動 24/7 實時時鐘：guild=${message.guild?.id || 'DM'}，channel=${message.channel.id}，message=${clockMessage.id}`
        );
    }
};
