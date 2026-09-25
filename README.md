# 🐾 銀喵 YinMiao | 妳的專屬 Discord 萌寵綜合助手

<div align="center">
  <img src="https://cdn.discordapp.com/app-icons/1368295793496293376/8b504bc9246088aa5b9e6d349fcc06d7.png?size=256" width="150" height="150" alt="YinMiao Logo">
  <p><strong>讓銀喵成為妳伺服器的最佳萌寵與管理控制夥伴喵！🐾</strong></p>
  <p>
    <img src="https://img.shields.io/badge/Discord.js-v14-blue?style=for-the-badge&logo=discord" alt="discord.js">
    <img src="https://img.shields.io/badge/Node.js->=18.0.0-green?style=for-the-badge&logo=node.js" alt="node.js">
    <img src="https://img.shields.io/badge/MongoDB-Atlas-green?style=for-the-badge&logo=mongodb" alt="mongodb">
    <img src="https://img.shields.io/badge/Express-Framework-lightgrey?style=for-the-badge&logo=express" alt="express">
  </p>
</div>

---

## 🌟 目前功能

銀喵是一隻以 **Discord.js v14 + MongoDB + Express** 為核心的多功能 Discord Bot，提供伺服器管理、社群互動、經濟系統、娛樂工具與 TRPG 功能。

### 🛡️ 伺服器管理與自動化
- **🌐 網頁控制台**：Discord OAuth2 登入，從瀏覽器管理伺服器設定。
- **🤖 AutoMod 防護**：偵測可疑的檔案/圖片/影片搭配大範圍標記的訊息並自動處理。
- **📜 規則驗證系統**：建立或綁定規則訊息，透過反應完成身分組驗證。
- **🎭 反應身份組**：支援跨頻道綁定訊息、Emoji 與身份組。
- **👋 歡迎系統**：支援 Embed、Canvas、文字內容、圖片與頻道設定。
- **🚪 離開通知**：成員離開時可發送自訂通知。
- **🎫 工單系統**：建立工單面板，讓成員建立私密支援頻道。
- **🔊 動態語音房**：設定語音母頻道後自動建立臨時語音房。
- **📢 公告系統**：支援 Modal、圖片、指定身份組標記與 Embed。
- **🧹 訊息管理**：批量清理訊息，可指定成員。
- **🔨 成員管理**：踢出、封鎖及管理成員資料。
- **🎂 生日系統**：管理伺服器成員生日設定。
- **♻️ 指令熱重載**：執行期間重新載入 Slash Command。
- **🚀 開發者全域廣播**：預覽並同步官方公告至所有伺服器。

### 📈 等級與社群
- **✨ XP / 等級系統**：聊天獲得 XP、升級並查看排行。
- **🏆 排行榜**：查看伺服器等級與經驗排名。
- **🪪 個人資訊卡**：顯示成員等級、XP 與銀喵幣等資訊。
- **🔗 連結修復**：改善 Twitter / X、Pixiv 等連結在 Discord 的預覽效果。

### 💰 銀喵經濟系統
- **📅 每日簽到**：領取銀喵幣並支援連續簽到獎勵。
- **🛠️ 打工系統**：透過工作獲得銀喵幣。
- **💸 玩家轉帳**：成員之間轉移銀喵幣。
- **🛒 商店系統**：使用銀喵幣購買商品。
- **🪙 硬幣遊戲**：進行正反面遊戲。

### 🎮 娛樂與內容工具
隨機動漫圖片、Neko 貓耳少女、Waifu、Reddit Meme、Pat 互動、Echo、翻譯、Pinterest、Pixiv、Ping 與 Help 等功能。

### 🎲 TRPG 系統
內建角色卡、骰子、D20 屬性檢定、技能檢定、屬性升級、隨機冒險與故事生成。

---

## 🛠️ Slash Commands

目前 Slash Commands 共 **45 個**，分為 **Admin、Economy、Fun、General、TRPG** 五大分類。直接在 Discord 輸入 `/` 即可使用；部分管理指令會依 Discord 權限限制。

### ⚙️ Admin｜管理與設定
| 指令 | 功能 |
| :--- | :--- |
| `/add-reaction-role` | 🔗 綁定反應身份組，支援跨頻道 |
| `/announce公告` | 📢 透過 Modal 發布正式公告 |
| `/ban` | 🚫 永久封鎖指定成員 |
| `/broadcast` | 🚀 開發者專用全域公告與預覽 |
| `/clear` | 🧹 清理頻道訊息，可指定成員 |
| `/embed` | 🖼️ 發送標準 Embed 卡片 |
| `/kick` | 👢 將成員踢出伺服器 |
| `/manage-user` | 🛠️ 管理成員等級、經驗與銀喵幣 |
| `/reload` | ♻️ 重新載入 Slash Command |
| `/rule` | 📜 設定規則驗證系統 |
| `/birthday` | 🎂 管理生日系統 |
| `/set-leave` | 🚪 設定離開通知 |
| `/set-ticket` | 🎫 發送與設定工單面板 |
| `/set-welcome` | 👋 設定歡迎系統 |
| `/setup-voice` | 🔊 設定動態語音房 |
| `/test-leave` | 🧪 測試離開通知效果 |
| `/testwelcome` | 🧪 測試歡迎訊息效果 |
| `/view-config` | 📊 查看歡迎系統詳細設定 |

### 💰 Economy｜經濟
| 指令 | 功能 |
| :--- | :--- |
| `/daily` | 📅 每日簽到領取銀喵幣 |
| `/pay` | 💸 轉帳銀喵幣 |
| `/shop` | 🛒 使用銀喵幣購買商品 |
| `/works` | 🛠️ 打工賺取銀喵幣 |

### 🎮 Fun｜娛樂
| 指令 | 功能 |
| :--- | :--- |
| `/anime` | 🎨 隨機動漫圖片 |
| `/echo` | 🔊 重複指定內容 |
| `/help` | 📋 顯示指令清單 |
| `/meme` | 😂 Reddit 迷因圖片 |
| `/neko` | 🐱 隨機貓耳少女圖片 |
| `/pat` | 👋 與指定成員互動 |
| `/ping` | 🏓 查看 Bot 回應狀態 |
| `/rank` | 🏆 查看等級與經驗排行 |
| `/translate` | 🌐 翻譯指定文字 |
| `/waifu` | ✨ 隨機老婆圖片 |

### 🔎 General｜一般工具
| 指令 | 功能 |
| :--- | :--- |
| `/coinflip` | 🪙 擲硬幣遊戲 |
| `/twitter` | 🔗 修復 Twitter / X 與 Pixiv 連結預覽 |
| `/leaderboard` | 🏆 查看伺服器等級排行榜 |
| `/pinterest` | 📌 搜尋 Pinterest 日本站內容 |
| `/pixiv` | 🎨 搜尋 Pixiv 插畫與二創 |

### 🎲 TRPG｜角色扮演
| 指令 | 功能 |
| :--- | :--- |
| `/adventure` | 🧭 消耗銀喵幣開啟隨機冒險 |
| `/character` | 🎭 TRPG 角色卡系統 |
| `/check` | 🎲 D20 屬性檢定 |
| `/dice` | 🎲 TRPG 骰子系統 |
| `/skill` | 🎯 TRPG 技能檢定 |
| `/stats-buy` | 💊 消耗銀喵幣提升屬性 |
| `/story` | 📖 生成 TRPG 故事開場 |

---

## 🧩 Discord Events 與自動化

- `guildMemberAdd`：新成員加入與歡迎系統
- `guildMemberRemove`：成員離開通知
- `interactionCreate`：Slash Command、Button、Modal 等互動
- `messageCreate`：訊息監控、AutoMod 與自動化
- `messageDelete`：訊息刪除事件
- `messageReactionAdd` / `messageReactionRemove`：反應身份組
- `voiceStateUpdate`：動態語音房建立與清理
- `ticketHandler`：工單建立與管理
- `linkFixer`：社群連結預覽修復
- `xp`：聊天 XP 與等級系統
- `ready`：Bot 啟動、排程與初始化

---

## 🌐 網頁控制台

- Discord OAuth2 登入
- 伺服器設定管理
- 歡迎系統設定
- 規則管理
- 反應身份組設定
- 工單設定
- 動態語音設定
- Embed / 視覺化內容設定

---
## 📦 專案技術棧與依賴 (Tech Stack)

銀喵的架構非常穩健，主要基於以下技術構建：

* **核心框架**：`discord.js v14`
* **後端伺服器**：`express` 與 `cors`
* **資料庫管理**：`mongoose` (MongoDB)
* **圖像渲染**：`canvas` (動態繪製歡迎卡片)
* **網頁 Session**：`connect-mongo` & `express-session`
* **排程任務**：`node-cron`
* **外部工具**：`discord-oauth2`、`axios`

---

## 🚀 部署與啟動指南 (Deployment)

### 1. 環境變數設定

請在專案根目錄建立 `.env` 檔案，並填入以下機密資訊（**切勿流出**）：

```
DISCORD_TOKEN=你的機器人Token
CLIENT_ID=你的應用程式ID
GUILD_ID=你的測試伺服器ID
MONGODB_URI=你的MongoDB連接字串
PORT=3000
TZ=Asia/Kuala_Lumpur
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 本地啟動

```bash
npm start
```

### 4. 使用 PM2 進行 24 💡 小時守護執行

```bash
# 全域安裝 PM2
npm install pm2 -g

# 啟動銀喵
pm2 start index.js --name "yinmiao"

# (Windows環境必做) 讓開機自動復活
npm install pm2-windows-startup -g
pm2-startup install
pm2 save
```

---

## 🔐 安全提醒

請勿將以下內容直接提交到 GitHub：

* Discord Bot Token
* API Keys
* MongoDB 連接字串及密碼
* Discord OAuth2 Secret

建議使用 `.env` 並將其加入 `.gitignore`。

---

## 📄 License

本專案目前使用 ISC License。
