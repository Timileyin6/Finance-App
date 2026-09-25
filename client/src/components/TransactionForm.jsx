import { useState } from 'react'
import Modal from './Modal'
import ConfirmDelete from './ConfirmDelete'
import { CategorySelect, Field, FormError, MoneyInput, useSubmit } from './FormParts'
import { api } from '../lib/api'
import { centsToInput, formatMoney, toDateInput } from '../lib/format'

/** Add a manual transaction, or edit an existing one. Bank-imported ones only allow category/recurring. */
function TransactionForm({ transaction, onSaved, onClose }) {
  const editing = Boolean(transaction)
  const imported = Boolean(transaction) && transaction.source !== 'manual'
  const [form, setForm] = useState({
    name: transaction?.name ?? '',
    type: transaction && transaction.amountCents > 0 ? 'income' : 'expense',
    amount: transaction ? centsToInput(transaction.amountCents) : '',
    date: toDateInput(transaction?.date),
    category: transaction?.category ?? '',
    recurring: transaction?.recurring ?? false,
    isCash: transaction?.isCash ?? false,
    counterparty: transaction?.counterparty ?? '',
  })
  const [confirming, setConfirming] = useState(false)
  const { busy, error, run } = useSubmit()
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const isTransfer = form.category === 'Transfer'
  const moneyOut = imported ? transaction.amountCents < 0 : form.type === 'expense'

  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      const body = imported
        ? { category: form.category, recurring: form.recurring, counterparty: form.counterparty }
        : form
      if (editing) await api(`/transactions/${transaction.id}`, { method: 'PUT', body })
      else await api('/transactions', { method: 'POST', body })
      onSaved()
    })
  }

  if (confirming) {
    return (
      <ConfirmDelete
        title={transaction.name}
        message="This transaction will be removed permanently."
        onConfirm={() => api(`/transactions/${transaction.id}`, { method: 'DELETE' }).then(onSaved)}
        onClose={() => setConfirming(false)}
      />
    )
  }

  return (
    <Modal
      title={editing ? 'Edit Transaction' : 'Add Transaction'}
      description={
        imported
          ? `Imported from ${transaction.statement ? `your ${transaction.statement.bankName} statement` : (transaction.connection?.institutionName ?? 'your bank')} · ${formatMoney(transaction.amountCents, { signed: true })}. You can recategorise it or mark it as a recurring bill.`
          : 'Record cash, transfers or anything your bank doesn’t send automatically.'
      }
      onClose={onClose}
    >
      <form className="stack" onSubmit={submit}>
        {imported && transaction.bankNarration && (
          <p className="bank-narration">
            <span className="field-label">Bank description</span>
            {transaction.bankNarration}
          </p>
        )}
        {!imported && (
          <>
            <div className="segmented" role="radiogroup" aria-label="Transaction type">
              {['expense', 'income'].map((type) => (
                <button key={type} type="button" role="radio" aria-checked={form.type === type} className={form.type === type ? 'on' : ''} onClick={() => set('type')(type)}>
                  {type === 'expense' ? 'Money out' : 'Money in'}
                </button>
              ))}
            </div>
            <Field label={isTransfer ? 'Description' : form.type === 'expense' ? 'Paid to' : 'Received from'}>
              <input
                value={form.name}
                onChange={(e) => set('name')(e.target.value)}
                maxLength={120}
                placeholder={isTransfer ? 'e.g. Rent share' : 'e.g. Chicken Republic'}
                required
              />
            </Field>
            <fieldset className="field">
              <legend className="field-label">Paid with</legend>
              <div className="segmented" role="radiogroup" aria-label="Paid with">
                {[[false, 'fa-credit-card', 'Bank / card / transfer'], [true, 'fa-money-bill-wave', 'Cash']].map(([cash, icon, label]) => (
                  <button key={label} type="button" role="radio" aria-checked={form.isCash === cash} className={form.isCash === cash ? 'on' : ''} onClick={() => set('isCash')(cash)}>
                    <i className={`fa-solid ${icon}`} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
              {form.isCash && <span className="field-hint left">Cash payments won’t appear on bank statements, so they’re never flagged as duplicates.</span>}
            </fieldset>
            <div className="two-col">
              <Field label="Amount">
                <MoneyInput value={form.amount} onChange={set('amount')} />
              </Field>
              <Field label="Date">
                <input type="date" value={form.date} onChange={(e) => set('date')(e.target.value)} required />
              </Field>
            </div>
          </>
        )}
        <Field label="Category">
          <CategorySelect value={form.category} onChange={set('category')} />
        </Field>
        {isTransfer && (
          <Field label={moneyOut ? 'Transferred to' : 'Received from'} hint="The person or account on the other end of the transfer">
            <input
              value={form.counterparty}
              onChange={(e) => set('counterparty')(e.target.value)}
              maxLength={120}
              placeholder="e.g. Adaeze Okafor"
              required
              autoFocus={imported && !form.counterparty}
            />
          </Field>
        )}
        <label className="check">
          <input type="checkbox" checked={form.recurring} onChange={(e) => set('recurring')(e.target.checked)} />
          Recurring monthly bill
        </label>
        <FormError error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save Changes' : 'Add Transaction'}</button>
        {editing && !imported && (
          <button type="button" className="btn ghost danger-text" onClick={() => setConfirming(true)}>Delete Transaction</button>
        )}
      </form>
    </Modal>
  )
}

export default TransactionForm
