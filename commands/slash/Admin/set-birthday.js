const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const BirthdayModel = require('../../../models/Birthday.js');
const GuildConfigModel = require('../../../models/GuildConfig.js');

module.exports = {
    category: "Admin",
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('🐾 伺服器生日系統綜合指令')
        .setDMPermission(false)

        // 1. 設定生日
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('🎂 設定或更新自己的生日')
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('請輸入生日（格式：月/日，例如：08/25 或 08-25）')
                        .setRequired(true)))

        // 2. 查詢生日
        .addSubcommand(sub =>
            sub.setName('check')
                .setDescription('🔍 查詢自己或指定成員的生日')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('要查詢的成員（留空則查詢自己）')
                        .setRequired(false)))

        // 3. 壽星榜
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('📜 查看伺服器內所有小夥伴的生日列表'))

        // 4. 刪除生日
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('🗑️ 刪除自己的生日紀錄'))

        // 5. 設定通知頻道（管理員限定）
        .addSubcommand(sub =>
            sub.setName('set-channel')
                .setDescription('📢 [管理員] 設定生日祝賀通知發送的頻道')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('選擇要接收生日通知的文字頻道')
                        .setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // --- 1. 設定自己的生日 ---
        if (subcommand === 'set') {
            const rawDate = interaction.options.getString('date').trim();
            const dateRegex = /^(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])$/;

            if (!dateRegex.test(rawDate)) {
                return interaction.reply({
                    content: '❌ 生日格式不正確喵！請使用 `月/日` 格式（例如：`08/25` 或 `12/01`）。',
                    ephemeral: true
                });
            }

            const match = rawDate.match(dateRegex);
            const month = match[1].padStart(2, '0');
            const day = match[2].padStart(2, '0');
            const formattedDate = `${month}/${day}`;

            await BirthdayModel.findOneAndUpdate(
                { guildId: interaction.guild.id, userId: interaction.user.id },
                { birthday: formattedDate },
                { upsert: true, new: true }
            );

            return interaction.reply({
                content: `🎉 成功登記生日！你的生日已設定為 **${formattedDate}** 喵！`,
                ephemeral: true
            });
        }

        // --- 2. 查詢生日 ---
        if (subcommand === 'check') {
            const targetUser = interaction.options.getUser('target') || interaction.user;
            const record = await BirthdayModel.findOne({
                guildId: interaction.guild.id,
                userId: targetUser.id
            });

            if (!record) {
                return interaction.reply({
                    content: targetUser.id === interaction.user.id
                        ? '❌ 你還沒有設定生日喵！可以使用 `/birthday set` 來設定喔！'
                        : `❌ <@${targetUser.id}> 還沒有設定生日喵！`,
                    ephemeral: true
                });
            }

            const embed = new EmbedBuilder()
                .setColor('#FF7B9C')
                .setTitle('🎂 生日資訊')
                .setDescription(`<@${targetUser.id}> 的生日是：**${record.birthday}** 🐾`)
                .setThumbnail(targetUser.displayAvatarURL())
                .setTimestamp();

            return interaction.reply({ embeds: [embed] });
        }

        // --- 3. 壽星榜 ---
        if (subcommand === 'list') {
            await interaction.deferReply();

            const records = await BirthdayModel.find({ guildId: interaction.guild.id });

            if (!records || records.length === 0) {
                return interaction.editReply({ content: '🐾 目前伺服器裡還沒有人設定生日喵！' });
            }

            records.sort((a, b) => a.birthday.localeCompare(b.birthday));

            const listText = records.map(r => `<@${r.userId}> ➔ **${r.birthday}**`).join('\n');

            const embed = new EmbedBuilder()
                .setColor('#FF7B9C')
                .setTitle(`🎂 ${interaction.guild.name} 的生日壽星榜`)
                .setDescription(listText.length > 4000 ? listText.substring(0, 4000) + '\n...' : listText)
                .setFooter({ text: `共 ${records.length} 位壽星 🐾` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        }

        // --- 4. 刪除生日 ---
        if (subcommand === 'remove') {
            const result = await BirthdayModel.findOneAndDelete({
                guildId: interaction.guild.id,
                userId: interaction.user.id
            });

            if (!result) {
                return interaction.reply({ content: '❌ 你原本就沒有設定生日喵！', ephemeral: true });
            }

            return interaction.reply({ content: '🗑️ 已成功幫你刪除生日紀錄喵！', ephemeral: true });
        }

        // --- 5. 設定廣播頻道（權限檢查：管理員） ---
        if (subcommand === 'set-channel') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({
                    content: '❌ 只有擁有「管理伺服器」權限的管理員才能設定通知頻道喵！',
                    ephemeral: true
                });
            }

            const channel = interaction.options.getChannel('channel');

            if (!channel.isTextBased()) {
                return interaction.reply({ content: '❌ 請選擇文字頻道喵！', ephemeral: true });
            }

            await GuildConfigModel.findOneAndUpdate(
                { guildId: interaction.guild.id },
                { birthdayChannelId: channel.id },
                { upsert: true, new: true }
            );

            return interaction.reply({
                content: `🌸 成功！以後每日生日祝賀將會自動發送到 ${channel} 喵！`,
                ephemeral: true
            });
        }
    }
};