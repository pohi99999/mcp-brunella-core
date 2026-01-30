import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Circle, CheckCircle, Warning, XCircle, ArrowsClockwise } from '@phosphor-icons/react';
import * as api from '@/lib/apiService';
import { toast } from 'sonner';

interface ServiceStatus {
    name: string;
    status: 'healthy' | 'unhealthy' | 'checking';
    message?: string;
}

export function SystemHealthCard() {
    const [services, setServices] = useState<ServiceStatus[]>([
        { name: 'Ollama', status: 'checking' },
        { name: 'AnythingLLM', status: 'checking' },
        { name: 'Agents', status: 'checking' },
        { name: 'MCP Servers', status: 'checking' }
    ]);
    const [lastCheck, setLastCheck] = useState<string>('');
    const [isChecking, setIsChecking] = useState(false);

    const checkHealth = async () => {
        setIsChecking(true);
        try {
            const health = await api.checkHealth();
            const so = (s: { status?: string } | string) => (typeof s === 'object' ? s.status : s) ?? 'unhealthy';
            const ok = (s: { status?: string } | string) => so(s) === 'healthy';

            const newServices: ServiceStatus[] = [
                {
                    name: 'Ollama',
                    status: ok(health.services.ollama) ? 'healthy' : 'unhealthy',
                    message: ok(health.services.ollama) ? 'Működik' : 'Indítsd el: ollama serve',
                },
                {
                    name: 'AnythingLLM',
                    status: ok(health.services.anythingllm) ? 'healthy' : 'unhealthy',
                    message: ok(health.services.anythingllm) ? 'Működik' : 'Service nem elérhető',
                },
                {
                    name: 'Agents',
                    status: ok(health.services.agents) ? 'healthy' : 'unhealthy',
                    message: ok(health.services.agents) ? 'Aktív ágensek rendelkezésre állnak' : 'Nincs regisztrált ágens',
                },
                {
                    name: 'MCP Servers',
                    status: ok(health.services.mcp) ? 'healthy' : 'unhealthy',
                    message: ok(health.services.mcp) ? 'MCP kapcsolat működik' : 'Nincs elérhető MCP szerver',
                },
            ];

            setServices(newServices);
            setLastCheck(new Date().toLocaleString('hu-HU'));
            
            const unhealthy = newServices.filter(s => s.status === 'unhealthy');
            if (unhealthy.length > 0) {
                toast.warning(`${unhealthy.length} service nem elérhető`, {
                    description: unhealthy.map(s => s.name).join(', ')
                });
            }
        } catch (error: any) {
            toast.error('Health check sikertelen', {
                description: error.message
            });
            setServices(prev => prev.map(s => ({
                ...s,
                status: 'unhealthy',
                message: 'Szerver nem elérhető'
            })));
        } finally {
            setIsChecking(false);
        }
    };

    useEffect(() => {
        checkHealth();
        const interval = setInterval(checkHealth, 15000); // Check every 15 seconds
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'healthy':
                return <CheckCircle size={20} className="text-green-500" weight="fill" />;
            case 'unhealthy':
                return <XCircle size={20} className="text-red-500" weight="fill" />;
            case 'checking':
                return <Circle size={20} className="text-yellow-500 animate-pulse" weight="fill" />;
            default:
                return <Warning size={20} className="text-gray-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const variant = status === 'healthy' ? 'default' : status === 'unhealthy' ? 'destructive' : 'secondary';
        return (
            <Badge variant={variant}>
                {status === 'healthy' ? 'Működik' : status === 'unhealthy' ? 'Hiba' : 'Ellenőrzés...'}
            </Badge>
        );
    };

    const healthyCount = services.filter(s => s.status === 'healthy').length;
    const totalCount = services.length;
    const healthPercentage = (healthyCount / totalCount) * 100;

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-semibold">Rendszer Állapot</CardTitle>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={checkHealth}
                    disabled={isChecking}
                >
                    <ArrowsClockwise 
                        size={16} 
                        className={isChecking ? 'animate-spin' : ''} 
                    />
                    <span className="ml-2">Frissítés</span>
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Overall Status */}
                <Alert variant={healthPercentage === 100 ? 'default' : 'destructive'}>
                    <AlertDescription>
                        <div className="flex items-center justify-between">
                            <span className="font-medium">
                                {healthyCount} / {totalCount} service működik
                            </span>
                            {lastCheck && (
                                <span className="text-xs text-muted-foreground">
                                    Utolsó ellenőrzés: {lastCheck}
                                </span>
                            )}
                        </div>
                    </AlertDescription>
                </Alert>

                {/* Service List */}
                <div className="space-y-3">
                    {services.map((service) => (
                        <div
                            key={service.name}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                            <div className="flex items-center gap-3">
                                {getStatusIcon(service.status)}
                                <div>
                                    <p className="font-medium">{service.name}</p>
                                    {service.message && (
                                        <p className="text-sm text-muted-foreground">
                                            {service.message}
                                        </p>
                                    )}
                                </div>
                            </div>
                            {getStatusBadge(service.status)}
                        </div>
                    ))}
                </div>

                {/* Quick Actions for Unhealthy Services */}
                {services.some(s => s.status === 'unhealthy') && (
                    <Alert>
                        <AlertDescription>
                            <p className="font-medium mb-2">Gyorsjavítás:</p>
                            <ul className="text-sm space-y-1 list-disc list-inside">
                                {services.find(s => s.name === 'Ollama' && s.status === 'unhealthy') && (
                                    <li>Ollama: Futtasd a <code className="bg-muted px-1 rounded">ollama serve</code> parancsot</li>
                                )}
                                {services.find(s => s.name === 'AnythingLLM' && s.status === 'unhealthy') && (
                                    <li>AnythingLLM: Ellenőrizd az .env fájlban az API kulcsot</li>
                                )}
                            </ul>
                        </AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}
