import { Command } from 'commander';
import { fetchWithTimeout } from '../dashboard/lib/apiService.js';
import { logInfo, logError } from '@packages/utils/logger.js';

// Define the structure of the dashboard status response
interface DashboardStatusResponse {
  status: string;
  components: {
    backendHealth: { status: string; services: unknown; timestamp: string };
    agents: Array<{ name: string; status: string; description: string; }>;
    mcp: Array<{ name: string; status: string; tools: unknown[] }>;
    database: { status: string };
    uiRender: { status: string; message: string };
    socket: { status: string; message: string };
  };
  timestamp: string;
  error?: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function dashboardCommand(program: Command): void {
  const runDashboardStatus = async () => {
    logInfo('CLI', 'Lekérdezem a Dashboard állapotát...');
    try {
      const response = await fetchWithTimeout(`${process.env.API_BASE || 'http://localhost:3000'}/api/dashboard/status`);
      const data: DashboardStatusResponse = await response.json();

      writeLine('\n✨ Brunella Dashboard Státusz ✨');
      writeLine('---------------------------------');
      writeLine(`Összesített állapot: ${data.status}`);
      writeLine(`Utolsó frissítés: ${new Date(data.timestamp).toLocaleString()}`);
      writeLine('\nKomponensek:');
      writeLine(`  Backend Health: ${data.components.backendHealth.status}`);
      writeLine(`  Adatbázis: ${data.components.database.status}`);
      writeLine(`  UI Render Check: ${data.components.uiRender.status} (${data.components.uiRender.message})`);
      writeLine(`  Socket Csatlakozás: ${data.components.socket.status} (${data.components.socket.message})`);

      writeLine('\nÜgynökök:');
      if (data.components.agents && data.components.agents.length > 0) {
        data.components.agents.forEach(agent => {
          writeLine(`  - ${agent.name}: ${agent.status} (${agent.description.slice(0, 50)}...)`);
        });
      } else {
        writeLine('  Nincs regisztrált ügynök.');
      }

      writeLine('\nMCP Szerverek:');
      if (data.components.mcp && data.components.mcp.length > 0) {
        data.components.mcp.forEach(server => {
          writeLine(`  - ${server.name}: ${server.status} (${server.tools.length} eszköz)`);
        });
      } else {
        writeLine('  Nincsenek konfigurált MCP szerverek.');
      }

      if (data.error) {
        logError('CLI', `Hiba: ${data.error}`);
      }

    } catch (error: unknown) {
      logError('CLI', `Hiba a Dashboard állapotának lekérdezésekor: ${getErrorMessage(error)}`);
    }
  };

  const dashboard = program
    .command('dashboard')
    .description('Manage and view dashboard status')
    .action(() => {
      program.help(); // Show subcommands by default
    });

  dashboard
    .command('status')
    .description('Get current status of the Mission Control Dashboard and its components')
    .action(runDashboardStatus);

  // Backward compatibility: allow old `brunella status` usage for now.
  program
    .command('status')
    .description('Alias of `brunella dashboard status`')
    .action(runDashboardStatus);
}

