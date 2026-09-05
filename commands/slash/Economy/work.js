const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "Economy",
    data: new SlashCommandBuilder()
        .setName('works') 
        .setDescription('🛠️ 努力打工賺取銀喵幣'),

    async execute(interaction) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // 隨機工作描述與獎勵 (10 到 100)
        const jobs = [
            { task: "在貓咪咖啡廳幫忙洗碗", earn: Math.floor(Math.random() * 50) + 10 },
            { task: "幫鄰居阿姨照顧小貓", earn: Math.floor(Math.random() * 60) + 20 },
            { task: "在銀喵市場搬運貓糧", earn: Math.floor(Math.random() * 40) + 10 },
            { task: "去幫忙修復損壞的逗貓棒", earn: Math.floor(Math.random() * 70) + 30 },
            { task: "去捕捉逃跑的小魚乾", earn: Math.floor(Math.random() * 80) + 20 }
        ];
        
        const selectedJob = jobs[Math.floor(Math.random() * jobs.length)];

        try {
            // 1. 延遲回應，防止資料庫讀取超時
            await interaction.deferReply();

            let profile = await UserProfile.findOne({ guildId, userId });

            if (!profile) {
                profile = new UserProfile({ guildId, userId, coins: 0, streak: 0 });
            }

            // 2. 核心邏輯：冷卻檢查 (1小時 = 3600000 毫秒)
            const now = new Date();
            const cooldown = 60 * 60 * 1000; 

            if (profile.lastWork && (now - profile.lastWork) < cooldown) {
                // 🟢 計算精準的解鎖時間點，並轉換成 Unix 時間戳
                const nextWorkTime = new Date(profile.lastWork.getTime() + cooldown);
                const unixTimestamp = Math.floor(nextWorkTime.getTime() / 1000);

                return await interaction.editReply({
                    content: `❌ 主人你太累了喵！貓爪都快起泡了，請先休息一下。\n⏰ 可以再次開工的時間：<t:${unixTimestamp}:f> (<t:${unixTimestamp}:R>)`
                });
            }

            // 3. 更新金幣與打工時間
            profile.coins = (profile.coins || 0) + selectedJob.earn;
            profile.lastWork = now; // 🟢 完美的連動更新
            await profile.save();

            // 4. 建立精美打工回報 Embed
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('🛠️ 辛勤工作回報')
                .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
                .setDescription(`🎉 **${interaction.user.username}** 剛剛**${selectedJob.task}**，獲得了 **\`$${selectedJob.earn}\`** 枚銀喵幣！`)
                .addFields({ name: '💰 當前總額', value: `\`$${profile.coins}\` 銀喵幣`, inline: false })
                .setFooter({ text: '休息是為了走更長遠的路（打工冷卻：1小時）', iconURL: interaction.guild.iconURL() || undefined })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Work Command Error:', error);
            
            // 🔒 安全防禦閥：防範任何突發錯誤導致指令卡圈圈
            const errorContent = `❌ 糟糕！打工時發生意外錯誤了喵！\n\`\`\`js\n${error.message}\n\`\`\``;
            if (interaction.deferred) {
                await interaction.editReply({ content: errorContent, embeds: [] });
            } else {
                await interaction.reply({ content: errorContent, ephemeral: true });
            }
        }
    }
};
