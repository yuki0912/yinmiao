const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'TRPG',
    data: new SlashCommandBuilder()
        .setName('story')
        .setDescription('📖 TRPG 故事生成器 - 根據主題隨機生成冒險故事開場')
        .addStringOption(option =>
            option
                .setName('theme')
                .setDescription('選擇故事主題')
                .addChoices(
                    { name: '🏰 城堡冒險', value: 'castle' },
                    { name: '🌲 森林謎團', value: 'forest' },
                    { name: '💎 寶藏獵人', value: 'treasure' },
                    { name: '👹 怪物獵殺', value: 'monster' },
                    { name: '🏛️ 古老廢墟', value: 'ruins' },
                    { name: '⛰️ 山脈探險', value: 'mountain' }
                )
                .setRequired(true)
        ),

    async execute(interaction) {
        const theme = interaction.options.getString('theme');

        const stories = {
            castle: {
                title: '🏰 城堡的秘密',
                scenes: [
                    '你們被王國的國王召喚到了寒風城堡。一位王妃在昨晚神秘失蹤，只留下一張紙條，上面用古老的文字寫著一句謎語...',
                    '城堡的侍衛長將你們帶到了王妃的房間。房間凌亂不堪，但奇怪的是，門窗全部被鎖定。唯一的線索是窗邊的一道淡青色的光芒痕跡。',
                    '你們發現了一本日記，其中記載著王妃與某個神秘人物的秘密往來。日記最後一頁寫著：「今晚，我將踏入另一個世界...」'
                ],
                hook: '🎯 任務: 揭開王妃消失的真相，並決定她的命運。'
            },
            forest: {
                title: '🌲 禁忌森林的低語',
                scenes: [
                    '村民們在森林邊緣發現了第三具屍體。所有死者都是同一個特徵：眼睛睜得很大，嘴裡重複著同一個詞語..."回家"。',
                    '村長懇求你們進入禁忌森林尋找真相。當你們穿過森林邊界時，感受到了一股令人不安的寂靜...連鳥叫聲都消失了。',
                    '在森林的深處，你們發現了一個古老的儀式場地。中央的石牌上刻著你們都無法識別的符號，但你們能感受到強大的魔力在這裡流動...'
                ],
                hook: '🎯 任務: 阻止詛咒的蔓延，找到真正的兇手。'
            },
            treasure: {
                title: '💎 失落寶藏的地圖',
                scenes: [
                    '一位年邁的冒險家在酒館裡找到了你們。她掏出一張古老而破舊的羊皮紙——一份寶藏地圖。根據傳說，這份地圖指向失落已久的龍王寶藏。',
                    '但還有一個問題：世界各地都有冒險者尋找這份地圖已經數百年。為什麼今天才出現？這位冒險家為什麼要將這危險的秘密告訴你們？',
                    '當你們開始按照地圖前進時，發現了另一群冒險者也在尋找同一個寶藏。他們看起來並不友善，而且他們的領導者戴著一枚熟悉的徽章...'
                ],
                hook: '🎯 任務: 在競爭者之前找到寶藏，揭示地圖的真正來源。'
            },
            monster: {
                title: '👹 怪物獵人的招募',
                scenes: [
                    '怪物獵人協會的會長親自找到了你們。一隻未知的怪物在最近的三個村莊製造了大屠殺，但沒有人見過它的真正樣子。',
                    '所有目擊者的描述都不同：有人說它有翅膀，有人說它能噴火，還有人說它能變身。唯一的共同點是——它從不留下活口。',
                    '會長給了你們一份詳細的任務報告和最後一個線索：在怪物出現的地方，總會留下一種奇異的黑色粘液。這可能就是追蹤它的關鍵。'
                ],
                hook: '🎯 任務: 追蹤並消滅怪物，拯救村民，並揭示怪物真正的起源。'
            },
            ruins: {
                title: '🏛️ 古老廢墟的呼喚',
                scenes: [
                    '考古學家們在最近發現了一座埋藏了千年的廢墟。根據古籍記載，這裡曾是一個強大文明的中心，但在一夜之間完全消失了。',
                    '當考古隊進入廢墟時，奇怪的事情開始發生。隊員們開始看到幻象，聽到古老的歌聲，甚至有些人開始用他們不認識的古代語言說話。',
                    '現在，考古隊需要冒險者的幫助。他們需要你們進入廢墟的最深處，找到中央的寶庫，並破壞那裡的某個古老魔法源。'
                ],
                hook: '🎯 任務: 探索廢墟的秘密，對抗古代的魔力，並決定是否應該喚醒沉睡千年的東西。'
            },
            mountain: {
                title: '⛰️ 山脈之頂的奧秘',
                scenes: [
                    '傳說中，在天際之山的頂峰，存在著一個神聖的殿堂。據說那裡有一件神器，能夠拯救整個王國免於即將到來的災難。',
                    '但沒有人知道那個殿堂確切在哪裡，也沒有人活著從那座山上回來。歷史上最有名的登山隊在山腰處發現了，他們最後的營地裡只有一句話："不要繼續上升"。',
                    '但時間已經不多了。王國的魔力屏障每天都在削弱，只有神器才能救我們。你們的登山隊已經集合完畢，他們都看著你，等待你的決定...'
                ],
                hook: '🎯 任務: 登上天際之山，找到神聖殿堂，獲得神器，同時存活下來。'
            }
        };

        const story = stories[theme];
        
        // 隨機選擇一個場景
        const randomScene = story.scenes[Math.floor(Math.random() * story.scenes.length)];

        const embed = new EmbedBuilder()
            .setTitle(story.title)
            .setDescription(randomScene)
            .setColor('#FF7B9C')
            .addFields(
                {
                    name: '📍 故事進度',
                    value: `章節 1/5 - 冒險開始`,
                    inline: false
                },
                {
                    name: story.hook.split(':')[0],
                    value: story.hook.split(':')[1].trim(),
                    inline: false
                }
            )
            .setFooter({ 
                text: `故事講述者：${interaction.user.username} | 下一章即將開啟...`, 
                iconURL: interaction.user.displayAvatarURL({ forceStatic: false }) 
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};
