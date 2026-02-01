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

const COSTUME_FOLDER_PATH = config.costumeFolder
  ? (path.isAbsolute(config.costumeFolder.path)
    ? config.costumeFolder.path
    : path.join(__dirname, config.costumeFolder.path))
  : null
const COSTUME_FOLDER_NAME = config.costumeFolder?.name || 'costume'

const LORA_FOLDER_PATH = path.isAbsolute(config.loraFolder.path)
  ? config.loraFolder.path
  : path.join(__dirname, config.loraFolder.path)
const LORA_FOLDER_NAME = config.loraFolder.name

const GALLERY_FOLDER_PATH = path.isAbsolute(config.galleryFolder.path)
  ? config.galleryFolder.path
  : path.join(__dirname, config.galleryFolder.path)
const GALLERY_FOLDER_NAME = config.galleryFolder.name

const REQUEST_FOLDER_PATH = path.isAbsolute(config.requestFolder.path)
  ? config.requestFolder.path
  : path.join(__dirname, config.requestFolder.path)
const REQUEST_FOLDER_NAME = config.requestFolder.name

const app = express()
const PORT = 3001

// Enable CORS
app.use(cors())
app.use(express.json())

// Webhook configuration
const WEBHOOK_ENABLED = process.env.WEBHOOK_ENABLED === 'true'
const WEBHOOK_URL = process.env.WEBHOOK_URL
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

// Send webhook notification for new requests
async function sendWebhookNotification(eventType, data) {
  if (!WEBHOOK_ENABLED || !WEBHOOK_URL) {
    return
  }

  try {
    // Format message for Clawdbot
    let message = ''
    if (eventType === 'new_request') {
      message = `🎨 GlyphForge 收到新的 Request！\n` +
        `📝 類型: ${data.type}\n` +
        `👤 角色: ${data.characterName || '未指定'}\n` +
        `💬 備註: ${data.notes || '無'}\n` +
        `🔗 ID: ${data.id}`
    } else {
      message = `GlyphForge Event: ${eventType}\n${JSON.stringify(data, null, 2)}`
    }

    // Use Clawdbot webhook format
    const payload = {
      message: message,
      name: 'GlyphForge',
      deliver: true,
      channel: 'telegram'
    }

    const headers = {
      'Content-Type': 'application/json'
    }

    if (WEBHOOK_SECRET) {
      headers['Authorization'] = `Bearer ${WEBHOOK_SECRET}`
    }

    // Use /hooks/agent endpoint
    const webhookUrl = WEBHOOK_URL.replace(/\/hooks\/?$/, '/hooks/agent')
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      console.error(`Webhook notification failed: ${response.status} ${response.statusText}`)
    } else {
      console.log(`Webhook notification sent successfully for ${eventType}`)
    }
  } catch (error) {
    console.error('Error sending webhook notification:', error.message)
  }
}

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
if (COSTUME_FOLDER_PATH) {
  app.use(`/${COSTUME_FOLDER_NAME}`, express.static(COSTUME_FOLDER_PATH, staticOptions))
}
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

        // Add all available images (up to 2) with their actual modification time as cache key
        imageFiles.slice(0, 2).forEach(file => {
          const filePath = path.join(folderPath, file)
          const stats = fs.statSync(filePath)
          const mtime = stats.mtimeMs.toString(36) // Use base36 for shorter string
          images.push(`/${PROMPT_FOLDER_NAME}/${folder}/${file}?v=${mtime}`)
        })
      }

      const imagesWithCacheBuster = images
      
      return {
        id: folder,
        thumbnail: imagesWithCacheBuster[0] || '',
        images: imagesWithCacheBuster,
        imageOrientation: imageOrientation,
        prompt: promptText,
        title: meta.title || '',
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

// API route - get all costume data
app.get('/api/costumes', async (req, res) => {
  if (!COSTUME_FOLDER_PATH) {
    return res.json([])
  }
  
  try {
    const folders = fs.readdirSync(COSTUME_FOLDER_PATH).filter(file => {
      return fs.statSync(path.join(COSTUME_FOLDER_PATH, file)).isDirectory()
    })

    const costumes = folders.map(folder => {
      const folderPath = path.join(COSTUME_FOLDER_PATH, folder)
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
        type: 'Costume',
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
          console.error(`Error reading meta.json for costume ${folder}:`, error)
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

        // Add all available images (up to 2) with their actual modification time as cache key
        imageFiles.slice(0, 2).forEach(file => {
          const filePath = path.join(folderPath, file)
          const stats = fs.statSync(filePath)
          const mtime = stats.mtimeMs.toString(36) // Use base36 for shorter string
          images.push(`/${COSTUME_FOLDER_NAME}/${folder}/${file}?v=${mtime}`)
        })
      }

      const imagesWithCacheBuster = images
      
      return {
        id: folder,
        thumbnail: imagesWithCacheBuster[0] || '',
        images: imagesWithCacheBuster,
        imageOrientation: imageOrientation,
        prompt: promptText,
        title: meta.title || '',
        character: meta.character || 1,
        place: meta.place || 'Unknown',
        sensitive: meta.sensitive || 'Unknown',
        type: meta.type || 'Costume',
        view: meta.view || 'Unknown',
        nudity: meta.nudity || 'Unknown',
        stability: meta.stability || null,
        author: meta.author || 'dANNY',
        copyCount: meta.copyCount || 0
      }
    })

    // Load or create metadata
    const metadataPath = path.join(COSTUME_FOLDER_PATH, 'metadata.json')
    let metadata = { typeOrder: [], costumeOrder: {} }
    
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      } catch (error) {
        console.error('Error reading costume metadata:', error)
      }
    }

    // Get all unique types from costumes
    const allTypes = [...new Set(costumes.map(c => c.type).filter(t => t && t !== 'Unknown'))]
    
    // Check for new types and add them to typeOrder
    let metadataChanged = false
    allTypes.forEach(type => {
      if (!metadata.typeOrder.includes(type)) {
        metadata.typeOrder.push(type)
        metadataChanged = true
      }
    })
    
    // Remove types that no longer exist
    metadata.typeOrder = metadata.typeOrder.filter(type => allTypes.includes(type))
    
    // Initialize costumeOrder for new types and update existing ones
    allTypes.forEach(type => {
      const typeCostumes = costumes.filter(c => c.type === type).map(c => c.id)
      if (!metadata.costumeOrder[type]) {
        metadata.costumeOrder[type] = typeCostumes
        metadataChanged = true
      } else {
        // Add any new costumes to the end
        typeCostumes.forEach(id => {
          if (!metadata.costumeOrder[type].includes(id)) {
            metadata.costumeOrder[type].push(id)
            metadataChanged = true
          }
        })
        // Remove costumes that no longer exist or changed type
        metadata.costumeOrder[type] = metadata.costumeOrder[type].filter(id => typeCostumes.includes(id))
      }
    })
    
    // Remove costumeOrder entries for types that no longer exist
    Object.keys(metadata.costumeOrder).forEach(type => {
      if (!allTypes.includes(type)) {
        delete metadata.costumeOrder[type]
        metadataChanged = true
      }
    })
    
    // Save metadata if changed
    if (metadataChanged) {
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    }

    res.json({ costumes, metadata })
  } catch (error) {
    console.error('Error reading costumes:', error)
    res.status(500).json({ error: 'Failed to load costumes' })
  }
})

// API route - update costume metadata (type order and costume order)
app.put('/api/costumes/metadata', authMiddleware, (req, res) => {
  if (!COSTUME_FOLDER_PATH) {
    return res.status(404).json({ error: 'Costume folder not configured' })
  }

  try {
    const { typeOrder, costumeOrder } = req.body
    const metadataPath = path.join(COSTUME_FOLDER_PATH, 'metadata.json')
    
    let metadata = { typeOrder: [], costumeOrder: {} }
    if (fs.existsSync(metadataPath)) {
      try {
        metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'))
      } catch (error) {
        console.error('Error reading costume metadata:', error)
      }
    }
    
    if (typeOrder !== undefined) {
      metadata.typeOrder = typeOrder
    }
    if (costumeOrder !== undefined) {
      metadata.costumeOrder = { ...metadata.costumeOrder, ...costumeOrder }
    }
    
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))
    res.json({ success: true, metadata })
  } catch (error) {
    console.error('Error updating costume metadata:', error)
    res.status(500).json({ error: 'Failed to update metadata' })
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

      // Get modification times for cache busting
      const thumbnailMtime = fs.existsSync(thumbnailPath) ? fs.statSync(thumbnailPath).mtimeMs.toString(36) : ''
      const previewMtime = fs.existsSync(previewPath) ? fs.statSync(previewPath).mtimeMs.toString(36) : ''

      return {
        id: folder,
        name: displayName,
        thumbnail: fs.existsSync(thumbnailPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/0.png?v=${thumbnailMtime}` : '',
        preview: fs.existsSync(previewPath) ? `/${LORA_FOLDER_NAME}/character/${folder}/1.png?v=${previewMtime}` : '',
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

// API route - increment costume copy count
app.post('/api/costumes/:id/copy', (req, res) => {
  if (!COSTUME_FOLDER_PATH) {
    return res.status(404).json({ error: 'Costume folder not configured' })
  }
  
  try {
    const { id } = req.params
    const metaPath = path.join(COSTUME_FOLDER_PATH, id, 'meta.json')

    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      meta.copyCount = (meta.copyCount || 0) + 1
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      res.json({ success: true, copyCount: meta.copyCount })
    } else {
      res.status(404).json({ error: 'Meta file not found' })
    }
  } catch (error) {
    console.error('Error updating costume copy count:', error)
    res.status(500).json({ error: 'Failed to update copy count' })
  }
})

// API route - create new costume (admin only)
app.post('/api/costumes', authMiddleware, (req, res) => {
  if (!COSTUME_FOLDER_PATH) {
    return res.status(404).json({ error: 'Costume folder not configured' })
  }

  try {
    const { title, prompt, character, place, sensitive, type, view, nudity, stability, author } = req.body

    // Find next available ID (folder name)
    const existingFolders = fs.readdirSync(COSTUME_FOLDER_PATH)
      .filter(file => fs.statSync(path.join(COSTUME_FOLDER_PATH, file)).isDirectory())
      .map(f => parseInt(f))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)

    const nextId = existingFolders.length > 0 ? Math.max(...existingFolders) + 1 : 0
    const newFolderPath = path.join(COSTUME_FOLDER_PATH, nextId.toString())

    // Create folder
    fs.mkdirSync(newFolderPath, { recursive: true })

    // Create prompt.txt
    fs.writeFileSync(path.join(newFolderPath, 'prompt.txt'), prompt || '', 'utf-8')

    // Create meta.json
    const meta = {
      title: title || '',
      character: character || 1,
      place: place || 'Unknown',
      sensitive: sensitive || 'SFW',
      type: type || 'Costume',
      view: view || 'Unknown',
      nudity: nudity || 'Unknown',
      stability: stability || 1,
      author: author || 'dANNY',
      copyCount: 0
    }
    fs.writeFileSync(path.join(newFolderPath, 'meta.json'), JSON.stringify(meta, null, 2))

    res.json({
      success: true,
      message: 'Costume created successfully',
      id: nextId.toString()
    })
  } catch (error) {
    console.error('Error creating costume:', error)
    res.status(500).json({ error: 'Failed to create costume' })
  }
})

// API route - update costume (admin only)
app.put('/api/costumes/:id', authMiddleware, (req, res) => {
  if (!COSTUME_FOLDER_PATH) {
    return res.status(404).json({ error: 'Costume folder not configured' })
  }

  try {
    const { id } = req.params
    const { title, prompt, character, place, sensitive, type, view, nudity, stability, author } = req.body
    const folderPath = path.join(COSTUME_FOLDER_PATH, id)
    const metaPath = path.join(folderPath, 'meta.json')
    const promptPath = path.join(folderPath, 'prompt.txt')

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Costume folder not found' })
    }

    // Update prompt.txt
    if (prompt !== undefined) {
      fs.writeFileSync(promptPath, prompt, 'utf-8')
    }

    // Update meta.json
    let meta = {}
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    }

    // Update meta fields if provided
    if (title !== undefined) meta.title = title
    if (character !== undefined) meta.character = character
    if (place !== undefined) meta.place = place
    if (sensitive !== undefined) meta.sensitive = sensitive
    if (type !== undefined) meta.type = type
    if (view !== undefined) meta.view = view
    if (nudity !== undefined) meta.nudity = nudity
    if (stability !== undefined) meta.stability = stability
    if (author !== undefined) meta.author = author

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    res.json({ success: true, message: 'Costume updated successfully' })
  } catch (error) {
    console.error('Error updating costume:', error)
    res.status(500).json({ error: 'Failed to update costume' })
  }
})

// Configure multer for costume image uploads
const costumeUploadFilenames = new Map()

const costumeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!COSTUME_FOLDER_PATH) {
      return cb(new Error('Costume folder not configured'), null)
    }

    const { id, imageIndex } = req.params
    const uploadPath = path.join(COSTUME_FOLDER_PATH, id)

    if (!fs.existsSync(uploadPath)) {
      return cb(new Error('Costume folder not found'), null)
    }

    // Get existing images sorted
    const existingFiles = fs.readdirSync(uploadPath)
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
    
    const idx = parseInt(imageIndex)
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    
    // Determine the filename for the new file
    let newFilename
    if (existingFiles[idx]) {
      // Replace existing: use same base name with new extension
      const oldBaseName = path.basename(existingFiles[idx], path.extname(existingFiles[idx]))
      newFilename = `${oldBaseName}${ext}`
      
      // Delete the old file
      const fileToDelete = path.join(uploadPath, existingFiles[idx])
      console.log('Deleting existing costume file:', fileToDelete)
      fs.unlinkSync(fileToDelete)
    } else {
      // New file: use 0-based naming (0.png, 1.png, ...)
      newFilename = `${idx}${ext}`
    }
    
    // Store filename for this request
    costumeUploadFilenames.set(`${id}-${imageIndex}`, newFilename)
    
    cb(null, uploadPath)
  },
  filename: function (req, file, cb) {
    const { id, imageIndex } = req.params
    const key = `${id}-${imageIndex}`
    const filename = costumeUploadFilenames.get(key) || `${parseInt(imageIndex) + 1}.png`
    costumeUploadFilenames.delete(key)
    cb(null, filename)
  }
})

const costumeUpload = multer({
  storage: costumeStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP files are allowed'))
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// API route - upload costume image (admin only)
app.post('/api/costumes/:id/image/:imageIndex', authMiddleware, costumeUpload.single('image'), (req, res) => {
  console.log('Upload costume image called:', { id: req.params.id, imageIndex: req.params.imageIndex, file: req.file?.filename })
  
  if (!COSTUME_FOLDER_PATH) {
    return res.status(404).json({ error: 'Costume folder not configured' })
  }

  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const { id } = req.params
    const folderPath = path.join(COSTUME_FOLDER_PATH, id)

    // Get updated image list
    const files = fs.readdirSync(folderPath)
    const imageFiles = files.filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file)).sort()
    const images = imageFiles.map(file => `/${COSTUME_FOLDER_NAME}/${id}/${file}`)

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename: req.file.filename,
      images: images
    })
  } catch (error) {
    console.error('Error uploading costume image:', error)
    res.status(500).json({ error: 'Failed to upload image' })
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

// Alias for backwards compatibility
const verifyToken = authMiddleware

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

// ===============================================
// PROMPT ADMIN APIs
// ===============================================

// API route - create new prompt (admin only)
app.post('/api/prompts', authMiddleware, (req, res) => {
  try {
    const { title, prompt, character, place, sensitive, type, view, nudity, stability, author } = req.body

    // Find next available ID (folder name)
    const existingFolders = fs.readdirSync(PROMPT_FOLDER_PATH)
      .filter(file => fs.statSync(path.join(PROMPT_FOLDER_PATH, file)).isDirectory())
      .map(f => parseInt(f))
      .filter(n => !isNaN(n))
      .sort((a, b) => a - b)

    const nextId = existingFolders.length > 0 ? Math.max(...existingFolders) + 1 : 0
    const newFolderPath = path.join(PROMPT_FOLDER_PATH, nextId.toString())

    // Create folder
    fs.mkdirSync(newFolderPath, { recursive: true })

    // Create prompt.txt
    fs.writeFileSync(path.join(newFolderPath, 'prompt.txt'), prompt || '', 'utf-8')

    // Create meta.json
    const meta = {
      title: title || '',
      character: character || 1,
      place: place || 'Unknown',
      sensitive: sensitive || 'SFW',
      type: type || 'Unknown',
      view: view || 'Unknown',
      nudity: nudity || 'Unknown',
      stability: stability || 1,
      author: author || 'dANNY',
      copyCount: 0
    }
    fs.writeFileSync(path.join(newFolderPath, 'meta.json'), JSON.stringify(meta, null, 2))

    // Create placeholder images (1.png will be required to upload)
    res.json({
      success: true,
      message: 'Prompt created successfully',
      id: nextId.toString()
    })
  } catch (error) {
    console.error('Error creating prompt:', error)
    res.status(500).json({ error: 'Failed to create prompt' })
  }
})

// API route - get unique field values for prompts
app.get('/api/prompts/fields', (req, res) => {
  try {
    const folders = fs.readdirSync(PROMPT_FOLDER_PATH).filter(file => {
      return fs.statSync(path.join(PROMPT_FOLDER_PATH, file)).isDirectory()
    })

    const fields = {
      place: new Set(),
      type: new Set(),
      view: new Set(),
      nudity: new Set()
    }

    folders.forEach(folder => {
      const metaPath = path.join(PROMPT_FOLDER_PATH, folder, 'meta.json')
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          if (meta.place && meta.place !== 'Unknown') fields.place.add(meta.place)
          if (meta.type && meta.type !== 'Unknown') fields.type.add(meta.type)
          if (meta.view && meta.view !== 'Unknown') fields.view.add(meta.view)
          if (meta.nudity && meta.nudity !== 'Unknown') fields.nudity.add(meta.nudity)
        } catch (e) {}
      }
    })

    res.json({
      place: Array.from(fields.place).sort(),
      type: Array.from(fields.type).sort(),
      view: Array.from(fields.view).sort(),
      nudity: Array.from(fields.nudity).sort()
    })
  } catch (error) {
    console.error('Error getting prompt fields:', error)
    res.status(500).json({ error: 'Failed to get fields' })
  }
})

// API route - update prompt (admin only)
app.put('/api/prompts/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params
    const { title, prompt, character, place, sensitive, type, view, nudity, stability, author } = req.body
    const folderPath = path.join(PROMPT_FOLDER_PATH, id)
    const metaPath = path.join(folderPath, 'meta.json')
    const promptPath = path.join(folderPath, 'prompt.txt')

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: 'Prompt folder not found' })
    }

    // Update prompt.txt
    if (prompt !== undefined) {
      fs.writeFileSync(promptPath, prompt, 'utf-8')
    }

    // Update meta.json
    let meta = {}
    if (fs.existsSync(metaPath)) {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    }

    // Update meta fields if provided
    if (title !== undefined) meta.title = title
    if (character !== undefined) meta.character = character
    if (place !== undefined) meta.place = place
    if (sensitive !== undefined) meta.sensitive = sensitive
    if (type !== undefined) meta.type = type
    if (view !== undefined) meta.view = view
    if (nudity !== undefined) meta.nudity = nudity
    if (stability !== undefined) meta.stability = stability
    if (author !== undefined) meta.author = author

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    res.json({ success: true, message: 'Prompt updated successfully' })
  } catch (error) {
    console.error('Error updating prompt:', error)
    res.status(500).json({ error: 'Failed to update prompt' })
  }
})

// Configure multer for prompt image uploads
// Store the filename to use for the new upload
const promptUploadFilenames = new Map()

const promptStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { id, imageIndex } = req.params
    const uploadPath = path.join(PROMPT_FOLDER_PATH, id)

    if (!fs.existsSync(uploadPath)) {
      return cb(new Error('Prompt folder not found'), null)
    }

    // Get existing images sorted
    const existingFiles = fs.readdirSync(uploadPath)
      .filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort()
    
    const idx = parseInt(imageIndex)
    const ext = path.extname(file.originalname).toLowerCase() || '.png'
    
    // Determine the filename for the new file
    let newFilename
    if (existingFiles[idx]) {
      // Replace existing: use same base name with new extension
      const oldBaseName = path.basename(existingFiles[idx], path.extname(existingFiles[idx]))
      newFilename = `${oldBaseName}${ext}`
      
      // Delete the old file
      const fileToDelete = path.join(uploadPath, existingFiles[idx])
      console.log('Deleting existing file:', fileToDelete)
      fs.unlinkSync(fileToDelete)
    } else {
      // New file: use 0-based naming (0.png, 1.png, ...)
      newFilename = `${idx}${ext}`
    }
    
    // Store filename for this request
    promptUploadFilenames.set(`${id}-${imageIndex}`, newFilename)
    
    cb(null, uploadPath)
  },
  filename: function (req, file, cb) {
    const { id, imageIndex } = req.params
    const key = `${id}-${imageIndex}`
    const filename = promptUploadFilenames.get(key) || `${parseInt(imageIndex) + 1}.png`
    promptUploadFilenames.delete(key)
    cb(null, filename)
  }
})

const promptUpload = multer({
  storage: promptStorage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP files are allowed'))
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
})

// API route - upload prompt image (admin only)
// imageIndex is passed as URL param to ensure it's available during multer processing
app.post('/api/prompts/:id/image/:imageIndex', authMiddleware, promptUpload.single('image'), (req, res) => {
  console.log('Upload image called:', { id: req.params.id, imageIndex: req.params.imageIndex, file: req.file?.filename })
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' })
    }

    const { id } = req.params
    const folderPath = path.join(PROMPT_FOLDER_PATH, id)

    // Get updated image list
    const files = fs.readdirSync(folderPath)
    const imageFiles = files.filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file)).sort()
    const images = imageFiles.map(file => `/${PROMPT_FOLDER_NAME}/${id}/${file}`)

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      filename: req.file.filename,
      images: images
    })
  } catch (error) {
    console.error('Error uploading prompt image:', error)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// ===============================================
// GALLERY UPLOAD CONFIGURATION
// ===============================================

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

// ========================================
// REQUESTS API
// ========================================

// Ensure request directory exists
const ensureRequestDir = () => {
  if (!fs.existsSync(REQUEST_FOLDER_PATH)) {
    fs.mkdirSync(REQUEST_FOLDER_PATH, { recursive: true })
  }
}

// Get all requests
app.get('/api/requests', (req, res) => {
  try {
    ensureRequestDir()

    const folders = fs.readdirSync(REQUEST_FOLDER_PATH).filter(file => {
      const fullPath = path.join(REQUEST_FOLDER_PATH, file)
      return fs.statSync(fullPath).isDirectory()
    })

    const requests = folders.map(folder => {
      const folderPath = path.join(REQUEST_FOLDER_PATH, folder)
      const metaPath = path.join(folderPath, 'meta.json')

      // Default metadata
      let meta = {
        id: folder,
        type: 'lora',
        status: 'pending',
        characterName: '',
        outfit: '',
        channelLink: '',
        socialMediaLink: '',
        createdAt: new Date().toISOString(),
        order: 999999
      }

      // Read meta.json
      if (fs.existsSync(metaPath)) {
        try {
          const metaData = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta = { ...meta, ...metaData, id: folder } // Ensure id matches folder name
        } catch (error) {
          console.error(`Error parsing meta.json for request ${folder}:`, error)
        }
      }

      return meta
    })

    // Sort by order field (lowest first)
    requests.sort((a, b) => (a.order || 999999) - (b.order || 999999))

    res.json(requests)
  } catch (error) {
    console.error('Error reading requests:', error)
    res.status(500).json({ error: 'Failed to load requests' })
  }
})

// Create new request
app.post('/api/requests', (req, res) => {
  try {
    ensureRequestDir()

    const id = Date.now().toString()
    const requestPath = path.join(REQUEST_FOLDER_PATH, id)

    // Create request folder
    fs.mkdirSync(requestPath, { recursive: true })

    // Get highest order number from existing requests
    const folders = fs.readdirSync(REQUEST_FOLDER_PATH).filter(file => {
      const fullPath = path.join(REQUEST_FOLDER_PATH, file)
      return fs.statSync(fullPath).isDirectory()
    })

    let maxOrder = -1
    folders.forEach(folder => {
      const metaPath = path.join(REQUEST_FOLDER_PATH, folder, 'meta.json')
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          if (meta.order !== undefined && meta.order > maxOrder) {
            maxOrder = meta.order
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    })

    const newRequest = {
      id,
      ...req.body,
      status: req.body.status || 'pending',
      createdAt: new Date().toISOString(),
      order: maxOrder + 1
    }

    // Write meta.json
    const metaPath = path.join(requestPath, 'meta.json')
    fs.writeFileSync(metaPath, JSON.stringify(newRequest, null, 2))

    // Send webhook notification for new request
    sendWebhookNotification('new_request', newRequest)

    res.status(201).json(newRequest)
  } catch (error) {
    console.error('Error creating request:', error)
    res.status(500).json({ error: 'Failed to create request' })
  }
})

// Update request status (admin only)
app.put('/api/requests/:id/status', verifyToken, (req, res) => {
  try {
    const { id } = req.params
    const { status } = req.body
    const metaPath = path.join(REQUEST_FOLDER_PATH, id, 'meta.json')

    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Request not found' })
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
    meta.status = status
    meta.updatedAt = new Date().toISOString()

    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

    res.json(meta)
  } catch (error) {
    console.error('Error updating request status:', error)
    res.status(500).json({ error: 'Failed to update request status' })
  }
})

// Update entire request (admin only)
app.put('/api/requests/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params
    const metaPath = path.join(REQUEST_FOLDER_PATH, id, 'meta.json')

    if (!fs.existsSync(metaPath)) {
      return res.status(404).json({ error: 'Request not found' })
    }

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

    // Update meta with new data, preserving id, createdAt, and order
    const updatedMeta = {
      ...meta,
      ...req.body,
      id, // Preserve original ID
      createdAt: meta.createdAt, // Preserve creation date
      order: meta.order, // Preserve order
      updatedAt: new Date().toISOString()
    }

    fs.writeFileSync(metaPath, JSON.stringify(updatedMeta, null, 2))

    res.json(updatedMeta)
  } catch (error) {
    console.error('Error updating request:', error)
    res.status(500).json({ error: 'Failed to update request' })
  }
})

// Delete request (admin only)
app.delete('/api/requests/:id', verifyToken, (req, res) => {
  try {
    const { id } = req.params
    const requestPath = path.join(REQUEST_FOLDER_PATH, id)

    if (!fs.existsSync(requestPath)) {
      return res.status(404).json({ error: 'Request not found' })
    }

    // Delete entire folder
    fs.rmSync(requestPath, { recursive: true, force: true })

    res.json({ success: true })
  } catch (error) {
    console.error('Error deleting request:', error)
    res.status(500).json({ error: 'Failed to delete request' })
  }
})

// Reorder requests (admin only)
app.put('/api/requests/reorder', verifyToken, (req, res) => {
  try {
    const { orderedIds } = req.body

    if (!Array.isArray(orderedIds)) {
      return res.status(400).json({ error: 'orderedIds must be an array' })
    }

    // Update order field in each request's meta.json
    orderedIds.forEach((id, index) => {
      const metaPath = path.join(REQUEST_FOLDER_PATH, id, 'meta.json')
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          meta.order = index
          fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
        } catch (error) {
          console.error(`Error updating order for request ${id}:`, error)
        }
      }
    })

    // Return updated requests
    const requests = orderedIds.map(id => {
      const metaPath = path.join(REQUEST_FOLDER_PATH, id, 'meta.json')
      if (fs.existsSync(metaPath)) {
        try {
          return JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
        } catch (error) {
          return null
        }
      }
      return null
    }).filter(Boolean)

    res.json(requests)
  } catch (error) {
    console.error('Error reordering requests:', error)
    res.status(500).json({ error: 'Failed to reorder requests' })
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
