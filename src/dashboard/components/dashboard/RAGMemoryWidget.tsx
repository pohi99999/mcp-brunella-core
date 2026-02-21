import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, Database, CloudCog } from 'lucide-react';

interface RAGResult {
  text: string;
  path?: string;
  score?: number;
}

export function RAGMemoryWidget() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RAGResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<{ rowCount: number; provider: string } | null>(null);

  const loadStats = async () => {
    try {
      const response = await fetch('/api/rag/stats');
      const data = await response.json();
      setStats(data);
    } catch (e) {
      console.error('RAG stats betöltési hiba:', e);
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/rag/query?query=${encodeURIComponent(query)}&limit=5`);
      const data = await response.json();
      setResults(data.results || []);
    } catch (e) {
      console.error('RAG keresési hiba:', e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Database className="w-5 h-5" />
          RAG Memória
          <Button
            variant="ghost"
            size="sm"
            onClick={loadStats}
            className="ml-auto"
          >
            <CloudCog className="w-4 h-4" />
          </Button>
        </CardTitle>
        {stats && (
          <p className="text-sm text-muted-foreground">
            {stats.rowCount.toLocaleString()} dokumentum ({stats.provider})
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        <div className="flex gap-2">
          <Input
            placeholder="Keresés a memóriában..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={loading}
          />
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {loading && (
            <div className="text-center text-muted-foreground py-8">
              Keresés folyamatban...
            </div>
          )}

          {!loading && results.length === 0 && query && (
            <div className="text-center text-muted-foreground py-8">
              Nincs találat a keresésre: "{query}"
            </div>
          )}

          {!loading && results.length === 0 && !query && (
            <div className="text-center text-muted-foreground py-8">
              Írj be egy keresési kifejezést
            </div>
          )}

          {results.map((result, idx) => (
            <div
              key={idx}
              className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
            >
              <p className="text-sm line-clamp-3">{result.text}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                {result.path && <span>📄 {result.path}</span>}
                {result.score !== undefined && (
                  <span className="ml-auto">
                    Score: {result.score.toFixed(3)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
