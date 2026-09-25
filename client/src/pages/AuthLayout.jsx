import '../css/Auth.css'

function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <section className="auth-art">
        <h1 className="logo">finance</h1>
        <div>
          <h2>Keep track of your money and save for your future</h2>
          <p>
            Personal finance app puts you in control of your spending. Track transactions, set budgets, and add to
            savings pots easily.
          </p>
        </div>
      </section>
      <section className="auth-form-wrap">{children}</section>
    </div>
  )
}

export default AuthLayout
