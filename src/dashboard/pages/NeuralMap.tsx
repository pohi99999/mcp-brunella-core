import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  Edge,
  MarkerType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getRegistry, type RegistryAgent } from '@/lib/apiService';
import { 
  Network, 
  Lock, 
  Unlock, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Zap, 
  Cpu, 
  Brain, 
  ShieldCheck,
  Search,
  Code2,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const AGENT_ICONS: Record<string, React.ReactNode> = {
  orchestrator: <Zap className="text-amber-400" size={16} />,
  researcher: <Search className="text-blue-400" size={16} />,
  developer: <Code2 className="text-emerald-400" size={16} />,
  evaluator: <ShieldCheck className="text-rose-400" size={16} />,
  robotkez: <Cpu className="text-cyan-400" size={16} />,
  default: <Brain className="text-zinc-400" size={16} />
};

// Custom Node Component for Agents
const AgentNode = ({ data }: any) => (
  <div className="px-4 py-3 shadow-xl rounded-xl bg-black/80 border border-white/10 backdrop-blur-md min-w-[180px] group transition-all hover:border-primary/50">
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white/5 border border-white/10 group-hover:bg-primary/10 transition-colors">
        {AGENT_ICONS[data.name.toLowerCase()] || AGENT_ICONS.default}
      </div>
      <div>
        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">{data.category || 'Agent'}</div>
        <div className="text-xs font-bold text-white uppercase italic">{data.name}</div>
      </div>
    </div>
    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
  </div>
);

const nodeTypes = {
  agent: AgentNode
};

export function NeuralMap() {
  const [agents, setAgents] = useState<RegistryAgent[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem('neural-map-locked') === 'true');
  const [searchTerm, setSearchTerm] = useState('');

  // Load Agents and Layout
  useEffect(() => {
    getRegistry().then(r => {
      const regAgents = r.agents || [];
      setAgents(regAgents);

      // Try to load saved positions
      const savedLayout = localStorage.getItem('neural-map-layout');
      let initialNodes = [];

      if (savedLayout) {
        initialNodes = JSON.parse(savedLayout);
      } else {
        // Default circular layout
        initialNodes = regAgents.map((agent, i) => {
          const angle = (i / regAgents.length) * 2 * Math.PI;
          return {
            id: agent.name,
            type: 'agent',
            position: { x: 400 + Math.cos(angle) * 300, y: 300 + Math.sin(angle) * 300 },
            data: { ...agent }
          };
        });
      }
      setNodes(initialNodes);

      // Default connections (core hierarchy)
      const savedEdges = localStorage.getItem('neural-map-edges');
      if (savedEdges) {
        setEdges(JSON.parse(savedEdges));
      } else {
        const initialEdges = regAgents
          .filter(a => a.name !== 'orchestrator')
          .map(a => ({
            id: `e-orchestrator-${a.name}`,
            source: 'orchestrator',
            target: a.name,
            animated: true,
            style: { stroke: '#3b82f6', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' }
          }));
        setEdges(initialEdges);
      }
    });
  }, [setNodes, setEdges]);

  // Save Layout when locked
  useEffect(() => {
    if (isLocked) {
      localStorage.setItem('neural-map-layout', JSON.stringify(nodes));
      localStorage.setItem('neural-map-edges', JSON.stringify(edges));
    }
    localStorage.setItem('neural-map-locked', String(isLocked));
  }, [isLocked, nodes, edges]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: '#10b981', strokeWidth: 2 }, // Green glowing edge for new connections
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
    }, eds));
  }, [setEdges]);

  const toggleLock = () => setIsLocked(!isLocked);

  const categories = useMemo(() => {
    const groups: Record<string, RegistryAgent[]> = {};
    agents.forEach(a => {
      const cat = a.category || 'unclassified';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(a);
    });
    return groups;
  }, [agents]);

  return (
    <div className="flex flex-col gap-8 h-full">
      {/* Upper Section: The Interactive Diagram */}
      <div className="relative h-[60vh] glass-panel rounded-2xl border-white/5 overflow-hidden group">
        <div className="absolute top-4 left-6 z-20 space-y-1">
          <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
            <Network className="text-primary" size={24} />
            Neural Network Core
          </h2>
          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Synaptic Node Visualization</p>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          nodesDraggable={!isLocked}
          nodesConnectable={!isLocked}
          elementsSelectable={!isLocked}
          fitView
          className="bg-[#020205]"
        >
          <Background color="#111" gap={20} />
          <Controls className="bg-black/50 border-white/10" />
          
          <Panel position="top-right">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleLock}
              className={cn(
                "gap-2 border-white/10 transition-all",
                isLocked ? "bg-amber-500/20 text-amber-500 border-amber-500/30" : "bg-white/5 text-zinc-400"
              )}
            >
              {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
              {isLocked ? 'LAYOUT LOCKED' : 'UNLOCK LAYOUT'}
            </Button>
          </Panel>
        </ReactFlow>

        {/* Global Glow Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_50%_-20%,rgba(59,130,246,0.1),transparent_50%)]" />
      </div>

      {/* Lower Section: Agent Catalog */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-space font-bold text-white flex items-center gap-2">
            <Info className="text-zinc-500" size={20} />
            Agent Capabilities Registry
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input 
              type="text" 
              placeholder="Filter agents..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-black/40 border border-white/5 rounded-lg pl-9 pr-4 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-primary/50 transition-colors w-64 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(categories).map(([cat, catAgents]) => (
            <Card key={cat} className="glass-card border-white/5 overflow-hidden">
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value={cat} className="border-none">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-100">{cat}</span>
                      <span className="text-[10px] font-mono text-zinc-500">({catAgents.length})</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-2 space-y-2">
                    {catAgents
                      .filter(a => a.name.toLowerCase().includes(searchTerm.toLowerCase()) || a.description.toLowerCase().includes(searchTerm.toLowerCase()))
                      .map(agent => (
                      <div key={agent.name} className="p-3 rounded-xl bg-white/5 border border-white/5 hover:border-primary/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white group-hover:text-primary transition-colors uppercase italic">{agent.name}</span>
                          {AGENT_ICONS[agent.name.toLowerCase()] || AGENT_ICONS.default}
                        </div>
                        <p className="text-[11px] text-zinc-400 font-space leading-relaxed line-clamp-2">
                          {agent.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {agent.capabilities.slice(0, 3).map(cap => (
                            <span key={cap} className="px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[8px] font-mono text-primary uppercase">
                              {cap}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
