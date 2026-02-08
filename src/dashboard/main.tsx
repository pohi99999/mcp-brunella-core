import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { SocketProvider } from './context/SocketContext.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

import { ThemeProvider } from "./components/theme-provider.tsx"

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
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <SocketProvider>
          <App />
        </SocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
)
