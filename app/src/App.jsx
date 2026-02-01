import React, { useState, useEffect, useRef } from 'react'
import './App.css'
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import Gallery from './components/Gallery/Gallery'
import Request from './components/Request/Request'
import Changelog from './components/Changelog/Changelog'
import AdminLogin from './components/Gallery/Admin/AdminLogin'
import { useDataCache } from './hooks/useDataCache'
import { ToastProvider } from './components/Toast/ToastContext'

function App() {
  const [activeTab, setActiveTab] = useState(() => {
    // Load from localStorage, default to 'lora' for new users
    return localStorage.getItem('activeTab') || 'lora'
  })
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedPrompt, setSelectedPrompt] = useState(null)
  const [selectedCostume, setSelectedCostume] = useState(null)
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
  const [loraCompanyFilter, setLoraCompanyFilter] = useState('all')
  const [loraGroupFilter, setLoraGroupFilter] = useState('all')
  const [loraCharacterFilter, setLoraCharacterFilter] = useState('all')
  const [isLoraFilterExpanded, setIsLoraFilterExpanded] = useState(false)

  // Sort options
  const [promptSortBy, setPromptSortBy] = useState('default')
  const [loraSortBy, setLoraSortBy] = useState('default')

  // Help modal
  const [showHelpModal, setShowHelpModal] = useState(false)

  // Prompt edit mode
  const [isEditingPrompt, setIsEditingPrompt] = useState(false)
  const [isCreatingPrompt, setIsCreatingPrompt] = useState(false)
  const [editPromptData, setEditPromptData] = useState(null)

  // Costume edit mode
  const [isEditingCostume, setIsEditingCostume] = useState(false)
  const [isCreatingCostume, setIsCreatingCostume] = useState(false)
  const [editCostumeData, setEditCostumeData] = useState(null)
  const [pendingCostumeImages, setPendingCostumeImages] = useState([null, null])

  // Costume category state
  const [collapsedCostumeTypes, setCollapsedCostumeTypes] = useState(() => {
    try {
      const saved = localStorage.getItem('costume-collapsed-types')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })
  const [draggingCostumeType, setDraggingCostumeType] = useState(null)
  const [draggingCostume, setDraggingCostume] = useState(null)
  const [draggingCostumeFromType, setDraggingCostumeFromType] = useState(null)
  const costumeImageInputRef = useRef(null)
  const [uploadingCostumeImageIndex, setUploadingCostumeImageIndex] = useState(null)
  const [showPromptLogin, setShowPromptLogin] = useState(false)
  const imageInputRef = useRef(null)
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null)
  const [pendingImages, setPendingImages] = useState([null, null]) // Store File objects for upload
  const [promptFieldOptions, setPromptFieldOptions] = useState({
    place: [],
    type: [],
    view: [],
    nudity: []
  })

  // Scroll to top button visibility
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Shared admin state
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const token = localStorage.getItem('adminToken')
    const expiry = localStorage.getItem('adminTokenExpiry')
    return token && expiry && Date.now() < parseInt(expiry)
  })
  const [adminMode, setAdminMode] = useState(false)

  // Use data cache for prompts and loras
  const promptsCache = useDataCache('prompts', async () => {
    try {
      const response = await fetch('/api/prompts')
      return await response.json()
    } catch (error) {
      console.error('Failed to load prompts:', error)
      // Fallback
      try {
        const configResponse = await fetch('/api/config')
        const config = await configResponse.json()
        const folderName = config.promptFolder.name
        return [
          { id: '0', thumbnail: `/${folderName}/0/1.png`, images: [`/${folderName}/0/1.png`, `/${folderName}/0/2.png`], prompt: '', imageOrientation: 'portrait' },
          { id: '1', thumbnail: `/${folderName}/1/1.png`, images: [`/${folderName}/1/1.png`, `/${folderName}/1/2.png`], prompt: '', imageOrientation: 'portrait' }
        ]
      } catch (configError) {
        console.error('Failed to load config:', configError)
        return []
      }
    }
  }, { revalidateOnMount: true })

  const lorasCache = useDataCache('loras', async () => {
    try {
      const response = await fetch('/api/loras')
      return await response.json()
    } catch (error) {
      console.error('Failed to load LoRAs:', error)
      return []
    }
  })

  const costumesCache = useDataCache('costumes', async () => {
    try {
      const response = await fetch('/api/costumes')
      const data = await response.json()
      // New API returns { costumes, metadata }
      if (data.costumes && data.metadata) {
        return data
      }
      // Fallback for old API format
      return { costumes: data, metadata: { typeOrder: [], costumeOrder: {} } }
    } catch (error) {
      console.error('Failed to load costumes:', error)
      return { costumes: [], metadata: { typeOrder: [], costumeOrder: {} } }
    }
  })

  const prompts = promptsCache.data || []
  const loras = lorasCache.data || []
  const costumesData = costumesCache.data || { costumes: [], metadata: { typeOrder: [], costumeOrder: {} } }
  const costumes = costumesData.costumes || []
  const costumeMetadata = costumesData.metadata || { typeOrder: [], costumeOrder: {} }

  // Save sensitivity filter to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sensitivityFilter', sensitivityFilter)
  }, [sensitivityFilter])

  // Save active tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', activeTab)
  }, [activeTab])

  // Save costume collapsed types to localStorage
  useEffect(() => {
    localStorage.setItem('costume-collapsed-types', JSON.stringify([...collapsedCostumeTypes]))
  }, [collapsedCostumeTypes])

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
        if (isEditingPrompt) {
          handleCloseEditPrompt()
        }
        if (isEditingCostume) {
          handleCloseEditCostume()
        }
        if (selectedPrompt) {
          setSelectedPrompt(null)
        }
        if (selectedCostume) {
          setSelectedCostume(null)
        }
        if (selectedLora) {
          setSelectedLora(null)
          setSelectedLoraVersion(null)
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [selectedPrompt, selectedCostume, selectedLora, isEditingPrompt, isEditingCostume])

  // Handle scroll to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      // Show button when scrolled down more than 300px
      if (window.scrollY > 300) {
        setShowScrollTop(true)
      } else {
        setShowScrollTop(false)
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Load prompt field options for dynamic dropdowns
  useEffect(() => {
    const loadFieldOptions = async () => {
      try {
        const response = await fetch('/api/prompts/fields')
        const data = await response.json()
        console.log('Loaded field options:', data) // Debug
        setPromptFieldOptions(data)
      } catch (error) {
        console.error('Failed to load prompt field options:', error)
      }
    }
    loadFieldOptions()
  }, []) // Load on mount

  // Reload field options when prompts change
  useEffect(() => {
    if (prompts && prompts.length > 0) {
      fetch('/api/prompts/fields')
        .then(res => res.json())
        .then(data => setPromptFieldOptions(data))
        .catch(err => console.error('Failed to reload field options:', err))
    }
  }, [prompts])

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
        let endpoint
        if (itemType === 'prompt') {
          endpoint = `/api/prompts/${itemId}/copy`
        } else if (itemType === 'costume') {
          endpoint = `/api/costumes/${itemId}/copy`
        } else {
          endpoint = `/api/loras/${itemId}/copy`
        }
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

  const handleAdminLoginSuccess = (token) => {
    setIsLoggedIn(true)
    setAdminMode(true)
  }

  const handleAdminLogout = () => {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminTokenExpiry')
    setIsLoggedIn(false)
    setAdminMode(false)
  }

  const handleAdminModeToggle = () => {
    if (isLoggedIn) {
      setAdminMode(!adminMode)
    }
  }

  // Prompt admin handlers
  const handlePromptAdminClick = () => {
    if (isLoggedIn) {
      onPromptAdminModeToggle()
    } else {
      setShowPromptLogin(true)
    }
  }

  const onPromptAdminModeToggle = () => {
    if (isLoggedIn) {
      setAdminMode(!adminMode)
    }
  }

  const handlePromptLoginSuccess = (token) => {
    setIsLoggedIn(true)
    setAdminMode(true)
    setShowPromptLogin(false)
  }

  const handleEditPrompt = (prompt) => {
    setEditPromptData({
      ...prompt,
      editedTitle: prompt.title || '',
      editedPrompt: prompt.prompt,
      editedCharacter: prompt.character || 1,
      editedPlace: prompt.place || 'Unknown',
      editedSensitive: prompt.sensitive || 'SFW',
      editedType: prompt.type || 'Unknown',
      editedView: prompt.view || 'Unknown',
      editedNudity: prompt.nudity || 'Unknown',
      editedStability: prompt.stability || 1,
      editedAuthor: prompt.author || 'dANNY',
      editedImages: [...prompt.images]
    })
    setIsEditingPrompt(true)
    setIsCreatingPrompt(false)
  }

  const handleCreatePrompt = () => {
    setEditPromptData({
      id: null,
      editedTitle: '',
      editedPrompt: '',
      editedCharacter: 1,
      editedPlace: '',
      editedSensitive: 'SFW',
      editedType: '',
      editedView: '',
      editedNudity: '',
      editedStability: 1,
      editedAuthor: 'dANNY',
      editedImages: []
    })
    setPendingImages([null, null])
    setIsEditingPrompt(true)
    setIsCreatingPrompt(true)
  }

  const handleCloseEditPrompt = () => {
    setIsEditingPrompt(false)
    setIsCreatingPrompt(false)
    setEditPromptData(null)
    setPendingImages([null, null])
  }

  const handleUpdatePrompt = async () => {
    if (!editPromptData) return

    // Validation for required fields
    if (isCreatingPrompt && !editPromptData.editedTitle) {
      alert('Please enter a title for the prompt')
      return
    }
    if (!editPromptData.editedPlace || !editPromptData.editedType || !editPromptData.editedView || !editPromptData.editedNudity) {
      alert('Please fill in all required fields (Place, Type, View, Nudity)')
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      
      if (isCreatingPrompt) {
        // Validate: at least one image is required
        const hasImages = pendingImages.some(img => img !== null)
        if (!hasImages) {
          alert('Please upload at least one image')
          return
        }

        // Create new prompt
        const response = await fetch('/api/prompts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: editPromptData.editedTitle,
            prompt: editPromptData.editedPrompt,
            character: parseInt(editPromptData.editedCharacter),
            place: editPromptData.editedPlace,
            sensitive: editPromptData.editedSensitive,
            type: editPromptData.editedType,
            view: editPromptData.editedView,
            nudity: editPromptData.editedNudity,
            stability: parseInt(editPromptData.editedStability),
            author: editPromptData.editedAuthor
          })
        })

        if (response.ok) {
          const result = await response.json()
          
          // Upload pending images
          await uploadPendingImages(result.id)
          
          // Force reload prompts cache
          await promptsCache.loadData(true)
          handleCloseEditPrompt()
          showSavedToast()
        } else {
          alert('Failed to create prompt')
        }
      } else {
        // Update existing prompt
        const response = await fetch(`/api/prompts/${editPromptData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: editPromptData.editedTitle,
            prompt: editPromptData.editedPrompt,
            character: parseInt(editPromptData.editedCharacter),
            place: editPromptData.editedPlace,
            sensitive: editPromptData.editedSensitive,
            type: editPromptData.editedType,
            view: editPromptData.editedView,
            nudity: editPromptData.editedNudity,
            stability: parseInt(editPromptData.editedStability),
            author: editPromptData.editedAuthor
          })
        })

        if (response.ok) {
          // Upload any pending images for edit mode
          const hasChangedImages = pendingImages.some(img => img !== null)
          if (hasChangedImages) {
            await uploadPendingImages(editPromptData.id)
          }
          
          // Force reload prompts cache
          await promptsCache.loadData(true)
          handleCloseEditPrompt()
          showSavedToast()
        } else {
          alert('Failed to update prompt')
        }
      }
    } catch (error) {
      console.error('Failed to save prompt:', error)
      alert('Failed to save prompt')
    }
  }

  const handleImageClick = (index) => {
    if (!adminMode || !isEditingPrompt) return
    setUploadingImageIndex(index)
    imageInputRef.current?.click()
  }

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || uploadingImageIndex === null || !editPromptData) return

    // Store file for later upload (both create and edit mode)
    const newPendingImages = [...pendingImages]
    newPendingImages[uploadingImageIndex] = file
    setPendingImages(newPendingImages)
    
    // Create preview URL and update display
    const previewUrl = URL.createObjectURL(file)
    const newImages = [...(editPromptData.editedImages || [])]
    
    // Ensure array has enough slots
    while (newImages.length <= uploadingImageIndex) {
      newImages.push(null)
    }
    // Replace the image at the clicked position
    newImages[uploadingImageIndex] = previewUrl
    
    setEditPromptData(prev => ({
      ...prev,
      editedImages: newImages.filter(img => img !== null)
    }))
    
    setUploadingImageIndex(null)
    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  // Helper function to upload pending images after prompt creation
  const uploadPendingImages = async (promptId) => {
    const token = localStorage.getItem('adminToken')
    
    for (let i = 0; i < pendingImages.length; i++) {
      const file = pendingImages[i]
      if (!file) continue
      
      const formData = new FormData()
      formData.append('image', file)
      
      try {
        // imageIndex is now passed as URL param
        await fetch(`/api/prompts/${promptId}/image/${i}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })
      } catch (error) {
        console.error(`Failed to upload image ${i + 1}:`, error)
      }
    }
  }

  // Costume edit handlers
  const handleEditCostume = (costume) => {
    setEditCostumeData({
      ...costume,
      editedTitle: costume.title || '',
      editedPrompt: costume.prompt,
      editedCharacter: costume.character || 1,
      editedPlace: costume.place || 'Unknown',
      editedSensitive: costume.sensitive || 'SFW',
      editedType: costume.type || 'Costume',
      editedView: costume.view || 'Unknown',
      editedNudity: costume.nudity || 'Unknown',
      editedStability: costume.stability || 1,
      editedAuthor: costume.author || 'dANNY',
      editedImages: [...costume.images]
    })
    setIsEditingCostume(true)
    setIsCreatingCostume(false)
  }

  const handleCreateCostume = () => {
    setEditCostumeData({
      id: null,
      editedTitle: '',
      editedPrompt: '',
      editedCharacter: 1,
      editedPlace: '',
      editedSensitive: 'SFW',
      editedType: 'Costume',
      editedView: '',
      editedNudity: '',
      editedStability: 1,
      editedAuthor: 'dANNY',
      editedImages: []
    })
    setPendingCostumeImages([null, null])
    setIsEditingCostume(true)
    setIsCreatingCostume(true)
  }

  const handleCloseEditCostume = () => {
    setIsEditingCostume(false)
    setIsCreatingCostume(false)
    setEditCostumeData(null)
    setPendingCostumeImages([null, null])
  }

  const handleUpdateCostume = async () => {
    if (!editCostumeData) return

    if (isCreatingCostume && !editCostumeData.editedTitle) {
      alert('Please enter a title for the costume')
      return
    }
    if (!editCostumeData.editedPlace || !editCostumeData.editedView || !editCostumeData.editedNudity) {
      alert('Please fill in all required fields (Place, View, Nudity)')
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      
      if (isCreatingCostume) {
        const hasImages = pendingCostumeImages.some(img => img !== null)
        if (!hasImages) {
          alert('Please upload at least one image')
          return
        }

        const response = await fetch('/api/costumes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: editCostumeData.editedTitle,
            prompt: editCostumeData.editedPrompt,
            character: parseInt(editCostumeData.editedCharacter),
            place: editCostumeData.editedPlace,
            sensitive: editCostumeData.editedSensitive,
            type: editCostumeData.editedType || 'Costume',
            view: editCostumeData.editedView,
            nudity: editCostumeData.editedNudity,
            stability: parseInt(editCostumeData.editedStability),
            author: editCostumeData.editedAuthor
          })
        })

        if (response.ok) {
          const result = await response.json()
          await uploadPendingCostumeImages(result.id)
          await costumesCache.loadData(true)
          handleCloseEditCostume()
          showSavedToast()
        } else {
          alert('Failed to create costume')
        }
      } else {
        const response = await fetch(`/api/costumes/${editCostumeData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: editCostumeData.editedTitle,
            prompt: editCostumeData.editedPrompt,
            character: parseInt(editCostumeData.editedCharacter),
            place: editCostumeData.editedPlace,
            sensitive: editCostumeData.editedSensitive,
            type: editCostumeData.editedType || 'Costume',
            view: editCostumeData.editedView,
            nudity: editCostumeData.editedNudity,
            stability: parseInt(editCostumeData.editedStability),
            author: editCostumeData.editedAuthor
          })
        })

        if (response.ok) {
          for (let i = 0; i < pendingCostumeImages.length; i++) {
            const file = pendingCostumeImages[i]
            if (!file) continue
            
            const formData = new FormData()
            formData.append('image', file)
            
            await fetch(`/api/costumes/${editCostumeData.id}/image/${i}`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              },
              body: formData
            })
          }
          
          await costumesCache.loadData(true)
          handleCloseEditCostume()
          showSavedToast()
        } else {
          alert('Failed to update costume')
        }
      }
    } catch (error) {
      console.error('Failed to save costume:', error)
      alert('Failed to save costume')
    }
  }

  const handleCostumeImageClick = (index) => {
    if (!adminMode || !isEditingCostume) return
    setUploadingCostumeImageIndex(index)
    costumeImageInputRef.current?.click()
  }

  const handleCostumeImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || uploadingCostumeImageIndex === null || !editCostumeData) return

    const newPendingImages = [...pendingCostumeImages]
    newPendingImages[uploadingCostumeImageIndex] = file
    setPendingCostumeImages(newPendingImages)
    
    const previewUrl = URL.createObjectURL(file)
    const newImages = [...(editCostumeData.editedImages || [])]
    
    while (newImages.length <= uploadingCostumeImageIndex) {
      newImages.push(null)
    }
    newImages[uploadingCostumeImageIndex] = previewUrl
    
    setEditCostumeData(prev => ({
      ...prev,
      editedImages: newImages.filter(img => img !== null)
    }))
    
    setUploadingCostumeImageIndex(null)
    if (costumeImageInputRef.current) {
      costumeImageInputRef.current.value = ''
    }
  }

  const uploadPendingCostumeImages = async (costumeId) => {
    const token = localStorage.getItem('adminToken')
    
    for (let i = 0; i < pendingCostumeImages.length; i++) {
      const file = pendingCostumeImages[i]
      if (!file) continue
      
      const formData = new FormData()
      formData.append('image', file)
      
      try {
        await fetch(`/api/costumes/${costumeId}/image/${i}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })
      } catch (error) {
        console.error(`Failed to upload costume image ${i + 1}:`, error)
      }
    }
  }

  const handleCostumeAdminClick = () => {
    if (!isLoggedIn) {
      setShowPromptLogin(true)
    } else {
      setAdminMode(!adminMode)
    }
  }

  // Costume type collapse toggle
  const toggleCostumeType = (type) => {
    setCollapsedCostumeTypes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(type)) {
        newSet.delete(type)
      } else {
        newSet.add(type)
      }
      return newSet
    })
  }

  // Costume type drag handlers
  const handleCostumeTypeDragStart = (e, type) => {
    if (!adminMode) return
    setDraggingCostumeType(type)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCostumeTypeDragOver = (e, type) => {
    if (!adminMode || !draggingCostumeType || draggingCostumeType === type) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCostumeTypeDrop = async (e, targetType) => {
    if (!adminMode || !draggingCostumeType || draggingCostumeType === targetType) return
    e.preventDefault()

    const typeOrder = [...costumeMetadata.typeOrder]
    const fromIndex = typeOrder.indexOf(draggingCostumeType)
    const toIndex = typeOrder.indexOf(targetType)

    if (fromIndex !== -1 && toIndex !== -1) {
      typeOrder.splice(fromIndex, 1)
      typeOrder.splice(toIndex, 0, draggingCostumeType)

      // Save to server
      try {
        const token = localStorage.getItem('adminToken')
        await fetch('/api/costumes/metadata', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ typeOrder })
        })
        await costumesCache.loadData(true)
      } catch (error) {
        console.error('Failed to update type order:', error)
      }
    }

    setDraggingCostumeType(null)
  }

  const handleCostumeTypeDragEnd = () => {
    setDraggingCostumeType(null)
  }

  // Costume item drag handlers (within a type)
  const handleCostumeDragStart = (e, costumeId, type) => {
    if (!adminMode) return
    setDraggingCostume(costumeId)
    setDraggingCostumeFromType(type)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleCostumeDragOver = (e, costumeId, type) => {
    if (!adminMode || !draggingCostume || type !== draggingCostumeFromType) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleCostumeDrop = async (e, targetCostumeId, type) => {
    if (!adminMode || !draggingCostume || type !== draggingCostumeFromType || draggingCostume === targetCostumeId) return
    e.preventDefault()

    const costumeOrder = { ...costumeMetadata.costumeOrder }
    const typeOrder = [...(costumeOrder[type] || [])]
    const fromIndex = typeOrder.indexOf(draggingCostume)
    const toIndex = typeOrder.indexOf(targetCostumeId)

    if (fromIndex !== -1 && toIndex !== -1) {
      typeOrder.splice(fromIndex, 1)
      typeOrder.splice(toIndex, 0, draggingCostume)
      costumeOrder[type] = typeOrder

      // Save to server
      try {
        const token = localStorage.getItem('adminToken')
        await fetch('/api/costumes/metadata', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ costumeOrder })
        })
        await costumesCache.loadData(true)
      } catch (error) {
        console.error('Failed to update costume order:', error)
      }
    }

    setDraggingCostume(null)
    setDraggingCostumeFromType(null)
  }

  const handleCostumeDragEnd = () => {
    setDraggingCostume(null)
    setDraggingCostumeFromType(null)
  }

  // Get costumes by type, sorted by metadata order
  const getCostumesByType = (type) => {
    const typeCostumes = sensitivityFilteredCostumes.filter(c => c.type === type)
    const order = costumeMetadata.costumeOrder[type] || []
    
    return typeCostumes.sort((a, b) => {
      const aIndex = order.indexOf(a.id)
      const bIndex = order.indexOf(b.id)
      if (aIndex === -1 && bIndex === -1) return 0
      if (aIndex === -1) return 1
      if (bIndex === -1) return -1
      return aIndex - bIndex
    })
  }

  const showCopyToast = () => {
    showToast('Copied!')
  }

  const showSavedToast = () => {
    showToast('Saved!')
  }

  const showToast = (message) => {
    const toast = document.createElement('div')
    toast.className = 'copy-toast'
    toast.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      ${message}
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
    setSelectedCostume(null)
  }

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
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

  // Filter costumes by sensitivity
  const sensitivityFilteredCostumes = costumes.filter(c => {
    if (sensitivityFilter === 'sfw') return c.sensitive === 'SFW'
    if (sensitivityFilter === 'nsfw') return c.sensitive === 'NSFW'
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
      const companyMatch = loraCompanyFilter === 'all' || l.company === loraCompanyFilter
      const groupMatch = loraGroupFilter === 'all' || l.group === loraGroupFilter
      const characterMatch = loraCharacterFilter === 'all' || l.character === loraCharacterFilter

      return genderMatch && modelMatch && companyMatch && groupMatch && characterMatch
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
    <ToastProvider>
      <div className="app-container">
      {/* Floating Sensitivity Toggle */}
      <div className="sensitivity-toggle-container">
        <span className="sensitivity-label">Safety Switch</span>
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
        {/* Hamburger Menu Button (Mobile Only) */}
        <button
          className="hamburger-menu"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Mobile Sidebar */}
        {isSidebarOpen && (
          <>
            <div
              className="sidebar-overlay"
              onClick={() => setIsSidebarOpen(false)}
            />
            <div className="mobile-sidebar">
              <div className="sidebar-header">
                <h3>Navigation</h3>
                <button
                  className="sidebar-close"
                  onClick={() => setIsSidebarOpen(false)}
                  aria-label="Close navigation menu"
                >
                  ×
                </button>
              </div>
              <nav className="sidebar-nav">
                <button
                  className={`sidebar-tab ${activeTab === 'lora' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('lora')
                    setIsSidebarOpen(false)
                  }}
                >
                  LoRA
                </button>
                <button
                  className={`sidebar-tab ${activeTab === 'prompt' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('prompt')
                    setIsSidebarOpen(false)
                  }}
                >
                  Prompt
                </button>
                <button
                  className={`sidebar-tab ${activeTab === 'costume' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('costume')
                    setIsSidebarOpen(false)
                  }}
                >
                  Costume
                </button>
                <button
                  className={`sidebar-tab ${activeTab === 'gallery' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('gallery')
                    setIsSidebarOpen(false)
                  }}
                >
                  Collection
                </button>
                <button
                  className={`sidebar-tab ${activeTab === 'request' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('request')
                    setIsSidebarOpen(false)
                  }}
                >
                  Request
                </button>
                <button
                  className={`sidebar-tab ${activeTab === 'statistics' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('statistics')
                    setIsSidebarOpen(false)
                  }}
                >
                  Statistics
                </button>
                <button
                  className={`sidebar-tab ${activeTab === 'changelog' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTab('changelog')
                    setIsSidebarOpen(false)
                  }}
                >
                  Changelog
                </button>
              </nav>
            </div>
          </>
        )}

        {/* Desktop Tab Container */}
        <div className="tab-container">
          <button
            className={`tab ${activeTab === 'lora' ? 'active' : ''}`}
            onClick={() => setActiveTab('lora')}
          >
            LoRA
          </button>
          <button
            className={`tab ${activeTab === 'prompt' ? 'active' : ''}`}
            onClick={() => setActiveTab('prompt')}
          >
            Prompt
          </button>
          <button
            className={`tab ${activeTab === 'costume' ? 'active' : ''}`}
            onClick={() => setActiveTab('costume')}
          >
            Costume
          </button>
          <button
            className={`tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            Collection
          </button>
          <button
            className={`tab ${activeTab === 'request' ? 'active' : ''}`}
            onClick={() => setActiveTab('request')}
          >
            Request
          </button>
          <button
            className={`tab ${activeTab === 'statistics' ? 'active' : ''}`}
            onClick={() => setActiveTab('statistics')}
          >
            Statistics
          </button>
          <button
            className={`tab ${activeTab === 'changelog' ? 'active' : ''}`}
            onClick={() => setActiveTab('changelog')}
          >
            Changelog
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
                <div className="tab-header-actions">
                  <button
                    className="help-button"
                    onClick={() => setShowHelpModal(true)}
                    title="Help & Information"
                  >
                    ?
                  </button>
                  <button
                    className={`admin-toggle-btn ${adminMode ? 'active' : ''}`}
                    onClick={handlePromptAdminClick}
                    title={isLoggedIn ? (adminMode ? 'Exit Admin Mode' : 'Enter Admin Mode') : 'Admin Login'}
                  >
                    {adminMode ? '🔓 Admin Mode' : (isLoggedIn ? '🔒 Admin' : '🔐 Login')}
                  </button>
                </div>
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
                  {/* Add New Prompt Card (Admin Mode Only) */}
                  {adminMode && (
                    <div
                      className="prompt-card add-new-card"
                      onClick={handleCreatePrompt}
                    >
                      <div className="add-new-icon">+</div>
                      <div className="prompt-info">
                        <h4>Add New</h4>
                      </div>
                    </div>
                  )}
                  {filteredPrompts.map((item) => (
                    <div
                      key={item.id}
                      className={`prompt-card ${adminMode ? 'admin-mode' : ''}`}
                      onClick={() => adminMode ? handleEditPrompt(item) : setSelectedPrompt(item)}
                    >
                      <div
                        className="prompt-thumbnail"
                        style={{ backgroundImage: `url(${item.thumbnail})` }}
                      ></div>
                      <div className="prompt-info">
                        <h4>{item.title || ''}</h4>
                        {adminMode && <span className="edit-indicator">✎ Edit</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'lora' && (
            <div className="tab-content">
              <div className="tab-header">
                <div>
                  <h2>LoRA Gallery</h2>
                  <p>Browse and download LoRA models</p>
                </div>
              </div>

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

                      {/* Company Filter */}
                      {renderLoraFilter(
                        'Company',
                        'company',
                        loraCompanyFilter,
                        setLoraCompanyFilter,
                        getLoraUniqueValues('company'),
                        (val) => val === 'all' ? `All (${loras.length})` : val
                      )}

                      {/* Group Filter */}
                      {renderLoraFilter(
                        'Group',
                        'group',
                        loraGroupFilter,
                        setLoraGroupFilter,
                        getLoraUniqueValues('group'),
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

          {activeTab === 'costume' && (
            <div className="tab-content">
              <div className="tab-header">
                <div>
                  <h2>Costume Gallery</h2>
                  <p>Browse costume and outfit prompts by category</p>
                </div>
                <div className="tab-header-actions">
                  <button
                    className={`admin-toggle-btn ${adminMode ? 'active' : ''}`}
                    onClick={handleCostumeAdminClick}
                    title={isLoggedIn ? (adminMode ? 'Exit Admin Mode' : 'Enter Admin Mode') : 'Admin Login'}
                  >
                    {adminMode ? '🔓 Admin Mode' : (isLoggedIn ? '🔒 Admin' : '🔐 Login')}
                  </button>
                </div>
              </div>

              <div className="filter-info" style={{ padding: '0.5rem 1rem', color: '#9ca3b4', fontSize: '0.85rem' }}>
                Showing {sensitivityFilteredCostumes.length} of {costumes.length} costumes
                {adminMode && ' • Drag categories or items to reorder'}
              </div>

              {/* Add New Costume Button (Admin Mode Only) */}
              {adminMode && (
                <div style={{ padding: '0 1rem 1rem' }}>
                  <button
                    className="admin-btn admin-btn-primary"
                    onClick={handleCreateCostume}
                    style={{ width: '100%' }}
                  >
                    + Add New Costume
                  </button>
                </div>
              )}

              <div className="costume-categories">
                {costumeMetadata.typeOrder.map((type) => {
                  const typeCostumes = getCostumesByType(type)
                  const totalTypeCostumes = costumes.filter(c => c.type === type).length
                  const isCollapsed = collapsedCostumeTypes.has(type)

                  if (totalTypeCostumes === 0) return null

                  return (
                    <div
                      key={type}
                      className={`costume-category-section ${draggingCostumeType === type ? 'dragging' : ''}`}
                      draggable={adminMode}
                      onDragStart={(e) => handleCostumeTypeDragStart(e, type)}
                      onDragOver={(e) => handleCostumeTypeDragOver(e, type)}
                      onDrop={(e) => handleCostumeTypeDrop(e, type)}
                      onDragEnd={handleCostumeTypeDragEnd}
                    >
                      <div
                        className="costume-category-header"
                        onClick={() => toggleCostumeType(type)}
                      >
                        {adminMode && (
                          <span className="costume-drag-handle" title="Drag to reorder">⋮⋮</span>
                        )}
                        <span className={`costume-category-arrow ${isCollapsed ? '' : 'expanded'}`}>
                          ▶
                        </span>
                        <h3 className="costume-category-title">
                          {type}
                        </h3>
                        <span className="costume-category-count">
                          {typeCostumes.length !== totalTypeCostumes 
                            ? `${typeCostumes.length} / ${totalTypeCostumes}` 
                            : totalTypeCostumes}
                        </span>
                      </div>

                      {!isCollapsed && (
                        <div className="costume-grid">
                          {typeCostumes.length > 0 ? (
                            typeCostumes.map((item) => (
                              <div
                                key={item.id}
                                className={`prompt-card ${adminMode ? 'admin-mode' : ''} ${draggingCostume === item.id ? 'dragging' : ''}`}
                                draggable={adminMode}
                                onDragStart={(e) => { e.stopPropagation(); handleCostumeDragStart(e, item.id, type) }}
                                onDragOver={(e) => { e.stopPropagation(); handleCostumeDragOver(e, item.id, type) }}
                                onDrop={(e) => { e.stopPropagation(); handleCostumeDrop(e, item.id, type) }}
                                onDragEnd={handleCostumeDragEnd}
                                onClick={() => adminMode ? handleEditCostume(item) : setSelectedCostume(item)}
                              >
                                <div
                                  className="prompt-thumbnail"
                                  style={{ backgroundImage: `url(${item.thumbnail})` }}
                                ></div>
                                <div className="prompt-info">
                                  <h4>{item.title || ''}</h4>
                                  {adminMode && <span className="edit-indicator">✎ Edit</span>}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="costume-category-empty">
                              No costumes visible (filtered by sensitivity)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'gallery' && (
            <div className="tab-content">
              <Gallery
                sensitivityFilter={sensitivityFilter}
                isLoggedIn={isLoggedIn}
                adminMode={adminMode}
                onAdminLoginSuccess={handleAdminLoginSuccess}
                onAdminLogout={handleAdminLogout}
                onAdminModeToggle={handleAdminModeToggle}
              />
            </div>
          )}

          {activeTab === 'request' && (
            <div className="tab-content">
              <Request
                isLoggedIn={isLoggedIn}
                adminMode={adminMode}
                onAdminLoginSuccess={handleAdminLoginSuccess}
                onAdminLogout={handleAdminLogout}
                onAdminModeToggle={handleAdminModeToggle}
              />
            </div>
          )}

          {activeTab === 'statistics' && (
            <div className="tab-content statistics-content">
              <div className="tab-header">
                <div>
                  <h2>Statistics Dashboard</h2>
                  <p>
                    Overview of prompts and LoRA usage data
                    {sensitivityFilter !== 'all' && (
                      <span className="stats-filter-badge">
                        {' '}· Filtered by: {sensitivityFilter.toUpperCase()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="content-section">
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
                        <ResponsiveContainer width="100%" height={180}>
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
                              outerRadius={60}
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
                        <ResponsiveContainer width="100%" height={180}>
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
                              outerRadius={60}
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
                            tick={(props) => {
                              const { x, y, payload } = props
                              if (!payload || !payload.value) return null

                              // Split at first '-' to separate character and cloth
                              const dashIndex = payload.value.indexOf('-')
                              let line1 = payload.value
                              let line2 = ''

                              if (dashIndex !== -1) {
                                line1 = payload.value.substring(0, dashIndex)
                                line2 = payload.value.substring(dashIndex + 1)
                              }

                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <text
                                    x={0}
                                    y={0}
                                    textAnchor="middle"
                                    fontSize={12}
                                  >
                                    <tspan x={0} dy={16} fill="#8ba4d0">{line1}</tspan>
                                    {line2 && <tspan x={0} dy={14} fill="#6b7a99">{line2}</tspan>}
                                  </text>
                                </g>
                              )
                            }}
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

                                // Split character and cloth
                                const dashIndex = data.name.indexOf('-')
                                let character = data.name
                                let cloth = ''

                                if (dashIndex !== -1) {
                                  character = data.name.substring(0, dashIndex)
                                  cloth = data.name.substring(dashIndex + 1)
                                }

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
                                      <p className="tooltip-label">{character}</p>
                                      {cloth && <p className="tooltip-cloth">{cloth}</p>}
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
                        <ResponsiveContainer width="100%" height={180}>
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
                              outerRadius={60}
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
                        <ResponsiveContainer width="100%" height={180}>
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
                              outerRadius={60}
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
            </div>
          )}

          {activeTab === 'changelog' && (
            <div className="tab-content">
              <Changelog />
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

      {/* Costume Popup */}
      {selectedCostume && (
        <div className="popup-overlay" onClick={() => setSelectedCostume(null)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedCostume(null)}>×</button>

            <div className={`popup-images ${selectedCostume.imageOrientation === 'landscape' ? 'landscape' : 'portrait'}`}>
              {selectedCostume.images.map((image, index) => (
                <img key={index} src={image} alt={`Image ${index + 1}`} />
              ))}
            </div>

            <div className="prompt-author">
              Author: {selectedCostume.author}
            </div>

            <div className="prompt-meta-info">
              {selectedCostume.character && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Character:</span>
                  <span className="prompt-meta-value">{selectedCostume.character}</span>
                </div>
              )}
              {selectedCostume.place && selectedCostume.place !== 'Unknown' && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Place:</span>
                  <span className="prompt-meta-value">{selectedCostume.place}</span>
                </div>
              )}
              {selectedCostume.type && selectedCostume.type !== 'Unknown' && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Type:</span>
                  <span className="prompt-meta-value">{selectedCostume.type}</span>
                </div>
              )}
              {selectedCostume.view && selectedCostume.view !== 'Unknown' && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">View:</span>
                  <span className="prompt-meta-value">{selectedCostume.view}</span>
                </div>
              )}
              {selectedCostume.stability && (
                <div className="prompt-meta-item">
                  <span className="prompt-meta-label">Stability:</span>
                  <span className={`stability-badge stability-${selectedCostume.stability}`}>
                    S{selectedCostume.stability}
                  </span>
                </div>
              )}
            </div>

            <button
              className="copy-button"
              onClick={() => handleCopyPrompt(selectedCostume.prompt, selectedCostume.id, 'costume')}
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

      {/* Prompt Edit Modal (Admin Mode) */}
      {isEditingPrompt && editPromptData && (
        <div className="popup-overlay" onClick={handleCloseEditPrompt}>
          <div className="popup-content edit-mode" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={handleCloseEditPrompt}>×</button>

            <h3 className="edit-modal-title">
              {isCreatingPrompt ? 'Create New Prompt' : `Edit Prompt #${editPromptData.id}`}
            </h3>

            {/* Hidden file input for image upload */}
            <input
              type="file"
              ref={imageInputRef}
              style={{ display: 'none' }}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageUpload}
            />

            {/* Editable Images */}
            {isCreatingPrompt ? (
              // Create mode: show upload placeholders with previews
              <div className="popup-images edit-images portrait">
                <div className="edit-image-placeholder-container">
                  {[0, 1].map(index => (
                    <div
                      key={index}
                      className={`edit-image-placeholder ${pendingImages[index] ? 'has-image' : ''}`}
                      onClick={() => handleImageClick(index)}
                    >
                      {editPromptData.editedImages[index] ? (
                        <>
                          <img src={editPromptData.editedImages[index]} alt={`Preview ${index + 1}`} />
                          <div className="edit-image-overlay">
                            <span>📷 Click to replace</span>
                          </div>
                        </>
                      ) : (
                        <span>📷 Click to upload Image {index + 1} {index === 0 ? <span className="required">*</span> : '(optional)'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : editPromptData.id ? (
              // Edit mode: show existing images or upload placeholders
              <div className={`popup-images edit-images ${editPromptData.imageOrientation === 'landscape' ? 'landscape' : 'portrait'}`}>
                {editPromptData.editedImages.length > 0 ? (
                  editPromptData.editedImages.map((image, index) => (
                    <div
                      key={index}
                      className="edit-image-container"
                      onClick={() => handleImageClick(index)}
                    >
                      <img src={image} alt={`Image ${index + 1}`} />
                      <div className="edit-image-overlay">
                        <span>📷 Click to replace</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="edit-image-placeholder-container">
                    <div
                      className="edit-image-placeholder"
                      onClick={() => handleImageClick(0)}
                    >
                      <span>📷 Click to upload Image 1</span>
                    </div>
                    <div
                      className="edit-image-placeholder"
                      onClick={() => handleImageClick(1)}
                    >
                      <span>📷 Click to upload Image 2</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Datalists for autocomplete */}
            <datalist id="place-options">
              {promptFieldOptions.place.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <datalist id="type-options">
              {promptFieldOptions.type.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <datalist id="view-options">
              {promptFieldOptions.view.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <datalist id="nudity-options">
              {promptFieldOptions.nudity.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

            {/* Editable Meta Fields */}
            <div className="edit-form">
              <div className="edit-field full-width">
                <label>Title: {isCreatingPrompt && <span className="required">*</span>}</label>
                <input
                  type="text"
                  value={editPromptData.editedTitle}
                  onChange={(e) => setEditPromptData(prev => ({ ...prev, editedTitle: e.target.value }))}
                  placeholder="Enter prompt title..."
                />
              </div>

              <div className="edit-field">
                <label>Author:</label>
                <input
                  type="text"
                  value={editPromptData.editedAuthor}
                  onChange={(e) => setEditPromptData(prev => ({ ...prev, editedAuthor: e.target.value }))}
                />
              </div>

              <div className="edit-field-grid">
                <div className="edit-field">
                  <label>Character:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editPromptData.editedCharacter}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedCharacter: e.target.value }))}
                  />
                </div>

                <div className="edit-field">
                  <label>Place: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="place-options"
                    value={editPromptData.editedPlace}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedPlace: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>Sensitivity:</label>
                  <select
                    value={editPromptData.editedSensitive}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedSensitive: e.target.value }))}
                  >
                    <option value="SFW">SFW</option>
                    <option value="NSFW">NSFW</option>
                  </select>
                </div>

                <div className="edit-field">
                  <label>Type: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="type-options"
                    value={editPromptData.editedType}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedType: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>View: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="view-options"
                    value={editPromptData.editedView}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedView: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>Nudity: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="nudity-options"
                    value={editPromptData.editedNudity}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedNudity: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>Stability:</label>
                  <select
                    value={editPromptData.editedStability}
                    onChange={(e) => setEditPromptData(prev => ({ ...prev, editedStability: e.target.value }))}
                  >
                    <option value="1">S1 - High</option>
                    <option value="2">S2 - Medium</option>
                    <option value="3">S3 - Low</option>
                  </select>
                </div>
              </div>

              {/* Editable Prompt Text */}
              <div className="edit-field full-width">
                <label>Prompt:</label>
                <textarea
                  value={editPromptData.editedPrompt}
                  onChange={(e) => setEditPromptData(prev => ({ ...prev, editedPrompt: e.target.value }))}
                  rows={6}
                  placeholder="Enter prompt text..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="edit-actions">
              <button className="cancel-button" onClick={handleCloseEditPrompt}>
                Cancel
              </button>
              <button className="update-button" onClick={handleUpdatePrompt}>
                {isCreatingPrompt ? 'Create Prompt' : 'Update Prompt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Costume Edit Modal (Admin Mode) */}
      {isEditingCostume && editCostumeData && (
        <div className="popup-overlay" onClick={handleCloseEditCostume}>
          <div className="popup-content edit-mode" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={handleCloseEditCostume}>×</button>

            <h3 className="edit-modal-title">
              {isCreatingCostume ? 'Create New Costume' : `Edit Costume #${editCostumeData.id}`}
            </h3>

            {/* Hidden file input for image upload */}
            <input
              type="file"
              ref={costumeImageInputRef}
              style={{ display: 'none' }}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleCostumeImageUpload}
            />

            {/* Editable Images */}
            {isCreatingCostume ? (
              <div className="popup-images edit-images portrait">
                <div className="edit-image-placeholder-container">
                  {[0, 1].map(index => (
                    <div
                      key={index}
                      className={`edit-image-placeholder ${pendingCostumeImages[index] ? 'has-image' : ''}`}
                      onClick={() => handleCostumeImageClick(index)}
                    >
                      {editCostumeData.editedImages[index] ? (
                        <>
                          <img src={editCostumeData.editedImages[index]} alt={`Preview ${index + 1}`} />
                          <div className="edit-image-overlay">
                            <span>📷 Click to replace</span>
                          </div>
                        </>
                      ) : (
                        <span>📷 Click to upload Image {index + 1} {index === 0 ? <span className="required">*</span> : '(optional)'}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : editCostumeData.id ? (
              <div className={`popup-images edit-images ${editCostumeData.imageOrientation === 'landscape' ? 'landscape' : 'portrait'}`}>
                {editCostumeData.editedImages.length > 0 ? (
                  editCostumeData.editedImages.map((image, index) => (
                    <div
                      key={index}
                      className="edit-image-container"
                      onClick={() => handleCostumeImageClick(index)}
                    >
                      <img src={image} alt={`Image ${index + 1}`} />
                      <div className="edit-image-overlay">
                        <span>📷 Click to replace</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="edit-image-placeholder-container">
                    <div
                      className="edit-image-placeholder"
                      onClick={() => handleCostumeImageClick(0)}
                    >
                      <span>📷 Click to upload Image 1</span>
                    </div>
                    <div
                      className="edit-image-placeholder"
                      onClick={() => handleCostumeImageClick(1)}
                    >
                      <span>📷 Click to upload Image 2</span>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {/* Datalists for autocomplete */}
            <datalist id="costume-type-options">
              {costumeMetadata.typeOrder.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <datalist id="costume-place-options">
              {promptFieldOptions.place.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <datalist id="costume-view-options">
              {promptFieldOptions.view.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>
            <datalist id="costume-nudity-options">
              {promptFieldOptions.nudity.map(opt => (
                <option key={opt} value={opt} />
              ))}
            </datalist>

            {/* Editable Meta Fields */}
            <div className="edit-form">
              <div className="edit-field full-width">
                <label>Title: {isCreatingCostume && <span className="required">*</span>}</label>
                <input
                  type="text"
                  value={editCostumeData.editedTitle}
                  onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedTitle: e.target.value }))}
                  placeholder="Enter costume title..."
                />
              </div>

              <div className="edit-field">
                <label>Author:</label>
                <input
                  type="text"
                  value={editCostumeData.editedAuthor}
                  onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedAuthor: e.target.value }))}
                />
              </div>

              <div className="edit-field-grid">
                <div className="edit-field">
                  <label>Character:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editCostumeData.editedCharacter}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedCharacter: e.target.value }))}
                  />
                </div>

                <div className="edit-field">
                  <label>Place: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="costume-place-options"
                    value={editCostumeData.editedPlace}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedPlace: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>Type: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="costume-type-options"
                    value={editCostumeData.editedType}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedType: e.target.value }))}
                    placeholder="Type or select category..."
                  />
                </div>

                <div className="edit-field">
                  <label>Sensitivity:</label>
                  <select
                    value={editCostumeData.editedSensitive}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedSensitive: e.target.value }))}
                  >
                    <option value="SFW">SFW</option>
                    <option value="NSFW">NSFW</option>
                  </select>
                </div>

                <div className="edit-field">
                  <label>View: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="costume-view-options"
                    value={editCostumeData.editedView}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedView: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>Nudity: <span className="required">*</span></label>
                  <input
                    type="text"
                    list="costume-nudity-options"
                    value={editCostumeData.editedNudity}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedNudity: e.target.value }))}
                    placeholder="Type or select..."
                  />
                </div>

                <div className="edit-field">
                  <label>Stability:</label>
                  <select
                    value={editCostumeData.editedStability}
                    onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedStability: e.target.value }))}
                  >
                    <option value="1">S1 - High</option>
                    <option value="2">S2 - Medium</option>
                    <option value="3">S3 - Low</option>
                  </select>
                </div>
              </div>

              {/* Editable Prompt Text */}
              <div className="edit-field full-width">
                <label>Prompt:</label>
                <textarea
                  value={editCostumeData.editedPrompt}
                  onChange={(e) => setEditCostumeData(prev => ({ ...prev, editedPrompt: e.target.value }))}
                  rows={6}
                  placeholder="Enter prompt text..."
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="edit-actions">
              <button className="cancel-button" onClick={handleCloseEditCostume}>
                Cancel
              </button>
              <button className="update-button" onClick={handleUpdateCostume}>
                {isCreatingCostume ? 'Create Costume' : 'Update Costume'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Prompt Admin Login Modal */}
      {showPromptLogin && (
        <AdminLogin
          onClose={() => setShowPromptLogin(false)}
          onLoginSuccess={handlePromptLoginSuccess}
        />
      )}

      {selectedLora && (
        <div className="popup-overlay" onClick={() => setSelectedLora(null)}>
          <div className="popup-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedLora(null)}>×</button>

            {selectedLora.versions && selectedLora.versions.length > 0 && (
              <div className="lora-version-header">
                <div className="lora-version-left">
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
                <div className="lora-company-group-container">
                  {selectedLora.company && (
                    <div className="lora-company-line">
                      <span className="company-from-label">From:</span>
                      <span className="lora-company-name">{selectedLora.company}</span>
                    </div>
                  )}
                  {selectedLora.group && selectedLora.group !== 'N/A' && (
                    <div className="lora-group-line">
                      {selectedLora.group}
                    </div>
                  )}
                </div>
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

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button className="scroll-to-top" onClick={scrollToTop} title="Back to top">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 19V5M5 12l7-7 7 7"/>
          </svg>
        </button>
      )}
      </div>
    </ToastProvider>
  )
}

export default App
