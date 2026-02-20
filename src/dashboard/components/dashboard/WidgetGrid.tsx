import React, { useState } from "react";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { cn } from "@/lib/utils";
import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayout } from "@/lib/layout/LayoutContext";

interface WidgetGridProps {
  // No direct props for agents, sockets, logs anymore. These will be fetched via context or individually.
  // The WidgetGrid will only handle rendering based on the active layout.
}

export function WidgetGrid({}: WidgetGridProps) {
  const { currentLayout, setLayoutMode, layouts } = useLayout();

  return (
    <div className="space-y-4 h-full">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white tracking-tight">Mission Control</h2>
          <p className="text-xs text-zinc-500 font-mono">NEURAL_DASHBOARD_ACTIVE</p>
        </div>
        {/* Layout switcher UI will go here in a later step */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLayoutMode('default-dashboard')}
            className="text-zinc-500 hover:text-white gap-2"
          >
            <RotateCcw size={14} />
            Reset Layout
          </Button>
        </div>
      </div>

      <div
        className="grid flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2"
        style={{
          gridTemplateAreas: currentLayout.gridTemplateAreas.join(' '),
          gridTemplateColumns: currentLayout.gridTemplateColumns,
          gridTemplateRows: currentLayout.gridTemplateRows,
          gap: '1.25rem',
          minHeight: '650px'
        }}
      >
        {Object.entries(currentLayout.widgetAssignments).map(([widgetId, gridArea]) => {
          const widget = WIDGET_REGISTRY[widgetId];
          if (!widget) return null;

          const Component = widget.component;
          // extraProps will be handled by unified signal bus (Phase 2)
          // For now, pass basic props if required by widget, otherwise assume they fetch their own data

          return (
            <div key={widgetId} style={{ gridArea }} className="relative overflow-hidden rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md">
              <div className="h-full w-full overflow-hidden">
                <Component />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
