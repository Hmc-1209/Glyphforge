import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import sizeOf from 'image-size'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 讀取配置
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'))
const PROMPT_FOLDER_PATH = path.isAbsolute(config.promptFolder.path)
  ? config.promptFolder.path
  : path.join(__dirname, config.promptFolder.path)
const PROMPT_FOLDER_NAME = config.promptFolder.name

const app = express()
const PORT = 3001

// 啟用 CORS
app.use(cors())
app.use(express.json())

// 動態靜態文件服務 - 提供配置的資料夾中的圖片
app.use(`/${PROMPT_FOLDER_NAME}`, express.static(PROMPT_FOLDER_PATH))

// API 路由 - 獲取所有 prompt 資料
app.get('/api/prompts', async (req, res) => {
  try {
    const folders = fs.readdirSync(PROMPT_FOLDER_PATH).filter(file => {
      return fs.statSync(path.join(PROMPT_FOLDER_PATH, file)).isDirectory()
    })

    const prompts = folders.map(folder => {
      const folderPath = path.join(PROMPT_FOLDER_PATH, folder)
      const promptPath = path.join(folderPath, 'prompt.txt')

      let promptText = ''
      if (fs.existsSync(promptPath)) {
        promptText = fs.readFileSync(promptPath, 'utf-8')
      }

      // 掃描資料夾中的所有圖片
      const files = fs.readdirSync(folderPath)
      const imageFiles = files.filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
        .sort()

      const images = []
      let imageOrientation = 'unknown'

      // 檢測圖片方向
      if (imageFiles.length > 0) {
        const firstImagePath = path.join(folderPath, imageFiles[0])
        try {
          const dimensions = sizeOf(firstImagePath)
          imageOrientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait'
        } catch (error) {
          console.error(`Error reading image dimensions for ${firstImagePath}:`, error)
        }

        // 根據方向決定使用哪些圖片
        if (imageOrientation === 'landscape') {
          // 橫放圖只取第一張
          images.push(`/${PROMPT_FOLDER_NAME}/${folder}/${imageFiles[0]}`)
        } else {
          // 直放圖取所有（最多兩張）
          imageFiles.slice(0, 2).forEach(file => {
            images.push(`/${PROMPT_FOLDER_NAME}/${folder}/${file}`)
          })
        }
      }

      return {
        id: folder,
        thumbnail: images[0] || '',
        images: images,
        imageOrientation: imageOrientation,
        prompt: promptText
      }
    })

    res.json(prompts)
  } catch (error) {
    console.error('Error reading prompts:', error)
    res.status(500).json({ error: 'Failed to load prompts' })
  }
})

// API 路由 - 獲取配置
app.get('/api/config', (req, res) => {
  res.json(config)
})

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
