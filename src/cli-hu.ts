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
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { runInvoiceSync } from './cli/invoiceSync.js';
import { innovateCommand } from './cli/commands/innovate-hu.js';
import { hrOnboardingCommand } from './cli/commands/hr-onboarding-hu.js';
import { agentManager } from './agents/AgentManager.js';
import { getSkill, listSkills } from './skills/index.js';
import { studioFullPipeline, studioInit, studioProbe } from './cli/studioRuntime.js';
import { generateAudioPlan } from './tools/audioPlanTool.js';
import { ingestMediaDirectory } from './tools/mediaAnalysisTool.js';
import { runQcChecks } from './tools/qcTool.js';
import { renderTimelinePlan } from './tools/renderPresetTool.js';
import { generateTimelinePlan } from './tools/timelinePlanTool.js';
import { writeLine } from './utils/cliOutput.js';

marked.setOptions({ renderer: new TerminalRenderer() });

/**
 * BRUNELLA MAGYAR CLI (MAG-1.0)
 * 
 * Szigorúan menüvezérelt, magyar nyelvű interfész.
 * Filozófia: "Nincs begépelés, csak választás."
 */

const client = new BrunellaClient();
const BACK = '__back__';
const argv = process.argv.slice(2);

export function parseSkillParams(rawParams?: string): Record<string, unknown> {
    if (!rawParams) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawParams) as unknown;
        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
        throw new Error('A paramétereknek JSON objektumnak kell lenniük.');
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Hibás JSON paraméterek: ${message}`);
    }
}

export async function runSkillCommand(args: string[]): Promise<boolean> {
    const [subcommand, ...rest] = args;
    if (subcommand !== 'skill') {
        return false;
    }

    const [action, skillName, ...paramParts] = rest;
    if (action === 'lista') {
        const skills = listSkills();
        writeLine(chalk.bold('\nElérhető skill-ek:\n'));
        for (const skill of skills) {
            writeLine(
                chalk.green(`• ${skill.name}`) +
                chalk.dim(` | ${skill.category} | ${skill.version}`) +
                `\n  ${skill.description}`
            );
        }
        return true;
    }

    if (action === 'futtat') {
        if (!skillName) {
            throw new Error('Használat: brunella skill futtat <nev> [params]');
        }

        const skill = getSkill(skillName);
        if (!skill) {
            throw new Error(`Ismeretlen skill: ${skillName}`);
        }

        const params = parseSkillParams(paramParts.join(' '));
        writeLine(chalk.cyan(`Skill futtatása: ${skill.name}`));
        const result = await agentManager.executeSkill(skill.name, params);
        writeLine(JSON.stringify(result, null, 2));
        return true;
    }

    if (action) {
        throw new Error(`Ismeretlen skill parancs: ${action}`);
    }

    return false;
}

function parseFlagArgs(tokens: string[]): { positionals: string[]; flags: Record<string, string | boolean> } {
    const positionals: string[] = [];
    const flags: Record<string, string | boolean> = {};
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        if (token.startsWith('--')) {
            const key = token.slice(2);
            const next = tokens[index + 1];
            if (!next || next.startsWith('--')) {
                flags[key] = true;
            } else {
                flags[key] = next;
                index += 1;
            }
            continue;
        }
        positionals.push(token);
    }
    return { positionals, flags };
}

function csvFlags(value: string | boolean | undefined): string[] | undefined {
    if (typeof value !== 'string') return undefined;
    return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export async function runStudioCommand(args: string[]): Promise<boolean> {
    const [subcommand, action, ...rest] = args;
    if (subcommand !== 'studio') {
        return false;
    }

    const { positionals, flags } = parseFlagArgs(rest);
    if (action === 'probe') {
        writeLine(JSON.stringify(await studioProbe(), null, 2));
        return true;
    }
    if (action === 'init') {
        const projectName = positionals[0] || (typeof flags.project === 'string' ? flags.project : 'studio-project');
        writeLine(JSON.stringify(await studioInit(projectName), null, 2));
        return true;
    }
    if (action === 'ingest') {
        const inputDir = typeof flags['input-dir'] === 'string' ? flags['input-dir'] : undefined;
        if (!inputDir) throw new Error('Hasznalat: brunella-hu studio ingest --input-dir <path>');
        writeLine(JSON.stringify(await ingestMediaDirectory({ inputDir, projectName: typeof flags['project-name'] === 'string' ? flags['project-name'] : undefined, generateProxies: flags['generate-proxies'] === true }), null, 2));
        return true;
    }
    if (action === 'rough-cut') {
        writeLine(JSON.stringify(await generateTimelinePlan({ inputDir: typeof flags['input-dir'] === 'string' ? flags['input-dir'] : undefined, manifestPath: typeof flags['manifest-path'] === 'string' ? flags['manifest-path'] : undefined, projectName: typeof flags['project-name'] === 'string' ? flags['project-name'] : undefined, style: typeof flags.style === 'string' ? flags.style as never : undefined, targetDurationSec: typeof flags['target-duration'] === 'string' ? Number(flags['target-duration']) : undefined, musicTrackPath: typeof flags['music-track'] === 'string' ? flags['music-track'] : undefined }), null, 2));
        return true;
    }
    if (action === 'audio-plan') {
        const timelinePlanPath = typeof flags['timeline-plan'] === 'string' ? flags['timeline-plan'] : undefined;
        const musicTrackPath = typeof flags['music-track'] === 'string' ? flags['music-track'] : undefined;
        if (!timelinePlanPath || !musicTrackPath) throw new Error('Hasznalat: brunella-hu studio audio-plan --timeline-plan <file> --music-track <file>');
        writeLine(JSON.stringify(await generateAudioPlan({ timelinePlanPath, musicTrackPath, projectName: typeof flags['project-name'] === 'string' ? flags['project-name'] : undefined, style: typeof flags.style === 'string' ? flags.style as never : undefined }), null, 2));
        return true;
    }
    if (action === 'render') {
        const projectName = typeof flags['project-name'] === 'string' ? flags['project-name'] : undefined;
        const timelinePlanPath = typeof flags['timeline-plan'] === 'string' ? flags['timeline-plan'] : undefined;
        if (!projectName || !timelinePlanPath) throw new Error('Hasznalat: brunella-hu studio render --project-name <nev> --timeline-plan <file>');
        writeLine(JSON.stringify(await renderTimelinePlan({ projectName, timelinePlanPath, musicTrackPath: typeof flags['music-track'] === 'string' ? flags['music-track'] : undefined, presets: csvFlags(flags.presets) as never }), null, 2));
        return true;
    }
    if (action === 'qc') {
        const filePath = typeof flags.file === 'string' ? flags.file : undefined;
        if (!filePath) throw new Error('Hasznalat: brunella-hu studio qc --file <render>');
        writeLine(JSON.stringify(await runQcChecks({ filePath, expectedDurationSec: typeof flags['expected-duration'] === 'string' ? Number(flags['expected-duration']) : undefined, expectedWidth: typeof flags['expected-width'] === 'string' ? Number(flags['expected-width']) : undefined, expectedHeight: typeof flags['expected-height'] === 'string' ? Number(flags['expected-height']) : undefined }), null, 2));
        return true;
    }
    if (action === 'full' || action === 'full-pipeline') {
        const inputDir = typeof flags['input-dir'] === 'string' ? flags['input-dir'] : undefined;
        if (!inputDir) throw new Error('Hasznalat: brunella-hu studio full --input-dir <path>');
        writeLine(JSON.stringify(await studioFullPipeline({ inputDir, projectName: typeof flags['project-name'] === 'string' ? flags['project-name'] : undefined, style: typeof flags.style === 'string' ? flags.style as never : undefined, targetDurationSec: typeof flags['target-duration'] === 'string' ? Number(flags['target-duration']) : undefined, musicTrackPath: typeof flags['music-track'] === 'string' ? flags['music-track'] : undefined, presets: csvFlags(flags.presets) as never, generateProxies: flags['generate-proxies'] === true }), null, 2));
        return true;
    }
    throw new Error(`Ismeretlen studio parancs: ${action || ''}`);
}

export async function pause() {
    await inquirer.prompt([{
        type: 'input',
        name: '_',
        message: chalk.dim('Nyomj Enter-t a folytatáshoz...')
    }]);
}

export async function getTrackNames(): Promise<string[]> {
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
        if (argv.length > 0) {
            const skillHandled = await runSkillCommand(argv);
            if (skillHandled) {
                return;
            }
            const studioHandled = await runStudioCommand(argv);
            if (studioHandled) {
                return;
            }
        }

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
        writeLine(chalk.cyan(figlet.textSync('BRUNELLA', { font: 'Standard' })));
        writeLine(chalk.blue(boxen(`Magyar CLI v${version} | AI Vezérlőközpont`, { padding: 1, borderStyle: 'double' })));
        writeLine(chalk.dim(`Munkakönyvtár: ${process.cwd()}\n`));

        const { choice } = await inquirer.prompt([{
            type: 'list',
            name: 'choice',
            message: chalk.bold('Válassz egy kategóriát:'),
            choices: [
                { name: '🤖  Ügynökök (Kezelés & Futtatás)', value: 'agents' },
                { name: '📋  Track-ek (Projekt Ütemterv)', value: 'tracks' },
                { name: '🌉  Innováció (Innovation Bridge)', value: 'innovation' },
                { name: '🧑‍💼  HR Onboarding', value: 'hr-onboarding' },
                { name: '📄  Számlák (Szinkron)', value: 'invoices' },
                { name: '�  Chat & Kommunikáció', value: 'chat' },
                { name: '🔧  Rendszer & Diagnosztika', value: 'system' },
                { name: '⚙️   Beállítások', value: 'settings' },
                new inquirer.Separator(),
                { name: '🚪  Kilépés', value: 'exit' }
            ]
        }]);

        if (choice === 'exit') {
            writeLine(chalk.yellow('\nViszlát! 👋\n'));
            process.exit(0);
        }

        try {
            if (choice === 'agents') await agentsMenu();
            else if (choice === 'tracks') await tracksMenu();
            else if (choice === 'innovation') await innovateCommand();
            else if (choice === 'hr-onboarding') await hrOnboardingCommand();
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
        writeLine('\n' + (result.content?.[0]?.text || 'Nincs válasz'));
        await pause();
    } else if (action === 'execute') {
        const listResult = await client.callTool("agent_list", {});
        // @ts-expect-error - Tool result content access
        const text = listResult.content?.[0]?.text || "";
        const agentNames = text.match(/• \*\*([^*]+)\*\*/g)?.map((m: string) => m.replace(/• \*\*|\*\*/g, '')) || [];
        
        if (agentNames.length === 0) {
            writeLine(chalk.yellow('Nem található aktív ügynök.'));
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

        writeLine(chalk.cyan(`\nFuttatás: ${agent}...`));
        const result = await client.callTool("agent_execute", { agentName: agent, task });
        // @ts-expect-error - Tool result content access
        writeLine('\n' + (result.content?.[0]?.text || 'Nincs válasz'));
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
        writeLine('\n' + marked(result.content?.[0]?.text || 'Nincs válasz'));
        await pause();
    } else if (action === 'view' || action === 'update') {
        if (trackNames.length === 0) {
            writeLine(chalk.yellow('Nincs elérhető track.'));
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
            writeLine(chalk.cyan(`\nMegtekintés: ${target}...`));
            const result = await client.callTool("agent_delegate", { 
                agent_name: "ProjectConductor", 
                task: `track view ${target}` 
            });
            // @ts-expect-error - Tool result content access
            writeLine('\n' + marked(result.content?.[0]?.text || 'Nincs válasz'));
        } else {
            writeLine(chalk.cyan(`\nUpdate folyamat indítása: ${target}...`));
            const result = await client.callTool("agent_delegate", { 
                agent_name: "ProjectConductor", 
                task: `track update ${target}` 
            });
            // @ts-expect-error - Tool result content access
            writeLine('\n' + marked(result.content?.[0]?.text || 'Kész'));
        }
        await pause();
    } else if (action === 'generate') {
         const { idea } = await inquirer.prompt([{
            type: 'input',
            name: 'idea',
            message: 'Mire vonatkozzon az új Track? (Ötlet):'
        }]);
        if (!idea) return;
        writeLine(chalk.cyan('\nTrack generálása...'));
        const result = await client.callTool("agent_delegate", { agent_name: "ProjectConductor", task: `track generate ${idea}` });
        // @ts-expect-error - Tool result content access
        writeLine('\n' + (result.content?.[0]?.text || 'Kész'));
        await pause();
    } else if (action === 'sync') {
        writeLine(chalk.cyan('\nDokumentáció szinkronizálása...'));
        const result = await client.callTool("agent_delegate", { agent_name: "ProjectConductor", task: "sync" });
        // @ts-expect-error - Tool result content access
        writeLine('\n' + (result.content?.[0]?.text || 'Kész'));
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

    writeLine(chalk.cyan('\nSzámlák lekérése & írás folyamatban...'));

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
        writeLine(chalk.red(`\nHiba: ${result.message || 'Ismeretlen hiba'}`));
        await pause();
        return;
    }

    if (dryRun) {
        writeLine(chalk.green(`\n✅ Dry-run kész: ${result.fetched} számla (forrás: ${result.source})`));
        await pause();
        return;
    }

    writeLine(
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
        writeLine(chalk.yellow('\nIndítom az interaktív chatet... (Használd az "exit" szót a kilépéshez.)'));
        const { execSync } = await import('child_process');
        try {
            execSync(`npm run cli -- chat --provider ${mode}`, { stdio: 'inherit' });
        } catch { /* ignore */ }
    } else {
        let task = "";
        if (action === 'query_status') task = "Mi az aktuális projekt státusza és melyik track-en dolgozunk?";
        if (action === 'query_tasks') task = "Milyen elmaradt TODO vagy karbantartási feladatokat látsz a kódban?";
        if (action === 'query_ideas') task = "Adj 3 innovatív ötletet a Brunella továbbfejlesztéséhez!";

        writeLine(chalk.cyan(`\nKérdezés: "${task}"...`));
        const result = await client.callTool("agent_execute", { agentName: "orchestrator", task });
        // @ts-expect-error - Tool result content access
        writeLine('\n' + marked(result.content?.[0]?.text || 'Nincs válasz'));
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
            writeLine(chalk.green(`Nyelv átállítva: ${next}`));
        } else if (action === 'theme') {
            const next = currentTheme === 'dark' ? 'light' : 'dark';
            configManager.set('ui.theme', next);
            writeLine(chalk.green(`Theme átállítva: ${next}`));
        } else if (action === 'telemetry') {
            const current = configManager.get('general.telemetry');
            configManager.set('general.telemetry', !current);
            writeLine(chalk.green(`Telemetria átállítva: ${!current ? 'BE' : 'KI'}`));
        } else if (action === 'save') {
             // ConfigManager normally saves automatically, but we can force or just notify
            writeLine(chalk.green('Beállítások elmentve!'));
        } else if (action === 'view') {
            writeLine(chalk.blue('\nAktuális konfiguráció:'));
            writeLine(JSON.stringify(configManager.getAll(), null, 2));
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
            { name: '🏗️   System Architecture Status (4 réteg)', value: 'arch' },
            { name: '🧰  MCP Eszközök listázása', value: 'tools' },
            { name: '🐍  Python Interpreter indítása', value: 'python' },
            { name: '🛠️   Rendszer logok megtekintése', value: 'logs' },
            new inquirer.Separator(),
            { name: '⬅️   Vissza', value: BACK }
        ]
    }]);

    if (action === BACK) return;

    if (action === 'arch') {
        writeLine(chalk.bold('\n🏗️  System Architecture Status lekérdezése...\n'));
        try {
            const port = process.env.PORT ?? '3000';
            const resp = await fetch(`http://localhost:${port}/api/v1/system/architecture-status`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const d = await resp.json() as Record<string, Record<string, unknown>>;
            const layers = ['ingestion', 'knowledge', 'orchestration', 'security'] as const;
            for (const layer of layers) {
                const info = d[layer] as Record<string, unknown>;
                const status = String(info?.status ?? '?');
                const isOk = status === 'healthy' || status === 'hardened';
                writeLine(
                    chalk.bold((isOk ? chalk.green('[OK] ') : chalk.red('[!!] ')) + layer.toUpperCase()) +
                    ' — ' + (isOk ? chalk.green(status) : chalk.red(status))
                );
                for (const [k, v] of Object.entries(info)) {
                    if (k !== 'status') {
                        writeLine(`     ${chalk.dim(k)}: ${chalk.cyan(String(v))}`);
                    }
                }
            }
        } catch (e: unknown) {
            writeLine(chalk.red(`Hiba: ${e instanceof Error ? e.message : String(e)}`));
            writeLine(chalk.dim('(Ellenőrizd, hogy fut-e a szerver: npm run dev)'));
        }
        await pause();
    } else if (action === 'health') {
        writeLine(chalk.bold("\n🏥 Rendszer Diagnosztika futtatása..."));
        const { execSync } = await import('child_process');
        try {
            execSync(`npm run health`, { stdio: 'inherit' });
        } catch { 
            writeLine(chalk.red("\nA diagnosztika hibát jelzett."));
        }
        await pause();
    } else if (action === 'tools') {
        const result = await client.listTools();
        writeLine(chalk.bold(`\n🛠️ Elérhető MCP eszközök (${result.tools.length}):`));
        for (const tool of result.tools) {
            writeLine(chalk.green("• " + tool.name.padEnd(20)) + (tool.description ? " | " + chalk.dim(tool.description.slice(0, 60) + (tool.description.length > 60 ? '...' : '')) : ""));
        }
        await pause();
    } else if (action === 'python') {
        writeLine(chalk.yellow('\nBelépés a Python környezetbe...'));
        const { execSync } = await import('child_process');
        try {
            execSync(`npm run cli -- interpreter`, { stdio: 'inherit' });
        } catch { /* ignore */ }
    } else if (action === 'logs') {
        const logFile = join(process.cwd(), 'logs', 'brunella.log');
        if (existsSync(logFile)) {
            const logs = readFileSync(logFile, 'utf-8').split('\n').slice(-20).join('\n');
            writeLine(chalk.dim(logs));
        } else {
            writeLine(chalk.yellow('Log fájl nem található.'));
        }
        await pause();
    }
}

const isDirectExecution = (() => {
    try {
        return process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
    } catch {
        return false;
    }
})();

if (isDirectExecution) {
    void start();
}

