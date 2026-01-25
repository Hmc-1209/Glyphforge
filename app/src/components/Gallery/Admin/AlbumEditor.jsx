import React, { useState, useEffect } from 'react'
import { useToast } from '../../Toast/ToastContext'

function AlbumEditor({ type, album, onClose }) {
  const toast = useToast()
  const isEditing = !!album

  // Generate unique ID: timestamp + random string
  const generateId = () => {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `${type}_${timestamp}_${random}`
  }

  const [formData, setFormData] = useState({
    id: album?.id || generateId(), // Auto-generate ID for new albums
    title: '',
    description: '',
    sensitive: 'SFW',
    category: '',
    tags: [],
    order: 0,
    estimatedTime: '',
    images: [],
    pages: []
  })
  const [tagInput, setTagInput] = useState('')
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [draggedImageIndex, setDraggedImageIndex] = useState(null)
  const [loading, setLoading] = useState(false)
  const [originalImages, setOriginalImages] = useState([]) // Track original images for deletion

  // Fetch fresh data from server when editing
  useEffect(() => {
    const fetchAlbumData = async () => {
      if (album && album.id) {
        // Editing existing album - fetch fresh data from server
        setLoading(true)
        try {
          const response = await fetch(`/api/gallery/${type}`)
          const albums = await response.json()
          const freshAlbum = albums.find(a => a.id === album.id)

          if (freshAlbum) {
            console.log('📥 Loaded fresh album data:', freshAlbum)
            const images = freshAlbum.images || []
            setFormData({
              id: freshAlbum.id,
              title: freshAlbum.title || '',
              description: freshAlbum.description || '',
              sensitive: freshAlbum.sensitive || 'SFW',
              category: freshAlbum.category || '',
              tags: freshAlbum.tags || [],
              order: freshAlbum.order || 0,
              estimatedTime: freshAlbum.estimatedTime || '',
              images: images,
              pages: freshAlbum.pages || []
            })
            setOriginalImages([...images]) // Save original images list
          }
        } catch (error) {
          console.error('Error fetching fresh album data:', error)
          // Fall back to cached data
          const images = album.images || []
          setFormData({
            id: album.id,
            title: album.title || '',
            description: album.description || '',
            sensitive: album.sensitive || 'SFW',
            category: album.category || '',
            tags: album.tags || [],
            order: album.order || 0,
            estimatedTime: album.estimatedTime || '',
            images: images,
            pages: album.pages || []
          })
          setOriginalImages([...images]) // Save original images list
        } finally {
          setLoading(false)
        }
      }
    }

    fetchAlbumData()
  }, [album, type])

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  // Image drag and drop handlers
  const handleImageDragStart = (e, index) => {
    e.stopPropagation()
    setDraggedImageIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', index.toString())
  }

  const handleImageDragOver = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleImageDrop = (e, dropIndex) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('🎯 Drop event:', {
      draggedIndex: draggedImageIndex,
      dropIndex,
      isDifferent: draggedImageIndex !== dropIndex
    })

    if (draggedImageIndex === null || draggedImageIndex === dropIndex) {
      console.log('⏭️ Skipping: same position or no drag')
      setDraggedImageIndex(null)
      return
    }

    const oldImages = [...formData.images]
    const newImages = [...formData.images]
    const [draggedImage] = newImages.splice(draggedImageIndex, 1)
    newImages.splice(dropIndex, 0, draggedImage)

    console.log('📦 Image reorder (not saved yet):', {
      oldOrder: oldImages,
      newOrder: newImages,
      draggedImage,
      from: draggedImageIndex,
      to: dropIndex
    })

    // Update UI only - changes will be saved when clicking "Update Album"
    setFormData(prev => ({
      ...prev,
      images: newImages
    }))
    setDraggedImageIndex(null)
  }

  const handleImageDragEnd = () => {
    setDraggedImageIndex(null)
  }

  const handleDeleteImage = (index) => {
    const imageToDelete = formData.images[index]
    console.log('🗑️ Marking image for deletion (not deleted yet):', imageToDelete)

    // Remove from UI only - actual deletion happens on save
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== index)
    }))
  }

  // Get image URL for thumbnail
  const getImageUrl = (imageName) => {
    // If imageName is already a full URL path (starts with /), return it directly
    if (imageName.startsWith('/')) {
      return imageName
    }

    // Otherwise, construct the full path
    return `/gallery/${type}/${formData.id}/${imageName}`
  }

  // Helper function to check if file is a video
  const isVideo = (filename) => {
    if (!filename) return false
    return /\.(mp4|mov|avi|webm|mkv|flv|wmv|m4v)$/i.test(filename)
  }

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    handleFiles(files)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFiles = (files) => {
    // For gif type, allow both images and videos. For static, only images.
    const allowedFiles = files.filter(file => {
      if (type === 'video') {
        // Allow images and videos for gif gallery
        return file.type.startsWith('image/') || file.type.startsWith('video/')
      } else {
        // Only allow images for static gallery
        return file.type.startsWith('image/')
      }
    })

    if (allowedFiles.length === 0) {
      if (type === 'video') {
        toast.warning('Please select image or video files only')
      } else {
        toast.warning('Please select image files only')
      }
      return
    }

    setUploadedFiles(prev => [...prev, ...allowedFiles])
  }

  const handleUpload = async () => {
    if (!formData.id) {
      toast.error('Album ID is missing. Please try refreshing the editor.')
      return
    }

    if (uploadedFiles.length === 0) {
      toast.warning('Please select files to upload')
      return
    }

    setUploading(true)

    try {
      const token = localStorage.getItem('adminToken')
      const formDataUpload = new FormData()

      uploadedFiles.forEach(file => {
        formDataUpload.append('images', file)
      })

      const response = await fetch(`/api/gallery/admin/${type}/${formData.id}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formDataUpload,
      })

      const data = await response.json()

      if (response.ok) {
        // Add uploaded filenames to images array
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...data.files]
        }))

        setUploadedFiles([])
        toast.success(`Successfully uploaded ${data.files.length} file(s)`)
      } else {
        toast.error(`Upload failed: ${data.error}`)
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload files')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.title) {
      toast.warning('Please fill in Title')
      return
    }

    setSaving(true)

    try {
      const token = localStorage.getItem('adminToken')

      // Convert image URLs to filenames only (extract last part of path)
      const imageFilenames = formData.images.map(img => {
        // If it's a full URL path, extract the filename
        if (img.startsWith('/')) {
          return img.split('/').pop()
        }
        // Otherwise, it's already a filename
        return img
      })

      // Find deleted images (in originalImages but not in current formData.images)
      if (isEditing && originalImages.length > 0) {
        const currentFilenames = imageFilenames
        const originalFilenames = originalImages.map(img => {
          if (img.startsWith('/')) {
            return img.split('/').pop()
          }
          return img
        })

        const deletedImages = originalFilenames.filter(img => !currentFilenames.includes(img))

        if (deletedImages.length > 0) {
          console.log('🗑️ Deleting images:', deletedImages)

          // Delete each image
          for (const imagePath of deletedImages) {
            try {
              const response = await fetch(`/api/gallery/admin/${type}/${formData.id}/image`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imagePath })
              })

              if (!response.ok) {
                console.error(`Failed to delete image: ${imagePath}`)
              } else {
                console.log(`✅ Deleted image: ${imagePath}`)
              }
            } catch (error) {
              console.error(`Error deleting image ${imagePath}:`, error)
            }
          }
        }
      }

      const meta = {
        id: formData.id,
        title: formData.title,
        description: formData.description,
        sensitive: formData.sensitive,
        category: formData.category,
        tags: formData.tags,
        order: parseInt(formData.order) || 0,
        viewCount: album?.viewCount || 0,
        images: imageFilenames
      }

      // Add story-specific fields
      if (type === 'story') {
        meta.estimatedTime = formData.estimatedTime
        meta.pages = formData.pages
      }

      let response
      if (isEditing) {
        // Update existing album
        response = await fetch(`/api/gallery/admin/${type}/${formData.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ meta }),
        })
      } else {
        // Create new album
        response = await fetch(`/api/gallery/admin/${type}/create`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: formData.id, meta }),
        })
      }

      const data = await response.json()

      if (response.ok) {
        toast.success(isEditing ? 'Album updated successfully' : 'Album created successfully')
        onClose(true)
      } else {
        toast.error(`Failed to save: ${data.error}`)
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save album')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="album-editor-overlay" onClick={() => onClose(false)}>
      <div className="album-editor-content" onClick={(e) => e.stopPropagation()}>
        <div className="album-editor-header">
          <h2>{isEditing ? 'Edit Album' : 'Create New Album'}</h2>
          <button className="album-editor-close" onClick={() => onClose(false)}>×</button>
        </div>

        {loading ? (
          <div className="album-editor-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
            <div style={{ textAlign: 'center' }}>
              <p>Loading album data...</p>
            </div>
          </div>
        ) : (
        <div className="album-editor-body">
          {/* Basic Information */}
          <div className="editor-section">
            <h3>Basic Information</h3>

            <div className="editor-field">
              <label>Album ID *</label>
              <input
                type="text"
                value={formData.id}
                readOnly
                disabled
                style={{ background: '#2a2e3e', cursor: 'not-allowed' }}
              />
              <small>Auto-generated unique identifier</small>
            </div>

            <div className="editor-field">
              <label>Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Album title"
              />
            </div>

            <div className="editor-field">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Album description"
                rows={3}
              />
            </div>

            <div className="editor-field">
              <label>Sensitive</label>
              <select
                value={formData.sensitive}
                onChange={(e) => handleInputChange('sensitive', e.target.value)}
              >
                <option value="SFW">SFW</option>
                <option value="NSFW">NSFW</option>
              </select>
            </div>

            <div className="editor-row">
              <div className="editor-field">
                <label>Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  placeholder="e.g., character, scene"
                />
              </div>
            </div>

            {type === 'story' && (
              <div className="editor-field">
                <label>Estimated Time</label>
                <input
                  type="text"
                  value={formData.estimatedTime}
                  onChange={(e) => handleInputChange('estimatedTime', e.target.value)}
                  placeholder="e.g., 5 min"
                />
              </div>
            )}

            <div className="editor-field">
              <label>Tags</label>
              <div className="tag-input-container">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  placeholder="Type tag and press Enter"
                />
                <button type="button" onClick={handleAddTag}>Add</button>
              </div>
              <div className="tag-list">
                {formData.tags.map((tag, idx) => (
                  <span key={idx} className="editor-tag">
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* File Upload */}
          {type !== 'story' && (
            <div className="editor-section">
              <h3>File Upload</h3>

              <div
                className={`file-drop-zone ${dragActive ? 'active' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  accept={type === 'video' ? 'image/*,video/*' : 'image/*'}
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
                <label htmlFor="file-upload" className="file-upload-label">
                  <div className="file-upload-icon">📁</div>
                  <p>Drag & drop {type === 'video' ? 'images or videos' : 'images'} here or click to browse</p>
                  <small>Supports: {type === 'video' ? 'JPG, PNG, GIF, WebP, MP4, MOV, AVI, WebM' : 'JPG, PNG, GIF, WebP'}</small>
                </label>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="file-list">
                  <h4>Selected Files ({uploadedFiles.length})</h4>
                  <ul>
                    {uploadedFiles.map((file, idx) => (
                      <li key={idx}>
                        {file.name} ({(file.size / 1024).toFixed(1)} KB)
                      </li>
                    ))}
                  </ul>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={handleUpload}
                    disabled={uploading || !formData.id}
                  >
                    {uploading ? 'Uploading...' : 'Upload Files'}
                  </button>
                </div>
              )}

              {formData.images.length > 0 && (
                <div className="uploaded-images">
                  <h4>Uploaded Images ({formData.images.length})</h4>
                  <p className="editor-note">Drag thumbnails to reorder, click X to delete. Click "Update Album" to save changes.</p>
                  <div className="uploaded-images-grid">
                    {formData.images.map((img, idx) => (
                      <div
                        key={img}
                        className={`uploaded-image-item ${draggedImageIndex === idx ? 'dragging' : ''}`}
                        draggable={true}
                        onDragStart={(e) => handleImageDragStart(e, idx)}
                        onDragOver={(e) => handleImageDragOver(e, idx)}
                        onDrop={(e) => handleImageDrop(e, idx)}
                        onDragEnd={handleImageDragEnd}
                      >
                        {isVideo(img) ? (
                          <video
                            src={getImageUrl(img)}
                            alt={`Image ${idx + 1}`}
                            draggable={false}
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          <img
                            src={getImageUrl(img)}
                            alt={`Image ${idx + 1}`}
                            draggable={false}
                          />
                        )}
                        <button
                          className="uploaded-image-delete"
                          onClick={() => handleDeleteImage(idx)}
                          title="Delete this image"
                        >
                          ×
                        </button>
                        <div className="uploaded-image-number">{idx + 1}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Story Pages Editor */}
          {type === 'story' && (
            <div className="editor-section">
              <h3>Story Pages</h3>
              <p className="editor-note">
                For complex stories, it's recommended to edit the meta.json file directly.
                You can create basic text pages here.
              </p>

              <div className="story-pages-info">
                <p>Current pages: {formData.pages.length}</p>
                <small>Edit the meta.json file directly in the album folder for full control over story pages.</small>
              </div>
            </div>
          )}
        </div>
        )}

        <div className="album-editor-footer">
          <button
            className="admin-btn admin-btn-secondary"
            onClick={() => onClose(false)}
          >
            Cancel
          </button>
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : (isEditing ? 'Update Album' : 'Create Album')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AlbumEditor
