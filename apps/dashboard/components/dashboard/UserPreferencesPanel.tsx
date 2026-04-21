/**
 * User Preferences Panel — Dashboard komponens felhasználói preferenciák kezeléséhez
 */
import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useSocket } from "../../context/SocketContext";

interface Preference {
  id: number;
  key: string;
  value: string;
  memory_type: string;
  category: string;
  confidence: number;
  source_agent: string;
  access_count: number;
  updated_at: string;
}

interface PreferenceStats {
  total: number;
  by_type: Record<string, number>;
  by_category: Record<string, number>;
  top_accessed?: Array<{ key: string; access_count: number }>;
}

export function UserPreferencesPanel() {
  const { t } = useTranslation();
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [stats, setStats] = useState<PreferenceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("default");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"list" | "add" | "context">("list");
  const { socket } = useSocket();

  // Új preferencia form
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState("semantic");
  const [newTtl, setNewTtl] = useState(0);
  const [contextText, setContextText] = useState("");

  const MEMORY_TYPE_LABELS: Record<string, { emoji: string; label: string }> = {
    semantic: { emoji: "📚", label: t("preferences.types.semantic") },
    episodic: { emoji: "📖", label: t("preferences.types.episodic") },
    procedural: { emoji: "⚙️", label: t("preferences.types.procedural") },
  };

  const fetchPreferences = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/v1/preferences/${userId}?limit=50`;
      if (typeFilter) url += `&memory_type=${typeFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setPreferences(data.preferences || []);
    } catch {
      setPreferences([]);
    } finally {
      setLoading(false);
    }
  }, [userId, typeFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/preferences/stats/${userId}`);
      const data = await res.json();
      setStats(data.stats || null);
      setContextText(data.context || "");
    } catch {
      setStats(null);
    }
  }, [userId]);

  useEffect(() => {
    fetchPreferences();
    fetchStats();
  }, [fetchPreferences, fetchStats]);

  // Real-time WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const onChange = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if (payload.userId === userId || payload.userId === "system") {
        fetchPreferences();
        fetchStats();
      }
    };

    const onStats = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const payload = data as Record<string, unknown>;
      if (payload.userId === userId && payload.stats) {
        setStats(payload.stats as PreferenceStats);
      }
    };

    socket.on("preferences:change", onChange);
    socket.on("preferences:stats", onStats);

    return () => {
      socket.off("preferences:change", onChange);
      socket.off("preferences:stats", onStats);
    };
  }, [socket, userId, fetchPreferences, fetchStats]);

  const handleSave = async () => {
    if (!newKey.trim() || !newValue.trim()) return;
    try {
      await fetch("/api/v1/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          key: newKey,
          value: newValue,
          memory_type: newType,
          ttl_days: newTtl > 0 ? newTtl : undefined,
        }),
      });
      setNewKey("");
      setNewValue("");
      setNewTtl(0);
      fetchPreferences();
      fetchStats();
    } catch (e) {
      // silent
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await fetch(`/api/v1/preferences/${userId}/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      fetchPreferences();
      fetchStats();
    } catch {
      // silent
    }
  };

  const handlePurge = async () => {
    try {
      const res = await fetch("/api/v1/preferences/purge", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchPreferences();
        fetchStats();
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="space-y-4 p-4">
      {/* Header + Statisztikák */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            🧠 {t("preferences.title")}
            {stats && (
              <span className="ml-auto text-xs text-zinc-400">
                {t("preferences.total_prefs", { count: stats.total })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            {/* User ID input */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">{t("preferences.user_label")}:</label>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white w-32"
              />
            </div>
            {/* Típus szűrő */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-400">{t("preferences.type_label")}:</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
              >
                <option value="">{t("preferences.all")}</option>
                <option value="semantic">📚 {t("preferences.types.semantic")}</option>
                <option value="episodic">📖 {t("preferences.types.episodic")}</option>
                <option value="procedural">⚙️ {t("preferences.types.procedural")}</option>
              </select>
            </div>
            {/* Stats badges */}
            {stats?.by_type && (
              <div className="flex gap-2 ml-auto">
                {Object.entries(stats.by_type).map(([type, count]) => (
                  <span
                    key={type}
                    className="text-xs px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300"
                  >
                    {MEMORY_TYPE_LABELS[type]?.emoji || "📝"} {count}
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tab választó */}
      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === "list" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => setActiveTab("list")}
        >
          📋 {t("preferences.tabs.list")}
        </button>
        <button
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === "add" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => setActiveTab("add")}
        >
          ➕ {t("preferences.tabs.add")}
        </button>
        <button
          className={`px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === "context" ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => { setActiveTab("context"); fetchStats(); }}
        >
          🤖 {t("preferences.tabs.context")}
        </button>
        <button
          className="ml-auto px-3 py-2 rounded text-xs bg-red-900/30 text-red-400 hover:bg-red-900/50 transition-colors"
          onClick={handlePurge}
        >
          🗑️ {t("preferences.purge_expired")}
        </button>
      </div>

      {/* Lista tab */}
      {activeTab === "list" && (
        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <p className="text-sm text-zinc-400">{t("preferences.loading")}</p>
            ) : preferences.length === 0 ? (
              <p className="text-sm text-zinc-400">{t("preferences.no_preferences")}</p>
            ) : (
              <div className="space-y-2">
                {preferences.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start gap-3 p-3 bg-zinc-900/50 rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
                  >
                    <span className="text-lg mt-0.5">
                      {MEMORY_TYPE_LABELS[p.memory_type]?.emoji || "📝"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-blue-400">
                          {p.key}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                          {p.memory_type}
                        </span>
                        <span className="text-[10px] text-zinc-600">
                          {(p.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 truncate">
                        {p.value}
                      </p>
                      <p className="text-[10px] text-zinc-600 mt-1">
                        {new Date(p.updated_at).toLocaleString("hu-HU")} · {t("preferences.access_count", { count: p.access_count })} · {t("preferences.source_agent")}: {p.source_agent}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(p.key)}
                      className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded hover:bg-red-900/20"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Új preferencia tab */}
      {activeTab === "add" && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t("preferences.form.key")}</label>
              <input
                type="text"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder={t("preferences.form.key_placeholder")}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 block mb-1">{t("preferences.form.value")}</label>
              <textarea
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder={t("preferences.form.value_placeholder")}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-y"
              />
            </div>
            <div className="flex gap-4">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{t("preferences.form.memory_type")}</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                >
                  <option value="semantic">📚 {t("preferences.types.semantic")}</option>
                  <option value="episodic">📖 {t("preferences.types.episodic")}</option>
                  <option value="procedural">⚙️ {t("preferences.types.procedural")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 block mb-1">{t("preferences.form.ttl_days")}</label>
                <input
                  type="number"
                  value={newTtl}
                  onChange={(e) => setNewTtl(parseInt(e.target.value) || 0)}
                  min={0}
                  className="w-24 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                />
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={!newKey.trim() || !newValue.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💾 {t("preferences.form.save")}
            </button>
          </CardContent>
        </Card>
      )}

      {/* LLM kontextus tab */}
      {activeTab === "context" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🤖 {t("preferences.context_title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500 mb-3">
              {t("preferences.context_desc")}
            </p>
            {contextText ? (
              <pre className="bg-zinc-900 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap max-h-96 overflow-auto">
                {contextText}
              </pre>
            ) : (
              <p className="text-sm text-zinc-400">
                {t("preferences.no_context")}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
