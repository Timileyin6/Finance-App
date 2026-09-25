import { Link } from 'react-router-dom'
import DonutChart from '../components/DonutChart'
import LegendItem from '../components/LegendItem'
import PageHeader from '../components/PageHeader'
import TransactionRow from '../components/TransactionRow'
import { EmptyState, ErrorMessage, Loading } from '../components/Status'
import { formatMoney } from '../lib/format'
import { useFetch } from '../lib/useFetch'
import '../css/Overview.css'

function SectionHead({ title, to, linkText = 'See Details' }) {
  return (
    <div className="section-head">
      <h2>{title}</h2>
      <Link to={to} className="see-more">
        {linkText} <i className="fa-solid fa-caret-right" aria-hidden="true" />
      </Link>
    </div>
  )
}

function OverviewPage() {
  const { data, error, loading, reload } = useFetch('/overview')

  if (loading && !data) return <Loading />
  if (error && !data) return <ErrorMessage error={error} onRetry={reload} />

  const { pots, budgets, recurring, latestTransactions } = data
  const budgetSpent = budgets.reduce((s, b) => s + b.spentCents, 0)
  const budgetLimit = budgets.reduce((s, b) => s + b.maximumCents, 0)

  return (
    <>
      <PageHeader title="Overview" />

      <section className="metrics">
        <div className="card metric dark">
          <p>Current Balance</p>
          <h2>{formatMoney(data.balanceCents)}</h2>
        </div>
        <div className="card metric">
          <p className="muted">Income <span className="small">(this month)</span></p>
          <h2>{formatMoney(data.incomeCents)}</h2>
        </div>
        <div className="card metric">
          <p className="muted">Expenses <span className="small">(this month)</span></p>
          <h2>{formatMoney(data.expensesCents)}</h2>
        </div>
      </section>

      <section className="overview-grid">
        <div className="col">
          <div className="card">
            <SectionHead title="Pots" to="/pots" />
            {pots.items.length === 0 ? (
              <EmptyState icon="fa-piggy-bank">No pots yet. Create one to start saving towards a goal.</EmptyState>
            ) : (
              <div className="pots-body">
                <div className="total-saved">
                  <i className="fa-solid fa-money-check-dollar" aria-hidden="true" />
                  <div>
                    <p className="muted">Total Saved</p>
                    <h2>{formatMoney(pots.totalSavedCents)}</h2>
                  </div>
                </div>
                <div className="legend-grid">
                  {pots.items.map((p) => (
                    <LegendItem key={p.id} color={p.theme} label={p.name} value={formatMoney(p.totalCents)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <SectionHead title="Transactions" to="/transactions" linkText="View All" />
            {latestTransactions.length === 0 ? (
              <EmptyState icon="fa-receipt">No transactions yet. Add one or connect your bank.</EmptyState>
            ) : (
              latestTransactions.map((t) => <TransactionRow key={t.id} transaction={t} />)
            )}
          </div>
        </div>

        <div className="col">
          <div className="card">
            <SectionHead title="Budgets" to="/budgets" />
            {budgets.length === 0 ? (
              <EmptyState icon="fa-chart-pie">No budgets yet. Set a monthly limit for a category.</EmptyState>
            ) : (
              <div className="budget-body">
                <DonutChart
                  data={budgets.map((b) => ({ name: b.category, value: b.maximumCents, color: b.theme }))}
                  centerTop={formatMoney(budgetSpent)}
                  centerBottom={`of ${formatMoney(budgetLimit)} limit`}
                />
                <div className="legend-col">
                  {budgets.map((b) => (
                    <LegendItem key={b.id} color={b.theme} label={b.category} value={formatMoney(b.maximumCents)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <SectionHead title="Recurring Bills" to="/recurring-bills" />
            <div className="bills-summary">
              <div className="bill-tile" style={{ '--bar': '#277C78' }}>
                <span className="muted">Paid Bills</span>
                <strong>{formatMoney(recurring.paid.totalCents)}</strong>
              </div>
              <div className="bill-tile" style={{ '--bar': '#F2CDAC' }}>
                <span className="muted">Total Upcoming</span>
                <strong>{formatMoney(recurring.upcoming.totalCents)}</strong>
              </div>
              <div className="bill-tile" style={{ '--bar': '#82C9D7' }}>
                <span className="muted">Due Soon</span>
                <strong>{formatMoney(recurring.dueSoon.totalCents)}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default OverviewPage
