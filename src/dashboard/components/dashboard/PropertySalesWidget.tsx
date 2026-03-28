import React from "react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Progress } from "../ui/progress";
import { ScrollArea } from "../ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Building2, CheckCircle2, ClipboardList, FileCheck2, FileText, Globe2, HelpCircle, Rocket, Search, ShieldCheck, Target, TrendingUp, Users } from "lucide-react";
import { pSalesTrack, formatPSalesPhaseStatus } from "@/data/pSalesTrack";
import { toast } from "sonner";

export function PropertySalesWidget() {
  return (
    <div className="space-y-6">
      <Card className="glass-card border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3 border-b border-white/[0.04]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-white">
                    Ingatlan Értékesítési Platform
                  </CardTitle>
                  <p className="text-sm text-zinc-500">
                    BAS enterprise integráció + külön telepíthető standalone út ugyanazzal a core workflow-val.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                  {pSalesTrack.status.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                  {pSalesTrack.trackId}
                </Badge>
                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                  Phase 1 fókusz
                </Badge>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="border-white/[0.08] bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
                onClick={() => toast.info("Architektúra dokumentum: " + pSalesTrack.architectureDoc)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Architektúra
              </Button>
              <Button
                className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/20"
                onClick={() => toast.success(`A következő ready lépés: ${pSalesTrack.nextReadyStep}`)}
              >
                <Rocket className="mr-2 h-4 w-4" />
                Következő lépés
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Közös core</p>
              <p className="mt-2 text-sm font-semibold text-white">Dokumentum → kutatás → stratégia → végrehajtás</p>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Delivery surfaces</p>
              <p className="mt-2 text-sm font-semibold text-white">{pSalesTrack.surfaces.length} szállítási modell</p>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Ügynökök</p>
              <p className="mt-2 text-sm font-semibold text-white">{pSalesTrack.agents.length} fő szerep</p>
            </div>
            <div className="rounded-xl border border-white/[0.04] bg-white/[0.03] p-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Progress</p>
              <p className="mt-2 text-sm font-semibold text-white">{pSalesTrack.progress}%</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-zinc-500">
              <span>Track státusz</span>
              <span>{pSalesTrack.currentFocus}</span>
            </div>
            <Progress value={pSalesTrack.progress} className="h-1 bg-white/[0.04]" />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workflow" className="w-full">
        <TabsList className="grid h-12 w-full grid-cols-6 rounded-xl bg-white/[0.03] p-1 backdrop-blur-md lg:w-[1120px]">
          <TabsTrigger value="workflow" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            Folyamat
          </TabsTrigger>
          <TabsTrigger value="intake" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            Intake
          </TabsTrigger>
          <TabsTrigger value="research" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            Kutatás
          </TabsTrigger>
          <TabsTrigger value="agents" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            Ügynökök
          </TabsTrigger>
          <TabsTrigger value="delivery" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            Szállítás
          </TabsTrigger>
          <TabsTrigger value="context" className="text-[10px] font-bold uppercase tracking-wider data-[state=active]:bg-primary data-[state=active]:text-white">
            Kontextus
          </TabsTrigger>
        </TabsList>

        <TabsContent value="workflow" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Target className="h-4 w-4 text-primary" />
                P-Sales ütemterv
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pSalesTrack.phases.map((phase) => (
                <div key={phase.id} className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{phase.title}</h3>
                        <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                          {formatPSalesPhaseStatus(phase.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-zinc-400">{phase.summary}</p>
                    </div>
                    {phase.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {phase.checkpoints.map((checkpoint) => (
                      <div key={checkpoint} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-xs text-zinc-300">
                        {checkpoint}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="intake" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <ClipboardList className="h-4 w-4 text-primary" />
                Intake és felmérés
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                A belépési pont feladata, hogy a feltöltött dokumentumokból hiánylistát, kérdéslistát és intake státuszt állítson elő, mielőtt a kutató ügynök dolgozni kezd.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Dokumentum-csomag</h3>
                  </div>
                  <ScrollArea className="mt-3 h-64 pr-3">
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
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Felmérő kérdések</h3>
                  </div>
                  <ScrollArea className="mt-3 h-64 pr-3">
                    <ol className="space-y-3 text-sm text-zinc-300">
                      {pSalesTrack.intake.surveyQuestions.map((question, index) => (
                        <li key={question} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          {question}
                        </li>
                      ))}
                    </ol>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Várt outputok</h3>
                  </div>
                  <div className="mt-3 space-y-3">
                    {pSalesTrack.intake.outputs.map((output) => (
                      <div key={output} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                        {output}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="research" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Search className="h-4 w-4 text-primary" />
                Kutatási és értékelési modell
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                A kutató és értékelő ügynök feladata a piaci összehasonlítás, a tranzakciós bizonyítékok összegyűjtése és az értéktartomány meghatározása.
              </p>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Forrástípusok</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <div className="space-y-3">
                      {pSalesTrack.research.sourceTypes.map((sourceType) => (
                        <div key={sourceType} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                          {sourceType}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Komparálási kritériumok</h3>
                  </div>
                  <ScrollArea className="mt-3 h-56 pr-3">
                    <ol className="space-y-3 text-sm text-zinc-300">
                      {pSalesTrack.research.comparableCriteria.map((criterion, index) => (
                        <li key={criterion} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3">
                          <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                            {index + 1}
                          </span>
                          {criterion}
                        </li>
                      ))}
                    </ol>
                  </ScrollArea>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-black/20 p-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-bold text-white">Riport és értékesítési output</h3>
                  </div>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Értéktartomány outputok</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.research.valuationOutputs.map((output) => (
                          <div key={output} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2 text-sm text-zinc-300">
                            {output}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Kockázati jelzések</p>
                      <div className="mt-2 space-y-2">
                        {pSalesTrack.research.riskFlags.map((risk) => (
                          <div key={risk} className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
                            {risk}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <Users className="h-4 w-4 text-primary" />
                Ügynöki szerepkörök
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {pSalesTrack.agents.map((agent) => (
                <div key={agent} className="flex items-center justify-between rounded-xl border border-white/[0.04] bg-white/[0.03] px-4 py-3">
                  <span className="text-sm text-zinc-200">{agent}</span>
                  <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-zinc-300">
                    core
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delivery" className="mt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Building2 className="h-4 w-4 text-primary" />
                  Enterprise
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-400">
                <p>Beépül a BAS enterprise dashboardba, külön panelként.</p>
                <p>Intake, report és approval nézeteket ad belső felhasználóknak.</p>
              </CardContent>
            </Card>
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <Globe2 className="h-4 w-4 text-primary" />
                  Standalone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-400">
                <p>Külön telepíthető shell, saját brandinggel és onboardinggal.</p>
                <p>Ugyanazt a core workflow-t használja, mint az enterprise modul.</p>
              </CardContent>
            </Card>
            <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-white">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Cloudflare
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-400">
                {pSalesTrack.cloudflare.map((item) => (
                  <div key={item} className="rounded-lg border border-white/[0.04] bg-white/[0.02] px-3 py-2">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="context" className="mt-6">
          <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm text-white">
                <FileText className="h-4 w-4 text-primary" />
                Track kontextus
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-zinc-400">
              <p>A Phase 0 architektúra elkészült, a következő fókusz az intake és az enterprise dashboard integráció elmélyítése.</p>
              <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Architektúra dokumentum</p>
                <p className="mt-2 font-mono text-xs text-zinc-200">{pSalesTrack.architectureDoc}</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Következő ready lépés</p>
                  <p className="mt-2 text-zinc-200">{pSalesTrack.nextReadyStep}</p>
                </div>
                <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] p-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Progress</p>
                  <p className="mt-2 text-zinc-200">{pSalesTrack.progress}% · {pSalesTrack.currentFocus}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-white/[0.04] bg-white/[0.03] backdrop-blur-xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm text-white">
            <FileText className="h-4 w-4 text-primary" />
            Kimeneti fókusz
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-400">
          A jelenlegi dashboard shell a Phase 1 elindítását szolgálja. Innen lehet továbbépíteni az intake, research, strategy és execution nézeteket.
        </CardContent>
      </Card>
    </div>
  );
}
