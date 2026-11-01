# 雲端 VPS 部署指南

本專案是 Node.js Discord Bot，會同時啟動 Discord Bot 和 Express 網站。以下以 Ubuntu 22.04/24.04 VPS 為例。

## 1. 建立雲端主機

建議規格：

- Ubuntu 22.04 或 24.04
- 至少 1 GB RAM
- 至少 10 GB 磁碟空間
- 對外開放 TCP `22`；如果要使用網站，再開放 `80` 和 `443`

取得 VPS 的 IP、SSH 帳號和密碼後，在自己的電腦執行：

```bash
ssh root@你的VPS_IP
```

## 2. 安裝系統套件和 Node.js

```bash
apt update && apt upgrade -y
apt install -y git curl ffmpeg build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version
npm --version
```

## 3. 上傳專案

如果專案已放在 GitHub：

```bash
git clone 你的GitHub專案網址 yinmiao
cd yinmiao
npm install
```

如果尚未使用 GitHub，可以在本機建立 GitHub repository，再執行上面的指令。不要把 `.env` 或 Bot Token 上傳到 GitHub。

## 4. 建立環境變數

在專案根目錄建立 `.env`：

```bash
nano .env
```

填入以下內容，並替換成你自己的值：

```env
DISCORD_TOKEN=你的DiscordBotToken
CLIENT_ID=你的DiscordApplicationID
CLIENT_SECRET=你的DiscordOAuth2ClientSecret
REDIRECT_URI=https://你的網域/login/callback
MONGODB_URI=mongodb+srv://使用者:密碼@你的MongoDB叢集.mongodb.net/yinmiao
SESSION_SECRET=請產生一串長而隨機的密碼
GUILD_ID=你的測試伺服器ID
PREFIX=s!
REPORT_LOG_ID=你的回報頻道ID
NODE_ENV=production
PORT=3000
TZ=Asia/Taipei
```

如果有使用 YouTube Cookie，再加入有效的 JSON 陣列：

```env
YOUTUBE_COOKIE=[{"name":"cookie名稱","value":"cookie值","domain":".youtube.com","path":"/"}]
```

儲存 nano：按 `Ctrl+O`、按 Enter，再按 `Ctrl+X`。

保護 `.env`：

```bash
chmod 600 .env
```

## 5. 設定 MongoDB Atlas

1. 到 MongoDB Atlas 建立免費 Cluster。
2. 建立 Database User。
3. 在 Network Access 加入 VPS IP；測試時可暫時加入 `0.0.0.0/0`，正式使用建議只允許 VPS IP。
4. 複製連線字串，填入 `.env` 的 `MONGODB_URI`。
5. 如果密碼含有 `@`、`#` 或 `/` 等特殊字元，先做 URL encoding。

## 6. 測試啟動

```bash
npm start
```

確認看到 Discord 登入和 MongoDB 連線成功後，按 `Ctrl+C` 停止測試。

## 7. 使用 PM2 長期運行

```bash
npm install --global pm2
pm2 start index.js --name yinmiao
pm2 save
pm2 startup
```

`pm2 startup` 會輸出一行指令，請複製並執行那一行，然後再次儲存：

```bash
pm2 save
```

常用指令：

```bash
pm2 status
pm2 logs yinmiao
pm2 restart yinmiao
pm2 stop yinmiao
```

更新 GitHub 程式碼後：

```bash
cd ~/yinmiao
git pull
npm install
pm2 restart yinmiao
```

## 8. Discord OAuth2 網站設定

如果要使用網站控制台，請在 Discord Developer Portal 的 OAuth2 設定中加入：

```text
https://你的網域/login/callback
```

這個網址必須和 `.env` 的 `REDIRECT_URI` 完全一致。

## 9. 建議使用網域和 HTTPS

正式使用時，將網域的 A Record 指向 VPS IP，再安裝 Nginx 和 HTTPS：

```bash
apt install -y nginx certbot python3-certbot-nginx
```

建立 Nginx 設定：

```bash
nano /etc/nginx/sites-available/yinmiao
```

填入：

```nginx
server {
    listen 80;
    server_name 你的網域;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

啟用設定並取得 HTTPS：

```bash
ln -s /etc/nginx/sites-available/yinmiao /etc/nginx/sites-enabled/yinmiao
nginx -t
systemctl reload nginx
certbot --nginx -d 你的網域
```

完成後，把 `.env` 的 `REDIRECT_URI` 改成 HTTPS 網址，然後重啟：

```bash
pm2 restart yinmiao --update-env
```

## 10. 安全檢查

- 不要把 `.env`、Bot Token 或 Client Secret 上傳到 GitHub。
- Discord Bot Token 曾經公開時，請立即在 Developer Portal 重新產生 Token。
- VPS SSH 不要長期使用弱密碼。
- 正式環境的 MongoDB 不要長期開放給所有 IP。
- 定期查看 `pm2 logs yinmiao` 和 VPS 磁碟空間。
