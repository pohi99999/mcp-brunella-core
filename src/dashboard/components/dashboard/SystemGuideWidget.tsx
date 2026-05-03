import { useMemo, useState } from "react";
import { BookOpen, Eye, FileText, Globe, Info, Lightbulb, Map, Scale, Search, ShieldCheck, Target, Users, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ScrollArea } from "../ui/scroll-area";
import { Badge } from "../ui/badge";

interface GuideItem {
    id: string;
    title: string;
    icon: typeof Lightbulb;
    description: string;
    howTo: string;
    useCase: string;
}

const GUIDE_DATA: GuideItem[] = [
    { id: "innovation", title: "Innovation Bridge", icon: Lightbulb, description: "Keresztiparágú innovációs motor.", howTo: "Írd le a problémát természetes nyelven.", useCase: "Ha elakadtál egy optimalizálási feladaton." },
    { id: "property", title: "Property Visionary", icon: Target, description: "Ingatlan stratégiai értékesítő.", howTo: "Adj meg egy ingatlan leírást vagy tölts fel prospektust.", useCase: "Ipari területek vagy lakóparkok vevőinek felkutatása." },
    { id: "pipeline", title: "Sales Pipeline", icon: Map, description: "Vizuális értékesítési tölcsér.", howTo: "A leadek automatikusan bekerülnek ide a bányászat után.", useCase: "Üzleti folyamatok átlátható kezelése." },
    { id: "finance", title: "Invoice Automation", icon: ShieldCheck, description: "Automata számlafeldolgozás.", howTo: "Nyomd meg az indítás gombot, Brunella feldolgozza a számlákat.", useCase: "Havi könyvelési adminisztráció csökkentése." },
    { id: "hr", title: "Digital HR", icon: Users, description: "MI alapú toborzási asszisztens.", howTo: "Másold be a pozíció leírását.", useCase: "Gyors jelöltszűrés nagy mennyiségű jelentkezőnél." },
    { id: "law", title: "Law Detective", icon: Scale, description: "Jogszabályfigyelő és hatásvizsgáló.", howTo: "Add meg a téged érintő kulcsszavakat.", useCase: "Jogi biztonság és adózási felkészültség." },
    { id: "market", title: "Market Watcher", icon: Eye, description: "Konkurenciafigyelő és trendelemző.", howTo: "Add meg a figyelni kívánt URL-t és a terméket.", useCase: "Piaci előny szerzése és árazási stratégia finomítása." },
];

export function SystemGuideWidget() {
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState(GUIDE_DATA[0].id);
    const [isPlaying, setIsPlaying] = useState(false);

    const filteredData = useMemo(
        () => GUIDE_DATA.filter((item) =>
            item.title.toLowerCase().includes(search.toLowerCase()) ||
            item.description.toLowerCase().includes(search.toLowerCase()),
        ),
        [search],
    );

    const activeItem = filteredData.find((item) => item.id === selectedId) ?? filteredData[0] ?? GUIDE_DATA[0];
    const ActiveIcon = activeItem.icon;

    function handleReadAloud() {
        if (!("speechSynthesis" in window)) {
            toast.error("A hangfelolvasás nem támogatott ebben a böngészőben.");
            return;
        }

        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`${activeItem.title}. ${activeItem.description}. ${activeItem.howTo}. ${activeItem.useCase}`);
        utterance.lang = "hu-HU";
        utterance.rate = 1;
        utterance.pitch = 1.1;
        utterance.onstart = () => setIsPlaying(true);
        utterance.onend = () => setIsPlaying(false);
        window.speechSynthesis.speak(utterance);
    }

    return (
        <Card className="glass-card flex min-h-[650px] w-full flex-col overflow-hidden border-white/10 shadow-[0_24px_90px_-40px_rgba(0,0,0,0.95)]">
            <CardHeader className="border-b border-white/[0.05] bg-white/[0.015] pb-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                            <BookOpen className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Brunella Atlas</CardTitle>
                            <CardDescription>Rendszertérkép és Interaktív Súgó</CardDescription>
                        </div>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                        <Input
                            placeholder="Keresés a funkciók között..."
                            className="h-9 border-white/10 bg-white/[0.03] pl-8 text-xs"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="flex flex-1 overflow-hidden p-0">
                <div className="flex w-1/3 flex-col border-r border-white/[0.05] bg-white/[0.02]">
                    <ScrollArea className="flex-1">
                        <div className="space-y-1 p-2">
                            {filteredData.map((item) => {
                                const Icon = item.icon;
                                const selected = selectedId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setSelectedId(item.id)}
                                        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all ${selected ? "border-primary/20 bg-primary/20" : "border-transparent bg-white/[0.02] hover:bg-white/[0.04]"}`}
                                    >
                                        <Icon className={`h-5 w-5 ${selected ? "text-white" : "text-zinc-400"}`} />
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-xs font-bold ${selected ? "text-white" : "text-zinc-400"}`}>{item.title}</div>
                                            <div className="truncate text-[10px] text-zinc-500">{item.description}</div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollArea>
                </div>

                <div className="relative flex-1 bg-gradient-to-br from-transparent to-primary/5 p-8">
                    <div className="absolute right-6 top-6">
                        <Button variant={isPlaying ? "destructive" : "secondary"} size="sm" className="gap-2 rounded-full border border-white/10 bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest shadow-lg" onClick={isPlaying ? () => window.speechSynthesis.cancel() : handleReadAloud}>
                            {isPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            {isPlaying ? "Leállítás" : "Felolvasás"}
                        </Button>
                    </div>

                    <div className="max-w-2xl space-y-8">
                        <div className="flex items-center gap-4">
                            <div className="rounded-2xl border border-primary/20 bg-primary/10 p-4">
                                <ActiveIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black uppercase tracking-tighter text-white">{activeItem.title}</h2>
                                <Badge className="mt-1 bg-primary/20 text-[10px] uppercase text-primary">Vállalati Modul</Badge>
                            </div>
                        </div>

                        <section>
                            <h4 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                                <Info className="h-3 w-3" /> Leírás
                            </h4>
                            <p className="text-sm leading-relaxed text-zinc-200">{activeItem.description}</p>
                        </section>

                        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                <FileText className="h-3 w-3" /> Hogyan működik?
                            </h4>
                            <p className="text-xs leading-relaxed text-zinc-300">{activeItem.howTo}</p>
                        </section>

                        <section className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                            <h4 className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400">
                                <Globe className="h-3 w-3" /> Használati eset
                            </h4>
                            <p className="text-xs leading-relaxed text-zinc-300">{activeItem.useCase}</p>
                        </section>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
