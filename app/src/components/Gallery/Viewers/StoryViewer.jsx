import React, { useState, useEffect } from 'react'

function StoryViewer({ album, onClose }) {
  const [currentPage, setCurrentPage] = useState(0)
  const [storyData, setStoryData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load full story data with pages
  useEffect(() => {
    const loadStory = async () => {
      try {
        const response = await fetch(`/api/gallery/story/${album.id}`)
        const data = await response.json()
        setStoryData(data)
        setLoading(false)

        // Load progress from localStorage
        const savedProgress = localStorage.getItem(`story-progress-${album.id}`)
        if (savedProgress) {
          setCurrentPage(parseInt(savedProgress))
        }
      } catch (error) {
        console.error('Failed to load story:', error)
        setLoading(false)
      }
    }

    loadStory()
  }, [album.id])

  // Save progress to localStorage
  useEffect(() => {
    if (storyData && !loading) {
      localStorage.setItem(`story-progress-${album.id}`, currentPage.toString())
    }
  }, [currentPage, album.id, storyData, loading])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowLeft') {
        handlePrevious()
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        handleNext()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [currentPage, storyData])

  const handleNext = () => {
    if (storyData && currentPage < storyData.pages.length - 1) {
      setCurrentPage(prev => prev + 1)
    }
  }

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1)
    }
  }

  const handleRestart = () => {
    setCurrentPage(0)
    localStorage.removeItem(`story-progress-${album.id}`)
  }

  if (loading) {
    return (
      <div className="gallery-viewer-overlay">
        <div className="gallery-viewer-loading">Loading story...</div>
      </div>
    )
  }

  if (!storyData || !storyData.pages || storyData.pages.length === 0) {
    return (
      <div className="gallery-viewer-overlay" onClick={onClose}>
        <div className="gallery-viewer-error">
          <p>Story not found or has no content</p>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    )
  }

  const page = storyData.pages[currentPage]
  const isLastPage = currentPage === storyData.pages.length - 1

  return (
    <div className="gallery-viewer-overlay story-viewer" onClick={onClose}>
      <div className="gallery-viewer-content story-content" onClick={(e) => e.stopPropagation()}>
        <button className="gallery-viewer-close" onClick={onClose}>×</button>

        {/* Story Header */}
        <div className="story-header">
          <h2>{storyData.title}</h2>
        </div>

        {/* Page Counter - Centered */}
        <div className="story-progress-center">
          Page {currentPage + 1} / {storyData.pages.length}
          {currentPage > 0 && (
            <button className="story-restart-btn" onClick={handleRestart}>
              Restart
            </button>
          )}
        </div>

        {/* Story Page Content */}
        <div className="story-page">
          {renderPage(page)}
        </div>

        {/* Navigation */}
        <div className="story-navigation">
          <button
            className="story-nav-btn"
            onClick={handlePrevious}
            disabled={currentPage === 0}
          >
            ← Previous
          </button>

          <div className="story-page-dots">
            {storyData.pages.map((_, idx) => (
              <div
                key={idx}
                className={`story-dot ${idx === currentPage ? 'active' : ''} ${idx < currentPage ? 'completed' : ''}`}
                onClick={() => setCurrentPage(idx)}
                title={`Page ${idx + 1}`}
              />
            ))}
          </div>

          <button
            className="story-nav-btn"
            onClick={isLastPage ? onClose : handleNext}
          >
            {isLastPage ? 'Finish' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )

  function renderPage(page) {
    switch (page.type) {
      case 'text':
        return (
          <div className="story-page-text">
            <p>{page.content}</p>
          </div>
        )

      case 'image':
        return (
          <div className="story-page-image">
            <img src={page.image} alt="Story scene" />
            {page.caption && <p className="story-caption">{page.caption}</p>}
            {page.content && <p className="story-text">{page.content}</p>}
          </div>
        )

      case 'both':
        return (
          <div className="story-page-both">
            <img src={page.image} alt="Story scene" />
            <div className="story-text-overlay">
              <p>{page.content}</p>
            </div>
          </div>
        )

      case 'scene':
        return (
          <div
            className="story-page-vn"
            style={{ backgroundImage: `url(${page.background})` }}
          >
            <div className="story-vn-text">
              <p>{page.content}</p>
            </div>
          </div>
        )

      case 'dialogue':
        return (
          <div
            className="story-page-vn"
            style={{ backgroundImage: `url(${page.background})` }}
          >
            {page.character && (
              <div className={`story-character story-character-${page.character.position || 'center'}`}>
                <img src={page.character.image} alt={page.character.name} />
              </div>
            )}
            <div className="story-dialogue-box">
              {page.character && (
                <div className="story-character-name">{page.character.name}</div>
              )}
              <p>{page.content}</p>
            </div>
          </div>
        )

      default:
        return <div className="story-page-text"><p>{page.content || 'Unknown page type'}</p></div>
    }
  }
}

export default StoryViewer
