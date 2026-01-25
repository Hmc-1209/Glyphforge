import React, { useState } from 'react'
import AlbumEditor from './AlbumEditor'
import { useToast } from '../../Toast/ToastContext'

function AdminPanel({ type, albums, onLogout, onRefresh }) {
  const toast = useToast()
  const [showEditor, setShowEditor] = useState(false)
  const [editingAlbum, setEditingAlbum] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [draggedAlbumIndex, setDraggedAlbumIndex] = useState(null)
  const [localAlbums, setLocalAlbums] = useState(albums)

  // Update local albums when props change
  React.useEffect(() => {
    setLocalAlbums(albums)
  }, [albums])

  // Helper function to check if file is a video
  const isVideo = (filename) => {
    if (!filename) return false
    return /\.(mp4|mov|avi|webm|mkv|flv|wmv|m4v)$/i.test(filename)
  }

  const handleCreateNew = () => {
    setEditingAlbum(null)
    setShowEditor(true)
  }

  const handleEdit = (album) => {
    setEditingAlbum(album)
    setShowEditor(true)
  }

  const handleDelete = async (albumId) => {
    if (deleteConfirm !== albumId) {
      setDeleteConfirm(albumId)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/gallery/admin/${type}/${albumId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast.success('Album deleted successfully')
        onRefresh()
      } else {
        const data = await response.json()
        toast.error(`Failed to delete: ${data.error}`)
      }
    } catch (error) {
      console.error('Delete error:', error)
      toast.error('Failed to delete album')
    }

    setDeleteConfirm(null)
  }

  const handleEditorClose = (success) => {
    setShowEditor(false)
    setEditingAlbum(null)
    if (success) {
      onRefresh()
    }
  }

  // Drag and drop handlers for album reordering
  const handleAlbumDragStart = (e, index) => {
    setDraggedAlbumIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleAlbumDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggedAlbumIndex === null || draggedAlbumIndex === index) return

    const newAlbums = [...localAlbums]
    const draggedAlbum = newAlbums[draggedAlbumIndex]

    newAlbums.splice(draggedAlbumIndex, 1)
    newAlbums.splice(index, 0, draggedAlbum)

    setDraggedAlbumIndex(index)
    setLocalAlbums(newAlbums)
  }

  const handleAlbumDragEnd = async () => {
    if (draggedAlbumIndex === null) return

    try {
      // Update order values based on new positions
      const updatedAlbums = localAlbums.map((album, index) => ({
        id: album.id,
        order: index
      }))

      console.log('📤 Sending reorder request:', { type, albums: updatedAlbums })

      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/gallery/admin/${type}/reorder-albums`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ albums: updatedAlbums })
      })

      console.log('📥 Response status:', response.status)

      if (response.ok) {
        toast.success('Album order updated')
        onRefresh()
      } else {
        const data = await response.json()
        toast.error(`Failed to update order: ${data.error}`)
        // Revert to original order on error
        setLocalAlbums(albums)
      }
    } catch (error) {
      console.error('Reorder error:', error)
      toast.error('Failed to update album order')
      setLocalAlbums(albums)
    }

    setDraggedAlbumIndex(null)
  }

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <div>
          <h3>Admin Panel</h3>
          <p className="admin-panel-subtitle">
            Managing {type} galleries · {albums.length} album{albums.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="admin-panel-actions">
          <button
            className="admin-btn admin-btn-primary"
            onClick={handleCreateNew}
          >
            + Create New
          </button>
          <button
            className="admin-btn admin-btn-secondary"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="admin-album-list">
        {localAlbums.length === 0 ? (
          <div className="admin-empty">
            <p>No albums yet. Create your first album!</p>
          </div>
        ) : (
          <>
            <p className="admin-reorder-hint">Drag albums to reorder them</p>
            {localAlbums.map((album, index) => (
              <div
                key={album.id}
                className={`admin-album-item ${draggedAlbumIndex === index ? 'dragging' : ''}`}
                draggable={true}
                onDragStart={(e) => handleAlbumDragStart(e, index)}
                onDragOver={(e) => handleAlbumDragOver(e, index)}
                onDragEnd={handleAlbumDragEnd}
              >
                <div className="admin-album-drag-handle">☰</div>
                <div className="admin-album-thumbnail">
                {album.cover ? (
                  isVideo(album.cover) ? (
                    <video
                      src={album.cover}
                      alt={album.title}
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <img src={album.cover} alt={album.title} />
                  )
                ) : (
                  <div className="admin-album-placeholder">No Cover</div>
                )}
              </div>
              <div className="admin-album-info">
                <h4>{album.title}</h4>
                <p className="admin-album-id">ID: {album.id}</p>
                <div className="admin-album-meta">
                  <span>{type === 'story' ? `${album.pageCount} pages` : `${album.imageCount} images`}</span>
                  <span>·</span>
                  <span>{album.viewCount} views</span>
                  <span>·</span>
                  <span>{album.sensitive}</span>
                </div>
                {album.tags && album.tags.length > 0 && (
                  <div className="admin-album-tags">
                    {album.tags.map((tag, idx) => (
                      <span key={idx} className="admin-tag">{tag}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="admin-album-actions">
                <button
                  className="admin-btn admin-btn-small admin-btn-edit"
                  onClick={() => handleEdit(album)}
                >
                  Edit
                </button>
                <button
                  className={`admin-btn admin-btn-small admin-btn-delete ${deleteConfirm === album.id ? 'confirm' : ''}`}
                  onClick={() => handleDelete(album.id)}
                >
                  {deleteConfirm === album.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </div>
            ))}
          </>
        )}
      </div>

      {showEditor && (
        <AlbumEditor
          type={type}
          album={editingAlbum}
          onClose={handleEditorClose}
        />
      )}
    </div>
  )
}

export default AdminPanel
