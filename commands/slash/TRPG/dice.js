const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'TRPG',
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('🎲 TRPG 骰子系統 - 投擲各式骰子進行角色扮演檢定')
        .addStringOption(option =>
            option
                .setName('dice_type')
                .setDescription('選擇骰子類型')
                .setRequired(true)
                .addChoices(
                    { name: 'd4 (4面骰)', value: 'd4' },
                    { name: 'd6 (6面骰)', value: 'd6' },
                    { name: 'd8 (8面骰)', value: 'd8' },
                    { name: 'd10 (10面骰)', value: 'd10' },
                    { name: 'd12 (12面骰)', value: 'd12' },
                    { name: 'd20 (20面骰)', value: 'd20' },
                    { name: 'd100 (百面骰)', value: 'd100' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('投擲的骰子數量 (預設: 1)')
                .setMinValue(1)
                .setMaxValue(50)
        )
        .addStringOption(option =>
            option
                .setName('reason')
                .setDescription('投擲原因 (例: 攻擊、逃脫、說服等)')
        ),

    async execute(interaction) {
        const diceType = interaction.options.getString('dice_type');
        const amount = interaction.options.getInteger('amount') || 1;
        const reason = interaction.options.getString('reason') || '角色檢定';

        // 解析骰子類型
        const diceValue = parseInt(diceType.substring(1));
        
        // 生成骰子結果
        const rolls = [];
        let total = 0;
        for (let i = 0; i < amount; i++) {
            const roll = Math.floor(Math.random() * diceValue) + 1;
            rolls.push(roll);
            total += roll;
        }

        // 計算平均值
        const average = (total / amount).toFixed(2);
        
        // 判斷是否為大成功或大失敗
        let result = '✅ 普通成功';
        if (amount === 1) {
            if (rolls[0] === diceValue) {
                result = '🎉 **大成功！** (最大值)';
            } else if (rolls[0] === 1) {
                result = '💥 **大失敗！** (最小值)';
            }
        } else {
            if (total === diceValue * amount) {
                result = '🎉 **大成功！** (全滿值)';
            } else if (total === amount) {
                result = '💥 **大失敗！** (全最小值)';
            }
        }

        // 建立 Embed 展示結果
        const embed = new EmbedBuilder()
            .setTitle(`🎲 ${amount}${diceType} 骰子投擲`)
            .setDescription(`**原因：** ${reason}\n\n${result}`)
            .setColor(
                result.includes('大成功') ? '#00FF00' :
                result.includes('大失敗') ? '#FF0000' :
                '#FF9E5E'
            )
            .addFields(
                { 
                    name: '📊 投擲結果', 
                    value: `\`\`\`${rolls.join(', ')}\`\`\``,
                    inline: false 
                },
                { 
                    name: '🔢 統計數據', 
                    value: `總和: **${total}** | 平均: **${average}** | 範圍: 1~${diceValue}`,
                    inline: false 
                }
            )
            .setFooter({ 
                text: `由 ${interaction.user.username} 投擲`, 
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false }) 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
