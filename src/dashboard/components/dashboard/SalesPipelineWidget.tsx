import React, { useState, useEffect, useMemo } from 'react';
import { 
    Trello, 
    Zap, 
    ArrowRight, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Mail,
    MessageSquare,
    Calendar,
    Handshake,
    Filter,
    BarChart3,
    UserPlus,
    Building2,
    ChevronDown
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';
import { useBusinessStore } from '../../lib/businessStore';
import { format } from 'date-fns';

const STAGES = [
    { id: 'new', label: 'Új Leadek', icon: <UserPlus className="w-3 h-3" />, color: 'bg-blue-500' },
    { id: 'outreach', label: 'Megkeresés', icon: <Mail className="w-3 h-3" />, color: 'bg-purple-500' },
    { id: 'responded', label: 'Válaszolt', icon: <MessageSquare className="w-3 h-3" />, color: 'bg-orange-500' },
    { id: 'meeting', label: 'Tárgyalás', icon: <Calendar className="w-3 h-3" />, color: 'bg-yellow-500' },
    { id: 'loi', label: 'Szándéknyilatkozat', icon: <FileText className="w-3 h-3" />, color: 'bg-emerald-500' },
    { id: 'closed', label: 'Lezárva', icon: <Handshake className="w-3 h-3" />, color: 'bg-green-600' }
];

import { FileText } from 'lucide-react';

export function SalesPipelineWidget() {
    const [leads, setLeads] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({});
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);
    const { socket } = useSocket();

    const fetchPipelineData = async () => {
        setIsLoadingLeads(true);
        try {
            // Overall stats
            const statsRes = await fetch('/api/v1/business-jobs/pipeline/stats');
            const statsData = await statsRes.json();
            if (statsData.success) {
                const s: any = {};
                statsData.stats.forEach((item: any) => s[item.status] = item.count);
                setStats(s);
            }

            // All leads (simplified for now, ideally paginated)
            const leadsRes = await fetch('/api/v1/business-jobs/leads/all'); // Assuming a global getter or we fetch by last job
            // For now, let's just show leads from the most recent jobs
            const jobsRes = await fetch('/api/v1/business-jobs?limit=5');
            const jobsData = await jobsRes.json();
            
            if (jobsData.success && jobsData.jobs.length > 0) {
                const allLeads: any[] = [];
                for (const job of jobsData.jobs) {
                    const lr = await fetch(`/api/v1/business-jobs/leads/${job.id}`);
                    const ld = await lr.json();
                    if (ld.success) allLeads.push(...ld.leads);
                }
                setLeads(allLeads);
            }
        } catch (err) {
            console.error("Error fetching pipeline:", err);
        } finally {
            setIsLoadingLeads(false);
        }
    };

    useEffect(() => {
        fetchPipelineData();
    }, []);

    const handleUpdateStatus = async (leadId: string, newStatus: string) => {
        try {
            const res = await fetch(`/api/v1/business-jobs/leads/${leadId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success(`Státusz frissítve: ${newStatus}`);
                fetchPipelineData();
            }
        } catch (err) {
            toast.error("Hiba a frissítés során.");
        }
    };

    const groupedLeads = useMemo(() => {
        const groups: any = {};
        STAGES.forEach(s => groups[s.id] = leads.filter(l => l.status === s.id));
        return groups; group: any
    }, [leads]);

    return (
        <Card className="w-full shadow-2xl border-primary/20 bg-card/50 backdrop-blur-md overflow-hidden">
            <CardHeader className="pb-3 border-b border-white/5 bg-secondary/10">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Trello className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>Sales Pipeline</CardTitle>
                            <CardDescription>Aktív üzleti folyamatok és tölcsér követés</CardDescription>
                        </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchPipelineData} disabled={isLoadingLeads}>
                        {isLoadingLeads ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="flex overflow-x-auto no-scrollbar p-4 gap-4 min-h-[600px] bg-black/20">
                    {STAGES.map((stage) => (
                        <div key={stage.id} className="min-w-[280px] flex flex-col gap-4">
                            <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{stage.label}</span>
                                </div>
                                <Badge variant="secondary" className="text-[10px] bg-white/5">{groupedLeads[stage.id]?.length || 0}</Badge>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="space-y-3 pb-4">
                                    {groupedLeads[stage.id]?.map((lead: any) => (
                                        <div key={lead.id} className="p-4 rounded-xl border border-white/5 bg-secondary/5 hover:border-primary/30 transition-all group relative">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="font-bold text-xs text-white truncate">{lead.company_name}</h4>
                                                    <p className="text-[9px] text-zinc-500 mt-0.5">{lead.contact_person}</p>
                                                </div>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <SelectStatus currentStatus={lead.status} onUpdate={(s) => handleUpdateStatus(lead.id, s)} />
                                                </div>
                                            </div>

                                            {lead.last_interaction_at && (
                                                <div className="flex items-center gap-1.5 text-[8px] text-zinc-600 font-mono uppercase mt-2">
                                                    <Zap size={10} className="text-yellow-500" />
                                                    {format(new Date(lead.last_interaction_at), 'MMM d. HH:mm')}
                                                </div>
                                            )}

                                            <div className="mt-4 flex gap-2">
                                                <Button size="xs" variant="ghost" className="h-6 text-[8px] flex-1 bg-white/5">Adatlap</Button>
                                                {stage.id === 'outreach' && (
                                                    <Button size="xs" className="h-6 text-[8px] flex-1 bg-primary/20 text-primary">Email küldve?</Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {groupedLeads[stage.id]?.length === 0 && (
                                        <div className="py-10 border-2 border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center opacity-20">
                                            <Filter size={24} />
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

function SelectStatus({ currentStatus, onUpdate }: { currentStatus: string, onUpdate: (s: string) => void }) {
    return (
        <div className="relative inline-block text-left">
            <select 
                className="text-[10px] bg-black/40 border border-white/10 rounded px-1 py-0.5 outline-none appearance-none cursor-pointer pr-4"
                value={currentStatus}
                onChange={(e) => onUpdate(e.target.value)}
            >
                {STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.id.toUpperCase()}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-1 top-1.5 w-2 h-2 text-zinc-500 pointer-events-none" />
        </div>
    );
}
