import React, { useState, useEffect } from 'react';
import { 
    Code2, 
    MonitorPlay, 
    FileJson, 
    Layout, 
    Smartphone, 
    Globe, 
    Cpu, 
    Play, 
    Save, 
    History,
    ChevronRight,
    Loader2,
    CheckCircle2,
    Eye,
    Plus,
    Box
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';

export function BrunellaStudio() {
    const [isCreating, setIsCreating] = useState(false);
    const [projectDesc, setProjectDescription] = useState('');
    const [projectName, setProjectName] = useState('');
    const [techStack, setTechStack] = useState('React + Tailwind');
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [studioLogs, setStudioLogs] = useState<Record<string, string[]>>({});
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [iterationPrompt, setIterationPrompt] = useState('');
    const [isIterating, setIsIteration] = useState(false);
    const { socket } = useSocket();

    useEffect(() => {
        // Fetch existing projects
        fetch('/api/v1/studio/projects')
            .then(res => res.json())
            .then(data => {
                if (data.success) setProjects(data.projects);
            });
    }, []);

    useEffect(() => {
        if (!socket) return;

        const handleStudioLog = (data: { projectId: string, line: string, type: string }) => {
            setStudioLogs(prev => ({
                ...prev,
                [data.projectId]: [...(prev[data.projectId] || []), data.line].slice(-200)
            }));
        };

        const handleStudioReady = (data: { projectId: string, url: string }) => {
            setProjects(prev => prev.map(p => 
                p.id === data.projectId ? { ...p, status: 'coding', preview_url: data.url } : p
            ));
            toast.success(`Alkalmazás Előnézet Kész: ${data.projectId}`);
        };

        socket.on('studio:log', handleStudioLog);
        socket.on('studio:ready', handleStudioReady);

        return () => {
            socket.off('studio:log', handleStudioLog);
            socket.off('studio:ready', handleStudioReady);
        };
    }, [socket]);

    const handleCreateProject = async () => {
        if (!projectDesc.trim() || !projectName.trim()) {
            toast.error("Kérlek add meg a nevet és a leírást!");
            return;
        }

        setIsCreating(true);
        toast.info("Projekt inicializálása... Ágensek felkészítése.");

        try {
            const res = await fetch('/api/v1/studio/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: projectName, 
                    description: projectDesc, 
                    tech_stack: techStack 
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Projekt létrehozva! A kódolás elindul a háttérben.");
                setProjects(prev => [data.project, ...prev]);
                setSelectedProjectId(data.project.id);
                setProjectDescription('');
                setProjectName('');
            }
        } catch (err) {
            toast.error("Hiba történt a projekt indításakor.");
        } finally {
            setIsCreating(false);
        }
    };

    const handleIterate = async () => {
        if (!iterationPrompt.trim() || !selectedProjectId) return;

        setIsIteration(true);
        toast.info("Változtatások alkalmazása...");

        try {
            const res = await fetch(`/api/v1/studio/projects/${selectedProjectId}/iterate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instruction: iterationPrompt })
            });
            if (res.ok) {
                toast.success("Ágensek dolgoznak a módosításon.");
                setIterationPrompt('');
            }
        } catch (err) {
            toast.error("Hiba az iteráció során.");
        } finally {
            setIsIteration(false);
        }
    };

    const activeProject = projects.find(p => p.id === selectedProjectId) || projects[0];

    return (
        <div className="flex flex-col gap-6 h-[calc(100vh-120px)]">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3 font-mono">
                        <Code2 className="w-8 h-8 text-emerald-500" />
                        BRUNELLA STUDIO
                    </h1>
                    <p className="text-zinc-500">Full-stack alkalmazásfejlesztés & Marketing Preview</p>
                </div>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-mono">AGENT_MODE: ACTIVE</Badge>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-mono">PREVIEW_ENGINE: READY</Badge>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 overflow-hidden">
                {/* Bal szekció: Projektek & Chat */}
                <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
                    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm flex items-center gap-2 font-mono uppercase tracking-widest">
                                <Plus className="w-4 h-4" /> Új Alkalmazás
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <Input 
                                placeholder="App neve (pl. DreamFisher Webshop)" 
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                className="bg-white/[0.02] border-white/10"
                            />
                            <Textarea 
                                placeholder="Írd le pontosan, mit szeretnél fejleszteni..." 
                                value={projectDesc}
                                onChange={(e) => setProjectDescription(e.target.value)}
                                className="bg-white/[0.02] border-white/10 min-h-[100px]"
                            />
                            <div className="grid grid-cols-2 gap-2">
                                <Button 
                                    variant="outline" 
                                    className="text-xs h-8"
                                    onClick={() => setTechStack('React + Tailwind')}
                                >
                                    Web (React)
                                </Button>
                                <Button 
                                    variant="outline" 
                                    className="text-xs h-8"
                                    onClick={() => setTechStack('Expo/React Native')}
                                >
                                    Mobil (App)
                                </Button>
                            </div>
                            <Button 
                                onClick={handleCreateProject} 
                                disabled={isCreating}
                                className="w-full bg-emerald-600 hover:bg-emerald-500 font-bold"
                            >
                                {isCreating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                                Fejlesztés Indítása
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="glass-card border-white/10 overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)] flex-1">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs font-mono uppercase text-zinc-500">Korábbi Projektek</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden flex flex-col">
                            <ScrollArea className="flex-1">
                                <div className="p-4 space-y-2">
                                    {projects.map((p) => (
                                        <div 
                                            key={p.id}
                                            onClick={() => setSelectedProjectId(p.id)}
                                            className={`p-3 rounded-xl border cursor-pointer transition-all ${
                                                selectedProjectId === p.id 
                                                    ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                                    : 'bg-white/[0.04] border-transparent hover:border-white/10'
                                            }`}
                                        >
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="font-bold text-xs text-white">{p.name}</span>
                                                <Badge className="text-[9px] h-4">{p.status.toUpperCase()}</Badge>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 font-mono italic truncate">{p.tech_stack}</div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Középső & Jobb szekció: Kód & Preview */}
                <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden">
                    <Tabs defaultValue="preview" className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <TabsList className="bg-white/[0.02] border border-white/[0.04] p-1 h-10">
                                <TabsTrigger value="preview" className="data-[state=active]:bg-emerald-600 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                    <MonitorPlay className="w-4 h-4" /> Live Preview
                                </TabsTrigger>
                                <TabsTrigger value="code" className="data-[state=active]:bg-blue-600 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                    <FileJson className="w-4 h-4" /> Code Stream
                                </TabsTrigger>
                                <TabsTrigger value="architecture" className="data-[state=active]:bg-purple-600 flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
                                    <Box className="w-4 h-4" /> Specs
                                </TabsTrigger>
                            </TabsList>
                            {activeProject && (
                                <div className="flex items-center gap-4 text-xs font-mono">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                                        <span className="text-emerald-500">AKTÍV KÓDOLÁS</span>
                                    </div>
                                    <div className="text-zinc-500">{activeProject.root_dir}</div>
                                </div>
                            )}
                        </div>

                        <TabsContent value="preview" className="flex-1 mt-0 glass-card border-white/10 rounded-3xl overflow-hidden relative group shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
                            {activeProject?.preview_url ? (
                                <iframe 
                                    src={activeProject.preview_url} 
                                    className="w-full h-full border-none"
                                    title="App Preview"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-4">
                                    <div className="p-6 rounded-full bg-white/[0.04] border border-white/[0.04]">
                                        <Globe className="w-12 h-12 opacity-20" />
                                    </div>
                                    <p className="text-sm font-mono uppercase tracking-widest opacity-40">Preview Engine Offline</p>
                                    <p className="text-xs text-center max-w-xs opacity-30 italic">"Indíts el egy fejlesztést, és Brunella itt fogja felépíteni neked a felületet valós időben."</p>
                                </div>
                            )}
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <Button size="sm" variant="secondary" className="rounded-full h-8 w-8 p-0"><Smartphone size={14} /></Button>
                                <Button size="sm" variant="secondary" className="rounded-full h-8 w-8 p-0"><Layout size={14} /></Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="code" className="flex-1 mt-0 glass-card border-white/10 rounded-3xl overflow-hidden p-6 font-mono text-xs shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
                            <div className="flex justify-between items-center mb-4 border-b border-white/[0.04] pb-2">
                                <span className="text-zinc-500 uppercase tracking-widest">Build & Execution Stream</span>
                                <span className="text-emerald-500/50">Live</span>
                            </div>
                            <ScrollArea className="h-[500px]">
                                <div className="space-y-1">
                                    {(studioLogs[activeProject?.id] || []).map((line, i) => (
                                        <div key={i} className="text-zinc-400 break-all whitespace-pre-wrap">{line}</div>
                                    ))}
                                    {(!studioLogs[activeProject?.id] || studioLogs[activeProject?.id].length === 0) && (
                                        <div className="text-zinc-700 italic">Várakozás a logokra...</div>
                                    )}
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="architecture" className="flex-1 mt-0">
                            <Card className="h-full bg-white/[0.02] border-white/[0.04]">
                                <CardContent className="pt-6">
                                    <div className="space-y-6">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-purple-500/10 rounded-xl"><CheckCircle2 className="w-5 h-5 text-purple-500" /></div>
                                            <div>
                                                <div className="text-sm font-bold">Adatmodell Tervezve</div>
                                                <div className="text-[10px] text-zinc-500">SQLite + Prisma séma kész</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-blue-500/10 rounded-xl"><CheckCircle2 className="w-5 h-5 text-blue-500" /></div>
                                            <div>
                                                <div className="text-sm font-bold">UI Kit Kiválasztva</div>
                                                <div className="text-[10px] text-zinc-500">Shadcn UI + Radix primitives</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 opacity-40">
                                            <div className="p-3 bg-zinc-500/10 rounded-xl"><Loader2 className="w-5 h-5 animate-spin" /></div>
                                            <div>
                                                <div className="text-sm font-bold">Marketing Pipeline</div>
                                                <div className="text-[10px] text-zinc-500">SEO kulcsszavak generálása...</div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}
