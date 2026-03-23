import React, { useState } from 'react';
import { 
    Briefcase, 
    Users, 
    FileText, 
    Eye, 
    Lightbulb, 
    TrendingUp, 
    ShieldCheck,
    ArrowRight,
    Search,
    ChevronRight,
    Star,
    BookOpen,
    Trello,
    Home,
    Scale,
    Megaphone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { LeadMiningWidget } from './LeadMiningWidget';
import { InvoiceSyncWidget } from './InvoiceSyncWidget';
import { MarketWatcherWidget } from './MarketWatcherWidget';
import { InnovationBridgeWidget } from './InnovationBridgeWidget';
import { DigitalHRWidget } from './DigitalHRWidget';
import { GrantHunterWidget } from './GrantHunterWidget'; // To be created next

export function EnterpriseSuitePanel() {
    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black tracking-tight text-white flex items-center gap-3">
                    <Briefcase className="w-8 h-8 text-primary" />
                    Brunella Enterprise Suite
                </h1>
                <p className="text-zinc-500 max-w-2xl">
                    Professzionális üzleti modulok KKV-k számára. Adatvezérelt döntéstámogatás, automatizált adminisztráció és keresztiparágú innováció.
                </p>
            </div>

            <Tabs defaultValue="innovation" className="w-full">
                <TabsList className="grid grid-cols-6 w-full lg:w-[1000px] bg-secondary/30 backdrop-blur-md border border-white/[0.04] h-12 p-1">
                    <TabsTrigger value="innovation" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <Lightbulb className="w-3 h-3" />
                        Innovation
                    </TabsTrigger>
                    <TabsTrigger value="hr" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <Users className="w-3 h-3" />
                        HR
                    </TabsTrigger>
                    <TabsTrigger value="grants" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <FileText className="w-3 h-3" />
                        Grants
                    </TabsTrigger>
                    <TabsTrigger value="leads" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <Star className="w-3 h-3" />
                        Leads
                    </TabsTrigger>
                    <TabsTrigger value="finance" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <ShieldCheck className="w-3 h-3" />
                        Finance
                    </TabsTrigger>
                    <TabsTrigger value="market" className="data-[state=active]:bg-primary data-[state=active]:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
                        <Eye className="w-3 h-3" />
                        Market
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="innovation" className="animate-in fade-in zoom-in duration-300">
                        <InnovationBridgeWidget />
                    </TabsContent>
                    <TabsContent value="hr" className="animate-in fade-in zoom-in duration-300">
                        <DigitalHRWidget />
                    </TabsContent>
                    <TabsContent value="grants" className="animate-in fade-in zoom-in duration-300">
                        <GrantHunterWidget />
                    </TabsContent>
                    <TabsContent value="leads" className="animate-in fade-in zoom-in duration-300">
                        <LeadMiningWidget />
                    </TabsContent>
                    <TabsContent value="finance" className="animate-in fade-in zoom-in duration-300">
                        <InvoiceSyncWidget />
                    </TabsContent>
                    <TabsContent value="market" className="animate-in fade-in zoom-in duration-300">
                        <MarketWatcherWidget />
                    </TabsContent>
                </div>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 opacity-60">
                <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.04] flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                        <div className="text-sm font-bold">ROI Kalkulátor</div>
                        <div className="text-[10px] uppercase text-zinc-500 font-mono">Hamarosan</div>
                    </div>
                </div>
                <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.04] flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <div className="text-sm font-bold">Compliance Guard</div>
                        <div className="text-[10px] uppercase text-zinc-500 font-mono">Beta</div>
                    </div>
                </div>
                <div className="p-4 rounded-xl border border-white/[0.04] bg-white/[0.04] flex items-center gap-4">
                    <div className="p-3 bg-orange-500/10 rounded-lg">
                        <Star className="w-5 h-5 text-orange-400" />
                    </div>
                    <div>
                        <div className="text-sm font-bold">Üzleti Mentor</div>
                        <div className="text-[10px] uppercase text-zinc-500 font-mono">Prémium</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
