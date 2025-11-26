#!/bin/bash
# Glyphforge Docker 部署腳本 (Linux NAS)
# 此腳本會自動停止並移除舊容器，然後建立並啟動新容器

set -e  # 遇到錯誤時停止執行

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 容器和映像名稱
CONTAINER_NAME="glyphforge-app"
IMAGE_NAME="glyphforge"

# 印出帶顏色的訊息
print_color() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

print_color $CYAN "=== Glyphforge Docker 部署腳本 (Linux NAS) ==="
echo ""

# 檢查 Docker 是否安裝
if ! command -v docker &> /dev/null; then
    print_color $RED "錯誤: Docker 未安裝"
    print_color $YELLOW "請先安裝 Docker: https://docs.docker.com/engine/install/"
    exit 1
fi

# 檢查 Docker Compose 是否安裝
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_color $RED "錯誤: Docker Compose 未安裝"
    print_color $YELLOW "請先安裝 Docker Compose"
    exit 1
fi

# 檢查是否有運行中的容器
print_color $YELLOW "檢查是否有運行中的容器..."
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    print_color $YELLOW "找到運行中的容器，正在停止..."
    docker stop $CONTAINER_NAME
    print_color $GREEN "容器已停止"
fi

# 檢查是否有已停止的容器
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    print_color $YELLOW "移除舊容器..."
    docker rm $CONTAINER_NAME
    print_color $GREEN "舊容器已移除"
fi

# 清理舊的映像（可選）
read -p "是否要清理舊的 Docker 映像？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_color $YELLOW "清理未使用的映像..."
    docker image prune -f
    print_color $GREEN "清理完成"
fi

# 使用 docker-compose 建立並啟動新容器
echo ""
print_color $YELLOW "建立並啟動新容器..."
if docker compose version &> /dev/null; then
    # 使用 docker compose (新版)
    docker compose up -d --build
else
    # 使用 docker-compose (舊版)
    docker-compose up -d --build
fi

# 等待容器啟動
print_color $YELLOW "等待容器啟動..."
sleep 3

# 檢查容器狀態
echo ""
print_color $YELLOW "檢查容器狀態..."

if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    CONTAINER_STATUS=$(docker ps -f name=$CONTAINER_NAME --format "{{.Status}}")

    echo ""
    print_color $GREEN "=== 部署成功! ==="
    print_color $GREEN "容器狀態: $CONTAINER_STATUS"
    echo ""
    print_color $CYAN "應用程式已啟動:"
    print_color $CYAN "  - 前端: http://localhost:40001"
    print_color $CYAN "  - 前端 (區域網路): http://$(hostname -I | awk '{print $1}'):40001"
    print_color $CYAN "  - 後端 API: http://localhost:3001"
    echo ""
    print_color $YELLOW "常用命令:"
    print_color $YELLOW "  查看日誌: docker-compose logs -f"
    print_color $YELLOW "  停止應用: docker-compose down"
    print_color $YELLOW "  重啟應用: docker-compose restart"
    print_color $YELLOW "  查看狀態: docker ps -f name=$CONTAINER_NAME"
    echo ""

    # 顯示容器資源使用情況
    print_color $CYAN "容器資源使用:"
    docker stats $CONTAINER_NAME --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"

else
    echo ""
    print_color $RED "=== 部署失敗 ==="
    print_color $RED "容器啟動失敗，請檢查錯誤訊息"
    echo ""
    print_color $YELLOW "查看詳細日誌:"
    print_color $YELLOW "  docker-compose logs"
    echo ""
    print_color $YELLOW "常見問題:"
    print_color $YELLOW "  1. 檢查端口是否被占用: netstat -tlnp | grep -E ':(40001|3001)'"
    print_color $YELLOW "  2. 檢查 volume 路徑權限"
    print_color $YELLOW "  3. 檢查 Docker 磁碟空間: df -h"
    exit 1
fi
