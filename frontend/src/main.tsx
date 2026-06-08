import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from 'sonner'
import { ThemeProvider } from './contexts/theme-provider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <Toaster position="bottom-right" richColors closeButton duration={2000} offset={50} expand={true} />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
