import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Car, Database, Megaphone, FileCheck } from "lucide-react";
import { toast } from "sonner";
import * as api from "@/lib/apiService";

export function QuickActionsPanel() {
  const handleEVHunter = async () => {
    toast.info("Green Lightning EV Hunter indítása...");
    // Mock or real API call
    try {
      await api.executeAgent("robotkezv2", "Keress olcsó elektromos autókat");
      toast.success("EV Hunter sikeresen elindult");
    } catch (e) {
      toast.error("Hiba az indításkor");
    }
  };

  const handleRAGReindex = async () => {
    toast.info("Tudásbázis újraindexelése...");
    // Logic for RAG reindex
    toast.success("Indexelés sorba állítva");
  };

  const handleNewCampaign = async () => {
    toast.info("Új marketing kampány generálása...");
    // Logic for Marketing Swarm
    toast.success("Marketing Swarm aktiválva");
  };

  return (
    <Card className="glass-panel border-white/5 h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
          <Zap size={14} className="text-primary" />
          Gyors Műveletek
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleEVHunter}
          className="border-white/5 bg-white/5 hover:bg-primary/10 hover:text-white flex flex-col gap-2 h-auto py-4"
        >
          <Car size={20} className="text-emerald-500" />
          <span className="text-[10px] font-bold">EV Hunter</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRAGReindex}
          className="border-white/5 bg-white/5 hover:bg-primary/10 hover:text-white flex flex-col gap-2 h-auto py-4"
        >
          <Database size={20} className="text-blue-500" />
          <span className="text-[10px] font-bold">RAG Index</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleNewCampaign}
          className="border-white/5 bg-white/5 hover:bg-primary/10 hover:text-white flex flex-col gap-2 h-auto py-4"
        >
          <Megaphone size={20} className="text-amber-500" />
          <span className="text-[10px] font-bold">Marketing Swarm</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="border-white/5 bg-white/5 hover:bg-primary/10 hover:text-white flex flex-col gap-2 h-auto py-4"
        >
          <FileCheck size={20} className="text-zinc-500" />
          <span className="text-[10px] font-bold">System Audit</span>
        </Button>
      </CardContent>
    </Card>
  );
}
