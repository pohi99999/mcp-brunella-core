import { useState } from 'react';
import { knowledgeService } from '@/lib/knowledgeService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Books, MagnifyingGlass } from '@phosphor-icons/react';

export function KnowledgeBase() {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;
        
        setSearching(true);
        try {
            const data = await knowledgeService.semanticSearch(query);
            setResults(data);
        } catch (e) {
            console.error(e);
        } finally {
            setSearching(false);
        }
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Books size={24} /> Knowledge Base (RAG)
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                    <Input 
                        value={query} 
                        onChange={e => setQuery(e.target.value)} 
                        placeholder="Search semantic knowledge..." 
                    />
                    <Button type="submit" disabled={searching}>
                        <MagnifyingGlass size={18} />
                        {searching ? "Searching..." : "Search"}
                    </Button>
                </form>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {results.map((result, idx) => (
                        <Card key={idx} className="p-4 bg-muted/20">
                            <div className="font-semibold text-sm mb-1">{result.path}</div>
                            <div className="text-sm text-muted-foreground line-clamp-3">
                                {result.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-2">
                                Score: {result.score?.toFixed(4)}
                            </div>
                        </Card>
                    ))}
                    {results.length === 0 && !searching && query && (
                        <div className="text-center text-muted-foreground">No results found.</div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
