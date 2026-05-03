import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { BarChart3, TrendingUp, Search, Database } from 'lucide-react';

interface SearchAnalytics {
  totalSearches: number;
  averageResults: number;
  vectorizeEnabled: boolean;
  topQueries: Array<{ query: string; count: number }>;
  lastSearches: Array<{ query: string; results: number; timestamp: string }>;
}

export function VectorizeAnalyticsWidget() {
  const [analytics, setAnalytics] = useState<SearchAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/rag/analytics');
      const data = await response.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (e) {
      console.error('Analytics betöltési hiba:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-zinc-500">Statisztikák betöltése...</p>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-zinc-500">Nincs elérhető adat</p>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Vectorize Analytics
          {analytics.vectorizeEnabled && (
            <span className="ml-auto text-xs text-green-500 flex items-center gap-1">
              <Database className="w-3 h-3" />
              Active
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg bg-card">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <Search className="w-3 h-3" />
              Összes keresés
            </div>
            <div className="text-2xl font-bold">{analytics.totalSearches.toLocaleString()}</div>
          </div>

          <div className="p-3 border rounded-lg bg-card">
            <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
              <TrendingUp className="w-3 h-3" />
              Átlag találat
            </div>
            <div className="text-2xl font-bold">{analytics.averageResults.toFixed(1)}</div>
          </div>
        </div>

        {/* Top Queries */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-semibold mb-2">Top keresések</h3>
          {analytics.topQueries.length === 0 ? (
            <p className="text-sm text-zinc-500">Még nincs keresés</p>
          ) : (
            <div className="space-y-2">
              {analytics.topQueries.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 border rounded bg-card/50"
                >
                  <span className="text-sm truncate flex-1">{item.query}</span>
                  <span className="text-xs text-zinc-500 ml-2">
                    {item.count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Searches */}
        <div className="flex-1 overflow-y-auto border-t pt-3">
          <h3 className="text-sm font-semibold mb-2">Legutóbbi keresések</h3>
          {analytics.lastSearches.length === 0 ? (
            <p className="text-sm text-zinc-500">Még nincs keresés</p>
          ) : (
            <div className="space-y-1">
              {analytics.lastSearches.slice(0, 5).map((item, idx) => (
                <div
                  key={idx}
                  className="text-xs p-2 border rounded bg-card/50 flex items-center justify-between"
                >
                  <span className="truncate flex-1">{item.query}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-green-600">{item.results}</span>
                    <span className="text-zinc-500">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
