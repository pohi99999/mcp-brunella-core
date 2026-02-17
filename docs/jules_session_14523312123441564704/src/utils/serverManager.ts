import type { ChildProcess } from 'child_process';
import net from 'net';
import path from 'path';

export async function checkServerRunning(port: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}

export async function startServer(): Promise<ChildProcess> {
  const { spawn } = await import('child_process');
  const serverPath = path.join(__dirname, '../../build/index.js');
  
  // We spawn the server. It will use stdio for MCP, but also start the web server on port 3000.
  // The CLI might want to use the stdio connection immediately if it spawned it?
  // But the requirement says "Hybrid": connect to running, OR start new.
  
  // If we start it, we can pipe stdio.
  const child = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe'], // We can use this for MCP communication if we want
    env: { ...process.env, WEB_UI_ENABLED: 'true' }
  });

  child.stderr?.on('data', (data) => {
    // Log server stderr?
  });

  return child;
}
