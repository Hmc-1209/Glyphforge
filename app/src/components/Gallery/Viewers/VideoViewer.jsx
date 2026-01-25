import React, { useState, useEffect, useRef } from 'react'

function VideoViewer({ album, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const lastWheelTime = useRef(0)

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        handleNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex])

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % album.images.length)
  }

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + album.images.length) % album.images.length)
  }

  // Helper function to check if file is a video
  const isVideo = (filename) => {
    if (!filename) return false
    return /\.(mp4|mov|avi|webm|mkv|flv|wmv|m4v)$/i.test(filename)
  }

  // Handle wheel navigation on image area - allows fast continuous scrolling
  const handleImageWheel = (e) => {
    e.preventDefault()

    const now = Date.now()
    const timeDiff = now - lastWheelTime.current

    // Allow fast continuous switching - only throttle if scrolling very fast (< 50ms)
    if (timeDiff < 50) {
      return
    }
    lastWheelTime.current = now

    // Determine how many images to skip based on scroll amount
    const scrollAmount = Math.abs(e.deltaY)
    let skipCount = 1

    // Fast scroll = skip more images
    if (scrollAmount > 100) {
      skipCount = Math.ceil(scrollAmount / 100)
    }

    if (e.deltaY < 0) {
      // Scroll up = previous images
      setCurrentIndex((prev) => (prev - skipCount + album.images.length) % album.images.length)
    } else if (e.deltaY > 0) {
      // Scroll down = next images
      setCurrentIndex((prev) => (prev + skipCount) % album.images.length)
    }
  }

  // Handle wheel on thumbnail area - convert vertical scroll to horizontal
  const handleThumbnailWheel = (e) => {
    e.preventDefault()
    const container = e.currentTarget
    // Convert vertical scroll to horizontal scroll
    container.scrollLeft += e.deltaY
  }

  // Check if album has no images
  if (!album.images || album.images.length === 0) {
    return (
      <div className="gallery-viewer-overlay" onClick={onClose}>
        <div className="gallery-viewer-content" onClick={(e) => e.stopPropagation()}>
          <button className="gallery-viewer-close" onClick={onClose}>×</button>

          {/* Header */}
          <div className="gallery-viewer-header">
            <h2>{album.title}</h2>
            {album.description && <p>{album.description}</p>}
          </div>

          {/* Empty State */}
          <div className="gallery-viewer-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', color: '#9ca3af' }}>
              <p>No videos available</p>
            </div>
          </div>

          {/* Footer */}
          <div className="gallery-viewer-footer">
            {album.tags && album.tags.length > 0 && (
              <div className="gallery-viewer-tags">
                {album.tags.map((tag, idx) => (
                  <span key={idx} className="gallery-tag">{tag}</span>
                ))}
              </div>
            )}
            {album.author && (
              <div className="gallery-viewer-author">by {album.author}</div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="gallery-viewer-overlay" onClick={onClose}>
      <div className="gallery-viewer-content" onClick={(e) => e.stopPropagation()}>
        <button className="gallery-viewer-close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="gallery-viewer-header">
          <h2>{album.title}</h2>
          {album.description && <p>{album.description}</p>}
        </div>

        {/* Page Counter - Centered */}
        <div className="gallery-viewer-counter-center">
          {currentIndex + 1} / {album.images.length}
        </div>

        {/* Video Display */}
        <div className="gallery-viewer-body">
          <button
            className="gallery-viewer-nav gallery-viewer-nav-left"
            onClick={handlePrevious}
            disabled={album.images.length <= 1}
          >
            ‹
          </button>

          <div className="gallery-viewer-image-container" onWheel={handleImageWheel}>
            {isVideo(album.images[currentIndex]) ? (
              <video
                src={album.images[currentIndex]}
                className="gallery-viewer-image"
                autoPlay
                loop
                muted
                playsInline
              />
            ) : (
              <img
                src={album.images[currentIndex]}
                alt={`${album.title} - ${currentIndex + 1}`}
                className="gallery-viewer-image"
              />
            )}
          </div>

          <button
            className="gallery-viewer-nav gallery-viewer-nav-right"
            onClick={handleNext}
            disabled={album.images.length <= 1}
          >
            ›
          </button>
        </div>

        {/* Thumbnail Strip */}
        <div className="gallery-viewer-thumbnails" onWheel={handleThumbnailWheel}>
          {album.images.map((image, idx) => (
            <div
              key={idx}
              className={`gallery-thumbnail ${idx === currentIndex ? 'active' : ''}`}
              onClick={() => setCurrentIndex(idx)}
            >
              {isVideo(image) ? (
                <video
                  src={image}
                  alt={`Thumbnail ${idx + 1}`}
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img
                  src={image}
                  alt={`Thumbnail ${idx + 1}`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="gallery-viewer-footer">
          {album.tags && album.tags.length > 0 && (
            <div className="gallery-viewer-tags">
              {album.tags.map((tag, idx) => (
                <span key={idx} className="gallery-tag">{tag}</span>
              ))}
            </div>
          )}
          {album.author && (
            <div className="gallery-viewer-author">by {album.author}</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoViewer
