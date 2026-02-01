import React, { useState, useEffect, useRef } from 'react'
import AdminLogin from '../Gallery/Admin/AdminLogin'
import './Request.css'

function Request({ isLoggedIn, adminMode, onAdminLoginSuccess, onAdminLogout, onAdminModeToggle }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [showRequestModal, setShowRequestModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [editingRequest, setEditingRequest] = useState(null)
  const [requestType, setRequestType] = useState('lora')

  // Expanded card tracking
  const [expandedCards, setExpandedCards] = useState(new Set())

  // Category collapse state (persisted in localStorage)
  const [collapsedCategories, setCollapsedCategories] = useState(() => {
    try {
      const saved = localStorage.getItem('request-collapsed-categories')
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Status filter
  const [statusFilter, setStatusFilter] = useState('all')

  // Form states
  const [formData, setFormData] = useState({
    characterName: '',
    outfit: '',
    livestreamArchive: '',
    channelLink: '',
    socialMediaLink: ''
  })
  const [formErrors, setFormErrors] = useState({})

  // Persist collapsed categories
  useEffect(() => {
    localStorage.setItem('request-collapsed-categories', JSON.stringify([...collapsedCategories]))
  }, [collapsedCategories])

  // Clear expanded cards when entering admin mode (logged-in users)
  useEffect(() => {
    if (adminMode && isLoggedIn) {
      setExpandedCards(new Set())
    }
  }, [adminMode, isLoggedIn])

  // Load requests on mount
  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/requests')
      const data = await response.json()
      setRequests(data)
    } catch (error) {
      console.error('Failed to load requests:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = () => {
    setShowRequestModal(true)
    setFormData({
      characterName: '',
      outfit: '',
      livestreamArchive: '',
      channelLink: '',
      socialMediaLink: ''
    })
    setFormErrors({})
  }

  const handleCloseModal = () => {
    setShowRequestModal(false)
    setFormData({
      characterName: '',
      outfit: '',
      livestreamArchive: '',
      channelLink: '',
      socialMediaLink: ''
    })
    setFormErrors({})
  }

  const validateForm = () => {
    const errors = {}

    if (!formData.characterName.trim()) {
      errors.characterName = 'Character name is required'
    }

    if (!formData.outfit.trim()) {
      errors.outfit = 'Outfit name is required'
    }

    if (!formData.livestreamArchive.trim()) {
      errors.livestreamArchive = 'Livestream archive link is required'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: requestType,
          ...formData,
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      })

      if (response.ok) {
        handleCloseModal()
        loadRequests()
      } else {
        alert('Failed to submit request')
      }
    } catch (error) {
      console.error('Failed to submit request:', error)
      alert('Failed to submit request')
    }
  }

  const handleStatusChange = async (requestId, newStatus) => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (response.ok) {
        loadRequests()
      } else {
        alert('Failed to update status')
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      alert('Failed to update status')
    }
  }

  const handleOpenEditModal = (request) => {
    setEditingRequest(request)
    setRequestType(request.type)
    setFormData({
      characterName: request.characterName,
      outfit: request.outfit,
      livestreamArchive: request.livestreamArchive || '',
      channelLink: request.channelLink || '',
      socialMediaLink: request.socialMediaLink || ''
    })
    setFormErrors({})
    setShowEditModal(true)
  }

  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setEditingRequest(null)
    setFormData({
      characterName: '',
      outfit: '',
      livestreamArchive: '',
      channelLink: '',
      socialMediaLink: ''
    })
    setFormErrors({})
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/requests/${editingRequest.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: requestType,
          ...formData,
          status: editingRequest.status
        })
      })

      if (response.ok) {
        handleCloseEditModal()
        loadRequests()
      } else {
        alert('Failed to update request')
      }
    } catch (error) {
      console.error('Failed to update request:', error)
      alert('Failed to update request')
    }
  }

  const handleDelete = async (requestId) => {
    if (!window.confirm('Are you sure you want to delete this request?')) {
      return
    }

    try {
      const token = localStorage.getItem('adminToken')
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        loadRequests()
      } else {
        alert('Failed to delete request')
      }
    } catch (error) {
      console.error('Failed to delete request:', error)
      alert('Failed to delete request')
    }
  }

  const handleMoveUp = async (index) => {
    if (index === 0) return

    const newRequests = [...requests]
    const temp = newRequests[index]
    newRequests[index] = newRequests[index - 1]
    newRequests[index - 1] = temp

    await updateOrder(newRequests)
  }

  const handleMoveDown = async (index) => {
    if (index === requests.length - 1) return

    const newRequests = [...requests]
    const temp = newRequests[index]
    newRequests[index] = newRequests[index + 1]
    newRequests[index + 1] = temp

    await updateOrder(newRequests)
  }

  const updateOrder = async (newRequests) => {
    try {
      const token = localStorage.getItem('adminToken')
      const orderedIds = newRequests.map(r => r.id)

      const response = await fetch('/api/requests/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderedIds })
      })

      if (response.ok) {
        setRequests(newRequests)
      } else {
        alert('Failed to reorder requests')
      }
    } catch (error) {
      console.error('Failed to reorder requests:', error)
      alert('Failed to reorder requests')
    }
  }

  const handleAdminClick = () => {
    if (isLoggedIn) {
      onAdminModeToggle()
    } else {
      setShowLogin(true)
    }
  }

  const handleLoginSuccess = (token) => {
    onAdminLoginSuccess(token)
    setShowLogin(false)
  }

  const handleLogout = () => {
    onAdminLogout()
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return '#9ca3b4'
      case 'in-progress': return '#6382bf'
      case 'completed': return '#4ade80'
      case 'rejected': return '#e07a5f'
      default: return '#9ca3b4'
    }
  }

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending'
      case 'in-progress': return 'In Progress'
      case 'completed': return 'Completed'
      case 'rejected': return 'Rejected'
      default: return status
    }
  }

  // Toggle card expand/collapse
  const toggleCard = (cardId) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }

  // Toggle category collapse
  const toggleCategory = (categoryKey) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryKey)) {
        next.delete(categoryKey)
      } else {
        next.add(categoryKey)
      }
      return next
    })
  }

  // Filter requests by status, sort by date (earliest first), completed always last
  const sortRequests = (list) => {
    const byDate = (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    const nonCompleted = list.filter(r => r.status !== 'completed').sort(byDate)
    const completed = list.filter(r => r.status === 'completed').sort(byDate)
    return [...nonCompleted, ...completed]
  }

  const filteredRequests = sortRequests(
    statusFilter === 'all'
      ? requests
      : requests.filter(r => r.status === statusFilter)
  )

  // Group by type
  const requestTypes = [
    { key: 'lora', label: 'LoRA Requests', icon: '🎨' }
    // Future types can be added here:
    // { key: 'prompt', label: 'Prompt Requests', icon: '📝' },
  ]

  // Get status counts for filter chips
  const statusCounts = {
    all: requests.length,
    pending: requests.filter(r => r.status === 'pending').length,
    'in-progress': requests.filter(r => r.status === 'in-progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
    rejected: requests.filter(r => r.status === 'rejected').length
  }

  // Render a compact request card
  const renderRequestCard = (request, index) => {
    const isExpanded = expandedCards.has(request.id)
    const isCompleted = request.status === 'completed'

    return (
      <div
        key={request.id}
        className={`request-card ${isExpanded ? 'expanded' : 'compact'} ${isCompleted ? 'completed' : ''}`}
        onClick={() => !adminMode && toggleCard(request.id)}
      >
        {/* Completed overlay */}
        {isCompleted && <div className="request-card-completed-overlay" />}

        {/* Compact view - always visible */}
        <div className="request-card-compact">
          <div className="request-card-header">
            <span
              className="request-status-badge"
              style={{ backgroundColor: getStatusColor(request.status) }}
            >
              {getStatusText(request.status)}
            </span>
            {!adminMode && (
              <span className={`request-expand-icon ${isExpanded ? 'expanded' : ''}`}>
                ▼
              </span>
            )}
          </div>

          <div className="request-card-summary">
            <h3>{request.characterName}</h3>
            <p className="request-outfit">{request.outfit}</p>
          </div>
        </div>

        {/* Expanded details - shown on click */}
        {isExpanded && (
          <div className="request-card-details">
            <div className="request-field">
              <strong>Archive:</strong>{' '}
              {request.livestreamArchive ? (
                <a
                  href={request.livestreamArchive}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Link
                </a>
              ) : (
                <span className="request-field-empty">-</span>
              )}
            </div>
            <div className="request-field">
              <strong>Channel:</strong>{' '}
              {request.channelLink ? (
                <a
                  href={request.channelLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Link
                </a>
              ) : (
                <span className="request-field-empty">-</span>
              )}
            </div>
            <div className="request-field">
              <strong>Social:</strong>{' '}
              {request.socialMediaLink ? (
                <a
                  href={request.socialMediaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                >
                  Link
                </a>
              ) : (
                <span className="request-field-empty">-</span>
              )}
            </div>
            <div className="request-date">
              {new Date(request.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}

        {/* Admin controls */}
        {adminMode && (
          <div className="request-card-admin" onClick={(e) => e.stopPropagation()}>
            <div className="request-admin-controls">
              <select
                value={request.status}
                onChange={(e) => handleStatusChange(request.id, e.target.value)}
                className="status-select"
              >
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                className="admin-button edit-button"
                onClick={() => handleOpenEditModal(request)}
                title="Edit request"
              >
                ✎
              </button>
              <button
                className="admin-button delete-button"
                onClick={() => handleDelete(request.id)}
                title="Delete request"
              >
                🗑
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="request-container">
      <div className="request-header">
        <div>
          <h2>Request Management</h2>
          <p>Submit or view LoRA and Prompt requests</p>
        </div>
        <div className="request-header-actions">
          <button className="submit-request-button" onClick={handleOpenModal}>
            + New Request
          </button>
          <button
            className={`admin-toggle-btn ${adminMode ? 'active' : ''}`}
            onClick={handleAdminClick}
            title={isLoggedIn ? (adminMode ? 'Exit Admin Mode' : 'Enter Admin Mode') : 'Admin Login'}
          >
            {adminMode ? '🔓 Admin Mode' : (isLoggedIn ? '🔒 Admin' : '🔐 Login')}
          </button>
        </div>
      </div>

      {/* Status Filter Chips */}
      {!loading && requests.length > 0 && (
        <div className="request-status-filters">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending' },
            { key: 'in-progress', label: 'In Progress' },
            { key: 'completed', label: 'Completed' },
            { key: 'rejected', label: 'Rejected' }
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`status-chip ${statusFilter === key ? 'active' : ''} ${key !== 'all' ? `status-chip-${key}` : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              {label}
              <span className="status-chip-count">{statusCounts[key]}</span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="request-loading">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="request-empty">
          <p>No requests yet. Be the first to submit one!</p>
        </div>
      ) : (
        <div className="request-categories">
          {requestTypes.map(({ key, label, icon }) => {
            const typeRequests = filteredRequests.filter(r => r.type === key)
            const totalTypeRequests = requests.filter(r => r.type === key).length
            const isCollapsed = collapsedCategories.has(key)

            if (totalTypeRequests === 0) return null

            return (
              <div key={key} className="request-category-section">
                <div
                  className="request-category-header"
                  onClick={() => toggleCategory(key)}
                >
                  <span className={`request-category-arrow ${isCollapsed ? '' : 'expanded'}`}>
                    ▶
                  </span>
                  <h3 className="request-category-title">
                    <span className="request-category-icon">{icon}</span>
                    {label}
                  </h3>
                  <span className="request-category-count">
                    {statusFilter !== 'all' ? `${typeRequests.length} / ${totalTypeRequests}` : totalTypeRequests}
                  </span>
                </div>

                {!isCollapsed && (
                  <div className="request-grid-list">
                    {typeRequests.length > 0 ? (
                      typeRequests.map((request, index) => renderRequestCard(request, index))
                    ) : (
                      <div className="request-category-empty">
                        No {statusFilter} requests
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Request Modal */}
      {showRequestModal && (
        <div className="request-modal-overlay" onClick={handleCloseModal}>
          <div className="request-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="request-modal-close" onClick={handleCloseModal}>×</button>

            <h2>New Request</h2>

            <div className="request-type-selector">
              <button
                className={`type-button ${requestType === 'lora' ? 'active' : ''}`}
                onClick={() => setRequestType('lora')}
              >
                LoRA Request
              </button>
              <button
                className={`type-button ${requestType === 'prompt' ? 'active' : ''}`}
                onClick={() => setRequestType('prompt')}
                disabled
                title="Coming soon"
              >
                Prompt Request (Coming Soon)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="request-form">
              <div className="form-group">
                <label htmlFor="characterName">
                  Character Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="characterName"
                  value={formData.characterName}
                  onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                  className={formErrors.characterName ? 'error' : ''}
                  placeholder="Enter character name"
                />
                {formErrors.characterName && (
                  <span className="error-message">{formErrors.characterName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="outfit">
                  Outfit Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="outfit"
                  value={formData.outfit}
                  onChange={(e) => setFormData({ ...formData, outfit: e.target.value })}
                  className={formErrors.outfit ? 'error' : ''}
                  placeholder="Enter outfit name"
                />
                {formErrors.outfit && (
                  <span className="error-message">{formErrors.outfit}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="livestreamArchive">
                  Livestream Archive <span className="required">*</span>
                </label>
                <input
                  type="url"
                  id="livestreamArchive"
                  value={formData.livestreamArchive}
                  onChange={(e) => setFormData({ ...formData, livestreamArchive: e.target.value })}
                  className={formErrors.livestreamArchive ? 'error' : ''}
                  placeholder="https://..."
                />
                {formErrors.livestreamArchive && (
                  <span className="error-message">{formErrors.livestreamArchive}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="channelLink">Channel Link</label>
                <input
                  type="url"
                  id="channelLink"
                  value={formData.channelLink}
                  onChange={(e) => setFormData({ ...formData, channelLink: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="socialMediaLink">Social Media Link</label>
                <input
                  type="url"
                  id="socialMediaLink"
                  value={formData.socialMediaLink}
                  onChange={(e) => setFormData({ ...formData, socialMediaLink: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCloseModal} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingRequest && (
        <div className="request-modal-overlay" onClick={handleCloseEditModal}>
          <div className="request-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="request-modal-close" onClick={handleCloseEditModal}>×</button>

            <h2>Edit Request</h2>

            <div className="request-type-selector">
              <button
                className={`type-button ${requestType === 'lora' ? 'active' : ''}`}
                onClick={() => setRequestType('lora')}
              >
                LoRA Request
              </button>
              <button
                className={`type-button ${requestType === 'prompt' ? 'active' : ''}`}
                onClick={() => setRequestType('prompt')}
                disabled
                title="Coming soon"
              >
                Prompt Request (Coming Soon)
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="request-form">
              <div className="form-group">
                <label htmlFor="edit-characterName">
                  Character Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="edit-characterName"
                  value={formData.characterName}
                  onChange={(e) => setFormData({ ...formData, characterName: e.target.value })}
                  className={formErrors.characterName ? 'error' : ''}
                  placeholder="Enter character name"
                />
                {formErrors.characterName && (
                  <span className="error-message">{formErrors.characterName}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-outfit">
                  Outfit Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="edit-outfit"
                  value={formData.outfit}
                  onChange={(e) => setFormData({ ...formData, outfit: e.target.value })}
                  className={formErrors.outfit ? 'error' : ''}
                  placeholder="Enter outfit name"
                />
                {formErrors.outfit && (
                  <span className="error-message">{formErrors.outfit}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-livestreamArchive">
                  Livestream Archive <span className="required">*</span>
                </label>
                <input
                  type="url"
                  id="edit-livestreamArchive"
                  value={formData.livestreamArchive}
                  onChange={(e) => setFormData({ ...formData, livestreamArchive: e.target.value })}
                  className={formErrors.livestreamArchive ? 'error' : ''}
                  placeholder="https://..."
                />
                {formErrors.livestreamArchive && (
                  <span className="error-message">{formErrors.livestreamArchive}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="edit-channelLink">Channel Link</label>
                <input
                  type="url"
                  id="edit-channelLink"
                  value={formData.channelLink}
                  onChange={(e) => setFormData({ ...formData, channelLink: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-socialMediaLink">Social Media Link</label>
                <input
                  type="url"
                  id="edit-socialMediaLink"
                  value={formData.socialMediaLink}
                  onChange={(e) => setFormData({ ...formData, socialMediaLink: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="form-actions">
                <button type="button" onClick={handleCloseEditModal} className="cancel-button">
                  Cancel
                </button>
                <button type="submit" className="submit-button">
                  Update Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {showLogin && (
        <AdminLogin
          onClose={() => setShowLogin(false)}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
    </div>
  )
}

export default Request
