import { Command } from 'commander';
import { fetchWithTimeout } from '../dashboard/lib/apiService.js';
import { logInfo, logError } from '../utils/logger.js';

// Define the structure of the dashboard status response
interface DashboardStatusResponse {
  status: string;
  components: {
    backendHealth: { status: string; services: any; timestamp: string };
    agents: Array<{ name: string; status: string; description: string; }>;
    mcp: Array<{ name: string; status: string; tools: any[] }>;
    database: { status: string };
    uiRender: { status: string; message: string };
    socket: { status: string; message: string };
  };
  timestamp: string;
  error?: string;
}

export function dashboardCommand(program: Command) {
  const runDashboardStatus = async () => {
    logInfo('CLI', 'Lekérdezem a Dashboard állapotát...');
    try {
      const response = await fetchWithTimeout(`${process.env.API_BASE || 'http://localhost:3000'}/api/dashboard/status`);
      const data: DashboardStatusResponse = await response.json();

      console.log('\n✨ Brunella Dashboard Státusz ✨');
      console.log('---------------------------------');
      console.log(`Összesített állapot: ${data.status}`);
      console.log(`Utolsó frissítés: ${new Date(data.timestamp).toLocaleString()}`);
      console.log('\nKomponensek:');
      console.log(`  Backend Health: ${data.components.backendHealth.status}`);
      console.log(`  Adatbázis: ${data.components.database.status}`);
      console.log(`  UI Render Check: ${data.components.uiRender.status} (${data.components.uiRender.message})`);
      console.log(`  Socket Csatlakozás: ${data.components.socket.status} (${data.components.socket.message})`);

      console.log('\nÜgynökök:');
      if (data.components.agents && data.components.agents.length > 0) {
        data.components.agents.forEach(agent => {
          console.log(`  - ${agent.name}: ${agent.status} (${agent.description.slice(0, 50)}...)`);
        });
      } else {
        console.log('  Nincs regisztrált ügynök.');
      }

      console.log('\nMCP Szerverek:');
      if (data.components.mcp && data.components.mcp.length > 0) {
        data.components.mcp.forEach(server => {
          console.log(`  - ${server.name}: ${server.status} (${server.tools.length} eszköz)`);
        });
      } else {
        console.log('  Nincsenek konfigurált MCP szerverek.');
      }

      if (data.error) {
        logError('CLI', `Hiba: ${data.error}`);
      }

    } catch (e: any) {
      logError('CLI', `Hiba a Dashboard állapotának lekérdezésekor: ${e.message}`);
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
