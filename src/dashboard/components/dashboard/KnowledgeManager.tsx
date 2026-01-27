import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, MagnifyingGlass, HardDrive, CheckCircle, Warning } from '@phosphor-icons/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMCP } from '@/hooks/useMCP';
import { io } from 'socket.io-client';

export const KnowledgeManager: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [status, setStatus] = useState<any>(null);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        const socket = io('http://localhost:3000');
        
        socket.emit('knowledge:status');
        
        socket.on('knowledge:status_result', (data) => setStatus(data));
        socket.on('knowledge:search_results', (data) => {
            setResults(data);
            setIsSearching(false);
        });

        return () => { socket.disconnect(); };
    }, []);

    const handleSearch = () => {
        if (!query.trim()) return;
        setIsSearching(true);
        const socket = io('http://localhost:3000');
        socket.emit('knowledge:search', query);
        socket.disconnect(); // Temporary connection for search or use existing
    };

    return (
        <Card className="w-full h-full flex flex-col min-h-[600px]">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Database size={24} className="text-primary" />
                        <div>
                            <CardTitle>AnythingLLM / LanceDB Tudásmenedzser</CardTitle>
                            <CardDescription>Kezeld a dokumentumokat, vektoros indexeket és a kontextust.</CardDescription>
                        </div>
                    </div>
                    {status && (
                        <div className="flex gap-2">
                            <Badge variant="outline" className="flex gap-1 items-center">
                                <HardDrive size={14} /> DB: {status.db}
                            </Badge>
                            <Badge variant="outline" className={`flex gap-1 items-center ${status.ollama === 'online' ? 'text-green-500' : 'text-red-500'}`}>
                                {status.ollama === 'online' ? <CheckCircle size={14} /> : <Warning size={14} />} 
                                Ollama: {status.ollama}
                            </Badge>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlass size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input 
                            value={query} 
                            onChange={(e) => setQuery(e.target.value)} 
                            placeholder="Keresés a tudásbázisban..." 
                            className="pl-10"
                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        />
                    </div>
                    <Button onClick={handleSearch} disabled={isSearching}>
                        {isSearching ? 'Keresés...' : 'Keresés'}
                    </Button>
                </div>

                <div className="flex-1 overflow-auto space-y-3 p-1">
                    {results.length > 0 ? (
                        results.map((res, i) => (
                            <div key={i} className="p-3 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant="secondary" className="text-[10px]">Doc</Badge>
                                    <span className="text-sm font-medium truncate">{res.path}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-3">{res.content}</p>
                                <div className="mt-2 text-[10px] text-muted-foreground flex justify-end italic">
                                    Score: {(1 - res._distance).toFixed(4)}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Database size={48} weight="thin" className="mb-2 opacity-20" />
                            <p>Nincs találat vagy még nem indítottál keresést.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
