import { useState, useEffect } from "react";
import { Zap, ChevronDown, Menu, X, Mail, Github, Calendar, Sparkles, HardDrive } from "lucide-react";
import * as api from "@/lib/apiService";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CommandMenu } from "@/components/dashboard/CommandMenu";
import { DynamicSidebar } from "@/components/dashboard/DynamicSidebar";
import { WidgetGrid } from "@/components/dashboard/WidgetGrid";
import { useLayout } from "@/lib/layout/LayoutContext";
import { navigationRegistry } from "@/lib/navigation";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";

export function MissionControlLayout() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o");
  const { currentLayout, setLayoutMode, layouts } = useLayout();
  const [isConnected, setIsConnected] = useState(false);
  const [coreStatus, setCoreStatus] = useState<'HEALTHY' | 'DEGRADED' | 'OFFLINE'>('OFFLINE');

  useEffect(() => {
    const check = async () => {
      try {
        const health = await api.checkHealth();
        const overallOk = health.status === 'ok';
        setIsConnected(true);
        setCoreStatus(overallOk ? 'HEALTHY' : 'DEGRADED');
      } catch {
        setIsConnected(false);
        setCoreStatus('OFFLINE');
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeItem = navigationRegistry.getItem(activeTab);

  return (
    <div className="min-h-screen md:max-h-screen flex flex-col md:overflow-hidden bg-[#020205] bg-grid-pattern">
      <CommandMenu setActiveTab={setActiveTab} activeTab={activeTab} />

      <header className="h-16 shrink-0 border-b border-white/5 bg-black/40 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 z-30 sticky top-0">
        <div className="flex items-center gap-2 md:gap-4">
          <div className="flex items-center gap-2 md:gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-9 w-9">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 border-r border-white/10 bg-[#0a0a0f]">
                <DynamicSidebar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setMobileMenuOpen(false); }} />
              </SheetContent>
            </Sheet>
            <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
              <Zap size={18} className="text-primary animate-pulse" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-sm font-bold tracking-tighter text-white uppercase italic truncate">Brunella Cortex</span>
              <span className="text-[9px] md:text-[10px] font-mono text-primary/60 tracking-widest leading-none">v2.3.0</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-white/10 mx-2" />

          <nav className="hidden sm:flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded gap-1">
                  LAYOUT: <span className="font-bold text-white">{currentLayout.name.toUpperCase().replace(' ', '_')}</span> <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="start">
                <DropdownMenuLabel>Válasszon Elrendezést</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {layouts.modes.map((mode) => (
                  <DropdownMenuItem key={mode.id} onClick={() => setLayoutMode(mode.id)} className="cursor-pointer">
                    <span className="font-bold">{mode.name}</span>
                    <span className="ml-auto text-xs text-zinc-500">{mode.id}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            <Button variant="ghost" size="icon" asChild title="Gmail" className="text-zinc-400 hover:text-white h-8 w-8">
              <a href="https://mail.google.com/mail/u/0/" target="_blank" rel="noreferrer"><Mail size={16} /></a>
            </Button>
            <Button variant="ghost" size="icon" asChild title="GitHub" className="text-zinc-400 hover:text-white h-8 w-8">
              <a href="https://github.com/pohi99999" target="_blank" rel="noreferrer"><Github size={16} /></a>
            </Button>
            <Button variant="ghost" size="icon" asChild title="Google Calendar" className="text-zinc-400 hover:text-white h-8 w-8">
              <a href="https://calendar.google.com/calendar/u/0/r" target="_blank" rel="noreferrer"><Calendar size={16} /></a>
            </Button>
            <Button variant="ghost" size="icon" asChild title="Google Drive" className="text-zinc-400 hover:text-white h-8 w-8">
              <a href="https://drive.google.com/drive/my-drive" target="_blank" rel="noreferrer"><HardDrive size={16} /></a>
            </Button>
            <Button variant="ghost" size="icon" asChild title="Gemini Web" className="text-zinc-400 hover:text-white h-8 w-8">
              <a href="https://gemini.google.com/u/0/gem/c9db4e33647c" target="_blank" rel="noreferrer"><Sparkles size={16} /></a>
            </Button>
          </nav>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden sm:flex items-center gap-3 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected && coreStatus === 'HEALTHY' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                : coreStatus === 'DEGRADED' ? "bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.8)]"
                  : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"
            )} />
            <span className="text-[10px] font-mono font-bold text-zinc-400">
              {isConnected ? `CORE_${coreStatus}` : "CORE_OFFLINE"}
            </span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="hidden md:flex">
          <DynamicSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <main className="flex-1 flex flex-col min-h-0 p-2 md:p-6 relative">
          {activeTab === 'dashboard' ? (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <WidgetGrid />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              {activeItem?.component || <div className="text-zinc-500 font-mono">CONTENT_MISSING: {activeTab}</div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

