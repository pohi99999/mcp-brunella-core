import { spawn, ChildProcess } from 'child_process';
import { AgentRouter } from './router.js';
import { AgentSession } from '../types/buap.js';
import * as readline from 'readline';

interface ManagedProcess {
    agentId: string; // Initially unknown until handshake
    process: ChildProcess;
    startTime: Date;
}

export class AgentSupervisor {
    private processes: Map<number, ManagedProcess> = new Map(); // Keyed by PID
    private router: AgentRouter;

    constructor(router: AgentRouter) {
        this.router = router;
    }

    public spawnAgent(command: string, args: string[], env: NodeJS.ProcessEnv = {}) {
        const proc = spawn(command, args, {
            env: { ...process.env, ...env },
            stdio: ['pipe', 'pipe', 'inherit'] // We read stdout, write stdin. Stderr goes to parent.
        });

        if (!proc.pid) {
            throw new Error('Failed to spawn agent process');
        }

        const managed: ManagedProcess = {
            agentId: 'unknown',
            process: proc,
            startTime: new Date()
        };
        this.processes.set(proc.pid, managed);

        // Setup IO
        const rl = readline.createInterface({ input: proc.stdout! });
        
        // Session adapter
        const session: AgentSession = {
            id: 'pending',
            socket: proc,
            send: (msg) => {
                if (proc.stdin && proc.stdin.writable) {
                    const data = JSON.stringify(msg) + '\n';
                    proc.stdin.write(data);
                }
            }
        };

        // Wire Router
        this.router.registerSession(session);

        rl.on('line', (line) => {
            try {
                if (!line.trim()) return;
                const msg = JSON.parse(line);
                this.router.handleMessage(session, msg);
            } catch (error) {
                console.error(`[Agent PID ${proc.pid}] JSON Parse Error:`, error);
            }
        });

        proc.on('exit', (code) => {
            console.log(`Agent process ${proc.pid} exited with code ${code}`);
            this.processes.delete(proc.pid!);
            // Todo: Automatic restart logic
        });

        return proc.pid;
    }

    public killAgent(pid: number) {
        const p = this.processes.get(pid);
        if (p) {
            p.process.kill();
        }
    }
}
