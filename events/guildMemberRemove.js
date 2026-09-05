const { Events, EmbedBuilder } = require('discord.js');
const GuildConfig = require('../models/GuildConfig'); 
const UserProfile = require('../models/UserProfile'); 

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const { guild, user } = member;

        // 防止機器人離開時觸發
        if (user.bot) return;

        console.log(`📤 偵測到成員離群: ${user.tag} (${user.id}) 在伺服器: ${guild.name}`);

        // =========================================================
        // PART 1: 處理「離開通知訊息」發送
        // =========================================================
        try {
            // 1. 抓取設定
            const config = await GuildConfig.findOne({ guildId: guild.id }) || {};
            
            // 開關判定：預設為啟用 (若設定檔顯式設為 false 則跳過)
            if (config.sendLeave !== false) {
                
                // 2. 決定頻道
                const leaveChannel = guild.channels.cache.get(config.leaveChannelId);
                
                if (!leaveChannel) {
                    console.warn(`❌ 找不到伺服器 [${guild.name}] 的離開通知頻道，已跳過發送。`);
                } else if (leaveChannel.isTextBased() && leaveChannel.permissionsFor(guild.members.me)?.has('SendMessages')) {
                    
                    // 3. 變數替換輔助函式
                    const replaceVars = (str, isMention = false) => {
                        if (!str) return "";

                        const displayName = member.displayName || user.globalName || user.username; // 伺服器顯示名稱 / 暱稱
                        const rawUsername = user.username;                                            // 原始帳號名稱 (例如: xinolan.fualiekesi)
                        const userId = user.id;                                                       // Discord 純數字 ID

                        const userReplacement = isMention ? `<@${user.id}>` : displayName;

                        return str
                            .replace(/{user}/g, userReplacement)
                            .replace(/{user_name}/g, displayName)
                            .replace(/{username}/g, rawUsername)          // 新增：原始帳號名稱
                            .replace(/{user_id}/g, userId)               // 新增：Discord 數字 ID
                            .replace(/{display_name}/g, displayName)     // 新增：顯示暱稱
                            .replace(/{user_mention}/g, `<@${user.id}>`)
                            .replace(/{guild}/g, guild.name)
                            .replace(/{guild_name}/g, guild.name)
                            .replace(/{count}/g, guild.memberCount.toString())
                            .replace(/{member_count}/g, guild.memberCount.toString());
                    };

                    const textContent = replaceVars(config.leaveContent, false) || `🐾 **${user.username}** 離開了我們喵...`;
                    
                    // 建立初始發送載體
                    const messagePayload = { content: textContent, embeds: [] };
                    
                    // 檢查顏色格式安全閥
                    const fallbackColor = /^#[0-9A-F]{6}$/i.test(config.leaveEmbedColor) ? config.leaveEmbedColor : '#a0aec0';

                    // 4. Embed 組裝 (預設開啟，若設定檔顯式設為 false 則不發送 Embed)
                    if (config.sendLeaveEmbed !== false) {
                        const leaveEmbed = new EmbedBuilder()
                            .setColor(fallbackColor)
                            .setAuthor({ name: '成員揮手離去', iconURL: guild.iconURL() || undefined })
                            .setThumbnail(user.displayAvatarURL({ extension: 'png', size: 256 }));

                        // 安全設定 Title (防止空字串崩潰)
                        const rawTitle = replaceVars(config.leaveTitle) || "✨ 有緣再見喵";
                        if (rawTitle && rawTitle.trim() !== '') {
                            leaveEmbed.setTitle(rawTitle.trim());
                        }

                        // 安全設定 Description (防止空字串崩潰)
                        const rawDesc = replaceVars(config.leaveDescription) || "希望你未來的旅途一切順利～";
                        if (rawDesc && rawDesc.trim() !== '') {
                            leaveEmbed.setDescription(rawDesc.trim());
                        }

                        // 時間戳記
                        if (config.showLeaveTimestamp !== false) {
                            leaveEmbed.setTimestamp();
                        }
                        
                        // 頁尾安全閥
                        if (config.showLeaveFooter !== false) {
                            const emFooter = replaceVars(config.leaveFooter) || `剩餘成員數: ${guild.memberCount} 人`;
                            if (emFooter && emFooter.trim() !== '') {
                                leaveEmbed.setFooter({ 
                                    text: emFooter.trim(),
                                    iconURL: guild.iconURL() || undefined
                                });
                            }
                        }
                        
                        messagePayload.embeds = [leaveEmbed];
                    }

                    // 5. 最終發送
                    await leaveChannel.send(messagePayload);
                    console.log(`✨ 成功將離開訊息發送至 [${guild.name}] 的 #${leaveChannel.name} 頻道！`);
                } else {
                    console.warn(`⚠️ 機器人在 [${guild.name}] 的 #${leaveChannel.name} 頻道缺少「發送訊息」權限！`);
                }
            }
        } catch (error) {
            console.error(`[離開通知失敗] ❌ 發送 ${user.username} 的離開訊息時發生嚴重錯誤:`, error);
        }

        // =========================================================
        // PART 2: 處理「資料庫防跑路清理」
        // =========================================================
        try {
            if (UserProfile) {
                const result = await UserProfile.deleteMany({ 
                    userId: member.id, 
                    guildId: guild.id 
                });
                
                if (result.deletedCount > 0) {
                    console.log(`[清理成功] 🫧 成員 ${user.username} 已離開 ${guild.name}，已清除 ${result.deletedCount} 筆玩家檔案。`);
                }
            }
        } catch (error) {
            console.error(`[清理失敗] ❌ 清除 ${user.username} (${member.id}) 的資料庫檔案時出錯:`, error);
        }
    },
};