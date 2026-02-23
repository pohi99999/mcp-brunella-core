import React, { useState, useEffect } from 'react';
import { 
    Zap, 
    TrendingUp, 
    AlertCircle, 
    ExternalLink, 
    RefreshCw, 
    Search,
    ShieldCheck,
    History
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';
import { useSystemSignalStore } from '../../store/systemSignalStore';
import { useShallow } from 'zustand/react/shallow';

interface BuyAlert {
    id: string;
    title: string;
    priceEur: number;
    estimatedValueEur: number;
    discountPct: number;
    score: number;
    source: string;
    url: string;
    timestamp: string;
    category: string;
    severity: 'critical' | 'warning';
}

export function MachineHunterWidget() {
    const [isHunting, setIsHunting] = useState(false);
    const { socket } = useSocket();
    
    const { alerts, clearAlerts } = useSystemSignalStore(useShallow((state) => ({
        alerts: state.machineAlerts,
        clearAlerts: state.clearMachineAlerts
    })));

    // Toast notification for new alerts (since we removed local handling)
    useEffect(() => {
        if (!socket) return;

        const handleNewAlert = (alert: BuyAlert) => {
            if (alert.severity === 'critical') {
                toast.error(`🔥 PROFIT LEHETŐSÉG: ${alert.title}`, {
                    description: `${alert.priceEur} EUR (${alert.discountPct}% diszkont!)`,
                    duration: 10000
                });
            } else {
                toast.success(`Új gép találat: ${alert.title}`);
            }
        };

        socket.on('machine:alert', handleNewAlert);
        return () => {
            socket.off('machine:alert', handleNewAlert);
        };
    }, [socket]);

    const handleStartHunt = async () => {
        setIsHunting(true);
        toast.info("Gépvadászat elindítva...");
        // TODO: Backend API hívás a vadászat indításához
        setTimeout(() => setIsHunting(false), 5000);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
    };

    return (
        <Card className="w-full shadow-xl border-primary/20 bg-card/50 backdrop-blur-md">
            <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <Zap className="w-5 h-5 text-primary animate-pulse" />
                        </div>
                        <div>
                            <CardTitle>Industrial Machine Hunter</CardTitle>
                            <CardDescription>Valós idejű arbitrázs és profit figyelő</CardDescription>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={clearAlerts}>
                            <History className="w-4 h-4 mr-2" />
                            Törlés
                        </Button>
                        <Button 
                            variant="default" 
                            size="sm" 
                            onClick={handleStartHunt} 
                            disabled={isHunting}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {isHunting ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                            Vadászat Indítása
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="p-4 rounded-xl bg-secondary/20 border border-primary/5 flex flex-col items-center justify-center text-center">
                        <TrendingUp className="w-6 h-6 text-green-500 mb-2" />
                        <div className="text-2xl font-bold">{alerts.length}</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-tighter">Aktív Találatok</div>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/20 border border-primary/5 flex flex-col items-center justify-center text-center">
                        <ShieldCheck className="w-6 h-6 text-blue-500 mb-2" />
                        <div className="text-2xl font-bold">84%</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-tighter">Átlagos Bizalom</div>
                    </div>
                    <div className="p-4 rounded-xl bg-secondary/20 border border-primary/5 flex flex-col items-center justify-center text-center">
                        <AlertCircle className="w-6 h-6 text-yellow-500 mb-2" />
                        <div className="text-2xl font-bold">3</div>
                        <div className="text-xs text-muted-foreground uppercase tracking-tighter">Kritikus (BUY)</div>
                    </div>
                </div>

                <div className="space-y-3">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                        Legutóbbi Riasztások
                        {alerts.length > 0 && <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none">{alerts.length}</Badge>}
                    </h3>
                    
                    <ScrollArea className="h-[350px] pr-4">
                        {alerts.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center py-12 text-muted-foreground opacity-40">
                                <Search className="w-12 h-12 mb-4" />
                                <p>Nincs aktív találat. Indíts egy új vadászatot!</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {alerts.map((alert) => (
                                    <div 
                                        key={alert.id}
                                        className={`p-4 rounded-lg border transition-all hover:shadow-md ${
                                            alert.severity === 'critical' 
                                            ? 'bg-red-500/5 border-red-500/20 hover:border-red-500/40' 
                                            : 'bg-secondary/10 border-primary/10 hover:border-primary/30'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-bold text-sm truncate pr-2">{alert.title}</h4>
                                                <div className="flex gap-2 mt-1">
                                                    <Badge variant="outline" className="text-[10px] uppercase font-mono">
                                                        {alert.source}
                                                    </Badge>
                                                    <Badge className={alert.score > 0.8 ? 'bg-red-600' : 'bg-yellow-600'}>
                                                        {alert.severity === 'critical' ? 'BUY' : 'WATCH'}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-bold text-green-500">{formatCurrency(alert.priceEur)}</div>
                                                <div className="text-[10px] text-muted-foreground line-through opacity-50">{formatCurrency(alert.estimatedValueEur)}</div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center mt-4 pt-3 border-t border-primary/5">
                                            <div className="text-[10px] text-muted-foreground font-mono">
                                                ID: {alert.id} | {new Date(alert.timestamp).toLocaleTimeString()}
                                            </div>
                                            <div className="flex gap-2">
                                                <Button variant="ghost" size="xs" className="h-7 text-[10px]">
                                                    Elvetés
                                                </Button>
                                                <Button size="xs" className="h-7 text-[10px] gap-1" asChild>
                                                    <a href={alert.url} target="_blank" rel="noopener noreferrer">
                                                        Megnyitás
                                                        <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                </Button>
                                            </div>
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
