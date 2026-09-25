import { useState } from 'react'
import MonoConnect from '@mono.co/connect.js'
import { api } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { useMeta } from '../lib/MetaContext'

/**
 * Mono Connect flow: open Mono's widget → the user picks their bank and logs in →
 * the widget returns a one-time code → our server exchanges it for the account and imports transactions.
 */
function ConnectBankButton({ onLinked, className = 'btn primary', children = 'Connect a Bank' }) {
  const { bank } = useMeta()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const start = () => {
    setError(null)
    setBusy(true)
    let linking = false
    const widget = new MonoConnect({
      key: bank.publicKey,
      scope: 'auth',
      data: { customer: { name: user.name, email: user.email } },
      onSuccess: async ({ code }) => {
        linking = true
        try {
          onLinked(await api('/bank/connections', { method: 'POST', body: { code } }))
        } catch (err) {
          setError(err.message)
        }
        setBusy(false)
      },
      // Also fires after a successful link; only reset if we're not mid-exchange
      onClose: () => !linking && setBusy(false),
    })
    widget.setup()
    widget.open()
  }

  return (
    <>
      <button type="button" className={className} onClick={start} disabled={busy}>
        <i className="fa-solid fa-building-columns" aria-hidden="true" /> {busy ? 'Connecting…' : children}
      </button>
      {error && <p className="form-error">{error}</p>}
    </>
  )
}

export default ConnectBankButton
