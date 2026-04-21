/**
 * Service Control Widget - Mission Control 2.0
 * Kapcsolók: Ollama, AnythingLLM, Python Subsystem
 * Státusz: 🟢 Online / 🔴 Offline / 🟡 Starting
 */

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowsClockwise } from "@phosphor-icons/react";
import * as api from "@/lib/apiService";
import type { ServiceState } from "@/lib/apiService";
import { toast } from "sonner";

const STATUS_EMOJI: Record<string, string> = {
  online: "🟢",
  offline: "🔴",
  starting: "🟡",
  stopping: "🟡",
  unknown: "⚪",
};

export function ServiceControlWidget() {
  const { t } = useTranslation();
  const [services, setServices] = useState<ServiceState[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  const SERVICE_LABELS: Record<string, string> = {
    ollama: t("services.labels.ollama"),
    anythingllm: t("services.labels.anythingllm"),
    python: t("services.labels.python"),
    n8n: t("services.labels.n8n"),
    langflow: t("services.labels.langflow"),
  };

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const states = await api.getServiceStatus();
      setServices(states);
    } catch (e) {
      toast.error(t("services.fetch_error"));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleToggle = async (serviceId: string, currentlyOnline: boolean) => {
    if (loading[serviceId]) return;
    setLoading((prev) => ({ ...prev, [serviceId]: true }));

    try {
      if (currentlyOnline) {
        if (serviceId === "anythingllm") {
          toast.info(t("services.manual_close"));
          return;
        }
        const result = await api.stopService(serviceId as any);
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      } else {
        const result = await api.startService(
          serviceId as any,
        );
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      }
      await fetchStatus();
    } catch (e: any) {
      toast.error(e.message || t("services.op_failed"));
    } finally {
      setLoading((prev) => ({ ...prev, [serviceId]: false }));
    }
  };

  const startAutomationStack = async () => {
    toast.info(t("services.automation_start"));
    try {
      await Promise.all([
        api.startService("n8n"),
        api.startService("langflow")
      ]);
      toast.success(t("services.automation_sent"));
      fetchStatus();
    } catch (e: any) {
      toast.error(t("services.automation_error"));
    }
  };

  return (
    <Card className="bg-transparent border-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium text-zinc-200">
          {t("services.title")}
        </CardTitle>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={startAutomationStack}
            className="h-7 text-[10px] uppercase tracking-wider border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
          >
            {t("services.start_stack")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={isRefreshing}
            aria-label={t("services.refresh")}
            title={t("services.refresh")}
            className="text-zinc-400 hover:text-zinc-200"
          >
            <ArrowsClockwise
              size={14}
              className={isRefreshing ? "animate-spin" : ""}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {services.map((svc, i) => {
          const isOnline = svc.status === "online";
          const isStarting =
            svc.status === "starting" || svc.status === "stopping";

          return (
            <div
              key={`${svc.id}-${i}`}
              className="flex items-center justify-between rounded-lg border border-white/[0.04]/60 bg-zinc-900/40 px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">
                  {STATUS_EMOJI[svc.status] || "⚪"}
                </span>
                <span className="font-mono text-sm text-zinc-300">
                  {SERVICE_LABELS[svc.id] || svc.id}
                </span>
                {isStarting && (
                  <Badge variant="secondary" className="text-xs">
                    {svc.status === "starting" ? t("services.starting") : t("services.stopping")}
                  </Badge>
                )}
              </div>
              <Switch
                checked={isOnline}
                disabled={loading[svc.id] || isStarting}
                onCheckedChange={() => handleToggle(svc.id, isOnline)}
              />
            </div>
          );
        })}
        {services.length === 0 && (
          <p className="text-sm text-zinc-500">{t("services.loading")}</p>
        )}
      </CardContent>
    </Card>
  );
}
