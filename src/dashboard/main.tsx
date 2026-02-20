import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App'
import { ErrorFallback } from './ErrorFallback'
import { SocketProvider } from './context/SocketContext'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

import { ThemeProvider } from "./components/ui/theme-provider"
import { initializeNavigation } from "./lib/navigation"
import { LayoutProvider } from "./lib/layout/LayoutContext"

initializeNavigation();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <LayoutProvider>
          <SocketProvider>
            <App />
          </SocketProvider>
        </LayoutProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
)
