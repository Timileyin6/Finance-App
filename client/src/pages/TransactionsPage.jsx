import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import DonutChart from '../components/DonutChart'
import { CHART_COLORS } from '../lib/colors'
import LegendItem from '../components/LegendItem'
import PageHeader from '../components/PageHeader'
import TransactionForm from '../components/TransactionForm'
import TransactionRow from '../components/TransactionRow'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { useMeta } from '../lib/MetaContext'
import { formatMoney } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/Transactions.css'

const SORTS = [
  ['latest', 'Latest'],
  ['oldest', 'Oldest'],
  ['a-z', 'A to Z'],
  ['z-a', 'Z to A'],
  ['highest', 'Highest'],
  ['lowest', 'Lowest'],
]

function CategoryBreakdown({ title, totalCents, items }) {
  const data = items.map((c, i) => ({ name: c.category, value: c.amountCents, color: CHART_COLORS[i % CHART_COLORS.length] }))
  return (
    <div className="card breakdown">
      <h3>{title}</h3>
      <div className="breakdown-body">
        <DonutChart data={data} size={160} centerTop={formatMoney(totalCents)} centerBottom="this month" />
        <div className="legend-col">
          {items.length === 0 && <p className="muted small">Nothing this month yet</p>}
          {data.map((d) => (
            <LegendItem key={d.name} color={d.color} label={d.name} value={formatMoney(d.value)} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Pagination({ page, pageCount, onPage }) {
  if (pageCount <= 1) return null
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
  )
  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" className="btn ghost" disabled={page === 1} onClick={() => onPage(page - 1)}>
        <i className="fa-solid fa-caret-left" aria-hidden="true" /> <span className="hide-sm">Prev</span>
      </button>
      <div className="page-numbers">
        {pages.map((p, i) => (
          <span key={p} className="page-wrap">
            {i > 0 && p - pages[i - 1] > 1 && <span className="muted">…</span>}
            <button type="button" className={`page-btn ${p === page ? 'on' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
              {p}
            </button>
          </span>
        ))}
      </div>
      <button type="button" className="btn ghost" disabled={page === pageCount} onClick={() => onPage(page + 1)}>
        <span className="hide-sm">Next</span> <i className="fa-solid fa-caret-right" aria-hidden="true" />
      </button>
    </nav>
  )
}

function TransactionsPage() {
  const { categories } = useMeta()
  const [params, setParams] = useSearchParams()
  const search = params.get('search') ?? ''
  const category = params.get('category') ?? 'all'
  const sort = params.get('sort') ?? 'latest'
  const page = Number(params.get('page')) || 1
  const [searchInput, setSearchInput] = useState(search)
  const [editing, setEditing] = useState(null) // null | 'new' | transaction

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === '' || value === 'all' || value === 'latest' || value === 1) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  // Debounce typing so we don't query on every keystroke
  useEffect(() => {
    if (searchInput === search) return
    const id = setTimeout(() => update({ search: searchInput.trim(), page: 1 }), 300)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const query = new URLSearchParams({ search, category, sort, page: String(page), pageSize: '10' })
  const list = useFetch(`/transactions?${query}`)
  const stats = useFetch('/transactions/stats')

  const refresh = () => {
    setEditing(null)
    list.reload()
    stats.reload()
  }

  return (
    <>
      <PageHeader title="Transactions">
        <button type="button" className="btn primary" onClick={() => setEditing('new')}>
          <i className="fa-solid fa-plus" aria-hidden="true" /> Add Transaction
        </button>
      </PageHeader>

      <section className="metrics two">
        <div className="card metric">
          <p className="muted">Total Received <span className="small">(this month)</span></p>
          <h2>{stats.data ? formatMoney(stats.data.receivedCents) : '—'}</h2>
        </div>
        <div className="card metric">
          <p className="muted">Total Spent <span className="small">(this month)</span></p>
          <h2>{stats.data ? formatMoney(stats.data.spentCents) : '—'}</h2>
        </div>
      </section>

      <section className="tx-grid">
        <div className="card">
          <div className="toolbar">
            <label className="search">
              <span className="sr-only">Search transactions</span>
              <input type="search" placeholder="Search transaction" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            </label>
            <label className="select-inline">
              <span className="muted">Sort by</span>
              <select value={sort} onChange={(e) => update({ sort: e.target.value, page: 1 })}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="select-inline">
              <span className="muted">Category</span>
              <select value={category} onChange={(e) => update({ category: e.target.value, page: 1 })}>
                <option value="all">All Transactions</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <ErrorMessage error={list.error} onRetry={list.reload} />
          {list.loading && !list.data && <Loading />}
          {list.data && (
            <div className={list.loading ? 'is-refreshing' : ''}>
              {list.data.items.length === 0 ? (
                <EmptyState icon="fa-magnifying-glass">
                  {search || category !== 'all' ? 'No transactions match your filters.' : 'No transactions yet. Add one, or connect your bank on the Accounts page.'}
                </EmptyState>
              ) : (
                list.data.items.map((t) => <TransactionRow key={t.id} transaction={t} showCategory onClick={() => setEditing(t)} />)
              )}
              <Pagination page={page} pageCount={list.data.pageCount} onPage={(p) => update({ page: p })} />
            </div>
          )}
        </div>

        <div className="col">
          {stats.data && (
            <>
              <CategoryBreakdown title="Money In" totalCents={stats.data.receivedCents} items={stats.data.receivedByCategory} />
              <CategoryBreakdown title="Money Out" totalCents={stats.data.spentCents} items={stats.data.spentByCategory} />
            </>
          )}
        </div>
      </section>

      {editing && (
        <TransactionForm transaction={editing === 'new' ? null : editing} onSaved={refresh} onClose={() => setEditing(null)} />
      )}
    </>
  )
}

export default TransactionsPage
