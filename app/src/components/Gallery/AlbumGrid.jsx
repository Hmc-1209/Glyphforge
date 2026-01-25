import React from 'react'

function AlbumGrid({ albums, onAlbumClick, type }) {
  // Helper function to check if file is a video
  const isVideo = (filename) => {
    if (!filename) return false
    return /\.(mp4|mov|avi|webm|mkv|flv|wmv|m4v)$/i.test(filename)
  }

  if (albums.length === 0) {
    return (
      <div className="gallery-empty">
        <p>No {type} albums found</p>
      </div>
    )
  }

  return (
    <div className="gallery-grid">
      {albums.map(album => (
        <div
          key={album.id}
          className="gallery-card"
          onClick={() => onAlbumClick(album)}
        >
          <div className="gallery-card-image">
            {album.cover ? (
              isVideo(album.cover) ? (
                <video
                  src={album.cover}
                  alt={album.title}
                  muted
                  playsInline
                  preload="metadata"
                  loading="lazy"
                />
              ) : (
                <img src={album.cover} alt={album.title} loading="lazy" />
              )
            ) : (
              <div className="gallery-card-placeholder">No Image</div>
            )}

            {/* Overlay with album info */}
            <div className="gallery-card-overlay">
              <h3 className="gallery-card-title">{album.title}</h3>
              {album.description && (
                <p className="gallery-card-description">{album.description}</p>
              )}
              <div className="gallery-card-meta">
                {type === 'story' ? (
                  <>
                    <span className="meta-item">{album.pageCount} pages</span>
                    {album.estimatedTime && (
                      <span className="meta-item">{album.estimatedTime}</span>
                    )}
                  </>
                ) : (
                  <span className="meta-item">{album.imageCount} images</span>
                )}
                {album.viewCount > 0 && (
                  <span className="meta-item">{album.viewCount} views</span>
                )}
              </div>
            </div>
          </div>

          {/* Card footer */}
          <div className="gallery-card-footer">
            <div className="gallery-card-tags">
              {album.tags && album.tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="gallery-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default AlbumGrid
