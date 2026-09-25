import { useState } from 'react'
import Modal from './Modal'

function ConfirmDelete({ title, message, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={`Delete ‘${title}’?`} description={message} onClose={onClose}>
      {error && <p className="form-error">{error}</p>}
      <div className="stack">
        <button type="button" className="btn danger" onClick={confirm} disabled={busy}>
          {busy ? 'Deleting…' : 'Yes, Confirm Deletion'}
        </button>
        <button type="button" className="btn ghost" onClick={onClose}>No, Go Back</button>
      </div>
    </Modal>
  )
}

export default ConfirmDelete
