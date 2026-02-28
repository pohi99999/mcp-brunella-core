import React from 'react';
import { Play, Eye, Download, Star, ShieldCheck, Cpu } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LogisticsDemo } from '../components/widgets/LogisticsDemo';
import { GrantAdvisorWidget } from '../components/widgets/GrantAdvisorWidget';

export function ShowcasePage() {
    return (
        <div className="p-6 space-y-8 max-w-7xl mx-auto">
            <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Cpu className="w-8 h-8 text-primary" />
                    Brunella AI Showcase 2026
                </h1>
                <p className="text-zinc-400 max-w-2xl">
                    Fedezze fel legújabb iparági megoldásainkat élőben. Minden demónk valós idejű adatokon és autonóm ágenseken alapul.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Manufacturing Card */}
                <Card className="border-primary/20 bg-card/50 overflow-hidden group">
                    <div className="aspect-video bg-slate-900 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
                        <ShieldCheck className="w-12 h-12 text-primary/40 group-hover:scale-110 transition-transform duration-500" />
                        <Badge className="absolute top-3 right-3 z-20 bg-primary text-white">VISION AI</Badge>
                    </div>
                    <CardHeader>
                        <CardTitle>Vizuális Minőségellenőrzés</CardTitle>
                        <CardDescription>Gyártósori hiba-detektálás Robotkéz Pro-val.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-xs text-muted-foreground">99.4%-os pontosságú automatikus selejt-felismerés valós időben.</p>
                        <Button className="w-full h-9 gap-2">
                            <Play className="w-4 h-4" /> Demo Indítása
                        </Button>
                    </CardContent>
                </Card>

                {/* Logistics */}
                <LogisticsDemo />

                {/* Finance */}
                <Card className="border-primary/20 bg-card/50">
                    <CardHeader>
                        <CardTitle>Smart Invoice Bridge</CardTitle>
                        <CardDescription>Automata könyvelési asszisztens.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-3 rounded border border-white/5 bg-black/20 space-y-2">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500">Feldolgozott számlák:</span>
                                <span className="text-white font-mono">1,248</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-zinc-500">Megtakarított munkaóra:</span>
                                <span className="text-green-500 font-bold">~42 óra/hó</span>
                            </div>
                        </div>
                        <Button variant="outline" className="w-full h-9 gap-2">
                            <Eye className="w-4 h-4" /> Esettanulmány
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="pt-8 border-t border-white/5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-4">
                        <h2 className="text-2xl font-bold text-white italic">Finanszírozza fejlesztését pályázatból!</h2>
                        <p className="text-sm text-zinc-400">
                            A Brunella Agent System bevezetése az idei évben kiemelkedően magas, akár 90%-os állami támogatással is megvalósítható.
                        </p>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className="text-xs font-medium">Demján Sándor Program</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                <span className="text-xs font-medium">DIMOP Plusz</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <GrantAdvisorWidget />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Badge({ children, className }: { children: React.ReactNode, className?: string }) {
    return <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${className}`}>{children}</span>;
}
