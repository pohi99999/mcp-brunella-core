import React from "react";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";

export function WidgetGrid() {
  const { currentLayout, setLayoutMode } = useLayout();

  const widgets = Object.entries(currentLayout.widgetAssignments)
    .map(([widgetId]) => {
      const widget = WIDGET_REGISTRY[widgetId];
      if (!widget) return null;
      return { id: widgetId, ...widget };
    })
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Header row — compact, professional */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-white tracking-tight">Mission Control</h2>
          <span className="text-[10px] text-zinc-500 font-mono tracking-widest">
            {widgets.length} WIDGETS
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLayoutMode('default-dashboard')}
          className="text-zinc-500 hover:text-zinc-200 gap-1.5 h-7 text-xs"
        >
          <RotateCcw size={12} />
          Reset
        </Button>
      </div>

      {/* CSS Grid layout — consistent spacing, uniform cards */}
      <div className="widget-grid flex-1 min-h-0 overflow-y-auto custom-scrollbar pb-4 px-1">
        {widgets.map((w) => {
          if (!w) return null;
          const Component = w.component;
          return (
            <div key={w.id} className="widget-card">
              <Component />
            </div>
          );
        })}
      </div>
    </div>
  );
}
