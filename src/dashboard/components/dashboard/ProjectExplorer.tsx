import { useState, useEffect } from 'react'
import { Folder, File, ArrowLeft, RefreshCw, Eye, Download, Info } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { listFiles, getFileContent, type FileInfo } from '@/lib/apiService'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'

const BASE_PATH = 'G:/Brunella/.000_PROJEKTEK';

export function ProjectExplorer() {
    const [currentPath, setCurrentPath] = useState(BASE_PATH)
    const [files, setFiles] = useState<FileInfo[]>([])
    const [loading, setLoading] = useState(true)
    const [previewContent, setPreviewContent] = useState<string | null>(null)
    const [previewFile, setPreviewFile] = useState<FileInfo | null>(null)

    const fetchFiles = async (path: string) => {
        setLoading(true)
        try {
            const data = await listFiles(path)
            // Folders first, then files
            setFiles(data.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1
                if (!a.isDirectory && b.isDirectory) return 1
                return a.name.localeCompare(b.name)
            }))
            setCurrentPath(path)
        } catch (e) {
            toast.error('Hiba a fájlok listázásakor')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchFiles(BASE_PATH)
    }, [])

    const handleFolderClick = (path: string) => {
        fetchFiles(path)
    }

    const handleBack = () => {
        // Prevent going above BASE_PATH
        if (currentPath === BASE_PATH || currentPath === 'G:\\Brunella\\.000_PROJEKTEK') {
            return;
        }
        
        const parts = currentPath.split(/["//\\]/);
        if (parts.length > 1) {
            parts.pop()
            const newPath = parts.join('/') || BASE_PATH;
            
            // Extra safety check
            if (!newPath.startsWith(BASE_PATH.replace(/\\/g, '/')) && !newPath.startsWith('G:\\Brunella\\.000_PROJEKTEK')) {
                fetchFiles(BASE_PATH);
            } else {
                fetchFiles(newPath);
            }
        } else {
            fetchFiles(BASE_PATH)
        }
    }

    const handlePreview = async (file: FileInfo) => {
        try {
            setLoading(true)
            const content = await getFileContent(file.path)
            setPreviewContent(content)
            setPreviewFile(file)
        } catch (e) {
            toast.error('Hiba a fájl beolvasásakor')
        } finally {
            setLoading(false)
        }
    }

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '-'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
    }

    const isAtRoot = currentPath.replace(/\\/g, '/') === BASE_PATH.replace(/\\/g, '/');

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={handleBack} disabled={isAtRoot}>
                        <ArrowLeft size={18} />
                    </Button>
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold tracking-tight">Projektek</h2>
                        <p className="text-xs font-mono text-muted-foreground">{currentPath}</p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => fetchFiles(currentPath)} disabled={loading}>
                    <RefreshCw size={14} className={loading ? "animate-spin mr-2" : "mr-2"} />
                    Frissítés
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
                <Card className="glass-card overflow-hidden">
                    <CardHeader className="pb-3 border-b border-border/50">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Folder size={16} className="text-primary" />
                            Tartalom
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[600px]">
                            <div className="divide-y divide-border/50">
                                {loading && files.length === 0 ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                        <div key={i} className="flex items-center gap-4 px-4 py-3">
                                            <Skeleton className="h-4 w-4" />
                                            <Skeleton className="h-4 flex-1" />
                                            <Skeleton className="h-4 w-16" />
                                        </div>
                                    ))
                                ) : (
                                    files.map((file) => (
                                        <div
                                            key={file.path}
                                            className="group flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                                            onClick={() => file.isDirectory ? handleFolderClick(file.path) : handlePreview(file)}
                                        >
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                {file.isDirectory ? (
                                                    <Folder size={18} className="text-blue-400 shrink-0" />
                                                ) : (
                                                    <File size={18} className="text-muted-foreground shrink-0" />
                                                )}
                                                <span className="text-sm font-mono truncate group-hover:text-primary transition-colors">
                                                    {file.name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                                                <span>{formatSize(file.size)}</span>
                                                {!file.isDirectory && (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Eye size={12} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                                {!loading && files.length === 0 && (
                                    <div className="p-8 text-center text-muted-foreground italic">
                                        Ez a mappa üres
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="glass-card h-fit sticky top-20">
                    <CardHeader className="pb-3 border-b border-border/50">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Info size={16} className="text-primary" />
                            Részletek / Előnézet
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        {previewFile ? (
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-sm truncate">{previewFile.name}</h3>
                                    <p className="text-[10px] font-mono text-muted-foreground break-all">{previewFile.path}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-muted/50 rounded p-2 border border-border/50">
                                        <span className="text-[9px] uppercase text-muted-foreground block">Mérete</span>
                                        <span className="text-xs font-mono">{formatSize(previewFile.size)}</span>
                                    </div>
                                    <div className="bg-muted/50 rounded p-2 border border-border/50">
                                        <span className="text-[9px] uppercase text-muted-foreground block">Módosítva</span>
                                        <span className="text-xs font-mono">{new Date(previewFile.modified).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Tartalom:</span>
                                    <div className="bg-muted/30 rounded-lg p-3 border border-border/50 max-h-[300px] overflow-auto">
                                        <pre className="text-[10px] font-mono whitespace-pre-wrap text-foreground/80">
                                            {previewContent || "Nincs megjeleníthető tartalom"}
                                        </pre>
                                    </div>
                                </div>

                                <Button className="w-full" size="sm" variant="outline" onClick={() => {
                                    if (previewFile) {
                                        const blob = new Blob([previewContent || ''], { type: 'text/plain' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = previewFile.name || 'download.txt';
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }
                                }}>
                                    <Download size={14} className="mr-2" />
                                    Letöltés
                                </Button>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground text-xs italic">
                                Válassz ki egy fájlt a részletek megtekintéséhez
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
