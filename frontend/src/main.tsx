import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './contexts/theme-provider.tsx'

import { AuthProvider } from './context/AuthContext.tsx'
import { installAuthHeaders } from './lib/authHeaders.ts'
import { LocationProvider } from './context/LocationContext.tsx'

installAuthHeaders()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <LocationProvider>
          <App />
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
