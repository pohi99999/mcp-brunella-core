import { useState } from 'react';
import {
  Plus,
  Trash2,
  Save,
  X,
  Link2,
  Settings,
  AlertCircle,
} from 'lucide-react';
import { Pipeline, DAGNode, DAGEdge, validatePipeline } from '../cean/types';
import { logInfo, logError } from '@/utils/logger';

/**
 * PipelineBuilder Component
 * Allows creating and editing DAG pipelines
 *
 * Features:
 * - Add/remove nodes
 * - Define dependencies/edges
 * - Validate DAG structure
 * - Test pipeline execution
 */
export const PipelineBuilder = ({
  initialPipeline,
  onSave,
}: {
  initialPipeline?: Pipeline;
  onSave?: (pipeline: Pipeline) => void;
}) => {
  const [pipeline, setPipeline] = useState<Pipeline>(
    initialPipeline || {
      id: `pipeline_${Date.now()}`,
      name: 'New Pipeline',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      nodes: [],
      edges: [],
      executionMode: 'mixed',
    },
  );

  const [newNodeName, setNewNodeName] = useState('');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showNodeForm, setShowNodeForm] = useState(false);

  const validation = validatePipeline(pipeline);

  // Add new node
  const addNode = () => {
    if (!newNodeName.trim()) return;

    const newNode: DAGNode = {
      id: `node_${Date.now()}`,
      name: newNodeName,
      type: 'sequential',
      agentType: 'research',
      payload: {},
      dependencies: [],
    };

    setPipeline((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));

    setNewNodeName('');
    setShowNodeForm(false);
    logInfo('PipelineBuilder', `Node added: ${newNode.id}`);
  };

  // Delete node
  const deleteNode = (nodeId: string) => {
    setPipeline((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter(
        (e) => e.from !== nodeId && e.to !== nodeId,
      ),
    }));

    if (selectedNode === nodeId) {
      setSelectedNode(null);
    }

    logInfo('PipelineBuilder', `Node deleted: ${nodeId}`);
  };

  // Add edge (dependency)
  const addEdge = (fromId: string, toId: string) => {
    if (fromId === toId) {
      setValidationErrors(['Cannot create self-loop']);
      return;
    }

    // Check if edge already exists
    if (pipeline.edges.some((e) => e.from === fromId && e.to === toId)) {
      return;
    }

    const newEdge: DAGEdge = {
      from: fromId,
      to: toId,
      condition: 'always',
    };

    const updatedPipeline = {
      ...pipeline,
      edges: [...pipeline.edges, newEdge],
    };

    // Update target node dependencies
    updatedPipeline.nodes = updatedPipeline.nodes.map((n) =>
      n.id === toId
        ? { ...n, dependencies: [...n.dependencies, fromId] }
        : n,
    );

    setPipeline(updatedPipeline);
    setValidationErrors([]);
    logInfo('PipelineBuilder', `Edge added: ${fromId} → ${toId}`);
  };

  // Remove edge
  const removeEdge = (fromId: string, toId: string) => {
    const updatedPipeline = {
      ...pipeline,
      edges: pipeline.edges.filter(
        (e) => !(e.from === fromId && e.to === toId),
      ),
    };

    // Update target node dependencies
    updatedPipeline.nodes = updatedPipeline.nodes.map((n) =>
      n.id === toId
        ? {
            ...n,
            dependencies: n.dependencies.filter((d) => d !== fromId),
          }
        : n,
    );

    setPipeline(updatedPipeline);
    setValidationErrors([]);
    logInfo('PipelineBuilder', `Edge removed: ${fromId} → ${toId}`);
  };

  // Update node property
  const updateNode = (nodeId: string, updates: Partial<DAGNode>) => {
    setPipeline((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, ...updates } : n,
      ),
    }));
  };

  // Save pipeline
  const savePipeline = () => {
    if (!validation.valid) {
      setValidationErrors(validation.errors);
      return;
    }

    if (onSave) {
      onSave(pipeline);
    }

    logInfo('PipelineBuilder', `Pipeline saved: ${pipeline.id}`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pipeline Builder
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Create and manage complex workflows with DAG
          </p>
        </div>

        <button
          onClick={savePipeline}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          <Save className="w-4 h-4" />
          Save Pipeline
        </button>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-2">
          {validationErrors.map((err, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 text-red-700 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{err}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Nodes List */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Nodes ({pipeline.nodes.length})
              </h3>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {pipeline.nodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => setSelectedNode(node.id)}
                  className={`
                    p-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition
                    ${
                      selectedNode === node.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/30'
                    }
                  `}
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {node.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {node.agentType}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              ))}
            </div>

            {/* Add Node Button */}
            {!showNodeForm ? (
              <button
                onClick={() => setShowNodeForm(true)}
                className="w-full p-3 border-t border-gray-200 dark:border-gray-800 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Node
              </button>
            ) : (
              <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
                <input
                  type="text"
                  placeholder="Node name..."
                  value={newNodeName}
                  onChange={(e) => setNewNodeName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addNode()}
                  className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={addNode}
                    className="flex-1 px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setShowNodeForm(false);
                      setNewNodeName('');
                    }}
                    className="flex-1 px-2 py-1 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Node Editor */}
        <div className="lg:col-span-3">
          {selectedNode ? (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
              <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-start justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  Edit Node
                </h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {(() => {
                  const node = pipeline.nodes.find(
                    (n) => n.id === selectedNode,
                  );
                  if (!node) return null;

                  return (
                    <>
                      {/* Node Name */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Node Name
                        </label>
                        <input
                          type="text"
                          value={node.name}
                          onChange={(e) =>
                            updateNode(node.id, { name: e.target.value })
                          }
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Agent Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Agent Type
                        </label>
                        <select
                          value={node.agentType}
                          onChange={(e) =>
                            updateNode(node.id, {
                              agentType: e.target.value as any,
                            })
                          }
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="research">Research</option>
                          <option value="grant">Grant</option>
                          <option value="harvester">Harvester</option>
                          <option value="analyzer">Analyzer</option>
                          <option value="aggregator">Aggregator</option>
                        </select>
                      </div>

                      {/* Node Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Execution Type
                        </label>
                        <select
                          value={node.type}
                          onChange={(e) =>
                            updateNode(node.id, { type: e.target.value as any })
                          }
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="sequential">Sequential</option>
                          <option value="parallel">Parallel</option>
                          <option value="root">Root</option>
                          <option value="aggregator">Aggregator</option>
                        </select>
                      </div>

                      {/* Max Retries */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Max Retries
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="5"
                          value={node.maxRetries || 0}
                          onChange={(e) =>
                            updateNode(node.id, {
                              maxRetries: parseInt(e.target.value),
                            })
                          }
                          className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Dependencies */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Add Dependency From
                        </label>
                        <div className="space-y-2">
                          {pipeline.nodes
                            .filter((n) => n.id !== node.id)
                            .map((otherNode) => {
                              const isDependent = node.dependencies.includes(
                                otherNode.id,
                              );
                              return (
                                <button
                                  key={otherNode.id}
                                  onClick={() => {
                                    if (isDependent) {
                                      removeEdge(otherNode.id, node.id);
                                    } else {
                                      addEdge(otherNode.id, node.id);
                                    }
                                  }}
                                  className={`
                                    w-full p-2 rounded text-left text-sm flex items-center gap-2 transition
                                    ${
                                      isDependent
                                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }
                                  `}
                                >
                                  {isDependent && (
                                    <Link2 className="w-4 h-4" />
                                  )}
                                  {otherNode.name}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                Select a node to edit
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pipeline Properties */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Pipeline Properties
          </h3>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pipeline Name
            </label>
            <input
              type="text"
              value={pipeline.name}
              onChange={(e) =>
                setPipeline((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Version
            </label>
            <input
              type="text"
              value={pipeline.version}
              onChange={(e) =>
                setPipeline((prev) => ({ ...prev, version: e.target.value }))
              }
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Execution Mode
            </label>
            <select
              value={pipeline.executionMode}
              onChange={(e) =>
                setPipeline((prev) => ({
                  ...prev,
                  executionMode: e.target.value as any,
                }))
              }
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="sequential">Sequential</option>
              <option value="parallel">Parallel</option>
              <option value="mixed">Mixed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Validation Status */}
      {validation.valid && (
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
          <p className="text-green-700 dark:text-green-300 text-sm flex items-center gap-2">
            ✅ Pipeline is valid and ready to execute
          </p>
        </div>
      )}
    </div>
  );
};
