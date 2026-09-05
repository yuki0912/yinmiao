const { Events, ActivityType } = require('discord.js');
const mongoose = require('mongoose');
const PendingRole = require('../models/PendingRole');
const GuildConfig = require('../models/GuildConfig'); // 引入設定模型
const TempChannel = require('../models/TempChannel'); // 💡 引入動態語音資料模型
const { initBirthdayScheduler } = require('../utils/birthdayScheduler'); // 🎂 新增：引入生日慶生排程器

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const line = "=========================================";
        console.log(line);
        console.log(`✅ 系統啟動成功！帳號：${client.user.tag}`);
        console.log(`📊 指令：Slash(${client.slashCommands.size}) | Prefix(${client.prefixCommands.size})`);
        console.log(`💾 資料庫：${mongoose.connection.readyState === 1 ? '🟢 已連線' : '🔴 未連線'}`);
        console.log(line);

        // --- 1. 處理網頁端待處理申請 (Queue 模式) ---
        try {
            const tasks = await PendingRole.find({ status: 'pending' }).sort({ createdAt: 1 });
            if (tasks.length > 0) {
                console.log(`[隊列] 偵測到 ${tasks.length} 筆網頁申請，開始處理... 🐾`);
                for (const task of tasks) {
                    try {
                        const guild = client.guilds.cache.get(task.guildId) || await client.guilds.fetch(task.guildId).catch(() => null);
                        const member = guild ? await guild.members.fetch(task.userId).catch(() => null) : null;
                        const role = guild ? await guild.roles.fetch(task.roleId).catch(() => null) : null;

                        if (member && role) {
                            await member.roles.add(role, '銀喵網頁申請補發');
                            task.status = 'completed';
                            await sleep(500); // 緩衝避免 Rate Limit
                        } else {
                            task.status = 'failed';
                        }
                    } catch (e) {
                        task.status = 'failed';
                    }
                    await task.save();
                }
                console.log(`[隊列] 網頁補發處理完畢。`);
            }
        } catch (err) {
            console.error('[錯誤] 網頁隊列掃描失敗:', err.message);
        }

        // --- 2. 處理 Discord 反應補發 (掃描模式 - 🐾 完美防呆版) ---
        try {
            console.log(`[掃描] 開始掃描 Discord 反應補償...`);
            const configs = await GuildConfig.find({ rulesMessageId: { $ne: null }, rulesRoleId: { $ne: null } });
            
            for (const config of configs) {
                const guild = client.guilds.cache.get(config.guildId) || await client.guilds.fetch(config.guildId).catch(() => null);
                if (!guild) continue;

                const channel = await guild.channels.fetch(config.rulesChannelId).catch(() => null);
                if (!channel) continue;

                const message = await channel.messages.fetch(config.rulesMessageId).catch(() => null);
                
                if (message && message.reactions && message.reactions.cache) {
                    const targetEmoji = (config.rulesEmoji && config.rulesEmoji.trim().replace(/\uFE0F/g, '')) || '✅';
                    const reaction = message.reactions.cache.find(r => r.emoji.name && r.emoji.name.replace(/\uFE0F/g, '') === targetEmoji);
                    
                    if (reaction) {
                        const role = await guild.roles.fetch(config.rulesRoleId).catch(() => null);
                        if (role) {
                            let lastUserId = null;
                            let fetchMore = true;

                            while (fetchMore) {
                                const options = { limit: 100 };
                                if (lastUserId) options.after = lastUserId;

                                const users = await reaction.users.fetch(options).catch(() => new Map());
                                if (users.size === 0) {
                                    fetchMore = false;
                                    break;
                                }

                                for (const [id, user] of users) {
                                    lastUserId = id; 
                                    if (user.bot) continue;

                                    const member = await guild.members.fetch(id).catch(() => null);
                                    if (member && !member.roles.cache.has(role.id)) {
                                        await member.roles.add(role, '銀喵斷線反應補發').catch(() => {});
                                        await sleep(300); // 避免速度過快被 Discord 封鎖
                                    }
                                }

                                if (users.size < 100) fetchMore = false;
                            }
                        }
                    }
                }
            }
            console.log(`[掃描] Discord 反應補償完成。`);
        } catch (err) {
            console.error('[錯誤] 反應補償掃描失敗:', err.message);
        }

        // --- 3. 開機清理語音幽靈房 ---
        try {
            console.log(`[清理] 開始掃描動態語音幽靈房... 🧹`);
            const dbChannels = await TempChannel.find({});
            
            for (const doc of dbChannels) {
                const guild = client.guilds.cache.get(doc.guildId) || await client.guilds.fetch(doc.guildId).catch(() => null);
                if (!guild) {
                    await TempChannel.deleteOne({ _id: doc._id }).catch(() => null);
                    continue;
                }

                const channel = await guild.channels.fetch(doc.channelId).catch(() => null);
                
                if (!channel || channel.members.size === 0) {
                    if (channel) {
                        await channel.delete().catch(() => null);
                        console.log(`🧹 已清理殘留空包廂: ${channel.name} (${doc.channelId})`);
                    }
                    await TempChannel.deleteOne({ _id: doc._id }).catch(() => null);
                }
            }
            console.log(`[清理] 幽靈房掃描完畢。`);
        } catch (err) {
            console.error('[錯誤] 執行開機清理語音房時出錯:', err.message);
        }

        // --- 4. 啟動生日定時排程器 (🎂 新增整合) ---
        try {
            initBirthdayScheduler(client);
        } catch (err) {
            console.error('[錯誤] 啟動生日定時排程失敗:', err.message);
        }

        // --- 5. 動態狀態輪換 ---
        const updateStatus = () => {
            const prefix = process.env.PREFIX || 's!';
            const statusPool = [
                { name: `${prefix}help | 守護 ${client.guilds.cache.size} 個伺服器 🐾`, type: ActivityType.Watching },
            ];
            const current = statusPool[Math.floor(Math.random() * statusPool.length)];
            client.user.setPresence({
                activities: [{ name: current.name, type: current.type }],
                status: 'online',
            });
        };

        setInterval(updateStatus, 60000);
        updateStatus();

        console.log(`🚀 銀喵機器人啟動程序完成。`);
        console.log(line);
    },
};