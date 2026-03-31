import { useMemo, useState } from "react";
import { ArrowRight, BarChart3, Building2, CheckCircle2, Filter, Handshake, Loader2, Mail, MessageSquare, Send, Trello, UserPlus, Zap } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";

interface LeadItem {
    id: string;
    company_name: string;
    contact_person?: string;
    status: string;
    last_interaction_at?: string;
}

interface Stage {
    id: string;
    label: string;
    color: string;
}

const STAGES: Stage[] = [
    { id: "new", label: "Új Leadek", color: "bg-blue-500" },
    { id: "outreach", label: "Megkeresés", color: "bg-purple-500" },
    { id: "responded", label: "Válaszolt", color: "bg-orange-500" },
    { id: "meeting", label: "Tárgyalás", color: "bg-yellow-500" },
    { id: "loi", label: "Szándéknyilatkozat", color: "bg-emerald-500" },
    { id: "closed", label: "Lezárva", color: "bg-green-600" },
];

const SAMPLE_LEADS: LeadItem[] = [
    { id: "lead-1", company_name: "Brunella Demo Kft.", contact_person: "Kiss Anna", status: "outreach", last_interaction_at: new Date().toISOString() },
    { id: "lead-2", company_name: "Mission Control Zrt.", contact_person: "Nagy Péter", status: "meeting", last_interaction_at: new Date().toISOString() },
    { id: "lead-3", company_name: "Glassworks Studio", contact_person: "Fodor Máté", status: "new" },
    { id: "lead-4", company_name: "EdgeFlow Bt.", contact_person: "Tóth Réka", status: "closed", last_interaction_at: new Date().toISOString() },
];

function statusLabel(status: string) {
    switch (status) {
        case "new": return "Új";
        case "outreach": return "Küldve";
        case "responded": return "Válasz";
        case "meeting": return "Meeting";
        case "loi": return "LOI";
        case "closed": return "Closed";
        default: return status;
    }
}

export function SalesPipelineWidget() {
    const [isLoadingLeads] = useState(false);
    const leads = SAMPLE_LEADS;

    const stats = useMemo(() => {
        return STAGES.reduce<Record<string, number>>((acc, stage) => {
            acc[stage.id] = leads.filter((lead) => lead.status === stage.id).length;
            return acc;
        }, {});
    }, [leads]);

    const groupedLeads = useMemo(() => {
        return STAGES.reduce<Record<string, LeadItem[]>>((acc, stage) => {
            acc[stage.id] = leads.filter((lead) => lead.status === stage.id);
            return acc;
        }, {});
    }, [leads]);

    function refreshData() {
        toast.info("A dashboard most az aktuális leadeket jeleníti meg.");
    }

    return (
        <Card className="w-full overflow-hidden border-primary/20 bg-slate-950/70 shadow-2xl shadow-black/20 backdrop-blur-xl">
            <CardHeader className="border-b border-white/[0.04] bg-white/[0.02] pb-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                            <Trello className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Sales Pipeline</CardTitle>
                            <CardDescription>Aktív üzleti folyamatok és tölcsér követés</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={refreshData} disabled={isLoadingLeads}>
                        {isLoadingLeads ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {[
                        { label: "Új", value: stats.new ?? 0, tone: "text-blue-300" },
                        { label: "Futó", value: (stats.outreach ?? 0) + (stats.responded ?? 0) + (stats.meeting ?? 0), tone: "text-cyan-300" },
                        { label: "Lezárt", value: stats.closed ?? 0, tone: "text-emerald-300" },
                    ].map((item) => (
                        <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{item.label}</p>
                            <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2">
                    {STAGES.map((stage) => (
                        <div key={stage.id} className="min-w-[260px] flex-1 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${stage.color}`} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{stage.label}</span>
                                </div>
                                <Badge variant="secondary" className="border-white/10 bg-white/5 text-[10px] text-slate-200">
                                    {groupedLeads[stage.id]?.length ?? 0}
                                </Badge>
                            </div>

                            <ScrollArea className="h-[420px] pr-2">
                                <div className="space-y-3">
                                    {(groupedLeads[stage.id] ?? []).map((lead) => (
                                        <article key={lead.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h4 className="text-sm font-semibold text-white">{lead.company_name}</h4>
                                                    <p className="text-xs text-slate-400">{lead.contact_person ?? "—"}</p>
                                                </div>
                                                <Badge variant="secondary" className="border-white/10 bg-white/5 text-[10px] text-slate-200">
                                                    {statusLabel(lead.status)}
                                                </Badge>
                                            </div>

                                            {lead.last_interaction_at && (
                                                <div className="mt-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                                                    <Zap className="h-3.5 w-3.5 text-amber-300" />
                                                    {format(new Date(lead.last_interaction_at), "MMM d. HH:mm")}
                                                </div>
                                            )}

                                            <div className="mt-4 flex gap-2">
                                                <Button size="sm" variant="outline" className="h-8 flex-1 border-white/10 bg-white/[0.03] text-xs">
                                                    Adatlap
                                                </Button>
                                                <Button size="sm" className="h-8 flex-1 text-xs" variant="secondary">
                                                    <Send className="mr-2 h-3.5 w-3.5" /> Email
                                                </Button>
                                            </div>
                                        </article>
                                    ))}

                                    {(groupedLeads[stage.id]?.length ?? 0) === 0 && (
                                        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
                                            <Filter className="mr-2 h-4 w-4" /> Üres szakasz
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
