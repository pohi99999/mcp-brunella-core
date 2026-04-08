/**
 * TrackGenerator.tsx — SpecWriterAgent Dashboard Integration
 *
 * EPP v2 Protocol: Dashboard + CLI integration KÖTELEZŐ (Rule #6)
 *
 * Features:
 * - Kreatív ötlet input (textarea, 2-5 mondat)
 * - Track generálása 3-stage LLM pipeline-nal
 * - Real-time progress indicator (Stage 1/3, 2/3, 3/3)
 * - Markdown preview (marked renderer)
 * - Toast notifications (success/error)
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Activity,
  CheckCircle2,
  FileText,
  Rocket,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { marked } from "marked";

// ==================== Types ====================

interface GeneratedTrackResult {
  trackId: string;
  trackPath: string;
  preview: string;
}

interface TrackMetadata {
  id: string;
  title: string;
  priority: string;
  progress: number;
  created: string;
  group?: "business" | "nova" | "brunella" | "other";
}

const TRACK_GROUP_LABELS: Record<string, string> = {
  business: "Könyvelés / üzleti automatizálás",
  nova: "Nova asszisztens",
  brunella: "Brunella rendszer",
  other: "Egyéb",
};

function trackGroupLabel(group?: string): string {
  return TRACK_GROUP_LABELS[group ?? "other"] ?? TRACK_GROUP_LABELS.other;
}

// ==================== API Helpers ====================

const API_PREFIX = "/api/v1/tracks";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const text = await response.text();
  if (!text) throw new Error(`Empty response from ${path}`);

  const data = JSON.parse(text) as T;
  if (!response.ok) {
    throw new Error(
      (data as Record<string, string>).error || `HTTP ${response.status}`,
    );
  }

  return data;
}

async function generateTrack(idea: string): Promise<GeneratedTrackResult> {
  return apiFetch<GeneratedTrackResult>("/generate", {
    method: "POST",
    body: JSON.stringify({ idea }),
  });
}

async function listTracks(): Promise<{
  count: number;
  tracks: TrackMetadata[];
}> {
  return apiFetch<{ success: boolean; count: number; tracks: TrackMetadata[] }>(
    "/",
  );
}

// ==================== Component ====================

export function TrackGenerator() {
  const [idea, setIdea] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStage, setCurrentStage] = useState(0); // 0 = idle, 1-3 = stages
  const [generatedTrack, setGeneratedTrack] =
    useState<GeneratedTrackResult | null>(null);
  const [recentTracks, setRecentTracks] = useState<TrackMetadata[]>([]);
  const [showRecentTracks, setShowRecentTracks] = useState(false);

  const handleGenerate = async () => {
    const trimmedIdea = idea.trim();
    if (!trimmedIdea || trimmedIdea.length < 10) {
      toast.error("Túl rövid ötlet! Írj legalább 2-3 mondatot.");
      return;
    }

    setIsGenerating(true);
    setCurrentStage(1);
    setGeneratedTrack(null);

    try {
      // Stage 1: Requirements extraction
      toast.info("📊 Stage 1/3: Követelmények kinyerése...");
      setCurrentStage(1);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Artificial delay for UX

      // Stage 2: Track markdown generation
      toast.info("📝 Stage 2/3: Track írása...");
      setCurrentStage(2);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Stage 3: Validation & file write
      toast.info("✔️ Stage 3/3: Validálás...");
      setCurrentStage(3);

      const result = await generateTrack(trimmedIdea);

      setGeneratedTrack(result);
      toast.success(`✨ Track generálva: ${result.trackId}`);
      setIdea(""); // Clear input after success
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : "Ismeretlen hiba";
      toast.error(`❌ Hiba történt: ${errorMessage}`);
      console.error("Track generation failed:", e);
    } finally {
      setIsGenerating(false);
      setCurrentStage(0);
    }
  };

  const loadRecentTracks = async () => {
    try {
      const result = await listTracks();
      setRecentTracks(result.tracks.slice(0, 5)); // Show only 5 most recent
      setShowRecentTracks(true);
      toast.success(`${result.count} track található`);
    } catch (e: unknown) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to load tracks";
      toast.error(`Hiba: ${errorMessage}`);
    }
  };

  const renderMarkdown = (markdown: string): string => {
    return marked(markdown, { breaks: true, gfm: true }) as string;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Sparkles size={20} className="text-primary" />
          Track Generátor
          <Badge variant="outline" className="ml-2 text-xs">
            EPP v2
          </Badge>
        </h2>
        <Button variant="ghost" size="sm" onClick={loadRecentTracks}>
          <FileText size={14} className="mr-1.5" />
          Tracks listázása
        </Button>
      </div>

      {/* Recent Tracks List */}
      {showRecentTracks && recentTracks.length > 0 && (
        <Card className="glass-card">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText size={14} className="text-zinc-500" />
              Legutóbbi Tracks ({recentTracks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px]">
              <div className="divide-y divide-border/50">
                {recentTracks.map((track, i) => (
                  <div
                    key={`${track.id}-${i}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium truncate">
                          {track.title}
                        </p>
                        <Badge variant="outline" className="text-[10px]">
                          {trackGroupLabel(track.group)}
                        </Badge>
                      </div>
                      <p className="text-xs text-zinc-500">
                        ID: {track.id} • {track.created}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {track.priority}
                    </Badge>
                    <span className="text-xs text-zinc-500">
                      {track.progress}%
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Input Card */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Rocket size={14} className="text-primary" />
            Írd le az ötleted (2-5 mondat, magyarul is OK)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Példa: Dashboard TODO widget real-time sync-kal. WebSocket frissítés, checkbox toggle, track progress megjelenítés. Használjuk a Socket.IO-t és egy új React komponenst."
            rows={6}
            disabled={isGenerating}
            className="resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {idea.length} karakter •{" "}
              {idea.trim().length < 10
                ? "Írj még legalább " + (10 - idea.trim().length) + " karaktert"
                : "Rendben!"}
            </span>
            <Button
              onClick={handleGenerate}
              disabled={!idea.trim() || idea.trim().length < 10 || isGenerating}
              className="gap-2"
            >
              {isGenerating ? (
                <>
                  <Activity size={14} className="animate-spin" />
                  Generálás...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Track Generálása
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress Indicator */}
      {isGenerating && currentStage > 0 && (
        <Card className="glass-card border-blue-500/30">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Activity size={14} className="text-blue-500 animate-pulse" />
                Track generálása folyamatban...
              </div>
              <div className="space-y-2">
                {[
                  {
                    stage: 1,
                    label: "Követelmények kinyerése",
                    icon: CheckCircle2,
                  },
                  { stage: 2, label: "Track írása", icon: FileText },
                  { stage: 3, label: "Validálás", icon: CheckCircle2 },
                ].map((item) => (
                  <div
                    key={item.stage}
                    className={cn(
                      "flex items-center gap-2 text-xs transition-all",
                      currentStage === item.stage &&
                        "text-blue-500 font-medium",
                      currentStage > item.stage && "text-green-500",
                      currentStage < item.stage && "text-zinc-500",
                    )}
                  >
                    {currentStage > item.stage ? (
                      <CheckCircle2 size={12} className="text-green-500" />
                    ) : currentStage === item.stage ? (
                      <Activity
                        size={12}
                        className="animate-spin text-blue-500"
                      />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-border" />
                    )}
                    <span>
                      Stage {item.stage}/3: {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generated Track Preview */}
      {generatedTrack && !isGenerating && (
        <Card className="glass-card border-green-500/30">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckCircle2 size={14} className="text-green-500" />
              Track generálva: {generatedTrack.trackId}
              <Badge variant="outline" className="ml-auto text-[10px]">
                {generatedTrack.trackPath}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <div
                className="prose prose-sm dark:prose-invert max-w-none px-4 py-3"
                dangerouslySetInnerHTML={{
                  __html: renderMarkdown(generatedTrack.preview),
                }}
              />
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isGenerating && !generatedTrack && !showRecentTracks && (
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <Sparkles
              size={32}
              className="text-zinc-500/50 mx-auto mb-3"
            />
            <p className="text-sm text-zinc-500">
              Írj be egy kreatív ötletet (2-5 mondat), majd kattints a
              &quot;Track Generálása&quot; gombra.
            </p>
            <p className="text-xs text-zinc-500/70 mt-1">
              A SpecWriterAgent automatikusan létrehoz egy professzionális EPP
              v2 compliant track.md fájlt.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="glass-card border-yellow-500/20 bg-yellow-500/5">
        <CardContent className="p-4 flex items-start gap-3">
          <AlertTriangle
            size={16}
            className="text-yellow-500 mt-0.5 shrink-0"
          />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              EPP v2 Rule #6: Dashboard + CLI Integration
            </p>
            <p className="text-xs text-zinc-500">
              Minden generált track tartalmaz Dashboard komponens és CLI parancs
              leírást. A CLI-ből használd:{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                brunella tracks generate
              </code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
