const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas'); 
const UserProfile = require('../../../models/UserProfile'); 
const path = require('node:path');
const fs = require('node:fs');

// ====================================================
// 🎯 🛡️ 中文字型完美防護盾設定（最外層根目錄專用）
// ====================================================
// 使用 process.cwd() 直接精準鎖定與 index.js 同層的最外層目錄
const fontPath = path.join(process.cwd(), 'NotoSansTC-Bold.ttf');
let fontStyle = 'sans-serif'; 

if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'NotoSansTC');
    fontStyle = 'NotoSansTC'; 
    console.log('✅ [銀喵字型系統] 成功載入最外層中文字型：NotoSansTC-Bold.ttf');
} else {
    console.warn('⚠️ [銀喵字型系統] 未找到字型檔，Linux 環境下中文字可能會變成方塊亂碼！');
    console.warn(`請確認字型檔是否確實與 index.js 放在一起: ${fontPath}`);
}

/**
 * 💡 Mee6 標準公式
 */
const getTotalXpForLevel = (lvl) => {
    let total = 0;
    for (let i = 1; i < lvl; i++) {
        total += 5 * (i ** 2) + 50 * i + 100;
    }
    return total;
};

module.exports = {
    category: "Fun",
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('查看你目前的等級與經驗值排行喵！🐾')
        .addUserOption(option => option.setName('user').setDescription('要查看的成員')),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        const username = member ? member.displayName : targetUser.username;
        const avatarUrl = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
        
        try {
            let profile = await UserProfile.findOne({ 
                userId: targetUser.id, 
                guildId: interaction.guild.id 
            });

            if (!profile) {
                profile = { level: 1, xp: 0, weeklyExp: 0 };
            }

            const level = profile.level || 1;
            const totalXp = profile.xp || 0; 
            const weeklyExp = profile.weeklyExp || 0; 

            const maxExp = 5 * (level ** 2) + 50 * level + 100; 
            const xpInCurrentLevel = totalXp - getTotalXpForLevel(level);

            const higherXpCount = await UserProfile.countDocuments({
                guildId: interaction.guild.id,
                xp: { $gt: totalXp } 
            });
            const serverRank = `#${higherXpCount + 1}`;

            let weeklyRank = "Off";
            if (weeklyExp > 0) {
                const higherWeeklyCount = await UserProfile.countDocuments({
                    guildId: interaction.guild.id,
                    weeklyExp: { $gt: weeklyExp }
                });
                weeklyRank = `#${higherWeeklyCount + 1}`;
            }

            // Canvas 畫布初始化
            const canvas = createCanvas(900, 230);
            const ctx = canvas.getContext('2d');

            const colorBg = '#1E1F22';       
            const colorSlot = '#111214';     
            const colorTextYellow = '#FFEAA7'; 
            const colorTextGray = '#949BA4';   
            const colorTextWhite = '#FFFFFF';  

            ctx.fillStyle = colorBg;
            ctx.beginPath();
            ctx.roundRect(0, 0, 620, 230, 20);
            ctx.fill();

            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, 620, 230, 20);
            ctx.clip(); 

            const progressPercent = Math.max(0, Math.min(xpInCurrentLevel / maxExp, 1));
            ctx.fillStyle = '#FFEAA7';
            ctx.fillRect(0, 222, 620 * progressPercent, 8);
            ctx.restore(); 

            ctx.save();
            ctx.beginPath();
            ctx.arc(105, 115, 65, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            try {
                const avatarImg = await loadImage(avatarUrl);
                ctx.drawImage(avatarImg, 40, 50, 130, 130);
            } catch (e) {
                ctx.fillStyle = '#FF7B9C'; 
                ctx.fill();
            }
            ctx.restore();

            ctx.textAlign = 'left'; 

            ctx.fillStyle = colorTextYellow;
            ctx.font = `bold 36px ${fontStyle}`;
            ctx.fillText(username, 200, 75);

            ctx.fillStyle = colorTextGray;
            ctx.font = `bold 15px ${fontStyle}`;
            ctx.fillText('SERVER RANK', 200, 130);
            ctx.fillText('WEEKLY RANK', 340, 130);
            ctx.fillText('WEEKLY EXP', 480, 130);

            ctx.fillStyle = colorTextYellow;
            ctx.font = `bold 30px ${fontStyle}`;
            ctx.fillText(serverRank, 200, 180); 

            ctx.fillStyle = colorTextWhite;
            ctx.font = `bold 28px ${fontStyle}`;
            ctx.fillText(weeklyRank, 340, 180); 
            
            ctx.fillText(weeklyExp > 0 ? weeklyExp.toLocaleString() : '0', 480, 180); 

            // 右側 LEVEL
            ctx.fillStyle = colorBg;
            ctx.beginPath();
            ctx.roundRect(640, 0, 260, 105, 20);
            ctx.fill();

            ctx.textAlign = 'center';
            ctx.fillStyle = colorTextGray;
            ctx.font = `bold 14px ${fontStyle}`;
            ctx.fillText('LEVEL', 640 + 130, 32);

            ctx.fillStyle = colorSlot;
            ctx.beginPath();
            ctx.roundRect(660, 42, 220, 46, 10);
            ctx.fill();

            ctx.fillStyle = colorTextYellow;
            ctx.font = `bold 26px ${fontStyle}`;
            ctx.fillText(level, 640 + 130, 74);

            // 右側 EXP
            ctx.fillStyle = colorBg;
            ctx.beginPath();
            ctx.roundRect(640, 125, 260, 105, 20);
            ctx.fill();

            ctx.textAlign = 'center';
            ctx.fillStyle = colorTextGray;
            ctx.font = `bold 14px ${fontStyle}`;
            ctx.fillText('EXP', 640 + 130, 157);

            ctx.fillStyle = colorSlot;
            ctx.beginPath();
            ctx.roundRect(660, 167, 220, 46, 10);
            ctx.fill();

            ctx.textAlign = 'left'; 
            const txtCurrent = xpInCurrentLevel.toLocaleString();
            const txtMax = ` / ${maxExp.toLocaleString()}`;

            ctx.font = `bold 19px ${fontStyle}`;
            const wCurrent = ctx.measureText(txtCurrent).width;
            ctx.font = `15px ${fontStyle}`;
            const wMax = ctx.measureText(txtMax).width;

            const totalWidth = wCurrent + wMax;
            const startX = 640 + (260 - totalWidth) / 2; 

            ctx.fillStyle = colorTextWhite;
            ctx.font = `bold 19px ${fontStyle}`;
            ctx.fillText(txtCurrent, startX, 197);

            ctx.fillStyle = colorTextGray;
            ctx.font = `15px ${fontStyle}`;
            ctx.fillText(txtMax, startX + wCurrent, 197);

            const buffer = canvas.toBuffer('image/png');
            const attachment = new AttachmentBuilder(buffer, { name: 'rank-card.png' });
            
            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('渲染或讀取資料庫時發生錯誤:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '抱歉喵，讀取資料庫或生成圖片時發生了點小問題...😿' });
            }
        }
    }
};
