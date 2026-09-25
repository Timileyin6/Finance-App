import { useState } from 'react'
import { useMeta } from '../lib/MetaContext'
import { currencySymbol } from '../lib/format'

// eslint-disable-next-line react-refresh/only-export-components
export function useSubmit() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async (fn) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
  return { busy, error, run }
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function MoneyInput({ value, onChange, ...props }) {
  return (
    <div className="money-input">
      <span>{currencySymbol()}</span>
      <input type="number" inputMode="decimal" min="0.01" step="0.01" placeholder="e.g. 20000" value={value} onChange={(e) => onChange(e.target.value)} required {...props} />
    </div>
  )
}

export function CategorySelect({ value, onChange, exclude = [] }) {
  const { categories } = useMeta()
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>Choose a category</option>
      {categories.map((c) => (
        <option key={c} value={c} disabled={exclude.includes(c)}>
          {c}{exclude.includes(c) ? ' (already used)' : ''}
        </option>
      ))}
    </select>
  )
}

export function ThemePicker({ value, onChange }) {
  const { themes } = useMeta()
  return (
    <fieldset className="field">
      <legend className="field-label">Theme</legend>
      <div className="swatches">
        {themes.map((t) => (
          <label key={t.color} className="swatch" title={t.name}>
            <input type="radio" name="theme" value={t.color} checked={value === t.color} onChange={() => onChange(t.color)} required />
            <span style={{ background: t.color }} />
            <span className="sr-only">{t.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function FormError({ error }) {
  return error ? <p className="form-error" role="alert">{error}</p> : null
}
