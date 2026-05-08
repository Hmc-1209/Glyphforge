import React, { useState, useEffect, useRef } from 'react'

function VideoViewer({ album, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const lastWheelTime = useRef(0)
  const videoRef = useRef(null)
  
  // Volume state - default muted
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('glyphforge_video_volume')
    return saved !== null ? parseFloat(saved) : 0
  })
  const [isMuted, setIsMuted] = useState(() => {
    const savedVolume = localStorage.getItem('glyphforge_video_volume')
    return savedVolume === null || parseFloat(savedVolume) === 0
  })
  const [previousVolume, setPreviousVolume] = useState(0.5) // For unmute restore

  // Update video volume when state changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isMuted ? 0 : volume
      videoRef.current.muted = isMuted || volume === 0
    }
  }, [volume, isMuted, currentIndex])

  // Save volume preference
  useEffect(() => {
    if (!isMuted && volume > 0) {
      localStorage.setItem('glyphforge_video_volume', volume.toString())
    }
  }, [volume, isMuted])

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value)
    setVolume(newVolume)
    if (newVolume > 0) {
      setIsMuted(false)
      setPreviousVolume(newVolume)
    } else {
      setIsMuted(true)
    }
  }

  const toggleMute = () => {
    if (isMuted || volume === 0) {
      // Unmute - restore previous volume or default to 0.5
      const restoreVolume = previousVolume > 0 ? previousVolume : 0.5
      setVolume(restoreVolume)
      setIsMuted(false)
    } else {
      // Mute - save current volume for restore
      setPreviousVolume(volume)
      setIsMuted(true)
    }
  }

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
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
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
                ref={videoRef}
                src={album.images[currentIndex]}
                className="gallery-viewer-image"
                autoPlay
                loop
                muted={isMuted || volume === 0}
                playsInline
              />
            ) : (
              <img
                src={album.images[currentIndex]}
                alt={`${album.title} - ${currentIndex + 1}`}
                className="gallery-viewer-image"
              />
            )}
            
            {/* Volume Controls - Only show for videos */}
            {isVideo(album.images[currentIndex]) && (
              <div className="video-volume-controls">
                <button 
                  className="volume-toggle-btn" 
                  onClick={toggleMute}
                  title={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                >
                  {isMuted || volume === 0 ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                  title={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
                />
              </div>
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
