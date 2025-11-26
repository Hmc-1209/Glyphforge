# Glyphforge App

一個美麗的深色主題 React 靜態網頁，整合 Prompt 圖庫管理功能

## 特色

- 深色系設計，採用深灰藍色調
- 微圓弧邊框設計，Tab 與內容區域融為一體
- 響應式布局
- 現代化的漸層效果
- Prompt 圖庫瀏覽與複製功能
- 彈窗圖片預覽

## 如何啟動

### 1. 安裝依賴套件

首先，在終端機中進入 `app` 資料夾：

```bash
cd app
```

然後安裝所需的套件：

```bash
npm install
```

### 2. 啟動應用程式

安裝完成後，執行以下命令同時啟動後端 API 伺服器和前端開發伺服器：

```bash
npm start
```

這會同時啟動：
- 後端 API 伺服器 (http://localhost:3001)
- 前端開發伺服器 (http://localhost:5173)

### 3. 在瀏覽器中查看

在瀏覽器中打開 `http://localhost:5173` 即可看到你的網頁！

## 其他命令

- `npm run dev` - 只啟動前端開發伺服器
- `npm run server` - 只啟動後端 API 伺服器
- `npm run build` - 建立生產環境版本
- `npm run preview` - 預覽建立的生產版本

## 功能說明

### Prompt Tab
- 顯示 `prompt-folder` 中所有資料夾的圖片縮圖
- 點擊縮圖可打開彈窗查看兩張完整圖片
- 點擊複製按鈕可複製對應資料夾中 `prompt.txt` 的內容

### LoRA Tab
- LoRA 模型管理介面（示例）

## 技術棧

- React 18
- Vite
- Express.js
- CSS3
