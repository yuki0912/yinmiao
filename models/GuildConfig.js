const mongoose = require('mongoose');

const GuildConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },

    // ==========================================
    // 👋 歡迎與引導系統
    // ==========================================
    welcomeChannelId: { type: String, default: null },
    welcomeContent: { type: String, default: "" },
    welcomeTitle: { type: String, default: "" },
    welcomeDescription: { type: String, default: "" },
    welcomeEmbedColor: { type: String, default: "" },
    welcomeImageUrl: { type: String, default: "" },

    // Canvas 卡片設定
    canvasText: { type: String, default: "" },
    canvasColor: { type: String, default: "#FFFFFF" },
    canvasSubText: { type: String, default: "" },           // 🐾 新增：副標題文字
    canvasSubColor: { type: String, default: "#FFFFFF" },  // 🐾 新增：副標題文字顏色
    canvasBg: { type: String, default: "" },
    canvasOverlayOpacity: { type: Number, default: "" },   // 🐾 新增：背景半透明遮罩透明度 (0 ~ 1.0)

    // 開關與頁尾設定
    sendEmbed: { type: Boolean, default: true },
    sendCanvas: { type: Boolean, default: true },
    showTimestamp: { type: Boolean, default: false },
    showFooter: { type: Boolean, default: false },
    welcomeFooter: { type: String, default: "" },

    // ==========================================
    // 📜 守則認證系統
    // ==========================================
    rulesChannelId: { type: String, default: null },
    rulesRoleId: { type: String, default: null },
    rulesTitle: { type: String, default: "" },
    rulesDescription: { type: String, default: "" },
    rulesEmoji: { type: String, default: "" },
    rulesMessageId: { type: String, default: "" },

    // 🐾 進階 Embed 守則樣式欄位
    rulesEmbedColor: { type: String, default: "#00a2ff" },
    embedTimestamp: { type: Boolean, default: false },
    embedAuthorName: { type: String, default: "" },
    embedAuthorIcon: { type: String, default: "" },
    embedAuthorUrl: { type: String, default: "" },
    embedThumbnail: { type: String, default: "" },
    embedImage: { type: String, default: "" },
    embedFooterText: { type: String, default: "" },
    embedFooterIcon: { type: String, default: "" },

    // ==========================================
    // 🎫 工單系統
    // ==========================================
    ticketChannelId: { type: String, default: null },
    ticketMessageId: { type: String, default: "" },
    ticketTitle: { type: String, default: "" },
    ticketDescription: { type: String, default: "" },
    ticketFooter: { type: String, default: "" },
    ticketColor: { type: String, default: "#FFC8DD" },

    // ==========================================
    // 🚪 繁星留守/離開系統
    // ==========================================
    leaveChannelId: { type: String, default: null },
    leaveContent: { type: String, default: "" },
    sendLeave: { type: Boolean, default: false },
    sendLeaveEmbed: { type: Boolean, default: false },
    leaveEmbedColor: { type: String, default: "#a0aec0" },
    leaveTitle: { type: String, default: "" },
    leaveDescription: { type: String, default: "" },
    showLeaveTimestamp: { type: Boolean, default: false },
    showLeaveFooter: { type: Boolean, default: false },
    leaveFooter: { type: String, default: "" },

    // ==========================================
    // 🔊 動態語音系統核心欄位 (陣列多組別設計)
    // ==========================================
    voiceSettings: [
        {
            voiceGeneratorId: { type: String, required: true },
            voiceNameTemplate: { type: String, default: '專屬包廂' },
            voiceUserLimit: { type: Number, default: 0 }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model('GuildConfig', GuildConfigSchema);
