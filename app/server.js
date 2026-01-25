import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from 'cors'
import sizeOf from 'image-size'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import multer from 'multer'
import dotenv from 'dotenv'
import ffmpeg from 'fluent-ffmpeg'

dotenv.config()

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

const GALLERY_FOLDER_PATH = path.isAbsolute(config.galleryFolder.path)
  ? config.galleryFolder.path
  : path.join(__dirname, config.galleryFolder.path)
const GALLERY_FOLDER_NAME = config.galleryFolder.name

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

// Cache options for static files - enable browser caching for images
const staticOptions = {
  maxAge: '1d',        // Cache for 1 day (86400000 ms)
  etag: true,          // Enable ETag for change detection
  lastModified: true,  // Use Last-Modified header
  immutable: false     // Allow revalidation
}

// Gallery has shorter cache time for frequent updates
const galleryOptions = {
  maxAge: '5m',        // Cache for 5 minutes only
  etag: true,          // Enable ETag for change detection
  lastModified: true,  // Use Last-Modified header
  immutable: false     // Allow revalidation
}

// Static file service - serve images from configured folder with caching
app.use(`/${PROMPT_FOLDER_NAME}`, express.static(PROMPT_FOLDER_PATH, staticOptions))
app.use(`/${LORA_FOLDER_NAME}`, express.static(LORA_FOLDER_PATH, staticOptions))
app.use(`/${GALLERY_FOLDER_NAME}`, express.static(GALLERY_FOLDER_PATH, galleryOptions))

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

        // Find images for this specific version
        // Format: 1(version).png, 2(version).png
        const versionImages = []
        const allFiles = fs.readdirSync(folderPath)

        // Check for numbered images with version suffix
        for (let i = 1; i <= 10; i++) { // Check up to 10 images
          const imageFileName = `${i}(${versionName}).png`
          if (allFiles.includes(imageFileName)) {
            versionImages.push(`/${LORA_FOLDER_NAME}/character/${folder}/${imageFileName}`)
          }
        }

        // If no version-specific images found, check for generic numbered images
        if (versionImages.length === 0) {
          for (let i = 1; i <= 10; i++) {
            const imageFileName = `${i}.png`
            if (allFiles.includes(imageFileName)) {
              versionImages.push(`/${LORA_FOLDER_NAME}/character/${folder}/${imageFileName}`)
            }
          }
        }

        return {
          name: versionName,
          displayName: displayName,
          fileName: file,
          filePath: `/${LORA_FOLDER_NAME}/character/${folder}/${file}`,
          images: versionImages
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
        company: meta.company || '',
        group: meta.group || '',
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
        // Find first available image (prefer 1.png, fallback to 0.png or any image)
        const imageFiles = fs.readdirSync(folderPath)
          .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
          .sort()
        const firstImage = imageFiles.length > 0 ? imageFiles[0] : null

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
          thumbnail: firstImage ? `/${PROMPT_FOLDER_NAME}/${folder}/${firstImage}` : ''
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

        // Generate display name: character-cloth (same logic as main LoRA list)
        const loraDisplayName = meta.cloth && meta.cloth.trim() !== ''
          ? `${meta.character}-${meta.cloth}`
          : meta.character

        stats.loras.topDownloaded.push({
          id: folder,
          name: loraDisplayName || folder,
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

// ============================================
// GALLERY FEATURE - Authentication & APIs
// ============================================

// Authentication middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret-key')
    req.admin = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Admin login endpoint
app.post('/api/gallery/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body

    if (username !== (process.env.ADMIN_USERNAME || 'admin')) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    // If no password hash is set in env, use default password "admin"
    const passwordHash = process.env.ADMIN_PASSWORD_HASH || await bcrypt.hash('admin', 10)
    const isValid = await bcrypt.compare(password, passwordHash)

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET || 'default-secret-key',
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    )

    res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN || '24h' })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
})

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const { type, albumId } = req.params
    const uploadPath = path.join(GALLERY_FOLDER_PATH, type, albumId)

    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true })
    }

    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp + random + original extension
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    const ext = path.extname(file.originalname)
    const uniqueFilename = `${timestamp}_${random}${ext}`
    cb(null, uniqueFilename)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit (increased for videos)
  fileFilter: (req, file, cb) => {
    // Accept images and videos
    const allowedImageTypes = /jpeg|jpg|png|gif|webp/
    const allowedVideoTypes = /mp4|mov|avi|webm|mkv|flv|wmv|m4v/
    const ext = path.extname(file.originalname).toLowerCase().substring(1)

    const isImage = allowedImageTypes.test(ext) && file.mimetype.startsWith('image/')
    const isVideo = allowedVideoTypes.test(ext) && file.mimetype.startsWith('video/')

    if (isImage || isVideo) {
      cb(null, true)
    } else {
      cb(new Error('Only image and video files are allowed'))
    }
  }
})

// API route - get all static galleries
app.get('/api/gallery/static', async (req, res) => {
  try {
    const staticPath = path.join(GALLERY_FOLDER_PATH, 'static')

    if (!fs.existsSync(staticPath)) {
      return res.json([])
    }

    const folders = fs.readdirSync(staticPath).filter(file => {
      return fs.statSync(path.join(staticPath, file)).isDirectory()
    })

    const albums = folders.map(folder => {
      const folderPath = path.join(staticPath, folder)
      const metaPath = path.join(folderPath, 'meta.json')

      // Default metadata
      let meta = {
        id: folder,
        title: folder,
        description: '',
        author: '',
        sensitive: 'SFW',
        category: '',
        tags: [],
        order: 0,
        viewCount: 0,
        images: []
      }

      // Read meta.json
      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta = { ...meta, ...metaData }
        } catch (error) {
          console.error(`Error parsing meta.json for ${folder}:`, error)
        }
      }

      // Convert image filenames to full URLs
      const images = meta.images.map(filename =>
        `/${GALLERY_FOLDER_NAME}/static/${folder}/${filename}`
      )

      // Determine cover image
      const coverPath = path.join(folderPath, 'cover.jpg')
      const cover = fs.existsSync(coverPath)
        ? `/${GALLERY_FOLDER_NAME}/static/${folder}/cover.jpg`
        : images[0] || ''

      return {
        ...meta,
        cover,
        images,
        imageCount: images.length
      }
    })

    // Sort by order field
    albums.sort((a, b) => (a.order || 0) - (b.order || 0))

    res.json(albums)
  } catch (error) {
    console.error('Error reading static galleries:', error)
    res.status(500).json({ error: 'Failed to load galleries' })
  }
})

// API route - get all video galleries
app.get('/api/gallery/video', async (req, res) => {
  try {
    const videoPath = path.join(GALLERY_FOLDER_PATH, 'video')

    if (!fs.existsSync(videoPath)) {
      return res.json([])
    }

    const folders = fs.readdirSync(videoPath).filter(file => {
      return fs.statSync(path.join(videoPath, file)).isDirectory()
    })

    const albums = folders.map(folder => {
      const folderPath = path.join(videoPath, folder)
      const metaPath = path.join(folderPath, 'meta.json')

      let meta = {
        id: folder,
        title: folder,
        description: '',
        author: '',
        sensitive: 'SFW',
        category: '',
        tags: [],
        order: 0,
        viewCount: 0,
        images: []
      }

      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta = { ...meta, ...metaData }
        } catch (error) {
          console.error(`Error parsing meta.json for ${folder}:`, error)
        }
      }

      const images = meta.images.map(filename =>
        `/${GALLERY_FOLDER_NAME}/video/${folder}/${filename}`
      )

      const coverPath = path.join(folderPath, 'cover.jpg')
      const cover = fs.existsSync(coverPath)
        ? `/${GALLERY_FOLDER_NAME}/video/${folder}/cover.jpg`
        : images[0] || ''

      return {
        ...meta,
        cover,
        images,
        imageCount: images.length
      }
    })

    albums.sort((a, b) => (a.order || 0) - (b.order || 0))

    res.json(albums)
  } catch (error) {
    console.error('Error reading video galleries:', error)
    res.status(500).json({ error: 'Failed to load galleries' })
  }
})

// API route - get all story galleries (list view)
app.get('/api/gallery/story', async (req, res) => {
  try {
    const storyPath = path.join(GALLERY_FOLDER_PATH, 'story')

    if (!fs.existsSync(storyPath)) {
      return res.json([])
    }

    const folders = fs.readdirSync(storyPath).filter(file => {
      return fs.statSync(path.join(storyPath, file)).isDirectory()
    })

    const stories = folders.map(folder => {
      const folderPath = path.join(storyPath, folder)
      const metaPath = path.join(folderPath, 'meta.json')

      let meta = {
        id: folder,
        title: folder,
        description: '',
        author: '',
        sensitive: 'SFW',
        tags: [],
        order: 0,
        viewCount: 0,
        estimatedTime: '',
        pages: []
      }

      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta = { ...meta, ...metaData }
        } catch (error) {
          console.error(`Error parsing meta.json for ${folder}:`, error)
        }
      }

      const coverPath = path.join(folderPath, 'cover.jpg')
      const cover = fs.existsSync(coverPath)
        ? `/${GALLERY_FOLDER_NAME}/story/${folder}/cover.jpg`
        : ''

      // Return metadata only (no pages for list view)
      return {
        id: meta.id,
        title: meta.title,
        description: meta.description,
        author: meta.author,
        sensitive: meta.sensitive,
        tags: meta.tags,
        order: meta.order,
        viewCount: meta.viewCount,
        estimatedTime: meta.estimatedTime,
        cover,
        pageCount: meta.pages?.length || 0
      }
    })

    stories.sort((a, b) => (a.order || 0) - (b.order || 0))

    res.json(stories)
  } catch (error) {
    console.error('Error reading stories:', error)
    res.status(500).json({ error: 'Failed to load stories' })
  }
})

// API route - get specific story with pages
app.get('/api/gallery/story/:id', async (req, res) => {
  try {
    const { id } = req.params
    const storyPath = path.join(GALLERY_FOLDER_PATH, 'story', id)
    const metaPath = path.join(storyPath, 'meta.json')

    if (!fs.existsSync(storyPath)) {
      return res.status(404).json({ error: 'Story not found' })
    }

    let meta = { pages: [] }
    if (fs.existsSync(metaPath)) {
      try {
        meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      } catch (error) {
        return res.status(500).json({ error: 'Invalid meta.json' })
      }
    }

    // Convert relative image paths to absolute URLs
    const pages = meta.pages.map(page => {
      const convertedPage = { ...page }

      // Convert simple image path
      if (convertedPage.image) {
        convertedPage.image = `/${GALLERY_FOLDER_NAME}/story/${id}/${convertedPage.image}`
      }

      // Convert background path (for VN-style)
      if (convertedPage.background) {
        convertedPage.background = `/${GALLERY_FOLDER_NAME}/story/${id}/${convertedPage.background}`
      }

      // Convert character image path
      if (convertedPage.character?.image) {
        convertedPage.character.image = `/${GALLERY_FOLDER_NAME}/story/${id}/${convertedPage.character.image}`
      }

      return convertedPage
    })

    res.json({
      ...meta,
      pages
    })
  } catch (error) {
    console.error('Error reading story:', error)
    res.status(500).json({ error: 'Failed to load story' })
  }
})

// API route - increment gallery view count
app.post('/api/gallery/:type/:id/view', async (req, res) => {
  try {
    const { type, id } = req.params
    const metaPath = path.join(GALLERY_FOLDER_PATH, type, id, 'meta.json')

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.viewCount = (meta.viewCount || 0) + 1
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      res.json({ success: true, viewCount: meta.viewCount })
    } else {
      res.status(404).json({ error: 'Meta file not found' })
    }
  } catch (error) {
    console.error('Error updating view count:', error)
    res.status(500).json({ error: 'Failed to update view count' })
  }
})

// Admin API - Upload files (simplified - no conversion)
app.post('/api/gallery/admin/:type/:albumId/upload',
  authMiddleware,
  upload.array('images', 50),
  async (req, res) => {
    try {
      const { type, albumId } = req.params
      const uploadedFiles = req.files.map(file => file.filename)

      // Return uploaded filenames immediately
      res.json({
        message: 'Files uploaded successfully',
        files: uploadedFiles
      })
    } catch (error) {
      console.error('❌ [Upload] Error processing files:', error)
      res.status(500).json({ error: 'Failed to process uploaded files' })
    }
  }
)

// Admin API - Create album
app.post('/api/gallery/admin/:type/create', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params
    const { id, meta } = req.body

    const albumPath = path.join(GALLERY_FOLDER_PATH, type, id)
    const metaPath = path.join(albumPath, 'meta.json')

    // Check if album already exists (has meta.json)
    if (fs.existsSync(metaPath)) {
      return res.status(400).json({ error: 'Album already exists' })
    }

    // Create directory if it doesn't exist (might already exist from file uploads)
    if (!fs.existsSync(albumPath)) {
      fs.mkdirSync(albumPath, { recursive: true })
    }

    // Create meta.json
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    res.json({ success: true, id })
  } catch (error) {
    console.error('Error creating album:', error)
    res.status(500).json({ error: 'Failed to create album' })
  }
})

// Admin API - Update album order (MUST come before /:type/:id to avoid route conflict)
app.put('/api/gallery/admin/:type/reorder-albums', authMiddleware, async (req, res) => {
  try {
    const { type } = req.params
    const { albums } = req.body

    console.log('🔄 [REORDER-ALBUMS] Received request:', { type, albumCount: albums?.length })

    if (!albums || !Array.isArray(albums)) {
      console.log('❌ [REORDER-ALBUMS] Invalid albums array')
      return res.status(400).json({ error: 'Albums array is required' })
    }

    const typePath = path.join(GALLERY_FOLDER_PATH, type)

    if (!fs.existsSync(typePath)) {
      console.log('❌ [REORDER-ALBUMS] Type folder not found:', typePath)
      return res.status(404).json({ error: 'Gallery type not found' })
    }

    // Update order for each album
    let updatedCount = 0
    const notFoundAlbums = []

    for (const albumUpdate of albums) {
      const albumPath = path.join(typePath, albumUpdate.id)
      const metaPath = path.join(albumPath, 'meta.json')

      console.log(`🔍 [REORDER-ALBUMS] Checking album:`, {
        id: albumUpdate.id,
        order: albumUpdate.order,
        albumPath,
        metaPath,
        exists: fs.existsSync(metaPath)
      })

      if (fs.existsSync(metaPath)) {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        meta.order = albumUpdate.order
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        updatedCount++
      } else {
        notFoundAlbums.push(albumUpdate.id)
      }
    }

    console.log(`✅ [REORDER-ALBUMS] Successfully updated ${updatedCount}/${albums.length} albums`)

    if (notFoundAlbums.length > 0) {
      console.log(`⚠️ [REORDER-ALBUMS] Albums not found:`, notFoundAlbums)
    }

    res.json({ success: true, updatedCount, notFoundAlbums })
  } catch (error) {
    console.error('❌ [REORDER-ALBUMS] Error reordering albums:', error)
    res.status(500).json({ error: 'Failed to reorder albums' })
  }
})

// Admin API - Update album metadata
app.put('/api/gallery/admin/:type/:id', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params
    const { meta } = req.body

    const metaPath = path.join(GALLERY_FOLDER_PATH, type, id, 'meta.json')

    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Album not found' })
    }

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    res.json({ success: true })
  } catch (error) {
    console.error('Error updating album:', error)
    res.status(500).json({ error: 'Failed to update album' })
  }
})

// Admin API - Delete album
app.delete('/api/gallery/admin/:type/:id', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params
    const albumPath = path.join(GALLERY_FOLDER_PATH, type, id)

    if (!fs.existsSync(albumPath)) {
      return res.status(404).json({ error: 'Album not found' })
    }

    // Delete directory and all contents
    fs.rmSync(albumPath, { recursive: true, force: true })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting album:', error)
    res.status(500).json({ error: 'Failed to delete album' })
  }
})

// Admin API - Delete single image from album
app.delete('/api/gallery/admin/:type/:id/image', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params
    const { imagePath } = req.body

    if (!imagePath) {
      return res.status(400).json({ error: 'Image path is required' })
    }

    const albumPath = path.join(GALLERY_FOLDER_PATH, type, id)
    const metaPath = path.join(albumPath, 'meta.json')

    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Album not found' })
    }

    // Read current meta
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

    // Extract filename from path (e.g., "/gallery/static/album_id/image.jpg" -> "image.jpg")
    const filename = imagePath.split('/').pop()

    // Remove from images array
    if (!meta.images || !meta.images.includes(filename)) {
      return res.status(404).json({ error: 'Image not found in album' })
    }

    meta.images = meta.images.filter(img => img !== filename)

    // Delete the physical file
    const filePath = path.join(albumPath, filename)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Update meta.json
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    res.json({ success: true, images: meta.images })
  } catch (error) {
    console.error('Error deleting image:', error)
    res.status(500).json({ error: 'Failed to delete image' })
  }
})

// Admin API - Update image order in album
app.put('/api/gallery/admin/:type/:id/reorder', authMiddleware, async (req, res) => {
  try {
    const { type, id } = req.params
    const { images } = req.body

    console.log('🔄 [REORDER] Received request:', { type, id, images })

    if (!images || !Array.isArray(images)) {
      console.log('❌ [REORDER] Invalid images array')
      return res.status(400).json({ error: 'Images array is required' })
    }

    const albumPath = path.join(GALLERY_FOLDER_PATH, type, id)
    const metaPath = path.join(albumPath, 'meta.json')

    console.log('📁 [REORDER] Paths:', { albumPath, metaPath })

    if (!fs.existsSync(metaPath)) {
      console.log('❌ [REORDER] Album not found:', metaPath)
      return res.status(404).json({ error: 'Album not found' })
    }

    // Read current meta
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    console.log('📖 [REORDER] Current meta images:', meta.images)

    // Extract filenames from paths if needed
    const newImageOrder = images.map(img => {
      if (img.includes('/')) {
        return img.split('/').pop()
      }
      return img
    })

    console.log('🔄 [REORDER] New image order:', newImageOrder)

    // Update images order
    meta.images = newImageOrder

    // Update meta.json
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    console.log('✅ [REORDER] Successfully saved new order')

    res.json({ success: true, images: meta.images })
  } catch (error) {
    console.error('❌ [REORDER] Error reordering images:', error)
    res.status(500).json({ error: 'Failed to reorder images' })
  }
})

// API route - get metadata with last modified timestamps
app.get('/api/metadata', (req, res) => {
  try {
    const metadata = {
      prompts: { lastModified: 0 },
      loras: { lastModified: 0 },
      gallery: {
        static: { lastModified: 0 },
        video: { lastModified: 0 },
        story: { lastModified: 0 }
      }
    }

    // Get prompts folder last modified time
    if (fs.existsSync(PROMPT_FOLDER_PATH)) {
      const stats = fs.statSync(PROMPT_FOLDER_PATH)
      metadata.prompts.lastModified = stats.mtimeMs

      // Also check all subdirectories for the most recent change
      const folders = fs.readdirSync(PROMPT_FOLDER_PATH)
        .filter(file => fs.statSync(path.join(PROMPT_FOLDER_PATH, file)).isDirectory())

      folders.forEach(folder => {
        const folderPath = path.join(PROMPT_FOLDER_PATH, folder)
        const folderStats = fs.statSync(folderPath)
        if (folderStats.mtimeMs > metadata.prompts.lastModified) {
          metadata.prompts.lastModified = folderStats.mtimeMs
        }
      })
    }

    // Get loras folder last modified time
    const loraCharacterPath = path.join(LORA_FOLDER_PATH, 'character')
    if (fs.existsSync(loraCharacterPath)) {
      const stats = fs.statSync(loraCharacterPath)
      metadata.loras.lastModified = stats.mtimeMs

      // Check all subdirectories
      const folders = fs.readdirSync(loraCharacterPath)
        .filter(file => fs.statSync(path.join(loraCharacterPath, file)).isDirectory())

      folders.forEach(folder => {
        const folderPath = path.join(loraCharacterPath, folder)
        const folderStats = fs.statSync(folderPath)
        if (folderStats.mtimeMs > metadata.loras.lastModified) {
          metadata.loras.lastModified = folderStats.mtimeMs
        }
      })
    }

    // Get gallery folders last modified times
    const galleryTypes = ['static', 'video', 'story']
    galleryTypes.forEach(type => {
      const typePath = path.join(GALLERY_FOLDER_PATH, type)
      if (fs.existsSync(typePath)) {
        const stats = fs.statSync(typePath)
        metadata.gallery[type].lastModified = stats.mtimeMs

        // Check all subdirectories
        const folders = fs.readdirSync(typePath)
          .filter(file => fs.statSync(path.join(typePath, file)).isDirectory())

        folders.forEach(folder => {
          const folderPath = path.join(typePath, folder)
          const folderStats = fs.statSync(folderPath)
          if (folderStats.mtimeMs > metadata.gallery[type].lastModified) {
            metadata.gallery[type].lastModified = folderStats.mtimeMs
          }

          // Also check meta.json file modification time inside each album folder
          const metaPath = path.join(folderPath, 'meta.json')
          if (fs.existsSync(metaPath)) {
            const metaStats = fs.statSync(metaPath)
            if (metaStats.mtimeMs > metadata.gallery[type].lastModified) {
              metadata.gallery[type].lastModified = metaStats.mtimeMs
            }
          }
        })
      }
    })

    res.json(metadata)
  } catch (error) {
    console.error('Error reading metadata:', error)
    res.status(500).json({ error: 'Failed to load metadata' })
  }
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
