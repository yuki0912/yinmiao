const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');

module.exports = {
    category: "Economy",
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('🛒 银喵百货 - 使用银喵币购买特殊商品'),

    async execute(interaction) {
        // 定义商品清单
        const items = [
            { id: "role_vip", label: "💎 尊爵 VIP 身分組", price: 5000, desc: "获得专属颜色与地位图标", type: "ROLE", roleId: "123456789012345678" },
            { id: "role_rich", label: "💰 大富翁標籤", price: 10000, desc: "全服务器最闪亮的称号", type: "ROLE", roleId: "123456789012345678" },
            { id: "xp_boost", label: "⚡ 經驗加倍水", price: 1000, desc: "购买后存入背包", type: "ITEM" },
        ];

        const embed = new EmbedBuilder()
            .setTitle('🛒 银喵百货精品店')
            .setDescription('欢迎光临！请选择你想要购买的商品：\n\n' + 
                items.map(i => `**${i.label}**\n💰 价格：\`$${i.price}\`\n└ ${i.desc}`).join('\n\n'))
            .setColor('#ffaa00')
            .setFooter({ text: '点击下方选单进行购买（選單將於 60 秒後失效）' });

        const menu = new StringSelectMenuBuilder()
            .setCustomId('shop_select')
            .setPlaceholder('请选择商品...')
            .addOptions(items.map(i => ({
                label: i.label,
                description: `价格: $${i.price}`,
                value: i.id
            })));

        const row = new ActionRowBuilder().addComponents(menu);
        const response = await interaction.reply({ embeds: [embed], components: [row] });

        // 创建收集器
        const collector = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === interaction.user.id,
            time: 60000
        });

        collector.on('collect', async (i) => {
            const selectedItemId = i.values[0];
            const selectedItem = items.find(item => item.id === selectedItemId);

            if (!selectedItem) {
                return i.reply({ content: '❌ 找不到该商品！', ephemeral: true });
            }

            try {
                // 1. 查找或建立使用者資料庫紀錄
                let userProfile = await UserProfile.findOne({ userId: i.user.id, guildId: i.guild.id });
                if (!userProfile) {
                    userProfile = new UserProfile({ userId: i.user.id, guildId: i.guild.id, balance: 0, inventory: [] });
                }

                // 2. 检查余额是否足够
                if (userProfile.balance < selectedItem.price) {
                    return i.reply({
                        content: `❌ 余额不足！你需要 \`$${selectedItem.price}\` 银喵币，但目前只有 \`$${userProfile.balance}\`。`,
                        ephemeral: true
                    });
                }

                // 3. 针对 ROLE 身分组类型的商品检查
                if (selectedItem.type === "ROLE") {
                    const role = i.guild.roles.cache.get(selectedItem.roleId);
                    if (!role) {
                        return i.reply({ content: '❌ 伺服器内找不到该身分组，请联系管理员！', ephemeral: true });
                    }

                    if (i.member.roles.cache.has(selectedItem.roleId)) {
                        return i.reply({ content: '⚠️ 你已经拥有这个身分组了，无需重复购买！', ephemeral: true });
                    }

                    // 发放身分组
                    await i.member.roles.add(role);
                }

                // 4. 针对普通 ITEM 道具存入背包
                if (selectedItem.type === "ITEM") {
                    if (!Array.isArray(userProfile.inventory)) {
                        userProfile.inventory = [];
                    }
                    userProfile.inventory.push(selectedItem.id);
                }

                // 5. 扣钱并保存数据库
                userProfile.balance -= selectedItem.price;
                await userProfile.save();

                // 6. 成功回应
                await i.reply({
                    content: `🎉 成功购买 **${selectedItem.label}**！已扣除 \`$${selectedItem.price}\` 银喵币，剩余余额：\`$${userProfile.balance}\`。`,
                    ephemeral: true
                });

            } catch (error) {
                console.error('🛒 商店购买过程发生错误:', error);
                if (!i.replied && !i.deferred) {
                    await i.reply({ content: '❌ 处理购买时发生错误，请稍后再试！', ephemeral: true });
                }
            }
        });

        // 收集器结束时，将下拉选单停用（Disable）
        collector.on('end', () => {
            const disabledMenu = StringSelectMenuBuilder.from(menu).setDisabled(true).setPlaceholder('选单已逾期失效');
            const disabledRow = new ActionRowBuilder().addComponents(disabledMenu);
            interaction.editReply({ components: [disabledRow] }).catch(() => {});
        });
    }
};