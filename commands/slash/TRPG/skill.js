const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const TRPG = require('../../../models/TRPG'); // 連動角色卡模型

module.exports = {
    category: 'TRPG',
    data: new SlashCommandBuilder()
        .setName('skill')
        .setDescription('🎯 TRPG 技能檢定 - 檢測角色是否成功完成特定任務')
        .addStringOption(option =>
            option
                .setName('skill')
                .setDescription('選擇要檢定的技能')
                .setRequired(true)
                .addChoices(
                    { name: '⚔️ 武器攻擊 (力量 STR 檢定)', value: 'attack' },
                    { name: '🛡️ 防禦 (體質 CON 檢定)', value: 'defense' },
                    { name: '🔮 魔法 (智力 INT 檢定)', value: 'magic' },
                    { name: '🤫 潛行 (敏捷 DEX 檢定)', value: 'stealth' },
                    { name: '💬 說服 (魅力 CHA 檢定)', value: 'persuasion' },
                    { name: '🔍 偵測 (感知 WIS 檢定)', value: 'perception' },
                    { name: '🧪 知識 (智力 INT 檢定)', value: 'knowledge' },
                    { name: '🏃 閃躲 (敏捷 DEX 檢定)', value: 'dodge' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('difficulty')
                .setDescription('難度 DC (預設: 10) | 10=簡單 | 15=中等 | 20=困難 | 25=極難')
                .setMinValue(1)
                .setMaxValue(30)
        )
        .addIntegerOption(option =>
            option
                .setName('modifier')
                .setDescription('額外手動修正值 (如環境加成/懲罰，例: 2 或 -1)')
        )
        .addStringOption(option =>
            option
                .setName('character')
                .setDescription('指定角色名稱 (不填則自動使用你最新的角色卡)')
        )
        .addStringOption(option =>
            option
                .setName('description')
                .setDescription('技能檢定的情境描述')
        ),

    async execute(interaction) {
        await interaction.deferReply().catch(() => {});

        const skillType = interaction.options.getString('skill');
        const difficulty = interaction.options.getInteger('difficulty') ?? 10;
        const customModifier = interaction.options.getInteger('modifier') ?? 0;
        const specifiedCharName = interaction.options.getString('character');
        const description = interaction.options.getString('description') || '進行技能檢定';

        // 技能對應的屬性標籤與說明
        const skills = {
            attack:     { emoji: '⚔️', name: '武器攻擊', attr: 'str', attrName: '力量 (STR)', desc: '揮舞武器進行攻擊' },
            defense:    { emoji: '🛡️', name: '防禦',     attr: 'con', attrName: '體質 (CON)', desc: '防守敵人的攻擊' },
            magic:      { emoji: '🔮', name: '魔法施法', attr: 'int', attrName: '智力 (INT)', desc: '施展一個魔法' },
            stealth:    { emoji: '🤫', name: '潛行',     attr: 'dex', attrName: '敏捷 (DEX)', desc: '避免被發現' },
            persuasion: { emoji: '💬', name: '說服',     attr: 'cha', attrName: '魅力 (CHA)', desc: '說服他人同意你的想法' },
            perception: { emoji: '🔍', name: '偵測',     attr: 'wis', attrName: '感知 (WIS)', desc: '發現隱藏的事物' },
            knowledge:  { emoji: '🧪', name: '知識',     attr: 'int', attrName: '智力 (INT)', desc: '回憶或使用專業知識' },
            dodge:      { emoji: '🏃', name: '閃躲',     attr: 'dex', attrName: '敏捷 (DEX)', desc: '躲開危險的攻擊' }
        };

        const skill = skills[skillType];

        // 嘗試獲取玩家的角色卡數據
        let charData = null;
        if (specifiedCharName) {
            charData = await TRPG.findOne({ userId: interaction.user.id, name: specifiedCharName });
        } else {
            // 自動搜尋該使用者建立的第一張角色卡
            charData = await TRPG.findOne({ userId: interaction.user.id });
        }

        // 計算屬性修正值 Mod = Math.floor((score - 10) / 2)
        let attrScore = 10;
        let attrMod = 0;
        if (charData && charData.attributes && charData.attributes[skill.attr] !== undefined) {
            attrScore = charData.attributes[skill.attr];
            attrMod = Math.floor((attrScore - 10) / 2);
        }

        const totalModifier = attrMod + customModifier;

        // 投擲 1d20
        const roll = Math.floor(Math.random() * 20) + 1;
        const totalResult = roll + totalModifier;

        // 判定大成功 / 大失敗 / 一般成功 / 一般失敗
        const isCriticalSuccess = roll === 20;
        const isCriticalFailure = roll === 1;

        // 大成功必然成功；大失敗必然失敗；其餘比較 Total vs Difficulty (DC)
        const isSuccess = isCriticalSuccess ? true : (isCriticalFailure ? false : totalResult >= difficulty);

        // 決定結果文字與顏色
        let resultText = '';
        let resultColor = '#FFA500';
        let resultEmoji = '✅';

        if (isCriticalSuccess) {
            resultText = '🎉 **大成功 (Critical Success)！** 超乎預期的完美表現！';
            resultColor = '#22C55E';
            resultEmoji = '✨';
        } else if (isCriticalFailure) {
            resultText = '💥 **大失敗 (Critical Failure)！** 一切都出錯了，災難發生！';
            resultColor = '#EF4444';
            resultEmoji = '❌';
        } else if (isSuccess) {
            resultText = '✅ **成功！** 檢定通過，你達成了目標。';
            resultColor = '#22C55E';
            resultEmoji = '✅';
        } else {
            resultText = '❌ **失敗！** 檢定未通過，計畫需要調整。';
            resultColor = '#EF4444';
            resultEmoji = '❌';
        }

        // 故事文本庫
        const storyResponses = {
            success: [
                '你沉著冷靜，完美地執行了計畫。',
                '經過精心準備，一切都如你所願。',
                '你的經驗和技能在此刻閃耀光芒。',
                '運氣站在你這一邊，你成功了！',
                '你的努力終於得到了回報。'
            ],
            failure: [
                '事情發展不如預期，你需要重新考慮策略。',
                '一個小小的失誤導致了失敗。',
                '這一次，命運似乎不站在你這邊。',
                '雖然盡力了，但還是失敗了。',
                '你發現情況比想像中更複雜。'
            ],
            critical_success: [
                '這是一個傳奇時刻！你超越了所有期望！',
                '天啊！你的表現簡直超人類！',
                '這將被記錄在歷史上的偉大時刻！',
                '你剛剛做了似乎不可能的事！',
                '你的傳奇故事將在酒館中流傳！'
            ],
            critical_failure: [
                '你意識到這是你犯過的最大錯誤。',
                '一切都崩潰了，局面失控。',
                '你本想要一個結果，卻得到了相反的結果。',
                '這個失敗將會產生意想不到的後果。',
                '你知道這將是一個漫長且艱難的故事。'
            ]
        };

        let storyCategory = 'success';
        if (isCriticalSuccess) storyCategory = 'critical_success';
        else if (isCriticalFailure) storyCategory = 'critical_failure';
        else if (!isSuccess) storyCategory = 'failure';

        const randomStory = storyResponses[storyCategory][Math.floor(Math.random() * storyResponses[storyCategory].length)];

        // 組合計算細節字串
        const modSign = totalModifier >= 0 ? `+${totalModifier}` : `${totalModifier}`;
        const attrModSign = attrMod >= 0 ? `+${attrMod}` : `${attrMod}`;
        const customModSign = customModifier >= 0 ? `+${customModifier}` : `${customModifier}`;

        let formulaText = `🎲 **d20 (${roll})** ${modSign} = **${totalResult}**`;
        if (charData) {
            formulaText += `\n*(基本骰 ${roll} + ${skill.attrName}修正 ${attrModSign}${customModifier !== 0 ? ` + 額外加成 ${customModSign}` : ''})*`;
        } else if (customModifier !== 0) {
            formulaText += `\n*(基本骰 ${roll} + 額外加成 ${customModSign})*`;
        }

        const actorName = charData ? `🎭 **${charData.name}**` : `👤 **${interaction.user.username}**`;

        const embed = new EmbedBuilder()
            .setTitle(`${skill.emoji} ${skill.name} 檢定 ${resultEmoji}`)
            .setDescription(`${actorName}\n**情境描述:** ${description}\n\n${resultText}\n\n> ${randomStory}`)
            .setColor(resultColor)
            .addFields(
                {
                    name: '📊 檢定結算',
                    value: formulaText,
                    inline: false
                },
                {
                    name: '⚙️ 難度目標 (DC)',
                    value: `**DC ${difficulty}**`,
                    inline: true
                },
                {
                    name: '🎯 判定結果',
                    value: `**${totalResult}** vs **DC ${difficulty}** (${isSuccess ? '通過' : '未通過'})`,
                    inline: true
                }
            )
            .setFooter({
                text: `使用者：${interaction.user.username} | ${skill.desc}`,
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false })
            })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    }
};