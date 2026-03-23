import React, { useState, useEffect } from 'react';
import {
    Users,
    Zap,
    ArrowRight,
    Download,
    RefreshCw,
    Search,
    MessageSquare,
    ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';

interface Lead {
    id: string;
    name: string;
    website: string;
    industry: string;
    icebreaker: string;
    email?: string;
    phone?: string;
}

export function LeadMiningWidget() {
    const [isMining, setIsMining] = useState(false);
    const [leads, setLeads] = useState<Lead[]>([]);
    const { socket } = useSocket();

    useEffect(() => {
        if (!socket) return;

        const handleNewLeads = (data: { leads: Lead[] }) => {
            setLeads(prev => [...data.leads, ...prev].slice(0, 50));
            toast.success(`${data.leads.length} új lead érkezett!`);
        };

        socket.on('lead_mining:results', handleNewLeads);
        return () => {
            socket.off('lead_mining:results', handleNewLeads);
        };
    }, [socket]);

    const handleStartMining = async () => {
        setIsMining(true);
        toast.info("Lead bányászat elindítva...");

        try {
            // Mocking the call for now
            socket?.emit('agent:execute', {
                agent: 'lead_mining',
                task: 'fogorvos Budapest'
            });
        } catch (err) {
            toast.error("Hiba a bányászat indításakor.");
        } finally {
            setTimeout(() => setIsMining(false), 3000);
        }
    };

    return (
        <Card className="w-full shadow-xl border-primary/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle>B2B Lead Mining</CardTitle>
                            <CardDescription>Automatizált Google Maps bányászat & Icebreakers</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleStartMining}
                            disabled={isMining}
                            className="bg-primary hover:bg-primary/90"
                        >
                            {isMining ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            Bányászat Indítása
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-primary/5">
                        <div className="text-xs text-zinc-500 uppercase tracking-tighter mb-1">Összes Lead</div>
                        <div className="text-2xl font-bold">{leads.length}</div>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/20 border border-primary/5">
                        <div className="text-xs text-zinc-500 uppercase tracking-tighter mb-1">Átlagos Érdeklődés</div>
                        <div className="text-2xl font-bold text-green-500">Magas</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        Friss Találatok
                        {leads.length > 0 && <Badge className="bg-primary/20 text-primary">{leads.length}</Badge>}
                    </h3>

                    <ScrollArea className="h-[350px] pr-4">
                        {leads.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-12 text-zinc-500 opacity-40">
                                <Users className="w-12 h-12 mb-4" />
                                <p>Nincsenek lead-ek. Indíts egy keresést!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {leads.map((lead, i) => (
                                    <div
                                        key={i}
                                        className="p-4 rounded-lg border border-primary/10 bg-secondary/5 hover:border-primary/30 transition-all"
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-sm">{lead.name}</h4>
                                                <div className="text-[10px] text-zinc-500 font-mono">{lead.industry}</div>
                                            </div>
                                            <Button variant="ghost" size="xs" asChild>
                                                <a href={lead.website} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="w-3 h-3" />
                                                </a>
                                            </Button>
                                        </div>

                                        <div className="mt-3 p-2 rounded bg-primary/5 border-l-2 border-primary italic text-xs flex gap-2">
                                            <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                                            "{lead.icebreaker}"
                                        </div>

                                        <div className="flex justify-end gap-2 mt-4">
                                            <Button size="xs" variant="outline" className="h-7 text-[10px]"
                                                onClick={() => toast.info("CRM integráció hamarosan elérhető")}>
                                                CRM-be küldés
                                            </Button>
                                            <Button size="xs" className="h-7 text-[10px]"
                                                onClick={() => toast.info("Email küldés hamarosan elérhető")}>
                                                Email küldése
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </CardContent>
        </Card>
    );
}
