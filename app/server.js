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
        nudity: 'Unknown',
        stability: null,
        author: null
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
        nudity: meta.nudity || 'Unknown',
        stability: meta.stability || null,
        author: meta.author || 'dANNY',
        copyCount: meta.copyCount || 0
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

      // Find all .safetensors files
      const files = fs.readdirSync(folderPath)
      const safetensorsFiles = files.filter(file => file.endsWith('.safetensors'))

      // Process model information (support both array and string formats)
      let modelInfo = meta.model || ''
      let modelMap = {}

      // If model is an array, create a map for version lookup
      if (Array.isArray(meta.model)) {
        meta.model.forEach(m => {
          const key = m.name.toLowerCase()
          modelMap[key] = `${m.name} ${m.version}`
        })
        // For display, join all model info
        modelInfo = meta.model.map(m => `${m.name} ${m.version}`).join(', ')
      }

      // Extract version information from filenames
      // Format: CharacterName(version).safetensors
      const versions = safetensorsFiles.map(file => {
        const match = file.match(/\(([^)]+)\)\.safetensors$/)
        const versionName = match ? match[1] : 'default'

        // Try to find corresponding model info
        let displayName = versionName
        if (Object.keys(modelMap).length > 0) {
          const modelKey = versionName.toLowerCase()
          displayName = modelMap[modelKey] || versionName
        }

        return {
          name: versionName,
          displayName: displayName,
          fileName: file,
          filePath: `/${LORA_FOLDER_NAME}/character/${folder}/${file}`
        }
      })

      // For backward compatibility, use first file as default
      const defaultVersion = versions[0] || { name: '', displayName: '', fileName: '', filePath: '' }

      return {
        id: folder,
        name: displayName,
        thumbnail: fs.existsSync(thumbnailPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/0.png` : '',
        preview: fs.existsSync(previewPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/1.png` : '',
        link: meta.link || '',
        prompt: meta.prompt || '',
        // Legacy fields for backward compatibility
        safetensorsFile: defaultVersion.fileName,
        safetensorsPath: defaultVersion.filePath,
        // New fields for multiple versions
        versions: versions,
        hasMultipleVersions: versions.length > 1,
        // Include all meta fields
        character: meta.character || folder,
        cloth: meta.cloth || '',
        gender: meta.gender || '',
        model: modelInfo,
        copyCount: meta.copyCount || 0,
        downloadCount: meta.downloadCount || 0
      }
    })

    res.json(loras)
  } catch (error) {
    console.error('Error reading LoRAs:', error)
    res.status(500).json({ error: 'Failed to load LoRAs' })
  }
})

// API route - increment prompt copy count
app.post('/api/prompts/:id/copy', (req, res) => {
  try {
    const { id } = req.params
    const metaPath = path.join(PROMPT_FOLDER_PATH, id, 'meta.json')

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.copyCount = (meta.copyCount || 0) + 1
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      res.json({ success: true, copyCount: meta.copyCount })
    } else {
      res.status(404).json({ error: 'Meta file not found' })
    }
  } catch (error) {
    console.error('Error updating prompt copy count:', error)
    res.status(500).json({ error: 'Failed to update copy count' })
  }
})

// API route - increment LoRA copy count
app.post('/api/loras/:id/copy', (req, res) => {
  try {
    const { id } = req.params
    const metaPath = path.join(LORA_FOLDER_PATH, 'character', id, 'meta.json')

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.copyCount = (meta.copyCount || 0) + 1
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      res.json({ success: true, copyCount: meta.copyCount })
    } else {
      res.status(404).json({ error: 'Meta file not found' })
    }
  } catch (error) {
    console.error('Error updating LoRA copy count:', error)
    res.status(500).json({ error: 'Failed to update copy count' })
  }
})

// API route - increment LoRA download count
app.post('/api/loras/:id/download', (req, res) => {
  try {
    const { id } = req.params
    const metaPath = path.join(LORA_FOLDER_PATH, 'character', id, 'meta.json')

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.downloadCount = (meta.downloadCount || 0) + 1
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      res.json({ success: true, downloadCount: meta.downloadCount })
    } else {
      res.status(404).json({ error: 'Meta file not found' })
    }
  } catch (error) {
    console.error('Error updating LoRA download count:', error)
    res.status(500).json({ error: 'Failed to update download count' })
  }
})

// API route - get statistics
app.get('/api/statistics', (req, res) => {
  try {
    // Get sensitivity filter from query params (sfw, nsfw, all)
    const sensitivityFilter = req.query.sensitivity || 'all'

    const stats = {
      prompts: {
        total: 0,
        byCharacter: {},
        byPlace: {},
        byType: {},
        topCopied: [],
        bySensitivity: { SFW: 0, NSFW: 0 }
      },
      loras: {
        total: 0,
        byGender: {},
        byModel: {},
        topDownloaded: [],
        totalDownloads: 0
      }
    }

    // Collect prompt statistics
    const promptFolders = fs.readdirSync(PROMPT_FOLDER_PATH)
      .filter(item => fs.statSync(path.join(PROMPT_FOLDER_PATH, item)).isDirectory())

    promptFolders.forEach(folder => {
      const folderPath = path.join(PROMPT_FOLDER_PATH, folder)
      const metaPath = path.join(folderPath, 'meta.json')
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

        // Apply sensitivity filter
        const promptSensitive = meta.sensitive || 'SFW'
        if (sensitivityFilter === 'sfw' && promptSensitive !== 'SFW') return
        if (sensitivityFilter === 'nsfw' && promptSensitive !== 'NSFW') return
        // if sensitivityFilter === 'all', include everything
        stats.prompts.total++

        // By character count
        const charCount = meta.character || 1
        stats.prompts.byCharacter[charCount] = (stats.prompts.byCharacter[charCount] || 0) + 1

        // By place
        const place = meta.place || 'Unknown'
        stats.prompts.byPlace[place] = (stats.prompts.byPlace[place] || 0) + 1

        // By type
        const type = meta.type || 'Unknown'
        stats.prompts.byType[type] = (stats.prompts.byType[type] || 0) + 1

        // By sensitivity
        const sensitive = meta.sensitive || 'SFW'
        stats.prompts.bySensitivity[sensitive] = (stats.prompts.bySensitivity[sensitive] || 0) + 1

        // Top copied
        const thumbnailPath = path.join(folderPath, '1.png')
        // Create unique display name using serial number and type
        const serialNumber = meta['serial-number'] !== undefined ? meta['serial-number'] : folder
        const displayName = `#${serialNumber} - ${meta.type || 'Unknown'}`
        stats.prompts.topCopied.push({
          id: folder,
          name: displayName,
          type: meta.type || 'Unknown',
          place: meta.place || 'Unknown',
          character: meta.character || 1,
          copyCount: meta.copyCount || 0,
          thumbnail: fs.existsSync(thumbnailPath) ? `/${PROMPT_FOLDER_NAME}/${folder}/1.png` : ''
        })
      }
    })

    // Sort top copied prompts
    stats.prompts.topCopied.sort((a, b) => b.copyCount - a.copyCount)
    stats.prompts.topCopied = stats.prompts.topCopied.slice(0, 10)

    // Collect LoRA statistics
    const loraCharacterPath = path.join(LORA_FOLDER_PATH, 'character')
    const loraFolders = fs.readdirSync(loraCharacterPath)
      .filter(item => fs.statSync(path.join(loraCharacterPath, item)).isDirectory())

    loraFolders.forEach(folder => {
      const metaPath = path.join(loraCharacterPath, folder, 'meta.json')
      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        stats.loras.total++

        // By gender
        const gender = meta.gender || 'Unknown'
        stats.loras.byGender[gender] = (stats.loras.byGender[gender] || 0) + 1

        // By model
        let modelInfo = 'Unknown'
        if (Array.isArray(meta.model)) {
          meta.model.forEach(m => {
            const modelName = m.name || 'Unknown'
            stats.loras.byModel[modelName] = (stats.loras.byModel[modelName] || 0) + 1
          })
        } else if (meta.model) {
          stats.loras.byModel[meta.model] = (stats.loras.byModel[meta.model] || 0) + 1
        }

        // Top downloaded
        const downloadCount = meta.downloadCount || 0
        stats.loras.totalDownloads += downloadCount
        const loraThumbnailPath = path.join(loraCharacterPath, folder, '0.png')
        stats.loras.topDownloaded.push({
          id: folder,
          name: meta.character || folder,
          downloadCount: downloadCount,
          thumbnail: fs.existsSync(loraThumbnailPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/0.png` : ''
        })
      }
    })

    // Sort top downloaded LoRAs
    stats.loras.topDownloaded.sort((a, b) => b.downloadCount - a.downloadCount)
    stats.loras.topDownloaded = stats.loras.topDownloaded.slice(0, 10)

    res.json(stats)
  } catch (error) {
    console.error('Error getting statistics:', error)
    res.status(500).json({ error: 'Failed to get statistics' })
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
