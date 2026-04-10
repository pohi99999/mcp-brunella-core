import { useState, useEffect } from "react";
import { Zap, ChevronDown, ChevronRight, Menu, Mail, Github, Calendar, Sparkles, HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import * as api from "@/lib/apiService";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

export function MissionControlLayout() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentLayout, setLayoutMode, layouts } = useLayout();
  const [isConnected, setIsConnected] = useState(false);
  const [coreStatus, setCoreStatus] = useState<'HEALTHY' | 'DEGRADED' | 'OFFLINE'>('OFFLINE');
  const [terminalCollapsed, setTerminalCollapsed] = useState(true);
  const [chaos, setChaos] = useState<api.ChaosStatus | null>(null);

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
    
    api.getChaosStatus().then(setChaos).catch(() => {});

    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleChaos = async (checked: boolean) => {
    try {
      const res = await api.toggleChaosMode({ enabled: checked });
      setChaos(res.status);
      if (checked) {
        toast.error("CHAOS ENGINE ACTIVE", {
          description: "A rendszer szándékos hibákat injektál a teszteléshez.",
          duration: 5000,
        });
      } else {
        toast.success("Chaos Engine leállítva", {
          description: "A rendszer stabil állapotba került.",
        });
      }
    } catch (e) {
      toast.error("Hiba történt a Chaos Engine vezérlése közben.");
    }
  };

  const activeItem = navigationRegistry.getItem(activeTab);

  const statusColor = isConnected && coreStatus === 'HEALTHY'
    ? "bg-emerald-400"
    : coreStatus === 'DEGRADED' ? "bg-amber-400" : "bg-red-400";

  const statusLabel = isConnected ? t(`common.${coreStatus.toLowerCase()}`) : t("common.offline");

  return (
    <div className="relative min-h-screen md:max-h-screen flex flex-col overflow-x-hidden md:overflow-hidden bg-[var(--shell-bg)] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.025),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.018),transparent_14%),linear-gradient(180deg,#050505,#010101)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-[0.06]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white/[0.035] via-white/[0.015] to-transparent" />
      <div className="relative z-10 flex min-h-screen flex-col">
      <CommandMenu setActiveTab={setActiveTab} activeTab={activeTab} />

      {/* ─── Header ─── */}
      <header className="h-16 shrink-0 border-b border-white/[0.06] bg-black/70 backdrop-blur-2xl flex items-center justify-between px-4 md:px-5 z-30 sticky top-0 shadow-[0_28px_88px_-60px_rgba(0,0,0,0.98)]">
        <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.navigation_menu")}
                  title={t("common.navigation_menu")}
                  className="md:hidden h-9 w-9 rounded-xl text-white/55 hover:text-white hover:bg-white/[0.04]"
                >
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(22rem,92vw)] border-r border-white/[0.08] bg-black/95 p-0">
                <SheetTitle className="sr-only">{t("common.navigation_menu")}</SheetTitle>
                <SheetDescription className="sr-only">
                  {t("common.switch_sections")}
                </SheetDescription>
                <DynamicSidebar activeTab={activeTab} forceExpanded onTabChange={(tab) => { setActiveTab(tab); setMobileMenuOpen(false); }} />
              </SheetContent>
            </Sheet>

          <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.035] shadow-[0_20px_48px_-34px_rgba(0,0,0,0.96)]">
              <Zap size={14} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-sm font-semibold tracking-tight text-white">Brunella</span>
              <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/40">{t("common.mission_control")}</span>
            </div>
          </div>

          <div className="mx-1 hidden h-4 w-px bg-white/[0.06] sm:block" />

          {activeItem && (
              <div className="hidden rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 sm:flex items-center gap-1.5 text-[11px]">
              <span className="font-mono text-white/30">MC</span>
              <ChevronRight size={10} className="text-white/20" />
              <span className="font-medium text-white/68">{activeItem.label}</span>
            </div>
          )}

          <div className="mx-1 hidden h-4 w-px bg-white/[0.06] sm:block" />

          <nav className="hidden xl:flex items-center gap-0.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1 rounded-xl px-2 text-xs font-mono text-white/45 hover:bg-white/[0.035] hover:text-white">
                  <span className="text-white/30">{t("common.layout").toUpperCase()}</span>
                  <span className="text-white font-medium">{currentLayout.name.toUpperCase().replaceAll(' ', '_')}</span>
                  <ChevronDown size={12} className="text-white/30" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-48" align="start">
                <DropdownMenuLabel className="text-[10px] tracking-wider text-zinc-500">{t("common.layout_modes").toUpperCase()}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {layouts.modes.map((mode) => (
                  <DropdownMenuItem key={mode.id} onClick={() => setLayoutMode(mode.id)} className="cursor-pointer text-xs">
                    <span className="font-medium">{mode.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

             <div className="mx-1 h-4 w-px bg-white/[0.06]" />

            {[
              { href: "https://mail.google.com/mail/u/0/", icon: Mail, label: "Gmail" },
              { href: "https://github.com/pohi99999", icon: Github, label: "GitHub" },
              { href: "https://calendar.google.com/calendar/u/0/r", icon: Calendar, label: "Calendar" },
              { href: "https://drive.google.com/drive/my-drive", icon: HardDrive, label: "Drive" },
              { href: "https://gemini.google.com/u/0/gem/c9db4e33647c", icon: Sparkles, label: "Gemini" },
            ].map(({ href, icon: Icon, label }) => (
                <Button key={label} variant="ghost" size="icon" asChild title={label} className="h-8 w-8 rounded-xl text-white/40 hover:bg-white/[0.035] hover:text-white">
                  <a href={href} target="_blank" rel="noreferrer"><Icon size={14} /></a>
                </Button>
              ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {chaos && (
            <div className="flex items-center gap-2 mr-2 border-r pr-4 border-white/10">
              <span className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-mono hidden sm:inline">Chaos Engine</span>
              <Switch 
                checked={chaos.enabled} 
                onCheckedChange={handleToggleChaos}
                className="data-[state=checked]:bg-red-600 border-white/20 scale-75"
              />
            </div>
          )}
          <div className="hidden rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 shadow-[0_18px_42px_-28px_rgba(0,0,0,0.96)] md:flex items-center gap-2">
            <div className="relative flex items-center">
              <div className={cn("w-1.5 h-1.5 rounded-full", statusColor)} />
              {coreStatus === 'HEALTHY' && (
                <div className={cn("absolute w-1.5 h-1.5 rounded-full animate-ping opacity-60", statusColor)} />
              )}
            </div>
            <span className="text-[10px] font-medium tracking-[0.24em] text-white/75">{t("common.core")} {statusLabel}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="hidden md:flex">
          <DynamicSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <main className="relative flex flex-1 flex-col min-h-0 p-3 md:p-5">
            {activeTab === 'dashboard' ? (
              <div className="glass-panel flex-1 min-h-0 overflow-hidden rounded-[1.75rem] p-2.5 md:p-3.5">
                <div className="flex h-full min-h-0 overflow-y-auto custom-scrollbar">
                <WidgetGrid />
                </div>
              </div>
            ) : (
              <div className="glass-panel flex-1 min-h-0 overflow-hidden rounded-[1.75rem] p-3.5 md:p-4.5">
                <div className="flex h-full min-h-0 overflow-y-auto custom-scrollbar">
                  {activeItem?.component || <div className="text-white/45 font-mono text-sm">CONTENT_MISSING: {activeTab}</div>}
                </div>
              </div>
            )}
          </main>

          <footer
            className={cn(
               "shrink-0 z-40 overflow-hidden border-t border-white/[0.06] bg-black/70 backdrop-blur-2xl transition-[height] duration-300 ease-out",
              terminalCollapsed ? "h-8" : "h-36"
            )}
          >
            <button
              onClick={() => setTerminalCollapsed(!terminalCollapsed)}
                className="flex h-8 w-full cursor-row-resize items-center justify-center gap-2 border-b border-white/[0.05] text-[10px] font-mono tracking-[0.28em] text-white/40 transition-colors hover:bg-white/[0.02] hover:text-white/75"
                aria-label={terminalCollapsed ? "Expand terminal" : "Collapse terminal"}
              >
                <div className="h-0.5 w-8 rounded-full bg-white/[0.16]" />
                <span>{terminalCollapsed ? t("common.show_log") : t("common.terminal")}</span>
                <div className="h-0.5 w-8 rounded-full bg-white/[0.16]" />
              </button>
            {!terminalCollapsed && (
              <TerminalLog className="h-[calc(100%-2rem)] border-none rounded-none bg-transparent" />
            )}
          </footer>
        </div>
      </div>
      </div>
    </div>
  );
}

