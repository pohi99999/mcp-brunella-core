import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { SocketProvider } from './context/SocketContext.tsx'

import "./main.css"
import "./styles/theme.css"
import "./index.css"

import { ThemeProvider } from "./components/theme-provider.tsx"

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SocketProvider>
        <App />
      </SocketProvider>
    </ThemeProvider>
  </ErrorBoundary>
)
