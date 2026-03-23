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
import { TerminalLog } from "@/components/dashboard/TerminalLog";
import { useLayout } from "@/lib/layout/LayoutContext";
import { navigationRegistry } from "@/lib/navigation";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";

export function MissionControlLayout() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4.1");
  const { currentLayout, setLayoutMode, layouts } = useLayout();
  const [isConnected, setIsConnected] = useState(false);
  const [coreStatus, setCoreStatus] = useState<'HEALTHY' | 'DEGRADED' | 'OFFLINE'>('OFFLINE');
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);

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

  const statusColor = isConnected && coreStatus === 'HEALTHY'
    ? "bg-emerald-400"
    : coreStatus === 'DEGRADED' ? "bg-amber-400" : "bg-red-400";

  const statusLabel = isConnected ? coreStatus : "OFFLINE";

  return (
    <div className="min-h-screen md:max-h-screen flex flex-col md:overflow-hidden bg-[#030308] bg-grid-pattern">
      <CommandMenu setActiveTab={setActiveTab} activeTab={activeTab} />

      {/* ─── Header ─── */}
      <header className="h-14 shrink-0 border-b border-white/[0.06] bg-black/50 backdrop-blur-2xl flex items-center justify-between px-4 md:px-5 z-30 sticky top-0">
        {/* Left cluster */}
        <div className="flex items-center gap-3">
          {/* Mobile menu */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 text-zinc-400">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r border-white/[0.06] bg-[#080810]">
              <DynamicSidebar activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setMobileMenuOpen(false); }} />
            </SheetContent>
          </Sheet>

          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center border border-primary/20">
              <Zap size={14} className="text-primary" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight text-white">Brunella</span>
              <span className="text-[10px] font-mono text-zinc-500 tracking-wide">CORTEX v2.3</span>
            </div>
          </div>

          <div className="h-4 w-px bg-white/[0.06] mx-1 hidden sm:block" />

          {/* Navigation cluster */}
          <nav className="hidden sm:flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs font-mono text-zinc-500 hover:text-zinc-300 px-2 h-7 gap-1">
                  <span className="text-zinc-600">LAYOUT</span>
                  <span className="text-zinc-300 font-medium">{currentLayout.name.toUpperCase().replace(' ', '_')}</span>
                  <ChevronDown size={12} className="text-zinc-600" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48" align="start">
                <DropdownMenuLabel className="text-[10px] tracking-wider text-zinc-500">ELRENDEZÉS</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {layouts.modes.map((mode) => (
                  <DropdownMenuItem key={mode.id} onClick={() => setLayoutMode(mode.id)} className="cursor-pointer text-xs">
                    <span className="font-medium">{mode.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-4 w-px bg-white/[0.06] mx-1" />

            {[
              { href: "https://mail.google.com/mail/u/0/", icon: Mail, label: "Gmail" },
              { href: "https://github.com/pohi99999", icon: Github, label: "GitHub" },
              { href: "https://calendar.google.com/calendar/u/0/r", icon: Calendar, label: "Calendar" },
              { href: "https://drive.google.com/drive/my-drive", icon: HardDrive, label: "Drive" },
              { href: "https://gemini.google.com/u/0/gem/c9db4e33647c", icon: Sparkles, label: "Gemini" },
            ].map(({ href, icon: Icon, label }) => (
              <Button key={label} variant="ghost" size="icon" asChild title={label} className="text-zinc-500 hover:text-zinc-200 h-7 w-7">
                <a href={href} target="_blank" rel="noreferrer"><Icon size={14} /></a>
              </Button>
            ))}
          </nav>
        </div>

        {/* Right cluster */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] px-2.5 py-1 rounded-full">
            <div className={cn("w-1.5 h-1.5 rounded-full", statusColor)} />
            <span className="text-[10px] font-medium tracking-wider text-zinc-400">{statusLabel}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* ─── Body ─── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar */}
        <div className="hidden md:flex">
          <DynamicSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <main className="flex-1 flex flex-col min-h-0 p-2 md:p-3 relative">
            {activeTab === 'dashboard' ? (
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <WidgetGrid />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {activeItem?.component || <div className="text-zinc-500 font-mono text-sm">CONTENT_MISSING: {activeTab}</div>}
              </div>
            )}
          </main>

          {/* Terminal footer — collapsible */}
          <footer
            className={cn(
              "border-t border-white/[0.06] bg-black/60 backdrop-blur-2xl shrink-0 z-40 overflow-hidden transition-[height] duration-300 ease-out",
              terminalCollapsed ? "h-8" : "h-36"
            )}
          >
            {/* Collapse handle */}
            <button
              onClick={() => setTerminalCollapsed(!terminalCollapsed)}
              className="w-full h-8 flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors border-b border-white/[0.04] cursor-row-resize"
              aria-label={terminalCollapsed ? "Expand terminal" : "Collapse terminal"}
            >
              <div className="w-8 h-0.5 rounded-full bg-zinc-700" />
              <span>{terminalCollapsed ? "SHOW LOG" : "TERMINAL"}</span>
              <div className="w-8 h-0.5 rounded-full bg-zinc-700" />
            </button>
            {!terminalCollapsed && (
              <TerminalLog className="h-[calc(100%-2rem)] border-none rounded-none bg-transparent" />
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

