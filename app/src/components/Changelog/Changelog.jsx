import React from 'react'
import changelogData from '../../data/changelog.json'
import './Changelog.css'

function Changelog() {
  const getTypeLabel = (type) => {
    switch (type) {
      case 'feat': return { text: '✨ Feature', className: 'type-feat' }
      case 'fix': return { text: '🔧 Fix', className: 'type-fix' }
      case 'refactor': return { text: '♻️ Refactor', className: 'type-refactor' }
      case 'style': return { text: '💅 Style', className: 'type-style' }
      case 'docs': return { text: '📝 Docs', className: 'type-docs' }
      default: return { text: '📦 Update', className: 'type-other' }
    }
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr)
    const options = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }
    return date.toLocaleDateString('en-US', options)
  }

  return (
    <div className="changelog-container">
      <div className="changelog-header">
        <h2>📋 Changelog</h2>
        <p>Version history and feature updates</p>
      </div>

      <div className="changelog-timeline">
        {changelogData.map((dayLog, index) => (
          <div key={dayLog.date} className="changelog-day">
            <div className="changelog-date-header">
              <div className="changelog-date-dot" />
              <span className="changelog-date">{formatDate(dayLog.date)}</span>
              <span className="changelog-count">{dayLog.changes.length} {dayLog.changes.length === 1 ? 'change' : 'changes'}</span>
            </div>
            
            <div className="changelog-entries">
              {dayLog.changes.map((change, changeIndex) => {
                const typeInfo = getTypeLabel(change.type)
                return (
                  <div key={change.hash} className="changelog-entry">
                    <div className="changelog-entry-header">
                      <span className={`changelog-type ${typeInfo.className}`}>
                        {typeInfo.text}
                      </span>
                      <span className="changelog-hash">{change.hash}</span>
                    </div>
                    <p className="changelog-message">{change.message}</p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default Changelog
