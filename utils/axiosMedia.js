const axios = require('axios');

const USER_AGENT = 'YinMiao (https://github.com/yuki0912/yinmiao)';

function httpUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const parsed = new URL(value.trim());
        return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
        return null;
    }
}

async function fetchNekosBest(category) {
    if (!['neko', 'waifu', 'pat'].includes(category)) {
        throw new Error('UNSUPPORTED_NEKOS_CATEGORY');
    }

    const response = await axios.get('https://nekos.best/api/v2/' + category, {
        timeout: 10000,
        headers: { 'User-Agent': USER_AGENT }
    });

    const item = response.data?.results?.[0];
    const url = httpUrl(item?.url);
    if (!url) throw new Error('INVALID_IMAGE_URL');

    return { ...item, url };
}

async function sendSlashResult(interaction, payload) {
    if (interaction.replied) return interaction.followUp(payload);

    if (interaction.deferred) {
        try {
            return await interaction.editReply(payload);
        } catch (error) {
            if (error.code !== 10008) throw error;
            console.warn('[mediaApi] 原始回覆不存在，改用 followUp:', interaction.id);
            return interaction.followUp(payload);
        }
    }

    return interaction.reply(payload);
}

function errorDescription(error, subject) {
    if (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) {
        return '❌ ' + subject + ' API 回應超時，請稍後重試。';
    }
    if (error.response?.status === 429) {
        return '❌ 圖片服務目前請求過多，請稍後再試。';
    }
    if (error.message === 'INVALID_IMAGE_URL') {
        return '❌ 圖片服務沒有提供有效圖片，請再試一次。';
    }
    return '❌ 暫時無法取得' + subject + '，請稍後再試。';
}

async function executeSlashWithApi(interaction, label, subject, action) {
    try {
        await interaction.deferReply();
        await action();
    } catch (error) {
        console.error('[' + label + '] 執行失敗:', {
            interactionId: interaction.id,
            code: error.code,
            status: error.response?.status,
            message: error.message
        }, error);

        // Discord 互動已失效時，不應對同一個互動再次要求回覆。
        if ([10062, 40060, 50027].includes(error.code)) return;

        try {
            await sendSlashResult(interaction, {
                content: errorDescription(error, subject),
                embeds: []
            });
        } catch (replyError) {
            console.error('[' + label + '] 無法發送錯誤提示:', replyError);
        }
    }
}

module.exports = {
    httpUrl,
    fetchNekosBest,
    sendSlashResult,
    executeSlashWithApi,
    errorDescription
};
