import React, { useState, useEffect } from "react";
// react-grid-layout v2: WidthProvider és Responsive a /legacy subpath-ban van
import { Responsive, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { WIDGET_REGISTRY } from "@/lib/widgetRegistry";
import { cn } from "@/lib/utils";
import { Settings2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ResponsiveGridLayout = WidthProvider(Responsive);

const LAYOUT_VERSION = "v2";

interface WidgetGridProps {
  registryAgents: any[];
  socketStatusMap: any;
  handleExecuteAgent: (name: string, task: string) => void;
  logs: any[];
}

export function WidgetGrid({ registryAgents, socketStatusMap, handleExecuteAgent, logs }: WidgetGridProps) {
  const [isEditMode, setIsEditMode] = useState(false);

  const defaultLayout: any[] = [
    { i: "health",        x: 0, y: 0,  w: 12, h: 4  },
    { i: "agent_status",  x: 0, y: 4,  w: 6,  h: 9  },
    { i: "jules",         x: 6, y: 4,  w: 6,  h: 9  },
    { i: "logs",          x: 0, y: 13, w: 8,  h: 12 },
    { i: "track_progress",x: 8, y: 13, w: 4,  h: 12 },
    { i: "test_results",  x: 0, y: 25, w: 12, h: 14 },
  ];

  const [layouts, setLayouts] = useState<{ lg: any[] }>(() => {
    try {
      const savedVersion = localStorage.getItem("bas-vcc-layout-version");
      if (savedVersion !== LAYOUT_VERSION) {
        localStorage.removeItem("bas-vcc-layout");
        return { lg: defaultLayout };
      }
      const saved = localStorage.getItem("bas-vcc-layout");
      return saved ? JSON.parse(saved) : { lg: defaultLayout };
    } catch {
      return { lg: defaultLayout };
    }
  });

  const onLayoutChange = (currentLayout: any[], allLayouts: { [key: string]: any[] }) => {
    setLayouts(allLayouts as { lg: any[] });
    localStorage.setItem("bas-vcc-layout", JSON.stringify(allLayouts));
    localStorage.setItem("bas-vcc-layout-version", LAYOUT_VERSION);
  };

  const resetLayout = () => {
    setLayouts({ lg: defaultLayout });
    localStorage.removeItem("bas-vcc-layout");
    localStorage.removeItem("bas-vcc-layout-version");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex flex-col">
          <h2 className="text-lg font-bold text-white tracking-tight">Mission Control</h2>
          <p className="text-xs text-zinc-500 font-mono">NEURAL_DASHBOARD_ACTIVE</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetLayout}
            className="text-zinc-500 hover:text-white gap-2"
          >
            <RotateCcw size={14} />
            Reset
          </Button>
          <Button
            variant={isEditMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className={cn("gap-2", isEditMode ? "bg-primary text-primary-foreground" : "border-white/10 text-zinc-400")}
          >
            <Settings2 size={14} />
            {isEditMode ? "Save Layout" : "Edit Layout"}
          </Button>
        </div>
      </div>

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={30}
        draggableHandle=".widget-handle"
        isDraggable={isEditMode}
        isResizable={isEditMode}
        onLayoutChange={onLayoutChange}
      >
        {layouts.lg.map((item) => {
          const widget = WIDGET_REGISTRY[item.i];
          if (!widget) return null;

          const Component = widget.component;
          const extraProps: any = {};

          if (item.i === "agent_status") {
            extraProps.agent = registryAgents[0];
            extraProps.status = socketStatusMap[registryAgents[0]?.name]?.status || 'idle';
            extraProps.taskDescription = socketStatusMap[registryAgents[0]?.name]?.task;
            extraProps.onExecute = handleExecuteAgent;
            extraProps.allAgents = registryAgents;
          } else if (item.i === "logs") {
            extraProps.logs = logs;
          }

          return (
            <div key={item.i} className={cn(
              "group relative overflow-hidden rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md",
              isEditMode && "ring-2 ring-primary/20 ring-offset-2 ring-offset-black"
            )}>
              {isEditMode && (
                <div className="widget-handle absolute inset-0 z-50 cursor-move bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="bg-primary text-white text-[10px] font-bold px-2 py-1 rounded shadow-lg uppercase tracking-widest">
                    {widget.label}
                  </div>
                </div>
              )}
              <div className="h-full w-full overflow-hidden">
                <Component {...extraProps} />
              </div>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
