import { Badge } from '../dashboard/components/ui/badge';
import { Button } from '../dashboard/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../dashboard/components/ui/card';
import { ScrollArea } from '../dashboard/components/ui/scroll-area';
import { ThemeProvider } from '../dashboard/components/theme-provider';
import { PropertySalesWidget } from '../dashboard/components/dashboard/PropertySalesWidget';
import { pSalesTrack } from '../data/pSalesTrack';
import { Building2, Download, Globe2, Rocket, ShieldCheck, Layers3 } from 'lucide-react';
import { Toaster, toast } from 'sonner';

export function PSalesStandaloneApp() {
  return (
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
                  onClick={() => toast.success('A standalone shell scaffold kész. A következő lépés a csomagolási útvonal finomítása.')}
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
                    A standalone shell ezután a telepítési és csomagolási útvonalat kapja meg.
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
  );
}
