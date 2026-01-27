import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Cpu, Power, Plugs, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useMcpStore } from '@/lib/mcpStore';
import { useMCP } from '@/hooks/useMCP';

export const McpRegistry: React.FC = () => {
    const { mcpServers } = useMcpStore();
    const { startMcpServer, stopMcpServer } = useMCP();

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Plugs size={24} className="text-primary" />
                    <div>
                        <CardTitle>MCP Szerver & Bővítmény Regiszter</CardTitle>
                        <CardDescription>Kezeld és aktiváld a külső MCP szervereket és belső bővítményeket.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {mcpServers.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg">
                        <Warning size={48} className="text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Nincsenek konfigurált MCP szerverek.</p>
                    </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {mcpServers.map((server) => (
                        <div key={server.name} className={`p-4 border rounded-lg bg-card flex flex-col gap-3 transition-opacity ${server.status === 'stopped' ? 'opacity-70' : 'opacity-100'}`}>
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                    <Cpu size={20} className={server.status === 'running' ? "text-primary" : "text-muted-foreground"} />
                                    <span className="font-semibold">{server.name}</span>
                                </div>
                                {server.status === 'running' ? (
                                    <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Aktív (PID: {server.pid})</Badge>
                                ) : server.status === 'error' ? (
                                    <Badge variant="destructive">Hiba</Badge>
                                ) : (
                                    <Badge variant="outline">Inaktív</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">Parancs: {server.command} {server.args.join(' ')}</p>
                            <div className="flex gap-2 mt-2">
                                {server.status === 'running' ? (
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="flex-1 gap-1 border-red-500/50 text-red-500 hover:bg-red-500/10"
                                        onClick={() => stopMcpServer(server.name)}
                                    >
                                        <Power size={14} /> Leállítás
                                    </Button>
                                ) : (
                                    <Button 
                                        size="sm" 
                                        variant="secondary" 
                                        className="flex-1 gap-1"
                                        onClick={() => startMcpServer(server.name)}
                                    >
                                        <Power size={14} /> Aktiválás
                                    </Button>
                                )}
                            </div>
                            {server.error && <p className="text-[10px] text-destructive mt-1 italic">{server.error}</p>}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
