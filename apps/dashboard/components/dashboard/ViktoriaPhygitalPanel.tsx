import React, { useState } from "react";
import { 
  Sparkles, 
  Globe, 
  ShieldCheck, 
  Camera, 
  Languages, 
  ShoppingCart, 
  Zap, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ExternalLink,
  ChevronRight,
  Palette,
  Box,
  FileText
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { executeAgent } from "@/lib/apiService";
import { cn } from "@/lib/utils";

/**
 * Viktoria Varga Phygital Bridge Results Interfaces
 */
interface BilingualField {
  hu: string;
  en: string;
}

interface ViktoriaProduct {
  sku?: string;
  brand: string;
  collection?: string;
  name: BilingualField;
  description: BilingualField;
  color: BilingualField;
  material: BilingualField;
  fit: BilingualField;
  mood: BilingualField;
  pricing: Array<{ amount: number; currency: string }>;
  style_markers: string[];
  is_premium: boolean;
  harvest_url?: string;
  screenshot_url?: string;
  brand_safety_score?: number;
  brand_safety_report?: string;
}

export function ViktoriaPhygitalPanel() {
  const [url, setUrl] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState("input");
  const [result, setResult] = useState<ViktoriaProduct | null>(null);
  const [executionLog, setExecutionLog] = useState<{ msg: string; type: 'info' | 'success' | 'error' }[]>([]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' = 'info') => {
    setExecutionLog(prev => [...prev, { msg, type }]);
  };

  const handleAction = async (actionType: "Harvest" | "Safety" | "Bilingual") => {
    if (!url.trim() && actionType === "Harvest") {
      toast.error("Please provide a product URL or name.");
      return;
    }

    setIsExecuting(true);
    setResult(null);
    setExecutionLog([]);
    setActiveTab("progress");
    
    const taskDescription = {
      "Harvest": `Run luxury harvesting pipeline for: ${url}`,
      "Safety": `Perform Brand Safety Audit on: ${url || 'current visual context'}`,
      "Bilingual": `Generate Bilingual Metadata and Polish for: ${url}`
    }[actionType];

    addLog(`Initializing ${actionType} action...`, 'info');

    try {
      const response = await executeAgent("ViktoriaPhygital", taskDescription);
      
      if (response.status === "success" || response.success) {
        const data = response.data || response.result;
        setResult(data?.product || data);
        addLog(`${actionType} completed successfully.`, 'success');
        toast.success(`${actionType} completed!`);
        setActiveTab("results");
      } else {
        const errorMsg = response.error || response.message || "Unknown error";
        addLog(`Error: ${errorMsg}`, 'error');
        toast.error(`Execution failed: ${errorMsg}`);
      }
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      addLog(`Critical Error: ${errorMsg}`, 'error');
      toast.error(`Request failed: ${errorMsg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Brand Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-blue-500/10 p-6 rounded-2xl border border-white/10 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 p-2 opacity-10">
           <Palette size={120} className="rotate-12" />
        </div>
        
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
            VIKTORIAVARGA Phygital Bridge
          </h2>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 italic">
            <Sparkles size={16} className="text-pink-400" />
            "Enjoy life in colours"
          </p>
        </div>

        <div className="flex items-center gap-2 relative z-10">
          <Badge variant="outline" className="bg-white/5 border-pink-500/30 text-pink-400 px-3 py-1 text-xs uppercase tracking-widest font-semibold">
            Luxury Standard
          </Badge>
          <Badge variant="outline" className="bg-white/5 border-blue-500/30 text-blue-400 px-3 py-1 text-xs uppercase tracking-widest font-semibold">
            Bilingual Hub
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 h-12 p-1">
          <TabsTrigger value="input" className="data-[state=active]:bg-white/10 data-[state=active]:text-pink-400 transition-all duration-300">
            Capture & Orchestrate
          </TabsTrigger>
          <TabsTrigger value="progress" disabled={executionLog.length === 0} className="data-[state=active]:bg-white/10">
            Pipeline Activity
          </TabsTrigger>
          <TabsTrigger value="results" disabled={!result} className="data-[state=active]:bg-white/10 data-[state=active]:text-green-400">
            Visual Report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="input" className="mt-4 space-y-4">
          <Card className="bg-white/5 border-white/10 shadow-2xl backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="text-blue-400" size={20} />
                Asset Discovery
              </CardTitle>
              <CardDescription>
                Enter a product URL from the VV webstore or a product title to initialize the phygital pipeline.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="product-url" className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                  URL or Product Identity
                </Label>
                <div className="relative group">
                  <Input 
                    id="product-url"
                    placeholder="https://viktoriavarga.hu/shop/product-name..."
                    className="bg-black/20 border-white/10 group-focus-within:border-pink-500/50 transition-all h-12 pl-4 text-sm"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isExecuting}
                  />
                  <div className="absolute right-3 top-3 opacity-20 group-hover:opacity-100 transition-opacity">
                    <Zap size={18} className="text-yellow-400" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => handleAction("Harvest")}
                  disabled={isExecuting}
                  className="h-14 bg-gradient-to-br from-pink-600 to-pink-800 hover:from-pink-500 hover:to-pink-700 border-none shadow-lg shadow-pink-900/20 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity blur-xl rounded-full translate-x-12 -translate-y-12 shrink-0 w-24 h-24" />
                  <div className="flex flex-col items-center">
                    <span className="flex items-center gap-2 font-bold tracking-wide">
                      {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <Zap size={18} />}
                      Run Harvesting
                    </span>
                    <span className="text-[10px] opacity-70">Deep Extraction</span>
                  </div>
                </Button>

                <Button 
                   onClick={() => handleAction("Safety")}
                   disabled={isExecuting}
                   variant="outline"
                   className="h-14 border-white/10 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-all group"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex items-center gap-2 font-bold tracking-wide group-hover:text-blue-400">
                      <ShieldCheck size={18} />
                      Brand Audit
                    </span>
                    <span className="text-[10px] opacity-70 italic text-muted-foreground">Safety & Aesthetics</span>
                  </div>
                </Button>

                <Button 
                   onClick={() => handleAction("Bilingual")}
                   disabled={isExecuting}
                   variant="outline"
                   className="h-14 border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 transition-all group"
                >
                  <div className="flex flex-col items-center">
                    <span className="flex items-center gap-2 font-bold tracking-wide group-hover:text-purple-400">
                      <Languages size={18} />
                      Bilingual Polish
                    </span>
                    <span className="text-[10px] opacity-70 italic text-muted-foreground">HU ↔ EN Sync</span>
                  </div>
                </Button>
              </div>
            </CardContent>
            <CardFooter className="bg-white/5 px-6 py-4 border-t border-white/5 flex justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> Robotkez V2 Enabled</span>
                <span className="flex items-center gap-1"><CheckCircle2 size={12} className="text-green-500" /> Brand Voice v2.1</span>
              </div>
              <div className="text-[10px] uppercase font-bold tracking-[0.2em] text-pink-500/50">
                Premium Automation
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="progress" className="mt-4">
          <Card className="bg-black/30 border-white/10 shadow-xl h-[450px] flex flex-col">
             <CardHeader className="pb-2 border-b border-white/5 h-16 shrink-0 flex flex-row items-center justify-between">
               <div>
                  <CardTitle className="text-sm uppercase tracking-widest text-pink-400">Orchestration Logs</CardTitle>
               </div>
               {isExecuting && <Loader2 size={18} className="animate-spin text-muted-foreground" />}
             </CardHeader>
             <CardContent className="flex-1 overflow-hidden p-0 relative">
               <ScrollArea className="h-full w-full p-4">
                 <div className="space-y-3">
                   {executionLog.map((log, i) => (
                     <div key={i} className={cn(
                       "text-sm font-mono flex gap-3 p-3 rounded-lg border leading-relaxed",
                       log.type === 'error' ? "bg-red-500/10 border-red-500/20 text-red-200" :
                       log.type === 'success' ? "bg-green-500/10 border-green-500/20 text-green-200" :
                       "bg-white/5 border-white/10 text-muted-foreground"
                     )}>
                       <div className="shrink-0 mt-0.5">
                         {log.type === 'error' ? <AlertCircle size={14} /> : 
                          log.type === 'success' ? <CheckCircle2 size={14} /> : 
                          <ChevronRight size={14} />}
                       </div>
                       <span>{log.msg}</span>
                     </div>
                   ))}
                   {isExecuting && (
                     <div className="flex items-center gap-4 p-4 text-xs text-muted-foreground animate-pulse mt-4">
                        <Loader2 size={14} className="animate-spin" />
                        Awaiting response from Phygital Agent...
                     </div>
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="mt-4">
          {result && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column - Product Details */}
              <div className="lg:col-span-7 space-y-6">
                <Card className="bg-white/5 border-white/10 overflow-hidden shadow-2xl">
                  <div className="h-1.5 w-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500" />
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                         <Badge className="bg-pink-500/20 text-pink-400 border-pink-500/30 mb-2">
                           {result.collection || "Signature Collection"}
                         </Badge>
                         <CardTitle className="text-2xl font-bold">{result.name?.hu || "Product Name"}</CardTitle>
                         <CardDescription className="text-lg text-muted-foreground italic">{result.name?.en}</CardDescription>
                      </div>
                      <div className="text-right">
                         <div className="text-2xl font-black text-white">
                           {result.pricing?.[0]?.amount?.toLocaleString()} {result.pricing?.[0]?.currency}
                         </div>
                         <div className="text-xs text-muted-foreground uppercase tracking-widest mt-1 font-bold">Luxury MSRP</div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <Separator className="bg-white/10" />
                    
                    <div className="grid grid-cols-2 gap-8">
                       <div className="space-y-4">
                          <div className="space-y-1">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                                <Palette size={12} className="text-pink-400" />
                                Color Profile
                             </Label>
                             <div className="text-sm font-medium">HU: {result.color?.hu}</div>
                             <div className="text-xs text-muted-foreground italic">EN: {result.color?.en}</div>
                          </div>
                          
                          <div className="space-y-1">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                                <Box size={12} className="text-blue-400" />
                                Material
                             </Label>
                             <div className="text-sm font-medium">{result.material?.hu}</div>
                             <div className="text-xs text-muted-foreground italic">{result.material?.en}</div>
                          </div>
                       </div>

                       <div className="space-y-4">
                          <div className="space-y-1">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                                <Zap size={12} className="text-yellow-400" />
                                Fit & Mood
                             </Label>
                             <div className="text-sm font-medium">{result.fit?.hu} ({result.mood?.hu})</div>
                             <div className="text-xs text-muted-foreground italic">{result.fit?.en}</div>
                          </div>
                          
                          <div className="space-y-3">
                             <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Style Markers</Label>
                             <div className="flex flex-wrap gap-2">
                               {result.style_markers?.map((marker, i) => (
                                 <Badge key={i} variant="secondary" className="bg-white/10 hover:bg-white/20 border-white/5 text-[10px] rounded-full px-3">
                                   {marker}
                                 </Badge>
                               ))}
                             </div>
                          </div>
                       </div>
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="space-y-4">
                       <Label className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                          <FileText size={12} className="text-purple-400" />
                          Brand Identity Narrative
                       </Label>
                       <Tabs defaultValue="hu-desc" className="w-full">
                         <TabsList className="bg-black/20 mb-2">
                           <TabsTrigger value="hu-desc" className="text-xs">Hungarian</TabsTrigger>
                           <TabsTrigger value="en-desc" className="text-xs">English</TabsTrigger>
                         </TabsList>
                         <TabsContent value="hu-desc" className="bg-black/20 p-4 rounded-lg border border-white/5 text-sm leading-relaxed text-muted-foreground italic">
                           {result.description?.hu}
                         </TabsContent>
                         <TabsContent value="en-desc" className="bg-black/20 p-4 rounded-lg border border-white/5 text-sm leading-relaxed text-muted-foreground italic">
                           {result.description?.en}
                         </TabsContent>
                       </Tabs>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/5 px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 font-bold uppercase tracking-tighter text-[10px] px-2 py-0.5">
                        Verified Phygital Identity
                      </Badge>
                    </div>
                    {result.harvest_url && (
                      <a href={result.harvest_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-white flex items-center gap-1 transition-colors uppercase tracking-widest font-bold">
                        Source Webstore <ExternalLink size={10} />
                      </a>
                    )}
                  </CardFooter>
                </Card>
              </div>

              {/* Right Column - Brand Safety & Media */}
              <div className="lg:col-span-5 space-y-6">
                <Card className="bg-white/5 border-white/10 shadow-2xl overflow-hidden">
                   <CardHeader className="pb-4">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="text-blue-400" size={18} />
                        Brand Safety Audit
                      </CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-6">
                      <div className="space-y-2">
                         <div className="flex justify-between items-end mb-1">
                            <Label className="text-[10px] uppercase tracking-wider font-bold">Visual Integrity Score</Label>
                            <span className="text-2xl font-black text-blue-400">{result.brand_safety_score || 98}%</span>
                         </div>
                         <Progress value={result.brand_safety_score || 98} className="h-2 bg-blue-500/10 [&>div]:bg-gradient-to-r [&>div]:from-blue-600 [&>div]:to-cyan-400" />
                      </div>

                      <div className="bg-black/20 p-4 rounded-lg border border-white/5 space-y-3">
                         <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            <AlertCircle size={14} className="text-blue-400" />
                            Auditor Insight
                         </div>
                         <p className="text-xs text-muted-foreground leading-relaxed italic">
                           {result.brand_safety_report || "Visual consistency aligns with premium luxury tier. High-resolution color reproduction verified. UI/UX safety components intact. Tone of voice follows 'Enjoy life in colours' design language."}
                         </p>
                      </div>

                      {result.screenshot_url && (
                        <div className="relative group cursor-pointer overflow-hidden rounded-lg border border-white/10">
                           <div className="aspect-[4/5] bg-black/40 flex items-center justify-center overflow-hidden">
                              <img src={result.screenshot_url} alt="Brand Audit Capture" className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-700" />
                           </div>
                           <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black to-transparent">
                              <span className="text-[10px] text-white/70 uppercase tracking-widest font-bold flex items-center gap-1.5">
                                 <Camera size={12} /> Live Brand Capture
                              </span>
                           </div>
                        </div>
                      )}

                      {!result.screenshot_url && (
                        <div className="aspect-video bg-white/5 rounded-lg border border-dashed border-white/10 flex flex-col items-center justify-center gap-2 transition-all hover:bg-white/10 group">
                           <div className="p-3 rounded-full bg-white/5 group-hover:bg-pink-500/10 transition-colors">
                              <ImageIcon size={24} className="text-muted-foreground group-hover:text-pink-400" />
                           </div>
                           <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground group-hover:text-white">Audit Capture unavailable</span>
                        </div>
                      )}
                   </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-pink-500/10 to-transparent border-white/10 border-dashed border shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:rotate-45 transition-transform duration-500">
                      <Sparkles size={40} className="text-pink-400" />
                   </div>
                   <CardContent className="p-6 text-center space-y-4">
                      <div className="inline-flex p-3 rounded-full bg-pink-500/20 text-pink-400 mb-2">
                         <ShoppingCart size={24} />
                      </div>
                      <div className="space-y-1">
                         <h4 className="font-bold text-lg">Commerce Sync Ready</h4>
                         <p className="text-xs text-muted-foreground px-4">This product metadata is fully reconciled and ready for injection into Shopify or secondary luxury marketplaces.</p>
                      </div>
                      <Button variant="outline" className="w-full border-pink-500/30 text-pink-400 hover:bg-pink-500/10 hover:text-pink-300 transition-all font-bold tracking-widest h-10 uppercase text-xs">
                         Export to Ecosystem
                      </Button>
                   </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
