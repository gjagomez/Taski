import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ApolloProvider } from '@apollo/client/react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { client } from '@/lib/apollo'
import { AuthProvider } from '@/lib/auth'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApolloProvider client={client}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider delayDuration={200}>
            <App />
            <Toaster richColors position="top-right" />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </ApolloProvider>
  </StrictMode>
)
