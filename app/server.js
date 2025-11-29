import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import sizeOf from 'image-size'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load configuration
const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'))
const PROMPT_FOLDER_PATH = path.isAbsolute(config.promptFolder.path)
  ? config.promptFolder.path
  : path.join(__dirname, config.promptFolder.path)
const PROMPT_FOLDER_NAME = config.promptFolder.name

const LORA_FOLDER_PATH = path.isAbsolute(config.loraFolder.path)
  ? config.loraFolder.path
  : path.join(__dirname, config.loraFolder.path)
const LORA_FOLDER_NAME = config.loraFolder.name

const app = express()
const PORT = 3001

// Enable CORS
app.use(cors())
app.use(express.json())

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, 'dist')
  app.use(express.static(distPath))
}

// Static file service - serve images from configured folder
app.use(`/${PROMPT_FOLDER_NAME}`, express.static(PROMPT_FOLDER_PATH))
app.use(`/${LORA_FOLDER_NAME}`, express.static(LORA_FOLDER_PATH))

// API route - get all prompt data
app.get('/api/prompts', async (req, res) => {
  try {
    const folders = fs.readdirSync(PROMPT_FOLDER_PATH).filter(file => {
      return fs.statSync(path.join(PROMPT_FOLDER_PATH, file)).isDirectory()
    })

    const prompts = folders.map(folder => {
      const folderPath = path.join(PROMPT_FOLDER_PATH, folder)
      const promptPath = path.join(folderPath, 'prompt.txt')
      const metaPath = path.join(folderPath, 'meta.json')

      let promptText = ''
      if (fs.existsSync(promptPath)) {
        promptText = fs.readFileSync(promptPath, 'utf-8')
      }

      // Read meta.json if exists
      let meta = {
        character: 1,
        place: 'Unknown',
        sensitive: 'Unknown',
        type: 'Unknown',
        view: 'Unknown',
        nudity: 'Unknown'
      }
      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta = { ...meta, ...metaData }
        } catch (error) {
          console.error(`Error reading meta.json for ${folder}:`, error)
        }
      }

      // Scan all images in the folder
      const files = fs.readdirSync(folderPath)
      const imageFiles = files.filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
        .sort()

      const images = []
      let imageOrientation = 'unknown'

      // Detect image orientation from first image
      if (imageFiles.length > 0) {
        const firstImagePath = path.join(folderPath, imageFiles[0])
        try {
          const dimensions = sizeOf(firstImagePath)
          imageOrientation = dimensions.width > dimensions.height ? 'landscape' : 'portrait'
        } catch (error) {
          console.error(`Error reading image dimensions for ${firstImagePath}:`, error)
        }

        // Add all available images (up to 2)
        imageFiles.slice(0, 2).forEach(file => {
          images.push(`/${PROMPT_FOLDER_NAME}/${folder}/${file}`)
        })
      }

      return {
        id: folder,
        thumbnail: images[0] || '',
        images: images,
        imageOrientation: imageOrientation,
        prompt: promptText,
        character: meta.character || 1,
        place: meta.place || 'Unknown',
        sensitive: meta.sensitive || 'Unknown',
        type: meta.type || 'Unknown',
        view: meta.view || 'Unknown',
        nudity: meta.nudity || 'Unknown'
      }
    })

    res.json(prompts)
  } catch (error) {
    console.error('Error reading prompts:', error)
    res.status(500).json({ error: 'Failed to load prompts' })
  }
})

// API route - get all LoRA data
app.get('/api/loras', async (req, res) => {
  try {
    const characterFolderPath = path.join(LORA_FOLDER_PATH, 'character')

    // Check if character folder exists
    if (!fs.existsSync(characterFolderPath)) {
      console.error('Character folder not found:', characterFolderPath)
      return res.json([])
    }

    const folders = fs.readdirSync(characterFolderPath).filter(file => {
      return fs.statSync(path.join(characterFolderPath, file)).isDirectory()
    })

    const loras = folders.map(folder => {
      const folderPath = path.join(characterFolderPath, folder)
      const metaPath = path.join(folderPath, 'meta.json')
      const thumbnailPath = path.join(folderPath, '0.png')
      const previewPath = path.join(folderPath, '1.png')

      // Read meta.json
      let meta = {
        character: folder,
        cloth: '',
        link: '',
        prompt: ''
      }
      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta = { ...meta, ...metaData }
        } catch (error) {
          console.error(`Error reading meta.json for ${folder}:`, error)
        }
      }

      // Generate display name: character or character-cloth
      const displayName = meta.cloth && meta.cloth.trim() !== ''
        ? `${meta.character}-${meta.cloth}`
        : meta.character

      // Find .safetensors file
      const files = fs.readdirSync(folderPath)
      const safetensorsFile = files.find(file => file.endsWith('.safetensors'))

      return {
        id: folder,
        name: displayName,
        thumbnail: fs.existsSync(thumbnailPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/0.png` : '',
        preview: fs.existsSync(previewPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/1.png` : '',
        link: meta.link || '',
        prompt: meta.prompt || '',
        safetensorsFile: safetensorsFile || '',
        safetensorsPath: safetensorsFile ? `/${LORA_FOLDER_NAME}/character/${folder}/${safetensorsFile}` : '',
        // Include all meta fields
        character: meta.character || folder,
        cloth: meta.cloth || '',
        gender: meta.gender || '',
        model: meta.model || ''
      }
    })

    res.json(loras)
  } catch (error) {
    console.error('Error reading LoRAs:', error)
    res.status(500).json({ error: 'Failed to load LoRAs' })
  }
})

// API route - get configuration
app.get('/api/config', (req, res) => {
  res.json(config)
})

// Serve index.html for all other routes in production (SPA support)
if (process.env.NODE_ENV === 'production') {
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`)
})
