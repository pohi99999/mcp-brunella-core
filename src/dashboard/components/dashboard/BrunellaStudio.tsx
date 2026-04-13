import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle2, Clapperboard, Disc3, FileOutput, FolderInput, Palette, ShieldCheck, Waves } from 'lucide-react';

const STAGES = [
  {
    id: 'probe',
    title: '1. Probe',
    subtitle: 'FFmpeg + Resolve readiness',
    icon: ShieldCheck,
    accent: 'text-emerald-300',
    description: 'Ellenorzi a runtime-ot, mielott barmilyen media pipeline elindul.',
  },
  {
    id: 'ingest',
    title: '2. Ingest',
    subtitle: 'Media manifest + scoring',
    icon: FolderInput,
    accent: 'text-cyan-300',
    description: 'Binning, metadata, duplicate heuristics, proxy opcionalis elokeszites.',
  },
  {
    id: 'rough-cut',
    title: '3. Rough cut',
    subtitle: 'Deterministic story assembly',
    icon: Clapperboard,
    accent: 'text-fuchsia-300',
    description: 'Hero opening -> detail montage -> silhouette motion -> emotional close -> CTA.',
  },
  {
    id: 'audio-plan',
    title: '4. Audio post',
    subtitle: 'Beat map + ducking plan',
    icon: Waves,
    accent: 'text-amber-300',
    description: 'Music-guided plan, intensity map, cue notes, voiceover-safe ducking windows.',
  },
  {
    id: 'render',
    title: '5. Delivery',
    subtitle: 'Baseline FFmpeg renders',
    icon: FileOutput,
    accent: 'text-violet-300',
    description: 'Master, reel, square, teaser presetek egy helyen.',
  },
  {
    id: 'qc',
    title: '6. QC',
    subtitle: 'Render validation',
    icon: CheckCircle2,
    accent: 'text-lime-300',
    description: 'Black-frame, stream, duration, aspect-ratio es peak heuristics.',
  },
] as const;

const STYLE_OPTIONS = ['elegant', 'energetic', 'cinematic', 'luxury-minimal'] as const;
const PRESET_OPTIONS = ['master-16x9', 'reel-9x16', 'social-1x1', 'teaser-short'] as const;

type StudioStageId = (typeof STAGES)[number]['id'] | 'full';

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'brunella-studio';
}

export function BrunellaStudio() {
  const [projectName, setProjectName] = useState('vv-fashion');
  const [inputDir, setInputDir] = useState('F:\\media\\vv-promo');
  const [musicTrack, setMusicTrack] = useState('F:\\media\\vv-promo\\music.mp3');
  const [style, setStyle] = useState<(typeof STYLE_OPTIONS)[number]>('elegant');
  const [preset, setPreset] = useState<(typeof PRESET_OPTIONS)[number]>('master-16x9');
  const [selectedStage, setSelectedStage] = useState<StudioStageId>('full');

  const safeProjectName = useMemo(() => slugify(projectName), [projectName]);
  const outputRoot = useMemo(() => `out/studio/${safeProjectName}`, [safeProjectName]);
  const manifestDir = useMemo(() => `temp/studio/${safeProjectName}/manifests`, [safeProjectName]);

  const commands = useMemo(() => ({
    probe: 'brunella studio probe',
    ingest: `brunella studio ingest --input-dir ${inputDir} --project-name ${safeProjectName}`,
    'rough-cut': `brunella studio rough-cut --input-dir ${inputDir} --project-name ${safeProjectName} --style ${style} --target-duration 72 --music-track ${musicTrack}`,
    'audio-plan': `brunella studio audio-plan --timeline-plan ${manifestDir}\\timeline-plan.json --music-track ${musicTrack} --project-name ${safeProjectName} --style ${style}`,
    render: `brunella studio render --project-name ${safeProjectName} --timeline-plan ${manifestDir}\\timeline-plan.json --music-track ${musicTrack} --presets ${preset}`,
    qc: `brunella studio qc --file ${outputRoot}\\${safeProjectName}-${preset}.mp4`,
    full: `brunella studio full-pipeline --input-dir ${inputDir} --project-name ${safeProjectName} --music-track ${musicTrack} --style ${style} --presets ${preset}`,
  }), [inputDir, manifestDir, musicTrack, outputRoot, preset, safeProjectName, style]);

  const selectedCommand = selectedStage === 'full' ? commands.full : commands[selectedStage];

  return (
    <div className="space-y-6" data-testid="brunella-studio-dashboard">
      <Card className="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(168,85,247,0.18),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(180deg,rgba(12,14,24,0.96),rgba(8,9,16,0.98))] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.88)]">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-zinc-200">
                <Palette className="h-6 w-6 text-fuchsia-300" />
                <CardTitle className="text-3xl font-semibold tracking-tight text-white">Brunella Studio</CardTitle>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-6 text-zinc-300">
                Editorial-grade fashion promo cockpit. A primary action hierarchy-ben a probe, ingest, rough cut, audio, render es QC folyamatot rendezi egyetlen, attekintheto dashboard feluletre.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">FFmpeg baseline</Badge>
              <Badge className="border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-200">Resolve handoff ready</Badge>
              <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">QC-first delivery</Badge>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Frictionless</div>
              <div className="mt-2 text-sm font-medium text-white">1 dashboard, 6 stages, 1 end-to-end command</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Craft</div>
              <div className="mt-2 text-sm font-medium text-white">Editorial dark palette + clear stage hierarchy</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Trustworthy</div>
              <div className="mt-2 text-sm font-medium text-white">Read-only source media, explicit outputs, visible QC</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-white/10 bg-zinc-950/70 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.92)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Disc3 className="h-5 w-5 text-cyan-300" /> Studio Session Setup
            </CardTitle>
            <CardDescription>Adj helyet az uj funkcioknak: ugyanabban a panelben megadod a projektet, a forrasokat es a delivery celokat.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Projekt nev</label>
              <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} aria-label="Studio project name" className="border-white/10 bg-white/[0.03] text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Forras mappa</label>
              <Input value={inputDir} onChange={(event) => setInputDir(event.target.value)} aria-label="Studio input directory" className="border-white/10 bg-white/[0.03] text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Music track</label>
              <Input value={musicTrack} onChange={(event) => setMusicTrack(event.target.value)} aria-label="Studio music track" className="border-white/10 bg-white/[0.03] text-white" />
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Edit style</div>
              <div className="grid grid-cols-2 gap-2">
                {STYLE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={style === option ? 'default' : 'outline'}
                    className={style === option ? 'justify-start bg-fuchsia-600 text-white hover:bg-fuchsia-500' : 'justify-start border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.05]'}
                    onClick={() => setStyle(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Delivery preset</div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={preset === option ? 'default' : 'outline'}
                    className={preset === option ? 'justify-start bg-emerald-600 text-white hover:bg-emerald-500' : 'justify-start border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.05]'}
                    onClick={() => setPreset(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Generated output roots</div>
              <div className="mt-3 space-y-2 text-sm text-zinc-200">
                <div><span className="text-zinc-500">Manifest:</span> {manifestDir}</div>
                <div><span className="text-zinc-500">Exports:</span> {outputRoot}</div>
                <div><span className="text-zinc-500">Safety:</span> source media remains read-only</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-zinc-950/70 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.92)]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Pipeline lane</CardTitle>
                  <CardDescription>Az egyes szakaszoknak kulon helyet adunk, hogy a studio funkciok ne szoruljanak be egyetlen generikus panelbe.</CardDescription>
                </div>
                <div className="min-w-[180px]">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-500">
                    <span>Coverage footprint</span>
                    <span>6/6</span>
                  </div>
                  <Progress value={100} aria-label="Studio pipeline coverage" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-2">
              {STAGES.map((stage) => {
                const Icon = stage.icon;
                const active = selectedStage === stage.id;
                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => setSelectedStage(stage.id)}
                    className={`rounded-3xl border p-5 text-left transition ${active ? 'border-white/20 bg-white/[0.06] shadow-[0_18px_50px_-40px_rgba(255,255,255,0.35)]' : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'}`}
                    data-testid={`studio-stage-${stage.id}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] ${stage.accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-sm font-semibold text-white">{stage.title}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{stage.subtitle}</div>
                      </div>
                      {active ? <Badge className="border-white/15 bg-white/10 text-white">active</Badge> : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-300">{stage.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Tabs defaultValue="commands" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 bg-zinc-950/70">
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
              <TabsTrigger value="resolve">Resolve handoff</TabsTrigger>
              <TabsTrigger value="tests">Tests</TabsTrigger>
            </TabsList>

            <TabsContent value="commands">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Primary action command</CardTitle>
                  <CardDescription>Az aktualis stagehez egyetlen primary action tartozik. Innen indul a CLI vagy az automation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-3xl border border-fuchsia-400/15 bg-fuchsia-400/5 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-fuchsia-300">Selected stage</div>
                    <div className="text-sm font-medium text-white">{selectedStage === 'full' ? 'Full pipeline' : STAGES.find((stage) => stage.id === selectedStage)?.title}</div>
                  </div>
                  <pre className="overflow-x-auto rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-100" data-testid="studio-command-preview">{selectedCommand}</pre>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="bg-fuchsia-600 hover:bg-fuchsia-500" onClick={() => setSelectedStage('full')}>Full pipeline</Button>
                    <Button type="button" variant="outline" className="border-white/10 text-zinc-200 hover:bg-white/[0.05]" onClick={() => setSelectedStage('probe')}>Probe first</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliverables">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Delivery surface</CardTitle>
                  <CardDescription>Az uj funkcioknak dedikalt helye van: manifestek, render targetek, es QC outputok egy blokkon belul jelennek meg.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Manifest JSON</div>
                    <div className="mt-3 text-sm text-white">{manifestDir}\\timeline-plan.json</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Primary export</div>
                    <div className="mt-3 text-sm text-white">{outputRoot}\\{safeProjectName}-{preset}.mp4</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">QC artifact</div>
                    <div className="mt-3 text-sm text-white">{outputRoot}\\{safeProjectName}-{preset}.mp4.qc.json</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="resolve">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Resolve handoff lane</CardTitle>
                  <CardDescription>Az automation nem rejti el a finishing lepest: a Resolve bridge expliciten kulon workflow-kent jelenik meg.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4 text-sm text-zinc-200">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Bridge commands</div>
                    <ul className="mt-3 space-y-2 list-disc pl-5">
                      <li>create_or_open_project</li>
                      <li>create_bins</li>
                      <li>import_media</li>
                      <li>create_timeline</li>
                      <li>append_clips</li>
                      <li>add_markers</li>
                      <li>queue_render</li>
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-200">
                    <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Manual prerequisite</div>
                    <p className="mt-3 leading-6">Resolve install + scripting env (`DAVINCI_RESOLVE_SCRIPT_API_PATH`, `DAVINCI_RESOLVE_PYTHON_SITE_PACKAGES`) kell a finishing lane aktivalasahoz.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tests">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Test coverage</CardTitle>
                  <CardDescription>Minden uj feluleti es studio pipeline funkciohoz lathato tesztparok tartoznak.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-zinc-200">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-medium text-white">Dashboard UI</div>
                      <div className="mt-2 text-zinc-400">src/dashboard/components/dashboard/BrunellaStudio.test.tsx</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="font-medium text-white">Studio backend / e2e</div>
                      <div className="mt-2 text-zinc-400">test/studio/ffmpegTool.test.ts, resolveBridgeTool.test.ts, e2e.test.ts</div>
                    </div>
                  </div>
                  <pre className="overflow-x-auto rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-100" data-testid="studio-test-command">npx vitest run src/dashboard/components/dashboard/BrunellaStudio.test.tsx test/studio/ffmpegTool.test.ts test/studio/resolveBridgeTool.test.ts test/studio/e2e.test.ts</pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
