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

## 🌟 核心特色功能

銀喵是一隻結合了**豐富互動社群功能**與**流暢網頁後台控制台**的多功能 Discord 機器人，無論是伺服器管理還是社群活躍，銀喵都能一手包辦：

* **🌐 炫彩網頁後台控制台**：整合全自動 Discord OAuth2 登入，管理員免動程式碼，用瀏覽器就能輕鬆勾選並設定功能！
* **🛡️ 高效能 AutoMod 惡意攔截**：專治盜帳號詐騙與惡意炸群。當使用者傳送**任何檔案/照片/影片**並同時**標記全體（`@everyone` / `@here`）**時，銀喵將於一秒內粉碎訊息、發送警告並**強制禁言該用戶 24 小時**。不含標記的日常分享則完全不受影響！
* **📜 動態守則認證系統**：自動生成精美內嵌 (Embed) 守則訊息，新成員只需點擊 ✅ 反應，即可秒速賦予身分組。
* **👋 精美歡迎系統 (Canvas/Web)**：支援動態頻道自訂與歡迎文字客製化，整合 Canvas 繪製帶有成員頭像與名稱的图卡，並支援直連網頁設定連結。
* **📊 活躍度等級系統**：內建流暢的聊天經驗值 (XP) 賺取機制，包含動態進度條個人檔案卡片與全伺服器活躍排行榜。升級祝賀訊息於 5 秒後自動回收，確保頻道整潔。
* **💰 萌寵經濟系統**：每日簽到、隨機打工任務、玩家自由轉帳，讓伺服器互動更好玩。
* **🚀 開發者全域廣播**：內建開發者特權廣播指令（帶有即時邊框圖卡預覽與安全確認按鈕），一鍵同步公告至所有伺服器。

---

## 🛠️ 指令手冊 (Commands)

本機器人完美支援 **斜線指令 (Slash Commands)** 與 **傳統前綴指令 (Prefix Commands)** 雙系統！

* **預設前綴 (Prefix)**：`s!` (例如：`s!rank`)
* **斜線指令 (Slash)**：直接在對話框輸入 `/` 即可喚出選單。

### ⚙️ 管理員與核心設定 (Admin & Config)
| 斜線指令             | 功能描述                                                          | 權限要求                   |
| :------------------- | :---------------------------------------------------------------- | :------------------------- |
| `/set-welcome`       | 🛠️ 設定歡迎頻道、開啟 Embed/Canvas 卡片開關及綁定後台網址          | 管理員 (Administrator)     |
| `/rule`              | 📜 設定規則驗證系統（支援彈窗建立新訊息或綁定現有舊訊息 ID）       | 管理員 (Administrator)     |
| `/add-reaction-role` | 🔗 跨頻道綁定反應身份組，成員點擊指定表情即刻獲得身分              | 管理員 (Administrator)     |
| `/announce公告`      | 📢 透過 Modal 彈窗撰寫公告，支援標記特定身分組並觸發亮紅點         | 管理員 (Administrator)     |
| `/clear`             | 🧹 批次清理頻道訊息（最高一次 100 則），5 秒後自動隱形             | 管理訊息 (Manage Messages) |
| `/kick`              | 👢 將指定成員踢出伺服器（內建職位階級安全檢查機制）                | 踢出成員 (Kick Members)    |
| `/ban`               | 🚫 永久封鎖成員，阻止其再次加入伺服器                              | 封鎖成員 (Ban Members)     |
| `/manage-user`       | 🛠️ 管理專用子指令：`add-coins` 調整金幣 / `set-level` 修改等級     | 管理員 (Administrator)     |
| `/reload`            | ♻️ 執行中強制刷新特定或全部（`all`）斜線指令的底層邏輯             | 管理員 (Administrator)     |
| `/broadcast`         | 🚀 **[核心開發者專用]** 全網伺服器官方公告同步發送（一般人不可見） | 開發者限定 (0)             |

### 📊 等級與個人檔案 (Leveling & Economy)
| 前綴指令 | 斜線指令       | 指令描述                                                     |
| :------- | :------------- | :----------------------------------------------------------- |
| `s!rank` | `/profile`     | 彈出精美的個人檔案卡片（包含等級、經驗值進度條、銀喵幣資產） |
| *(暫無)* | `/leaderboard` | 查看全伺服器活躍度最高、等級前 10 名的玩家排行榜             |

---

## 📦 專案技術棧與依賴 (Tech Stack)

銀喵的架構非常穩健，主要基於以下技術構建：

* **核心框架**：`discord.js v14.26.0`
* **後端伺服器**：`express` 與 `cors`
* **資料庫管理**：`mongoose` (MongoDB)
* **圖像渲染**：`canvas` (動態繪製歡迎卡片)
* **網頁 Session**：`connect-mongo` & `express-session`
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

安裝依賴
```
npm install
```

本地啟動
```
npm start
```

使用 PM2 進行 24 💡 小時守護執行
```
# 全域安裝 PM2
npm install pm2 -g

# 啟動銀喵
pm2 start index.js --name "yinmiao"

# (Windows環境必做) 讓開機自動復活
npm install pm2-windows-startup -g
pm2-startup install
pm2 save
```