import React, { useState } from 'react';
import { 
    ShieldAlert, 
    Target, 
    Zap, 
    Mail, 
    BarChart3, 
    Globe, 
    FileCode, 
    CheckCircle2,
    Loader2
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '../ui/select';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';
import { useSocket } from '../../context/SocketContext';

export function TrojanHorseCommandCenter() {
    const [industry, setIndustry] = useState('');
    const [targetUrl, setTargetUrl] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [step, setStep] = useState(0); // 0: Idle, 1: Scraping, 2: Validating, 3: Generating Demo, 4: Ready
    const { socket } = useSocket();

    const handleStartCampaign = () => {
        if (!industry || !targetUrl) {
            toast.error("Kérlek válassz iparágat és adj meg egy cél URL-t!");
            return;
        }

        setIsRunning(true);
        setStep(1);
        toast.info("Trójai Faló kampány elindítva...");

        // Simulate the process steps for the UI
        setTimeout(() => setStep(2), 2000);
        setTimeout(() => setStep(3), 4000);
        setTimeout(() => {
            setStep(4);
            setIsRunning(false);
            toast.success("A személyre szabott demo elkészült!");
        }, 7000);

        socket?.emit('agent:execute', {
            agent: 'orchestrator',
            task: `Indíts trójai faló kampányt a ${targetUrl} cégnek a ${industry} szektorban.`
        });
    };

    const getProgressValue = () => {
        switch(step) {
            case 1: return 25;
            case 2: return 50;
            case 3: return 75;
            case 4: return 100;
            default: return 0;
        }
    };

    const getStepLabel = () => {
        switch(step) {
            case 1: return "Adatgyűjtés és elemzés...";
            case 2: return "E-mail validáció folyamatban...";
            case 3: return "Személyre szabott demo generálása...";
            case 4: return "Kampány előkészítve!";
            default: return "Készen áll az indításra";
        }
    };

    return (
        <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Aktív Kampányok</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-primary">12</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-green-500/5 border-green-500/20">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Validált Leadek</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-green-500">842</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="bg-blue-500/5 border-blue-500/20 sm:col-span-2 md:col-span-1">
                    <CardHeader className="p-3 md:pb-2">
                        <CardDescription className="text-[10px] md:text-xs uppercase">Demo Megnyitások</CardDescription>
                        <CardTitle className="text-xl md:text-2xl font-bold text-blue-500">45</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card className="shadow-xl border-primary/20">
                <CardHeader className="p-4 md:p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full text-primary shrink-0">
                            <ShieldAlert className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <CardTitle className="text-base md:text-xl">Trójai Faló Kampányvezérlő</CardTitle>
                            <CardDescription className="text-xs md:text-sm">Személyre szabott AI megoldások prezentálása</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        <div className="space-y-2">
                            <label className="text-xs md:text-sm font-medium">Cél Iparág</label>
                            <Select onValueChange={setIndustry} value={industry}>
                                <SelectTrigger className="h-9 md:h-10 text-sm">
                                    <SelectValue placeholder="Válassz iparágat..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="clinic">Magánklinika / Egészségügy</SelectItem>
                                    <SelectItem value="real-estate">Ingatlanközvetítő</SelectItem>
                                    <SelectItem value="accounting">Könyvelőiroda</SelectItem>
                                    <SelectItem value="ecommerce">B2B E-kereskedelem</SelectItem>
                                    <SelectItem value="other">Egyéb KKV</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs md:text-sm font-medium">Célcég URL / Domain</label>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <Input 
                                    placeholder="pl. pelda-ceg.hu" 
                                    value={targetUrl}
                                    onChange={(e) => setTargetUrl(e.target.value)}
                                    className="h-9 md:h-10 text-sm"
                                />
                                <Button 
                                    onClick={handleStartCampaign} 
                                    disabled={isRunning}
                                    className="bg-primary hover:bg-primary/90 h-9 md:h-10 whitespace-nowrap"
                                >
                                    {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                                    Indítás
                                </Button>
                            </div>
                        </div>
                    </div>

                    {isRunning || step > 0 ? (
                        <div className="p-4 md:p-6 rounded-xl bg-secondary/10 border border-primary/10 space-y-4">
                            <div className="flex justify-between items-center text-xs md:text-sm">
                                <span className="font-medium flex items-center gap-2">
                                    {step < 4 ? <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin text-primary" /> : <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4 text-green-500" />}
                                    {getStepLabel()}
                                </span>
                                <span className="text-muted-foreground font-mono">{getProgressValue()}%</span>
                            </div>
                            <Progress value={getProgressValue()} className="h-1.5 md:h-2" />
                            
                            <div className="grid grid-cols-4 gap-1.5 md:gap-2 pt-1 md:pt-2">
                                <div className={`h-1 rounded-full ${step >= 1 ? 'bg-primary' : 'bg-muted'}`} />
                                <div className={`h-1 rounded-full ${step >= 2 ? 'bg-primary' : 'bg-muted'}`} />
                                <div className={`h-1 rounded-full ${step >= 3 ? 'bg-primary' : 'bg-muted'}`} />
                                <div className={`h-1 rounded-full ${step >= 4 ? 'bg-primary' : 'bg-muted'}`} />
                            </div>
                        </div>
                    ) : null}

                    {step === 4 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card className="border-green-500/30 bg-green-500/5">
                                <CardContent className="p-3 md:p-4 flex flex-col gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-green-500/20 rounded-lg text-green-600 shrink-0">
                                            <Globe className="w-4 h-4 md:w-5 md:h-5" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">Generált Demo URL</div>
                                            <div className="text-xs md:text-sm font-mono font-bold truncate">https://demo.brunella.ai/preview/xyz-123</div>
                                        </div>
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <Button variant="outline" size="sm" className="h-8 md:h-9 flex-1">
                                            <FileCode className="w-3.5 h-3.5 mr-2" />
                                            Megtekintés
                                        </Button>
                                        <Button size="sm" className="h-8 md:h-9 bg-green-600 hover:bg-green-700 flex-1">
                                            <Mail className="w-3.5 h-3.5 mr-2" />
                                            Email Kiküldése
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
