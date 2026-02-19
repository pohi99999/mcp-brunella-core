import { Toaster } from 'sonner'
import { MissionControlLayout } from '@/components/dashboard/MissionControlLayout'
import { ExperimentProvider } from '@/context/ExperimentContext'

function App() {
  return (
    <>
      <ExperimentProvider>
        <Toaster position="top-right" />
        <MissionControlLayout />
      </ExperimentProvider>
    </>
  )
}

export default App
