import React from "react";
import { cn } from "@/lib/utils";
import { Shield, LogOut, Activity } from "lucide-react";
import { navigationRegistry } from "@/lib/navigation";

interface DynamicSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DynamicSidebar({ activeTab, onTabChange }: DynamicSidebarProps) {
  const groups = navigationRegistry.getGroups();
  const items = navigationRegistry.getAllItems();

  const findItem = (id: string) => items.find(item => item.id === id);

  return (
    <aside className="w-14 lg:w-64 flex flex-col py-3 z-10 transition-all duration-300 shrink-0">
      <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden mx-1.5 border border-white/10 bg-slate-950/70 shadow-[0_24px_90px_-40px_rgba(0,0,0,0.95)]">
        <div className="px-3 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <div className="hidden lg:flex flex-col">
            <span className="text-[10px] font-mono tracking-[0.3em] uppercase text-zinc-500">Navigation</span>
            <span className="text-[11px] text-zinc-400">Mission Control groups</span>
          </div>
          <Activity size={13} className="text-cyan-400" />
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar py-2 px-1.5 space-y-3">
          {groups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              {/* Group header — non-clickable section label */}
              <div className="flex items-center gap-2 px-2.5 py-1">
                <group.icon size={11} className="text-zinc-600 shrink-0" />
                <span className="hidden lg:inline text-[9px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
                  {group.title}
                </span>
              </div>
              {/* Group items */}
              {group.items.map(itemId => {
                const item = findItem(itemId);
                if (!item) return null;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id)}
                    aria-label={item.label}
                    title={item.label}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all duration-150 group relative",
                      "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.05]",
                      "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                      isActive && "bg-cyan-400/[0.09] text-white border border-cyan-400/[0.18]",
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-cyan-400 rounded-r-full shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                    )}
                    <div className="w-4 h-4 flex items-center justify-center shrink-0 ml-0.5">
                      <item.icon
                        size={14}
                        className={cn(
                          isActive ? "text-cyan-400" : "text-zinc-600 group-hover:text-zinc-400",
                          "transition-colors duration-150",
                        )}
                      />
                    </div>
                    <span className="hidden lg:inline text-xs font-medium tracking-wide truncate">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="px-3 py-3 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-800/80 border border-white/[0.08] flex items-center justify-center shrink-0">
              <Shield size={12} className="text-primary" />
            </div>
            <div className="flex flex-col min-w-0 hidden lg:flex">
              <span className="text-[10px] font-semibold text-zinc-300 truncate">Master Admin</span>
              <span className="text-[9px] font-mono text-emerald-400/70 tracking-[0.24em]">AUTHORIZED</span>
            </div>
          </div>
          <button
            aria-label="Disconnect"
            title="Disconnect"
            className="w-full text-[10px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors flex items-center justify-between py-1.5 border-t border-white/[0.04] pt-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded px-1 tracking-[0.24em]"
          >
            <span className="hidden lg:inline">DISCONNECT</span>
            <LogOut size={11} />
          </button>
        </div>
      </div>
    </aside>
  );
}
