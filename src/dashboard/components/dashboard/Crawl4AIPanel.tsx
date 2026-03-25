/**
 * Crawl4AI Panel — Dashboard komponens intelligens web crawlinghoz
 */
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useSocket } from "../../context/SocketContext";

interface CrawlResult {
  success: boolean;
  data?: {
    markdown?: string;
    title?: string;
    url?: string;
    status?: string;
  };
  error?: string;
  validation_warning?: string;
}

interface ServiceStatus {
  available: boolean;
  python_api: string;
  error?: string;
}

export function Crawl4AIPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrawlResult | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [batchUrls, setBatchUrls] = useState("");
  const [activeTab, setActiveTab] = useState<"single" | "batch">("single");
  const { socket } = useSocket();

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/crawl4ai/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ available: false, python_api: "N/A", error: "Nem elérhető" });
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Real-time WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const onStatus = (data: unknown) => {
      if (data && typeof data === "object" && "available" in data) {
        setStatus(data as ServiceStatus);
      }
    };

    const onProgress = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if (payload.status === "completed" || payload.status === "failed") {
        checkStatus();
      }
    };

    const onBatchProgress = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if (payload.status === "completed" || payload.status === "failed") {
        checkStatus();
      }
    };

    socket.on("crawl4ai:status", onStatus);
    socket.on("crawl4ai:progress", onProgress);
    socket.on("crawl4ai:batch-progress", onBatchProgress);

    return () => {
      socket.off("crawl4ai:status", onStatus);
      socket.off("crawl4ai:progress", onProgress);
      socket.off("crawl4ai:batch-progress", onBatchProgress);
    };
  }, [socket, checkStatus]);

  const handleCrawl = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/crawl4ai/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "Hálózati hiba" });
    } finally {
      setLoading(false);
    }
  };

  const handleBatch = async () => {
    const urls = batchUrls
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/v1/crawl4ai/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ success: false, error: e instanceof Error ? e.message : "Hálózati hiba" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Státusz kártya */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            🕷️ Crawl4AI — Intelligens Web Crawling
            <span
              className={`ml-auto text-xs px-2 py-1 rounded-full ${status?.available ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
            >
              {status?.available ? "● Elérhető" : "● Offline"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!status?.available && (
            <p className="text-sm text-zinc-400">
              Python FastAPI szerver nem elérhető. Indítsd el:{" "}
              <code className="bg-zinc-800 px-1 rounded">cd myai && uvicorn server:app --port 8000</code>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tab választó */}
      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === "single" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => setActiveTab("single")}
        >
          🔗 Egyedi Crawl
        </button>
        <button
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === "batch" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => setActiveTab("batch")}
        >
          📦 Csoportos Crawl
        </button>
      </div>

      {/* Egyedi crawl */}
      {activeTab === "single" && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                onKeyDown={(e) => e.key === "Enter" && handleCrawl()}
              />
              <button
                onClick={handleCrawl}
                disabled={loading || !url.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "⏳ Crawling..." : "🚀 Crawl"}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Csoportos crawl */}
      {activeTab === "batch" && (
        <Card>
          <CardContent className="pt-4 space-y-2">
            <textarea
              value={batchUrls}
              onChange={(e) => setBatchUrls(e.target.value)}
              placeholder={"https://example.com\nhttps://example.org\nhttps://example.net"}
              rows={5}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-y"
            />
            <button
              onClick={handleBatch}
              disabled={loading || !batchUrls.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "⏳ Batch crawling..." : "📦 Batch Crawl Indítása"}
            </button>
          </CardContent>
        </Card>
      )}

      {/* Eredmény megjelenítés */}
      {result && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {result.success ? "✅ Eredmény" : "❌ Hiba"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.error && (
              <p className="text-red-400 text-sm">{result.error}</p>
            )}
            {result.validation_warning && (
              <p className="text-yellow-400 text-sm mb-2">
                ⚠️ Validációs figyelmeztetés: {result.validation_warning}
              </p>
            )}
            {result.success && result.data && (
              <div className="space-y-2">
                {result.data.title && (
                  <p className="text-sm text-zinc-200">
                    <strong>Cím:</strong> {result.data.title}
                  </p>
                )}
                {result.data.url && (
                  <p className="text-sm text-zinc-400">
                    <strong>URL:</strong> {result.data.url}
                  </p>
                )}
                {result.data.markdown && (
                  <div className="mt-2">
                    <p className="text-xs text-zinc-500 mb-1">
                      Markdown tartalom ({result.data.markdown.length} karakter):
                    </p>
                    <pre className="bg-zinc-900 p-3 rounded text-xs text-zinc-300 overflow-auto max-h-96 whitespace-pre-wrap">
                      {result.data.markdown.substring(0, 3000)}
                      {result.data.markdown.length > 3000 && "\n\n... (csonkolva)"}
                    </pre>
                  </div>
                )}
              </div>
            )}
            {/* Batch eredmény */}
            {result.success && (result as any).data?.results && (
              <div className="space-y-1">
                {((result as any).data.results as Array<{ url: string; status: string }>).map(
                  (r: { url: string; status: string }, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className={r.status === "success" ? "text-green-400" : "text-red-400"}>
                        {r.status === "success" ? "✅" : "❌"}
                      </span>
                      <span className="text-zinc-300">{r.url}</span>
                    </div>
                  ),
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
