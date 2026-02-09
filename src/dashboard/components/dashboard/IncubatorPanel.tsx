import { useState, useEffect } from 'react';
import { 
    Flask, 
    Database, 
    Cpu, 
    ArrowRight, 
    CheckCircle, 
    Warning, 
    Play, 
    FileCode, 
    Plus,
    History,
    Activity
} from '@phosphor-icons/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { addGoldSample, getIncubatorStats, type DatasetStats } from '@/lib/apiService';

export function IncubatorPanel() {
    const [stats, setStats] = useState<DatasetStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    
    // Form state
    const [prompt, setPrompt] = useState('');
    const [completion, setCompletion] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const fetchStats = async () => {
        try {
            const data = await getIncubatorStats();
            setStats(data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, []);

    const handleSaveSample = async () => {
        if (!prompt || !completion) {
            toast.error('Minden mezőt ki kell tölteni!');
            return;
        }

        setIsSaving(true);
        try {
            await addGoldSample(prompt, completion, 'manual', 1.0);
            toast.success('„Arany Minta” sikeresen elmentve!');
            setPrompt('');
            setCompletion('');
            fetchStats();
        } catch (e: any) {
            toast.error('Hiba a mentés során: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-space font-bold text-foreground flex items-center gap-3">
                        <Flask className="text-primary" />
                        Green Lightning Incubator
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        AI modellek finomhangolása és az „Arany Adatkészlet” (Golden Dataset) karbantartása.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchStats} className="gap-2">
                        <History /> Frissítés
                    </Button>
                    <Button className="gap-2 bg-primary hover:bg-primary/80">
                        <Play weight="fill" /> Training indítása
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Stats Cards */}
                <Card className="glass-card border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                            <Database size={16} className="text-cyan-400" />
                            Arany Adatkészlet
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-space font-bold">
                            {loading ? '...' : stats?.total_samples || 0}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Validált tanító minta összesen</p>
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                            <CheckCircle size={16} className="text-green-400" />
                            Átlagos Minőség
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-4xl font-space font-bold">
                            {loading ? '...' : `${((stats?.avg_quality || 0) * 100).toFixed(1)}%`}
                        </div>
                        <Progress value={(stats?.avg_quality || 0) * 100} className="h-1 mt-3" />
                    </CardContent>
                </Card>

                <Card className="glass-card border-white/10">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-mono uppercase text-muted-foreground flex items-center gap-2">
                            <Cpu size={16} className="text-yellow-400" />
                            Hardware Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-space font-bold text-green-500 flex items-center gap-2">
                            RTX 3060 Ready
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 font-mono uppercase">
                            VRAM: 12GB Available | Unsloth: Aktív
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="bg-muted/30 border border-white/10 p-1">
                    <TabsTrigger value="overview" className="gap-2">
                        <Activity size={16} /> Áttekintés
                    </TabsTrigger>
                    <TabsTrigger value="harvest" className="gap-2">
                        <Plus size={16} /> Minta Felvétel
                    </TabsTrigger>
                    <TabsTrigger value="config" className="gap-2">
                        <FileCode size={16} /> Modelfile
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="mt-6 space-y-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Tanítási Napló</CardTitle>
                            <CardDescription>A legutóbbi finomhangolási ciklusok eredményei.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col items-center justify-center p-12 bg-black/20 rounded-xl border border-dashed border-white/10">
                                <History size={48} className="text-muted-foreground opacity-20 mb-4" />
                                <p className="text-muted-foreground italic">Még nem történt finomhangolás ezzel az „Arany Adatkészlettel”.</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="harvest" className="mt-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Manuális Adatbevitel</CardTitle>
                            <CardDescription>
                                Adj hozzá egy sikeres interakciót az Arany Adatkészlethez. Ezeket later az Unsloth fogja feldolgozni.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Prompt (Felhasználói kérés)</label>
                                <textarea 
                                    className="w-full min-h-[100px] bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Írd be a mintát..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Kívánt Válasz (AI válasz)</label>
                                <textarea 
                                    className="w-full min-h-[150px] bg-black/40 border border-white/10 rounded-lg p-3 text-sm font-mono focus:ring-1 focus:ring-primary outline-none"
                                    placeholder="Írd be a helyes AI választ..."
                                    value={completion}
                                    onChange={(e) => setCompletion(e.target.value)}
                                />
                            </div>
                            <Button 
                                onClick={handleSaveSample} 
                                disabled={isSaving || !prompt || !completion}
                                className="w-full gap-2"
                            >
                                <CheckCircle size={18} />
                                {isSaving ? 'Mentés...' : 'Mentés az Arany Adatkészletbe'}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="config" className="mt-6">
                    <Card className="glass-card">
                        <CardHeader>
                            <CardTitle>Ollama Modelfile Template</CardTitle>
                            <CardDescription>A tanítás után generált modell alapértelmezett konfigurációja.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <pre className="p-4 bg-black/60 rounded-lg overflow-x-auto text-xs font-mono text-cyan-400 border border-white/5">
{`FROM lora_output.gguf
TEMPLATE """{{ if .System }}<|im_start|>system
{{ .System }}<|im_end|>
{{ end }}{{ if .Prompt }}<|im_start|>user
{{ .Prompt }}<|im_end|>
{{ end }}<|im_start|>assistant
{{ .Response }}<|im_end|>"""
PARAMETER stop "<|im_start|>"
PARAMETER stop "<|im_end|>"`}
                            </pre>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
