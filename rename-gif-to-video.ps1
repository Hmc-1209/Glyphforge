# 批量重命名 gif_ 資料夾為 video_ 並更新 meta.json
# 以管理員身份執行此腳本

$galleryPath = "D:\Glyphforge-data\gallery"
$gifFolderPath = Join-Path $galleryPath "gif"
$videoFolderPath = Join-Path $galleryPath "video"

Write-Host "=== Glyphforge Gallery 資料夾重命名腳本 ===" -ForegroundColor Cyan
Write-Host ""

# 步驟 1: 先重命名父資料夾 gif -> video
if (Test-Path $gifFolderPath) {
    Write-Host "步驟 1: 重命名父資料夾 'gif' -> 'video'" -ForegroundColor Yellow
    try {
        Rename-Item -Path $gifFolderPath -NewName "video" -ErrorAction Stop
        Write-Host "✓ 成功重命名父資料夾" -ForegroundColor Green
    } catch {
        Write-Host "✗ 重命名父資料夾失敗: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "請確保:" -ForegroundColor Yellow
        Write-Host "  1. 以管理員身份執行此腳本" -ForegroundColor Yellow
        Write-Host "  2. 關閉所有正在訪問該資料夾的程式" -ForegroundColor Yellow
        Write-Host "  3. 暫停 NAS 同步軟體" -ForegroundColor Yellow
        exit 1
    }
} elseif (Test-Path $videoFolderPath) {
    Write-Host "✓ 父資料夾已經是 'video'，跳過此步驟" -ForegroundColor Green
} else {
    Write-Host "✗ 找不到 gif 或 video 資料夾" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 步驟 2: 重命名所有子資料夾 gif_xxx -> video_xxx
Write-Host "步驟 2: 重命名子資料夾 'gif_*' -> 'video_*'" -ForegroundColor Yellow

$folders = Get-ChildItem -Path $videoFolderPath -Directory | Where-Object { $_.Name -like "gif_*" }

if ($folders.Count -eq 0) {
    Write-Host "✓ 沒有需要重命名的子資料夾" -ForegroundColor Green
} else {
    Write-Host "找到 $($folders.Count) 個需要重命名的資料夾" -ForegroundColor Cyan

    foreach ($folder in $folders) {
        $oldName = $folder.Name
        $newName = $oldName -replace "^gif_", "video_"
        $oldPath = $folder.FullName
        $newPath = Join-Path $videoFolderPath $newName

        Write-Host "  處理: $oldName -> $newName" -ForegroundColor Cyan

        try {
            # 重命名資料夾
            Rename-Item -Path $oldPath -NewName $newName -ErrorAction Stop

            # 更新 meta.json 中的 id
            $metaPath = Join-Path $newPath "meta.json"
            if (Test-Path $metaPath) {
                $meta = Get-Content $metaPath -Raw | ConvertFrom-Json
                $meta.id = $newName
                $meta | ConvertTo-Json -Depth 10 | Set-Content $metaPath -Encoding UTF8
                Write-Host "    ✓ 資料夾已重命名，meta.json 已更新" -ForegroundColor Green
            } else {
                Write-Host "    ⚠ 資料夾已重命名，但找不到 meta.json" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "    ✗ 失敗: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "=== 完成 ===" -ForegroundColor Green
Write-Host "所有 'gif' 相關的資料夾名稱已改為 'video'" -ForegroundColor Green
Write-Host ""
Write-Host "接下來請驗證:" -ForegroundColor Yellow
Write-Host "  1. 確認資料夾結構正確" -ForegroundColor Yellow
Write-Host "  2. 啟動應用程式測試 Video Gallery" -ForegroundColor Yellow
Write-Host "  3. 確認 NAS 同步正常" -ForegroundColor Yellow
