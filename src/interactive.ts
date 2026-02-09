/**
 * Brunella Interactive CLI Menu
 *
 * Gemini CLI stílusú, nyíl-billentyűkkel navigálható menürendszer.
 * Elindul ha a `brunella` parancsot argumentumok nélkül futtatod.
 *
 * Főmenü → Almenü → Művelet (vagy szabad szöveges input)
 */

import inquirer from 'inquirer';
import { execSync } from 'child_process';
import chalk from 'chalk';
import boxen from 'boxen';
import { configManager } from './utils/cliConfig.js';

// ==================== Helpers ====================

const BACK = '__back__';

/** Run a CLI sub-command in the same process, inheriting stdio. */
function runCli(args: string): void {
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    try {
        execSync(`${npmCmd} run cli -- ${args}`, { stdio: 'inherit', cwd: process.cwd() });
    } catch {
        // Command may exit non-zero; that's OK for interactive mode
    }
}

/** Pause until the user presses Enter. */
async function pause(): Promise<void> {
    await inquirer.prompt([{
        type: 'input',
        name: '_',
        message: chalk.dim('Nyomj Enter-t a folytatáshoz...')
    }]);
}

/** Prompt for free text input and return it (empty string if skipped). */
async function askInput(message: string): Promise<string> {
    const { value } = await inquirer.prompt([{ type: 'input', name: 'value', message }]);
    return (value || '').trim();
}

/** Show a sub-menu, return the selected value or BACK. */
async function subMenu(title: string, choices: Array<{ name: string; value: string }>): Promise<string> {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: title,
        choices: [
            ...choices,
            new inquirer.Separator(),
            { name: '⬅️  Vissza', value: BACK }
        ]
    }]);
    return action;
}

// ==================== Sub-Menus ====================

async function agentsMenu(): Promise<void> {
    const action = await subMenu('🤖 Ügynökök', [
        { name: '📋  Ügynökök listázása', value: 'list' },
        { name: '▶️  Ügynök futtatása', value: 'execute' },
    ]);
    if (action === BACK) return;

    if (action === 'list') {
        runCli('agents');
        await pause();
    } else if (action === 'execute') {
        const name = await askInput('Ügynök neve:');
        if (!name) return;
        const task = await askInput('Feladat:');
        if (!task) return;
        runCli(`agent "${name}" "${task}"`);
        await pause();
    }
}

async function devToolsMenu(): Promise<void> {
    const action = await subMenu('🛠️  Fejlesztői Eszközök', [
        { name: '🏗️  Kód Generálás (Scaffold)', value: 'scaffold' },
        { name: '🧪  Teszt Generálás', value: 'test' },
        { name: '🔍  Kód Review', value: 'review' },
        { name: '🔧  Hiba Javítás (Fix)', value: 'fix' },
        { name: '💊  Self-Heal', value: 'heal' },
        { name: '📊  Metrics & Analytics', value: 'metrics' },
        { name: '📊  Coverage Elemzés', value: 'coverage' },
        { name: '📝  Task Queue Kezelés', value: 'queue' },
    ]);
    if (action === BACK) return;

    if (action === 'scaffold') {
        await scaffoldMenu();
    } else if (action === 'test') {
        const file = await askInput('Fájl elérési útja:');
        if (!file) return;
        runCli(`dev test "${file}"`);
        await pause();
    } else if (action === 'review') {
        const file = await askInput('Fájl elérési útja:');
        if (!file) return;
        runCli(`dev review "${file}"`);
        await pause();
    } else if (action === 'fix') {
        runCli('dev fix --auto');
        await pause();
    } else if (action === 'heal') {
        runCli('dev heal');
        await pause();
    } else if (action === 'metrics') {
        runCli('dev metrics');
        await pause();
    } else if (action === 'coverage') {
        runCli('dev coverage --run');
        await pause();
    } else if (action === 'queue') {
        await queueMenu();
    }
}

async function scaffoldMenu(): Promise<void> {
    const action = await subMenu('🏗️  Kód Generálás (Scaffold)', [
        { name: '📋  Elérhető sablonok listázása', value: 'list' },
        { name: '✨  Kód generálás sablonból', value: 'generate' },
    ]);
    if (action === BACK) return;

    if (action === 'list') {
        runCli('dev scaffold list');
        await pause();
    } else if (action === 'generate') {
        const { template } = await inquirer.prompt([{
            type: 'list',
            name: 'template',
            message: 'Válassz sablont:',
            choices: [
                { name: '⚛️  React Component', value: 'react-component' },
                { name: '🌐  REST API Route', value: 'rest-api' },
                { name: '🤖  AI Agent', value: 'agent' },
                { name: '🧪  Test File', value: 'test-file' },
            ]
        }]);

        // Collect variables based on template
        const vars: string[] = [];
        if (template === 'react-component') {
            const name = await askInput('Komponens neve (PascalCase, pl. MyButton):');
            if (!name) return;
            vars.push(`ComponentName=${name}`);
            const desc = await askInput('Leírás (opcionális):');
            if (desc) vars.push(`description=${desc}`);
        } else if (template === 'rest-api') {
            const route = await askInput('Route neve (kebab-case, pl. users):');
            if (!route) return;
            vars.push(`routeName=${route}`);
            const resource = await askInput('Resource neve (PascalCase, pl. User):');
            if (!resource) return;
            vars.push(`ResourceName=${resource}`);
        } else if (template === 'agent') {
            const name = await askInput('Agent neve (PascalCase, pl. DataCleaner):');
            if (!name) return;
            vars.push(`AgentName=${name}`);
            const role = await askInput('Agent szerepe (opcionális):');
            if (role) vars.push(`agentRole=${role}`);
        } else if (template === 'test-file') {
            const fileName = await askInput('Fájl neve (kebab-case, pl. my-module):');
            if (!fileName) return;
            vars.push(`fileName=${fileName}`);
            const suite = await askInput('Test suite neve (pl. MyModule):');
            if (!suite) return;
            vars.push(`TestSuite=${suite}`);
        }

        const varFlags = vars.map(v => `-v ${v}`).join(' ');
        runCli(`dev scaffold generate ${template} ${varFlags}`);
        await pause();
    }
}

async function queueMenu(): Promise<void> {
    const action = await subMenu('📝 Task Queue', [
        { name: '📋  Task-ok listázása', value: 'list' },
        { name: '➕  Új task hozzáadása', value: 'add' },
        { name: '❌  Task törlése', value: 'cancel' },
        { name: '🔄  Task újrapróbálása', value: 'retry' },
    ]);
    if (action === BACK) return;

    if (action === 'list') {
        runCli('dev queue list');
        await pause();
    } else if (action === 'add') {
        const { taskType } = await inquirer.prompt([{
            type: 'list',
            name: 'taskType',
            message: 'Task típusa:',
            choices: ['generate', 'test', 'fix', 'review', 'refactor', 'coverage', 'scaffold', 'generic']
        }]);
        const desc = await askInput('Task leírása:');
        if (!desc) return;
        runCli(`dev queue add ${taskType} "${desc}"`);
        await pause();
    } else if (action === 'cancel') {
        const id = await askInput('Task ID:');
        if (!id) return;
        runCli(`dev queue cancel ${id}`);
        await pause();
    } else if (action === 'retry') {
        const id = await askInput('Task ID:');
        if (!id) return;
        runCli(`dev queue retry ${id}`);
        await pause();
    }
}

async function gitMenu(): Promise<void> {
    const action = await subMenu('🐙 Git Műveletek', [
        { name: '📊  Státusz', value: 'status' },
        { name: '📝  Diff megtekintése', value: 'diff' },
        { name: '💾  Commit', value: 'commit' },
        { name: '🚀  Push', value: 'push' },
        { name: '🌿  Branch-ek listázása', value: 'branches' },
        { name: '🔀  Branch váltás', value: 'checkout' },
        { name: '📜  Commit napló', value: 'log' },
    ]);
    if (action === BACK) return;

    if (action === 'status') {
        runCli('dev git status');
        await pause();
    } else if (action === 'diff') {
        const file = await askInput('Fájl elérési útja (üres = összes):');
        runCli(file ? `dev git diff "${file}"` : 'dev git diff');
        await pause();
    } else if (action === 'commit') {
        const msg = await askInput('Commit üzenet:');
        if (!msg) return;
        runCli(`dev git commit "${msg}"`);
        await pause();
    } else if (action === 'push') {
        runCli('dev git push');
        await pause();
    } else if (action === 'branches') {
        runCli('dev git branches');
        await pause();
    } else if (action === 'checkout') {
        const branch = await askInput('Branch neve:');
        if (!branch) return;
        runCli(`dev git checkout "${branch}"`);
        await pause();
    } else if (action === 'log') {
        runCli('dev git log');
        await pause();
    }
}

async function systemMenu(): Promise<void> {
    const action = await subMenu('📁 Rendszer', [
        { name: '🩺  Diagnosztika (Doctor)', value: 'doctor' },
        { name: '📊  Projekt Státusz (Conductor)', value: 'conductor_status' },
        { name: '🔄  Dokumentáció Szinkron', value: 'conductor_sync' },
        { name: '🏥  Health Check', value: 'conductor_health' },
        { name: '🧰  MCP Eszközök listázása', value: 'tools' },
        { name: '🐍  Python Interpreter', value: 'interpreter' },
        { name: 'ℹ️   Névjegy (About)', value: 'about' },
    ]);
    if (action === BACK) return;

    if (action === 'doctor') { runCli('doctor'); await pause(); }
    else if (action === 'conductor_status') { runCli('conductor status'); await pause(); }
    else if (action === 'conductor_sync') { runCli('conductor sync'); await pause(); }
    else if (action === 'conductor_health') { runCli('conductor health'); await pause(); }
    else if (action === 'tools') { runCli('tools'); await pause(); }
    else if (action === 'interpreter') { runCli('interpreter'); }
    else if (action === 'about') { runCli('about'); await pause(); }
}

async function chatMenu(): Promise<void> {
    const action = await subMenu('💬 Kommunikáció', [
        { name: '💬  Chat indítása (GitHub / Gemini / Ollama)', value: 'chat' },
        { name: '☁️  Cloudflare Edge Chat', value: 'edge' },
        { name: '🤖  Jules AI menü', value: 'jules' },
    ]);
    if (action === BACK) return;

    if (action === 'chat') { runCli('chat'); }
    else if (action === 'edge') {
        console.log(chalk.cyan('\n  Tipp: A chatben írd be az /edge parancsot a váltáshoz!\n'));
        runCli('chat');
    }
    else if (action === 'jules') {
        await julesMenu();
    }
}

async function julesMenu(): Promise<void> {
    const action = await subMenu('🤖 Jules AI', [
        { name: '🆕  Új Jules feladat', value: 'new' },
        { name: '🔄  Branch szinkronizálás', value: 'sync' },
        { name: '📊  Státusz', value: 'status' },
    ]);
    if (action === BACK) return;

    if (action === 'new') {
        const task = await askInput('Jules feladat leírása:');
        if (!task) return;
        runCli(`jules new "${task}"`);
        await pause();
    } else if (action === 'sync') {
        runCli('jules sync');
        await pause();
    } else if (action === 'status') {
        runCli('jules status');
        await pause();
    }
}

async function settingsMenu(): Promise<void> {
    const key = configManager.get('apiKey') ? '********' : chalk.dim('(nincs megadva)');

    const action = await subMenu('⚙️  Beállítások', [
        { name: `🔐  Auth (API kulcs: ${key})`, value: 'auth' },
        { name: '🎨  Gold Protocol Beállítások', value: 'gold' },
    ]);
    if (action === BACK) return;

    if (action === 'auth') { runCli('auth login'); await pause(); }
    else if (action === 'gold') { runCli('gold status'); await pause(); }
}

// ==================== Main Loop ====================

export async function startInteractiveMenu(): Promise<void> {
    // Pkg version
    let version = '?.?.?';
    try {
        const { readFileSync, existsSync } = await import('fs');
        const { join } = await import('path');
        let pkgPath = join(process.cwd(), 'package.json');
        if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
            version = pkg.version;
        }
    } catch { /* ignore */ }

    while (true) {
        console.clear();
        console.log(boxen(
            chalk.bold.blue(' 🐻 Brunella CLI ') + chalk.dim(` v${version}`),
            { padding: 1, borderStyle: 'double', borderColor: 'cyan' }
        ));
        console.log(chalk.dim(`  Workspace: ${process.cwd()}\n`));

        const { mainMenu } = await inquirer.prompt([{
            type: 'list',
            name: 'mainMenu',
            message: chalk.bold('Főmenü — Válassz kategóriát:'),
            choices: [
                { name: '💬  Kommunikáció (Chat & AI)', value: 'chat' },
                { name: '🤖  Ügynökök (Agents)', value: 'agents' },
                { name: '🛠️   Fejlesztői Eszközök (Dev Tools)', value: 'dev' },
                { name: '🐙  Git Műveletek', value: 'git' },
                { name: '📁  Rendszer & Projekt', value: 'system' },
                { name: '⚙️   Beállítások', value: 'settings' },
                new inquirer.Separator(),
                { name: '❌  Kilépés', value: 'exit' }
            ]
        }]);

        if (mainMenu === 'exit') {
            console.log(chalk.dim('\nViszlát! 👋\n'));
            process.exit(0);
        }

        try {
            if (mainMenu === 'chat') await chatMenu();
            else if (mainMenu === 'agents') await agentsMenu();
            else if (mainMenu === 'dev') await devToolsMenu();
            else if (mainMenu === 'git') await gitMenu();
            else if (mainMenu === 'system') await systemMenu();
            else if (mainMenu === 'settings') await settingsMenu();
        } catch (e: unknown) {
            // Handle Ctrl+C gracefully
            if (e instanceof Error && e.message.includes('User force closed')) {
                continue;
            }
            console.error(chalk.red('Hiba:'), e instanceof Error ? e.message : String(e));
            await pause();
        }
    }
}