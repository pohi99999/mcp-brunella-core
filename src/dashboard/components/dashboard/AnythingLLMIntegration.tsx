import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Database, PaperPlaneRight, Sparkle, Info } from '@phosphor-icons/react';
import * as api from '@/lib/apiService';
import { toast } from 'sonner';

interface AnythingLLMIntegrationProps {
    className?: string;
}

export function AnythingLLMIntegration({ className }: AnythingLLMIntegrationProps) {
    const [workspaces, setWorkspaces] = useState<api.Workspace[]>([]);
    const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    const [response, setResponse] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
        setLoading(true);
        try {
            const data = await api.getAnythingLLMWorkspaces();
            setWorkspaces(data);
            
            if (data.length > 0) {
                // Select default workspace from env or first one
                const defaultWorkspace = process.env.ANYTHINGLLM_WORKSPACE || data[0].slug;
                setSelectedWorkspace(defaultWorkspace);
            } else {
                toast.warning('Nincs elérhető workspace', {
                    description: 'Hozz létre egy workspace-t az AnythingLLM-ben'
                });
            }
        } catch (error: any) {
            toast.error('AnythingLLM betöltési hiba', {
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim() || !selectedWorkspace) {
            toast.error('Hiányzó adat', {
                description: 'Válassz workspace-t és írj üzenetet'
            });
            return;
        }

        setIsProcessing(true);
        setResponse('');

        try {
            const result = await api.chatWithAnythingLLM(selectedWorkspace, message);
            setResponse(result);
            toast.success('RAG válasz megérkezett');
        } catch (error: any) {
            toast.error('AnythingLLM chat hiba', {
                description: error.message
            });
            setResponse(`Hiba: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSendMessage();
        }
    };

    if (loading) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Database size={24} />
                        AnythingLLM RAG
                    </CardTitle>
                    <CardDescription>Betöltés...</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className={className}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database size={24} />
                    AnythingLLM RAG
                </CardTitle>
                <CardDescription>
                    Kérdezz a tudásbázisodból dokumentumok alapján
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {workspaces.length === 0 ? (
                    <Alert>
                        <Info size={20} />
                        <AlertDescription>
                            Nincs elérhető workspace. Ellenőrizd az AnythingLLM kapcsolatot és az API kulcsot.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        {/* Workspace Selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Workspace</label>
                            <Select
                                value={selectedWorkspace}
                                onValueChange={setSelectedWorkspace}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Válassz workspace-t" />
                                </SelectTrigger>
                                <SelectContent>
                                    {workspaces.map((ws) => (
                                        <SelectItem key={ws.id} value={ws.slug}>
                                            <div className="flex items-center gap-2">
                                                <Database size={16} />
                                                {ws.name}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {workspaces.length} workspace elérhető
                            </p>
                        </div>

                        {/* Message Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Kérdés</label>
                            <Textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Pl.: Milyen dokumentumok vannak a projektről?"
                                className="min-h-[100px]"
                                disabled={isProcessing}
                            />
                            <p className="text-xs text-muted-foreground">
                                Ctrl+Enter a küldéshez
                            </p>
                        </div>

                        {/* Send Button */}
                        <Button
                            onClick={handleSendMessage}
                            disabled={isProcessing || !message.trim()}
                            className="w-full"
                        >
                            <Sparkle size={18} className={isProcessing ? 'animate-pulse' : ''} />
                            <span className="ml-2">
                                {isProcessing ? 'Feldolgozás...' : 'RAG Lekérdezés'}
                            </span>
                            {!isProcessing && <PaperPlaneRight size={18} className="ml-2" />}
                        </Button>

                        {/* Response */}
                        {response && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-medium">Válasz</label>
                                    <Badge variant="outline">RAG</Badge>
                                </div>
                                <div className="p-4 rounded-lg border bg-muted/50">
                                    <p className="text-sm whitespace-pre-wrap">{response}</p>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
