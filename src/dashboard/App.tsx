import { Toaster } from 'sonner'
import { MissionControlLayout } from '@/components/dashboard/MissionControlLayout'
import { ThemeProvider } from '@/components/ui/theme-provider'

function App() {
  return (
    <>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Toaster position="top-right" />
        <MissionControlLayout />
      </ThemeProvider>
    </>
  )
}

export default App
