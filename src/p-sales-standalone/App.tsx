import { useEffect, useState } from 'react';
import { Badge } from '../dashboard/components/ui/badge';
import { Button } from '../dashboard/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../dashboard/components/ui/card';
import { ScrollArea } from '../dashboard/components/ui/scroll-area';
import { ThemeProvider } from '../dashboard/components/theme-provider';
import { PropertySalesWidget } from '../dashboard/components/dashboard/PropertySalesWidget';
import { pSalesTrack } from '../data/pSalesTrack';
import { Building2, Download, Globe2, Rocket, ShieldCheck, Layers3 } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { AuthProvider } from './auth/AuthProvider.js';
import { ProtectedRoute } from './auth/ProtectedRoute.js';

type StandaloneBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  platforms?: string[];
};

export function PSalesStandaloneApp() {
  const [installPrompt, setInstallPrompt] = useState<StandaloneBeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const standaloneMatch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone));

    setIsStandalone(standaloneMatch);

    if (typeof window === 'undefined') {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event): void => {
      event.preventDefault();
      setInstallPrompt(event as StandaloneBeforeInstallPromptEvent);
    };

    const handleAppInstalled = (): void => {
      setIsStandalone(true);
      setInstallPrompt(null);
      toast.success('A P-Sales standalone shell telepítve lett.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', handleAppInstalled);

    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      void navigator.serviceWorker.register('/p-sales-sw.js').catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        toast.error(`A service worker regisztráció nem sikerült: ${message}`);
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async (): Promise<void> => {
    if (isStandalone) {
      toast.info('Ez az alkalmazás már standalone módban fut.');
      return;
    }

    if (!installPrompt) {
      toast.info('A böngésző még nem adta ki az install promptot. Használd a böngésző menüjének Install opcióját.');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      toast.success('A telepítési promptot elfogadtad.');
    } else {
      toast.info('A telepítési promptot elutasítottad.');
    }

    setInstallPrompt(null);
  };

  return (
    <AuthProvider>
      <ProtectedRoute>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <div className="min-h-screen bg-[#050816] text-white">
        <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 py-8">
          <header className="rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-zinc-500">
                      Standalone application shell
                    </p>
                    <h1 className="text-3xl font-black tracking-tight text-white">
                      P-Sales standalone shell
                    </h1>
                  </div>
                </div>
                <p className="max-w-3xl text-sm text-zinc-400">
                  Külön telepíthető belépő ugyanazzal a shared core workflow-val, mint a BAS enterprise modul:
                  dokumentumfeltöltés, felmérés, kutatás, stratégia és végrehajtás.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                    {pSalesTrack.status.toUpperCase()}
                  </Badge>
                  <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                    {pSalesTrack.trackId}
                  </Badge>
                  <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                    {pSalesTrack.progress}% progress
                  </Badge>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                  onClick={() => toast.info('A standalone shell a shared core-t és a BAS enterprise workflow-t használja.')}
                >
                  <Rocket className="mr-2 h-4 w-4" />
                  Core workflow
                </Button>
                <Button
                  variant="outline"
                  className="border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
                  onClick={handleInstallClick}
                >
                  <Layers3 className="mr-2 h-4 w-4" />
                  {isStandalone ? 'Már telepítve' : installPrompt ? 'Telepítés' : 'Telepítésre kész'}
                </Button>
                <Button
                  variant="outline"
                  className="border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
                  onClick={() => toast.success('A standalone shell scaffold kész. A következő lépés az auth modell és tenant-konfiguráció finomítása.')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Scaffold állapot
                </Button>
              </div>
            </div>
          </header>

          <main className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="space-y-6">
              <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Layers3 className="h-4 w-4 text-primary" />
                    Standalone elhelyezés
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-400">
                  <p>A standalone shell ugyanazt a domain-core-t használja, mint a BAS enterprise panel.</p>
                  <p>A scaffold célja, hogy később külön csomagolható legyen, de ne kelljen újraépíteni a workflow logikát.</p>
                  <div className="grid gap-2">
                    {pSalesTrack.surfaces.map((surface) => (
                      <div key={surface} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                        {surface}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Download className="h-4 w-4 text-primary" />
                    Telepíthető csomag
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-400">
                  <p>A standalone shell PWA manifesttel, service workerrel és külön Docker image-csel készül elő a telepítésre.</p>
                  <div className="grid gap-2">
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                      PWA manifest + install prompt
                    </div>
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                      Service worker + offline shell
                    </div>
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                      Docker image + nginx fallback
                    </div>
                    <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                      Future option: Cloudflare Pages / Workers
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Layers3 className="h-4 w-4 text-primary" />
                    Branding és onboarding
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-400">
                  <p>{pSalesTrack.standalone.brandPromise}</p>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Onboarding lépések</p>
                    {pSalesTrack.standalone.onboardingSteps.map((step, index) => (
                      <div key={step} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        {step}
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Tenant / branding megfontolások</p>
                    {pSalesTrack.standalone.tenantNotes.map((note) => (
                      <div key={note} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                        {note}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Globe2 className="h-4 w-4 text-primary" />
                    Intake fókusz
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-400">
                  <p>A felhasználó első lépése az ingatlan dokumentációja és az alapadatok feltöltése.</p>
                  <ScrollArea className="h-56 pr-3">
                    <div className="space-y-3">
                      {pSalesTrack.intake.documentBuckets.map((bucket) => (
                        <div key={bucket.title} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <p className="text-sm font-semibold text-white">{bucket.title}</p>
                          <div className="mt-2 space-y-1 text-xs text-zinc-400">
                            {bucket.examples.map((example) => (
                              <p key={example}>• {example}</p>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Next ready step
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-zinc-400">
                  <p>{pSalesTrack.nextReadyStep}</p>
                  <div className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 text-xs text-zinc-300">
                    A standalone shell ezután a branding, onboarding és tenant-konfiguráció finomítását kapja meg.
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm text-white">
                    <Building2 className="h-4 w-4 text-primary" />
                    Standalone workflow preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PropertySalesWidget />
                </CardContent>
              </Card>
            </div>
          </main>
        </div>

        <Toaster richColors theme="dark" position="top-right" />
      </div>
    </ThemeProvider>
      </ProtectedRoute>
    </AuthProvider>
  );
}
