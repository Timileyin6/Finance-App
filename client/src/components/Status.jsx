export function Loading({ fullScreen = false }) {
  return (
    <div className={`loading ${fullScreen ? 'full-screen' : ''}`} role="status">
      <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" /> Loading…
    </div>
  )
}

export function ErrorMessage({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="error-box" role="alert">
      <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" /> {error.message ?? String(error)}
      {onRetry && (
        <button type="button" className="link-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon = 'fa-inbox', children }) {
  return (
    <div className="empty">
      <i className={`fa-solid ${icon}`} aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
