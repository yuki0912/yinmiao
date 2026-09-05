const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, 
    StringSelectMenuBuilder, MessageFlags 
} = require('discord.js');

module.exports = {
    category:"Fun",
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('顯示機器人的所有指令清單 📜 | View command list'),

    async execute(interaction) {
        const { client } = interaction;
        
        // 1. 整理分類與指令資料
        const categories = {};

        // 讀取 Slash 指令
        client.slashCommands.forEach(cmd => {
            const cat = cmd.category || '🔹 一般功能'; // 預設分類名稱
            if (!categories[cat]) categories[cat] = { slash: [], prefix: [] };
            categories[cat].slash.push(`\`/${cmd.data.name}\``);
        });

        // 讀取 Prefix 指令
        client.prefixCommands.forEach(cmd => {
            const cat = cmd.category || '🔸 前綴功能'; // 預設分類名稱
            if (!categories[cat]) categories[cat] = { slash: [], prefix: [] };
            categories[cat].prefix.push(`\`!${cmd.name}\``); // 這裡預設用 !，可改為讀取環境變數
        });

        // 2. 建立主導覽 Embed
        const mainEmbed = new EmbedBuilder()
            .setTitle('✨ 銀喵 指令導覽系統')
            .setThumbnail(client.user.displayAvatarURL())
            .setColor('#00ffcc')
            .setDescription('歡迎使用銀喵控制台！請從下方選單選擇類別查看詳細指令。')
            .addFields(
                { name: '📊 指令統計', value: `斜線指令: \`${client.slashCommands.size}\` | 前綴指令: \`${client.prefixCommands.size}\``, inline: true },
                { name: '💡 提示', value: '輸入 `/` 即可快速調用斜線指令。', inline: false }
            )
            .setTimestamp();

        // 3. 建立下拉選單 (Select Menu)
        const categoryList = Object.keys(categories);
        if (categoryList.length === 0) {
            return interaction.reply({ content: '❌ 目前沒有可用的指令。', flags: [MessageFlags.Ephemeral] });
        }

        const menu = new StringSelectMenuBuilder()
            .setCustomId('help_menu')
            .setPlaceholder('📂 點擊選擇指令類別...')
            .addOptions(
                categoryList.map(cat => ({
                    label: cat,
                    description: `查看 ${cat} 分類下的所有指令`,
                    value: cat,
                    emoji: cat.includes('一般') ? '⚙️' : '🛠️' // 可根據分類名稱自動給 Emoji
                }))
            );

        const row = new ActionRowBuilder().addComponents(menu);

        // 4. 發送回覆 (設定為只有執行者看得到 Ephemeral，保持頻道整潔)
        const response = await interaction.reply({ 
            embeds: [mainEmbed], 
            components: [row], 
            flags: [MessageFlags.Ephemeral],
            fetchReply: true 
        });

        // 5. 監聽選單互動 (Collector)
        const filter = i => i.customId === 'help_menu' && i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
            const selectedCat = i.values[0];
            const catData = categories[selectedCat];

            const categoryEmbed = new EmbedBuilder()
                .setTitle(`📂 類別：${selectedCat}`)
                .setColor('#00ffcc')
                .setThumbnail(client.user.displayAvatarURL())
                .addFields(
                    { name: '🔵 斜線指令 (/)', value: catData.slash.join(' ') || '`無`', inline: false },
                    { name: '🟡 前綴指令 (!)', value: catData.prefix.join(' ') || '`無`', inline: false }
                )
                .setFooter({ text: '選單將在 60 秒後失效 | Menu expires in 60s' });

            await i.update({ embeds: [categoryEmbed] });
        });

        collector.on('end', () => {
            // 時間到後移除選單，防止重複點擊報錯
            interaction.editReply({ components: [] }).catch(() => null);
        });
    }
};
