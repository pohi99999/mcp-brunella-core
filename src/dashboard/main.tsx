import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { SocketProvider } from './context/SocketContext.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

import { ThemeProvider } from "./components/ui/theme-provider.tsx"

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
        <SocketProvider>
          <App />
        </SocketProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
)
