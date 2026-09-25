import { useMemo, useState } from 'react'
import Avatar from '../components/Avatar'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { formatMoney, ordinal } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/Recurring.css'

const STATUS = {
  paid: { icon: 'fa-circle-check', className: 'paid', label: 'Paid' },
  dueSoon: { icon: 'fa-circle-exclamation', className: 'due-soon', label: 'Due soon' },
  overdue: { icon: 'fa-circle-exclamation', className: 'overdue', label: 'Overdue' },
  upcoming: { icon: null, className: '', label: 'Upcoming' },
}

const SORTERS = {
  latest: (a, b) => a.dueDay - b.dueDay,
  oldest: (a, b) => b.dueDay - a.dueDay,
  'a-z': (a, b) => a.name.localeCompare(b.name),
  'z-a': (a, b) => b.name.localeCompare(a.name),
  highest: (a, b) => b.amountCents - a.amountCents,
  lowest: (a, b) => a.amountCents - b.amountCents,
}

function RecurringBillsPage() {
  const { data, error, loading, reload } = useFetch('/recurring')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('latest')

  const bills = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.bills.filter((b) => b.name.toLowerCase().includes(q)).sort(SORTERS[sort])
  }, [data, search, sort])

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

  const { summary } = data

  return (
    <>
      <PageHeader title="Recurring Bills" />
      <section className="recurring-grid">
        <div className="col">
          <div className="card metric dark total-bills">
            <i className="fa-solid fa-file-invoice-dollar" aria-hidden="true" />
            <div>
              <p>Total Bills <span className="small">(monthly)</span></p>
              <h2>{formatMoney(summary.totalCents)}</h2>
            </div>
          </div>
          <div className="card">
            <h3>Summary</h3>
            <dl className="summary-list">
              <div><dt className="muted">Paid Bills</dt><dd>{summary.paid.count} ({formatMoney(summary.paid.totalCents)})</dd></div>
              <div><dt className="muted">Total Upcoming</dt><dd>{summary.upcoming.count} ({formatMoney(summary.upcoming.totalCents)})</dd></div>
              <div className="danger-text"><dt>Due Soon</dt><dd>{summary.dueSoon.count} ({formatMoney(summary.dueSoon.totalCents)})</dd></div>
              {summary.overdue.count > 0 && (
                <div className="danger-text"><dt>Overdue</dt><dd>{summary.overdue.count} ({formatMoney(summary.overdue.totalCents)})</dd></div>
              )}
            </dl>
          </div>
        </div>

        <div className="card">
          <div className="toolbar">
            <label className="search">
              <span className="sr-only">Search bills</span>
              <input type="search" placeholder="Search bills" value={search} onChange={(e) => setSearch(e.target.value)} />
              <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
            </label>
            <label className="select-inline">
              <span className="muted">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="latest">Due date</option>
                <option value="oldest">Due date (latest first)</option>
                <option value="a-z">A to Z</option>
                <option value="z-a">Z to A</option>
                <option value="highest">Highest</option>
                <option value="lowest">Lowest</option>
              </select>
            </label>
          </div>

          {data.bills.length === 0 ? (
            <EmptyState icon="fa-money-bill-transfer">
              No recurring bills yet. Mark a transaction as “Recurring monthly bill” and it will show up here.
            </EmptyState>
          ) : (
            <table className="bills-table">
              <thead>
                <tr><th>Bill Title</th><th>Due Date</th><th className="right">Amount</th></tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const status = STATUS[b.status]
                  return (
                    <tr key={b.id}>
                      <td>
                        <div className="bill-name"><Avatar name={b.name} /> <strong>{b.name}</strong></div>
                      </td>
                      <td className={`due ${status.className}`}>
                        Monthly – {ordinal(b.dueDay)}{' '}
                        {status.icon && <i className={`fa-solid ${status.icon}`} title={status.label} aria-label={status.label} />}
                      </td>
                      <td className={`right strong ${b.status === 'dueSoon' || b.status === 'overdue' ? 'danger-text' : ''}`}>
                        {formatMoney(b.amountCents)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  )
}

export default RecurringBillsPage
