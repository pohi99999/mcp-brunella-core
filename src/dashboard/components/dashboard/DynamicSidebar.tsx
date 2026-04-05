import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Shield, LogOut, Activity, ChevronDown, ChevronRight } from "lucide-react";
import { navigationRegistry } from "@/lib/navigation";

interface DynamicSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  forceExpanded?: boolean;
}

export function DynamicSidebar({ activeTab, onTabChange, forceExpanded = false }: DynamicSidebarProps) {
  const { t } = useTranslation();
  const groups = navigationRegistry.getGroups();
  const items = navigationRegistry.getAllItems();
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const findItem = (id: string) => items.find(item => item.id === id);
  
  // Csoport címek leképezése i18n kulcsokra
  const getGroupTitle = (title: string) => {
    const key = title.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
    return t(`nav.groups.${key}`, title);
  };

  const activeGroupTitle = useMemo(
    () => groups.find((group) => group.items.includes(activeTab))?.title,
    [activeTab, groups],
  );

  useEffect(() => {
    setCollapsedGroups((prev) => {
      const next = { ...prev };
      for (const group of groups) {
        if (!(group.title in next)) {
          next[group.title] = false;
        }
      }
      return next;
    });
  }, [groups]);

  useEffect(() => {
    if (!activeGroupTitle) return;
    setCollapsedGroups((prev) =>
      prev[activeGroupTitle] ? { ...prev, [activeGroupTitle]: false } : prev
    );
  }, [activeGroupTitle]);

  const toggleGroup = (title: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <aside className={cn("z-10 flex shrink-0 flex-col py-4 transition-all duration-300", forceExpanded ? "w-full" : "w-16 lg:w-[17rem]")}>
      <div className="glass-panel mx-1.5 flex flex-1 flex-col overflow-hidden rounded-[1.6rem] border border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.05] px-3.5 py-3.5">
          <div className={cn("flex flex-col", forceExpanded ? "flex" : "hidden lg:flex")}>
            <span className="text-[10px] font-mono tracking-[0.28em] uppercase text-white/42">{t("sidebar.navigation")}</span>
            <span className="text-[11px] text-white/55">{t("sidebar.operator_sections")}</span>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
            <Activity size={13} className="text-white/82" />
          </div>
        </div>

        <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {groups.map((group) => (
            <div key={group.title} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                aria-expanded={!collapsedGroups[group.title]}
                aria-controls={`sidebar-group-${group.title}`}
                className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.025] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
              >
                <group.icon size={11} className="shrink-0 text-white/28" />
                <span className={cn("text-[9px] font-semibold uppercase tracking-[0.24em] text-white/36", forceExpanded ? "inline" : "hidden lg:inline")}>
                  {getGroupTitle(group.title)}
                </span>
                <span className={cn("ml-auto text-white/26", forceExpanded ? "inline" : "hidden lg:inline")}>
                  {collapsedGroups[group.title] ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                </span>
              </button>
              {!collapsedGroups[group.title] && (
                <div id={`sidebar-group-${group.title}`}>
                  {group.items.map(itemId => {
                    const item = findItem(itemId);
                    if (!item) return null;
                    const isActive = activeTab === item.id;
                    const translatedLabel = t(`nav.${item.id}`, item.label);
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        aria-label={translatedLabel}
                        title={translatedLabel}
                        className={cn(
                           "group relative flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2.5 transition-all duration-200",
                            "text-white/56 hover:bg-white/[0.04] hover:text-white/88",
                              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30",
                              isActive && "bg-white/[0.08] text-white border border-white/[0.14] shadow-[0_16px_36px_-28px_rgba(255,255,255,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]",
                          )}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.18)]" />
                        )}
                        <div className="w-4 h-4 flex items-center justify-center shrink-0 ml-0.5">
                          <item.icon
                            size={14}
                            className={cn(
                               isActive ? "text-white" : "text-white/34 group-hover:text-white/58",
                              "transition-colors duration-200",
                            )}
                          />
                        </div>
                        <span className={cn("text-xs font-medium tracking-wide truncate", forceExpanded ? "inline" : "hidden lg:inline")}>
                          {translatedLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-white/[0.05] px-3.5 py-3.5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025]">
              <Shield size={12} className="text-white" />
            </div>
            <div className={cn("flex min-w-0 flex-col", forceExpanded ? "flex" : "hidden lg:flex")}>
              <span className="text-[10px] font-semibold text-white/80 truncate">Master Admin</span>
              <span className="text-[9px] font-mono text-emerald-300/75 tracking-[0.24em]">{t("sidebar.authorized")}</span>
            </div>
          </div>
          <button
            aria-label={t("sidebar.disconnect")}
            title={t("sidebar.disconnect")}
            className="flex w-full items-center justify-between rounded-xl border-t border-white/[0.05] px-1 py-1.5 pt-2.5 text-[10px] font-medium tracking-[0.24em] text-white/38 transition-colors hover:text-white/72 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30"
          >
            <span className={cn(forceExpanded ? "inline" : "hidden lg:inline")}>{t("sidebar.disconnect")}</span>
            <LogOut size={11} />
          </button>
        </div>
      </div>
    </aside>
  );
}
