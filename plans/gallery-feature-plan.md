# Gallery Feature Implementation Plan

## Overview

Add a new **Gallery** tab with three content types:
1. **Static Gallery** - Image collections
2. **GIF Gallery** - Animated images collection
3. **Story Gallery** - Visual novel-style content (images + text)

Each type supports multiple albums, following the same folder-based structure as existing prompts and LoRAs.

---

## Key Requirements

### Folder Structure Consistency
- Follow the same pattern as existing `prompt` and `LoRA` folders
- Each album = one folder containing `meta.json` + content files
- Support configurable paths (absolute or relative) via `config.json`
- Support different base paths (PC and NAS) with same structure
- Easy manual management and import

### Data Source Structure
Current implementation uses:
- **config.json**: Defines folder paths and names
- **Folder-based**: Each item (prompt/lora) is a folder
- **meta.json**: Metadata in each folder
- **Static serving**: Express.static for file access

Gallery should follow the same approach.

---

## Configuration Structure

### config.json Addition
```json
{
  "promptFolder": {
    "path": "D:\\Glyphforge-data\\prompt\\",
    "name": "prompt"
  },
  "loraFolder": {
    "path": "D:\\Glyphforge-data\\LoRA\\",
    "name": "LoRA"
  },
  "galleryFolder": {
    "path": "D:\\Glyphforge-data\\gallery\\",
    "name": "gallery"
  }
}
```

### Folder Structure
```
gallery/
├── static/                    # Static image galleries
│   ├── album_001/
│   │   ├── meta.json         # Album metadata (includes images array)
│   │   ├── cover.jpg         # Optional thumbnail (auto-use first if missing)
│   │   ├── 1.jpg             # Images in order
│   │   ├── 2.jpg
│   │   └── 3.jpg
│   └── album_002/
│       ├── meta.json
│       └── ...
├── gif/                       # GIF galleries (same structure as static)
│   ├── gif_001/
│   │   ├── meta.json
│   │   ├── cover.jpg         # Static cover for preview
│   │   ├── 1.gif             # GIFs in order
│   │   └── 2.gif
│   └── gif_002/
│       └── ...
└── story/                     # Story galleries
    ├── story_001/
    │   ├── meta.json          # Story metadata (includes pages)
    │   ├── cover.jpg          # Story thumbnail
    │   ├── 1.jpg              # Images referenced in pages
    │   ├── 2.jpg
    │   ├── 3.gif              # Can mix images and GIFs
    │   ├── backgrounds/       # Optional: for VN-style
    │   │   └── bg1.jpg
    │   └── characters/        # Optional: for VN-style
    │       └── char_a.png
    └── story_002/
        └── ...
```

**Key Points:**
- **Static/GIF**: Simple flat structure, images listed in `meta.json`
- **Story**: Can be flat (simple) or organized (VN-style) with subfolders
- **Cover**: Optional `cover.jpg` - if missing, first image is used
- **Flexibility**: Choose structure based on story complexity

---

## Data Structures

### 1. Static/GIF Gallery meta.json
Same structure for both static images and GIFs - simple and clean.

```json
{
  "id": "album_001",
  "title": "Album Title",
  "description": "Album description",
  "author": "Author Name",
  "createdAt": "2024-01-01",
  "sensitive": "SFW",
  "category": "character",
  "tags": ["tag1", "tag2"],
  "order": 1,
  "viewCount": 0,
  "images": [
    "1.jpg",
    "2.jpg",
    "3.jpg"
  ]
}
```

**Field Descriptions:**
- `images`: Array of filenames in display order
- `category`: Classification like "character", "scene", "concept", etc.
- `tags`: Flexible tagging for filtering (e.g., character names, themes)

**Notes:**
- Images are displayed in array order
- Server automatically generates URLs: `/{GALLERY_FOLDER_NAME}/static/{album_id}/{filename}`
- `cover.jpg` is optional - if not present, first image is used

---

### 2. Story Gallery Structure

Story galleries bind text and media together. Two approaches supported:

#### Approach A: Simple Image-Text Pairs (Recommended for most cases)
```json
{
  "id": "story_001",
  "title": "Story Title",
  "description": "Story synopsis",
  "author": "Author Name",
  "createdAt": "2024-01-01",
  "sensitive": "SFW",
  "tags": ["romance", "adventure"],
  "order": 1,
  "viewCount": 0,
  "estimatedTime": "15 min",
  "pages": [
    {
      "type": "text",
      "content": "Opening text without image..."
    },
    {
      "type": "image",
      "image": "1.jpg",
      "caption": "Optional caption for the image"
    },
    {
      "type": "both",
      "image": "2.jpg",
      "content": "Text that appears with the image..."
    },
    {
      "type": "both",
      "image": "3.gif",
      "content": "Support for GIFs too!"
    }
  ]
}
```

#### Approach B: Visual Novel Style (For dialogue-heavy stories)
```json
{
  "id": "story_002",
  "title": "Visual Novel Story",
  "description": "Story with dialogue",
  "author": "Author Name",
  "createdAt": "2024-01-01",
  "sensitive": "SFW",
  "tags": ["dialogue", "characters"],
  "order": 1,
  "viewCount": 0,
  "estimatedTime": "20 min",
  "pages": [
    {
      "type": "scene",
      "background": "backgrounds/bg1.jpg",
      "content": "Scene description or narration..."
    },
    {
      "type": "dialogue",
      "background": "backgrounds/bg1.jpg",
      "character": {
        "name": "Character A",
        "image": "characters/char_a.png",
        "position": "left"
      },
      "content": "Character dialogue text..."
    },
    {
      "type": "dialogue",
      "background": "backgrounds/bg2.jpg",
      "character": {
        "name": "Character B",
        "image": "characters/char_b.png",
        "position": "right"
      },
      "content": "Response dialogue..."
    },
    {
      "type": "image",
      "image": "event_cg.jpg",
      "content": "Event scene with text overlay"
    }
  ]
}
```

**Page Type Definitions:**

| Type | Description | Required Fields | Optional Fields |
|------|-------------|-----------------|-----------------|
| `text` | Text only | `content` | - |
| `image` | Image only | `image` | `caption` |
| `both` | Image + text | `image`, `content` | `caption` |
| `scene` | VN background + narration | `background`, `content` | - |
| `dialogue` | VN dialogue with character | `background`, `character`, `content` | - |

**Character Object:**
```json
{
  "name": "Character Name",
  "image": "characters/filename.png",
  "position": "left|center|right"
}
```

---

## Backend API Design

### Server.js Configuration
```javascript
// Load gallery configuration
const GALLERY_FOLDER_PATH = path.isAbsolute(config.galleryFolder.path)
  ? config.galleryFolder.path
  : path.join(__dirname, config.galleryFolder.path)
const GALLERY_FOLDER_NAME = config.galleryFolder.name

// Static file serving
app.use(`/${GALLERY_FOLDER_NAME}`, express.static(GALLERY_FOLDER_PATH))
```

### API Endpoints
```javascript
// Public endpoints
GET  /api/gallery/static          // Get all static galleries
GET  /api/gallery/gif             // Get all GIF galleries
GET  /api/gallery/story           // Get all story galleries
GET  /api/gallery/:type/:id       // Get specific album/story details
POST /api/gallery/:type/:id/view  // Increment view count

// Admin endpoints (requires authentication)
POST   /api/gallery/admin/login         // Admin login
POST   /api/gallery/admin/:type/create  // Create new album
PUT    /api/gallery/admin/:type/:id     // Update album metadata
DELETE /api/gallery/admin/:type/:id     // Delete album
POST   /api/gallery/admin/upload        // Upload files
```

### Example Implementation

#### GET /api/gallery/static
```javascript
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
```

**Same structure for GIF galleries:**
```javascript
app.get('/api/gallery/gif', async (req, res) => {
  // Identical to static, just change path to 'gif'
  const gifPath = path.join(GALLERY_FOLDER_PATH, 'gif')
  // ... rest is same as static gallery
})
```

#### GET /api/gallery/story (Get all stories)
```javascript
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

      // Cover image
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
```

#### GET /api/gallery/story/:id (Get specific story with pages)
```javascript
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
```

---

## Authentication & Security

### Environment Variables (.env)
```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$... # bcrypt hash
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=24h
```

### Generate Password Hash
```javascript
// Run this once to generate password hash
import bcrypt from 'bcrypt'

const password = 'your-password-here'
const hash = await bcrypt.hash(password, 10)
console.log('Password hash:', hash)
// Add this hash to .env as ADMIN_PASSWORD_HASH
```

### Authentication Middleware
```javascript
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1]

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.admin = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

// Login endpoint
app.post('/api/gallery/admin/login', async (req, res) => {
  const { username, password } = req.body

  if (username !== process.env.ADMIN_USERNAME) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const isValid = await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { username, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  )

  res.json({ token, expiresIn: process.env.JWT_EXPIRES_IN })
})

// Protected routes
app.post('/api/gallery/admin/:type/create', authMiddleware, (req, res) => {
  // Create album logic
})
```

### Security Features
- ✅ bcrypt password hashing (no plaintext storage)
- ✅ JWT token authentication
- ✅ Token expiration
- ✅ Authorization header validation
- ✅ Rate limiting (optional)
- ✅ HTTPS enforcement (production)

---

## Frontend Components

### Component Structure
```
app/src/
├── components/
│   └── Gallery/
│       ├── GalleryTab.jsx           # Main gallery tab
│       ├── CategoryNav.jsx          # Three category navigation
│       ├── AlbumGrid.jsx            # Album grid layout
│       ├── AlbumCard.jsx            # Album card component
│       ├── Viewers/
│       │   ├── StaticViewer.jsx    # Static image viewer
│       │   ├── GifViewer.jsx       # GIF viewer
│       │   └── StoryViewer.jsx     # Visual novel reader
│       ├── Admin/
│       │   ├── AdminLogin.jsx      # Admin login form
│       │   ├── AdminPanel.jsx      # Admin dashboard
│       │   └── AlbumEditor.jsx     # Album CRUD interface
│       └── Gallery.css
```

### Story Viewer Features
- Page navigation (previous/next)
- Progress tracking (save to localStorage)
- Keyboard shortcuts (arrow keys, space)
- Fullscreen mode
- Text animation (fade in, typewriter effect)
- Auto-play mode (optional)
- Background music support (optional)

---

## Implementation Phases

### Phase 1: Backend Foundation (1-2 days)
- [ ] Add gallery config to config.json
- [ ] Create folder structure
- [ ] Install dependencies: `bcrypt`, `jsonwebtoken`, `multer`
- [ ] Implement authentication middleware
- [ ] Create API endpoints for static/gif/story galleries
- [ ] Test API with sample data

### Phase 2: Admin System (2-3 days)
- [ ] Create admin login component
- [ ] Implement JWT token storage (localStorage)
- [ ] Create admin panel UI
- [ ] Implement album CRUD operations
- [ ] Add file upload functionality
- [ ] Add meta.json editing interface

### Phase 3: Gallery Display (3-4 days)
- [ ] Add Gallery tab to main app
- [ ] Create category navigation
- [ ] Implement album grid layout
- [ ] Create static image viewer (with lightbox)
- [ ] Create GIF viewer
- [ ] Implement visual novel reader
  - [ ] Page navigation
  - [ ] Text display
  - [ ] Background/character rendering
  - [ ] Progress saving

### Phase 4: Polish & Testing (1-2 days)
- [ ] Responsive design (mobile/desktop)
- [ ] Image lazy loading
- [ ] Performance optimization
- [ ] Security testing
- [ ] Manual folder import testing

---

## Manual Management Workflow

### Adding a Static/GIF Gallery

**Step 1: Create folder**
```bash
gallery/static/my_character_album/
```

**Step 2: Add images**
- Place images in order: `1.jpg`, `2.jpg`, `3.jpg`, etc.
- Optionally add `cover.jpg` for custom thumbnail

**Step 3: Create meta.json**
```json
{
  "id": "my_character_album",
  "title": "Character Name - Outfit",
  "description": "Character showcase album",
  "author": "dANNY",
  "createdAt": "2024-01-25",
  "sensitive": "SFW",
  "category": "character",
  "tags": ["character_name", "theme", "style"],
  "order": 1,
  "images": [
    "1.jpg",
    "2.jpg",
    "3.jpg"
  ]
}
```

**Step 4: Sync and reload**
- If on NAS: Files automatically sync to PC
- Restart server or wait for auto-reload (if implemented)

---

### Adding a Simple Story

**Step 1: Create folder**
```bash
gallery/story/my_story/
```

**Step 2: Add images**
- Place all images: `1.jpg`, `2.jpg`, `3.gif`, etc.
- Add `cover.jpg` for thumbnail

**Step 3: Create meta.json with pages**
```json
{
  "id": "my_story",
  "title": "My Story Title",
  "description": "A short story about...",
  "author": "dANNY",
  "createdAt": "2024-01-25",
  "sensitive": "SFW",
  "tags": ["romance", "slice_of_life"],
  "order": 1,
  "estimatedTime": "5 min",
  "pages": [
    {
      "type": "text",
      "content": "It was a beautiful morning..."
    },
    {
      "type": "image",
      "image": "1.jpg",
      "caption": "The sunrise"
    },
    {
      "type": "both",
      "image": "2.jpg",
      "content": "She looked out the window, wondering..."
    },
    {
      "type": "both",
      "image": "3.gif",
      "content": "The wind blew gently..."
    },
    {
      "type": "text",
      "content": "And so the day began."
    }
  ]
}
```

**Step 4: Done!**
- Server will read the meta.json and serve pages in order
- No separate content.json needed for simple stories

---

### Adding a Visual Novel Story

**Step 1: Create organized folder structure**
```bash
gallery/story/my_vn_story/
├── cover.jpg
├── backgrounds/
│   ├── room.jpg
│   └── garden.jpg
├── characters/
│   ├── alice_happy.png
│   └── bob_sad.png
└── event_cg.jpg
```

**Step 2: Create meta.json with VN-style pages**
```json
{
  "id": "my_vn_story",
  "title": "My Visual Novel",
  "description": "A story with dialogue",
  "author": "dANNY",
  "createdAt": "2024-01-25",
  "sensitive": "SFW",
  "tags": ["dialogue", "romance"],
  "order": 1,
  "estimatedTime": "15 min",
  "pages": [
    {
      "type": "scene",
      "background": "backgrounds/room.jpg",
      "content": "Morning in Alice's room."
    },
    {
      "type": "dialogue",
      "background": "backgrounds/room.jpg",
      "character": {
        "name": "Alice",
        "image": "characters/alice_happy.png",
        "position": "left"
      },
      "content": "Good morning! It's a beautiful day!"
    },
    {
      "type": "dialogue",
      "background": "backgrounds/garden.jpg",
      "character": {
        "name": "Bob",
        "image": "characters/bob_sad.png",
        "position": "right"
      },
      "content": "I'm not so sure about that..."
    },
    {
      "type": "image",
      "image": "event_cg.jpg",
      "content": "A dramatic moment occurred."
    }
  ]
}
```

---

## Admin Upload Workflow (Web Interface)

### Phase 1: Manual Only (Initial Implementation)
- Admins manually create folders and edit JSON files
- Simple and reliable
- Good for testing and initial content

### Phase 2: Web Upload (Future Enhancement)

**Static/GIF Upload Flow:**
1. Admin logs in
2. Clicks "Create New Album"
3. Fills in form:
   - Title, description, author
   - Category, tags, sensitive flag
4. Uploads images (drag & drop or file picker)
5. Reorders images (drag to reorder)
6. System auto-generates `meta.json`
7. Saves to gallery folder

**Story Upload Flow:**

**Option A: Simple Story Editor**
1. Admin logs in
2. Clicks "Create New Story"
3. Fills in basic info
4. **Page-by-page editor:**
   - Add page → Select type (text/image/both)
   - Upload image (if needed)
   - Write content
   - Preview page
   - Reorder pages (drag & drop)
5. System generates `meta.json` with pages array
6. Saves to gallery folder

**Option B: JSON Editor (Power Users)**
1. Admin logs in
2. Clicks "Create New Story (Advanced)"
3. Creates folder structure
4. Uploads all assets
5. Edits `meta.json` directly in web editor with syntax highlighting
6. Validates JSON
7. Saves

**Recommended Approach:**
- Start with **Manual Only** (Phase 1)
- Add **Simple Upload** for static/GIF (easier to implement)
- Add **Page Editor** for simple stories
- Keep **JSON Editor** option for power users and VN-style stories

---

## File Upload Technical Details

### Using Multer (Node.js)
```javascript
import multer from 'multer'
import path from 'path'

// Configure storage
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
    // Keep original filename or auto-number
    cb(null, file.originalname)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Accept images and GIFs only
    const allowedTypes = /jpeg|jpg|png|gif|webp/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)

    if (extname && mimetype) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// Upload endpoint
app.post('/api/gallery/admin/:type/:albumId/upload',
  authMiddleware,
  upload.array('images', 50), // Allow up to 50 images
  (req, res) => {
    res.json({
      message: 'Files uploaded successfully',
      files: req.files.map(f => f.filename)
    })
  }
)
```

### Frontend Upload Component (React)
```jsx
const ImageUploader = ({ albumId, type }) => {
  const [files, setFiles] = useState([])

  const handleUpload = async () => {
    const formData = new FormData()
    files.forEach(file => {
      formData.append('images', file)
    })

    const token = localStorage.getItem('adminToken')
    const response = await fetch(`/api/gallery/admin/${type}/${albumId}/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    })

    const result = await response.json()
    console.log('Uploaded:', result.files)
  }

  return (
    <div>
      <input
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => setFiles(Array.from(e.target.files))}
      />
      <button onClick={handleUpload}>Upload</button>
    </div>
  )
}
```

---

## Required Dependencies

```bash
# In app/ directory
npm install bcrypt jsonwebtoken multer
```

---

## Summary

**Feasibility:** ✅ Fully achievable

**Key Design Decisions:**

1. **Unified Card Display**
   - All three types show as cards initially
   - Different viewers open based on type when clicked

2. **Simplified Data Structure**
   - Static/GIF: Simple `meta.json` with images array
   - Story: `meta.json` with embedded pages (no separate file)
   - Images displayed in array order

3. **Flexible Story Format**
   - Simple: Image-text pairs for basic stories
   - Advanced: VN-style with backgrounds and characters
   - Supports mixing images and GIFs

4. **Upload Strategy**
   - Phase 1: Manual folder management (immediate)
   - Phase 2: Web upload interface (future)
   - Both approaches supported long-term

**Key Advantages:**
- Consistent with existing prompt/LoRA architecture
- Easy manual management (folder-based)
- Supports different paths (PC/NAS sync)
- No database required
- Simple import/export
- Flexible story format (simple or complex)

**Estimated Time:** 8-12 days
- Backend + Auth: 2-3 days
- Static/GIF Gallery: 2-3 days
- Story Viewer: 3-4 days
- Polish & Testing: 1-2 days

**Priority Order:**
1. Backend API + Authentication
2. Static Gallery (simpler to implement first)
3. GIF Gallery (same as static, just different file types)
4. Story Gallery (more complex due to page rendering)

**Next Steps:**
Ready to implement! Should we start with Phase 1 (backend setup)?
