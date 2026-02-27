import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import { MissionControlLayout } from '@/components/dashboard/MissionControlLayout'
import { ExperimentProvider } from '@/context/ExperimentContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const start = Date.now()
    const duration = 2400

    const frame = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(elapsed / duration, 1)
      setProgress(pct)
      if (pct < 1) {
        requestAnimationFrame(frame)
      } else {
        setTimeout(onDone, 300)
      }
    }
    requestAnimationFrame(frame)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020205]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 bg-grid-pattern opacity-30" />

      {/* Glow pulse */}
      <div className="absolute w-[400px] h-[400px] rounded-full bg-primary/5 blur-3xl animate-pulse" />

      {/* Logo */}
      <motion.div
        className="relative flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_40px_rgba(var(--primary),0.3)]">
            <Zap size={40} className="text-primary animate-pulse" />
          </div>
          {/* Orbiting ring */}
          <motion.div
            className="absolute inset-[-8px] rounded-2xl border border-primary/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          />
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tighter text-white uppercase italic">
            Brunella Cortex
          </h1>
          <p className="text-xs font-mono text-primary/60 tracking-[0.3em] mt-1">
            NEURAL NETWORK OS v2.3.0
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-64 flex flex-col gap-2">
          <div className="h-[2px] bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary),0.8)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
            <span>INITIALIZING SYSTEMS</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>

        {/* Status messages */}
        <motion.p
          className="text-[10px] font-mono text-zinc-500 tracking-widest"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {progress < 0.35 ? 'LOADING AGENT REGISTRY...' :
           progress < 0.65 ? 'CONNECTING NEURAL NODES...' :
           progress < 0.9  ? 'SYNCHRONIZING CORTEX...' :
                             'ONLINE'}
        </motion.p>
      </motion.div>
    </motion.div>
  )
}

function App() {
  const [ready, setReady] = useState(false)

  return (
    <>
      <AnimatePresence>
        {!ready && <SplashScreen onDone={() => setReady(true)} />}
      </AnimatePresence>

      {ready && (
        <ExperimentProvider>
          <Toaster position="top-right" />
          <MissionControlLayout />
        </ExperimentProvider>
      )}
    </>
  )
}

export default App
