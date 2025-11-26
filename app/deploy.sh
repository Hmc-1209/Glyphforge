#!/bin/bash
# Glyphforge Docker 部署腳本 (Bash)
# 此腳本會自動停止並移除舊容器，然後建立並啟動新容器

echo "=== Glyphforge Docker 部署腳本 ==="
echo ""

CONTAINER_NAME="glyphforge-app"
IMAGE_NAME="glyphforge"

# 檢查是否有運行中的容器
echo "檢查是否有運行中的容器..."
if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
    echo "找到運行中的容器，正在停止..."
    docker stop $CONTAINER_NAME
    echo "容器已停止"
fi

# 檢查是否有已停止的容器
if [ "$(docker ps -aq -f name=$CONTAINER_NAME)" ]; then
    echo "移除舊容器..."
    docker rm $CONTAINER_NAME
    echo "舊容器已移除"
fi

# 使用 docker-compose 建立並啟動新容器
echo ""
echo "建立並啟動新容器..."
docker-compose up -d --build

# 檢查容器狀態
echo ""
echo "檢查容器狀態..."
sleep 2

if [ "$(docker ps -f name=$CONTAINER_NAME --format '{{.Status}}')" ]; then
    echo ""
    echo "=== 部署成功! ==="
    docker ps -f name=$CONTAINER_NAME --format "容器狀態: {{.Status}}"
    echo ""
    echo "應用程式已啟動:"
    echo "  - 前端: http://localhost:40001"
    echo "  - 後端 API: http://localhost:3001"
    echo ""
    echo "查看日誌: docker-compose logs -f"
    echo "停止應用: docker-compose down"
else
    echo ""
    echo "=== 部署失敗 ==="
    echo "請檢查錯誤訊息"
    echo ""
    echo "查看日誌: docker-compose logs"
fi
