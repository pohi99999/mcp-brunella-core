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
            const response = await fetch(`${API_BASE}/rag/stats`)
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
                const response = await fetch(`${API_BASE}/rag/ingest`, {
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
            const response = await fetch(`${API_BASE}/rag/query?query=${encodeURIComponent(query)}`)
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
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
                    <p className="text-muted-foreground">
                        Brunella szemantikus memóriájának (RAG) kezelése és vizualizációja.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchStats} disabled={isLoading}>
                        <CheckCircle2 className={`w-4 h-4 mr-2 ${stats?.status === 'online' ? 'text-green-500' : ''}`} />
                        {stats?.provider || 'LanceDB'} {stats?.status || 'Offline'}
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Bejegyzések Száma</CardTitle>
                        <Database className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{rowCount}</div>
                        <p className="text-xs text-muted-foreground">Szemantikus vektor tároló ({stats?.table || 'memory'})</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ingestion</CardTitle>
                        <Upload className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
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
                                className="w-full"
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

            <Card className="col-span-3">
                <CardHeader>
                    <CardTitle>Szemantikus Keresés</CardTitle>
                    <CardDescription>
                        Keress a beindexelt dokumentumok között természetes nyelven.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Mire emlékszik Brunella?..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                        <Button onClick={handleSearch} disabled={isSearching}>
                            {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            Keresés
                        </Button>
                    </div>

                    <ScrollArea className="h-[400px] rounded-md border p-4">
                        {results.length > 0 ? (
                            <div className="space-y-4">
                                {results.map((res, idx) => (
                                    <div key={idx} className="p-3 rounded-lg bg-muted/50 border border-border space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <FileText className="w-4 h-4 text-primary" />
                                                <span className="text-sm font-semibold">{res.path || 'Unknown Source'}</span>
                                            </div>
                                            {res.score !== undefined && (
                                                <Badge variant="secondary">Dist: {res.score.toFixed(4)}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-foreground leading-relaxed italic border-l-2 border-primary/30 pl-3">
                                            "{res.text}"
                                        </p>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
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
