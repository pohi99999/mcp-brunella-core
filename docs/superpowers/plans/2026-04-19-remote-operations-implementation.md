# Remote Operations Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable remote management (file reading/writing and command execution) of client projects on the Z: drive directly from the Brunella Dashboard by wiring up the `remote.ts` endpoints.

**Architecture:** We will extend `apiService.ts` with typed fetch wrappers for the `/api/v1/remote` endpoints. We will then build a new React component, `RemoteOperationsPanel.tsx`, which provides a UI for these operations. Finally, we will register this panel in `navigation.tsx`.

**Tech Stack:** React, TailwindCSS, Express API (existing), Lucide Icons.

---

### Task 1: Update API Service (`src/dashboard/lib/apiService.ts`)

**Files:**
- Modify: `src/dashboard/lib/apiService.ts`

- [ ] **Step 1: Define types and add API functions**
Append the following to `src/dashboard/lib/apiService.ts`:

```typescript
// ─── Remote Operations API ───────────────────────────────────────────────

export interface RemoteCommandResponse {
  success: boolean;
  output?: string;
  error?: string;
}

export interface RemoteFileResponse {
  success: boolean;
  content?: string;
  error?: string;
}

export async function executeRemoteCommand(targetId: string, command: string, token?: string): Promise<RemoteCommandResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetchWithTimeout(`${API_BASE}/api/v1/remote/commands`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ targetId, command }),
  });
  
  if (!response.ok) {
     return { success: false, error: `HTTP Error: ${response.status}` };
  }
  return safeJson<RemoteCommandResponse>(response);
}

export async function readRemoteFile(targetId: string, filePath: string, token?: string): Promise<RemoteFileResponse> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const qs = new URLSearchParams({ targetId, path: filePath });
  const response = await fetchWithTimeout(`${API_BASE}/api/v1/remote/files/read?${qs.toString()}`, {
    headers,
  });
  
  if (!response.ok) {
     return { success: false, error: `HTTP Error: ${response.status}` };
  }
  return safeJson<RemoteFileResponse>(response);
}
```

- [ ] **Step 2: Commit API changes**
```bash
git add src/dashboard/lib/apiService.ts
git commit -m "feat(api): add client functions for remote operations"
```

---

### Task 2: Create Remote Operations Panel

**Files:**
- Create: `src/dashboard/components/dashboard/RemoteOperationsPanel.tsx`

- [ ] **Step 1: Scaffold the RemoteOperationsPanel component**
Create the file with the following content:

```tsx
import React, { useState } from 'react';
import { Terminal, FolderOpen, Play, FileText, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { executeRemoteCommand, readRemoteFile } from '@/lib/apiService';
import { toast } from 'sonner';

export function RemoteOperationsPanel() {
  const [targetId, setTargetId] = useState('Z:\\\\');
  const [command, setCommand] = useState('');
  const [filePath, setFilePath] = useState('');
  const [output, setOutput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRunCommand = async () => {
    if (!command) return;
    setLoading(true);
    try {
      const res = await executeRemoteCommand(targetId, command);
      if (res.success) {
        setOutput(res.output || 'Command executed successfully.');
        toast.success('Command executed');
      } else {
        setOutput(`Error: ${res.error}`);
        toast.error('Command failed');
      }
    } catch (err: any) {
      setOutput(`Exception: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleReadFile = async () => {
    if (!filePath) return;
    setLoading(true);
    try {
      const res = await readRemoteFile(targetId, filePath);
      if (res.success) {
        setOutput(res.content || '');
        toast.success('File loaded');
      } else {
        setOutput(`Error: ${res.error}`);
        toast.error('File read failed');
      }
    } catch (err: any) {
      setOutput(`Exception: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 p-4 text-zinc-100">
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-purple-400" />
        <div>
          <h2 className="text-lg font-semibold">Remote Operations (Z: Drive)</h2>
          <p className="text-xs text-zinc-400">Manage client projects remotely.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="bg-zinc-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-sm">Connection Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
             <div className="space-y-2">
              <label className="text-xs text-zinc-400">Target Environment ID (or Root Path)</label>
              <Input 
                value={targetId} 
                onChange={(e) => setTargetId(e.target.value)} 
                className="bg-black/50 border-white/10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-sm">Operations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                placeholder="ls -la" 
                value={command} 
                onChange={(e) => setCommand(e.target.value)}
                className="bg-black/50 border-white/10"
              />
              <Button onClick={handleRunCommand} disabled={loading || !command} className="bg-purple-600 hover:bg-purple-700">
                <Play className="w-4 h-4 mr-2" /> Run
              </Button>
            </div>
            <div className="flex gap-2">
              <Input 
                placeholder="package.json" 
                value={filePath} 
                onChange={(e) => setFilePath(e.target.value)}
                className="bg-black/50 border-white/10"
              />
              <Button onClick={handleReadFile} disabled={loading || !filePath} variant="outline" className="border-white/10">
                <FileText className="w-4 h-4 mr-2" /> Read
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black/80 border-white/10 min-h-[300px]">
        <CardHeader className="py-2 px-4 border-b border-white/5">
          <CardTitle className="text-xs font-mono text-zinc-500">Output Console</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap break-words overflow-auto max-h-[400px]">
            {output || 'Ready.'}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}

export default RemoteOperationsPanel;
```

- [ ] **Step 2: Commit UI component**
```bash
git add src/dashboard/components/dashboard/RemoteOperationsPanel.tsx
git commit -m "feat(ui): create RemoteOperationsPanel component"
```

---

### Task 3: Register Panel in Dashboard Navigation

**Files:**
- Modify: `src/dashboard/lib/navigation.tsx`

- [ ] **Step 1: Register the component**
In `src/dashboard/lib/navigation.tsx`, add the import and register it in the `navigationRegistry`.

```tsx
// Find imports and add:
import { RemoteOperationsPanel } from '../components/dashboard/RemoteOperationsPanel';

// Find the initNavigationRegistry function and add:
navigationRegistry.register( { id: "remote-ops", title: "Remote Operations", component: RemoteOperationsPanel, category: "Core", tags: ["remote", "command", "file"], permissions: ["admin-check"] } );
```

- [ ] **Step 2: Commit navigation changes**
```bash
git add src/dashboard/lib/navigation.tsx
git commit -m "feat(nav): register Remote Operations panel in dashboard navigation"
```
