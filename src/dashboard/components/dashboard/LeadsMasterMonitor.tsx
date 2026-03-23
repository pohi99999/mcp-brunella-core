import React, { useState, useEffect, useCallback } from 'react';
import {
    ExternalLink, RefreshCw, CheckCircle2, Clock, Mail,
    BarChart3, Users, MessageSquare, AlertCircle, Copy,
    ChevronDown, ChevronUp, Maximize2, Minimize2, Phone,
    Send, Eye
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { ScrollArea } from '../ui/scroll-area';

// ── Konfiguráció ────────────────────────────────────────────────────────────
const SHEETS_CONFIG = {
    MASTER_SHEET_ID: '1WXTGRnW-FLLUTXTNDHL5q3tntQvXZTBFM21XvarijSA',
    WAVE2_SHEET_ID: '1GCWVHcXmyHeytvI391pQSzltSmoW6RQU_4xY-IN9w-E',
};

const EMBED_URL = (id: string) =>
    `https://docs.google.com/spreadsheets/d/${id}/htmlview?rm=minimal`;

const EDIT_URL = (id: string) =>
    `https://docs.google.com/spreadsheets/d/${id}/edit?usp=sharing`;

// ── Wave 2 kontaktok (localStorage tracking) ────────────────────────────────
const WAVE2_CONTACTS = [
    // Webdesign
    { id: 'a1', category: 'Webdesign', name: 'Webdesign.hu', email: 'info@webdesign.hu', sentAt: '2026-02-27 10:00' },
    { id: 'a2', category: 'Webdesign', name: '2B Digital', email: 'hello@2bdigital.hu', sentAt: '2026-02-27 10:02' },
    { id: 'a3', category: 'Webdesign', name: 'WEBerfolg', email: 'info@weberfolg.hu', sentAt: '2026-02-27 10:04' },
    { id: 'a4', category: 'Webdesign', name: 'Netfoglalo', email: 'info@netfoglalo.hu', sentAt: '2026-02-27 10:06' },
    { id: 'a5', category: 'Webdesign', name: 'Progresszív Studio', email: 'info@progressziv.hu', sentAt: '2026-02-27 10:08' },
    // SEO/PPC
    { id: 'b1', category: 'SEO/PPC', name: 'Ranking.hu', email: 'hello@ranking.hu', sentAt: '2026-02-27 10:30' },
    { id: 'b2', category: 'SEO/PPC', name: 'Growww Digital', email: 'hello@growww.hu', sentAt: '2026-02-27 10:32' },
    { id: 'b3', category: 'SEO/PPC', name: 'Adsolutions', email: 'info@adsolutions.hu', sentAt: '2026-02-27 10:34' },
    { id: 'b4', category: 'SEO/PPC', name: 'Klixio', email: 'hello@klixio.hu', sentAt: '2026-02-27 10:36' },
    { id: 'b5', category: 'SEO/PPC', name: 'iSEO', email: 'info@iseo.hu', sentAt: '2026-02-27 10:38' },
    // PR
    { id: 'c1', category: 'PR', name: 'PR Herald', email: 'info@prherald.hu', sentAt: '2026-02-27 11:00' },
    { id: 'c2', category: 'PR', name: 'Kreativ PR', email: 'hello@kreativpr.hu', sentAt: '2026-02-27 11:02' },
    { id: 'c3', category: 'PR', name: 'Meditor', email: 'info@meditor.hu', sentAt: '2026-02-27 11:04' },
    { id: 'c4', category: 'PR', name: 'BIG', email: 'info@big.hu', sentAt: '2026-02-27 11:06' },
    { id: 'c5', category: 'PR', name: 'Pulse Communications', email: 'hello@pulse.hu', sentAt: '2026-02-27 11:08' },
];

type ContactStatus = 'sent' | 'replied_yes' | 'replied_no' | 'no_response';

interface ContactState {
    status: ContactStatus;
    note: string;
}

type TrackingMap = Record<string, ContactState>;

const STATUS_LABELS: Record<ContactStatus, string> = {
    sent: 'Kiküldve',
    replied_yes: 'Érdeklődik ✅',
    replied_no: 'Elutasítva ❌',
    no_response: 'Nem válaszolt',
};

const STATUS_COLORS: Record<ContactStatus, string> = {
    sent: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    replied_yes: 'bg-green-500/20 text-green-300 border-green-500/30',
    replied_no: 'bg-red-500/20 text-red-300 border-red-500/30',
    no_response: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

// ── Komponens ────────────────────────────────────────────────────────────────
export function LeadsMasterMonitor() {
    const [activeTab, setActiveTab] = useState<'master' | 'wave2' | 'tracking'>('tracking');
    const [iframeKey, setIframeKey] = useState(0);
    const [iframeExpanded, setIframeExpanded] = useState(false);
    const [tracking, setTracking] = useState<TrackingMap>(() => {
        try {
            const stored = localStorage.getItem('leads_master_tracking');
            return stored ? JSON.parse(stored) : {};
        } catch {
            return {};
        }
    });
    const [editingNote, setEditingNote] = useState<string | null>(null);
    const [noteValue, setNoteValue] = useState('');

    // Persist tracking minden módosításnál
    useEffect(() => {
        localStorage.setItem('leads_master_tracking', JSON.stringify(tracking));
    }, [tracking]);

    const updateStatus = useCallback((id: string, status: ContactStatus) => {
        setTracking(prev => ({
            ...prev,
            [id]: { status, note: prev[id]?.note ?? '' },
        }));
        toast.success(`Státusz frissítve: ${STATUS_LABELS[status]}`);
    }, []);

    const saveNote = useCallback((id: string) => {
        setTracking(prev => ({
            ...prev,
            [id]: { status: prev[id]?.status ?? 'sent', note: noteValue },
        }));
        setEditingNote(null);
        toast.success('Megjegyzés mentve');
    }, [noteValue]);

    // Összesítő statisztikák
    const stats = WAVE2_CONTACTS.reduce(
        (acc, c) => {
            const s = tracking[c.id]?.status ?? 'sent';
            acc[s] = (acc[s] ?? 0) + 1;
            return acc;
        },
        {} as Record<string, number>
    );

    const sheetId = activeTab === 'wave2' ? SHEETS_CONFIG.WAVE2_SHEET_ID : SHEETS_CONFIG.MASTER_SHEET_ID;

    return (
        <div className="p-4 space-y-4 h-full overflow-auto">

            {/* ── Fejléc ── */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Users className="w-5 h-5 text-emerald-400" />
                        Leads Master Monitor
                    </h2>
                    <p className="text-sm text-zinc-400 mt-0.5">
                        Kampány nyomon-követés + Google Sheets kezelő
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        onClick={() => {
                            navigator.clipboard.writeText(EDIT_URL(sheetId));
                            toast.success('Link másolva!');
                        }}
                    >
                        <Copy className="w-3.5 h-3.5 mr-1" /> Link másolása
                    </Button>
                    <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => window.open(EDIT_URL(sheetId), '_blank')}
                    >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" /> Megnyitás
                    </Button>
                </div>
            </div>

            {/* ── Stat kártyák ── */}
            <div className="grid grid-cols-4 gap-3">
                <StatCard
                    icon={<Send className="w-4 h-4 text-blue-400" />}
                    label="Kiküldve"
                    value={WAVE2_CONTACTS.length}
                    sub="Wave 2 email"
                    color="blue"
                />
                <StatCard
                    icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
                    label="Érdeklődik"
                    value={stats['replied_yes'] ?? 0}
                    sub="pozitív válasz"
                    color="green"
                />
                <StatCard
                    icon={<MessageSquare className="w-4 h-4 text-orange-400" />}
                    label="Elutasított"
                    value={stats['replied_no'] ?? 0}
                    sub="nem érdekli"
                    color="orange"
                />
                <StatCard
                    icon={<Clock className="w-4 h-4 text-zinc-400" />}
                    label="Várakozás"
                    value={stats['no_response'] ?? 0}
                    sub="nincs válasz"
                    color="zinc"
                />
            </div>

            {/* ── Tabok ── */}
            <div className="flex gap-1 bg-zinc-900 p-1 rounded-lg w-fit">
                {[
                    { key: 'tracking', label: 'Kampány Tracker', icon: <BarChart3 className="w-3.5 h-3.5" /> },
                    { key: 'master', label: 'Leads Master', icon: <Eye className="w-3.5 h-3.5" /> },
                    { key: 'wave2', label: 'Wave 2 Lista', icon: <Users className="w-3.5 h-3.5" /> },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key as typeof activeTab)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === tab.key
                                ? 'bg-zinc-700 text-white'
                                : 'text-zinc-400 hover:text-zinc-300'
                            }`}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ── Kampány Tracker tab ── */}
            {activeTab === 'tracking' && (
                <Card className="bg-white/[0.03] border-white/[0.04] rounded-lg">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-zinc-200">Wave 2 — Outreach Státusz</CardTitle>
                        <CardDescription className="text-zinc-500 text-xs">
                            Kattints a státusz gombra a frissítéshez. Megjegyzés hozzáadásához kattints a névre.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[420px]">
                            {['Webdesign', 'SEO/PPC', 'PR'].map(cat => (
                                <div key={cat} className="mb-2">
                                    <div className="px-4 py-1.5 text-xs font-semibold text-zinc-500 uppercase tracking-wider bg-zinc-800/50">
                                        {cat}
                                    </div>
                                    {WAVE2_CONTACTS.filter(c => c.category === cat).map(contact => {
                                        const state = tracking[contact.id];
                                        const status: ContactStatus = state?.status ?? 'sent';
                                        return (
                                            <div
                                                key={contact.id}
                                                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/[0.04] hover:bg-zinc-800/40 transition-colors"
                                            >
                                                {/* Név + email */}
                                                <div className="flex-1 min-w-0">
                                                    <button
                                                        className="text-sm text-zinc-200 font-medium hover:text-emerald-400 transition-colors text-left"
                                                        onClick={() => {
                                                            setEditingNote(editingNote === contact.id ? null : contact.id);
                                                            setNoteValue(state?.note ?? '');
                                                        }}
                                                    >
                                                        {contact.name}
                                                    </button>
                                                    <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                                        <Mail className="w-3 h-3" />
                                                        {contact.email}
                                                        {state?.note && (
                                                            <span className="ml-2 text-yellow-400/80 italic truncate max-w-[160px]">
                                                                📝 {state.note}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {editingNote === contact.id && (
                                                        <div className="flex gap-2 mt-2">
                                                            <input
                                                                autoFocus
                                                                className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                                                                placeholder="Megjegyzés..."
                                                                value={noteValue}
                                                                onChange={e => setNoteValue(e.target.value)}
                                                                onKeyDown={e => { if (e.key === 'Enter') saveNote(contact.id); if (e.key === 'Escape') setEditingNote(null); }}
                                                            />
                                                            <Button size="sm" className="h-6 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => saveNote(contact.id)}>
                                                                Mentés
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Státusz badge */}
                                                <span className={`text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_COLORS[status]}`}>
                                                    {STATUS_LABELS[status]}
                                                </span>

                                                {/* Státusz gombok */}
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        title="Érdeklődik"
                                                        onClick={() => updateStatus(contact.id, 'replied_yes')}
                                                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${status === 'replied_yes' ? 'bg-green-600' : 'hover:bg-zinc-700 text-zinc-500'}`}
                                                    >
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                                    </button>
                                                    <button
                                                        title="Elutasítva"
                                                        onClick={() => updateStatus(contact.id, 'replied_no')}
                                                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${status === 'replied_no' ? 'bg-red-800' : 'hover:bg-zinc-700 text-zinc-500'}`}
                                                    >
                                                        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                                                    </button>
                                                    <button
                                                        title="Nem válaszolt"
                                                        onClick={() => updateStatus(contact.id, 'no_response')}
                                                        className={`w-6 h-6 rounded flex items-center justify-center transition-colors ${status === 'no_response' ? 'bg-zinc-600' : 'hover:bg-zinc-700 text-zinc-500'}`}
                                                    >
                                                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            {/* ── Google Sheets iframe tab ── */}
            {(activeTab === 'master' || activeTab === 'wave2') && (
                <Card className="bg-white/[0.03] border-white/[0.04] rounded-lg">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm text-zinc-200">
                                {activeTab === 'master' ? '📊 Leads Master Táblázat' : '📋 Wave 2 Leads Lista'}
                            </CardTitle>
                            <CardDescription className="text-zinc-500 text-xs mt-0.5">
                                Google Sheets beágyazott nézet (olvasható) • szerkesztéshez használd a Megnyitás gombot
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-zinc-400 hover:text-white h-7 w-7 p-0"
                                title="Frissítés"
                                onClick={() => { setIframeKey(k => k + 1); toast.info('Táblázat frissítve'); }}
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-zinc-400 hover:text-white h-7 w-7 p-0"
                                title={iframeExpanded ? 'Összezárás' : 'Nagyítás'}
                                onClick={() => setIframeExpanded(e => !e)}
                            >
                                {iframeExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 overflow-hidden rounded-b-xl">
                        <iframe
                            key={iframeKey}
                            src={EMBED_URL(sheetId)}
                            className={`w-full border-0 transition-all duration-300 ${iframeExpanded ? 'h-[700px]' : 'h-[480px]'}`}
                            title="Google Sheets"
                            loading="lazy"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                    </CardContent>
                </Card>
            )}

            {/* ── Wave 1 Info ── */}
            <Card className="bg-zinc-900/50 border-white/[0.04]">
                <CardContent className="p-3">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                        <div className="text-xs text-zinc-400">
                            <span className="text-zinc-300 font-medium">Wave 1</span> — 10 ügynökség, 2026-02-26 10:00
                            <span className="mx-2 text-zinc-600">•</span>
                            <span className="text-zinc-300 font-medium">Wave 2</span> — 15 kontakt, 2026-02-27 10:00–11:00
                            <span className="mx-2 text-zinc-600">•</span>
                            Follow-up: <span className="text-yellow-400">2026-03-03</span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                onClick={() => window.open(EDIT_URL(SHEETS_CONFIG.WAVE2_SHEET_ID), '_blank')}
                            >
                                <ExternalLink className="w-3 h-3 mr-1" /> Wave 2 minták
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-zinc-700 text-zinc-400 hover:bg-zinc-800"
                                onClick={() => window.open(EDIT_URL(SHEETS_CONFIG.MASTER_SHEET_ID), '_blank')}
                            >
                                <ExternalLink className="w-3 h-3 mr-1" /> Master lista
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}

// ── Segéd-komponens ──────────────────────────────────────────────────────────
function StatCard({
    icon, label, value, sub, color,
}: {
    icon: React.ReactNode;
    label: string;
    value: number;
    sub: string;
    color: 'blue' | 'green' | 'orange' | 'zinc';
}) {
    const borders: Record<string, string> = {
        blue: 'border-blue-500/20',
        green: 'border-green-500/20',
        orange: 'border-orange-500/20',
        zinc: 'border-zinc-700',
    };
    return (
        <Card className={`bg-zinc-900 ${borders[color]}`}>
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-zinc-400">{label}</span></div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{sub}</div>
            </CardContent>
        </Card>
    );
}
