import { createContext, useContext } from 'react'
import { useFetch } from './useFetch'
import { setCurrency } from './format'
import { Loading } from '../components/Status'

const FALLBACK = {
  categories: [],
  themes: [],
  currency: 'NGN',
  locale: 'en-NG',
  bank: { provider: 'mono', enabled: false, publicKey: '', testMode: true },
}
const MetaContext = createContext(FALLBACK)

/** Categories, theme colours, currency and feature flags, shared by the server so both sides agree. */
export function MetaProvider({ children }) {
  const { data, loading } = useFetch('/meta')
  // Wait for the currency before rendering any amounts
  if (loading && !data) return <Loading fullScreen />
  const meta = data ?? FALLBACK
  setCurrency(meta.currency, meta.locale)
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useMeta = () => useContext(MetaContext)
