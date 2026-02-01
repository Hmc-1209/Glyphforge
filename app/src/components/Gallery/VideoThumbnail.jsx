import React, { useState, useRef, useEffect } from 'react'

function VideoThumbnail({ src, alt }) {
  const [thumbnail, setThumbnail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas || !src) return

    const handleLoadedData = () => {
      try {
        // Seek to first frame
        video.currentTime = 0.1
      } catch (err) {
        console.error('Error seeking video:', err)
        setError(true)
        setLoading(false)
      }
    }

    const handleSeeked = () => {
      try {
        const ctx = canvas.getContext('2d')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        setThumbnail(dataUrl)
        setLoading(false)
      } catch (err) {
        console.error('Error capturing thumbnail:', err)
        setError(true)
        setLoading(false)
      }
    }

    const handleError = () => {
      setError(true)
      setLoading(false)
    }

    video.addEventListener('loadeddata', handleLoadedData)
    video.addEventListener('seeked', handleSeeked)
    video.addEventListener('error', handleError)

    // Start loading
    video.load()

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData)
      video.removeEventListener('seeked', handleSeeked)
      video.removeEventListener('error', handleError)
    }
  }, [src])

  return (
    <>
      {/* Hidden video and canvas for thumbnail generation */}
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Display thumbnail or fallback */}
      {loading ? (
        <div className="gallery-card-placeholder video-loading">
          <span className="video-icon">🎬</span>
          <span>Loading...</span>
        </div>
      ) : error ? (
        <div className="gallery-card-placeholder video-error">
          <span className="video-icon">🎬</span>
          <span>Video</span>
        </div>
      ) : thumbnail ? (
        <img src={thumbnail} alt={alt} loading="lazy" />
      ) : (
        <div className="gallery-card-placeholder">
          <span className="video-icon">🎬</span>
        </div>
      )}
    </>
  )
}

export default VideoThumbnail
