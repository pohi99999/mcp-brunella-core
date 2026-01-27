import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { User, Robot, Toolbox, ChatCircleText } from '@phosphor-icons/react';

export const AgentNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-primary min-w-[150px]">
      <div className="flex items-center">
        <div className="rounded-full w-10 h-10 flex items-center justify-center bg-primary/10 mr-2">
          <User size={20} className="text-primary" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-muted-foreground uppercase">Agent</div>
          <div className="text-sm font-semibold">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-primary" />
    </div>
  );
});

export const PromptNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-blue-500 min-w-[150px]">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-blue-500" />
      <div className="flex items-center">
        <div className="rounded-full w-10 h-10 flex items-center justify-center bg-blue-500/10 mr-2">
          <Robot size={20} className="text-blue-500" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-muted-foreground uppercase">LLM / Prompt</div>
          <div className="text-sm font-semibold">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-blue-500" />
    </div>
  );
});

export const ToolNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-orange-500 min-w-[150px]">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-orange-500" />
      <div className="flex items-center">
        <div className="rounded-full w-10 h-10 flex items-center justify-center bg-orange-500/10 mr-2">
          <Toolbox size={20} className="text-orange-500" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-muted-foreground uppercase">Tool</div>
          <div className="text-sm font-semibold">{data.label}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-orange-500" />
    </div>
  );
});

export const ResponseNode = memo(({ data }: any) => {
  return (
    <div className="px-4 py-2 shadow-md rounded-md bg-card border-2 border-green-500 min-w-[150px]">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-green-500" />
      <div className="flex items-center">
        <div className="rounded-full w-10 h-10 flex items-center justify-center bg-green-500/10 mr-2">
          <ChatCircleText size={20} className="text-green-500" />
        </div>
        <div className="ml-2">
          <div className="text-xs font-bold text-muted-foreground uppercase">Output</div>
          <div className="text-sm font-semibold">{data.label}</div>
        </div>
      </div>
    </div>
  );
});
