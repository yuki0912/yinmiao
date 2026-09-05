const GuildConfig = require('../models/GuildConfig');
const TempChannel = require('../models/TempChannel');

// 🐾 引入全局防重疊創房鎖，防止高併發或重複事件同時建立房間
const creatingLocks = new Set();

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const { guild, member } = newState;
        if (!guild || member.user.bot) return;

        // 1. 獲取資料庫中該伺服器的動態語音設定
        const config = await GuildConfig.findOne({ guildId: guild.id }).catch(() => null);
        if (!config) return;

        // ==========================================
        // 🟢 情況 A：成員進入了某個語音頻道 (檢查是否觸發創房)
        // ==========================================
        if (newState.channelId) {
            // 🌟 核心修正：對接新網頁的 voiceSettings 陣列，尋找玩家點擊的是不是其中一個母頻道
            const activeSetting = config.voiceSettings?.find(
                setting => setting.voiceGeneratorId === newState.channelId
            );

            // 如果找到了匹配的母頻道設定，代表需要觸發自動創房
            if (activeSetting) {
                // 🔒【防重複核心機制 1】：如果這個成員正在創房中，直接攔截，防止同時生成
                const lockKey = `${guild.id}-${member.id}`;
                if (creatingLocks.has(lockKey)) return;
                creatingLocks.add(lockKey);

                try {
                    // 🔒【防重複核心機制 2】：如果成員已經在一個活著的臨時房間裡了，就不重複幫他創房
                    const alreadyHasRoom = await TempChannel.findOne({ guildId: guild.id, ownerId: member.id });
                    if (alreadyHasRoom && guild.channels.cache.has(alreadyHasRoom.channelId)) {
                        const existingChannel = guild.channels.cache.get(alreadyHasRoom.channelId);
                        // 防呆：如果他沒在裡面，直接幫他丟進去就好，不重複創房
                        if (member.voice.channelId !== existingChannel.id) {
                            await member.voice.setChannel(existingChannel).catch(() => null);
                        }
                        creatingLocks.delete(lockKey);
                        return;
                    }

                    const parentCategory = newState.channel.parentId; // 取得母頻道所屬分類
                    
                    // 從該組別的設定讀取獨立的名字與限制人數
                    const customName = activeSetting.voiceNameTemplate || 'GAME VC';
                    const limit = activeSetting.voiceUserLimit ? parseInt(activeSetting.voiceUserLimit, 10) : 0;

                    // 1. 撈出目前該伺服器在資料庫中的所有臨時房間
                    const activeTempChannels = await TempChannel.find({ guildId: guild.id });
                    
                    // 2. 過濾出「在 Discord 內真正還活著」的頻道
                    const validChannels = activeTempChannels.filter(ch => guild.channels.cache.has(ch.channelId));

                    // 3. 找出目前所有同名房間後面的數字
                    const existingNumbers = validChannels.map(ch => {
                        const channelObj = guild.channels.cache.get(ch.channelId);
                        if (!channelObj) return 0;
                        
                        // 確保只抓取符合當前自訂名稱格式的房間（例如 "遊戲開黑房 3" -> 抓出 3）
                        if (!channelObj.name.startsWith(customName)) return 0;
                        
                        const match = channelObj.name.match(/\d+$/);
                        return match ? parseInt(match[0], 10) : 0;
                    }).filter(num => num > 0);

                    // 4. 自動補洞機制：從 1 開始找目前沒人用的數字
                    let nextNumber = 1;
                    while (existingNumbers.includes(nextNumber)) {
                        nextNumber++;
                    }

                    // 5. 組合最終頻道名稱
                    const finalChannelName = `${customName} ${nextNumber}`;

                    // 創建一個新的臨時語音包廂頻道
                    const tempChannel = await guild.channels.create({
                        name: finalChannelName, 
                        type: 2, // 2 代表 GuildVoice 語音頻道
                        parent: parentCategory,
                        userLimit: limit, 
                        // 同步母頻道的權限覆寫
                        permissionOverwrites: newState.channel.permissionOverwrites.cache.map(p => p)
                    });

                    // 將新創的臨時房間寫入資料庫追蹤
                    await TempChannel.create({
                        guildId: guild.id,
                        channelId: tempChannel.id,
                        ownerId: member.id
                    }).catch(err => console.error('紀錄臨時頻道至資料庫失敗:', err));

                    // 自動將該名成員移動至新開的包廂中喵！
                    await member.voice.setChannel(tempChannel);

                } catch (err) {
                    console.error(`[${guild.name}] 創建臨時動態語音房間失敗:`, err);
                } finally {
                    // 解開目前成員的創房鎖
                    creatingLocks.delete(lockKey);
                }
            }
        }

        // ==========================================
        // 🔴 情況 B：成員離開了某個語音頻道 (檢查是否需要自動回收空房)
        // ==========================================
        if (oldState.channelId) {
            const oldChannel = oldState.channel;

            if (oldChannel) {
                // 1. 檢查這個頻道是不是任何一個母頻道（母頻道絕對不能被刪除！）
                const isGenerator = config.voiceSettings?.some(
                    setting => setting.voiceGeneratorId === oldChannel.id
                );

                if (!isGenerator && oldChannel.members.size === 0) {
                    // 2. 雙重檢查機制：看是否存在於臨時房間資料庫中
                    const isTempDb = await TempChannel.findOne({ channelId: oldChannel.id });

                    // 3. 或者是動態比對：看它的名字是不是以任何一組設定的「自訂名稱」開頭
                    const matchesCustomName = config.voiceSettings?.some(
                        setting => oldChannel.name.startsWith(setting.voiceNameTemplate)
                    );

                    // 符合回收條件：房間空了、不是母頻道，且（在資料庫有紀錄 或 名字符合自訂前綴）
                    if (isTempDb || matchesCustomName) {
                        try {
                            // 執行 Discord 頻道刪除
                            await oldChannel.delete('動態語音包廂已空無一人，系統自動回收。');
                            
                            // 刪除成功後，同步將資料庫的追蹤紀錄洗掉！
                            await TempChannel.deleteOne({ channelId: oldChannel.id }).catch(() => null);

                        } catch (err) {
                            if (err.code !== 10008) { 
                                console.error(`[${guild.name}] 回收動態語音頻道時發生錯誤:`, err);
                            }
                            await TempChannel.deleteOne({ channelId: oldChannel.id }).catch(() => null);
                        }
                    }
                }
            }
        }
    }
};
