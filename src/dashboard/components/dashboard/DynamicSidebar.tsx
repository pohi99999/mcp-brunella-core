import React from "react";
import { cn } from "@/lib/utils";
import { Layers, Shield, LogOut } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
    <aside className="w-14 lg:w-60 flex flex-col py-3 z-10 transition-all duration-300 shrink-0">
      <div className="glass-panel rounded-xl flex-1 flex flex-col overflow-hidden mx-1.5">
        {/* Section label */}
        <div className="px-3 py-3 border-b border-white/[0.04] flex items-center justify-between">
          <span className="text-[10px] font-medium text-zinc-500 tracking-widest uppercase hidden lg:inline">Navigáció</span>
          <Layers size={13} className="text-zinc-600" />
        </div>
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto custom-scrollbar py-1.5 px-1.5">
          <Accordion type="multiple" defaultValue={["Core Systems", "AI & Agents"]} className="w-full">
            {groups.map((group) => (
              <AccordionItem value={group.title} key={group.title} className="border-none">
                <AccordionTrigger className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-300 uppercase tracking-wider px-2.5 py-2 rounded-lg hover:no-underline hover:bg-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <group.icon size={13} />
                    <span className="hidden lg:inline">{group.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-0.5 pb-1.5 space-y-0.5">
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
                          "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-all duration-150 group relative",
                          "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]",
                          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
                          isActive && "bg-primary/8 text-white",
                        )}
                      >
                        <div className="w-4 h-4 flex items-center justify-center shrink-0">
                          <item.icon size={14} className={cn(isActive ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300")} />
                        </div>
                        <span className="hidden lg:inline text-xs font-medium tracking-wide truncate">{item.label}</span>
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-r-full" />
                        )}
                      </button>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        {/* User section */}
        <div className="px-3 py-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-800/80 border border-white/[0.06] flex items-center justify-center shrink-0">
              <Shield size={12} className="text-primary" />
            </div>
            <div className="flex flex-col min-w-0 hidden lg:flex">
              <span className="text-[10px] font-semibold text-zinc-300 truncate">Master Admin</span>
              <span className="text-[9px] font-mono text-emerald-500/70">AUTHORIZED</span>
            </div>
          </div>
          <button
            aria-label="Disconnect"
            title="Disconnect"
            className="w-full text-[10px] font-medium text-zinc-600 hover:text-zinc-300 transition-colors flex items-center justify-between py-1.5 border-t border-white/[0.04] pt-2.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 rounded px-1"
          >
            <span className="hidden lg:inline">DISCONNECT</span>
            <LogOut size={11} />
          </button>
        </div>
      </div>
    </aside>
  );
}
