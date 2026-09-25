import { useEffect, useRef, useState } from 'react'

/** The "•••" menu on budget and pot cards. */
function CardMenu({ label, onEdit, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div className="card-menu" ref={ref}>
      <button type="button" className="icon-btn" aria-label={`Options for ${label}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <i className="fa-solid fa-ellipsis" aria-hidden="true" />
      </button>
      {open && (
        <div className="menu-pop">
          <button type="button" onClick={() => { setOpen(false); onEdit() }}>Edit {label}</button>
          <button type="button" className="danger-text" onClick={() => { setOpen(false); onDelete() }}>Delete {label}</button>
        </div>
      )}
    </div>
  )
}

export default CardMenu
