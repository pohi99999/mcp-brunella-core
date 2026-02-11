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
import figlet from 'figlet';
import { configManager } from './utils/cliConfig.js';

// ==================== i18n Translation Layer ====================

type Lang = 'hu' | 'en';

const STRINGS: Record<Lang, Record<string, string>> = {
    hu: {
        // Main menu
        'menu.main.title': 'Főmenü — Válassz kategóriát:',
        'menu.main.agents': '🤖  Ügynökök',
        'menu.main.tracks': '📋  Track-ek (Fejlesztési Tervek)',
        'menu.main.chat': '💬  Chat & AI',
        'menu.main.tests': '🧪  Tesztek & Minőség',
        'menu.main.system': '🔧  Rendszer & Infrastruktúra',
        'menu.main.settings': '⚙️  Beállítások',
        'menu.main.exit': '🚪  Kilépés',

        // Agents menu
        'menu.agents.title': '🤖 Ügynökök',
        'menu.agents.list': '📋  Ügynökök listázása',
        'menu.agents.execute': '▶️  Ügynök futtatása',
        'menu.agents.dev_generate': '💻  Kód generálás (Developer)',
        'menu.agents.dev_test': '🧪  Teszt generálás (Developer)',
        'menu.agents.dev_fix': '🔧  Hiba javítás (Fix)',
        'menu.agents.dev_heal': '💊  Self-healing',
        'menu.agents.dev_review': '🔍  Kód review (Developer)',
        'menu.agents.dev_refactor': '♻️  Refactor',
        'menu.agents.dev_context': '📊  Context elemzés',
        'menu.agents.dev_metrics': '📈  Metrikák',

        // Tracks menu
        'menu.tracks.title': '📋 Track-ek (Fejlesztési Tervek)',
        'menu.tracks.generate': '✨  Új Track generálása ötletből',
        'menu.tracks.list': '📋  Track-ek listázása',
        'menu.tracks.view': '👁️  Track megtekintése',
        'menu.tracks.conductor_status': '📊  Conductor: Projekt státusz',
        'menu.tracks.conductor_sync': '🔄  Conductor: Dokumentáció szinkron',
        'menu.tracks.conductor_health': '🏥  Conductor: Health check',

        // Chat menu
        'menu.chat.title': '💬 Chat & AI',
        'menu.chat.start': '💬  Chat indítása (GitHub/Gemini/Ollama)',
        'menu.chat.edge': '☁️  Edge Chat (Cloudflare)',
        'menu.chat.jules': '🤖  Jules AI menü',
        'menu.chat.jules_new': '🆕  Új Jules feladat',
        'menu.chat.jules_sync': '🔄  Branch szinkronizálás',
        'menu.chat.jules_status': '📊  Státusz',

        // Tests & Quality menu
        'menu.tests.title': '🧪 Tesztek & Minőség',
        'menu.tests.build': '🏗️  Build futtatása',
        'menu.tests.run': '🧪  Tesztek futtatása (teljes suite)',
        'menu.tests.coverage': '📊  Teszt coverage elemzés',
        'menu.tests.review': '🔍  Kód review',
        'menu.tests.refactor': '♻️  Refactor',
        'menu.tests.git_status': '📊  Git státusz',
        'menu.tests.git_diff': '📝  Git diff',
        'menu.tests.git_commit': '💾  Git commit',
        'menu.tests.git_push': '🚀  Git push',
        'menu.tests.git_branches': '🌿  Git branches',
        'menu.tests.git_checkout': '🔀  Git checkout',
        'menu.tests.git_log': '📜  Git log',
        'menu.tests.queue_list': '📋  Task queue lista',
        'menu.tests.queue_add': '➕  Task queue hozzáadás',
        'menu.tests.queue_cancel': '❌  Task queue cancel',

        // System menu
        'menu.system.title': '🔧 Rendszer & Infrastruktúra',
        'menu.system.doctor': '🩺  Diagnosztika (Doctor)',
        'menu.system.health': '🏥  Health check',
        'menu.system.tools': '🧰  MCP eszközök listázása',
        'menu.system.interpreter': '🐍  Python interpreter',
        'menu.system.gold_spec_list': '📋  Gold Protocol: Spec lista',
        'menu.system.gold_spec_approve': '✅  Gold Protocol: Spec approve',
        'menu.system.gold_spec_reject': '❌  Gold Protocol: Spec reject',
        'menu.system.gold_phoenix': '🔥  Gold Protocol: Phoenix checkpoints',
        'menu.system.gold_phoenix_clear': '🗑️  Gold Protocol: Phoenix clear',
        'menu.system.gold_router': '🔀  Gold Protocol: Router decisions',
        'menu.system.gold_memory': '🧠  Gold Protocol: Memory stats',
        'menu.system.gold_status': '📊  Gold Protocol: Status',
        'menu.system.scaffold_list': '📋  Scaffold: Template lista',
        'menu.system.scaffold_generate': '✨  Scaffold: Generálás',
        'menu.system.approval_list': '📋  Approval: Lista',
        'menu.system.approval_approve': '✅  Approval: Approve',
        'menu.system.approval_reject': '❌  Approval: Reject',
        'menu.system.activity': '📊  Activity feed',
        'menu.system.dashboard': '🖥️  Dashboard indítása',
        'menu.system.backend': '🚀  Backend indítása',
        'menu.system.about': 'ℹ️  Névjegy (About)',

        // Settings menu
        'menu.settings.title': '⚙️ Beállítások',
        'menu.settings.api_key': '🔐  API key beállítás',
        'menu.settings.language': '🌐  Nyelv váltása (Magyar/English)',
        'menu.settings.theme': '🎨  Theme váltása (Dark/Light)',
        'menu.settings.vim_mode': '⌨️  Vim mode toggle',
        'menu.settings.preview': '🔬  Preview features toggle',
        'menu.settings.output_format': '📄  Output format (text/json)',
        'menu.settings.config_view': '👁️  Config fájl megtekintése',
        'menu.settings.config_edit': '✏️  Config fájl szerkesztése',
        'menu.settings.telemetry': '📊  Telemetria be/ki',
        'menu.settings.gold': '🎨  Gold Protocol Beállítások',

        // Common
        'common.back': '⬅️  Vissza',
        'common.cancel': '❌  Mégsem',
        'common.press_enter': 'Nyomj Enter-t a folytatáshoz...',
        'common.exit_message': '\nViszlát! 👋\n',
        'common.error': 'Hiba:',

        // Prompts
        'prompt.agent_name': 'Ügynök neve:',
        'prompt.agent_task': 'Feladat:',
        'prompt.track_id': 'Track ID:',
        'prompt.track_idea': 'Track ötlet leírása:',
        'prompt.file_path': 'Fájl elérési útja:',
        'prompt.file_path_optional': 'Fájl elérési útja (üres = összes):',
        'prompt.commit_message': 'Commit üzenet:',
        'prompt.branch_name': 'Branch neve:',
        'prompt.task_description': 'Task leírása:',
        'prompt.task_id': 'Task ID:',
        'prompt.jules_task': 'Jules feladat leírása:',
        'prompt.code_prompt': 'Kód generálási prompt:',

        // Scaffold
        'scaffold.template.select': 'Válassz sablont:',
        'scaffold.template.react': '⚛️  React Component',
        'scaffold.template.api': '🌐  REST API Route',
        'scaffold.template.agent': '🤖  AI Agent',
        'scaffold.template.test': '🧪  Test File',
        'scaffold.prompt.component_name': 'Komponens neve (PascalCase, pl. MyButton):',
        'scaffold.prompt.description': 'Leírás (opcionális):',
        'scaffold.prompt.route': 'Route neve (kebab-case, pl. users):',
        'scaffold.prompt.resource': 'Resource neve (PascalCase, pl. User):',
        'scaffold.prompt.agent_name': 'Agent neve (PascalCase, pl. DataCleaner):',
        'scaffold.prompt.agent_role': 'Agent szerepe (opcionális):',
        'scaffold.prompt.file_name': 'Fájl neve (kebab-case, pl. my-module):',
        'scaffold.prompt.test_suite': 'Test suite neve (pl. MyModule):',

        // Task Queue
        'queue.prompt.type': 'Task típusa:',

        // Banner
        'banner.subtitle': 'AI Agent Orchestration System',
        'banner.subtitle2': 'Magyar CLI — ↑↓ Enter Ctrl+C',
        'banner.workspace': 'Workspace:',
    },
    en: {
        // Main menu
        'menu.main.title': 'Main Menu — Choose category:',
        'menu.main.agents': '🤖  Agents',
        'menu.main.tracks': '📋  Tracks (Development Plans)',
        'menu.main.chat': '💬  Chat & AI',
        'menu.main.tests': '🧪  Tests & Quality',
        'menu.main.system': '🔧  System & Infrastructure',
        'menu.main.settings': '⚙️  Settings',
        'menu.main.exit': '🚪  Exit',

        // Agents menu
        'menu.agents.title': '🤖 Agents',
        'menu.agents.list': '📋  List agents',
        'menu.agents.execute': '▶️  Execute agent',
        'menu.agents.dev_generate': '💻  Code generation (Developer)',
        'menu.agents.dev_test': '🧪  Test generation (Developer)',
        'menu.agents.dev_fix': '🔧  Bug fix',
        'menu.agents.dev_heal': '💊  Self-healing',
        'menu.agents.dev_review': '🔍  Code review (Developer)',
        'menu.agents.dev_refactor': '♻️  Refactor',
        'menu.agents.dev_context': '📊  Context analysis',
        'menu.agents.dev_metrics': '📈  Metrics',

        // Tracks menu
        'menu.tracks.title': '📋 Tracks (Development Plans)',
        'menu.tracks.generate': '✨  Generate new track from idea',
        'menu.tracks.list': '📋  List tracks',
        'menu.tracks.view': '👁️  View track',
        'menu.tracks.conductor_status': '📊  Conductor: Project status',
        'menu.tracks.conductor_sync': '🔄  Conductor: Docs sync',
        'menu.tracks.conductor_health': '🏥  Conductor: Health check',

        // Chat menu
        'menu.chat.title': '💬 Chat & AI',
        'menu.chat.start': '💬  Start chat (GitHub/Gemini/Ollama)',
        'menu.chat.edge': '☁️  Edge Chat (Cloudflare)',
        'menu.chat.jules': '🤖  Jules AI menu',
        'menu.chat.jules_new': '🆕  New Jules task',
        'menu.chat.jules_sync': '🔄  Sync branches',
        'menu.chat.jules_status': '📊  Status',

        // Tests & Quality menu
        'menu.tests.title': '🧪 Tests & Quality',
        'menu.tests.build': '🏗️  Run build',
        'menu.tests.run': '🧪  Run tests (full suite)',
        'menu.tests.coverage': '📊  Test coverage analysis',
        'menu.tests.review': '🔍  Code review',
        'menu.tests.refactor': '♻️  Refactor',
        'menu.tests.git_status': '📊  Git status',
        'menu.tests.git_diff': '📝  Git diff',
        'menu.tests.git_commit': '💾  Git commit',
        'menu.tests.git_push': '🚀  Git push',
        'menu.tests.git_branches': '🌿  Git branches',
        'menu.tests.git_checkout': '🔀  Git checkout',
        'menu.tests.git_log': '📜  Git log',
        'menu.tests.queue_list': '📋  Task queue list',
        'menu.tests.queue_add': '➕  Add to task queue',
        'menu.tests.queue_cancel': '❌  Cancel task',

        // System menu
        'menu.system.title': '🔧 System & Infrastructure',
        'menu.system.doctor': '🩺  Diagnostics (Doctor)',
        'menu.system.health': '🏥  Health check',
        'menu.system.tools': '🧰  List MCP tools',
        'menu.system.interpreter': '🐍  Python interpreter',
        'menu.system.gold_spec_list': '📋  Gold Protocol: Spec list',
        'menu.system.gold_spec_approve': '✅  Gold Protocol: Approve spec',
        'menu.system.gold_spec_reject': '❌  Gold Protocol: Reject spec',
        'menu.system.gold_phoenix': '🔥  Gold Protocol: Phoenix checkpoints',
        'menu.system.gold_phoenix_clear': '🗑️  Gold Protocol: Clear phoenix',
        'menu.system.gold_router': '🔀  Gold Protocol: Router decisions',
        'menu.system.gold_memory': '🧠  Gold Protocol: Memory stats',
        'menu.system.gold_status': '📊  Gold Protocol: Status',
        'menu.system.scaffold_list': '📋  Scaffold: List templates',
        'menu.system.scaffold_generate': '✨  Scaffold: Generate',
        'menu.system.approval_list': '📋  Approval: List',
        'menu.system.approval_approve': '✅  Approval: Approve',
        'menu.system.approval_reject': '❌  Approval: Reject',
        'menu.system.activity': '📊  Activity feed',
        'menu.system.dashboard': '🖥️  Launch dashboard',
        'menu.system.backend': '🚀  Launch backend',
        'menu.system.about': 'ℹ️  About',

        // Settings menu
        'menu.settings.title': '⚙️ Settings',
        'menu.settings.api_key': '🔐  Set API key',
        'menu.settings.language': '🌐  Change language (Magyar/English)',
        'menu.settings.theme': '🎨  Change theme (Dark/Light)',
        'menu.settings.vim_mode': '⌨️  Toggle Vim mode',
        'menu.settings.preview': '🔬  Toggle preview features',
        'menu.settings.output_format': '📄  Output format (text/json)',
        'menu.settings.config_view': '👁️  View config file',
        'menu.settings.config_edit': '✏️  Edit config file',
        'menu.settings.telemetry': '📊  Toggle telemetry',
        'menu.settings.gold': '🎨  Gold Protocol Settings',

        // Common
        'common.back': '⬅️  Back',
        'common.cancel': '❌  Cancel',
        'common.press_enter': 'Press Enter to continue...',
        'common.exit_message': '\nGoodbye! 👋\n',
        'common.error': 'Error:',

        // Prompts
        'prompt.agent_name': 'Agent name:',
        'prompt.agent_task': 'Task:',
        'prompt.track_id': 'Track ID:',
        'prompt.track_idea': 'Track idea description:',
        'prompt.file_path': 'File path:',
        'prompt.file_path_optional': 'File path (empty = all):',
        'prompt.commit_message': 'Commit message:',
        'prompt.branch_name': 'Branch name:',
        'prompt.task_description': 'Task description:',
        'prompt.task_id': 'Task ID:',
        'prompt.jules_task': 'Jules task description:',
        'prompt.code_prompt': 'Code generation prompt:',

        // Scaffold
        'scaffold.template.select': 'Choose template:',
        'scaffold.template.react': '⚛️  React Component',
        'scaffold.template.api': '🌐  REST API Route',
        'scaffold.template.agent': '🤖  AI Agent',
        'scaffold.template.test': '🧪  Test File',
        'scaffold.prompt.component_name': 'Component name (PascalCase, e.g. MyButton):',
        'scaffold.prompt.description': 'Description (optional):',
        'scaffold.prompt.route': 'Route name (kebab-case, e.g. users):',
        'scaffold.prompt.resource': 'Resource name (PascalCase, e.g. User):',
        'scaffold.prompt.agent_name': 'Agent name (PascalCase, e.g. DataCleaner):',
        'scaffold.prompt.agent_role': 'Agent role (optional):',
        'scaffold.prompt.file_name': 'File name (kebab-case, e.g. my-module):',
        'scaffold.prompt.test_suite': 'Test suite name (e.g. MyModule):',

        // Task Queue
        'queue.prompt.type': 'Task type:',

        // Banner
        'banner.subtitle': 'AI Agent Orchestration System',
        'banner.subtitle2': 'English CLI — ↑↓ Enter Ctrl+C',
        'banner.workspace': 'Workspace:',
    }
};

/** Translation helper - retrieves string by key with current language from config */
function t(key: string): string {
    const lang = (configManager.get('general.language') as Lang) || 'hu';
    return STRINGS[lang]?.[key] || STRINGS.en[key] || key;
}

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
        message: chalk.dim(t('common.press_enter'))
    }]);
}

/** Prompt for free text input and return it (empty string if skipped). */
async function askInput(message: string): Promise<string> {
    const { value } = await inquirer.prompt([{ type: 'input', name: 'value', message }]);
    return (value || '').trim();
}

/** Show a sub-menu, return the selected value or BACK. */
async function subMenu(title: string, choices: Array<{ name: string; value: string } | inquirer.Separator>): Promise<string> {
    const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: title,
        choices: [
            ...choices,
            new inquirer.Separator(),
            { name: t('common.back'), value: BACK }
        ]
    }]);
    return action;
}

// ==================== Sub-Menus V2 (Reorganized) ====================

async function agentsMenuV2(): Promise<void> {
    const action = await subMenu(chalk.green(t('menu.agents.title')), [
        { name: t('menu.agents.list'), value: 'list' },
        { name: t('menu.agents.execute'), value: 'execute' },
        { name: t('menu.agents.dev_generate'), value: 'dev_generate' },
        { name: t('menu.agents.dev_test'), value: 'dev_test' },
        { name: t('menu.agents.dev_fix'), value: 'dev_fix' },
        { name: t('menu.agents.dev_heal'), value: 'dev_heal' },
        { name: t('menu.agents.dev_review'), value: 'dev_review' },
        { name: t('menu.agents.dev_refactor'), value: 'dev_refactor' },
        { name: t('menu.agents.dev_context'), value: 'dev_context' },
        { name: t('menu.agents.dev_metrics'), value: 'dev_metrics' },
    ]);
    if (action === BACK) return;

    if (action === 'list') {
        runCli('agents');
        await pause();
    } else if (action === 'execute') {
        const name = await askInput(t('prompt.agent_name'));
        if (!name) return;
        const task = await askInput(t('prompt.agent_task'));
        if (!task) return;
        runCli(`agent "${name}" "${task}"`);
        await pause();
    } else if (action === 'dev_generate') {
        const prompt = await askInput(t('prompt.code_prompt'));
        if (!prompt) return;
        runCli(`dev generate "${prompt}"`);
        await pause();
    } else if (action === 'dev_test') {
        const file = await askInput(t('prompt.file_path'));
        if (!file) return;
        runCli(`dev test "${file}"`);
        await pause();
    } else if (action === 'dev_fix') {
        runCli('dev fix --auto');
        await pause();
    } else if (action === 'dev_heal') {
        runCli('dev heal');
        await pause();
    } else if (action === 'dev_review') {
        const file = await askInput(t('prompt.file_path'));
        if (!file) return;
        runCli(`dev review "${file}"`);
        await pause();
    } else if (action === 'dev_refactor') {
        const file = await askInput(t('prompt.file_path'));
        if (!file) return;
        runCli(`dev refactor "${file}"`);
        await pause();
    } else if (action === 'dev_context') {
        runCli('dev context');
        await pause();
    } else if (action === 'dev_metrics') {
        runCli('dev metrics');
        await pause();
    }
}

async function tracksMenuV2(): Promise<void> {
    const action = await subMenu(chalk.blue(t('menu.tracks.title')), [
        { name: t('menu.tracks.generate'), value: 'generate' },
        { name: t('menu.tracks.list'), value: 'list' },
        { name: t('menu.tracks.view'), value: 'view' },
        new inquirer.Separator(),
        { name: t('menu.tracks.conductor_status'), value: 'conductor_status' },
        { name: t('menu.tracks.conductor_sync'), value: 'conductor_sync' },
        { name: t('menu.tracks.conductor_health'), value: 'conductor_health' },
    ]);
    if (action === BACK) return;

    // PROTECTED - DO NOT MODIFY THESE 3 LINES! (lines 273-275 from original)
    if (action === 'conductor_status') { runCli('conductor status'); await pause(); }
    else if (action === 'conductor_sync') { runCli('conductor sync'); await pause(); }
    else if (action === 'conductor_health') { runCli('conductor health'); await pause(); }
    else if (action === 'generate') {
        const idea = await askInput(t('prompt.track_idea'));
        if (!idea) return;
        runCli(`tracks generate "${idea}"`);
        await pause();
    } else if (action === 'list') {
        runCli('tracks list');
        await pause();
    } else if (action === 'view') {
        const trackId = await askInput(t('prompt.track_id'));
        if (!trackId) return;
        runCli(`tracks view ${trackId}`);
        await pause();
    }
}

async function chatMenuV2(): Promise<void> {
    const action = await subMenu(chalk.magenta(t('menu.chat.title')), [
        { name: t('menu.chat.start'), value: 'chat' },
        { name: t('menu.chat.edge'), value: 'edge' },
        { name: t('menu.chat.jules'), value: 'jules' },
    ]);
    if (action === BACK) return;

    if (action === 'chat') {
        runCli('chat');
    } else if (action === 'edge') {
        console.log(chalk.cyan('\n  Tipp: A chatben írd be az /edge parancsot a váltáshoz!\n'));
        runCli('chat');
    } else if (action === 'jules') {
        await julesMenuV2();
    }
}

async function julesMenuV2(): Promise<void> {
    const action = await subMenu(chalk.magenta(t('menu.chat.title') + ' / Jules'), [
        { name: t('menu.chat.jules_new'), value: 'new' },
        { name: t('menu.chat.jules_sync'), value: 'sync' },
        { name: t('menu.chat.jules_status'), value: 'status' },
    ]);
    if (action === BACK) return;

    if (action === 'new') {
        const task = await askInput(t('prompt.jules_task'));
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

async function testsMenuV2(): Promise<void> {
    const action = await subMenu(chalk.yellow(t('menu.tests.title')), [
        { name: t('menu.tests.build'), value: 'build' },
        { name: t('menu.tests.run'), value: 'run' },
        { name: t('menu.tests.coverage'), value: 'coverage' },
        { name: t('menu.tests.review'), value: 'review' },
        { name: t('menu.tests.refactor'), value: 'refactor' },
        new inquirer.Separator(),
        { name: t('menu.tests.git_status'), value: 'git_status' },
        { name: t('menu.tests.git_diff'), value: 'git_diff' },
        { name: t('menu.tests.git_commit'), value: 'git_commit' },
        { name: t('menu.tests.git_push'), value: 'git_push' },
        { name: t('menu.tests.git_branches'), value: 'git_branches' },
        { name: t('menu.tests.git_checkout'), value: 'git_checkout' },
        { name: t('menu.tests.git_log'), value: 'git_log' },
        new inquirer.Separator(),
        { name: t('menu.tests.queue_list'), value: 'queue_list' },
        { name: t('menu.tests.queue_add'), value: 'queue_add' },
        { name: t('menu.tests.queue_cancel'), value: 'queue_cancel' },
    ]);
    if (action === BACK) return;

    if (action === 'build') {
        runCli('dev build');
        await pause();
    } else if (action === 'run') {
        runCli('dev test');
        await pause();
    } else if (action === 'coverage') {
        runCli('dev coverage --run');
        await pause();
    } else if (action === 'review') {
        const file = await askInput(t('prompt.file_path'));
        if (!file) return;
        runCli(`dev review "${file}"`);
        await pause();
    } else if (action === 'refactor') {
        const file = await askInput(t('prompt.file_path'));
        if (!file) return;
        runCli(`dev refactor "${file}"`);
        await pause();
    } else if (action === 'git_status') {
        runCli('dev git status');
        await pause();
    } else if (action === 'git_diff') {
        const file = await askInput(t('prompt.file_path_optional'));
        runCli(file ? `dev git diff "${file}"` : 'dev git diff');
        await pause();
    } else if (action === 'git_commit') {
        const msg = await askInput(t('prompt.commit_message'));
        if (!msg) return;
        runCli(`dev git commit "${msg}"`);
        await pause();
    } else if (action === 'git_push') {
        runCli('dev git push');
        await pause();
    } else if (action === 'git_branches') {
        runCli('dev git branches');
        await pause();
    } else if (action === 'git_checkout') {
        const branch = await askInput(t('prompt.branch_name'));
        if (!branch) return;
        runCli(`dev git checkout "${branch}"`);
        await pause();
    } else if (action === 'git_log') {
        runCli('dev git log');
        await pause();
    } else if (action === 'queue_list') {
        runCli('dev queue list');
        await pause();
    } else if (action === 'queue_add') {
        const { taskType } = await inquirer.prompt([{
            type: 'list',
            name: 'taskType',
            message: t('queue.prompt.type'),
            choices: ['generate', 'test', 'fix', 'review', 'refactor', 'coverage', 'scaffold', 'generic']
        }]);
        const desc = await askInput(t('prompt.task_description'));
        if (!desc) return;
        runCli(`dev queue add ${taskType} "${desc}"`);
        await pause();
    } else if (action === 'queue_cancel') {
        const id = await askInput(t('prompt.task_id'));
        if (!id) return;
        runCli(`dev queue cancel ${id}`);
        await pause();
    }
}

async function systemMenuV2(): Promise<void> {
    const action = await subMenu(chalk.cyan(t('menu.system.title')), [
        { name: t('menu.system.doctor'), value: 'doctor' },
        { name: t('menu.system.health'), value: 'health' },
        { name: t('menu.system.tools'), value: 'tools' },
        { name: t('menu.system.interpreter'), value: 'interpreter' },
        new inquirer.Separator(),
        { name: t('menu.system.gold_spec_list'), value: 'gold_spec_list' },
        { name: t('menu.system.gold_spec_approve'), value: 'gold_spec_approve' },
        { name: t('menu.system.gold_spec_reject'), value: 'gold_spec_reject' },
        { name: t('menu.system.gold_phoenix'), value: 'gold_phoenix' },
        { name: t('menu.system.gold_phoenix_clear'), value: 'gold_phoenix_clear' },
        { name: t('menu.system.gold_router'), value: 'gold_router' },
        { name: t('menu.system.gold_memory'), value: 'gold_memory' },
        { name: t('menu.system.gold_status'), value: 'gold_status' },
        new inquirer.Separator(),
        { name: t('menu.system.scaffold_list'), value: 'scaffold_list' },
        { name: t('menu.system.scaffold_generate'), value: 'scaffold_generate' },
        new inquirer.Separator(),
        { name: t('menu.system.approval_list'), value: 'approval_list' },
        { name: t('menu.system.approval_approve'), value: 'approval_approve' },
        { name: t('menu.system.approval_reject'), value: 'approval_reject' },
        new inquirer.Separator(),
        { name: t('menu.system.activity'), value: 'activity' },
        { name: t('menu.system.dashboard'), value: 'dashboard' },
        { name: t('menu.system.backend'), value: 'backend' },
        { name: t('menu.system.about'), value: 'about' },
    ]);
    if (action === BACK) return;

    if (action === 'doctor') { runCli('doctor'); await pause(); }
    else if (action === 'health') { runCli('conductor health'); await pause(); }
    else if (action === 'tools') { runCli('tools'); await pause(); }
    else if (action === 'interpreter') { runCli('interpreter'); }
    else if (action === 'gold_spec_list') { runCli('gold spec-list'); await pause(); }
    else if (action === 'gold_spec_approve') {
        const id = await askInput('Spec ID:');
        if (!id) return;
        runCli(`gold spec-approve ${id}`);
        await pause();
    }
    else if (action === 'gold_spec_reject') {
        const id = await askInput('Spec ID:');
        if (!id) return;
        runCli(`gold spec-reject ${id}`);
        await pause();
    }
    else if (action === 'gold_phoenix') { runCli('gold phoenix'); await pause(); }
    else if (action === 'gold_phoenix_clear') { runCli('gold phoenix-clear'); await pause(); }
    else if (action === 'gold_router') { runCli('gold router'); await pause(); }
    else if (action === 'gold_memory') { runCli('gold memory'); await pause(); }
    else if (action === 'gold_status') { runCli('gold status'); await pause(); }
    else if (action === 'scaffold_list') { runCli('dev scaffold list'); await pause(); }
    else if (action === 'scaffold_generate') { await scaffoldMenuV2(); }
    else if (action === 'approval_list') { runCli('dev approval list'); await pause(); }
    else if (action === 'approval_approve') {
        const id = await askInput('Approval ID:');
        if (!id) return;
        runCli(`dev approval approve ${id}`);
        await pause();
    }
    else if (action === 'approval_reject') {
        const id = await askInput('Approval ID:');
        if (!id) return;
        runCli(`dev approval reject ${id}`);
        await pause();
    }
    else if (action === 'activity') { runCli('dev activity'); await pause(); }
    else if (action === 'dashboard') { runCli('dashboard'); }
    else if (action === 'backend') { runCli('backend'); }
    else if (action === 'about') { runCli('about'); await pause(); }
}

async function scaffoldMenuV2(): Promise<void> {
    const { template } = await inquirer.prompt([{
        type: 'list',
        name: 'template',
        message: chalk.cyan(t('scaffold.template.select')),
        choices: [
            { name: t('scaffold.template.react'), value: 'react-component' },
            { name: t('scaffold.template.api'), value: 'rest-api' },
            { name: t('scaffold.template.agent'), value: 'agent' },
            { name: t('scaffold.template.test'), value: 'test-file' },
        ]
    }]);

    const vars: string[] = [];
    if (template === 'react-component') {
        const name = await askInput(t('scaffold.prompt.component_name'));
        if (!name) return;
        vars.push(`ComponentName=${name}`);
        const desc = await askInput(t('scaffold.prompt.description'));
        if (desc) vars.push(`description=${desc}`);
    } else if (template === 'rest-api') {
        const route = await askInput(t('scaffold.prompt.route'));
        if (!route) return;
        vars.push(`routeName=${route}`);
        const resource = await askInput(t('scaffold.prompt.resource'));
        if (!resource) return;
        vars.push(`ResourceName=${resource}`);
    } else if (template === 'agent') {
        const name = await askInput(t('scaffold.prompt.agent_name'));
        if (!name) return;
        vars.push(`AgentName=${name}`);
        const role = await askInput(t('scaffold.prompt.agent_role'));
        if (role) vars.push(`agentRole=${role}`);
    } else if (template === 'test-file') {
        const fileName = await askInput(t('scaffold.prompt.file_name'));
        if (!fileName) return;
        vars.push(`fileName=${fileName}`);
        const suite = await askInput(t('scaffold.prompt.test_suite'));
        if (!suite) return;
        vars.push(`TestSuite=${suite}`);
    }

    const varFlags = vars.map(v => `-v ${v}`).join(' ');
    runCli(`dev scaffold generate ${template} ${varFlags}`);
    await pause();
}

async function settingsMenuV2(): Promise<void> {
    const key = configManager.get('apiKey') ? '********' : chalk.dim('(nincs megadva)');
    const currentLang = (configManager.get('general.language') as Lang) || 'hu';
    const currentTheme = configManager.get('ui.theme') || 'dark';
    const vimMode = configManager.get('general.vimMode') ? 'ON' : 'OFF';

    const action = await subMenu(chalk.gray(t('menu.settings.title')), [
        { name: `${t('menu.settings.api_key')} [${key}]`, value: 'auth' },
        { name: `${t('menu.settings.language')} [${currentLang.toUpperCase()}]`, value: 'language' },
        { name: `${t('menu.settings.theme')} [${currentTheme}]`, value: 'theme' },
        { name: `${t('menu.settings.vim_mode')} [${vimMode}]`, value: 'vim_mode' },
        { name: t('menu.settings.preview'), value: 'preview' },
        { name: t('menu.settings.output_format'), value: 'output_format' },
        { name: t('menu.settings.config_view'), value: 'config_view' },
        { name: t('menu.settings.config_edit'), value: 'config_edit' },
        { name: t('menu.settings.telemetry'), value: 'telemetry' },
        { name: t('menu.settings.gold'), value: 'gold' },
    ]);
    if (action === BACK) return;

    if (action === 'auth') {
        runCli('auth login');
        await pause();
    } else if (action === 'language') {
        const newLang = currentLang === 'hu' ? 'en' : 'hu';
        configManager.set('general.language', newLang);
        console.log(chalk.green(`\n✅ Language switched to: ${newLang.toUpperCase()}\n`));
        await pause();
    } else if (action === 'theme') {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        configManager.set('ui.theme', newTheme);
        console.log(chalk.green(`\n✅ Theme switched to: ${newTheme}\n`));
        await pause();
    } else if (action === 'vim_mode') {
        const current = configManager.get('general.vimMode');
        configManager.set('general.vimMode', !current);
        console.log(chalk.green(`\n✅ Vim mode: ${!current ? 'ON' : 'OFF'}\n`));
        await pause();
    } else if (action === 'preview') {
        const current = configManager.get('general.previewFeatures');
        configManager.set('general.previewFeatures', !current);
        console.log(chalk.green(`\n✅ Preview features: ${!current ? 'ON' : 'OFF'}\n`));
        await pause();
    } else if (action === 'output_format') {
        const current = configManager.get('output.format') || 'text';
        const newFormat = current === 'text' ? 'json' : 'text';
        configManager.set('output.format', newFormat);
        console.log(chalk.green(`\n✅ Output format: ${newFormat}\n`));
        await pause();
    } else if (action === 'config_view') {
        console.log(chalk.cyan('\nUser config:'));
        console.log(JSON.stringify(configManager.getAll(), null, 2));
        await pause();
    } else if (action === 'config_edit') {
        console.log(chalk.yellow(`\nEdit: ${configManager.userSettingsPath}`));
        await pause();
    } else if (action === 'telemetry') {
        const current = configManager.get('telemetry.enabled');
        configManager.set('telemetry.enabled', !current);
        console.log(chalk.green(`\n✅ Telemetry: ${!current ? 'ON' : 'OFF'}\n`));
        await pause();
    } else if (action === 'gold') {
        runCli('gold status');
        await pause();
    }
}

// ==================== OLD Sub-Menus (Legacy, will be removed) ====================

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

        // ASCII Banner (figlet)
        console.log(chalk.cyan(figlet.textSync('BRUNELLA', { font: 'Standard' })));
        console.log(chalk.dim(`  v${version} — ${t('banner.subtitle')}`));
        console.log(chalk.dim(`  ${t('banner.subtitle2')}\n`));
        console.log(chalk.dim(`  ${t('banner.workspace')} ${process.cwd()}\n`));

        const { mainMenu } = await inquirer.prompt([{
            type: 'list',
            name: 'mainMenu',
            message: chalk.bold(t('menu.main.title')),
            choices: [
                { name: t('menu.main.agents'), value: 'agents' },
                { name: t('menu.main.tracks'), value: 'tracks' },
                { name: t('menu.main.chat'), value: 'chat' },
                { name: t('menu.main.tests'), value: 'tests' },
                { name: t('menu.main.system'), value: 'system' },
                { name: t('menu.main.settings'), value: 'settings' },
                new inquirer.Separator(),
                { name: t('menu.main.exit'), value: 'exit' }
            ]
        }]);

        if (mainMenu === 'exit') {
            console.log(chalk.dim(t('common.exit_message')));
            process.exit(0);
        }

        try {
            if (mainMenu === 'agents') await agentsMenuV2();
            else if (mainMenu === 'tracks') await tracksMenuV2();
            else if (mainMenu === 'chat') await chatMenuV2();
            else if (mainMenu === 'tests') await testsMenuV2();
            else if (mainMenu === 'system') await systemMenuV2();
            else if (mainMenu === 'settings') await settingsMenuV2();
        } catch (e: unknown) {
            // Handle Ctrl+C gracefully
            if (e instanceof Error && e.message.includes('User force closed')) {
                continue;
            }
            console.error(chalk.red(t('common.error')), e instanceof Error ? e.message : String(e));
            await pause();
        }
    }
}