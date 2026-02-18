import { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Circle,
  Check,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { Pipeline, DAGNode, DAGEdge, PipelineExecution } from '../cean/types';
import { logInfo, logError } from '@/utils/logger';

/**
 * PipelineVisualizer Component
 * Renders and animates DAG execution with visual feedback
 *
 * Features:
 * - Visual DAG representation
 * - Real-time node status updates
 * - Animated execution flow
 * - Execution history timeline
 */
export const PipelineVisualizer = ({
  pipeline,
  execution,
  onStop,
}: {
  pipeline: Pipeline;
  execution: PipelineExecution | null;
  onStop?: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [animationFrame, setAnimationFrame] = useState(0);

  // Draw DAG on canvas
  useEffect(() => {
    if (!canvasRef.current || !pipeline.nodes.length) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = Math.max(800, pipeline.nodes.length * 150);
    canvas.height = 400;

    // Clear canvas
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw edges first (so they appear behind nodes)
    pipeline.edges.forEach((edge) => {
      drawEdge(ctx, canvas.width, canvas.height, pipeline.nodes, edge);
    });

    // Draw nodes
    pipeline.nodes.forEach((node) => {
      drawNode(
        ctx,
        canvas.width,
        canvas.height,
        node,
        execution?.nodeStates.get(node.id),
      );
    });
  }, [pipeline, execution, animationFrame]);

  const drawNode = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    node: DAGNode,
    state: any,
  ) => {
    const nodeWidth = 120;
    const nodeHeight = 60;

    // Calculate position (simple grid layout)
    const col = Math.floor((node.id.charCodeAt(0) + node.id.length) % 5);
    const row = Math.floor(
      (node.id.charCodeAt(0) + node.id.length * 2) % 4,
    );

    const x = 50 + col * 150;
    const y = 50 + row * 80;

    // Draw node box
    const isSelected = selectedNode === node.id;
    const statusColor = getStatusColor(state?.status);

    ctx.fillStyle = statusColor;
    ctx.fillRect(x, y, nodeWidth, nodeHeight);

    // Border
    ctx.strokeStyle = isSelected ? '#3b82f6' : '#999';
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.strokeRect(x, y, nodeWidth, nodeHeight);

    // Text
    ctx.fillStyle = '#000';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(node.name, x + nodeWidth / 2, y + 20);

    ctx.font = '10px Arial';
    ctx.fillStyle = '#666';
    ctx.fillText(`(${node.agentType})`, x + nodeWidth / 2, y + 35);

    // Status icon
    if (state?.status === 'completed') {
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(x + nodeWidth - 10, y + 10, 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (state?.status === 'failed') {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(
        x + nodeWidth - 15,
        y + 5,
        10,
        10,
      );
    } else if (state?.status === 'running') {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(
        x + nodeWidth - 10,
        y + 10,
        6,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  };

  const drawEdge = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    nodes: DAGNode[],
    edge: DAGEdge,
  ) => {
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);

    if (!fromNode || !toNode) return;

    const nodeWidth = 120;
    const nodeHeight = 60;

    const col1 = Math.floor((edge.from.charCodeAt(0) + edge.from.length) % 5);
    const row1 = Math.floor(
      (edge.from.charCodeAt(0) + edge.from.length * 2) % 4,
    );
    const x1 = 50 + col1 * 150 + nodeWidth / 2;
    const y1 = 50 + row1 * 80 + nodeHeight;

    const col2 = Math.floor((edge.to.charCodeAt(0) + edge.to.length) % 5);
    const row2 = Math.floor(
      (edge.to.charCodeAt(0) + edge.to.length * 2) % 4,
    );
    const x2 = 50 + col2 * 150 + nodeWidth / 2;
    const y2 = 50 + row2 * 80;

    // Draw line with arrow
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.fillStyle = '#666';
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - 10 * Math.cos(angle - Math.PI / 6), y2 - 10 * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - 10 * Math.cos(angle + Math.PI / 6), y2 - 10 * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return '#d1fae5';
      case 'running':
        return '#fef3c7';
      case 'failed':
        return '#fee2e2';
      case 'skipped':
        return '#e5e7eb';
      default:
        return '#f3f4f6';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'running':
        return (
          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <Circle className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {pipeline.name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {pipeline.nodes.length} nodes, {pipeline.edges.length} edges
          </p>
        </div>

        <div className="flex items-center gap-2">
          {execution && (
            <>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  execution.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : execution.status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                }`}
              >
                {execution.status}
              </span>

              {execution.status === 'running' && onStop && (
                <button
                  onClick={onStop}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <Pause className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Canvas */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-x-auto bg-white dark:bg-gray-900">
        <canvas
          ref={canvasRef}
          onClick={(e) => {
            // TODO: Add click handling for node selection
          }}
          className="block w-full"
        />
      </div>

      {/* Node Details */}
      {selectedNode && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Node: {selectedNode}
              </h4>
              {execution && (
                <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    Status:{' '}
                    <span
                      className={`font-medium ${
                        execution.nodeStates.get(selectedNode)?.status ===
                        'completed'
                          ? 'text-green-600'
                          : 'text-gray-600'
                      }`}
                    >
                      {execution.nodeStates.get(selectedNode)?.status ||
                        'N/A'}
                    </span>
                  </p>
                  {execution.nodeStates.get(selectedNode)?.taskId && (
                    <p>
                      Task ID:{' '}
                      <code className="text-xs">
                        {execution.nodeStates.get(selectedNode)?.taskId}
                      </code>
                    </p>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gray-200"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-200"></div>
          <span>Running</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-green-200"></div>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-200"></div>
          <span>Failed</span>
        </div>
      </div>
    </div>
  );
};
