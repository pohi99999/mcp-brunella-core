import React, { useState, useEffect } from "react";
import
{
    Users,
    Banknote,
    Receipt,
    TrendingUp,
    Clock,
    RefreshCcw,
    Sparkles,
    CheckCircle2,
    XCircle,
    AlertCircle,
    UserPlus,
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    Calendar,
    Settings2,
    Search,
    ChevronRight,
    Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { logInfo, logError } from "@/utils/logger.js";

interface Worker
{
    id: string;
    name: string;
    gross: number;
    deductions: number;
    net: number;
    status: "kifizetve" | "függőben" | "feldolgozás alatt";
}

interface AdvanceRequest
{
    id: string;
    workerName: string;
    amount: number;
    date: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
}

interface PayrollSummary
{
    current_gross: number;
    current_deductions: number;
    tax_savings: number;
    active_workers: number;
    pending_advances: number;
    mom_growth_percent: number;
    cron_status: "OK" | "PENDING" | "ERROR";
    last_cron_run: string;
}

function formatHUF ( value: number ): string
{
    return new Intl.NumberFormat( "hu-HU", {
        style: "currency",
        currency: "HUF",
        maximumFractionDigits: 0,
    } ).format( value );
}

function StatCard ( {
    label,
    value,
    detail,
    icon: Icon,
    trend,
    variant = "blue"
}: {
    label: string;
    value: string;
    detail: string;
    icon: React.ElementType;
    trend?: number;
    variant?: "blue" | "emerald" | "amber" | "rose";
} )
{
    const variants = {
        blue: "hover:border-cyan-500/50 hover:bg-cyan-500/[0.02] hover:shadow-[0_0_20px_rgba(6,182,212,0.1)] text-cyan-500",
        emerald: "hover:border-emerald-500/50 hover:bg-emerald-500/[0.02] hover:shadow-[0_0_20px_rgba(16,185,129,0.1)] text-emerald-500",
        amber: "hover:border-amber-500/50 hover:bg-amber-500/[0.02] hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] text-amber-500",
        rose: "hover:border-rose-500/50 hover:bg-rose-500/[0.02] hover:shadow-[0_0_20px_rgba(244,63,94,0.1)] text-rose-500",
    };

    const iconColors = {
        blue: "text-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)]",
        emerald: "text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]",
        amber: "text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]",
        rose: "text-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]",
    };

    const baseClass = "group relative rounded-2xl border border-white/[0.05] bg-white/[0.02] p-5 transition-all duration-300 backdrop-blur-sm";
    const variantClass = variants[variant];

    return (
        <div className={baseClass + " " + variantClass}>
            <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.22em] text-zinc-500 group-hover:text-inherit">
                <span>{label}</span>
                <Icon className={"h-4 w-4 " + iconColors[variant]} />
            </div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-white group-hover:text-white/90">
                {value}
            </div>
            <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-zinc-500 group-hover:text-zinc-400">{detail}</p>
                {trend !== undefined && (
                    <div className={"flex items-center gap-1 text-[11px] font-medium " + (trend >= 0 ? "text-emerald-400" : "text-rose-400")}>
                        {trend >= 0 ? "+" : ""}{trend}%
                        <TrendingUp className={"h-3 w-3 " + (trend < 0 ? "rotate-180" : "")} />
                    </div>
                )}
            </div>
            <div className="absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none">
                <div className={"absolute inset-0 rounded-2xl blur-xl " + (variant === 'blue' ? 'bg-cyan-500/5' : variant === 'emerald' ? 'bg-emerald-500/5' : 'bg-zinc-500/5')}></div>
            </div>
        </div>
    );
}

export const PayrollDashboard: React.FC = () =>
{
    const [summary, setSummary] = useState<PayrollSummary | null>( null );
    const [workers, setWorkers] = useState<Worker[]>( [] );
    const [advances, setAdvances] = useState<AdvanceRequest[]>( [] );
    const [loading, setLoading] = useState( true );
    const [searchQuery, setSearchQuery] = useState( "" );

    const fetchData = async () =>
    {
        setLoading( true );
        try
        {
            const mockSummary: PayrollSummary = {
                current_gross: 14500000,
                current_deductions: 4857500,
                tax_savings: 1240000,
                active_workers: 12,
                pending_advances: 3,
                mom_growth_percent: 2.4,
                cron_status: "OK",
                last_cron_run: "2026. április 12. 08:00"
            };

            const mockWorkers: Worker[] = [
                { id: "1", name: "Kovács János", gross: 850000, deductions: 284750, net: 565250, status: "kifizetve" },
                { id: "2", name: "Szabó Beatrix", gross: 1200000, deductions: 402000, net: 798000, status: "kifizetve" },
                { id: "3", name: "Nagy László", gross: 950000, deductions: 318250, net: 631750, status: "függőben" },
                { id: "4", name: "Kiss Erzsébet", gross: 750000, deductions: 251250, net: 498750, status: "kifizetve" },
                { id: "5", name: "Tóth Gábor", gross: 1100000, deductions: 368500, net: 731500, status: "feldolgozás alatt" },
                { id: "6", name: "Molnár Anna", gross: 880000, deductions: 294800, net: 585200, status: "kifizetve" },
            ];

            const mockAdvances: AdvanceRequest[] = [
                { id: "adv1", workerName: "Nagy László", amount: 150000, date: "2026.04.15", status: "PENDING" },
                { id: "adv2", workerName: "Kovács János", amount: 200000, date: "2026.04.16", status: "PENDING" },
                { id: "adv3", workerName: "Szabó Beatrix", amount: 50000, date: "2026.04.17", status: "PENDING" },
            ];

            await new Promise( resolve => setTimeout( resolve, 1000 ) );
            setSummary( mockSummary );
            setWorkers( mockWorkers );
            setAdvances( mockAdvances );
            logInfo( "PayrollDashboard", "Bérszemfejtési adatok frissítve." );
        } catch ( error )
        {
            logError( "PayrollDashboard", "Hiba az adatok lekérésekor: " + error );
        } finally
        {
            setLoading( false );
        }
    };

    useEffect( () =>
    {
        fetchData();
        const interval = setInterval( fetchData, 60000 );
        return () => clearInterval( interval );
    }, [] );

    const handleAdvanceAction = ( id: string, action: "APPROVE" | "REJECT" ) =>
    {
        logInfo( "PayrollDashboard", "Action handled for " + id );
        setAdvances( prev => prev.filter( a => a.id !== id ) );
        if ( summary )
        {
            setSummary( { ...summary, pending_advances: Math.max(0, summary.pending_advances - 1) } );
        }
    };

    const filteredWorkers = workers.filter( w =>
        w.name.toLowerCase().includes( searchQuery.toLowerCase() )
    );

    if ( loading && !summary )
    {
        return (
            <div className="flex h-96 w-full items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <RefreshCcw className={"h-12 w-12 animate-spin text-cyan-500 opacity-50"} />
                    <p className="text-sm tracking-widest text-zinc-500 uppercase">Adatok szinkronizálása...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen space-y-8 bg-transparent p-1 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                            <Banknote className="h-6 w-6 text-cyan-400" />
                        </div>
                        <h1 className="text-4xl font-black tracking-tighter text-white uppercase">
                            BÉRSZEMFEJTŐ <span className="text-cyan-500 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">DASHBOARD</span>
                        </h1>
                    </div>
                    <p className="text-zinc-500 text-xs uppercase tracking-[0.3em] pl-11">
                        Core Payroll & Automated Payout Velocity
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white/[0.03] border border-white/[0.05] rounded-2xl p-4 backdrop-blur-md">
                    <div className="space-y-1 text-right">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Havi Cron Státusz (12-ei)</p>
                        <div className="flex items-center justify-end gap-2 text-sm font-medium">
                           <span className="text-zinc-400 font-mono text-xs tracking-tight">{summary?.last_cron_run}</span>
                           <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-3">
                                <span className="relative flex h-2 w-2">
                                    <span className={"animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 " + (summary?.cron_status === 'OK' ? 'bg-cyan-400' : 'bg-amber-400')}></span>
                                    <span className={"relative inline-flex rounded-full h-2 w-2 " + (summary?.cron_status === 'OK' ? 'bg-cyan-500' : 'bg-amber-500')}></span>
                                </span>
                                <span className={"text-[10px] uppercase font-black tracking-widest " + (summary?.cron_status === 'OK' ? "text-cyan-400" : "text-amber-400")}>
                                    {summary?.cron_status === 'OK' ? "AKTÍV" : "FÜGGŐBEN"}
                                </span>
                           </div>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-10 w-10 rounded-xl hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors border border-white/5"
                        onClick={fetchData}
                    >
                        <RefreshCcw className={"h-4 w-4 " + (loading ? 'animate-spin' : '')} />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    label="Összes Bérköltség"
                    value={summary ? formatHUF( summary.current_gross ) : "0 Ft"}
                    detail="Havi elszámolás (Bruttó)"
                    icon={Banknote}
                    trend={summary?.mom_growth_percent}
                    variant="blue"
                />
                <StatCard
                    label="Összes Levonás"
                    value={summary ? formatHUF( summary.current_deductions ) : "0 Ft"}
                    detail="SZJA, TB és egyéb járulékok"
                    icon={Receipt}
                    variant="rose"
                />
                <StatCard
                    label="Megtakarított SZJA"
                    value={summary ? formatHUF( summary.tax_savings ) : "0 Ft"}
                    detail="Családi és egyéb kedvezmények"
                    icon={Sparkles}
                    variant="emerald"
                />
                <StatCard
                    label="Függő Előlegek"
                    value={summary?.pending_advances.toString() || "0"}
                    detail="Pénzügyi jóváhagyásra vár"
                    icon={Wallet}
                    variant="amber"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-white/[0.05] bg-white/[0.01] backdrop-blur-3xl rounded-[2rem] overflow-hidden group shadow-2xl shadow-black/40">
                        <CardHeader className="pb-4 border-b border-white/[0.03] p-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
                                        <Users className="h-5 w-5 text-cyan-500" />
                                        Havi Kifizetési Lista
                                    </CardTitle>
                                    <CardDescription className="text-zinc-500 text-xs uppercase tracking-widest">
                                        Aktuális állomány bérszámfejtési státusza
                                    </CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative group/search">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-600 transition-colors group-hover/search:text-cyan-500" />
                                        <input
                                            type="text"
                                            placeholder="KERESÉS..."
                                            className="h-10 w-full sm:w-48 bg-white/5 border border-white/5 rounded-xl pl-10 pr-4 text-[10px] font-bold tracking-widest uppercase focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all placeholder:text-zinc-700"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-zinc-500 hover:text-white hover:bg-white/5 rounded-xl border border-white/5">
                                        <Filter className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto p-4 sm:p-8">
                                <table className="w-full text-left border-separate border-spacing-y-2">
                                    <thead>
                                        <tr className="text-[10px] uppercase tracking-[0.2em] text-zinc-600 font-black">
                                            <th className="pb-4 px-4">Dolgozó</th>
                                            <th className="pb-4 px-4">Bruttó</th>
                                            <th className="pb-4 px-4">Levonás</th>
                                            <th className="pb-4 px-4">Nettó</th>
                                            <th className="pb-4 px-4">Státusz</th>
                                            <th className="pb-4 px-4 text-right">Fájl</th>
                                        </tr>
                                    </thead>
                                    <tbody className="">
                                        {filteredWorkers.map( ( worker ) => (
                                            <tr key={worker.id} className="group/row bg-white/[0.01] hover:bg-cyan-500/[0.03] transition-all duration-300">
                                                <td className="py-4 px-4 rounded-l-2xl border-y border-l border-white/[0.03]">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center text-[10px] font-black text-cyan-400 group-hover/row:border-cyan-500/30 group-hover/row:shadow-[0_0_15px_rgba(6,182,212,0.15)] transition-all">
                                                            {worker.name.split(' ').map(n => n[0]).join('')}
                                                        </div>
                                                        <span className="text-sm font-bold text-zinc-100 group-hover/row:text-white">{worker.name}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-sm text-zinc-400 border-y border-white/[0.03]">{formatHUF( worker.gross )}</td>
                                                <td className="py-4 px-4 text-sm text-rose-500/60 border-y border-white/[0.03]">-{formatHUF( worker.deductions )}</td>
                                                <td className="py-4 px-4 text-sm font-black text-zinc-100 tracking-tight border-y border-white/[0.03]">{formatHUF( worker.net )}</td>
                                                <td className="py-4 px-4 border-y border-white/[0.03]">
                                                    <div className={"inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest " + (
                                                        worker.status === 'kifizetve' ? 'bg-emerald-500/5 text-emerald-400 border border-emerald-500/10' :
                                                        worker.status === 'függőben' ? 'bg-amber-500/5 text-amber-400 border border-amber-500/10' :
                                                        'bg-cyan-500/5 text-cyan-400 border border-cyan-500/10'
                                                    )}>
                                                        {worker.status === 'kifizetve' && <CheckCircle2 className="h-3 w-3" />}
                                                        {worker.status === 'függőben' && <Clock className="h-3 w-3" />}
                                                        {worker.status === 'feldolgozás alatt' && <RefreshCcw className="h-3 w-3 animate-spin" />}
                                                        {worker.status}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4 text-right rounded-r-2xl border-y border-r border-white/[0.03]">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg">
                                                        <ArrowUpRight className="h-4 w-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ) )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-8 pb-8 flex items-center justify-between">
                                <p className="text-[10px] uppercase font-bold tracking-widest text-zinc-600">ÖSSZESEN {filteredWorkers.length} RECORD</p>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="h-8 border-white/5 bg-white/5 text-zinc-500 hover:text-white rounded-lg px-4 text-[10px] font-black uppercase tracking-widest">
                                        Back
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg px-4 text-[10px] font-black uppercase tracking-widest">
                                        1
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-8 border-white/5 bg-white/5 text-zinc-500 hover:text-white rounded-lg px-4 text-[10px] font-black uppercase tracking-widest">
                                        Next
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <Card className="border-white/[0.05] bg-white/[0.01] backdrop-blur-3xl rounded-[2rem] overflow-hidden shadow-2xl shadow-black/40">
                        <CardHeader className="pb-4 p-8 border-b border-white/[0.03]">
                            <CardTitle className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
                                <Wallet className="h-5 w-5 text-amber-500" />
                                ELŐLEG Jóváhagyás
                            </CardTitle>
                            <CardDescription className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
                                N8N WEBHOOK INBOUND PIPELINE
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 p-8">
                            {advances.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 space-y-4">
                                    <div className="h-16 w-16 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm font-black text-zinc-300 uppercase tracking-tight">Minden kérés elszámolva</p>
                                        <p className="text-[10px] uppercase tracking-[0.2em] opacity-40">Queue is empty</p>
                                    </div>
                                </div>
                            ) : (
                                advances.map( ( adv ) => (
                                    <div key={adv.id} className="p-5 rounded-2xl bg-white/[0.02] border border-white/[0.03] space-y-5 group/adv hover:border-amber-500/30 transition-all duration-300">
                                        <div className="flex items-start justify-between">
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-zinc-100 group-hover/adv:text-amber-50 uppercase tracking-tight">{adv.workerName}</p>
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest leading-none">
                                                    <Calendar className="h-3 w-3" />
                                                    {adv.date}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.3)]">{formatHUF( adv.amount )}</p>
                                                <span className="text-[9px] font-black uppercase text-amber-500/30 tracking-widest">ADVANCE REQ</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <Button
                                                onClick={() => handleAdvanceAction( adv.id, "REJECT" )}
                                                variant="outline"
                                                className="h-10 border-white/5 bg-white/5 text-rose-500 hover:bg-rose-500/20 hover:border-rose-500/30 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all"
                                            >
                                                <XCircle className="h-3.5 w-3.5 mr-2" />
                                                ELUTASÍT
                                            </Button>
                                            <Button
                                                onClick={() => handleAdvanceAction( adv.id, "APPROVE" )}
                                                className="h-10 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                                JÓVÁHAGY
                                            </Button>
                                        </div>
                                    </div>
                                ) )
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-white/[0.05] bg-white/[0.01] backdrop-blur-3xl rounded-[2rem] overflow-hidden">
                        <CardHeader className="pb-2 p-8 border-b border-white/[0.03]">
                            <CardTitle className="text-xs font-black flex items-center gap-2 uppercase text-zinc-500 tracking-[0.2em]">
                                <Settings2 className="h-4 w-4 text-cyan-500" />
                                Gyorsműveletek
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-1 p-4">
                            <Button variant="ghost" className="justify-start gap-4 h-12 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-500/5 rounded-2xl group/btn border border-transparent hover:border-cyan-500/10 transition-all">
                                <UserPlus className="h-4 w-4 text-cyan-500 group-hover:shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Új dolgozó regisztrálása</span>
                            </Button>
                            <Button variant="ghost" className="justify-start gap-4 h-12 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/5 rounded-2xl group/btn2 border border-transparent hover:border-emerald-500/10 transition-all">
                                <ArrowUpRight className="h-4 w-4 text-emerald-500 transition-all" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Bérjegyzékek küldése</span>
                            </Button>
                            <Button variant="ghost" className="justify-start gap-4 h-12 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/5 rounded-2xl group/btn3 border border-transparent hover:border-rose-500/10 transition-all">
                                <AlertCircle className="h-4 w-4 text-rose-500 transition-all" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Kritikus hibák elemzése</span>
                            </Button>
                        </CardContent>
                    </Card>

                    <div className="relative p-8 rounded-[2rem] bg-gradient-to-br from-cyan-500/[0.07] to-transparent border border-cyan-500/10 overflow-hidden group shadow-xl">
                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20">
                                    <Receipt className="h-4 w-4 text-cyan-400" />
                                </div>
                                <span className="text-[11px] font-black text-white uppercase tracking-widest">ADÓBEVALLÁS 2026 Q1</span>
                            </div>
                            <p className="text-[10px] text-zinc-500 leading-relaxed font-bold uppercase tracking-widest">
                                A negyedéves adó- és járulékbevallás tervezete elkészült. Kész a beküldésre az 08-as nyomtatványon.
                            </p>
                            <Button variant="link" className="text-[10px] font-black text-cyan-400 p-0 h-auto hover:text-cyan-300 uppercase tracking-widest">
                                Megtekintés és Beküldés <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                        </div>
                        <div className="absolute top-0 right-0 -m-8 h-32 w-32 bg-cyan-500/10 blur-[60px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-1000"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};
