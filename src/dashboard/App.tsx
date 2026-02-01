import { Toaster } from 'sonner'
import { MissionControlLayout } from '@/components/dashboard/MissionControlLayout'

function App() {
  return (
    <>
      <Toaster position="top-right" theme="dark" />
      <MissionControlLayout />
    </>
  )
}

export default App
