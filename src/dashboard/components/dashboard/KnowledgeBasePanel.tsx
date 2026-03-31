import { useState, useEffect } from 'react'
import { Database, Search, Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { API_BASE } from '@/lib/apiService'

interface RagStats {
    table: string;
    provider: string;
    status: string;
}

interface SearchResult {
    text: string;
    path?: string;
    score?: number;
}

export function KnowledgeBasePanel() {
    const [stats, setStats] = useState<RagStats | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isIngesting, setIsIngesting] = useState(false)
    const [rowCount, setRowCount] = useState(0)
    const [query, setQuery] = useState('')
    const [isSearching, setIsSearching] = useState(false)
    const [results, setResults] = useState<SearchResult[]>([])

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`${API_BASE}/api/rag/stats`)
            const data = await response.json()
            setStats(data)
            setRowCount(data.rowCount || 0)
        } catch (error) {
            toast.error('Hiba a RAG statisztikák betöltésekor')
        } finally {
            setIsLoading(false)
        }
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setIsIngesting(true)
        const reader = new FileReader()

        reader.onload = async (event) => {
            const text = event.target?.result as string
            if (!text) {
                toast.error('Gond adódott a fájl beolvasása közben')
                setIsIngesting(false)
                return
            }

            try {
                toast.info(`${file.name} indexelése folyamatban...`)
                const response = await fetch(`${API_BASE}/api/rag/ingest`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text,
                        metadata: {
                            path: file.name,
                            size: file.size,
                            type: file.type || 'text/plain'
                        }
                    })
                })

                if (response.ok) {
                    toast.success(`${file.name} sikeresen beindexelve!`)
                    fetchStats()
                } else {
                    toast.error('Sikertelen indexelés')
                }
            } catch (error) {
                toast.error('Hálózati hiba az indexelés során')
            } finally {
                setIsIngesting(false)
            }
        }

        reader.onerror = () => {
            toast.error('Hiba a fájl olvasásakor')
            setIsIngesting(false)
        }

        reader.readAsText(file)
    }

    const handleSearch = async () => {
        if (!query.trim()) return
        setIsSearching(true)
        try {
            const response = await fetch(`${API_BASE}/api/rag/query?query=${encodeURIComponent(query)}`)
            const data = await response.json()
            setResults(data.results || [])
            if (data.results?.length === 0) {
                toast.info('Nincs találat a tudásbázisban')
            }
        } catch (error) {
            toast.error('Hiba a keresés során')
        } finally {
            setIsSearching(false)
        }
    }

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-end justify-between gap-4">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">Semantic memory</p>
                    <h1 className="text-2xl font-semibold text-zinc-100">Knowledge Base</h1>
                    <p className="text-zinc-500">
                        Brunella szemantikus memóriájának (RAG) kezelése és vizualizációja.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchStats} disabled={isLoading} className="rounded-full border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]">
                        <CheckCircle2 className={`w-4 h-4 mr-2 ${stats?.status === 'online' ? 'text-emerald-300' : 'text-zinc-500'}`} />
                        {stats?.provider || 'LanceDB'} {stats?.status || 'Offline'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="glass-card border-white/10 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400">Bejegyzések Száma</CardTitle>
                        <Database className="h-4 w-4 text-cyan-300" />
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="text-2xl font-semibold font-mono text-zinc-100">{rowCount}</div>
                        <p className="text-xs text-zinc-500">Szemantikus vektor tároló ({stats?.table || 'memory'})</p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-white/10 overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b border-white/[0.05] bg-white/[0.015]">
                        <CardTitle className="text-[10px] font-mono font-semibold uppercase tracking-[0.24em] text-zinc-400">Ingestion</CardTitle>
                        <Upload className="h-4 w-4 text-violet-300" />
                    </CardHeader>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <Input
                                id="rag-file-upload"
                                type="file"
                                className="hidden"
                                accept=".txt,.md,.log,.json,.ts,.js,.py"
                                onChange={handleFileUpload}
                                disabled={isIngesting}
                            />
                            <Button
                                variant="outline"
                                className="w-full rounded-xl border-white/10 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.05]"
                                onClick={() => document.getElementById('rag-file-upload')?.click()}
                                disabled={isIngesting}
                            >
                                {isIngesting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="h-4 h-4 mr-2" />}
                                Fájl feltöltése
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="glass-card border-white/10 overflow-hidden col-span-3">
                <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015]">
                    <CardTitle className="text-[11px] font-mono font-semibold uppercase tracking-[0.28em] text-zinc-400">Szemantikus Keresés</CardTitle>
                    <CardDescription className="text-zinc-500">
                        Keress a beindexelt dokumentumok között természetes nyelven.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 p-4 lg:p-5">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Mire emlékszik Brunella?..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            className="rounded-xl border-white/10 bg-white/[0.03] text-zinc-100 placeholder:text-zinc-500"
                        />
                        <Button onClick={handleSearch} disabled={isSearching} className="rounded-xl bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            Keresés
                        </Button>
                    </div>

                    <ScrollArea className="h-[400px] rounded-xl border border-white/[0.05] bg-white/[0.015] p-4">
                        {results.length > 0 ? (
                            <div className="space-y-4">
                                {results.map((res, idx) => (
                                    <div key={idx} className="space-y-2 rounded-xl border border-white/[0.05] bg-white/[0.02] p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-cyan-300" />
                                                <span className="text-sm font-semibold text-zinc-100">{res.path || 'Unknown Source'}</span>
                                            </div>
                                            {res.score !== undefined && (
                                                <Badge variant="secondary" className="bg-cyan-500/15 text-cyan-100 border border-cyan-400/20">Dist: {res.score.toFixed(4)}</Badge>
                                            )}
                                        </div>
                                        <p className="border-l-2 border-cyan-400/30 pl-3 text-sm leading-relaxed italic text-zinc-200">
                                            "{res.text}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-zinc-500 py-10">
                                <Search className="w-10 h-10 mb-4 opacity-20" />
                                <p>Nincsenek aktív keresési találatok</p>
                            </div>
                        )}
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    )
}
