import { useState } from 'react'
import Modal from './Modal'
import ProgressBar from './ProgressBar'
import { Field, FormError, MoneyInput, ThemePicker, useSubmit } from './FormParts'
import { api } from '../lib/api'
import { centsToInput, formatMoney, percent } from '../lib/format'

export function PotForm({ pot, onSaved, onClose }) {
  const [form, setForm] = useState({
    name: pot?.name ?? '',
    target: pot ? centsToInput(pot.targetCents) : '',
    theme: pot?.theme ?? '',
  })
  const { busy, error, run } = useSubmit()
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      if (pot) await api(`/pots/${pot.id}`, { method: 'PUT', body: form })
      else await api('/pots', { method: 'POST', body: form })
      onSaved()
    })
  }

  return (
    <Modal
      title={pot ? 'Edit Pot' : 'Add New Pot'}
      description={pot ? 'If your saving targets change, feel free to update your pots.' : 'Create a pot to set savings targets. These can help keep you on track as you save for special purchases.'}
      onClose={onClose}
    >
      <form className="stack" onSubmit={submit}>
        <Field label="Pot Name" hint={`${30 - form.name.length} characters left`}>
          <input value={form.name} onChange={(e) => set('name')(e.target.value)} maxLength={30} placeholder="e.g. Rainy Days" required />
        </Field>
        <Field label="Target">
          <MoneyInput value={form.target} onChange={set('target')} />
        </Field>
        <ThemePicker value={form.theme} onChange={set('theme')} />
        <FormError error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : pot ? 'Save Changes' : 'Add Pot'}</button>
      </form>
    </Modal>
  )
}

/** Add money to, or withdraw from, a pot. mode: 'deposit' | 'withdraw' */
export function MoveMoneyForm({ pot, mode, onSaved, onClose }) {
  const [amount, setAmount] = useState('')
  const { busy, error, run } = useSubmit()
  const deposit = mode === 'deposit'
  const delta = Math.round((Number(amount) || 0) * 100) * (deposit ? 1 : -1)
  const newTotal = Math.max(0, pot.totalCents + delta)

  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      await api(`/pots/${pot.id}/${mode}`, { method: 'POST', body: { amount } })
      onSaved()
    })
  }

  return (
    <Modal
      title={deposit ? `Add to ‘${pot.name}’` : `Withdraw from ‘${pot.name}’`}
      description={deposit ? 'Move money from your balance into this pot.' : 'Move money from this pot back into your main balance.'}
      onClose={onClose}
    >
      <form className="stack" onSubmit={submit}>
        <div className="between">
          <span className="muted">New Amount</span>
          <strong className="big-number">{formatMoney(newTotal)}</strong>
        </div>
        <ProgressBar value={percent(newTotal, pot.targetCents)} color={deposit ? '#277C78' : '#C94736'} label="New progress" thick />
        <div className="between small">
          <strong style={{ color: deposit ? '#277C78' : '#C94736' }}>{percent(newTotal, pot.targetCents).toFixed(2)}%</strong>
          <span className="muted">Target of {formatMoney(pot.targetCents)}</span>
        </div>
        <Field label={deposit ? 'Amount to Add' : 'Amount to Withdraw'}>
          <MoneyInput value={amount} onChange={setAmount} max={deposit ? undefined : (pot.totalCents / 100).toFixed(2)} autoFocus />
        </Field>
        <FormError error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : deposit ? 'Confirm Addition' : 'Confirm Withdrawal'}</button>
      </form>
    </Modal>
  )
}
