import { useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ConfirmDelete from '../components/ConfirmDelete'
import PageHeader from '../components/PageHeader'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { api } from '../lib/api'
import { formatDate, formatMoney, percent } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/MonthlyReport.css'

const ACCEPT = '.pdf,.csv,.xls,.xlsx'

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}
const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number)
  return monthKey(new Date(y, m - 1 + delta, 1))
}

function MonthPicker({ month, onChange }) {
  const current = monthKey(new Date())
  return (
    <div className="month-picker" role="group" aria-label="Report month">
      <button type="button" className="icon-btn" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <i className="fa-solid fa-chevron-left" aria-hidden="true" />
      </button>
      <strong>{monthLabel(month)}</strong>
      <button type="button" className="icon-btn" onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= current} aria-label="Next month">
        <i className="fa-solid fa-chevron-right" aria-hidden="true" />
      </button>
    </div>
  )
}

// ── Upload ──────────────────────────────────────────────

function describeResult(r, month) {
  if (!r.ok) return r.error
  const parts = [`${r.imported} transaction${r.imported === 1 ? '' : 's'} imported`]
  if (r.duplicates) parts.push(`${r.duplicates} already imported`)
  if (r.outsideMonth) parts.push(`${r.outsideMonth} outside ${monthLabel(month)} ignored`)
  if (r.skipped) parts.push(`${r.skipped} unreadable row${r.skipped === 1 ? '' : 's'} skipped`)
  return `${r.bankName}: ${parts.join(', ')}.`
}

function StatementUpload({ month, statements, onUploaded }) {
  const inputRef = useRef(null)
  const [files, setFiles] = useState([])
  const [bankName, setBankName] = useState('')
  const [password, setPassword] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [removing, setRemoving] = useState(null)

  const addFiles = (list) => {
    const incoming = [...list].filter((f) => /\.(pdf|csv|xlsx?)$/i.test(f.name))
    setFiles((current) => [...current, ...incoming.filter((f) => !current.some((c) => c.name === f.name && c.size === f.size))])
    setResults(null)
  }
  const hasPdf = files.some((f) => /\.pdf$/i.test(f.name))

  const upload = async (e) => {
    e.preventDefault()
    if (!files.length) return
    const form = new FormData()
    form.append('month', month)
    if (bankName.trim()) form.append('bankName', bankName.trim())
    if (password) form.append('password', password)
    files.forEach((f) => form.append('files', f))
    setBusy(true)
    let response
    try {
      response = await api('/statements', { method: 'POST', body: form })
    } catch (err) {
      response = err.details?.results ? err.details : { results: [{ ok: false, fileName: '', error: err.message }] }
    }
    setBusy(false)
    setResults(response.results)
    setNeedsPassword(response.results.some((r) => r.needsPassword))
    // Keep only the files that failed, so they can be retried (e.g. with a password)
    setFiles((current) => current.filter((f) => response.results.some((r) => !r.ok && r.fileName === f.name)))
    if (response.results.some((r) => r.ok)) onUploaded()
  }

  return (
    <section className="card upload-card">
      <div className="between wrap">
        <div>
          <h2>Bank statements for {monthLabel(month)}</h2>
          <p className="muted small">
            Upload one statement per bank (PDF, CSV or Excel). Only transactions dated in {monthLabel(month)} are imported,
            and uploading the same statement twice won’t double-count.
          </p>
        </div>
      </div>

      <form className="stack" onSubmit={upload}>
        <label
          className={`drop-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(e.dataTransfer.files)
          }}
        >
          <input ref={inputRef} type="file" accept={ACCEPT} multiple className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          <i className="fa-solid fa-cloud-arrow-up" aria-hidden="true" />
          <span><strong>Choose files</strong> or drag them here</span>
          <span className="muted small">GTBank, Access, Zenith, UBA, First Bank, Kuda, Opay, Moniepoint… · up to 10 files, 10 MB each</span>
        </label>

        {files.length > 0 && (
          <ul className="file-list">
            {files.map((f) => (
              <li key={`${f.name}-${f.size}`}>
                <i className={`fa-solid ${/\.pdf$/i.test(f.name) ? 'fa-file-pdf' : 'fa-file-excel'}`} aria-hidden="true" />
                <span className="file-name">{f.name}</span>
                <button type="button" className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => setFiles((c) => c.filter((x) => x !== f))}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <div className="two-col">
            <label className="field">
              <span className="field-label">Bank (optional)</span>
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} maxLength={60} placeholder="Detected automatically" />
            </label>
            {(hasPdf || needsPassword) && (
              <label className="field">
                <span className="field-label">PDF password (if it has one)</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  className={needsPassword ? 'attention' : ''}
                  placeholder="Often your account number or date of birth"
                />
              </label>
            )}
          </div>
        )}

        {results && (
          <ul className="upload-results" aria-live="polite">
            {results.map((r, i) => (
              <li key={`${r.fileName}-${i}`} className={r.ok ? 'ok' : 'failed'}>
                <i className={`fa-solid ${r.ok ? 'fa-circle-check' : 'fa-circle-exclamation'}`} aria-hidden="true" />
                <span>{describeResult(r, month)}</span>
              </li>
            ))}
          </ul>
        )}

        {files.length > 0 && (
          <button className="btn primary" disabled={busy}>
            {busy ? 'Reading statements…' : `Upload ${files.length} statement${files.length === 1 ? '' : 's'}`}
          </button>
        )}
      </form>

      {statements.length > 0 && (
        <div className="uploaded">
          <h3 className="muted small">Uploaded for this month</h3>
          <ul>
            {statements.map((s) => (
              <li key={s.id}>
                <i className="fa-solid fa-file-lines" aria-hidden="true" />
                <div>
                  <strong>{s.bankName}</strong>
                  <p className="muted small">{s.fileName} · {s.rowsImported} transactions</p>
                </div>
                <button type="button" className="btn ghost danger-text" onClick={() => setRemoving(s)}>Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {removing && (
        <ConfirmDelete
          title={removing.fileName}
          message={`This removes the ${removing.rowsImported} transactions imported from this ${removing.bankName} statement.`}
          onConfirm={() => api(`/statements/${removing.id}`, { method: 'DELETE' }).then(onUploaded)}
          onClose={() => setRemoving(null)}
        />
      )}
    </section>
  )
}

// ── Report sections ─────────────────────────────────────

const MATCHES_SHOWN = 3

function MatchReview({ matches, onResolved }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  if (!matches.length) return null
  const visible = showAll ? matches : matches.slice(0, MATCHES_SHOWN)

  const resolve = async (match, action) => {
    setBusy(match.manual.id)
    setError(null)
    try {
      await api(`/reports/matches/${action}`, { method: 'POST', body: { manualId: match.manual.id, importedId: match.imported.id } })
      onResolved()
    } catch (err) {
      setError(err.message)
    }
    setBusy(null)
  }

  return (
    <section className="card review-card">
      <h2><i className="fa-solid fa-code-compare" aria-hidden="true" /> Needs your review <span className="count">{matches.length}</span></h2>
      <p className="muted small">
        If they’re the same payment we’ll keep the bank’s record with your name and category. Until you review them,
        both are counted in the totals below.
      </p>
      {error && <p className="form-error">{error}</p>}
      <ul className="matches">
        {visible.map((m) => {
          const kind = m.imported.amountCents < 0 ? 'charge' : 'credit'
          return (
            <li key={`${m.manual.id}-${m.imported.id}`}>
              <p className="match-question">
                We found a bank {kind} matching your manual <strong>{formatMoney(Math.abs(m.manual.amountCents))}</strong> ‘{m.manual.name}’ log. Are these the same?
              </p>
              <div className="match-pair">
                <div>
                  <span className="muted small">Your entry</span>
                  <strong>{m.manual.name}</strong>
                  <span className="small">{formatDate(m.manual.date)} · {m.manual.category}</span>
                </div>
                <i className="fa-solid fa-arrows-left-right muted" aria-hidden="true" />
                <div>
                  <span className="muted small">{m.imported.statement?.bankName ?? m.imported.connection?.institutionName ?? 'Bank'} statement</span>
                  <strong>{m.imported.name}</strong>
                  <span className="small">{formatDate(m.imported.date)} · {m.imported.category}</span>
                </div>
              </div>
              <div className="match-actions">
                <button type="button" className="btn primary" disabled={busy === m.manual.id} onClick={() => resolve(m, 'merge')}>Yes, same payment</button>
                <button type="button" className="btn soft" disabled={busy === m.manual.id} onClick={() => resolve(m, 'dismiss')}>No, keep both</button>
              </div>
            </li>
          )
        })}
      </ul>
      {matches.length > MATCHES_SHOWN && (
        <button type="button" className="btn ghost show-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${matches.length}`}
        </button>
      )}
    </section>
  )
}

function CashFlow({ flow, month }) {
  const max = Math.max(flow.inflowCents, flow.outflowCents, 1)
  const good = !flow.overspent
  const headline =
    flow.percent === null
      ? flow.outflowCents > 0 ? `You spent ${formatMoney(flow.outflowCents)} with no money coming in` : 'No money in or out yet'
      : good
        ? `You kept ${flow.percent}% of what you earned`
        : `You spent ${flow.percent}% more than you earned`

  return (
    <section className="card cashflow">
      <div className={`delta ${good ? 'good' : 'bad'}`}>
        <i className={`fa-solid ${good ? 'fa-arrow-trend-up' : 'fa-triangle-exclamation'}`} aria-hidden="true" />
        <div>
          <p className="delta-label">{good ? 'Healthy month' : 'Overspent'} · {monthLabel(month)}</p>
          <h2>{headline}</h2>
          <p className="muted">
            {good ? 'Saved' : 'Shortfall'}: <strong>{formatMoney(Math.abs(flow.netCents))}</strong>
          </p>
        </div>
      </div>
      <div className="flow-bars">
        {[
          ['Money in', flow.inflowCents, 'var(--flow-in)'],
          ['Money out', flow.outflowCents, 'var(--flow-out)'],
        ].map(([label, value, color]) => (
          <div key={label} className="flow-row" title={`${label}: ${formatMoney(value)}`}>
            <div className="between">
              <span className="muted">{label}</span>
              <strong>{formatMoney(value)}</strong>
            </div>
            <div className="bar-track"><span style={{ width: `${(value / max) * 100}%`, background: color }} /></div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Subscriptions({ data }) {
  const reasons = { known: 'Subscription service', marked: 'You marked it recurring', repeats: 'Same amount as last month' }
  return (
    <section className="card">
      <h2>Subscriptions &amp; fixed costs</h2>
      {data.items.length === 0 ? (
        <EmptyState icon="fa-repeat">No recurring charges spotted this month.</EmptyState>
      ) : (
        <>
          <div className="annual-drag">
            <span className="muted">Costing you every year</span>
            <strong>{formatMoney(data.totalAnnualCents)}</strong>
            <span className="muted small">{formatMoney(data.totalMonthlyCents)} a month × 12</span>
          </div>
          <table className="report-table">
            <thead>
              <tr><th>Charge</th><th className="right">Monthly</th><th className="right">Yearly</th></tr>
            </thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.merchant}>
                  <td><strong>{s.merchant}</strong><span className="muted small block">{reasons[s.reason]}</span></td>
                  <td className="right">{formatMoney(s.monthlyCents)}</td>
                  <td className="right strong">{formatMoney(s.annualCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

function Triggers({ triggers }) {
  const top = triggers[0]
  const maxCount = top?.count ?? 1
  return (
    <section className="card">
      <h2>Where your money leaks</h2>
      {!top ? (
        <EmptyState icon="fa-magnifying-glass-dollar">No repeat spending spotted this month.</EmptyState>
      ) : (
        <>
          <p className="trigger-headline">
            You paid <strong>{top.merchant}</strong> {top.count} times this month, <strong>{formatMoney(top.totalCents)}</strong> in total.
          </p>
          <ul className="triggers">
            {triggers.map((t) => (
              <li key={t.merchant} title={`${t.merchant}: ${t.count} payments, average ${formatMoney(t.averageCents)}`}>
                <div className="between">
                  <span><strong>{t.merchant}</strong> <span className="muted small">{t.category}</span></span>
                  <span className="small"><strong>{t.count}×</strong> · {formatMoney(t.totalCents)}</span>
                </div>
                <div className="bar-track thin"><span style={{ width: `${(t.count / maxCount) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

function BudgetVsActual({ budgets }) {
  return (
    <section className="card">
      <div className="between">
        <h2>Budget vs actual</h2>
        <Link to="/budgets" className="see-more">Edit budgets <i className="fa-solid fa-caret-right" aria-hidden="true" /></Link>
      </div>
      {budgets.length === 0 ? (
        <EmptyState icon="fa-chart-pie">You don’t have any budgets set. <Link to="/budgets">Add one</Link> to compare it with this month’s spending.</EmptyState>
      ) : (
        <ul className="budget-actual">
          {budgets.map((b) => {
            const over = b.spentCents > b.maximumCents
            return (
              <li key={b.id}>
                <div className="between">
                  <span className="dot-title small"><span className="dot" style={{ background: b.theme }} /><strong>{b.category}</strong></span>
                  <span className="small">
                    <strong>{formatMoney(b.spentCents)}</strong> <span className="muted">of {formatMoney(b.maximumCents)}</span>
                  </span>
                </div>
                <div className="bar-track" title={`${b.category}: ${formatMoney(b.spentCents)} of ${formatMoney(b.maximumCents)}`}>
                  <span style={{ width: `${percent(b.spentCents, b.maximumCents)}%`, background: b.theme }} />
                </div>
                <p className={`small ${over ? 'danger-text' : 'muted'}`}>
                  {over ? (
                    <><i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> Over by {formatMoney(b.spentCents - b.maximumCents)}</>
                  ) : (
                    `${formatMoney(b.maximumCents - b.spentCents)} left`
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MonthlyReportPage() {
  const [params, setParams] = useSearchParams()
  const month = /^\d{4}-\d{2}$/.test(params.get('month') ?? '') ? params.get('month') : monthKey(new Date())
  const { data, error, loading, reload } = useFetch(`/reports/monthly?month=${month}`)

  return (
    <>
      <PageHeader title="Monthly Report">
        <MonthPicker month={month} onChange={(m) => setParams({ month: m }, { replace: true })} />
      </PageHeader>

      <ErrorMessage error={error} onRetry={reload} />
      {loading && !data && <Loading />}
      {data && (
        <div className={`report ${loading ? 'is-refreshing' : ''}`}>
          <StatementUpload month={data.month} statements={data.statements} onUploaded={reload} />

          {data.transactionCount === 0 ? (
            <div className="card">
              <EmptyState icon="fa-file-invoice">
                Nothing for {monthLabel(data.month)} yet. Upload your bank statements above to see your report.
              </EmptyState>
            </div>
          ) : (
            <>
              <MatchReview matches={data.matches} onResolved={reload} />
              <CashFlow flow={data.cashFlow} month={data.month} />
              <div className="report-grid">
                <Subscriptions data={data.subscriptions} />
                <Triggers triggers={data.triggers} />
              </div>
              <BudgetVsActual budgets={data.budgets} />
              <p className="muted small report-notes">
                {data.internalTransfers.count > 0 && (
                  <>
                    <i className="fa-solid fa-right-left" aria-hidden="true" /> {formatMoney(data.internalTransfers.totalCents)} moved between your own accounts
                    ({data.internalTransfers.count} transfer{data.internalTransfers.count === 1 ? '' : 's'}) isn’t counted as income or spending.{' '}
                  </>
                )}
                {data.cash.count > 0 && (
                  <>
                    <i className="fa-solid fa-money-bill-wave" aria-hidden="true" /> Includes {formatMoney(data.cash.totalCents)} you logged as cash ({data.cash.count} payment{data.cash.count === 1 ? '' : 's'}).
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}

export default MonthlyReportPage
