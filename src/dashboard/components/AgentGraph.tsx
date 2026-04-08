
import { type ElementType, useCallback, useEffect, useState } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    MarkerType,
    Node,
    Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getRegistry, type RegistryAgent } from '@/lib/apiService';
import { useSystemSignal } from '@/hooks/useSystemSignal';
import {
    Robot,
    Brain,
    Code,
    MagnifyingGlass,
    ShieldCheck,
    Gear,
    PlugsConnected,
    MagicWand
} from '@phosphor-icons/react';

const AGENT_ICONS: Record<string, ElementType> = {
    'Orchestrator': MagicWand,
    'Researcher': MagnifyingGlass,
    'Developer': Code,
    'QA': ShieldCheck,
    'AgentArchitect': Brain,
    'Robotkez': Robot,
    'DataScientist': Gear,
    'Integrator': PlugsConnected
};

export function AgentGraph() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const { agents: liveAgents } = useSystemSignal();

    const updateGraph = useCallback(async () => {
        try {
            const registry = await getRegistry();
            const registryAgents = registry.agents || [];

            const newNodes: Node[] = [];
            const newEdges: Edge[] = [];

            // Orchestrator keresése a középponthoz
            const orchestrator = registryAgents.find(a => a.name === 'Orchestrator') || registryAgents[0];

            registryAgents.forEach((agent, index) => {
                const liveData = Array.from(liveAgents.values()).find(a => a.name === agent.name);
                const isWorking = liveData?.status === 'working';

                // Elhelyezkedés számítása (egyszerű körpálya az Orchestrator körül)
                const angle = (index / registryAgents.length) * 2 * Math.PI;
                const radius = agent.name === 'Orchestrator' ? 0 : 200;
                const x = radius * Math.cos(angle) + 400;
                const y = radius * Math.sin(angle) + 200;

                const Icon = AGENT_ICONS[agent.name] || Robot;

                newNodes.push({
                    id: agent.name,
                    position: { x, y },
                    data: {
                        label: (
                            <div className="flex flex-col items-center gap-1">
                                <div className={`p-2 rounded-lg ${isWorking ? 'bg-primary/20 animate-pulse' : 'bg-white/5'}`}>
                                    <Icon size={24} weight={isWorking ? "fill" : "thin"} className={isWorking ? "text-primary thin-glow" : "text-muted-foreground"} />
                                </div>
                                <span className="font-bold text-[10px]">{agent.name}</span>
                                <span className="text-[7px] opacity-70 uppercase tracking-tighter">{agent.role || 'Agent'}</span>
                                {isWorking && (
                                    <div className="flex gap-0.5 mt-0.5">
                                        <span className="w-1 h-1 rounded-full bg-primary animate-ping" />
                                        <span className="w-1 h-1 rounded-full bg-primary animate-ping delay-75" />
                                        <span className="w-1 h-1 rounded-full bg-primary animate-ping delay-150" />
                                    </div>
                                )}
                            </div>
                        )
                    },
                    className: cn(
                        'glass-card p-3 rounded-xl border transition-all duration-700 shadow-2xl overflow-visible',
                        agent.name === 'Orchestrator' ? 'border-primary/50 shadow-primary/10 ring-4 ring-primary/5' : 'border-white/10',
                        isWorking && 'border-primary shadow-primary/30 scale-105 z-50'
                    )
                });

                // Kapcsolat az Orchestratorral (ha nem ő az)
                if (agent.name !== 'Orchestrator' && orchestrator) {
                    newEdges.push({
                        id: `e-${orchestrator.name}-${agent.name}`,
                        source: orchestrator.name,
                        target: agent.name,
                        animated: isWorking,
                        label: isWorking ? 'active flux' : '',
                        labelStyle: { fontSize: 7, fill: isWorking ? '#10b981' : '#444', fontStyle: 'italic' },
                        markerEnd: { type: MarkerType.ArrowClosed, color: isWorking ? '#10b981' : '#333', width: 20, height: 20 },
                        style: {
                            stroke: isWorking ? '#10b981' : '#333',
                            strokeWidth: isWorking ? 3 : 1,
                            filter: isWorking ? 'drop-shadow(0 0 8px #10b981)' : 'none',
                            transition: 'all 1s ease'
                        }
                    });
                }
            });

            setNodes(newNodes);
            setEdges(newEdges);
        } catch (error) {
            console.error('Failed to update graph:', error);
        }
    }, [liveAgents, setNodes, setEdges]);

    useEffect(() => {
        updateGraph();
    }, [updateGraph]);

    const onConnect = useCallback(
        (params: Connection) => setEdges((eds) => addEdge(params, eds)),
        [setEdges],
    );

    return (
        <div style={{ width: '100%', height: '500px' }} className="rounded-xl overflow-hidden border glass-panel relative group">
            <div className="absolute top-2 left-2 z-10">
                <span className="text-[10px] font-mono text-muted-foreground bg-black/20 px-2 py-1 rounded backdrop-blur-md uppercase tracking-widest">
                    Neural Network Core
                </span>
            </div>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
            >
                <Controls className="bg-background/80 backdrop-blur-sm border rounded-md" />
                <MiniMap
                    className="bg-background/80 backdrop-blur-sm border rounded-md"
                    nodeColor={(node) => {
                        if (node.id === 'Orchestrator') return '#10b981';
                        return '#333';
                    }}
                />
                <Background gap={20} size={1} color="rgba(255,255,255,0.05)" />
            </ReactFlow>
        </div>
    );
}

function cn(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
