import React, { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [activeTab, setActiveTab] = useState('prompt')
  const [prompts, setPrompts] = useState([])
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [characterFilter, setCharacterFilter] = useState('all')

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const response = await fetch('/api/prompts')
        const data = await response.json()
        setPrompts(data)
      } catch (error) {
        console.error('Failed to load prompts:', error)
        // 如果 API 失敗，嘗試從配置獲取資料夾名稱
        try {
          const configResponse = await fetch('/api/config')
          const config = await configResponse.json()
          const folderName = config.promptFolder.name
          setPrompts([
            { id: '0', thumbnail: `/${folderName}/0/1.png`, images: [`/${folderName}/0/1.png`, `/${folderName}/0/2.png`], prompt: '', imageOrientation: 'portrait' },
            { id: '1', thumbnail: `/${folderName}/1/1.png`, images: [`/${folderName}/1/1.png`, `/${folderName}/1/2.png`], prompt: '', imageOrientation: 'portrait' }
          ])
        } catch (configError) {
          console.error('Failed to load config:', configError)
          setPrompts([])
        }
      }
    }
    loadPrompts()
  }, [])

  const handleCopyPrompt = async (promptText) => {
    try {
      await navigator.clipboard.writeText(promptText)
      showCopyToast()
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const showCopyToast = () => {
    const toast = document.createElement('div')
    toast.className = 'copy-toast'
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Copied!
    `

    document.body.appendChild(toast)

    setTimeout(() => {
      toast.classList.add('show')
    }, 10)

    setTimeout(() => {
      toast.classList.remove('show')
      setTimeout(() => toast.remove(), 300)
    }, 2000)
  }

  const closePopup = () => {
    setSelectedPrompt(null)
  }

  // Get unique character counts from prompts
  const getUniqueCharacterCounts = () => {
    const counts = new Set(prompts.map(p => p.character || 1))
    return Array.from(counts).sort((a, b) => a - b)
  }

  // Filter prompts based on character count
  const filteredPrompts = characterFilter === 'all'
    ? prompts
    : prompts.filter(p => (p.character || 1) === parseInt(characterFilter))

  return (
    <div className="app-container">
      <div className="main-card">
        <div className="tab-container">
          <button
            className={`tab ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            Prompt
          </button>
          <button
            className={`tab ${activeTab === 'lora' ? 'active' : ''}`}
            onClick={() => setActiveTab('lora')}
          >
            LoRA
          </button>
        </div>

        <div className="content-area">
          {activeTab === 'prompt' && (
            <div className="tab-content">
              <h2>Prompt Gallery</h2>
              <p>Browse and use preset prompt examples</p>

              <div className="filter-container">
                <div className="filter-row">
                  <label htmlFor="character-filter">Character Count:</label>
                  <select
                    id="character-filter"
                    className="filter-select"
                    value={characterFilter}
                    onChange={(e) => setCharacterFilter(e.target.value)}
                  >
                    <option value="all">All ({prompts.length})</option>
                    {getUniqueCharacterCounts().map(count => (
                      <option key={count} value={count.toString()}>
                        {count} Character{count > 1 ? 's' : ''} ({prompts.filter(p => (p.character || 1) === count).length})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="filter-info">
                  Showing {filteredPrompts.length} of {prompts.length} prompts
                </div>
              </div>

              <div className="content-section">
                <div className="prompt-grid">
                  {filteredPrompts.map((item) => (
                    <div
                      key={item.id}
                      className="prompt-card"
                      onClick={() => setSelectedPrompt(item)}
                    >
                      <div
                        className="prompt-thumbnail"
                        style={{ backgroundImage: `url(${item.thumbnail})` }}
                      ></div>
                      <div className="prompt-info">
                        <h4>Example {item.id}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lora' && (
            <div className="tab-content">
              <h2>LoRA Management</h2>
              <p>Select and adjust LoRA models</p>

              <div className="content-section">
                <h3>Installed LoRAs</h3>
                <div className="lora-grid">
                  <div className="lora-card">
                    <div className="lora-preview"></div>
                    <div className="lora-info">
                      <h4>Style LoRA 1</h4>
                      <p>Weight: 0.8</p>
                    </div>
                  </div>
                  <div className="lora-card">
                    <div className="lora-preview"></div>
                    <div className="lora-info">
                      <h4>Style LoRA 2</h4>
                      <p>Weight: 0.6</p>
                    </div>
                  </div>
                  <div className="lora-card">
                    <div className="lora-preview"></div>
                    <div className="lora-info">
                      <h4>Style LoRA 3</h4>
                      <p>Weight: 0.7</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedPrompt && (
        <div className="popup-overlay" onClick={closePopup}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={closePopup}>×</button>

            <div className={`popup-images ${selectedPrompt.imageOrientation === 'landscape' ? 'landscape' : 'portrait'}`}>
              {selectedPrompt.images.map((image, index) => (
                <img key={index} src={image} alt={`Image ${index + 1}`} />
              ))}
            </div>

            <button
              className="copy-button"
              onClick={() => handleCopyPrompt(selectedPrompt.prompt)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              Copy Prompt
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
