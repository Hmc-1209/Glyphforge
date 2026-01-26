import React, { useState, useEffect } from 'react'
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

  // Form states
  const [formData, setFormData] = useState({
    characterName: '',
    outfit: '',
    channelLink: '',
    socialMediaLink: ''
  })
  const [formErrors, setFormErrors] = useState({})

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

      {loading ? (
        <div className="request-loading">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="request-empty">
          <p>No requests yet. Be the first to submit one!</p>
        </div>
      ) : (
        <div className="request-list">
          {requests.map((request, index) => (
            <div key={request.id} className="request-card">
              <div className="request-card-header">
                <span className="request-type-badge">{request.type.toUpperCase()}</span>
                <span
                  className="request-status-badge"
                  style={{ backgroundColor: getStatusColor(request.status) }}
                >
                  {getStatusText(request.status)}
                </span>
              </div>

              <div className="request-card-content">
                <h3>{request.characterName}</h3>
                <div className="request-field">
                  <strong>Outfit:</strong> {request.outfit}
                </div>
                {request.channelLink && (
                  <div className="request-field">
                    <strong>Channel:</strong>{' '}
                    <a href={request.channelLink} target="_blank" rel="noopener noreferrer">
                      Link
                    </a>
                  </div>
                )}
                {request.socialMediaLink && (
                  <div className="request-field">
                    <strong>Social:</strong>{' '}
                    <a href={request.socialMediaLink} target="_blank" rel="noopener noreferrer">
                      Link
                    </a>
                  </div>
                )}
              </div>

              <div className="request-card-footer">
                <span className="request-date">
                  {new Date(request.createdAt).toLocaleDateString()}
                </span>
                {adminMode && (
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
                    <div className="order-buttons">
                      <button
                        className="admin-button move-button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        className="admin-button move-button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === requests.length - 1}
                        title="Move down"
                      >
                        ▼
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
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
