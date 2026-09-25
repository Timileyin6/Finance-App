import { useState } from 'react'
import { Link } from 'react-router-dom'
import AuthLayout from './AuthLayout'
import { Field, FormError, useSubmit } from '../components/FormParts'
import { useAuth } from '../lib/AuthContext'

function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const { busy, error, run } = useSubmit()

  const submit = (e) => {
    e.preventDefault()
    run(() => login(email, password))
  }

  return (
    <AuthLayout>
      <form className="card auth-card stack" onSubmit={submit}>
        <h2>Login</h2>
        <Field label="Email">
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <div className="password-input">
            <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="button" className="icon-btn" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
              <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden="true" />
            </button>
          </div>
        </Field>
        <FormError error={error} />
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Login'}</button>
        <p className="muted center">
          Need to create an account? <Link to="/signup" className="strong-link">Sign Up</Link>
        </p>
        {import.meta.env.DEV && (
          <button type="button" className="link-btn center" onClick={() => { setEmail('demo@finance.app'); setPassword('password123') }}>
            Fill in the demo account
          </button>
        )}
      </form>
    </AuthLayout>
  )
}

export default LoginPage
