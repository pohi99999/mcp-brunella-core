import { useState, useEffect } from 'react';
import { agentService, AgentDefinition } from '@/lib/agentService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Robot, Wrench, PencilSimple, Play } from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function AgentManager() {
    const [agents, setAgents] = useState<AgentDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingAgent, setEditingAgent] = useState<AgentDefinition | null>(null);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    
    const [isDelegateDialogOpen, setIsDelegateDialogOpen] = useState(false);
    const [delegateTask, setDelegateTask] = useState("");
    const [delegateResult, setDelegateResult] = useState<string | null>(null);
    const [delegating, setDelegating] = useState(false);

    useEffect(() => {
        loadAgents();
    }, []);

    async function loadAgents() {
        try {
            setLoading(true);
            const data = await agentService.listAgents();
            setAgents(data);
            setError(null);
        } catch (e) {
            setError("Failed to load agents. Make sure the server is running and MCP connection is active.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    }

    const handleEditClick = (agent: AgentDefinition) => {
        setEditingAgent(agent);
        setIsEditDialogOpen(true);
    };

    const handleDelegateClick = (agent: AgentDefinition) => {
        setEditingAgent(agent);
        setDelegateTask("");
        setDelegateResult(null);
        setIsDelegateDialogOpen(true);
    };

    const handleSaveAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAgent) return;

        try {
            await agentService.updateAgent(editingAgent.name, {
                description: editingAgent.description,
                capabilities: editingAgent.capabilities
            });
            toast.success("Agent updated successfully");
            setIsEditDialogOpen(false);
            loadAgents();
        } catch (error) {
            toast.error("Failed to update agent");
            console.error(error);
        }
    };

    const handleExecuteDelegate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAgent || !delegateTask) return;

        try {
            setDelegating(true);
            const result = await agentService.delegateTask(editingAgent.name, delegateTask);
            setDelegateResult(result);
        } catch (error) {
            toast.error("Delegation failed");
            setDelegateResult(`Error: ${String(error)}`);
        } finally {
            setDelegating(false);
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Loading agents...
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-destructive/50">
                <CardContent className="p-6 text-destructive">
                    {error}
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Robot size={24} weight="duotone" className="text-accent" />
                    Active Agents
                </CardTitle>
                <CardDescription>
                    List of autonomous agents currently active in the system.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-full pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {agents.map((agent) => (
                            <Card key={agent.name} className="border-border/50 relative group">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-lg font-mono">{agent.name}</CardTitle>
                                        <Badge variant="secondary">{agent.role}</Badge>
                                    </div>
                                    <CardDescription className="text-sm line-clamp-2">
                                        {agent.description}
                                    </CardDescription>
                                    
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            title="Delegate Task"
                                            onClick={() => handleDelegateClick(agent)}
                                        >
                                            <Play size={18} />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            title="Edit Configuration"
                                            onClick={() => handleEditClick(agent)}
                                        >
                                            <PencilSimple size={18} />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Wrench size={14} />
                                            Capabilities:
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {agent.capabilities?.map((cap) => (
                                                <Badge key={cap} variant="outline" className="text-xs bg-muted/50">
                                                    {cap}
                                                </Badge>
                                            )) || <span className="text-muted-foreground text-xs">None</span>}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>

            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Edit Agent: {editingAgent?.name}</DialogTitle>
                        <DialogDescription>
                            Make changes to the agent's configuration.
                        </DialogDescription>
                    </DialogHeader>
                    {editingAgent && (
                        <form onSubmit={handleSaveAgent} className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    value={editingAgent.description}
                                    onChange={(e) => setEditingAgent({ ...editingAgent, description: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="capabilities">Capabilities (comma separated)</Label>
                                <Input
                                    id="capabilities"
                                    value={editingAgent.capabilities.join(', ')}
                                    onChange={(e) => setEditingAgent({ 
                                        ...editingAgent, 
                                        capabilities: e.target.value.split(',').map(s => s.trim()).filter(Boolean) 
                                    })}
                                />
                            </div>
                            <DialogFooter>
                                <Button type="submit">Save changes</Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isDelegateDialogOpen} onOpenChange={setIsDelegateDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Delegate to: {editingAgent?.name}</DialogTitle>
                        <DialogDescription>
                            Send a direct instruction to this agent.
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleExecuteDelegate} className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="task">Task</Label>
                            <Textarea
                                id="task"
                                value={delegateTask}
                                onChange={(e) => setDelegateTask(e.target.value)}
                                placeholder="Describe the task..."
                                rows={4}
                            />
                        </div>
                        {delegateResult && (
                            <div className="mt-4 p-4 bg-muted rounded-md overflow-auto max-h-[200px] text-sm whitespace-pre-wrap">
                                <strong>Result:</strong><br/>
                                {delegateResult}
                            </div>
                        )}
                        <DialogFooter>
                            <Button type="submit" disabled={delegating}>
                                {delegating ? "Executing..." : "Execute"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
