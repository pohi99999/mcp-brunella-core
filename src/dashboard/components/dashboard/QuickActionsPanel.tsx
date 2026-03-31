import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Car, Database, Megaphone, FileCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/apiService";

export function QuickActionsPanel() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleEVHunter = async () => {
    setLoading("ev");
    toast.info("Green Lightning EV Hunter indítása...");
    try {
      await api.executeAgent("robotkezv2", "Keress olcsó elektromos autókat");
      toast.success("EV Hunter sikeresen elindult");
    } catch (e) {
      toast.error("Hiba az indításkor");
    } finally {
      setLoading(null);
    }
  };

  const handleRAGReindex = async () => {
    setLoading("rag");
    toast.info("Tudásbázis újraindexelése...");
    try {
      await api.executeAgent("DataScientistAgent", "RAG index frissítés és optimalizálás");
      toast.success("RAG indexelés elindítva");
    } catch (e) {
      toast.error("RAG indexelési hiba");
    } finally {
      setLoading(null);
    }
  };

  const handleNewCampaign = async () => {
    setLoading("campaign");
    toast.info("Új marketing kampány generálása...");
    try {
      await api.executeAgent("CopywriterAgent", "Generálj új marketing kampányt a jelenlegi termékekhez");
      toast.success("Marketing Swarm aktiválva");
    } catch (e) {
      toast.error("Kampány generálási hiba");
    } finally {
      setLoading(null);
    }
  };

  const handleSystemAudit = async () => {
    setLoading("audit");
    toast.info("Rendszer audit indítása...");
    try {
      await api.executeAgent("EvaluatorAgent", "Teljes rendszer audit: kód minőség, teszt lefedettség, ügynök teljesítmény");
      toast.success("Rendszer audit elindítva");
    } catch (e) {
      toast.error("Audit indítási hiba");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className="glass-card border-white/10 h-full overflow-hidden shadow-[0_16px_60px_-36px_rgba(0,0,0,0.85)]">
      <CardHeader className="pb-3 border-b border-white/[0.05] bg-white/[0.015] flex flex-row items-center justify-between">
        <CardTitle className="text-[11px] font-mono font-semibold text-zinc-400 uppercase tracking-[0.28em] flex items-center gap-2">
          <Zap size={14} className="text-primary" />
          Gyors Műveletek
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 p-4 lg:p-5">
        <Button
          variant="outline"
          size="sm"
          onClick={handleEVHunter}
          disabled={loading !== null}
          className="border-white/10 bg-white/[0.03] hover:bg-cyan-500/10 hover:text-white flex flex-col gap-2 h-auto py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
        >
          {loading === "ev" ? <Loader2 size={20} className="animate-spin text-emerald-500" /> : <Car size={20} className="text-emerald-500" />}
          <span className="text-[10px] font-bold">EV Hunter</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRAGReindex}
          disabled={loading !== null}
          className="border-white/10 bg-white/[0.03] hover:bg-cyan-500/10 hover:text-white flex flex-col gap-2 h-auto py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
        >
          {loading === "rag" ? <Loader2 size={20} className="animate-spin text-blue-500" /> : <Database size={20} className="text-blue-500" />}
          <span className="text-[10px] font-bold">RAG Index</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewCampaign}
          disabled={loading !== null}
          className="border-white/10 bg-white/[0.03] hover:bg-cyan-500/10 hover:text-white flex flex-col gap-2 h-auto py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
        >
          {loading === "campaign" ? <Loader2 size={20} className="animate-spin text-amber-500" /> : <Megaphone size={20} className="text-amber-500" />}
          <span className="text-[10px] font-bold">Marketing Swarm</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSystemAudit}
          disabled={loading !== null}
          className="border-white/10 bg-white/[0.03] hover:bg-cyan-500/10 hover:text-white flex flex-col gap-2 h-auto py-4 rounded-2xl transition-all duration-200 hover:-translate-y-0.5"
        >
          {loading === "audit" ? <Loader2 size={20} className="animate-spin text-zinc-500" /> : <FileCheck size={20} className="text-zinc-500" />}
          <span className="text-[10px] font-bold">System Audit</span>
        </Button>
      </CardContent>
    </Card>
  );
}
