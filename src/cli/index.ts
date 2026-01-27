import { Command } from 'commander';
import inquirer from 'inquirer';
import { MemoryManager } from './memory';
import { DiscoveryService } from './discovery';
import { McpClientManager } from './mcp_client';
import { PythonBridge } from './python_bridge';
import path from 'path';
import { chatCommand } from './commands/chat';
import { extensionCommand } from './commands/extension';
import { runCommand } from './commands/run';
import { conductorCommand } from './commands/conductor';
import { connectCommand } from './commands/connect';
import { agentCommand } from './commands/agent';

const program = new Command();
const memory = new MemoryManager();
const discovery = new DiscoveryService();
const mcpClient = new McpClientManager();
const pythonBridge = new PythonBridge();

async function mainMenu() {
    const choices = [
        { name: '🔍 Szerverek felderítése és csatlakozás', value: 'discover' },
        { name: '🛠️  Eszközök listázása (Aktív kapcsolatok)', value: 'tools' },
        { name: '⚙️  Beállítások (Mód váltás)', value: 'settings' },
        { name: '❌ Kilépés', value: 'exit' }
    ];

    const { action } = await inquirer.prompt([{ 
        type: 'list',
        name: 'action',
        message: 'Főmenü:',
        choices: choices
    }]);

    switch (action) {
        case 'discover':
            await handleDiscovery();
            break;
        case 'tools':
            await handleTools();
            break;
        case 'settings':
            await handleSettings();
            break;
        case 'exit':
            console.log('Viszlát!');
            process.exit(0);
    }

    // Visszatérés a főmenübe
    await mainMenu();
}

async function handleDiscovery() {
    console.log('\nSzerverek keresése...');
    const servers = await discovery.findServers();

    if (servers.length === 0) {
        console.log('Nem található szerver a szokásos helyeken.');
        return;
    }

    const choices = servers.map(s => ({
        name: `${s.name} (${s.type}) - ${path.basename(s.path)}`,
        value: s
    }));

    choices.push({ name: '🔙 Vissza', value: null } as any);

    const { server } = await inquirer.prompt([{ 
        type: 'list',
        name: 'server',
        message: 'Válassz szervert a csatlakozáshoz:',
        choices: choices
    }]);

    if (!server) return;

    try {
        let command: string;
        let args: string[];

        if (server.type === 'python') {
            command = pythonBridge.getPythonPath();
            // A szerverek általában modulként futtathatók, de itt most feltételezzük a közvetlen path-t vagy -m kapcsolót
            // A discovery path abszolút útvonalat ad vissza.
            // A Python szerverek struktúrája: src/servers/valami.py
            // Futtatás: python src/servers/valami.py (vagy -m src.servers.valami)
            // A biztonság kedvéért a fájl elérési útját adjuk át.
            args = [server.path];
        } else {
            // Node szerver (TS)
            // ts-node futtatás szükséges
            command = 'npx'; // Vagy a node_modules/.bin/ts-node
            args = ['ts-node', server.path];
            // Windows workaround ha npx nem megy:
            if (process.platform === 'win32') {
                 // Egyszerűsítés: node build/index.js ha van, de most forrást nézünk.
                 // Használjuk a node-ot a ts-node regiszterrel, ahogy a tesztnél
                 command = 'node';
                 args = ['-r', './node_modules/ts-node/register', server.path];
            }
        }

        await mcpClient.connectStdio(server.name, command, args);
        console.log(`Sikeresen csatlakoztatva: ${server.name}`);
        
        // Automatikusan mentsük el a kapcsolatot a memóriába (opcionális, most nem bonyolítom)

    } catch (error: any) {
        console.error('Hiba a csatlakozáskor:', error.message);
    }
}

async function handleTools() {
    const clientNames = mcpClient.getClientNames();

    if (clientNames.length === 0) {
        console.log('Nincs aktív kapcsolat. Először csatlakozz egy szerverhez!');
        return;
    }

    const { selectedClient } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedClient',
        message: 'Válassz klienst:',
        choices: [...clientNames, { name: '🔙 Vissza', value: null }]
    }]);

    if (!selectedClient) return;

    try {
        console.log(`Eszközök lekérdezése innen: ${selectedClient}...`);
        const toolsResult = await mcpClient.listTools(selectedClient);
        
        if (toolsResult.tools.length === 0) {
            console.log('Ez a szerver nem szolgáltat eszközöket.');
        } else {
            console.table(toolsResult.tools.map(t => ({ 
                Name: t.name, 
                Description: t.description ? t.description.substring(0, 50) + '...' : 'N/A' 
            })));
        }
    } catch (error: any) {
        console.error('Hiba az eszközök listázásakor:', error.message);
    }
}

async function handleSettings() {
    const currentMode = memory.get('mode');
    console.log(`Jelenlegi mód: ${currentMode}`);

    const { newMode } = await inquirer.prompt([{ 
        type: 'list',
        name: 'newMode',
        message: 'Válassz új módot:',
        choices: [
            { name: '🛡️  Safe Mode', value: 'safe' },
            { name: '🚀 Full Access', value: 'full' },
            { name: '🔙 Mégse', value: currentMode }
        ]
    }]);

    if (newMode !== currentMode) {
        memory.set('mode', newMode);
        console.log(`Mód frissítve: ${newMode}`);
    }
}

async function main() {
    console.clear();
    console.log('🌟 Gemini CLI Refined & Expanded 🌟');
    console.log('-----------------------------------');

    let mode = memory.get('mode');

    if (!mode) {
        const answer = await inquirer.prompt([ 
            {
                type: 'list',
                name: 'mode',
                message: 'Válassz működési módot első indításkor:',
                choices: [
                    { name: '🛡️  Safe Mode (Csak olvasás)', value: 'safe' },
                    { name: '🚀 Full Access (Teljes hozzáférés)', value: 'full' }
                ]
            }
        ]);
        mode = answer.mode;
        memory.set('mode', mode);
    } else {
        console.log(`Üzemmód: ${mode} (betöltve)`);
    }

    memory.set('lastRun', new Date().toISOString());

    program
        .name('gemini-cli')
        .description('Gemini CLI Refined & Expanded')
        .version('1.0.0');

    program
        .command('chat')
        .description('Start interactive chat mode')
        .action(chatCommand);

    program
        .command('extension <action>')
        .description('Manage extensions (list, install)')
        .action(extensionCommand);

    program
        .command('run <script>')
        .description('Run a script')
        .action(runCommand);

    program
        .command('conductor <action>')
        .description('Manage project tracks and status')
        .action(conductorCommand);

    program
        .command('connect [serverName]')
        .description('Connect to a configured MCP server')
        .action(connectCommand);

    program
        .addCommand(agentCommand);

    // Ha vannak argumentumok, a commander kezeli
    if (process.argv.length > 2) {
        program.parse(process.argv);
    } else {
        // Interaktív mód
        await mainMenu();
    }
}

main().catch(err => console.error(err));
