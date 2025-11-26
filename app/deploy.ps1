# Glyphforge Docker 部署腳本 (PowerShell)
# 此腳本會自動停止並移除舊容器，然後建立並啟動新容器

Write-Host "=== Glyphforge Docker 部署腳本 ===" -ForegroundColor Cyan
Write-Host ""

$CONTAINER_NAME = "glyphforge-app"
$IMAGE_NAME = "glyphforge"

# 檢查是否有運行中的容器
Write-Host "檢查是否有運行中的容器..." -ForegroundColor Yellow
$running_container = docker ps -q -f name=$CONTAINER_NAME

if ($running_container) {
    Write-Host "找到運行中的容器，正在停止..." -ForegroundColor Yellow
    docker stop $CONTAINER_NAME
    Write-Host "容器已停止" -ForegroundColor Green
}

# 檢查是否有已停止的容器
$stopped_container = docker ps -aq -f name=$CONTAINER_NAME

if ($stopped_container) {
    Write-Host "移除舊容器..." -ForegroundColor Yellow
    docker rm $CONTAINER_NAME
    Write-Host "舊容器已移除" -ForegroundColor Green
}

# 使用 docker-compose 建立並啟動新容器
Write-Host ""
Write-Host "建立並啟動新容器..." -ForegroundColor Yellow
docker-compose up -d --build

# 檢查容器狀態
Write-Host ""
Write-Host "檢查容器狀態..." -ForegroundColor Yellow
Start-Sleep -Seconds 2

$container_status = docker ps -f name=$CONTAINER_NAME --format "{{.Status}}"

if ($container_status) {
    Write-Host ""
    Write-Host "=== 部署成功! ===" -ForegroundColor Green
    Write-Host "容器狀態: $container_status" -ForegroundColor Green
    Write-Host ""
    Write-Host "應用程式已啟動:" -ForegroundColor Cyan
    Write-Host "  - 前端: http://localhost:5173" -ForegroundColor White
    Write-Host "  - 後端 API: http://localhost:3001" -ForegroundColor White
    Write-Host ""
    Write-Host "查看日誌: docker-compose logs -f" -ForegroundColor Yellow
    Write-Host "停止應用: docker-compose down" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "=== 部署失敗 ===" -ForegroundColor Red
    Write-Host "請檢查錯誤訊息" -ForegroundColor Red
    Write-Host ""
    Write-Host "查看日誌: docker-compose logs" -ForegroundColor Yellow
}
