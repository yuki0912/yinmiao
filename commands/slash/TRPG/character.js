const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const TRPG = require('../../../models/TRPG');

module.exports = {
    category: 'TRPG',
    data: new SlashCommandBuilder()
        .setName('character')
        .setDescription('🎭 TRPG 角色卡系統')
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('🎲 生成全新的 D&D 風格角色卡')
                .addStringOption(option => option.setName('name').setDescription('角色名稱 (不填則隨機生成)'))
                .addStringOption(option =>
                    option.setName('race').setDescription('選擇種族').addChoices(
                        { name: '人類 (Human)', value: 'human' },
                        { name: '精靈 (Elf)', value: 'elf' },
                        { name: '矮人 (Dwarf)', value: 'dwarf' },
                        { name: '半獸人 (Orc)', value: 'orc' },
                        { name: '龍裔 (Dragonborn)', value: 'dragonborn' }
                    )
                )
                .addStringOption(option =>
                    option.setName('class').setDescription('選擇職業').addChoices(
                        { name: '戰士 (Warrior)', value: 'warrior' },
                        { name: '法師 (Mage)', value: 'mage' },
                        { name: '盜賊 (Rogue)', value: 'rogue' },
                        { name: '聖騎士 (Paladin)', value: 'paladin' },
                        { name: '獵人 (Ranger)', value: 'ranger' },
                        { name: '吟遊詩人 (Bard)', value: 'bard' }
                    )
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('🔍 查詢已保存的角色卡')
                .addUserOption(option => option.setName('target').setDescription('要查詢的使用者 (不填則查詢自己)'))
                .addStringOption(option => option.setName('name').setDescription('指定角色名稱 (若未填將預設顯示第一張角色卡，可透過按鈕切換)'))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('💀 宣告指定角色死亡並徹底刪除角色卡')
                .addStringOption(option => option.setName('name').setDescription('要刪除的角色名稱').setRequired(true))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // 1. 最優先執行 deferReply，避免 3 秒內未回應觸發 DiscordAPIError[10062]
        const isEphemeral = subcommand === 'delete';
        try {
            await interaction.deferReply({ ephemeral: isEphemeral });
        } catch (error) {
            if (error.code === 10062) return;
            throw error;
        }

        const races = {
            human: { emoji: '👤', name: '人類', hpBonus: 8, bonus: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 } },
            elf: { emoji: '🧝', name: '精靈', hpBonus: 6, bonus: { str: 0, dex: 2, con: 0, int: 1, wis: 0, cha: 0 } },
            dwarf: { emoji: '⚒️', name: '矮人', hpBonus: 10, bonus: { str: 1, dex: 0, con: 2, int: 0, wis: 0, cha: 0 } },
            orc: { emoji: '💪', name: '半獸人', hpBonus: 12, bonus: { str: 2, dex: 0, con: 1, int: 0, wis: 0, cha: 0 } },
            dragonborn: { emoji: '🐉', name: '龍裔', hpBonus: 11, bonus: { str: 2, dex: 0, con: 0, int: 0, wis: 0, cha: 1 } }
        };

        const classes = {
            warrior: { emoji: '⚔️', name: '戰士', weapon: '大劍', skill: '盾牌精通', proficiency: 'STR' },
            mage: { emoji: '🔮', name: '法師', weapon: '魔法棒', skill: '魔法射擊', proficiency: 'INT' },
            rogue: { emoji: '🗡️', name: '盜賊', weapon: '匕首', skill: '暗殺', proficiency: 'DEX' },
            paladin: { emoji: '✨', name: '聖騎士', weapon: '聖劍', skill: '聖光庇護', proficiency: 'CHA' },
            ranger: { emoji: '🏹', name: '獵人', weapon: '弓箭', skill: '追蹤', proficiency: 'WIS' },
            bard: { emoji: '🎵', name: '吟遊詩人', weapon: '短劍', skill: '迷幻之歌', proficiency: 'CHA' }
        };

        const getMod = (val = 10) => {
            const mod = Math.floor((val - 10) / 2);
            return mod >= 0 ? `+${mod}` : `${mod}`;
        };

        // ==================== 1. 查詢角色卡 (/character view) ====================
        if (subcommand === 'view') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const targetName = interaction.options.getString('name');

            // 取得該玩家的所有角色卡
            let userChars = await TRPG.find({ userId: targetUser.id });

            if (userChars.length === 0) {
                return interaction.editReply({
                    content: `❌ ${targetUser.username} 目前尚未保存任何角色卡！`
                });
            }

            // 定位初始顯示的角色索引
            let currentIndex = 0;
            if (targetName) {
                const foundIndex = userChars.findIndex(c => c.name === targetName);
                if (foundIndex === -1) {
                    return interaction.editReply({
                        content: `❌ 找不到 ${targetUser.username} 名為 **${targetName}** 的角色卡！`
                    });
                }
                currentIndex = foundIndex;
            }

            // 建立角色 Embed 的輔助函式
            const createCharEmbed = (charData, index, total) => {
                const attrs = charData.attributes || {};
                const attrString = [
                    `🔴 **力量 (STR)**: ${attrs.str ?? 10} (${getMod(attrs.str)})`,
                    `🟢 **敏捷 (DEX)**: ${attrs.dex ?? 10} (${getMod(attrs.dex)})`,
                    `🔵 **體質 (CON)**: ${attrs.con ?? 10} (${getMod(attrs.con)})`,
                    `🟡 **智力 (INT)**: ${attrs.int ?? 10} (${getMod(attrs.int)})`,
                    `🟣 **感知 (WIS)**: ${attrs.wis ?? 10} (${getMod(attrs.wis)})`,
                    `⭐ **魅力 (CHA)**: ${attrs.cha ?? 10} (${getMod(attrs.cha)})`
                ].join('\n');

                const raceName = charData.race?.name || '未知';
                const raceEmoji = charData.race?.emoji || '👤';
                const className = charData.class?.name || '未知';
                const classEmoji = charData.class?.emoji || '⚔️';

                return new EmbedBuilder()
                    .setTitle(`🎭 ${raceEmoji} ${classEmoji} ${charData.name}`)
                    .setDescription(`**${raceName} ${className}** - 等級 ${charData.level || 1}\n\n> 冒險者檔案`)
                    .setColor('#A855F7')
                    .addFields(
                        { name: '📊 基本屬性', value: attrString, inline: false },
                        { name: '⚔️ 戰鬥統計', value: `💚 **生命值 (HP)**: ${charData.hp}/${charData.maxHp}\n🛡️ **防禦等級 (AC)**: ${charData.ac}\n💪 **主要專長**: ${charData.class?.proficiency || '無'}`, inline: false },
                        { name: '🎯 職業能力', value: `🔨 **武器**: ${charData.class?.weapon || '無'}\n✨ **特殊技能**: ${charData.class?.skill || '無'}`, inline: false }
                    )
                    .setFooter({
                        text: `角色卡擁有者：${targetUser.username} | 角色 (${index + 1}/${total})`,
                        iconURL: targetUser.displayAvatarURL({ forceStatic: false })
                    })
                    .setThumbnail(targetUser.displayAvatarURL({ forceStatic: false }))
                    .setTimestamp();
            };

            const isOwner = targetUser.id === interaction.user.id;

            // 建立按鈕選單 (分頁按鈕 + 操作按鈕)
            const buildViewRows = (index, total, isConfirmingDelete = false, disabled = false) => {
                if (isConfirmingDelete) {
                    return [
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('view_confirm_delete')
                                .setLabel('確認宣告死亡 🪦')
                                .setStyle(ButtonStyle.Danger),
                            new ButtonBuilder()
                                .setCustomId('view_cancel_delete')
                                .setLabel('取消 ❌')
                                .setStyle(ButtonStyle.Secondary)
                        )
                    ];
                }

                const row = new ActionRowBuilder();

                // ◀️ 上一個按鈕
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_prev')
                        .setLabel('◀️ 上一個')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabled || index === 0 || total <= 1),
                    // 頁碼指示按鈕 (僅展示)
                    new ButtonBuilder()
                        .setCustomId('view_page_indicator')
                        .setLabel(`${index + 1} / ${total}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true),
                    // 下一個 ▶️ 按鈕
                    new ButtonBuilder()
                        .setCustomId('view_next')
                        .setLabel('下一個 ▶️')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(disabled || index === total - 1 || total <= 1)
                );

                // 如果是角色卡擁有者，追加「宣告死亡」按鈕
                if (isOwner) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('view_delete')
                            .setLabel('宣告死亡 🪦')
                            .setStyle(ButtonStyle.Danger)
                            .setDisabled(disabled)
                    );
                }

                return [row];
            };

            const response = await interaction.editReply({
                embeds: [createCharEmbed(userChars[currentIndex], currentIndex, userChars.length)],
                components: buildViewRows(currentIndex, userChars.length)
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120_000 // 2分鐘操作超時
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ 只有點擊此指令的使用者可以操作選單！', ephemeral: true });
                }

                if (i.customId === 'view_prev') {
                    if (currentIndex > 0) currentIndex--;
                    await i.update({
                        content: null,
                        embeds: [createCharEmbed(userChars[currentIndex], currentIndex, userChars.length)],
                        components: buildViewRows(currentIndex, userChars.length)
                    }).catch(() => {});

                } else if (i.customId === 'view_next') {
                    if (currentIndex < userChars.length - 1) currentIndex++;
                    await i.update({
                        content: null,
                        embeds: [createCharEmbed(userChars[currentIndex], currentIndex, userChars.length)],
                        components: buildViewRows(currentIndex, userChars.length)
                    }).catch(() => {});

                } else if (i.customId === 'view_delete') {
                    const currentChar = userChars[currentIndex];
                    await i.update({
                        content: `⚠️ **警告**：確定要宣告角色 **${currentChar.name}** 死亡並徹底刪除角色卡嗎？此操作無法復原！`,
                        components: buildViewRows(currentIndex, userChars.length, true)
                    }).catch(() => {});

                } else if (i.customId === 'view_confirm_delete') {
                    const charToDelete = userChars[currentIndex];
                    await TRPG.deleteOne({ _id: charToDelete._id });

                    userChars.splice(currentIndex, 1);

                    // 若刪除後已無任何角色卡
                    if (userChars.length === 0) {
                        collector.stop('all_deleted');
                        return i.update({
                            content: `🪦 冒險者 **${charToDelete.name}** 已不幸陣亡，目前已無任何角色卡。（此訊息將於 15 秒後自動清除）`,
                            embeds: [],
                            components: []
                        }).catch(() => {});
                    }

                    // 調整目前指針位置（避免溢出）
                    if (currentIndex >= userChars.length) {
                        currentIndex = userChars.length - 1;
                    }

                    await i.update({
                        content: `🪦 冒險者 **${charToDelete.name}** 已陣亡。已為您切換至下一張角色卡。`,
                        embeds: [createCharEmbed(userChars[currentIndex], currentIndex, userChars.length)],
                        components: buildViewRows(currentIndex, userChars.length)
                    }).catch(() => {});

                } else if (i.customId === 'view_cancel_delete') {
                    await i.update({
                        content: null,
                        embeds: [createCharEmbed(userChars[currentIndex], currentIndex, userChars.length)],
                        components: buildViewRows(currentIndex, userChars.length)
                    }).catch(() => {});
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'all_deleted') {
                    setTimeout(() => {
                        interaction.deleteReply().catch(() => {});
                    }, 15_000);
                } else {
                    await interaction.editReply({
                        content: null,
                        components: buildViewRows(currentIndex, userChars.length, false, true)
                    }).catch(() => {});
                }
            });

            return;
        }

        // ==================== 2. 生成角色卡 (/character create) ====================
        if (subcommand === 'create') {
            const firstNames = ['艾琳', '萊昂', '索菲', '卡爾', '妮莎', '古斯塔夫', '露娜', '雷蒙'];
            const lastNames = ['斯塔克', '蘭尼斯特', '坦格利安', '卡蒙', '史密斯', '強森', '威廉森'];
            const getRandomName = () => `${firstNames[Math.floor(Math.random() * firstNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;

            const rollStat = () => {
                const rolls = Array.from({ length: 4 }, () => Math.floor(Math.random() * 6) + 1);
                rolls.sort((a, b) => a - b);
                return rolls.slice(1).reduce((sum, val) => sum + val, 0);
            };

            const selectedRace = races[interaction.options.getString('race') || Object.keys(races)[Math.floor(Math.random() * Object.keys(races).length)]];
            const selectedClass = classes[interaction.options.getString('class') || Object.keys(classes)[Math.floor(Math.random() * Object.keys(classes).length)]];
            const characterName = interaction.options.getString('name') || getRandomName();

            let currentCharacterData = null;

            const generateCharacterEmbed = () => {
                const rawAttrs = {
                    str: rollStat() + selectedRace.bonus.str,
                    dex: rollStat() + selectedRace.bonus.dex,
                    con: rollStat() + selectedRace.bonus.con,
                    int: rollStat() + selectedRace.bonus.int,
                    wis: rollStat() + selectedRace.bonus.wis,
                    cha: rollStat() + selectedRace.bonus.cha
                };

                const attributes = Object.fromEntries(
                    Object.entries(rawAttrs).map(([k, v]) => [k, Math.min(v, 20)])
                );

                const hp = selectedRace.hpBonus + Math.floor((attributes.con - 10) / 2);
                const ac = 10 + Math.floor((attributes.dex - 10) / 2);

                const attrString = [
                    `🔴 **力量 (STR)**: ${attributes.str} (${getMod(attributes.str)})`,
                    `🟢 **敏捷 (DEX)**: ${attributes.dex} (${getMod(attributes.dex)})`,
                    `🔵 **體質 (CON)**: ${attributes.con} (${getMod(attributes.con)})`,
                    `🟡 **智力 (INT)**: ${attributes.int} (${getMod(attributes.int)})`,
                    `🟣 **感知 (WIS)**: ${attributes.wis} (${getMod(attributes.wis)})`,
                    `⭐ **魅力 (CHA)**: ${attributes.cha} (${getMod(attributes.cha)})`
                ].join('\n');

                currentCharacterData = {
                    name: characterName,
                    race: selectedRace,
                    class: selectedClass,
                    attributes,
                    hp,
                    maxHp: hp,
                    ac
                };

                return new EmbedBuilder()
                    .setTitle(`🎭 ${selectedRace.emoji} ${selectedClass.emoji} ${characterName}`)
                    .setDescription(`**${selectedRace.name} ${selectedClass.name}** - 等級 1\n\n> 一個嶄新冒險的開始...`)
                    .setColor('#A855F7')
                    .addFields(
                        { name: '📊 基本屬性', value: attrString, inline: false },
                        { name: '⚔️ 戰鬥統計', value: `💚 **生命值 (HP)**: ${hp}\n🛡️ **防禦等級 (AC)**: ${ac}\n💪 **主要專長**: ${selectedClass.proficiency}`, inline: false },
                        { name: '🎯 職業能力', value: `🔨 **武器**: ${selectedClass.weapon}\n✨ **特殊技能**: ${selectedClass.skill}`, inline: false }
                    )
                    .setFooter({
                        text: `角色卡建立者：${interaction.user.username}`,
                        iconURL: interaction.user.displayAvatarURL({ forceStatic: false })
                    })
                    .setThumbnail(interaction.user.displayAvatarURL({ forceStatic: false }))
                    .setTimestamp();
            };

            const buildRow = (disabled = false) => new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('reroll_stats').setLabel('重新擲骰 📊').setStyle(ButtonStyle.Primary).setDisabled(disabled),
                new ButtonBuilder().setCustomId('save_character').setLabel('保存角色 💾').setStyle(ButtonStyle.Success).setDisabled(disabled),
                new ButtonBuilder().setCustomId('delete_character').setLabel('刪除 🗑️').setStyle(ButtonStyle.Danger).setDisabled(disabled)
            );

            const response = await interaction.editReply({
                embeds: [generateCharacterEmbed()],
                components: [buildRow()]
            });

            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120_000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ 只有觸發指令的使用者可以操作此卡片！', ephemeral: true });
                }

                if (i.customId === 'reroll_stats') {
                    await i.update({ embeds: [generateCharacterEmbed()] }).catch(() => {});
                } else if (i.customId === 'save_character') {
                    try {
                        await TRPG.findOneAndUpdate(
                            { userId: interaction.user.id, name: currentCharacterData.name },
                            {
                                userId: interaction.user.id,
                                guildId: interaction.guildId,
                                name: currentCharacterData.name,
                                race: {
                                    name: currentCharacterData.race.name,
                                    emoji: currentCharacterData.race.emoji
                                },
                                class: {
                                    name: currentCharacterData.class.name,
                                    emoji: currentCharacterData.class.emoji,
                                    weapon: currentCharacterData.class.weapon,
                                    skill: currentCharacterData.class.skill,
                                    proficiency: currentCharacterData.class.proficiency
                                },
                                attributes: currentCharacterData.attributes,
                                hp: currentCharacterData.hp,
                                maxHp: currentCharacterData.maxHp,
                                ac: currentCharacterData.ac
                            },
                            { upsert: true, new: true }
                        );

                        collector.stop('saved');

                        await i.update({
                            content: `✅ 角色 **${currentCharacterData.name}** 已成功保存！輸入 \`/character view name:${currentCharacterData.name}\` 可隨時查看。（此訊息將於 10 秒後自動清除）`,
                            embeds: [],
                            components: []
                        }).catch(() => {});

                        setTimeout(() => {
                            interaction.deleteReply().catch(() => { });
                        }, 10_000);

                    } catch (error) {
                        console.error('保存角色卡失敗:', error);
                        await i.reply({ content: '❌ 保存角色卡時發生資料庫錯誤！', ephemeral: true });
                    }
                } else if (i.customId === 'delete_character') {
                    collector.stop('deleted');
                    await interaction.deleteReply().catch(() => { });
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason !== 'saved' && reason !== 'deleted') {
                    await interaction.editReply({ components: [buildRow(true)] }).catch(() => { });
                }
            });
        }

        // ==================== 3. 宣告角色死亡與刪除 (/character delete) ====================
        if (subcommand === 'delete') {
            const targetName = interaction.options.getString('name');
            const charData = await TRPG.findOne({ userId: interaction.user.id, name: targetName });

            if (!charData) {
                return interaction.editReply({
                    content: `❌ 找不到名稱為 **${targetName}** 的已保存角色卡！`
                });
            }

            const confirmRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_death')
                    .setLabel('確認宣告死亡 🪦')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_death')
                    .setLabel('取消 ❌')
                    .setStyle(ButtonStyle.Secondary)
            );

            await interaction.editReply({
                content: `⚠️ **警告**：你確定要宣告角色 **${charData.name}** (${charData.race?.name || ''} ${charData.class?.name || ''}) 死亡嗎？此操作將**徹底刪除**角色卡，無法復原！`,
                components: [confirmRow]
            });

            const collector = interaction.channel.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30_000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ 只有觸發指令的使用者可以操作！', ephemeral: true });
                }

                if (i.customId === 'confirm_death') {
                    await TRPG.deleteOne({ _id: charData._id });
                    collector.stop('confirmed');

                    await i.update({
                        content: `🪦 冒險者 **${charData.name}** 已不幸陣亡，其傳奇故事劃下了句點...（此訊息將於 15 秒後自動清除）`,
                        components: []
                    }).catch(() => {});

                    setTimeout(() => {
                        interaction.deleteReply().catch(() => { });
                    }, 15_000);

                } else if (i.customId === 'cancel_death') {
                    collector.stop('cancelled');
                    await i.update({
                        content: `✅ 已取消操作，**${charData.name}** 依然健在！`,
                        components: []
                    }).catch(() => {});
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason !== 'confirmed' && reason !== 'cancelled') {
                    await interaction.editReply({
                        content: '⏱️ 操作逾時，已取消刪除。',
                        components: []
                    }).catch(() => { });
                }
            });
        }
    }
};