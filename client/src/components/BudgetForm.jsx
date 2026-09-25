import { useState } from 'react'
import Modal from './Modal'
import { CategorySelect, Field, FormError, MoneyInput, ThemePicker, useSubmit } from './FormParts'
import { api } from '../lib/api'
import { centsToInput } from '../lib/format'

function BudgetForm({ budget, usedCategories, onSaved, onClose }) {
  const [form, setForm] = useState({
    category: budget?.category ?? '',
    maximum: budget ? centsToInput(budget.maximumCents) : '',
    theme: budget?.theme ?? '',
  })
  const { busy, error, run } = useSubmit()
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))

  const submit = (e) => {
    e.preventDefault()
    run(async () => {
      if (budget) await api(`/budgets/${budget.id}`, { method: 'PUT', body: form })
      else await api('/budgets', { method: 'POST', body: form })
      onSaved()
    })
  }

  return (
    <Modal
      title={budget ? 'Edit Budget' : 'Add New Budget'}
      description={budget ? 'As your budgets change, feel free to update your spending limits.' : 'Choose a category to set a monthly spending limit. It helps you keep an eye on where your money goes.'}
      onClose={onClose}
    >
      <form className="stack" onSubmit={submit}>
        <Field label="Budget Category">
          <CategorySelect value={form.category} onChange={set('category')} exclude={usedCategories.filter((c) => c !== budget?.category)} />
        </Field>
        <Field label="Maximum Spend (per month)">
          <MoneyInput value={form.maximum} onChange={set('maximum')} />
        </Field>
        <ThemePicker value={form.theme} onChange={set('theme')} />
        <FormError error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : budget ? 'Save Changes' : 'Add Budget'}</button>
      </form>
    </Modal>
  )
}

export default BudgetForm
