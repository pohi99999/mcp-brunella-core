#!/usr/bin/env node
// FILE: src/cli-jules-interactive.ts
// PURPOSE: Interaktív Jules menü - slash commands + választható opciók

import inquirer from 'inquirer';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

interface JulesSession {
    session_id: string;
    prompt: string;
    branch?: string;
    created_at: string;
    status: 'running' | 'completed' | 'failed';
}

interface JulesBranch {
    name: string;
    commits: number;
}

// ====== HELPERS ======

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
    const icons = {
        info: '📋',
        success: '✅',
        error: '❌',
        warn: '⚠️'
    };
    console.log(`${icons[type]} ${message}`);
}

function runCommand(cmd: string): string {
    try {
        return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8' });
    } catch (e: any) {
        return '';
    }
}

function loadJulesSessions(): JulesSession[] {
    const sessionsFile = path.join(REPO_ROOT, '.jules', 'sessions.json');
    if (!fs.existsSync(sessionsFile)) {
        return [];
    }
    return JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
}

function getJulesBranches(): JulesBranch[] {
    const output = runCommand('git branch -r');
    const branches: JulesBranch[] = [];

    for (const line of output.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.includes('jules-') || trimmed.includes('robotkez-')) {
            const branchName = trimmed.replace('origin/', '');

            // Get commit count ahead of main
            const commitsAhead = runCommand(`git rev-list --count main..origin/${branchName}`).trim();
            const commits = parseInt(commitsAhead) || 0;

            branches.push({ name: branchName, commits });
        }
    }

    return branches;
}

// ====== JULES COMMANDS ======

async function julesNew() {
    console.clear();
    log('🤖 Új Jules Task', 'info');
    console.log('');

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'taskType',
            message: 'Mit szeretnél Jules-nak delegálni?',
            choices: [
                { name: '🐛 Bug fixing', value: 'bug' },
                { name: '✨ Feature implementation', value: 'feature' },
                { name: '🧪 Write tests', value: 'tests' },
                { name: '📦 Dependency update', value: 'deps' },
                { name: '📝 Custom prompt', value: 'custom' }
            ]
        }
    ]);

    let prompt: string;

    if (answers.taskType === 'custom') {
        const customAnswer = await inquirer.prompt([
            {
                type: 'input',
                name: 'prompt',
                message: 'Add meg a task leírását:',
                validate: (input: string) => input.length > 0 || 'A prompt nem lehet üres!'
            }
        ]);
        prompt = customAnswer.prompt;
    } else {
        // Pre-defined prompts
        const templates: Record<string, string> = {
            bug: 'Fix all linting errors and type issues in the codebase',
            feature: 'Implement the feature described in the latest GitHub issue',
            tests: 'Write comprehensive tests for all scripts/robotkez_*.py files',
            deps: 'Update all npm and Python dependencies to latest stable versions'
        };
        prompt = templates[answers.taskType];

        const confirmAnswer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'useTemplate',
                message: `Használod ezt a promptot?\n   "${prompt}"`,
                default: true
            }
        ]);

        if (!confirmAnswer.useTemplate) {
            const customAnswer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'prompt',
                    message: 'Add meg a saját promptot:',
                    default: prompt
                }
            ]);
            prompt = customAnswer.prompt;
        }
    }

    // API vagy CLI?
    const methodAnswer = await inquirer.prompt([
        {
            type: 'list',
            name: 'method',
            message: 'Jules trigger metódus:',
            choices: [
                { name: '🔌 REST API (ajánlott)', value: 'api' },
                { name: '💻 CLI (natív jules command)', value: 'cli' }
            ],
            default: 'api'
        }
    ]);

    console.log('');
    log('🚀 Jules task indítása...', 'info');

    try {
        let sessionId = '';

        if (methodAnswer.method === 'api') {
            // Python API client
            const output = runCommand(`python scripts/jules_api_client.py create "${prompt}"`);
            console.log(output);

            // Parse session ID
            const match = output.match(/ID: (\d+)/);
            if (match) {
                sessionId = match[1];
            }
        } else {
            // Jules CLI
            const output = runCommand(`python scripts/jules_cli_wrapper.py new "${prompt}"`);
            console.log(output);

            // Parse session ID
            const match = output.match(/Session ID: (\S+)/);
            if (match) {
                sessionId = match[1];
            }
        }

        if (sessionId) {
            log(`Session létrehozva: ${sessionId}`, 'success');

            // Watch?
            const watchAnswer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'watch',
                    message: 'Watch mode indítása? (vár amíg kész)',
                    default: false
                }
            ]);

            if (watchAnswer.watch) {
                console.log('');
                log('⏳ Watch mode - várakozás a session befejezésére...', 'info');
                if (methodAnswer.method === 'api') {
                    runCommand(`python scripts/jules_api_client.py watch ${sessionId}`);
                } else {
                    runCommand(`python scripts/jules_cli_wrapper.py watch ${sessionId}`);
                }
            }
        }
    } catch (e: any) {
        log(`Hiba: ${e.message}`, 'error');
    }

    await mainMenu();
}

async function julesSync() {
    console.clear();
    log('🔄 Jules Sync - GitHub branch-ek pullolása', 'info');
    console.log('');

    log('Ellenőrzés...', 'info');
    const branches = getJulesBranches();

    if (branches.length === 0) {
        log('Nincs Jules branch a GitHub-on.', 'warn');
        await mainMenu();
        return;
    }

    console.log('');
    log(`${branches.length} Jules branch találva:`, 'success');
    branches.forEach((b, i) => {
        console.log(`  ${i + 1}. ${b.name} (${b.commits} új commit)`);
    });
    console.log('');

    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'Mit szeretnél csinálni?',
            choices: [
                { name: '📥 Pull all (összes branch)', value: 'pull_all' },
                { name: '🔍 Review specific branch', value: 'review' },
                { name: '🔀 Merge specific branch', value: 'merge' },
                { name: '🔙 Vissza', value: 'back' }
            ]
        }
    ]);

    if (answer.action === 'back') {
        await mainMenu();
        return;
    }

    if (answer.action === 'pull_all') {
        log('Pullolás...', 'info');
        runCommand('python scripts/jules_sync_watchdog.py --once');
        log('Kész!', 'success');
    } else if (answer.action === 'review' || answer.action === 'merge') {
        const branchAnswer = await inquirer.prompt([
            {
                type: 'list',
                name: 'branch',
                message: 'Melyik branch?',
                choices: branches.map(b => ({
                    name: `${b.name} (${b.commits} commits)`,
                    value: b.name
                }))
            }
        ]);

        const selectedBranch = branchAnswer.branch;

        if (answer.action === 'review') {
            console.log('');
            log(`Review: ${selectedBranch}`, 'info');
            console.log('');
            runCommand(`git log origin/${selectedBranch} -5 --oneline --stat`);
        } else {
            // Merge
            const confirmAnswer = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: `Biztos merge-elni szeretnéd: ${selectedBranch}?`,
                    default: false
                }
            ]);

            if (confirmAnswer.confirm) {
                log('Merge...', 'info');
                runCommand(`git fetch origin && git merge origin/${selectedBranch} --no-edit`);
                log('Merge kész!', 'success');
            }
        }
    }

    console.log('');
    await mainMenu();
}

async function julesStatus() {
    console.clear();
    log('📊 Jules Status', 'info');
    console.log('');

    // Sessions (helyi)
    const sessions = loadJulesSessions();
    if (sessions.length > 0) {
        log(`Helyi sessions (${sessions.length}):`, 'info');
        sessions.slice(-5).forEach((s, i) => {
            const statusIcon = s.status === 'completed' ? '✅' : s.status === 'running' ? '⏳' : '❌';
            console.log(`  ${statusIcon} ${s.session_id}`);
            console.log(`     ${s.prompt.slice(0, 60)}...`);
        });
        console.log('');
    }

    // GitHub branches
    const branches = getJulesBranches();
    if (branches.length > 0) {
        log(`GitHub Jules branches (${branches.length}):`, 'info');
        branches.forEach((b, i) => {
            console.log(`  ${i + 1}. ${b.name} (${b.commits} commits)`);
        });
        console.log('');
    }

    // API sessions (opcionális)
    const apiAnswer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'showApi',
            message: 'Lekérdezzem a Jules API sessions-t is?',
            default: false
        }
    ]);

    if (apiAnswer.showApi) {
        console.log('');
        log('API sessions lekérdezése...', 'info');
        runCommand('python scripts/jules_api_client.py list 10');
    }

    console.log('');
    await mainMenu();
}

async function julesHelp() {
    console.clear();
    log('📖 Jules Help', 'info');
    console.log('');
    console.log('Elérhető parancsok:');
    console.log('');
    console.log('  /jules new      - Új Jules task létrehozás');
    console.log('  /jules sync     - GitHub Jules branch-ek pullolása');
    console.log('  /jules status   - Jules sessions és branch-ek státusza');
    console.log('  /jules help     - Ez a súgó');
    console.log('  /exit           - Kilépés');
    console.log('');
    console.log('Interaktív használat:');
    console.log('  1. Indítsd: node build/cli-jules-interactive.js');
    console.log('  2. Válassz menüpontot nyilakkal');
    console.log('  3. Enter a kiválasztáshoz');
    console.log('');
    console.log('Dokumentáció: JULES_INTEGRATION.md');
    console.log('');

    await inquirer.prompt([
        {
            type: 'input',
            name: 'continue',
            message: 'Nyomj Enter-t a folytatáshoz...'
        }
    ]);

    await mainMenu();
}

// ====== MAIN MENU ======

async function mainMenu() {
    console.log('');
    const answer = await inquirer.prompt([
        {
            type: 'list',
            name: 'command',
            message: '🤖 Brunella + Jules',
            choices: [
                { name: '🆕 Új Jules task', value: 'new' },
                { name: '🔄 Sync (pull Jules branch-ek)', value: 'sync' },
                { name: '📊 Status (sessions + branches)', value: 'status' },
                { name: '❓ Help', value: 'help' },
                new inquirer.Separator(),
                { name: '🚪 Exit', value: 'exit' }
            ]
        }
    ]);

    switch (answer.command) {
        case 'new':
            await julesNew();
            break;
        case 'sync':
            await julesSync();
            break;
        case 'status':
            await julesStatus();
            break;
        case 'help':
            await julesHelp();
            break;
        case 'exit':
            log('👋 Viszlát!', 'info');
            process.exit(0);
            break;
    }
}

// ====== ENTRY POINT ======

async function main() {
    console.clear();
    console.log('╔════════════════════════════════════════╗');
    console.log('║   🤖 Brunella + Jules Integráció      ║');
    console.log('║   Interaktív CLI Menü                  ║');
    console.log('╚════════════════════════════════════════╝');
    console.log('');

    await mainMenu();
}

main().catch(console.error);
