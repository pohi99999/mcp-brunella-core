import React from "react";
import { cn } from "@/lib/utils";
import { Layers, Shield, Ghost } from "lucide-react";
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
    <aside className="w-[64px] lg:w-[260px] flex flex-col gap-4 py-4 z-10 transition-all duration-300 shrink-0">
      <div className="glass-panel rounded-2xl flex-1 flex flex-col overflow-hidden border-white/5">
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold text-zinc-500 tracking-widest uppercase hidden lg:inline">Primary Menu</span>
          <Layers size={14} className="text-zinc-500" />
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          <Accordion type="multiple" defaultValue={["Core Systems", "AI & Agents"]} className="w-full">
            {groups.map((group) => (
              <AccordionItem value={group.title} key={group.title} className="border-none">
                <AccordionTrigger className="text-xs font-bold text-zinc-500 hover:text-zinc-200 uppercase tracking-wider px-3 py-2.5 rounded-xl hover:no-underline hover:bg-white/5">
                  <div className="flex items-center gap-3">
                    <group.icon size={14} />
                    <span className="hidden lg:inline">{group.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-2 space-y-1">
                  {group.items.map(itemId => {
                    const item = findItem(itemId);
                    if (!item) return null;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        aria-label={item.label}
                        title={item.label}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 group relative",
                          "text-zinc-400 hover:text-zinc-100 hover:bg-white/5",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          activeTab === item.id && "bg-primary/10 text-white border border-primary/20",
                        )}
                      >
                        <div className="w-4 h-4 flex items-center justify-center">
                          <item.icon size={16} className={cn( "shrink-0 transition-transform duration-300", activeTab === item.id ? "text-primary" : "text-zinc-500 group-hover:text-zinc-300" )} />
                        </div>
                        <span className="hidden lg:inline text-xs font-medium font-space tracking-wide">{item.label}</span>
                        {activeTab === item.id && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px] shadow-primary/50" />
                        )}
                      </button>
                    )
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center">
              <Shield size={14} className="text-primary" />
            </div>
            <div className="flex flex-col min-w-0 hidden lg:flex">
              <span className="text-[10px] font-bold text-white truncate uppercase">Master Admin</span>
              <span className="text-[9px] font-mono text-emerald-500/80">AUTHORIZED</span>
            </div>
          </div>
          <button
            aria-label="Disconnect Master Admin"
            title="Disconnect Master Admin"
            className="w-full text-[10px] font-bold text-zinc-500 hover:text-white transition-colors flex items-center justify-between py-1 border-t border-white/5 pt-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md px-2"
          >
            <span>DISCONNECT</span>
            <Ghost size={12} />
          </button>
        </div>
      </div>
    </aside>
  );
}
