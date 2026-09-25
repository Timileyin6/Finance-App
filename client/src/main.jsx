import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './lib/AuthContext'
import { MetaProvider } from './lib/MetaContext'
import App from './App.jsx'
import './css/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <MetaProvider>
          <App />
        </MetaProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
