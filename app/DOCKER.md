# Glyphforge Docker 部署指南

## 快速開始

### 前置需求
- Docker Desktop (Windows/Mac) 或 Docker Engine (Linux)
- Docker Compose

### 一鍵部署

#### Windows (PowerShell)
```powershell
.\deploy.ps1
```

#### Linux/Mac (Bash)
```bash
chmod +x deploy.sh
./deploy.sh
```

## 詳細說明

### 檔案結構
```
app/
├── Dockerfile              # Docker 映像定義
├── docker-compose.yml      # Docker Compose 配置
├── config.json            # 本地開發配置
├── config.docker.json     # Docker 容器配置
├── deploy.ps1             # Windows 部署腳本
└── deploy.sh              # Linux/Mac 部署腳本
```

### 手動部署步驟

1. **建立 Docker 映像**
   ```bash
   docker build -t glyphforge .
   ```

2. **啟動容器**
   ```bash
   docker-compose up -d
   ```

3. **查看日誌**
   ```bash
   docker-compose logs -f
   ```

4. **停止容器**
   ```bash
   docker-compose down
   ```

### Volume 配置

容器會自動掛載主機的 prompt 資料夾：
- 主機路徑: `D:/Glyphforge-data/prompt`
- 容器路徑: `/data/prompt`

如果你的資料在不同位置，請修改 `docker-compose.yml` 中的 volumes 設定：
```yaml
volumes:
  - /your/path/to/prompt:/data/prompt
```

### 端口配置

- **前端**: http://localhost:5173
- **後端 API**: http://localhost:3001

如需修改端口，請編輯 `docker-compose.yml`：
```yaml
ports:
  - "你的端口:3001"
  - "你的端口:5173"
```

## 常見問題

### Q: 如何更新應用程式？
A: 執行部署腳本會自動停止舊容器並建立新的：
```powershell
.\deploy.ps1
```

### Q: 如何查看容器狀態？
A: 使用以下命令：
```bash
docker ps -f name=glyphforge-app
```

### Q: 如何進入容器內部？
A: 使用以下命令：
```bash
docker exec -it glyphforge-app sh
```

### Q: 資料夾權限問題怎麼辦？
A: 確保 Docker 有權限訪問 `D:/Glyphforge-data/prompt`：
- Windows: Docker Desktop 設定中允許該磁碟機
- Linux: 確保資料夾權限正確 `chmod -R 755 /path/to/prompt`

## 開發模式 vs 生產模式

### 開發模式（目前配置）
- 使用 `npm start` 同時運行前端和後端
- 支援熱重載
- 適合開發測試

### 生產模式（可選）
如需生產環境部署，建議：
1. 使用 Nginx 提供靜態檔案
2. 分離前後端容器
3. 使用 production build

## 進階配置

### 使用環境變數
在 `docker-compose.yml` 中添加環境變數：
```yaml
environment:
  - NODE_ENV=production
  - CUSTOM_VAR=value
```

### 持久化日誌
添加日誌 volume：
```yaml
volumes:
  - D:/Glyphforge-data/prompt:/data/prompt
  - ./logs:/app/logs
```

### 多個實例
複製 `docker-compose.yml` 並修改：
- 容器名稱
- 端口映射
- Volume 路徑

## 安全建議

1. 不要在公網暴露端口
2. 使用反向代理 (Nginx/Traefik)
3. 定期更新 Docker 映像
4. 限制容器資源使用

## 故障排除

### 容器無法啟動
```bash
# 查看詳細日誌
docker-compose logs

# 檢查配置
docker-compose config
```

### 無法訪問資料夾
```bash
# 檢查 volume 掛載
docker inspect glyphforge-app

# 進入容器檢查
docker exec -it glyphforge-app ls -la /data/prompt
```

### 端口被占用
```bash
# 查看端口使用情況
netstat -ano | findstr :5173
netstat -ano | findstr :3001

# 修改 docker-compose.yml 中的端口
```
