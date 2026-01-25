import React, { useState, useEffect } from 'react'
import AlbumGrid from './AlbumGrid'
import StaticViewer from './Viewers/StaticViewer'
import GifViewer from './Viewers/GifViewer'
import StoryViewer from './Viewers/StoryViewer'
import AdminLogin from './Admin/AdminLogin'
import AdminPanel from './Admin/AdminPanel'
import { useDataCache } from '../../hooks/useDataCache'
import './Gallery.css'

// Feature flag to enable/disable Story Gallery
const ENABLE_STORY_GALLERY = false

function Gallery({ sensitivityFilter }) {
  const [activeCategory, setActiveCategory] = useState('static')
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [adminMode, setAdminMode] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  // Use data cache hooks for each category (lazy loading - only load when needed)
  const staticCache = useDataCache(
    'gallery.static',
    async () => {
      const response = await fetch('/api/gallery/static')
      return await response.json()
    },
    { autoLoad: false } // Don't auto-load, load on demand
  )

  const gifCache = useDataCache(
    'gallery.gif',
    async () => {
      const response = await fetch('/api/gallery/gif')
      return await response.json()
    },
    { autoLoad: false }
  )

  const storyCache = useDataCache(
    'gallery.story',
    async () => {
      const response = await fetch('/api/gallery/story')
      return await response.json()
    },
    { autoLoad: false }
  )

  // Check if admin is logged in
  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    const expiry = localStorage.getItem('adminTokenExpiry')

    if (token && expiry && Date.now() < parseInt(expiry)) {
      setIsLoggedIn(true)
    } else {
      // Clear expired token
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminTokenExpiry')
      setIsLoggedIn(false)
    }
  }, [])

  // Load albums when category changes (only if not already loaded)
  useEffect(() => {
    if (activeCategory === 'static' && !staticCache.data) {
      staticCache.loadData()
    } else if (activeCategory === 'gif' && !gifCache.data) {
      gifCache.loadData()
    } else if (activeCategory === 'story' && !storyCache.data) {
      storyCache.loadData() // Load data even if disabled (for admin purposes)
    }
  }, [activeCategory]) // Only depend on activeCategory to avoid infinite loop

  // Filter albums by sensitivity
  const filterBySensitivity = (albums) => {
    if (sensitivityFilter === 'all') return albums
    if (sensitivityFilter === 'sfw') {
      return albums.filter(album => album.sensitive === 'SFW')
    }
    if (sensitivityFilter === 'nsfw') {
      return albums.filter(album => album.sensitive === 'NSFW')
    }
    return albums
  }

  const getCurrentAlbums = () => {
    let albums = []
    if (activeCategory === 'static') albums = staticCache.data || []
    else if (activeCategory === 'gif') albums = gifCache.data || []
    else if (activeCategory === 'story') albums = storyCache.data || []

    return filterBySensitivity(albums)
  }

  const getCurrentCache = () => {
    if (activeCategory === 'static') return staticCache
    if (activeCategory === 'gif') return gifCache
    if (activeCategory === 'story') return storyCache
    return { loading: false }
  }

  const handleAlbumClick = async (album) => {
    setSelectedAlbum(album)
    setSelectedType(activeCategory)

    // Increment view count and silently refresh data in background
    try {
      await fetch(`/api/gallery/${activeCategory}/${album.id}/view`, {
        method: 'POST'
      })
      // Silently refresh cache in background (won't show loading state)
      const currentCache = getCurrentCache()
      if (currentCache && currentCache.loadData) {
        currentCache.loadData(true, true) // force=true, silent=true
      }
    } catch (err) {
      console.error('Failed to update view count:', err)
    }
  }

  const handleCloseViewer = () => {
    setSelectedAlbum(null)
    setSelectedType(null)
  }

  const handleAdminClick = () => {
    if (isLoggedIn) {
      const newAdminMode = !adminMode
      setAdminMode(newAdminMode)

      // Refresh cache when exiting admin mode
      if (!newAdminMode) {
        console.log('👀 Exiting admin mode, refreshing cache...')
        handleRefresh()
      }
    } else {
      setShowLogin(true)
    }
  }

  const handleLoginSuccess = (token) => {
    setIsLoggedIn(true)
    setShowLogin(false)
    setAdminMode(true)
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminTokenExpiry')
    setIsLoggedIn(false)
    setAdminMode(false)
  }

  const handleRefresh = () => {
    // Force reload data after admin changes
    const currentCache = getCurrentCache()
    if (currentCache && currentCache.loadData) {
      console.log('🔄 Force refreshing gallery cache...')
      currentCache.loadData(true) // Force reload
    }
  }

  const currentAlbums = getCurrentAlbums()
  const currentCache = getCurrentCache()

  return (
    <div className="gallery-container">
      <div className="gallery-header">
        <div>
          <h2>Gallery</h2>
          <p>Browse image collections, GIF albums, and visual stories</p>
        </div>
        <button
          className={`admin-toggle-btn ${adminMode ? 'active' : ''}`}
          onClick={handleAdminClick}
          title={isLoggedIn ? (adminMode ? 'Exit Admin Mode' : 'Enter Admin Mode') : 'Admin Login'}
        >
          {adminMode ? '🔓 Admin Mode' : (isLoggedIn ? '🔒 Admin' : '🔐 Login')}
        </button>
      </div>

      {/* Category Navigation */}
      <div className="gallery-category-nav">
        <button
          className={`category-button ${activeCategory === 'static' ? 'active' : ''}`}
          onClick={() => setActiveCategory('static')}
        >
          <span className="category-icon">🖼️</span>
          <span>Static Gallery</span>
          <span className="category-count">{filterBySensitivity(staticCache.data || []).length}</span>
        </button>
        <button
          className={`category-button ${activeCategory === 'gif' ? 'active' : ''}`}
          onClick={() => setActiveCategory('gif')}
        >
          <span className="category-icon">🎬</span>
          <span>Video Gallery</span>
          <span className="category-count">{filterBySensitivity(gifCache.data || []).length}</span>
        </button>
        <button
          className={`category-button ${activeCategory === 'story' ? 'active' : ''}`}
          onClick={() => ENABLE_STORY_GALLERY && setActiveCategory('story')}
          disabled={!ENABLE_STORY_GALLERY}
          style={!ENABLE_STORY_GALLERY ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          title={!ENABLE_STORY_GALLERY ? 'Coming soon...' : ''}
        >
          <span className="category-icon">📖</span>
          <span>Story Gallery</span>
          <span className="category-count">{filterBySensitivity(storyCache.data || []).length}</span>
        </button>
      </div>

      {/* Content Area */}
      {adminMode ? (
        <AdminPanel
          type={activeCategory}
          albums={currentAlbums}
          onLogout={handleLogout}
          onRefresh={handleRefresh}
        />
      ) : (
        <>
          {/* Album Grid */}
          {currentCache.loading ? (
            <div className="gallery-loading">Loading...</div>
          ) : (
            <AlbumGrid
              albums={currentAlbums}
              onAlbumClick={handleAlbumClick}
              type={activeCategory}
            />
          )}

          {/* Viewers */}
          {selectedAlbum && selectedType === 'static' && (
            <StaticViewer album={selectedAlbum} onClose={handleCloseViewer} />
          )}
          {selectedAlbum && selectedType === 'gif' && (
            <GifViewer album={selectedAlbum} onClose={handleCloseViewer} />
          )}
          {selectedAlbum && selectedType === 'story' && ENABLE_STORY_GALLERY && (
            <StoryViewer album={selectedAlbum} onClose={handleCloseViewer} />
          )}
        </>
      )}

      {/* Admin Login Modal */}
      {showLogin && (
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  )
}

export default Gallery
