import React, { useState } from 'react';
import { Truck, MapPin, Navigation, TrendingDown, Clock, Fuel } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';

export function LogisticsDemo() {
    const [calculating, setCalculating] = useState(false);
    const [optimized, setOptimized] = useState(false);

    const runOptimization = () => {
        setCalculating(true);
        setTimeout(() => {
            setCalculating(false);
            setOptimized(true);
        }, 3000);
    };

    return (
        <Card className="h-full border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Truck className="w-4 h-4 text-primary" />
                            Logisztikai Optimalizáló
                        </CardTitle>
                        <CardDescription className="text-[10px]">Valós idejű flotta-útvonal tervező</CardDescription>
                    </div>
                    {optimized && <Badge className="bg-green-500/20 text-green-500 border-green-500/50">OPTIMALIZÁLT</Badge>}
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
                <div className="aspect-video bg-slate-900 rounded-lg border border-white/5 flex items-center justify-center relative overflow-hidden">
                    <MapPin className="absolute top-1/4 left-1/4 w-4 h-4 text-red-500" />
                    <MapPin className="absolute bottom-1/3 right-1/3 w-4 h-4 text-blue-500" />
                    <div className="text-[10px] font-mono text-zinc-500">INTERAKTÍV TÉRKÉP PREVIEW</div>
                    
                    {optimized && (
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <path d="M 50 40 Q 150 100 250 80" fill="transparent" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4" className="animate-pulse" />
                        </svg>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-secondary/20 border border-primary/5">
                        <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Időmegtakarítás
                        </div>
                        <div className="text-sm font-bold text-primary">{optimized ? '18.4%' : '0%'}</div>
                    </div>
                    <div className="p-2 rounded bg-secondary/20 border border-primary/5">
                        <div className="text-[9px] uppercase text-muted-foreground flex items-center gap-1">
                            <Fuel className="w-3 h-3" /> Üzemanyag
                        </div>
                        <div className="text-sm font-bold text-green-500">{optimized ? '12.5%' : '0%'}</div>
                    </div>
                </div>

                <Button 
                    className="w-full h-9 gap-2" 
                    onClick={runOptimization} 
                    disabled={calculating}
                >
                    {calculating ? (
                        <>
                            <Navigation className="w-4 h-4 animate-spin" />
                            Számítás...
                        </>
                    ) : (
                        <>
                            <TrendingDown className="w-4 h-4" />
                            Útvonal Optimalizálás
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${className}`}>{children}</span>;
}
