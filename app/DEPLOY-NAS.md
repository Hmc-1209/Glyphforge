# Glyphforge NAS 部署指南

## 📋 前置需求

### NAS 系統需求
- Linux 系統（Synology DSM, QNAP QTS, TrueNAS, 等）
- Docker 已安裝
- Docker Compose 已安裝
- SSH 訪問權限

### 檢查 Docker 安裝
```bash
docker --version
docker-compose --version
# 或
docker compose version
```

## 🚀 快速部署

### 1. 上傳檔案到 NAS

使用 SCP 或 SFTP 上傳整個 `app` 資料夾到 NAS：

```bash
# 從本地電腦執行（Windows 使用 PowerShell 或 Git Bash）
scp -r app/ user@nas-ip:/volume1/docker/glyphforge/

# 或使用 rsync（推薦）
rsync -avz --progress app/ user@nas-ip:/volume1/docker/glyphforge/
```

### 2. SSH 連接到 NAS

```bash
ssh user@nas-ip
cd /volume1/docker/glyphforge
```

### 3. 配置 Volume 路徑

編輯 `docker-compose.yml` 或使用 NAS 專用配置：

```bash
# 方法一：直接編輯 docker-compose.yml
nano docker-compose.yml

# 方法二：使用 NAS 專用配置
cp docker-compose.nas.yml docker-compose.yml
nano docker-compose.yml
```

修改 volume 路徑為你 NAS 上的實際路徑：
```yaml
volumes:
  - /volume1/your-path/prompt:/data/prompt
```

### 4. 執行部署腳本

```bash
# 添加執行權限
chmod +x deploy-nas.sh

# 執行部署
./deploy-nas.sh
```

## 📝 手動部署步驟

如果你想手動控制每個步驟：

### 1. 建立 Docker 映像
```bash
docker build -t glyphforge .
```

### 2. 啟動容器
```bash
# 使用 docker compose v2
docker compose up -d

# 或使用舊版 docker-compose
docker-compose up -d
```

### 3. 檢查狀態
```bash
docker ps -f name=glyphforge-app
docker logs glyphforge-app
```

## 🔧 常見 NAS 配置

### Synology DSM

1. **啟用 SSH**
   - 控制台 → 終端機和 SNMP → 啟用 SSH 服務

2. **安裝 Docker**
   - 套件中心 → 搜尋 "Docker" → 安裝

3. **路徑範例**
   ```yaml
   volumes:
     - /volume1/docker/glyphforge-data/prompt:/data/prompt
   ```

4. **防火牆設定**
   - 控制台 → 安全性 → 防火牆
   - 允許端口 5173 和 3001

### QNAP QTS

1. **啟用 SSH**
   - 控制台 → 網路與檔案服務 → Telnet / SSH

2. **安裝 Container Station**
   - App Center → Container Station

3. **路徑範例**
   ```yaml
   volumes:
     - /share/Container/glyphforge-data/prompt:/data/prompt
   ```

### TrueNAS / FreeNAS

1. **啟用 SSH**
   - Services → SSH → 啟動

2. **路徑範例**
   ```yaml
   volumes:
     - /mnt/tank/docker/glyphforge-data/prompt:/data/prompt
   ```

## 🌐 網路配置

### 內網訪問
容器啟動後，可以通過以下方式訪問：

```bash
# 本機訪問
http://localhost:5173

# 區域網路訪問（其他設備）
http://NAS-IP:5173

# 例如
http://192.168.1.100:5173
```

### 設定反向代理（推薦）

#### Nginx 反向代理範例
```nginx
server {
    listen 80;
    server_name glyphforge.local;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

#### Synology 內建反向代理
1. 控制台 → 登入入口網站 → 進階 → 反向代理伺服器
2. 新增規則：
   - 來源：`https://glyphforge.your-domain.com`
   - 目的地：`http://localhost:5173`

## 🔒 安全建議

### 1. 限制訪問
```bash
# 只允許本地訪問（docker-compose.yml）
ports:
  - "127.0.0.1:3001:3001"
  - "127.0.0.1:5173:5173"
```

### 2. 使用防火牆
```bash
# UFW 範例
sudo ufw allow from 192.168.1.0/24 to any port 5173
sudo ufw allow from 192.168.1.0/24 to any port 3001
```

### 3. 設定 HTTPS
使用 Let's Encrypt 和 Nginx：
```bash
certbot --nginx -d glyphforge.your-domain.com
```

## 📊 監控和維護

### 查看日誌
```bash
# 即時日誌
docker logs -f glyphforge-app

# 最近 100 行
docker logs --tail 100 glyphforge-app

# docker-compose 日誌
docker-compose logs -f
```

### 資源監控
```bash
# 即時資源使用
docker stats glyphforge-app

# 一次性查看
docker stats --no-stream glyphforge-app
```

### 自動重啟
配置在 `docker-compose.yml` 中：
```yaml
restart: unless-stopped
```

### 定期更新
```bash
# 重新部署
./deploy-nas.sh

# 或手動
docker-compose down
docker-compose up -d --build
```

## 🔄 備份和還原

### 備份
```bash
# 備份容器
docker commit glyphforge-app glyphforge-backup

# 導出映像
docker save glyphforge-backup > glyphforge-backup.tar

# 備份 volume 資料
tar -czf prompt-backup.tar.gz /volume1/your-path/prompt/
```

### 還原
```bash
# 導入映像
docker load < glyphforge-backup.tar

# 還原 volume 資料
tar -xzf prompt-backup.tar.gz -C /
```

## 🐛 故障排除

### 容器無法啟動
```bash
# 檢查詳細錯誤
docker logs glyphforge-app

# 檢查配置
docker-compose config

# 檢查端口占用
netstat -tlnp | grep -E ':(5173|3001)'
```

### Volume 權限問題
```bash
# 檢查目錄權限
ls -la /volume1/your-path/prompt/

# 修復權限
sudo chown -R 1000:1000 /volume1/your-path/prompt/
sudo chmod -R 755 /volume1/your-path/prompt/
```

### 網路問題
```bash
# 檢查容器網路
docker network inspect bridge

# 檢查容器 IP
docker inspect glyphforge-app | grep IPAddress
```

### 記憶體不足
```bash
# 清理未使用的資源
docker system prune -a

# 檢查磁碟空間
df -h

# 限制容器資源（docker-compose.yml）
deploy:
  resources:
    limits:
      memory: 1G
```

## 📱 行動裝置訪問

### 區域網路
直接訪問 NAS IP：
```
http://192.168.1.100:5173
```

### 外網訪問（需要設定 DDNS）
1. 設定 DDNS
2. 路由器端口轉發：5173 → NAS:5173
3. 訪問：`http://your-ddns.com:5173`

### 使用 Tailscale（推薦）
安全的遠程訪問方案：
```bash
# 安裝 Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# 連接
tailscale up
```

## 📞 技術支援

### 有用的命令
```bash
# 檢查系統資訊
uname -a
docker info

# 檢查磁碟空間
df -h

# 檢查記憶體
free -h

# 檢查網路
ip addr show
```

### 導出配置
```bash
# 導出當前配置
docker-compose config > current-config.yml

# 導出環境變數
docker inspect glyphforge-app | grep -A 10 "Env"
```
