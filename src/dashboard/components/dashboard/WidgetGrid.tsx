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
        className="hidden md:block columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 p-2 flex-1 min-h-0 overflow-y-auto custom-scrollbar"
      >
        {Object.entries(currentLayout.widgetAssignments).map(([widgetId]) => {
          const widget = WIDGET_REGISTRY[widgetId];
          if (!widget) return null;

          const Component = widget.component;

          return (
            <div key={widgetId} className="break-inside-avoid mb-4 relative overflow-hidden rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md">
              <div className="h-full w-full overflow-hidden">
                <Component />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Stack View */}
      <div className="md:hidden flex flex-col gap-4 p-2 pb-20 overflow-y-auto">
        {Object.keys(currentLayout.widgetAssignments).map((widgetId) => {
          const widget = WIDGET_REGISTRY[widgetId];
          if (!widget) return null;

          const Component = widget.component;

          return (
            <div key={widgetId} className="relative overflow-hidden rounded-xl border border-white/5 bg-black/40 backdrop-blur-md min-h-[200px]">
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
