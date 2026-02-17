import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  addEdge,
  Connection,
  MarkerType,
  Panel,
  Node
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getRegistry, type RegistryAgent } from '@/lib/apiService';
import { 
  Network, 
  Lock, 
  Unlock, 
  X,
  Zap, 
  Cpu, 
  Brain, 
  ShieldCheck,
  Search,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

const AGENT_ICONS: Record<string, React.ReactNode> = {
  orchestrator: <Zap className="text-amber-400" size={16} />,
  researcher: <Search className="text-blue-400" size={16} />,
  developer: <Code2 className="text-emerald-400" size={16} />,
  evaluator: <ShieldCheck className="text-rose-400" size={16} />,
  robotkez: <Cpu className="text-cyan-400" size={16} />,
  default: <Brain className="text-zinc-400" size={16} />
};

const AgentNode = ({ data }: any) => (
  <div className="px-4 py-3 shadow-xl rounded-xl bg-black/80 border border-white/10 backdrop-blur-md min-w-[180px] group transition-all hover:border-primary/50 cursor-pointer">
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
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLocked, setIsLocked] = useState(() => localStorage.getItem('neural-map-locked') === 'true');
  const [selectedNode, setSelectedNode] = useState<Node<RegistryAgent> | null>(null);

  useEffect(() => {
    getRegistry()
      .then(r => {
        const regAgents = r.agents || [];
        const savedLayout = localStorage.getItem('neural-map-layout');
        let initialNodes: Node<RegistryAgent>[] = [];

        if (savedLayout) {
          try {
            const savedNodes = JSON.parse(savedLayout);
            if (Array.isArray(savedNodes) && savedNodes.length > 0) {
              initialNodes = savedNodes;
            }
          } catch (e) {
            console.error("Failed to parse saved layout from localStorage", e);
            localStorage.removeItem('neural-map-layout');
          }
        }
        
        if (initialNodes.length === 0 && regAgents.length > 0) {
          initialNodes = regAgents.map((agent, i) => {
            const angle = (i / regAgents.length) * 2 * Math.PI;
            return {
              id: agent.name,
              type: 'agent',
              position: { x: 400 + Math.cos(angle) * 300, y: 300 + Math.sin(angle) * 300 },
              data: agent
            };
          });
        }
        setNodes(initialNodes);

        const savedEdges = localStorage.getItem('neural-map-edges');
        if (savedEdges) {
          try {
            const parsedEdges = JSON.parse(savedEdges);
            setEdges(Array.isArray(parsedEdges) ? parsedEdges : []);
          } catch(e) {
             console.error("Failed to parse saved edges from localStorage", e);
             localStorage.removeItem('neural-map-edges');
             setEdges([]);
          }
        } else {
          const initialEdges = regAgents
            .filter(a => a.name !== 'orchestrator' && regAgents.some(o => o.name === 'orchestrator'))
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
      })
      .catch(err => {
        console.error("Failed to fetch agent registry for Neural Map:", err);
        setNodes([]);
        setEdges([]);
      });
  }, [setNodes, setEdges]);

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
      style: { stroke: '#10b981', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#10b981' }
    }, eds));
  }, [setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<RegistryAgent>) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const toggleLock = () => setIsLocked(!isLocked);

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={!isLocked}
        fitView
        className="bg-[#020205]"
      >
        <Background color="#111" gap={20} />
        <Controls className="bg-black/50 border-white/10" />
        
        <Panel position="top-left" className='!left-2'>
            <div className="space-y-1">
                <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <Network className="text-primary" size={24} />
                    Neural Network Core
                </h2>
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.3em]">Synaptic Node Visualization</p>
            </div>
        </Panel>

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

      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="absolute top-0 right-0 h-full w-[350px] bg-black/70 backdrop-blur-lg border-l border-white/10 flex flex-col"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase italic">{selectedNode.data.name}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-white">
                <X size={16} />
              </Button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto custom-scrollbar">
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Description</h4>
                <p className="text-sm text-zinc-300 font-space leading-relaxed">{selectedNode.data.description}</p>
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">Capabilities</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedNode.data.capabilities.map(cap => (
                    <span key={cap} className="px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
