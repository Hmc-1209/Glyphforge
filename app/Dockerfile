# 使用 Node.js 官方映像
FROM node:18-alpine

# 設定工作目錄
WORKDIR /app

# 複製 package.json 和 package-lock.json
COPY package*.json ./

# 安裝依賴
RUN npm install

# 複製所有應用程式檔案
COPY . .

# 使用 Docker 專用的配置檔
RUN cp config.docker.json config.json

# 建立 Vite 前端
RUN npm run build

# 暴露端口
EXPOSE 3001
EXPOSE 5173

# 啟動應用
CMD ["npm", "start"]
