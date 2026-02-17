#!/usr/bin/env node
/* eslint-disable no-console */
import "dotenv/config";
import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import figlet from 'figlet';
import { BrunellaClient } from './utils/mcpClient.js';
import { configManager } from './utils/cliConfig.js';
import { marked } from "marked";
import TerminalRenderer from "marked-terminal";
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { runInvoiceSync } from './cli/invoiceSync.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
marked.setOptions({ renderer: new TerminalRenderer() as any });

/**
 * BRUNELLA MAGYAR CLI (MAG-1.0)
 * 
 * Szigorúan menüvezérelt, magyar nyelvű interfész.
 * Filozófia: "Nincs begépelés, csak választás."
 */

const client = new BrunellaClient();
const BACK = '__back__';

async function pause() {
    await inquirer.prompt([{
        type: 'input',
        name: '_',
        message: chalk.dim('Nyomj Enter-t a folytatáshoz...')
    }]);
}

async function getTrackNames(): Promise<string[]> {
    const tracksDir = join(process.cwd(), 'conductor', 'tracks');
    if (!existsSync(tracksDir)) return [];
    try {
        return readdirSync(tracksDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
    } catch {
        return [];
    }
}

async function start() {
    try {
        await client.connect();
        await mainLoop();
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(chalk.red('Hiba a csatlakozás során:'), msg);
        process.exit(1);
    } finally {
        await client.close();
    }
}

async function mainLoop() {
    let version = '0.0.0';
    try {
        const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));
        version = pkg.version;
    } catch { /* ignore */ }

    while (true) {
        console.clear();
        console.log(chalk.cyan(figlet.textSync('BRUNELLA', { font: 'Standard' })));
        console.log(chalk.blue(boxen(`Magyar CLI v${version} | AI Vezérlőközpont`, { padding: 1, borderStyle: 'double' })));
        console.log(chalk.dim(`Munkakönyvtár: ${process.cwd()}\n`));

        const { choice } = await inquirer.prompt([{
            type: 'list',
            name: 'choice',
            message: chalk.bold('Válassz egy kategóriát:'),
            choices: [
                { name: '🤖  Ügynökök (Kezelés & Futtatás)', value: 'agents' },
                { name: '📋  Track-ek (Projekt Ütemterv)', value: 'tracks' },
                { name: '📄  Számlák (Szinkron)', value: 'invoices' },
                { name: '�  Chat & Kommunikáció', value: 'chat' },
                { name: '🔧  Rendszer & Diagnosztika', value: 'system' },
                { name: '⚙️   Beállítások', value: 'settings' },
                new inquirer.Separator(),
                { name: '🚪  Kilépés', value: 'exit' }
            ]
        }]);

        if (choice === 'exit') {
            console.log(chalk.yellow('\nViszlát! 👋\n'));
            process.exit(0);
        }

        try {
            if (choice === 'agents') await agentsMenu();
            else if (choice === 'tracks') await tracksMenu();
            else if (choice === 'invoices') await invoiceMenu();
            else if (choice === 'chat') await chatMenu();
            else if (choice === 'system') await systemMenu();
            else if (choice === 'settings') await settingsMenu();
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg.includes('User force closed')) continue;
            console.error(chalk.red('\nHiba történt:'), msg);
            await pause();
        }
    }
}

async function agentsMenu() {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: '🤖 Ügynökök:',
        choices: [
            { name: '📋  Ügynökök listázása', value: 'list' },
            { name: '▶️   Ügynök futtatása (Választó)', value: 'execute' },
            new inquirer.Separator(),
            { name: '⬅️   Vissza', value: BACK }
        ]
    }]);

    if (action === BACK) return;

    if (action === 'list') {
        const result = await client.callTool("agent_list", {});
        // @ts-expect-error - Tool result content access
        console.log('\n' + (result.content?.[0]?.text || 'Nincs válasz'));
        await pause();
    } else if (action === 'execute') {
        const listResult = await client.callTool("agent_list", {});
        // @ts-expect-error - Tool result content access
        const text = listResult.content?.[0]?.text || "";
        const agentNames = text.match(/• \*\*([^*]+)\*\*/g)?.map((m: string) => m.replace(/• \*\*|\*\*/g, '')) || [];
        
        if (agentNames.length === 0) {
            console.log(chalk.yellow('Nem található aktív ügynök.'));
            await pause();
            return;
        }

        const { agent } = await inquirer.prompt([{
            type: 'list',
            name: 'agent',
            message: 'Válassz ügynököt:',
            choices: agentNames
        }]);

        const { task } = await inquirer.prompt([{
            type: 'input',
            name: 'task',
            message: `Feladat a(z) ${agent} számára:`
        }]);

        if (!task) return;

        console.log(chalk.cyan(`\nFuttatás: ${agent}...`));
        const result = await client.callTool("agent_execute", { agentName: agent, task });
        // @ts-expect-error - Tool result content access
        console.log('\n' + (result.content?.[0]?.text || 'Nincs válasz'));
        await pause();
    }
}

async function tracksMenu() {
    const trackNames = await getTrackNames();

    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: '📋 Projekt Track-ek:',
        choices: [
            { name: '📊  Projekt státusz (Összesített)', value: 'status' },
            { name: '👁️   Track megtekintése (Kiválasztás)', value: 'view' },
            { name: '🔄  Track frissítése (Auto-Update)', value: 'update' },
            { name: '✨  Új Track generálása', value: 'generate' },
            { name: '🔄  Dokumentáció szinkronizálása', value: 'sync' },
            new inquirer.Separator(),
            { name: '⬅️   Vissza', value: BACK }
        ]
    }]);

    if (action === BACK) return;

    if (action === 'status') {
        const result = await client.callTool("agent_delegate", { agent_name: "ProjectConductor", task: "status" });
        // @ts-expect-error - Tool result content access
        console.log('\n' + marked(result.content?.[0]?.text || 'Nincs válasz'));
        await pause();
    } else if (action === 'view' || action === 'update') {
        if (trackNames.length === 0) {
            console.log(chalk.yellow('Nincs elérhető track.'));
            await pause();
            return;
        }
        const { target } = await inquirer.prompt([{
            type: 'list',
            name: 'target',
            message: 'Válassz Track-et:',
            choices: trackNames
        }]);

        if (action === 'view') {
            console.log(chalk.cyan(`\nMegtekintés: ${target}...`));
            const result = await client.callTool("agent_delegate", { 
                agent_name: "ProjectConductor", 
                task: `track view ${target}` 
            });
            // @ts-expect-error - Tool result content access
            console.log('\n' + marked(result.content?.[0]?.text || 'Nincs válasz'));
        } else {
            console.log(chalk.cyan(`\nUpdate folyamat indítása: ${target}...`));
            const result = await client.callTool("agent_delegate", { 
                agent_name: "ProjectConductor", 
                task: `track update ${target}` 
            });
            // @ts-expect-error - Tool result content access
            console.log('\n' + marked(result.content?.[0]?.text || 'Kész'));
        }
        await pause();
    } else if (action === 'generate') {
         const { idea } = await inquirer.prompt([{
            type: 'input',
            name: 'idea',
            message: 'Mire vonatkozzon az új Track? (Ötlet):'
        }]);
        if (!idea) return;
        console.log(chalk.cyan('\nTrack generálása...'));
        const result = await client.callTool("agent_delegate", { agent_name: "ProjectConductor", task: `track generate ${idea}` });
        // @ts-expect-error - Tool result content access
        console.log('\n' + (result.content?.[0]?.text || 'Kész'));
        await pause();
    } else if (action === 'sync') {
        console.log(chalk.cyan('\nDokumentáció szinkronizálása...'));
        const result = await client.callTool("agent_delegate", { agent_name: "ProjectConductor", task: "sync" });
        // @ts-expect-error - Tool result content access
        console.log('\n' + (result.content?.[0]?.text || 'Kész'));
        await pause();
    }
}

async function invoiceMenu() {
    const { mode } = await inquirer.prompt([
        {
            type: 'list',
            name: 'mode',
            message: '📄 Számla szinkron mód:',
            choices: [
                { name: '📥  Alap (legfrissebb számlák)', value: 'default' },
                { name: '💸  Csak nem fizetett', value: 'unpaid' },
                { name: '⏰  Csak lejárt', value: 'overdue' },
                { name: '📅  Dátumtól', value: 'since' },
                new inquirer.Separator(),
                { name: '⬅️   Vissza', value: BACK }
            ]
        }
    ]);

    if (mode === BACK) return;

    let sinceDate: string | undefined;
    if (mode === 'since') {
        const { since } = await inquirer.prompt([
            {
                type: 'input',
                name: 'since',
                message: 'Dátumtól (YYYY-MM-DD):',
                default: ''
            }
        ]);
        sinceDate = since || undefined;
    }

    const { limit } = await inquirer.prompt([
        {
            type: 'input',
            name: 'limit',
            message: 'Limit (default 100):',
            default: '100'
        }
    ]);

    const { forceRefresh } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'forceRefresh',
            message: 'Cache bypass?',
            default: false
        }
    ]);

    const { appendMode } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'appendMode',
            message: 'Append mód (új sorok hozzáfűzése)?',
            default: true
        }
    ]);

    const { clearFirst } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'clearFirst',
            message: 'Sheet ürítése írás előtt?',
            default: false
        }
    ]);

    const { skipDuplicates } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'skipDuplicates',
            message: 'Duplikátumok kihagyása?',
            default: true
        }
    ]);

    const { batchSize } = await inquirer.prompt([
        {
            type: 'input',
            name: 'batchSize',
            message: 'Batch méret (default 75):',
            default: '75'
        }
    ]);

    const { dryRun } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'dryRun',
            message: 'Dry-run (csak lekérés, nem ír)?',
            default: false
        }
    ]);

    const { confirmRun } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'confirmRun',
            message: 'Indítsuk a szinkront?',
            default: true
        }
    ]);

    if (!confirmRun) return;

    console.log(chalk.cyan('\nSzámlák lekérése & írás folyamatban...'));

    const result = await runInvoiceSync(client, {
        sinceDate,
        limit: Number(limit) || 100,
        forceRefresh: Boolean(forceRefresh),
        includeUnpaidOnly: mode === 'unpaid',
        getOverdue: mode === 'overdue',
        append: Boolean(appendMode),
        clearFirst: Boolean(clearFirst),
        skipDuplicates: Boolean(skipDuplicates),
        batchSize: Number(batchSize) || 75,
        dryRun: Boolean(dryRun)
    });

    if (!result.success) {
        console.log(chalk.red(`\nHiba: ${result.message || 'Ismeretlen hiba'}`));
        await pause();
        return;
    }

    if (dryRun) {
        console.log(chalk.green(`\n✅ Dry-run kész: ${result.fetched} számla (forrás: ${result.source})`));
        await pause();
        return;
    }

    console.log(
        chalk.green(
            `\n✅ Szinkron kész: ${result.fetched} → ${result.written} sor (duplikátum: ${result.duplicatesSkipped})`
        )
    );
    await pause();
}

async function chatMenu() {
    const { mode } = await inquirer.prompt([{
        type: 'list',
        name: 'mode',
        message: '💬 Chat & Kommunikáció:',
        choices: [
            { name: '💬  Standard Chat (GitHub Models)', value: 'github' },
            { name: '☁️   Edge Chat (Cloudflare)', value: 'edge' },
            { name: '🤖  Jules AI Delegálás', value: 'jules' },
            { name: '🧠  Ollama Context Analysis', value: 'ollama' },
            new inquirer.Separator(),
            { name: '⬅️   Vissza', value: BACK }
        ]
    }]);

    if (mode === BACK) return;

    // "Nincs begépelés" - Előre definiált gyors-kérdések
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: 'Válassz műveletet:',
        choices: [
            { name: '🚀  Interaktív Chat indítása', value: 'interactive' },
            { name: '❓  "Mi a státusza a projektemnek?"', value: 'query_status' },
            { name: '🧹  "Milyen karbantartási feladatok vannak?"', value: 'query_tasks' },
            { name: '💡  "Adj ötletet a fejlesztéshez!"', value: 'query_ideas' },
            new inquirer.Separator(),
            { name: '⬅️   Vissza', value: BACK }
        ]
    }]);

    if (action === BACK) return;

    if (action === 'interactive') {
        console.log(chalk.yellow('\nIndítom az interaktív chatet... (Használd az "exit" szót a kilépéshez.)'));
        const { execSync } = await import('child_process');
        try {
            execSync(`npm run cli -- chat --provider ${mode}`, { stdio: 'inherit' });
        } catch { /* ignore */ }
    } else {
        let task = "";
        if (action === 'query_status') task = "Mi az aktuális projekt státusza és melyik track-en dolgozunk?";
        if (action === 'query_tasks') task = "Milyen elmaradt TODO vagy karbantartási feladatokat látsz a kódban?";
        if (action === 'query_ideas') task = "Adj 3 innovatív ötletet a Brunella továbbfejlesztéséhez!";

        console.log(chalk.cyan(`\nKérdezés: "${task}"...`));
        const result = await client.callTool("agent_execute", { agentName: "orchestrator", task });
        // @ts-expect-error - Tool result content access
        console.log('\n' + marked(result.content?.[0]?.text || 'Nincs válasz'));
        await pause();
    }
}

async function settingsMenu() {
    while (true) {
        const currentLang = configManager.get('general.language') || 'hu';
        const currentTheme = configManager.get('ui.theme') || 'dark';
        const telemetry = configManager.get('general.telemetry') ? 'BE' : 'KI';

        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: '⚙️ Beállítások:',
            choices: [
                { name: `🌐  Nyelv váltása (Jelenlegi: ${currentLang})`, value: 'lang' },
                { name: `🎨  Theme váltása (Jelenlegi: ${currentTheme})`, value: 'theme' },
                { name: `📊  Telemetria (Jelenlegi: ${telemetry})`, value: 'telemetry' },
                { name: '💾  Konfiguráció mentése', value: 'save' },
                { name: '👁️   Konfiguráció megtekintése', value: 'view' },
                new inquirer.Separator(),
                { name: '⬅️   Vissza', value: BACK }
            ]
        }]);

        if (action === BACK) break;

        if (action === 'lang') {
            const next = currentLang === 'hu' ? 'en' : 'hu';
            configManager.set('general.language', next);
            console.log(chalk.green(`Nyelv átállítva: ${next}`));
        } else if (action === 'theme') {
            const next = currentTheme === 'dark' ? 'light' : 'dark';
            configManager.set('ui.theme', next);
            console.log(chalk.green(`Theme átállítva: ${next}`));
        } else if (action === 'telemetry') {
            const current = configManager.get('general.telemetry');
            configManager.set('general.telemetry', !current);
            console.log(chalk.green(`Telemetria átállítva: ${!current ? 'BE' : 'KI'}`));
        } else if (action === 'save') {
             // ConfigManager normally saves automatically, but we can force or just notify
            console.log(chalk.green('Beállítások elmentve!'));
        } else if (action === 'view') {
            console.log(chalk.blue('\nAktuális konfiguráció:'));
            console.log(JSON.stringify(configManager.getAll(), null, 2));
            await pause();
        }
    }
}

async function systemMenu() {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: '🔧 Rendszer & Karbantartás:',
        choices: [
            { name: '🩺  Brunella Health Check (Mélyszkennelés)', value: 'health' },
            { name: '🧰  MCP Eszközök listázása', value: 'tools' },
            { name: '🐍  Python Interpreter indítása', value: 'python' },
            { name: '🛠️   Rendszer logok megtekintése', value: 'logs' },
            new inquirer.Separator(),
            { name: '⬅️   Vissza', value: BACK }
        ]
    }]);

    if (action === BACK) return;

    if (action === 'health') {
        console.log(chalk.bold("\n🏥 Rendszer Diagnosztika futtatása..."));
        const { execSync } = await import('child_process');
        try {
            execSync(`npm run health`, { stdio: 'inherit' });
        } catch { 
            console.log(chalk.red("\nA diagnosztika hibát jelzett."));
        }
        await pause();
    } else if (action === 'tools') {
        const result = await client.listTools();
        console.log(chalk.bold(`\n🛠️ Elérhető MCP eszközök (${result.tools.length}):`));
        for (const tool of result.tools) {
            console.log(chalk.green("• " + tool.name.padEnd(20)) + (tool.description ? " | " + chalk.dim(tool.description.slice(0, 60) + (tool.description.length > 60 ? '...' : '')) : ""));
        }
        await pause();
    } else if (action === 'python') {
        console.log(chalk.yellow('\nBelépés a Python környezetbe...'));
        const { execSync } = await import('child_process');
        try {
            execSync(`npm run cli -- interpreter`, { stdio: 'inherit' });
        } catch { /* ignore */ }
    } else if (action === 'logs') {
        const logFile = join(process.cwd(), 'logs', 'brunella.log');
        if (existsSync(logFile)) {
            const logs = readFileSync(logFile, 'utf-8').split('\n').slice(-20).join('\n');
            console.log(chalk.dim(logs));
        } else {
            console.log(chalk.yellow('Log fájl nem található.'));
        }
        await pause();
    }
}

start();

