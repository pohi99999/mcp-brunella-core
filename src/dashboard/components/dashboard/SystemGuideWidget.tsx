import React, { useState } from 'react';
import { 
    BookOpen, 
    Volume2, 
    VolumeX, 
    Search, 
    Info, 
    Cpu, 
    Target, 
    ShieldCheck, 
    Eye, 
    Lightbulb, 
    Users, 
    FileText, 
    Scale,
    ArrowRight,
    Map
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

const GUIDE_DATA = [
    {
        id: 'innovation',
        title: 'Innovation Bridge',
        icon: <Lightbulb className="w-5 h-5 text-yellow-500" />,
        description: 'Keresztiparágú innovációs motor. TRIZ módszertannal absztrahálja az üzleti problémákat, és távoli iparágakból (pl. NASA, sport, természet) hoz bevált megoldási mintákat.',
        howTo: 'Írd le a problémát természetes nyelven. Válassz egy MI modellt (GPT-4o az ajánlott a kreativitáshoz). Brunella először elvonttá teszi a feladatot, majd analógiákat keres a világ tudásbázisában.',
        useCase: 'Ha elakadtál egy folyamat optimalizálásánál, vagy radikálisan új megközelítést keresel.'
    },
    {
        id: 'property',
        title: 'Property Visionary',
        icon: <Target className="w-5 h-5 text-primary" />,
        description: 'Ingatlan és iparterület stratégiai értékesítő. Meghatározza az ideális vevőprofilt, beruházási híreket kutat fel, és személyre szabott befektetési ajánlatokat készít.',
        howTo: 'Adj meg egy ingatlan leírást vagy tölts fel egy prospektust. Az ágens azonosítja a tőkeerős célpontokat és elkészíti a megkeresési stratégiát.',
        useCase: 'Ipari területek, lakóparkok vagy szabadidő központok vevőinek felkutatása.'
    },
    {
        id: 'pipeline',
        title: 'Sales Pipeline',
        icon: <Map className="w-5 h-5 text-emerald-500" />,
        description: 'Vizuális értékesítési tölcsér. Itt követheted nyomon az összes folyamatban lévő üzleti ügyletet az első bányászattól a szerződéskötésig.',
        howTo: 'A leadek automatikusan bekerülnek ide a bányászat után. A kártyákat húzással vagy a státusz menüvel mozgathatod. Brunella figyeli a válaszokat és figyelmeztet a teendőkre.',
        useCase: 'Üzleti folyamatok végigvezetése és átlátható kezelése.'
    },
    {
        id: 'finance',
        title: 'Invoice Automation',
        icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
        description: 'Teljesen automata számlafeldolgozás. Gmailből letölti a PDF-eket, Vision OCR-rel kinyeri az adatokat, és menti a Google Sheets-be, közben figyeli a duplikátumokat.',
        howTo: 'Csak nyomd meg az indítás gombot. Brunella átnézi a Gmail "Számla" mappádat, és minden újat feldolgoz. Az eredmények azonnal a táblázatodba kerülnek.',
        useCase: 'Havi könyvelési adminisztráció 90%-os csökkentése.'
    },
    {
        id: 'hr',
        title: 'Digital HR',
        icon: <Users className="w-5 h-5 text-blue-500" />,
        description: 'MI alapú toborzási asszisztens. PDF önéletrajzokat elemez, és 0-100-as skálán rangsorolja a jelölteket a munkaköri leírás alapján.',
        howTo: 'Másold be a pozíció leírását. Brunella átfésüli a megadott mappát, kigyűjti a skilleket, és kiemeli a legjobb "Match Score"-ral rendelkező embereket.',
        useCase: 'Gyors és előítélet-mentes jelöltszűrés nagy mennyiségű jelentkező esetén.'
    },
    {
        id: 'law',
        title: 'Law Detective',
        icon: <Scale className="w-5 h-5 text-blue-400" />,
        description: 'Magyar Közlöny figyelő és hatásvizsgáló. Valós időben követi a jogszabályváltozásokat és érthető, cégvezetői teendőlistát készít belőlük.',
        howTo: 'Add meg a téged érintő kulcsszavakat (pl. KATA, építésügy). Az ágens naponta scanneli a közlönyt, és csak akkor szól, ha releváns változást talál.',
        useCase: 'Jogi biztonság és adózási felkészültség biztosítása.'
    },
    {
        id: 'market',
        title: 'Market Watcher',
        icon: <Eye className="w-5 h-5 text-orange-500" />,
        description: 'Konkurenciafigyelő és trendelemző. Scrappeli a weboldalakat, követi az árakat és jelzi, ha egy termék alulárazott a piacon (Arbitrázs).',
        howTo: 'Add meg a figyelni kívánt URL-t és a terméket. Brunella historikus adatokat gyűjt és értesítést küld, ha érdemes lépni (vásárolni vagy árat módosítani).',
        useCase: 'Piaci előny szerzése és árazási stratégia finomítása.'
    }
];

export function SystemGuideWidget() {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState(GUIDE_DATA[0].id);
    const [isPlaying, setIsRecording] = useState(false);

    const filteredData = GUIDE_DATA.filter(i => 
        i.title.toLowerCase().includes(search.toLowerCase()) || 
        i.description.toLowerCase().includes(search.toLowerCase())
    );

    const activeItem = GUIDE_DATA.find(i => i.id === selectedId) || GUIDE_DATA[0];

    const speak = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'hu-HU';
            utterance.rate = 1.0;
            utterance.pitch = 1.1; // Slightly higher for a more pleasant female voice
            
            // Try to find a female voice
            const voices = window.speechSynthesis.getVoices();
            const huVoice = voices.find(v => v.lang.startsWith('hu') && (v.name.includes('Female') || v.name.includes('Tünde') || v.name.includes('Szabolcs') === false));
            if (huVoice) utterance.voice = huVoice;

            utterance.onstart = () => setIsRecording(true);
            utterance.onend = () => setIsRecording(false);
            
            window.speechSynthesis.speak(utterance);
        } else {
            toast.error("A hangfelolvasás nem támogatott ebben a böngészőben.");
        }
    };

    const handleReadAloud = () => {
        const fullText = `${activeItem.title}. ${activeItem.description}. Működése: ${activeItem.howTo}. Használati eset: ${activeItem.useCase}`;
        speak(fullText);
    };

    return (
        <Card className="w-full shadow-2xl border-primary/20 bg-card/50 backdrop-blur-md overflow-hidden min-h-[650px] flex flex-col">
            <CardHeader className="pb-4 border-b border-white/5 bg-secondary/10">
                <div className="flex justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                            <BookOpen className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Brunella Atlas</CardTitle>
                            <CardDescription>Rendszertérkép és Interaktív Súgó</CardDescription>
                        </div>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 w-4 h-4 text-zinc-500" />
                        <Input 
                            placeholder="Keresés a funkciók között..." 
                            className="pl-8 bg-black/20 border-white/10 h-9 text-xs"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-1 overflow-hidden">
                {/* Bal oldali menü */}
                <div className="w-1/3 border-r border-white/5 bg-black/10 flex flex-col">
                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {filteredData.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setSelectedId(item.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group ${
                                        selectedId === item.id 
                                            ? 'bg-primary/20 border-primary/20 border' 
                                            : 'hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    <div className={`${selectedId === item.id ? 'scale-110' : 'opacity-50 group-hover:opacity-100'} transition-all`}>
                                        {item.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className={`text-xs font-bold ${selectedId === item.id ? 'text-white' : 'text-zinc-400'}`}>
                                            {item.title}
                                        </div>
                                        <div className="text-[10px] text-zinc-500 truncate">
                                            {item.description}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Jobb oldali részletek */}
                <div className="flex-1 p-8 bg-gradient-to-br from-transparent to-primary/5 relative">
                    <div className="absolute top-6 right-6">
                        <Button 
                            variant={isPlaying ? "destructive" : "secondary"} 
                            size="sm" 
                            className="gap-2 rounded-full font-bold uppercase text-[10px] tracking-widest shadow-lg animate-in fade-in"
                            onClick={isPlaying ? () => window.speechSynthesis.cancel() : handleReadAloud}
                        >
                            {isPlaying ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            {isPlaying ? "Leállítás" : "Felolvasás"}
                        </Button>
                    </div>

                    <div className="max-w-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                                {activeItem.icon}
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-white uppercase tracking-tighter">{activeItem.title}</h2>
                                <Badge className="bg-primary/20 text-primary text-[10px] mt-1 uppercase">Vállalati Modul</Badge>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <section>
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                                    <Info className="w-3 h-3" /> Leírás
                                </h4>
                                <p className="text-zinc-200 text-sm leading-relaxed">
                                    {activeItem.description}
                                </p>
                            </section>

                            <section className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Cpu className="w-3 h-3" /> Hogyan működik és hogyan kezeld?
                                </h4>
                                <p className="text-zinc-300 text-xs leading-relaxed italic">
                                    {activeItem.howTo}
                                </p>
                            </section>

                            <section className="space-y-3">
                                <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Target className="w-3 h-3" /> Üzleti felhasználás
                                </h4>
                                <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/10">
                                    <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                                    <p className="text-sm font-medium text-zinc-200">{activeItem.useCase}</p>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
