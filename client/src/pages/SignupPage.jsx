import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { Field, FormError, useSubmit } from '../components/FormParts'
import { useAuth } from '../lib/AuthContext'

function SignupPage() {
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const { busy, error, run } = useSubmit()
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    run(() => register(form.name, form.email, form.password))
  }

  return (
    <AuthLayout>
      <form className="card auth-card stack" onSubmit={submit}>
        <h2>Sign Up</h2>
        <Field label="Name">
          <input autoComplete="name" value={form.name} onChange={set('name')} maxLength={80} required />
        </Field>
        <Field label="Email">
          <input type="email" autoComplete="email" value={form.email} onChange={set('email')} required />
        </Field>
        <Field label="Create Password" hint="Passwords must be at least 8 characters">
          <input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={set('password')} required />
        </Field>
        <FormError error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Creating account…' : 'Create Account'}</button>
        <p className="muted center">
          Already have an account? <Link to="/login" className="strong-link">Login</Link>
        </p>
      </form>
    </AuthLayout>
  )
}

export default SignupPage
