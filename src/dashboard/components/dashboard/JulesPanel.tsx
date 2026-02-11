import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Robot,
  ArrowsClockwise,
  Play,
  GitPullRequest,
} from "@phosphor-icons/react";
import {
  getJulesSessions,
  createJulesTask,
  syncJulesSession,
  type JulesSession,
} from "@/lib/apiService";
import { toast } from "sonner";

export function JulesPanel() {
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessions, setSessions] = useState<JulesSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refreshSessions = async () => {
    setIsLoading(true);
    try {
      const data = await getJulesSessions();
      setSessions(data);
    } catch (error) {
      console.error("Failed to load Jules sessions:", error);
      toast.error("Jules sessions load failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateTask = async () => {
    if (!prompt.trim()) return;
    setIsSubmitting(true);
    try {
      const result = await createJulesTask(prompt);
      toast.success(`Jules task started: ${result.sessionId || "queued"}`);
      setPrompt("");
      refreshSessions();
    } catch (error) {
      toast.error("Failed to create Jules task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSync = async (sessionId: string) => {
    try {
      await syncJulesSession(sessionId);
      toast.success("Sync started for session");
      refreshSessions();
    } catch (error) {
      toast.error("Sync failed");
    }
  };

  useEffect(() => {
    refreshSessions();
    // Auto-refresh every 30s
    const interval = setInterval(refreshSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="glass-panel border-purple-500/20 shadow-purple-900/10">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-purple-400">
          <Robot size={24} weight="duotone" />
          Jules Integration
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={refreshSessions}
          disabled={isLoading}
        >
          <ArrowsClockwise
            size={16}
            className={isLoading ? "animate-spin" : ""}
          />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Area */}
        <div className="space-y-2">
          <Textarea
            placeholder="Describe the task for Jules (e.g. 'Refactor the authentication logic in python')..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-black/20 border-white/10 min-h-[100px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleCreateTask}
              disabled={isSubmitting || !prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? (
                <ArrowsClockwise className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Send to Jules
            </Button>
          </div>
        </div>

        {/* Sessions List */}
        <div className="rounded-md border border-white/10 overflow-hidden">
          <Table>
            <TableHeader className="bg-white/5">
              <TableRow>
                <TableHead className="w-[100px]">Session ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Task</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center text-muted-foreground h-24"
                  >
                    No active sessions found.
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-mono text-xs">
                      {session.id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          session.status?.toLowerCase().includes("completed")
                            ? "default"
                            : session.status?.toLowerCase().includes("running")
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className="max-w-[300px] truncate"
                      title={session.task}
                    >
                      {session.task}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSync(session.id)}
                        title="Sync / Pull"
                      >
                        <GitPullRequest size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
