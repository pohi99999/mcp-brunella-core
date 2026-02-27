import React, { useState } from 'react';
import { HelpCircle, HandCoins, ArrowRight, CheckCircle2, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { toast } from 'sonner';

export function GrantAdvisorWidget() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const checkEligibility = async () => {
        setLoading(true);
        // Simulated API call to /api/v1/grants/advisor
        setTimeout(() => {
            setResult({
                grant_name: "Demján Sándor Program",
                support: "90%",
                max: "12M Ft",
                next: "Demo Megtekintése"
            });
            setStep(3);
            setLoading(false);
            toast.success("Megfelelő pályázatot találtunk!");
        }, 2000);
    };

    return (
        <Card className="h-full border-primary/20 bg-card/50 backdrop-blur-sm">
            <CardHeader className="p-4">
                <CardTitle className="flex items-center gap-2 text-sm font-bold">
                    <HandCoins className="w-4 h-4 text-primary" />
                    Pályázati Tanácsadó 2026
                </CardTitle>
                <CardDescription className="text-[10px]">Tudja meg, mennyi támogatást kaphat!</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="p-3 rounded-lg bg-secondary/30 text-[11px] leading-relaxed">
                            "Szia! Én a Brunella Pályázati Asszisztens vagyok. Segítek megtalálni a legjobb finanszírozást az MI fejlesztésedhez."
                        </div>
                        <Button className="w-full h-9" onClick={() => setStep(2)}>
                            Kalkuláció Indítása
                        </Button>
                    </div>
                )}

                {step === 2 && (
                    <div className="space-y-3">
                        <Input placeholder="Alkalmazottak száma" type="number" className="h-8 text-xs" />
                        <Input placeholder="Éves nettó árbevétel (M Ft)" type="number" className="h-8 text-xs" />
                        <Button className="w-full h-9" onClick={checkEligibility} disabled={loading}>
                            {loading ? "Elemzés..." : "Eredmény Megtekintése"}
                        </Button>
                    </div>
                )}

                {step === 3 && result && (
                    <div className="animate-in zoom-in-95 duration-300 space-y-4 text-center py-2">
                        <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto" />
                        <div>
                            <div className="text-lg font-bold text-primary">{result.grant_name}</div>
                            <div className="text-xs text-muted-foreground">Támogatási intenzitás: <span className="text-white font-bold">{result.support}</span></div>
                        </div>
                        <div className="p-2 rounded bg-green-500/10 border border-green-500/20 text-[10px] text-green-400">
                            Ön akár {result.max} vissza nem térítendő támogatásra jogosult.
                        </div>
                        <Button className="w-full gap-2 h-9 bg-primary">
                            <MessageSquare className="w-4 h-4" />
                            {result.next}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
