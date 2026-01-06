import React, { useState, useEffect } from 'react'
import './App.css'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function App() {
  const [activeTab, setActiveTab] = useState('prompt')
  const [prompts, setPrompts] = useState([])
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [loras, setLoras] = useState([])
  const [selectedLora, setSelectedLora] = useState(null)
  const [selectedLoraVersion, setSelectedLoraVersion] = useState(null)
  const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false)
  const [statistics, setStatistics] = useState(null)
  const [sensitivityFilter, setSensitivityFilter] = useState(() => {
    // Load from localStorage, default to 'sfw' for new users
    return localStorage.getItem('sensitivityFilter') || 'sfw'
  })
  const [characterFilter, setCharacterFilter] = useState('all')
  const [placeFilter, setPlaceFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [viewFilter, setViewFilter] = useState('all')
  const [nudityFilter, setNudityFilter] = useState('all')
  const [openDropdown, setOpenDropdown] = useState(null)
  const [isFilterExpanded, setIsFilterExpanded] = useState(false)

  // LoRA filters
  const [loraGenderFilter, setLoraGenderFilter] = useState('all')
  const [loraModelFilter, setLoraModelFilter] = useState('all')
  const [loraCharacterFilter, setLoraCharacterFilter] = useState('all')
  const [isLoraFilterExpanded, setIsLoraFilterExpanded] = useState(false)

  // Sort options
  const [promptSortBy, setPromptSortBy] = useState('default')
  const [loraSortBy, setLoraSortBy] = useState('default')

  // Help modal
  const [showHelpModal, setShowHelpModal] = useState(false)

  // Save sensitivity filter to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sensitivityFilter', sensitivityFilter)
  }, [sensitivityFilter])

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const response = await fetch('/api/prompts')
        const data = await response.json()
        setPrompts(data)
      } catch (error) {
        console.error('Failed to load prompts:', error)
        // If API fails, try to get folder name from config
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

  useEffect(() => {
    const loadLoras = async () => {
      try {
        const response = await fetch('/api/loras')
        const data = await response.json()
        setLoras(data)
      } catch (error) {
        console.error('Failed to load LoRAs:', error)
        setLoras([])
      }
    }
    loadLoras()
  }, [])

  useEffect(() => {
    const loadStatistics = async () => {
      try {
        const response = await fetch(`/api/statistics?sensitivity=${sensitivityFilter}`)
        const data = await response.json()
        setStatistics(data)
      } catch (error) {
        console.error('Failed to load statistics:', error)
        setStatistics(null)
      }
    }
    if (activeTab === 'statistics') {
      loadStatistics()
    }
  }, [activeTab, sensitivityFilter])

  // Handle ESC key to close popups
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (selectedPrompt) {
          setSelectedPrompt(null)
        }
        if (selectedLora) {
          setSelectedLora(null)
          setSelectedLoraVersion(null)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [selectedPrompt, selectedLora])

  // Initialize selected version when LoRA is selected
  useEffect(() => {
    if (selectedLora && selectedLora.versions && selectedLora.versions.length > 0) {
      // Prefer illustrious version, fallback to first version
      const illustriousVersion = selectedLora.versions.find(v =>
        v.name.toLowerCase() === 'illustrious'
      )
      setSelectedLoraVersion(illustriousVersion || selectedLora.versions[0])
    } else {
      setSelectedLoraVersion(null)
    }
  }, [selectedLora])

  const handleCopyPrompt = async (promptText, itemId, itemType) => {
    try {
      await navigator.clipboard.writeText(promptText)
      showCopyToast()

      // Increment copy counter
      if (itemId && itemType) {
        const endpoint = itemType === 'prompt' ? `/api/prompts/${itemId}/copy` : `/api/loras/${itemId}/copy`
        await fetch(endpoint, { method: 'POST' })
      }
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleDownload = async (loraId, version) => {
    try {
      // Trigger download
      const link = document.createElement('a')
      link.href = version.filePath
      link.download = version.fileName
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Increment download counter
      await fetch(`/api/loras/${loraId}/download`, { method: 'POST' })
    } catch (error) {
      console.error('Failed to download:', error)
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

  // Render a custom dropdown filter for prompts
  const renderFilter = (label, filterId, currentValue, setValue, options, getLabel) => {
    const isOpen = openDropdown === filterId

    return (
      <div className="filter-row">
        <label>{label}:</label>
        <div className="custom-select-wrapper">
          <div
            className="custom-select"
            onClick={() => setOpenDropdown(isOpen ? null : filterId)}
          >
            <div className="custom-select-trigger">
              <span>{getLabel(currentValue)}</span>
              <svg className="custom-select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            {isOpen && (
              <div className="custom-select-options">
                <div
                  className={`custom-select-option ${currentValue === 'all' ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setValue('all')
                    setOpenDropdown(null)
                  }}
                >
                  All ({sensitivityFilteredPrompts.length})
                </div>
                {options.map(option => (
                  <div
                    key={option}
                    className={`custom-select-option ${currentValue === option.toString() ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setValue(option.toString())
                      setOpenDropdown(null)
                    }}
                  >
                    {getLabel(option)} ({sensitivityFilteredPrompts.filter(p => p[filterId] ? p[filterId].toString() === option.toString() : false).length})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render sort dropdown
  const renderSortDropdown = (currentValue, setValue, options) => {
    const isOpen = openDropdown === 'sort'

    return (
      <div className="filter-row">
        <label>Sort By:</label>
        <div className="custom-select-wrapper">
          <div
            className="custom-select"
            onClick={() => setOpenDropdown(isOpen ? null : 'sort')}
          >
            <div className="custom-select-trigger">
              <span>{options.find(opt => opt.value === currentValue)?.label || 'Default'}</span>
              <svg className="custom-select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            {isOpen && (
              <div className="custom-select-options">
                {options.map(option => (
                  <div
                    key={option.value}
                    className={`custom-select-option ${currentValue === option.value ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setValue(option.value)
                      setOpenDropdown(null)
                    }}
                  >
                    {option.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render a custom dropdown filter for LoRAs
  const renderLoraFilter = (label, filterId, currentValue, setValue, options, getLabel) => {
    const isOpen = openDropdown === filterId

    return (
      <div className="filter-row">
        <label>{label}:</label>
        <div className="custom-select-wrapper">
          <div
            className="custom-select"
            onClick={() => setOpenDropdown(isOpen ? null : filterId)}
          >
            <div className="custom-select-trigger">
              <span>{getLabel(currentValue)}</span>
              <svg className="custom-select-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
            {isOpen && (
              <div className="custom-select-options">
                <div
                  className={`custom-select-option ${currentValue === 'all' ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setValue('all')
                    setOpenDropdown(null)
                  }}
                >
                  All ({loras.length})
                </div>
                {options.map(option => (
                  <div
                    key={option}
                    className={`custom-select-option ${currentValue === option.toString() ? 'selected' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setValue(option.toString())
                      setOpenDropdown(null)
                    }}
                  >
                    {getLabel(option)} ({loras.filter(l => l[filterId] ? l[filterId].toString() === option.toString() : false).length})
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // First filter by sensitivity (top-level filter)
  const sensitivityFilteredPrompts = prompts.filter(p => {
    if (sensitivityFilter === 'sfw') return p.sensitive === 'SFW'
    if (sensitivityFilter === 'nsfw') return p.sensitive === 'NSFW'
    return true // 'all' shows both
  })

  // Get unique values for each filter based on sensitivity-filtered prompts
  const getUniqueCharacterCounts = () => {
    const counts = new Set(sensitivityFilteredPrompts.map(p => p.character || 1))
    return Array.from(counts).sort((a, b) => a - b)
  }

  const getUniqueValues = (field) => {
    const values = new Set(sensitivityFilteredPrompts.map(p => p[field] || 'Unknown'))
    return Array.from(values).sort()
  }

  // Filter prompts based on all active filters (after sensitivity filter)
  const filteredAndSortedPrompts = (() => {
    const filtered = sensitivityFilteredPrompts.filter(p => {
      const characterMatch = characterFilter === 'all' || (p.character || 1) === parseInt(characterFilter)
      const placeMatch = placeFilter === 'all' || p.place === placeFilter
      const typeMatch = typeFilter === 'all' || p.type === typeFilter
      const viewMatch = viewFilter === 'all' || p.view === viewFilter
      const nudityMatch = nudityFilter === 'all' || p.nudity === nudityFilter

      return characterMatch && placeMatch && typeMatch && viewMatch && nudityMatch
    })

    // Sort based on promptSortBy
    if (promptSortBy === 'mostCopied') {
      return [...filtered].sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0))
    }
    return filtered
  })()

  const filteredPrompts = filteredAndSortedPrompts

  // Get unique values for LoRA filters
  const getLoraUniqueValues = (field) => {
    const values = new Set(
      loras
        .map(l => l[field])
        .filter(v => v && v !== '' && v !== 'Unknown')
    )
    return Array.from(values).sort()
  }

  // Filter LoRAs based on active filters
  const filteredAndSortedLoras = (() => {
    const filtered = loras.filter(l => {
      const genderMatch = loraGenderFilter === 'all' || l.gender === loraGenderFilter
      const modelMatch = loraModelFilter === 'all' || l.model === loraModelFilter
      const characterMatch = loraCharacterFilter === 'all' || l.character === loraCharacterFilter

      return genderMatch && modelMatch && characterMatch
    })

    // Sort based on loraSortBy
    if (loraSortBy === 'mostCopied') {
      return [...filtered].sort((a, b) => (b.copyCount || 0) - (a.copyCount || 0))
    } else if (loraSortBy === 'mostDownloaded') {
      return [...filtered].sort((a, b) => (b.downloadCount || 0) - (a.downloadCount || 0))
    }
    return filtered
  })()

  const filteredLoras = filteredAndSortedLoras

  return (
    <div className="app-container">
      {/* Floating Sensitivity Toggle */}
      <div className="sensitivity-toggle-container">
        <div className="sensitivity-toggle">
          <button
            className={`toggle-option ${sensitivityFilter === 'sfw' ? 'active' : ''}`}
            onClick={() => setSensitivityFilter('sfw')}
          ></button>
          <button
            className={`toggle-option ${sensitivityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setSensitivityFilter('all')}
          ></button>
          <button
            className={`toggle-option ${sensitivityFilter === 'nsfw' ? 'active' : ''}`}
            onClick={() => setSensitivityFilter('nsfw')}
          ></button>
          <div className={`toggle-slider ${sensitivityFilter}`}></div>
        </div>
      </div>

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
          <button
            className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            Statistics
          </button>
        </div>

        <div className="content-area">
          {activeTab === 'prompt' && (
            <div className="tab-content">
              <div className="tab-header">
                <div>
                  <h2>Prompt Gallery</h2>
                  <p>Browse and use preset prompt examples</p>
                </div>
                <button
                  className="help-button"
                  onClick={() => setShowHelpModal(true)}
                  title="Help & Information"
                >
                  ?
                </button>
              </div>

              <div className="filter-container">
                <button
                  className="filter-toggle-button"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                >
                  <span>Filters</span>
                  <span className={`filter-arrow ${isFilterExpanded ? 'expanded' : ''}`}>▼</span>
                  <span className="filter-count">
                    {filteredPrompts.length} / {sensitivityFilteredPrompts.length}
                  </span>
                </button>

                <div className={`filter-content ${isFilterExpanded ? 'expanded' : ''}`}>
                  <div>
                    <div className="filter-grid">
                      {/* Character Filter */}
                      {renderFilter(
                        'Character',
                        'character',
                        characterFilter,
                        setCharacterFilter,
                        getUniqueCharacterCounts(),
                        (val) => val === 'all' ? `All (${sensitivityFilteredPrompts.length})` : `${val} Character${parseInt(val) > 1 ? 's' : ''}`
                      )}

                      {/* Place Filter */}
                      {renderFilter(
                        'Place',
                        'place',
                        placeFilter,
                        setPlaceFilter,
                        getUniqueValues('place'),
                        (val) => val === 'all' ? `All (${sensitivityFilteredPrompts.length})` : val
                      )}

                      {/* Type Filter */}
                      {renderFilter(
                        'Type',
                        'type',
                        typeFilter,
                        setTypeFilter,
                        getUniqueValues('type'),
                        (val) => val === 'all' ? `All (${sensitivityFilteredPrompts.length})` : val
                      )}

                      {/* View Filter */}
                      {renderFilter(
                        'View',
                        'view',
                        viewFilter,
                        setViewFilter,
                        getUniqueValues('view'),
                        (val) => val === 'all' ? `All (${sensitivityFilteredPrompts.length})` : val
                      )}

                      {/* Nudity Filter - Only show when not in SFW mode */}
                      {sensitivityFilter !== 'sfw' && renderFilter(
                        'Nudity',
                        'nudity',
                        nudityFilter,
                        setNudityFilter,
                        getUniqueValues('nudity'),
                        (val) => val === 'all' ? `All (${sensitivityFilteredPrompts.length})` : val
                      )}

                      {/* Sort Dropdown */}
                      {renderSortDropdown(promptSortBy, setPromptSortBy, [
                        { value: 'default', label: 'Default' },
                        { value: 'mostCopied', label: 'Most Copied' }
                      ])}
                    </div>

                    <div className="filter-info">
                      Showing {filteredPrompts.length} of {sensitivityFilteredPrompts.length} prompts
                    </div>
                  </div>
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
              <h2>LoRA Gallery</h2>
              <p>Browse and download LoRA models</p>

              <div className="filter-container">
                <button
                  className="filter-toggle-button"
                  onClick={() => setIsLoraFilterExpanded(!isLoraFilterExpanded)}
                >
                  <span>Filters</span>
                  <span className={`filter-arrow ${isLoraFilterExpanded ? 'expanded' : ''}`}>▼</span>
                  <span className="filter-count">
                    {filteredLoras.length} / {loras.length}
                  </span>
                </button>

                <div className={`filter-content ${isLoraFilterExpanded ? 'expanded' : ''}`}>
                  <div>
                    <div className="filter-grid">
                      {/* Gender Filter */}
                      {renderLoraFilter(
                        'Gender',
                        'gender',
                        loraGenderFilter,
                        setLoraGenderFilter,
                        getLoraUniqueValues('gender'),
                        (val) => val === 'all' ? `All (${loras.length})` : val
                      )}

                      {/* Model Filter */}
                      {renderLoraFilter(
                        'Model',
                        'model',
                        loraModelFilter,
                        setLoraModelFilter,
                        getLoraUniqueValues('model'),
                        (val) => val === 'all' ? `All (${loras.length})` : val
                      )}

                      {/* Character Filter */}
                      {renderLoraFilter(
                        'Character',
                        'character',
                        loraCharacterFilter,
                        setLoraCharacterFilter,
                        getLoraUniqueValues('character'),
                        (val) => val === 'all' ? `All (${loras.length})` : val
                      )}

                      {/* Sort Dropdown */}
                      {renderSortDropdown(loraSortBy, setLoraSortBy, [
                        { value: 'default', label: 'Default' },
                        { value: 'mostCopied', label: 'Most Copied' },
                        { value: 'mostDownloaded', label: 'Most Downloaded' }
                      ])}
                    </div>

                    <div className="filter-info">
                      Showing {filteredLoras.length} of {loras.length} LoRAs
                    </div>
                  </div>
                </div>
              </div>

              <div className="content-section">
                <div className="lora-grid">
                  {filteredLoras.map((lora) => (
                    <div
                      key={lora.id}
                      className="lora-card"
                      onClick={() => setSelectedLora(lora)}
                    >
                      <div
                        className="lora-preview"
                        style={{ backgroundImage: `url(${lora.thumbnail})` }}
                      ></div>
                      <div className="lora-info">
                        <h4 className="lora-character">{lora.character}</h4>
                        <p className="lora-cloth">{lora.cloth || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="tab-content statistics-content">
              <h2>Statistics Dashboard</h2>
              <p>
                Overview of prompts and LoRA usage data
                {sensitivityFilter !== 'all' && (
                  <span className="stats-filter-badge">
                    {' '}· Filtered by: {sensitivityFilter.toUpperCase()}
                  </span>
                )}
              </p>

              {!statistics ? (
                <div className="loading-message">Loading statistics...</div>
              ) : (
                <div className="statistics-grid">
                  {/* Overview Cards */}
                  <div className="stats-overview">
                    <div className="stat-card">
                      <div className="stat-icon">📝</div>
                      <div className="stat-info">
                        <div className="stat-value">{statistics.prompts.total}</div>
                        <div className="stat-label">Total Prompts</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">🎨</div>
                      <div className="stat-info">
                        <div className="stat-value">{statistics.loras.total}</div>
                        <div className="stat-label">Total LoRAs</div>
                      </div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-icon">⬇️</div>
                      <div className="stat-info">
                        <div className="stat-value">{statistics.loras.totalDownloads}</div>
                        <div className="stat-label">Total Downloads</div>
                      </div>
                    </div>
                  </div>

                  {/* Prompt Statistics */}
                  <div className="chart-section">
                    <h3>Prompt Statistics</h3>

                    <div className="chart-container">
                      <h4>Top 10 Most Copied Prompts</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart
                          data={statistics.prompts.topCopied}
                          barCategoryGap="20%"
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 130, 191, 0.2)" />
                          <XAxis
                            dataKey="name"
                            stroke="#8ba4d0"
                            tick={{ fill: '#8ba4d0' }}
                          />
                          <YAxis
                            stroke="#8ba4d0"
                            tick={{ fill: '#8ba4d0' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(99, 130, 191, 0.08)' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                  <div className="custom-chart-tooltip">
                                    {data.thumbnail && (
                                      <img
                                        src={data.thumbnail}
                                        alt={data.name}
                                        className="tooltip-preview"
                                      />
                                    )}
                                    <div className="tooltip-info">
                                      <p className="tooltip-label">{data.name}</p>
                                      <p className="tooltip-value">Copies: {data.copyCount}</p>
                                      <p className="tooltip-meta">Place: {data.place}</p>
                                      <p className="tooltip-meta">Characters: {data.character}</p>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Bar dataKey="copyCount" fill="#6382bf" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="chart-row">
                      <div className="chart-container half-width">
                        <h4>Prompts by Character Count</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={Object.entries(statistics.prompts.byCharacter).map(([key, value]) => ({
                                name: `${key} Character${key > 1 ? 's' : ''}`,
                                value: value
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.keys(statistics.prompts.byCharacter).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={['#6382bf', '#8ba4d0', '#4a5f8f', '#5a7bb3', '#3d4f73'][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(35, 40, 55, 0.98)',
                                border: '1px solid rgba(99, 130, 191, 0.3)',
                                borderRadius: '8px',
                                color: '#e4e6eb'
                              }}
                              itemStyle={{
                                color: '#e4e6eb'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="chart-container half-width">
                        <h4>Prompts by Sensitivity</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={Object.entries(statistics.prompts.bySensitivity).map(([key, value]) => ({
                                name: key,
                                value: value
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              <Cell fill="#6382bf" />
                              <Cell fill="#e07a5f" />
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(35, 40, 55, 0.98)',
                                border: '1px solid rgba(99, 130, 191, 0.3)',
                                borderRadius: '8px',
                                color: '#e4e6eb'
                              }}
                              itemStyle={{
                                color: '#e4e6eb'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="chart-container">
                      <h4>Prompts by Type</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={Object.entries(statistics.prompts.byType).map(([key, value]) => ({
                          name: key,
                          count: value
                        }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 130, 191, 0.2)" />
                          <XAxis
                            dataKey="name"
                            stroke="#8ba4d0"
                            tick={{ fill: '#8ba4d0' }}
                            angle={-45}
                            textAnchor="end"
                            height={100}
                          />
                          <YAxis
                            stroke="#8ba4d0"
                            tick={{ fill: '#8ba4d0' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(99, 130, 191, 0.08)' }}
                            contentStyle={{
                              backgroundColor: 'rgba(35, 40, 55, 0.98)',
                              border: '1px solid rgba(99, 130, 191, 0.3)',
                              borderRadius: '8px',
                              color: '#e4e6eb'
                            }}
                          />
                          <Bar dataKey="count" fill="#8ba4d0" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* LoRA Statistics */}
                  <div className="chart-section">
                    <h3>LoRA Statistics</h3>

                    <div className="chart-container">
                      <h4>Top 10 Most Downloaded LoRAs</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={statistics.loras.topDownloaded}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(99, 130, 191, 0.2)" />
                          <XAxis
                            dataKey="name"
                            stroke="#8ba4d0"
                            tick={{ fill: '#8ba4d0' }}
                            angle={-45}
                            textAnchor="end"
                            height={100}
                          />
                          <YAxis
                            stroke="#8ba4d0"
                            tick={{ fill: '#8ba4d0' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(99, 130, 191, 0.08)' }}
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                  <div className="custom-chart-tooltip">
                                    {data.thumbnail && (
                                      <img
                                        src={data.thumbnail}
                                        alt={data.name}
                                        className="tooltip-preview"
                                      />
                                    )}
                                    <div className="tooltip-info">
                                      <p className="tooltip-label">{data.name}</p>
                                      <p className="tooltip-value">Downloads: {data.downloadCount}</p>
                                    </div>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                          <Bar dataKey="downloadCount" fill="#6382bf" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="chart-row">
                      <div className="chart-container half-width">
                        <h4>LoRAs by Gender</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={Object.entries(statistics.loras.byGender).map(([key, value]) => ({
                                name: key,
                                value: value
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.keys(statistics.loras.byGender).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={['#6382bf', '#e07a5f', '#8ba4d0'][index % 3]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(35, 40, 55, 0.98)',
                                border: '1px solid rgba(99, 130, 191, 0.3)',
                                borderRadius: '8px',
                                color: '#e4e6eb'
                              }}
                              itemStyle={{
                                color: '#e4e6eb'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="chart-container half-width">
                        <h4>LoRAs by Model</h4>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={Object.entries(statistics.loras.byModel).map(([key, value]) => ({
                                name: key,
                                value: value
                              }))}
                              cx="50%"
                              cy="50%"
                              labelLine={false}
                              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              outerRadius={70}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.keys(statistics.loras.byModel).map((_, index) => (
                                <Cell key={`cell-${index}`} fill={['#6382bf', '#8ba4d0', '#4a5f8f', '#5a7bb3', '#3d4f73'][index % 5]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'rgba(35, 40, 55, 0.98)',
                                border: '1px solid rgba(99, 130, 191, 0.3)',
                                borderRadius: '8px',
                                color: '#e4e6eb'
                              }}
                              itemStyle={{
                                color: '#e4e6eb'
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )}
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

            <div className="prompt-author">
              Author: {selectedPrompt.author}
            </div>

            <div className="prompt-meta-info">
              {selectedPrompt.character && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Character:</span>
                  <span className="prompt-meta-value">{selectedPrompt.character}</span>
                </div>
              )}
              {selectedPrompt.place && selectedPrompt.place !== 'Unknown' && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Place:</span>
                  <span className="prompt-meta-value">{selectedPrompt.place}</span>
                </div>
              )}
              {selectedPrompt.type && selectedPrompt.type !== 'Unknown' && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Type:</span>
                  <span className="prompt-meta-value">{selectedPrompt.type}</span>
                </div>
              )}
              {selectedPrompt.view && selectedPrompt.view !== 'Unknown' && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">View:</span>
                  <span className="prompt-meta-value">{selectedPrompt.view}</span>
                </div>
              )}
              {selectedPrompt.stability && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Stability:</span>
                  <span className={`stability-badge stability-${selectedPrompt.stability}`}>
                    S{selectedPrompt.stability}
                  </span>
                </div>
              )}
            </div>

            <button
              className="copy-button"
              onClick={() => handleCopyPrompt(selectedPrompt.prompt, selectedPrompt.id, 'prompt')}
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

      {selectedLora && (
        <div className="popup-overlay" onClick={() => setSelectedLora(null)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedLora(null)}>×</button>

            {selectedLora.versions && selectedLora.versions.length > 0 && (
              <div className="lora-version-header">
                <span className="lora-version-label">Version:</span>
                {selectedLora.hasMultipleVersions ? (
                  <div
                    className="custom-version-select"
                    onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
                  >
                    <div className="custom-version-select-trigger">
                      <span>{selectedLoraVersion ? selectedLoraVersion.displayName : 'Select version'}</span>
                      <svg className={`custom-version-arrow ${isVersionDropdownOpen ? 'open' : ''}`} width="12" height="8" viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1.5L6 6.5L11 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    {isVersionDropdownOpen && (
                      <div className="custom-version-options">
                        {selectedLora.versions.map((version) => (
                          <div
                            key={version.name}
                            className={`custom-version-option ${selectedLoraVersion && selectedLoraVersion.name === version.name ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedLoraVersion(version)
                              setIsVersionDropdownOpen(false)
                            }}
                          >
                            {version.displayName}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="lora-version-text">
                    {selectedLoraVersion ? selectedLoraVersion.displayName : selectedLora.versions[0].displayName}
                  </span>
                )}
              </div>
            )}

            <div className={`popup-images ${
              selectedLoraVersion && selectedLoraVersion.images && selectedLoraVersion.images.length > 1
                ? 'portrait'
                : 'landscape'
            }`}>
              {selectedLoraVersion && selectedLoraVersion.images && selectedLoraVersion.images.length > 0 ? (
                selectedLoraVersion.images.map((image, index) => (
                  <img key={index} src={image} alt={`${selectedLora.name} ${index + 1}`} />
                ))
              ) : (
                <img src={selectedLora.preview} alt={selectedLora.name} />
              )}
            </div>

            <div className="lora-meta-info">
              {selectedLora.character && (
                <div className="lora-meta-item">
                  <span className="lora-meta-label">Character:</span>
                  <span className="lora-meta-value">{selectedLora.character}</span>
                </div>
              )}
              {selectedLora.cloth && (
                <div className="lora-meta-item">
                  <span className="lora-meta-label">Cloth:</span>
                  <span className="lora-meta-value">{selectedLora.cloth}</span>
                </div>
              )}
              {selectedLora.gender && (
                <div className="lora-meta-item">
                  <span className="lora-meta-label">Gender:</span>
                  <span className="lora-meta-value">{selectedLora.gender}</span>
                </div>
              )}
              {selectedLora.model && (
                <div className="lora-meta-item">
                  <span className="lora-meta-label">Model:</span>
                  <span className="lora-meta-value">{selectedLora.model}</span>
                </div>
              )}
            </div>

            <div className="lora-actions">
              {/* External link button - temporarily disabled */}
              <button
                className="lora-action-button"
                disabled
                title="External link (temporarily unavailable)"
                style={{ opacity: 0.3, cursor: 'not-allowed' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </button>
              {selectedLoraVersion && selectedLoraVersion.filePath && (
                <button
                  className="lora-action-button"
                  onClick={() => handleDownload(selectedLora.id, selectedLoraVersion)}
                  title={`Download ${selectedLoraVersion.name} version`}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                </button>
              )}
              {selectedLora.prompt && (
                <button
                  className="lora-action-button"
                  onClick={() => handleCopyPrompt(selectedLora.prompt, selectedLora.id, 'lora')}
                  title="Copy prompt"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showHelpModal && (
        <div className="popup-overlay help-modal-overlay" onClick={() => setShowHelpModal(false)}>
          <div className="help-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setShowHelpModal(false)}>×</button>

            <h2>Prompt Gallery Guide</h2>

            <div className="help-section">
              <h3>How to Use</h3>
              <ul>
                <li>Click on any prompt card to view details and copy the prompt</li>
                <li>Use filters to narrow down prompts by character count, place, type, and view</li>
                <li>Sort by "Most Copied" to find popular prompts</li>
                <li>Toggle between SFW/NSFW content using the top-right switch</li>
              </ul>
            </div>

            <div className="help-section">
              <h3>Stability Levels</h3>
              <p>Stability indicates how consistently a prompt produces expected results:</p>
              <div className="stability-examples">
                <div className="stability-example">
                  <span className="stability-badge stability-1">S1</span>
                  <div>
                    <strong>High Stability</strong>
                    <p>Produces consistent results. Minimal "gacha" needed.</p>
                  </div>
                </div>
                <div className="stability-example">
                  <span className="stability-badge stability-2">S2</span>
                  <div>
                    <strong>Medium Stability</strong>
                    <p>Moderately consistent. Some variation expected.</p>
                  </div>
                </div>
                <div className="stability-example">
                  <span className="stability-badge stability-3">S3</span>
                  <div>
                    <strong>Low Stability</strong>
                    <p>Results vary significantly. More "gacha" required.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="help-section">
              <h3>Meta Information</h3>
              <p>Each prompt includes:</p>
              <ul>
                <li><strong>Author:</strong> Creator of the prompt</li>
                <li><strong>Character:</strong> Number of characters in the scene</li>
                <li><strong>Place:</strong> Scene location (Indoor, Outdoor, etc.)</li>
                <li><strong>Type:</strong> Scene type or action (Standing, Sitting, Running, etc.)</li>
                <li><strong>View:</strong> Camera angle (Front, Back, Side, etc.)</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
