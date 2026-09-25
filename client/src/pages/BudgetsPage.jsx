import { useState } from 'react'
import { Link } from 'react-router-dom'
import BudgetForm from '../components/BudgetForm'
import CardMenu from '../components/CardMenu'
import ConfirmDelete from '../components/ConfirmDelete'
import DonutChart from '../components/DonutChart'
import PageHeader from '../components/PageHeader'
import ProgressBar from '../components/ProgressBar'
import TransactionRow from '../components/TransactionRow'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { api } from '../lib/api'
import { formatMoney, percent } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/Budgets.css'

function BudgetCard({ budget, onEdit, onDelete }) {
  const remaining = budget.maximumCents - budget.spentCents
  const over = remaining < 0
  return (
    <article className="card budget-card">
      <div className="between">
        <h2 className="dot-title"><span className="dot" style={{ background: budget.theme }} />{budget.category}</h2>
        <CardMenu label="Budget" onEdit={onEdit} onDelete={onDelete} />
      </div>
      <p className="muted">Maximum of {formatMoney(budget.maximumCents)} per month</p>
      <ProgressBar value={percent(budget.spentCents, budget.maximumCents)} color={over ? '#C94736' : budget.theme} label={`${budget.category} spent`} thick />
      <div className="two-col">
        <div className="legend-item" style={{ '--bar': budget.theme }}>
          <p className="muted small">Spent</p>
          <p className="strong">{formatMoney(budget.spentCents)}</p>
        </div>
        <div className="legend-item" style={{ '--bar': over ? '#C94736' : '#F8F4F0' }}>
          <p className="muted small">{over ? 'Over budget' : 'Remaining'}</p>
          <p className={`strong ${over ? 'danger-text' : ''}`}>{formatMoney(Math.abs(remaining))}</p>
        </div>
      </div>
      <div className="latest-spending">
        <div className="between">
          <h3>Latest Spending</h3>
          <Link to={`/transactions?category=${encodeURIComponent(budget.category)}`} className="see-more">
            See All <i className="fa-solid fa-caret-right" aria-hidden="true" />
          </Link>
        </div>
        {budget.latestSpending.length === 0 ? (
          <p className="muted small">No spending in this category yet.</p>
        ) : (
          budget.latestSpending.map((t) => <TransactionRow key={t.id} transaction={t} />)
        )}
      </div>
    </article>
  )
}

function BudgetsPage() {
  const { data: budgets, error, loading, reload } = useFetch('/budgets')
  const [editing, setEditing] = useState(null) // null | 'new' | budget
  const [deleting, setDeleting] = useState(null)

  if (loading && !budgets) return <Loading />
  if (error && !budgets) return <ErrorMessage error={error} onRetry={reload} />

  const spent = budgets.reduce((s, b) => s + b.spentCents, 0)
  const limit = budgets.reduce((s, b) => s + b.maximumCents, 0)
  const saved = () => {
    setEditing(null)
    reload()
  }

  return (
    <>
      <PageHeader title="Budgets">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add New Budget
        </button>
      </PageHeader>

      {budgets.length === 0 ? (
        <div className="card">
          <EmptyState icon="fa-chart-pie">You haven’t set any budgets. Add one to track monthly spending in a category.</EmptyState>
        </div>
      ) : (
        <section className="budgets-grid">
          <div className="card summary-card">
            <DonutChart
              data={budgets.map((b) => ({ name: b.category, value: b.maximumCents, color: b.theme }))}
              centerTop={formatMoney(spent)}
              centerBottom={`of ${formatMoney(limit)} limit`}
              size={240}
            />
            <div className="spending-summary">
              <h2>Spending Summary</h2>
              {budgets.map((b) => (
                <div key={b.id} className="summary-row" style={{ '--bar': b.theme }}>
                  <span className="muted">{b.category}</span>
                  <span>
                    <strong>{formatMoney(b.spentCents)}</strong> <span className="muted small">of {formatMoney(b.maximumCents)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="col">
            {budgets.map((b) => (
              <BudgetCard key={b.id} budget={b} onEdit={() => setEditing(b)} onDelete={() => setDeleting(b)} />
            ))}
          </div>
        </section>
      )}

      {editing && (
        <BudgetForm
          budget={editing === 'new' ? null : editing}
          usedCategories={budgets.map((b) => b.category)}
          onSaved={saved}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <ConfirmDelete
          title={deleting.category}
          message="Are you sure you want to delete this budget? This action cannot be reversed. Your transactions are not affected."
          onConfirm={() => api(`/budgets/${deleting.id}`, { method: 'DELETE' }).then(reload)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}

export default BudgetsPage
