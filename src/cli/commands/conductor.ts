import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import boxen from 'boxen';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve relative to the script location if cwd is unreliable
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const TRACKS_PATH = path.join(PROJECT_ROOT, 'conductor/tracks.md');

export async function conductorCommand(action: string, id?: string, phase?: string, task?: string) {
    if (!fs.existsSync(TRACKS_PATH)) {
        console.log(chalk.red('Hiba: A Conductor nincs inicializálva ebben a könyvtárban.'));
        return;
    }

    switch (action) {
        case 'status':
            showStatus();
            break;
        case 'list':
            listTracks();
            break;
        case 'show':
            if (!id) {
                console.log(chalk.red('Hiba: trackId megadása kötelező. Használat: brunella conductor show <track_id>'));
                return;
            }
            showTrack(id);
            break;
        case 'phase':
            if (!id || !phase) {
                console.log(chalk.red('Hiba: trackId és phaseIndex megadása kötelező. Használat: brunella conductor phase <track_id> <phase_index>'));
                return;
            }
            showPhase(id, parseInt(phase));
            break;
        case 'task':
            if (!id || !phase || !task) {
                console.log(chalk.red('Hiba: trackId, phaseIndex és taskIndex megadása kötelező. Használat: brunella conductor task <track_id> <phase_index> <task_index>'));
                return;
            }
            showTask(id, parseInt(phase), parseInt(task));
            break;
        case 'run':
            if (!id || !phase || !task) {
                console.log(chalk.red('Hiba: trackId, phaseIndex és taskIndex megadása kötelező. Használat: brunella conductor run <track_id> <phase_index> <task_index>'));
                return;
            }
            runTask(id, parseInt(phase), parseInt(task));
            break;
        default:
            console.log(boxen(
                chalk.bold('🎮 Brunella Conductor CLI') + '\n\n' +
                chalk.yellow('  brunella conductor status') + ' - Projekt áttekintés\n' +
                chalk.yellow('  brunella conductor list') + '   - Track-ek listázása\n' +
                chalk.yellow('  brunella conductor show <id>') + ' - Track részletei\n' +
                chalk.yellow('  brunella conductor phase <id> <p>') + ' - Fázis részletei\n' +
                chalk.yellow('  brunella conductor task <id> <p> <t>') + ' - Feladat részletei\n' +
                chalk.yellow('  brunella conductor run <id> <p> <t>') + '  - Feladat parancsának futtatása',
                { padding: 1, margin: 1, borderStyle: 'round', borderColor: 'cyan' }
            ));
    }
}

function showStatus() {
    const content = fs.readFileSync(TRACKS_PATH, 'utf-8');
    const tracks = parseTracks(content);
    
    console.log(chalk.bold('\n🚀 Projekt Státusz (Conductor):'));
    tracks.forEach(t => {
        let statusChar = t.status === 'completed' ? chalk.green('✔') : (t.status === 'in-progress' ? chalk.blue('⚡') : chalk.gray('○'));
        let statusText = t.status === 'completed' ? chalk.green(t.name) : (t.status === 'in-progress' ? chalk.blue(t.name) : t.name);
        
        console.log(`${statusChar} ${statusText} ${t.id ? chalk.dim(`(ID: ${t.id})`) : ''}`);
    });
    console.log();
}

function listTracks() {
    showStatus();
}

function showTrack(trackId: string) {
    const trackPath = path.join(PROJECT_ROOT, 'conductor/tracks', trackId);
    if (!fs.existsSync(trackPath)) {
        console.log(chalk.red(`Hiba: Track '${trackId}' nem található.`));
        return;
    }

    const specPath = path.join(trackPath, 'spec.md');
    const planPath = path.join(trackPath, 'plan.md');

    console.log(boxen(chalk.bold.cyan(`TRACK: ${trackId}`), { padding: 1, borderStyle: 'classic', borderColor: 'cyan' }));

    if (fs.existsSync(specPath)) {
        console.log(chalk.blue.bold('📖 SPECIFICATION:'));
        console.log(chalk.dim('──────────────────────────────────────────────────────────────────────────────'));
        console.log(fs.readFileSync(specPath, 'utf-8'));
        console.log();
    }

    if (fs.existsSync(planPath)) {
        console.log(chalk.green.bold('📋 IMPLEMENTATION PLAN:'));
        console.log(chalk.dim('──────────────────────────────────────────────────────────────────────────────'));
        const planContent = fs.readFileSync(planPath, 'utf-8');
        const plan = parsePlan(planContent);
        
        plan.phases.forEach((p, pIdx) => {
            console.log(chalk.bold(`\nPhase ${pIdx + 1}: ${p.name}`));
            p.tasks.forEach((t, tIdx) => {
                const statusChar = t.completed ? chalk.green('✔') : chalk.gray('○');
                console.log(`  ${statusChar} Task ${tIdx + 1}: ${t.name}`);
            });
        });
        console.log();
    }
}

function showPhase(trackId: string, phaseIndex: number) {
    const trackPath = path.join(PROJECT_ROOT, 'conductor/tracks', trackId);
    const planPath = path.join(trackPath, 'plan.md');

    if (!fs.existsSync(planPath)) {
        console.log(chalk.red(`Hiba: Plan nem található a track-hez: ${trackId}`));
        return;
    }

    const plan = parsePlan(fs.readFileSync(planPath, 'utf-8'));
    const phase = plan.phases[phaseIndex - 1];

    if (!phase) {
        console.log(chalk.red(`Hiba: Phase ${phaseIndex} nem található.`));
        return;
    }

    console.log(boxen(chalk.bold.cyan(`TRACK: ${trackId}\nPHASE ${phaseIndex}: ${phase.name}`), { padding: 1, borderStyle: 'round' }));
    
    phase.tasks.forEach((t, tIdx) => {
        const statusChar = t.completed ? chalk.green('✔') : chalk.gray('○');
        console.log(`  ${statusChar} Task ${tIdx + 1}: ${t.name}`);
        if (t.description) {
            console.log(chalk.dim(`      ${t.description.replace(/\n/g, '\n      ')}`));
        }
    });
    console.log();
}

function showTask(trackId: string, phaseIndex: number, taskIndex: number) {
    const task = getTask(trackId, phaseIndex, taskIndex);
    if (!task) return;

    console.log(boxen(chalk.bold.cyan(`TRACK: ${trackId}\nPHASE ${phaseIndex} | TASK ${taskIndex}`), { padding: 1, borderStyle: 'round' }));
    
    const statusChar = task.completed ? chalk.green('✔') : chalk.gray('○');
    console.log(`${statusChar} ${chalk.bold(task.name)}`);
    if (task.description) {
        console.log(`\n${task.description}`);
    }
    console.log();
}

function runTask(trackId: string, phaseIndex: number, taskIndex: number) {
    const task = getTask(trackId, phaseIndex, taskIndex);
    if (!task) return;

    console.log(chalk.blue(`Task analízise futtatás céljából: ${task.name}`));
    
    // Command extraction strategies
    // 1. Markdown code block with bash/sh/cmd
    const codeBlockMatch = task.description.match(/```(bash|sh|cmd|powershell)\s+([\s\S]*?)```/);
    // 2. Explicit "run: command" or "cmd: command" line
    const explicitCmdMatch = task.description.match(/^(?:run|cmd):\s*(.+)$/m);
    // 3. Simple `npm run ...` or `node ...` in backticks
    const inlineCodeMatch = task.description.match(/`((?:npm run|node)\s+[^`]+)`/);

    let commandToRun: string | null = null;

    if (codeBlockMatch) {
        commandToRun = codeBlockMatch[2].trim();
    } else if (explicitCmdMatch) {
        commandToRun = explicitCmdMatch[1].trim();
    } else if (inlineCodeMatch) {
        commandToRun = inlineCodeMatch[1].trim();
    }

    if (commandToRun) {
        console.log(chalk.yellow(`\nFuttatás: ${commandToRun}\n`));
        try {
            execSync(commandToRun, { stdio: 'inherit', cwd: PROJECT_ROOT });
            console.log(chalk.green('\n✔ Parancs sikeresen lefutott.'));
        } catch (error) {
            console.error(chalk.red('\n✖ Hiba a parancs futtatása közben.'));
        }
    } else {
        console.log(chalk.yellow('Nem találtam futtatható parancsot ebben a task-ban.'));
        console.log(chalk.dim('Tipp: Használj `npm run ...` vagy ```bash ...``` blokkot a leírásban.'));
    }
}

function getTask(trackId: string, phaseIndex: number, taskIndex: number): TaskInfo | null {
    const trackPath = path.join(PROJECT_ROOT, 'conductor/tracks', trackId);
    const planPath = path.join(trackPath, 'plan.md');

    if (!fs.existsSync(planPath)) {
        console.log(chalk.red(`Hiba: Plan nem található a track-hez: ${trackId}`));
        return null;
    }

    const plan = parsePlan(fs.readFileSync(planPath, 'utf-8'));
    const phase = plan.phases[phaseIndex - 1];
    if (!phase) {
        console.log(chalk.red(`Hiba: Phase ${phaseIndex} nem található.`));
        return null;
    }

    const task = phase.tasks[taskIndex - 1];
    if (!task) {
        console.log(chalk.red(`Hiba: Task ${taskIndex} nem található a Phase ${phaseIndex}-ben.`));
        return null;
    }
    return task;
}

function parseTracks(content: string) {
    const sections = content.split('---').slice(1);
    return sections.map(s => {
        const nameMatch = s.match(/\*\*Track:\s*(.*?)\*\*/i);
        const statusMatch = s.match(/-\s*\[( |x|~)\]/i);
        const linkMatch = s.match(/Link:\s*\[.*?\]\(\.\/tracks\/(.*?)\/\)/i);
        
        const statusChar = statusMatch ? statusMatch[1] : ' ';
        const status = statusChar.toLowerCase() === 'x' ? 'completed' : (statusChar === '~' ? 'in-progress' : 'pending');

        return {
            name: nameMatch ? nameMatch[1].trim() : 'Ismeretlen track',
            status: status,
            id: linkMatch ? linkMatch[1].trim() : null
        };
    });
}

interface TaskInfo {
    name: string;
    completed: boolean;
    description: string;
}

interface PhaseInfo {
    name: string;
    tasks: TaskInfo[];
}

function parsePlan(content: string) {
    const phases: PhaseInfo[] = [];
    const lines = content.split('\n');
    let currentPhase: PhaseInfo | null = null;
    let currentTask: TaskInfo | null = null;

    for (let line of lines) {
        const phaseMatch = line.match(/^## Phase (\d+):\s*(.*)/i);
        if (phaseMatch) {
            currentPhase = { name: phaseMatch[2].trim(), tasks: [] };
            phases.push(currentPhase);
            currentTask = null;
            continue;
        }

        const taskMatch = line.match(/^\s*-\s*\[( |x|~)\]\s*Task:\s*(.*)/i);
        if (taskMatch && currentPhase) {
            currentTask = {
                name: taskMatch[2].trim(),
                completed: taskMatch[1].toLowerCase() === 'x',
                description: ''
            };
            currentPhase.tasks.push(currentTask);
            continue;
        }

        if (currentTask && line.trim() !== '' && !line.match(/^##/) && !line.match(/^\s*-/)) {
            currentTask.description += (currentTask.description ? '\n' : '') + line.trim();
        }
    }

    return { phases };
}
