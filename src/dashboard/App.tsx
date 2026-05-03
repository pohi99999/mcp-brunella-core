import { useState, useEffect } from 'react'
import { Toaster } from 'sonner'
import { MissionControlLayout } from '@/components/dashboard/MissionControlLayout'
import { ExperimentProvider } from '@/context/ExperimentContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

function SplashScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
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
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#020202]"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      <div className="absolute inset-0 bg-grid-pattern opacity-[0.12]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_36%)]" />

      <motion.div
        className="relative flex flex-col items-center gap-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <div className="relative flex h-20 w-20 items-center justify-center rounded-[1.75rem] border border-white/10 bg-white/[0.03] shadow-[0_30px_80px_-50px_rgba(0,0,0,0.95)]">
          <div className="absolute inset-[10px] rounded-[1.2rem] border border-white/8 bg-black/60" />
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-black">
            <Zap size={20} className="text-black" />
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white">
            Brunella
          </h1>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-[0.38em] text-white/45">
            {t("splash.boot_sequence")}
          </p>
        </div>

        <div className="w-64 flex flex-col gap-2">
          <div className="h-[2px] bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-white/35 uppercase tracking-[0.3em]">
            <span>{t("splash.preparing")}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
        </div>

        <motion.p
          className="text-[10px] font-mono text-white/40 tracking-[0.32em] uppercase"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {progress < 0.35 ? t("splash.loading_agents") :
           progress < 0.65 ? t("splash.connecting_services") :
           progress < 0.9  ? t("splash.synchronizing") :
                             t("splash.ready")}
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
