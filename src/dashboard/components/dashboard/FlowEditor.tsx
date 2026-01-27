import React, { useState, useCallback } from 'react';
import ReactFlow, { 
    addEdge, 
    Background, 
    Controls, 
    MiniMap, 
    applyEdgeChanges, 
    applyNodeChanges,
    Connection,
    Edge,
    Node,
    OnNodesChange,
    OnEdgesChange,
    OnConnect,
    Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SquaresFour, Plus, FloppyDisk } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { AgentNode, PromptNode, ToolNode, ResponseNode } from './FlowNodes';
import { toast } from 'sonner';

const nodeTypes = {
  agent: AgentNode,
  prompt: PromptNode,
  tool: ToolNode,
  response: ResponseNode,
};

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'agent',
    data: { label: 'Brunella User' },
    position: { x: 50, y: 100 },
  },
  {
    id: '2',
    type: 'prompt',
    data: { label: 'Task Analysis' },
    position: { x: 300, y: 100 },
  },
  {
    id: '3',
    type: 'tool',
    data: { label: 'Google Search' },
    position: { x: 550, y: 50 },
  },
  {
    id: '4',
    type: 'tool',
    data: { label: 'Write File' },
    position: { x: 550, y: 150 },
  },
  {
    id: '5',
    type: 'response',
    data: { label: 'Final Answer' },
    position: { x: 800, y: 100 },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e2-4', source: '2', target: '4' },
  { id: 'e3-5', source: '3', target: '5' },
  { id: 'e4-5', source: '4', target: '5' },
];

export const FlowEditor: React.FC = () => {
    const [nodes, setNodes] = useState<Node[]>(initialNodes);
    const [edges, setEdges] = useState<Edge[]>(initialEdges);

    const onNodesChange: OnNodesChange = useCallback(
      (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
      []
    );
    const onEdgesChange: OnEdgesChange = useCallback(
      (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
      []
    );
    const onConnect: OnConnect = useCallback(
      (params: Connection) => setEdges((eds) => addEdge(params, eds)),
      []
    );

    const onSave = () => {
        console.log('Saving flow:', { nodes, edges });
        toast.success('Flow elmentve', { description: 'Az ágens folyamat sikeresen rögzítve.' });
    };

    const addNode = (type: string) => {
        const id = `${nodes.length + 1}`;
        const newNode: Node = {
            id,
            type,
            data: { label: `New ${type}` },
            position: { x: Math.random() * 400, y: Math.random() * 400 },
        };
        setNodes((nds) => nds.concat(newNode));
    };

    return (
        <Card className="w-full h-[700px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                    <SquaresFour size={24} className="text-primary" />
                    <div>
                        <CardTitle>Vizuális Agent Flow Szerkesztő</CardTitle>
                        <CardDescription>Tervezz ágens folyamatokat és logikai kapcsolatokat vizuálisan.</CardDescription>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={onSave}>
                        <FloppyDisk size={18} /> Mentés
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative">
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    fitView
                    className="bg-muted/5"
                >
                    <Background color="#aaa" gap={16} />
                    <Controls />
                    <MiniMap />
                    <Panel position="top-right" className="flex flex-col gap-2 bg-background/80 p-2 rounded-md border shadow-md">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Add Node</p>
                        <Button size="sm" variant="outline" className="justify-start gap-2 h-7 text-xs" onClick={() => addNode('agent')}>
                            <Plus size={14} /> Agent
                        </Button>
                        <Button size="sm" variant="outline" className="justify-start gap-2 h-7 text-xs" onClick={() => addNode('prompt')}>
                            <Plus size={14} /> Prompt
                        </Button>
                        <Button size="sm" variant="outline" className="justify-start gap-2 h-7 text-xs" onClick={() => addNode('tool')}>
                            <Plus size={14} /> Tool
                        </Button>
                        <Button size="sm" variant="outline" className="justify-start gap-2 h-7 text-xs" onClick={() => addNode('response')}>
                            <Plus size={14} /> Output
                        </Button>
                    </Panel>
                </ReactFlow>
            </CardContent>
        </Card>
    );
};