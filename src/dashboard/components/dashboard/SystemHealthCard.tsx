import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Circle, CheckCircle2, AlertTriangle, XCircle, RotateCw } from "lucide-react";
import * as api from "@/lib/apiService";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ServiceStatus
{
  id: string;
  name: string;
  status: "healthy" | "unhealthy" | "checking" | "starting" | "stopping";
  message?: string;
}

export function SystemHealthCard ()
{
  const [services, setServices] = useState<ServiceStatus[]>( [
    { id: "ollama", name: "Ollama", status: "checking" },
    { id: "anythingllm", name: "AnythingLLM", status: "checking" },
    { id: "agents", name: "Agents", status: "checking" },
    { id: "mcp", name: "MCP Servers", status: "checking" },
    { id: "python", name: "Python Service", status: "checking" },
    { id: "cloudflare", name: "Cloudflare", status: "checking" },
  ] );
  const [cognitive, setCognitive] = useState<any>( null );
  const [lastCheck, setLastCheck] = useState<string>( "" );
  const [isChecking, setIsChecking] = useState( false );
  const [loading, setLoading] = useState<Record<string, boolean>>( {} );

  const checkHealth = async () =>
  {
    setIsChecking( true );
    try
    {
      const health = await api.checkHealth();
      setCognitive( health.cognitive );
      const so = ( s: { status?: string } | string ) =>
        ( typeof s === "object" ? s.status : s ) ?? "unhealthy";
      const ok = ( s: { status?: string } | string ) => so( s ) === "healthy";

      const newServices: ServiceStatus[] = [
        {
          id: "ollama",
          name: "Ollama Local",
          status: ok( health.services.ollama ) ? "healthy" : "unhealthy",
          message: ok( health.services.ollama )
            ? "Engine ready"
            : "Run: ollama serve",
        },
        {
          id: "anythingllm",
          name: "Knowledge Base",
          status: ok( health.services.anythingllm ) ? "healthy" : "unhealthy",
          message: ok( health.services.anythingllm )
            ? "API connected"
            : "Service unreachable",
        },
        {
          id: "agents",
          name: "Agent Cluster",
          status: ok( health.services.agents ) ? "healthy" : "unhealthy",
          message: ok( health.services.agents )
            ? "All systems nominal"
            : "Registry empty",
        },
        {
          id: "mcp",
          name: "MCP Protocol",
          status: ok( health.services.mcp ) ? "healthy" : "unhealthy",
          message: ok( health.services.mcp )
            ? "Protocol active"
            : "No MCP host found",
        },
        {
          id: "python",
          name: "Python API",
          status: ok( health.services.python ) ? "healthy" : "unhealthy",
          message: ok( health.services.python )
            ? "Environment OK"
            : "Process inactive",
        },
        {
          id: "cloudflare",
          name: "Edge Network",
          status: ok( health.services.cloudflare ) ? "healthy" : "unhealthy",
          message: ok( health.services.cloudflare )
            ? "Gateway & R2 OK"
            : "Auth/Connection error",
        },
      ];

      setServices( newServices );
      setLastCheck( new Date().toLocaleString( "hu-HU" ) );
    } catch ( error: any )
    {
      console.error( "Health check error:", error );
      setServices( ( prev ) =>
        prev.map( ( s ) => ( {
          ...s,
          status: "unhealthy",
          message: "Master node offline",
        } ) ),
      );
    } finally
    {
      setIsChecking( false );
    }
  };

  const handleToggle = async ( serviceId: string, currentlyHealthy: boolean ) =>
  {
    if ( serviceId === "agents" || serviceId === "mcp" )
    {
      toast.info( `${ serviceId } managed by system kernel` );
      return;
    }

    setLoading( ( prev ) => ( { ...prev, [serviceId]: true } ) );
    try
    {
      if ( currentlyHealthy )
      {
        if ( serviceId === "anythingllm" )
        {
          toast.info( "Close AnythingLLM Desktop manually" );
          return;
        }
        const result = await api.stopService( serviceId as any );
        if ( result.success ) toast.success( result.message );
        else toast.error( result.message );
      } else
      {
        const result = await api.startService( serviceId as any );
        if ( result.success ) toast.success( result.message );
        else toast.error( result.message );
      }
      await checkHealth();
    } catch ( e: any )
    {
      toast.error( e.message || "Operation failed" );
    } finally
    {
      setLoading( ( prev ) => ( { ...prev, [serviceId]: false } ) );
    }
  };

  useEffect( () =>
  {
    checkHealth();
    const interval = setInterval( checkHealth, 30000 );
    return () => clearInterval( interval );
  }, [] );

  const getStatusIcon = ( status: string ) =>
  {
    switch ( status )
    {
      case "healthy":
        return (
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
        );
      case "unhealthy":
        return (
          <div className="h-1.5 w-1.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]" />
        );
      case "checking":
        return (
          <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.6)] animate-pulse" />
        );
      default:
        return (
          <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
        );
    }
  };

  const healthyCount = services.filter( ( s ) => s.status === "healthy" ).length;
  const totalCount = services.length;

  return (
    <div className="flex flex-col h-full bg-zinc-950/20 backdrop-blur-xl">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.03]">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-white/[0.03] border border-white/[0.05]">
            <RotateCw
              size={14}
              className={isChecking ? "animate-spin text-cyan-400" : "text-zinc-500"}
            />
          </div>
          <div>
            <h3 className="text-[10px] font-bold tracking-[0.2em] text-zinc-200 uppercase leading-none">
              Health Monitor
            </h3>
            <p className="text-[9px] text-zinc-500 font-mono mt-1 leading-none uppercase tracking-widest">
              Diagnostic Stream
            </p>
          </div>
        </div>
        <div className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.06] flex items-center gap-2">
          <span className="text-[9px] font-bold text-zinc-400 font-mono">NODE_OK</span>
          <span className="text-[10px] font-bold text-emerald-400 font-mono">
            {healthyCount}/{totalCount}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 divide-y divide-white/[0.03]">
          {services.map( ( service ) =>
          {
            const isHealthy = service.status === "healthy";
            const canToggle =
              service.id === "ollama" ||
              service.id === "anythingllm" ||
              service.id === "python";

            return (
              <div
                key={service.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="shrink-0">
                    {getStatusIcon( service.status )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[11px] text-zinc-200 uppercase tracking-wide group-hover:text-white transition-colors">
                      {service.name}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[200px]">
                      {service.message || "NOMINAL"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {canToggle && (
                    <Switch
                      checked={isHealthy}
                      disabled={loading[service.id] || isChecking}
                      onCheckedChange={() =>
                        handleToggle( service.id, isHealthy )
                      }
                      className="scale-[0.65] data-[state=checked]:bg-emerald-500/50"
                    />
                  )}
                  {!canToggle && (
                    <div className="px-1.5 py-0.5 rounded-[2px] bg-white/[0.03] border border-white/[0.05]">
                      <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-tighter">
                        Kernel
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          } )}
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/[0.03] bg-white/[0.01]">
        <div className="flex items-center justify-between">
          <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
            Last Sequence
          </span>
          <span className="text-[9px] text-zinc-500 font-mono">
            {lastCheck || "READY"}
          </span>
        </div>
      </div>
    </div>
  );
}
