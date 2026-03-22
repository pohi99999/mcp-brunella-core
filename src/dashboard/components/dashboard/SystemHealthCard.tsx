import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import {
  Circle,
  CheckCircle,
  Warning,
  XCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import * as api from "@/lib/apiService";
import { toast } from "sonner";

interface ServiceStatus {
  id: string;
  name: string;
  status: "healthy" | "unhealthy" | "checking" | "starting" | "stopping";
  message?: string;
}

export function SystemHealthCard() {
  const [services, setServices] = useState<ServiceStatus[]>([
    { id: "ollama", name: "Ollama", status: "checking" },
    { id: "anythingllm", name: "AnythingLLM", status: "checking" },
    { id: "agents", name: "Agents", status: "checking" },
    { id: "mcp", name: "MCP Servers", status: "checking" },
    { id: "python", name: "Python Service", status: "checking" },
    { id: "cloudflare", name: "Cloudflare", status: "checking" },
  ]);
  const [lastCheck, setLastCheck] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const checkHealth = async () => {
    setIsChecking(true);
    try {
      const health = await api.checkHealth();
      const so = (s: { status?: string } | string) =>
        (typeof s === "object" ? s.status : s) ?? "unhealthy";
      const ok = (s: { status?: string } | string) => so(s) === "healthy";

      const newServices: ServiceStatus[] = [
        {
          id: "ollama",
          name: "Ollama",
          status: ok(health.services.ollama) ? "healthy" : "unhealthy",
          message: ok(health.services.ollama)
            ? "Működik"
            : "Indítsd el: ollama serve",
        },
        {
          id: "anythingllm",
          name: "AnythingLLM",
          status: ok(health.services.anythingllm) ? "healthy" : "unhealthy",
          message: ok(health.services.anythingllm)
            ? "Működik"
            : "Service nem elérhető",
        },
        {
          id: "agents",
          name: "Agents",
          status: ok(health.services.agents) ? "healthy" : "unhealthy",
          message: ok(health.services.agents)
            ? "Aktív ágensek rendelkezésre állnak"
            : "Nincs regisztrált ágens",
        },
        {
          id: "mcp",
          name: "MCP Servers",
          status: ok(health.services.mcp) ? "healthy" : "unhealthy",
          message: ok(health.services.mcp)
            ? "MCP kapcsolat működik"
            : "Nincs elérhető MCP szerver",
        },
        {
          id: "python",
          name: "Python Service",
          status: ok(health.services.python) ? "healthy" : "unhealthy",
          message: ok(health.services.python)
            ? "Python alrendszer OK"
            : "Python server nem fut",
        },
        {
          id: "cloudflare",
          name: "Cloudflare",
          status: ok(health.services.cloudflare) ? "healthy" : "unhealthy",
          message: ok(health.services.cloudflare)
            ? "Gateway & R2 OK"
            : "CS csatlakozási hiba",
        },
      ];

      setServices(newServices);
      setLastCheck(new Date().toLocaleString("hu-HU"));
    } catch (error: any) {
      console.error("Health check error:", error);
      setServices((prev) =>
        prev.map((s) => ({
          ...s,
          status: "unhealthy",
          message: "Szerver nem elérhető",
        })),
      );
    } finally {
      setIsChecking(false);
    }
  };

  const handleToggle = async (serviceId: string, currentlyHealthy: boolean) => {
    if (serviceId === "agents" || serviceId === "mcp") {
      toast.info(`${serviceId} állapotát a rendszer automatikusan kezeli`);
      return;
    }

    setLoading((prev) => ({ ...prev, [serviceId]: true }));
    try {
      if (currentlyHealthy) {
        if (serviceId === "anythingllm") {
          toast.info("AnythingLLM Desktop app – manuálisan zárd be");
          return;
        }
        const result = await api.stopService(serviceId as any);
        if (result.success) toast.success(result.message);
        else toast.error(result.message);
      } else {
        const result = await api.startService(serviceId as any);
        if (result.success) toast.success(result.message);
        else toast.error(result.message);
      }
      await checkHealth();
    } catch (e: any) {
      toast.error(e.message || "Művelet sikertelen");
    } finally {
      setLoading((prev) => ({ ...prev, [serviceId]: false }));
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000); // 30s as per masterplan V3
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return (
          <CheckCircle size={20} className="text-green-500" weight="fill" />
        );
      case "unhealthy":
        return <XCircle size={14} className="text-red-500" weight="fill" />;
      case "checking":
        return (
          <Circle
            size={14}
            className="text-yellow-500 animate-pulse"
            weight="fill"
          />
        );
      default:
        return <Warning size={14} className="text-gray-500" />;
    }
  };

  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const totalCount = services.length;

  return (
    <Card className="bg-zinc-950/40 border-zinc-800/50 rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/5">
        <CardTitle className="text-[11px] font-medium tracking-wider uppercase text-zinc-500 flex items-center gap-2">
          <ArrowsClockwise
            size={16}
            className={isChecking ? "animate-spin" : ""}
          />
          System Engine Health
        </CardTitle>
        <div className="flex items-center gap-2">
          <Badge
            variant={healthyCount === totalCount ? "default" : "destructive"}
            className="text-[10px]"
          >
            {healthyCount}/{totalCount} OK
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/5">
          {services.map((service) => {
            const isHealthy = service.status === "healthy";
            const canToggle =
              service.id === "ollama" ||
              service.id === "anythingllm" ||
              service.id === "python";

            return (
              <div
                key={service.id}
                className="flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="font-medium text-xs font-mono">
                      {service.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">
                      {service.message || "System online"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {canToggle && (
                    <Switch
                      checked={isHealthy}
                      disabled={loading[service.id] || isChecking}
                      onCheckedChange={() =>
                        handleToggle(service.id, isHealthy)
                      }
                      className="scale-75"
                    />
                  )}
                  {!canToggle && (
                    <Badge
                      variant="outline"
                      className="text-[9px] h-5 opacity-50"
                    >
                      AUTO
                    </Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 bg-muted/20 border-t border-white/5">
          <p className="text-[9px] text-muted-foreground font-mono uppercase text-center">
            Last Check: {lastCheck || "Initializing..."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
