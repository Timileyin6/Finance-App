import { useState } from 'react'
import CardMenu from '../components/CardMenu'
import ConfirmDelete from '../components/ConfirmDelete'
import PageHeader from '../components/PageHeader'
import ProgressBar from '../components/ProgressBar'
import { MoveMoneyForm, PotForm } from '../components/PotForm'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { api } from '../lib/api'
import { formatMoney, percent } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/Pots.css'

function PotsPage() {
  const { data: pots, error, loading, reload } = useFetch('/pots')
  const [modal, setModal] = useState(null) // { type: 'new'|'edit'|'delete'|'deposit'|'withdraw', pot }

  if (loading && !pots) return <Loading />
  if (error && !pots) return <ErrorMessage error={error} onRetry={reload} />

  const close = () => setModal(null)
  const saved = () => {
    close()
    reload()
  }

  return (
    <>
      <PageHeader title="Pots">
        <button type="button" className="btn primary" onClick={() => setModal({ type: 'new' })}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add New Pot
        </button>
      </PageHeader>

      {pots.length === 0 ? (
        <div className="card">
          <EmptyState icon="fa-piggy-bank">No pots yet. Pots let you set money aside for a goal, like a holiday or a new laptop.</EmptyState>
        </div>
      ) : (
        <section className="pots-grid">
          {pots.map((pot) => {
            const pct = percent(pot.totalCents, pot.targetCents)
            return (
              <article key={pot.id} className="card pot-card">
                <div className="between">
                  <h2 className="dot-title"><span className="dot" style={{ background: pot.theme }} />{pot.name}</h2>
                  <CardMenu label="Pot" onEdit={() => setModal({ type: 'edit', pot })} onDelete={() => setModal({ type: 'delete', pot })} />
                </div>
                <div className="between">
                  <span className="muted">Total Saved</span>
                  <strong className="big-number">{formatMoney(pot.totalCents)}</strong>
                </div>
                <ProgressBar value={pct} color={pot.theme} label={`${pot.name} progress`} thick />
                <div className="between small">
                  <strong className="muted">{pct.toFixed(1)}%</strong>
                  <span className="muted">Target of {formatMoney(pot.targetCents)}</span>
                </div>
                <div className="two-col">
                  <button type="button" className="btn soft" onClick={() => setModal({ type: 'deposit', pot })}>+ Add Money</button>
                  <button type="button" className="btn soft" onClick={() => setModal({ type: 'withdraw', pot })} disabled={pot.totalCents === 0}>Withdraw</button>
                </div>
              </article>
            )
          })}
        </section>
      )}

      {(modal?.type === 'new' || modal?.type === 'edit') && <PotForm pot={modal.pot} onSaved={saved} onClose={close} />}
      {(modal?.type === 'deposit' || modal?.type === 'withdraw') && (
        <MoveMoneyForm pot={modal.pot} mode={modal.type} onSaved={saved} onClose={close} />
      )}
      {modal?.type === 'delete' && (
        <ConfirmDelete
          title={modal.pot.name}
          message={`Are you sure you want to delete this pot? The ${formatMoney(modal.pot.totalCents)} inside will be returned to your balance.`}
          onConfirm={() => api(`/pots/${modal.pot.id}`, { method: 'DELETE' }).then(reload)}
          onClose={close}
        />
      )}
    </>
  )
}

export default PotsPage
