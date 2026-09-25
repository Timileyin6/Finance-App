import { useState } from 'react'
import ConfirmDelete from '../components/ConfirmDelete'
import ConnectBankButton from '../components/ConnectBankButton'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { api } from '../lib/api'
import { formatDate } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/Accounts.css'

function AccountsPage() {
  const { data, error, loading, reload } = useFetch('/bank/connections')
  const [syncing, setSyncing] = useState(null)
  const [message, setMessage] = useState(null)
  const [removing, setRemoving] = useState(null)

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

  const report = (synced) =>
    setMessage(synced ? `Imported ${synced.added} new transaction${synced.added === 1 ? '' : 's'}.` : 'Connected. Transactions will appear once your bank sends them.')

  const sync = async (connection) => {
    setSyncing(connection.id)
    setMessage(null)
    try {
      report((await api(`/bank/connections/${connection.id}/sync`, { method: 'POST' })).synced)
    } catch (err) {
      setMessage(err.message)
    }
    setSyncing(null)
    reload()
  }

  return (
    <>
      <PageHeader title="Accounts">
        {data.enabled && (
          <ConnectBankButton
            onLinked={({ synced }) => {
              report(synced)
              reload()
            }}
          />
        )}
      </PageHeader>

      {!data.enabled && (
        <div className="card notice">
          <i className="fa-solid fa-plug-circle-xmark" aria-hidden="true" />
          <div>
            <h2>Automatic bank sync isn’t set up yet</h2>
            <p className="muted">
              Add your Mono keys (<code>MONO_PUBLIC_KEY</code> and <code>MONO_SECRET_KEY</code>) to <code>server/.env</code> and
              restart the server. Until then you can still add transactions by hand on the Transactions page.
            </p>
          </div>
        </div>
      )}

      {data.enabled && data.testMode && (
        <p className="muted small sandbox-hint">
          Test mode: pick a bank in the Mono widget and use the test login details it shows to import sample transactions.
        </p>
      )}

      {message && <p className="card flash">{message}</p>}

      {data.enabled && (
        <section className="card">
          <h2>Connected Banks</h2>
          {data.connections.length === 0 ? (
            <EmptyState icon="fa-building-columns">
              No banks connected. Connect GTBank, Access, Zenith, UBA, First Bank, Kuda, Opay and more, and new
              transactions will be imported automatically.
            </EmptyState>
          ) : (
            <ul className="bank-list">
              {data.connections.map((c) => (
                <li key={c.id} className="bank-row">
                  <div className="bank-info">
                    <i className="fa-solid fa-building-columns" aria-hidden="true" />
                    <div>
                      <strong>{c.institutionName}</strong>
                      {(c.accountName || c.accountMask) && (
                        <p className="small">{[c.accountName, c.accountMask && `•••• ${c.accountMask}`].filter(Boolean).join(' · ')}</p>
                      )}
                      <p className="muted small">
                        {c.lastSyncedAt ? `Last synced ${formatDate(c.lastSyncedAt)}` : 'Waiting for first sync'}
                      </p>
                      {c.lastError && <p className="danger-text small">{c.lastError}</p>}
                    </div>
                  </div>
                  <div className="bank-actions">
                    <button type="button" className="btn soft" onClick={() => sync(c)} disabled={syncing === c.id}>
                      <i className={`fa-solid fa-rotate ${syncing === c.id ? 'fa-spin' : ''}`} aria-hidden="true" /> Sync now
                    </button>
                    <button type="button" className="btn ghost danger-text" onClick={() => setRemoving(c)}>Disconnect</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {removing && (
        <ConfirmDelete
          title={removing.institutionName}
          message="We’ll stop importing transactions from this account. Transactions already imported stay in your history."
          onConfirm={() => api(`/bank/connections/${removing.id}`, { method: 'DELETE' }).then(reload)}
          onClose={() => setRemoving(null)}
        />
      )}
    </>
  )
}

export default AccountsPage
