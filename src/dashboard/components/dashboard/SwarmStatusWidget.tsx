/**
 * SwarmStatusWidget — Mission Control
 *
 * Read-only status display for active swarm colonies.
 * Data source: GET /api/v1/swarm/status
 * Polling interval: 5 seconds
 */

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface ColonySummary {
  colonyId: string;
  name: string;
  status: "active" | "forming" | "paused" | "dissolved";
  agentCount: number;
  leaderId: string | null;
}

interface SwarmStatusResponse {
  colonies: ColonySummary[];
  total: number;
}

const STATUS_STYLES: Record<ColonySummary["status"], string> = {
  active: "text-green-400 bg-green-400/10",
  forming: "text-yellow-400 bg-yellow-400/10",
  paused: "text-orange-400 bg-orange-400/10",
  dissolved: "text-gray-400 bg-gray-400/10",
};

const STATUS_LABELS: Record<ColonySummary["status"], string> = {
  active: "Active",
  forming: "Forming",
  paused: "Paused",
  dissolved: "Dissolved",
};

export function SwarmStatusWidget() {
  const [data, setData] = useState<SwarmStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/v1/swarm/status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: SwarmStatusResponse = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to fetch");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const colonies = data?.colonies ?? [];

  return (
    <div className="bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-4 h-full flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-sm font-semibold text-white/70">Swarm Colonies</h3>
        <div className="flex items-center gap-2">
          {data !== null && (
            <span className="text-[10px] text-white/30 font-mono">
              {data.total} total
            </span>
          )}
          {loading && (
            <RefreshCw size={12} className="text-white/30 animate-spin" />
          )}
        </div>
      </div>

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 shrink-0">
          <p className="text-[10px] text-red-400 font-mono truncate">{error}</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && colonies.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <RefreshCw size={16} className="text-white/20 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && colonies.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-white/30">No active colonies</p>
        </div>
      )}

      {/* Colony list */}
      {colonies.length > 0 && (
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2">
          {colonies.map((colony) => (
            <div
              key={colony.colonyId}
              className="bg-white/3 border border-white/5 rounded-lg px-3 py-2 flex items-center justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white/80 truncate">
                  {colony.name}
                </p>
                <p className="text-[10px] text-white/30 font-mono truncate">
                  {colony.agentCount} agent{colony.agentCount !== 1 ? "s" : ""}
                  {colony.leaderId ? ` · leader: ${colony.leaderId.slice(0, 8)}` : ""}
                </p>
              </div>
              <span
                className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[colony.status]}`}
              >
                {STATUS_LABELS[colony.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
