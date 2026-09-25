import Avatar from './Avatar'
import { formatDate, formatMoney } from '../lib/format'
import '../css/Transaction.css'

// "Transfer · To Adaeze Okafor". Transfers without a recorded recipient are flagged so they get filled in.
function TransactionSubline({ transaction, showCategory }) {
  const { category, counterparty, amountCents } = transaction
  const party = counterparty && `${amountCents < 0 ? 'To' : 'From'} ${counterparty}`
  const missing = category === 'Transfer' && !counterparty
  if (!showCategory && !party && !missing) return null
  return (
    <p className="tx-sub">
      {[showCategory && category, party].filter(Boolean).join(' · ')}
      {missing && (
        <span className="tx-missing">
          {showCategory && ' · '}
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {amountCents < 0 ? 'Recipient' : 'Sender'} not recorded
        </span>
      )}
    </p>
  )
}

function TransactionRow({ transaction, showCategory = false, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag type={onClick ? 'button' : undefined} className="tx-row" onClick={onClick}>
      <div className="tx-who">
        <Avatar name={transaction.name} />
        <div>
          <p className="tx-name">
            {transaction.name}
            {transaction.recurring && <i className="fa-solid fa-rotate tx-flag" title="Recurring" aria-label="Recurring" />}
            {transaction.source === 'bank' && <i className="fa-solid fa-building-columns tx-flag" title="Imported from your bank" aria-label="From bank" />}
            {transaction.source === 'statement' && (
              <i className="fa-solid fa-file-lines tx-flag" title={`From your ${transaction.statement?.bankName ?? 'bank'} statement`} aria-label="From bank statement" />
            )}
            {transaction.isCash && (
              <span className="pill cash" title="Paid in cash">
                <i className="fa-solid fa-money-bill-wave" aria-hidden="true" /> Cash
              </span>
            )}
            {transaction.pending && <span className="pill">Pending</span>}
          </p>
          <TransactionSubline transaction={transaction} showCategory={showCategory} />
        </div>
      </div>
      <div className="tx-right">
        <p className={`tx-amount ${transaction.amountCents > 0 ? 'positive' : ''}`}>
          {formatMoney(transaction.amountCents, { signed: true })}
        </p>
        <p className="tx-sub">{formatDate(transaction.date)}</p>
      </div>
    </Tag>
  )
}

export default TransactionRow
