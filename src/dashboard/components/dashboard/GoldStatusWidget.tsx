import { useEffect, useMemo, useState } from "react";
import { ArrowClockwise, Broadcast, ChartLine, Database, FileText, ShieldCheck } from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";

interface PillarStatus {
    id: string;
    name: string;
    icon: React.ReactNode;
    status: "active" | "idle" | "warning";
    metric: string;
}

export function GoldStatusWidget() {
    const [pillars, setPillars] = useState<PillarStatus[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setPillars([
            { id: "spec", name: "Spec Management", icon: <FileText className="h-6 w-6" />, status: "active", metric: "12 approved" },
            { id: "phoenix", name: "Phoenix Protocol", icon: <ArrowClockwise className="h-6 w-6" />, status: "active", metric: "8 checkpoints" },
            { id: "router", name: "Model Router", icon: <Broadcast className="h-6 w-6" />, status: "active", metric: "24 recent" },
            { id: "memory", name: "Cognitive Memory", icon: <Database className="h-6 w-6" />, status: "active", metric: "128 samples" },
            { id: "observability", name: "Observability", icon: <ChartLine className="h-6 w-6" />, status: "idle", metric: "0 traces" },
            { id: "audit", name: "Audit", icon: <ShieldCheck className="h-6 w-6" />, status: "warning", metric: "2 denied" },
        ]);
        setLoading(false);
    }, []);

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Gold Protocol Status</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-gray-500">Loading...</div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-border/40 bg-slate-950/70 shadow-xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/5">
                <CardTitle className="flex items-center justify-between">
                    <span>Gold Protocol Status</span>
                    <Badge className="bg-yellow-500 text-black">ACTIVE</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                    {pillars.map((pillar) => (
                        <div key={pillar.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <div className="mb-2 flex items-center gap-2">
                                {pillar.icon}
                                <Badge variant="secondary" className="border-white/10 bg-white/5 text-xs text-slate-200">
                                    {pillar.status.toUpperCase()}
                                </Badge>
                            </div>
                            <div className="text-sm font-semibold text-white">{pillar.name}</div>
                            <div className="text-xs text-slate-400">{pillar.metric}</div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
