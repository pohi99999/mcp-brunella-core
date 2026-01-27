import fs from 'fs';
import path from 'path';
import chalk from 'chalk';

// Resolve relative to the script location if cwd is unreliable
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const TRACKS_PATH = path.join(PROJECT_ROOT, 'conductor/tracks.md');

export async function conductorCommand(action: string) {
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
        default:
            console.log(chalk.yellow('Használat: brunella conductor <status|list>'));
    }
}

function showStatus() {
    const content = fs.readFileSync(TRACKS_PATH, 'utf-8');
    const tracks = parseTracks(content);
    
    console.log(chalk.bold('\n🚀 Projekt Státusz (Conductor):'));
    tracks.forEach(t => {
        let statusChar = t.status === 'completed' ? chalk.green('[x]') : (t.status === 'in-progress' ? chalk.blue('[~]') : chalk.gray('[ ]'));
        console.log(`${statusChar} ${t.name}`);
    });
    console.log();
}

function listTracks() {
    // Hasonló a status-hoz, de részletesebb is lehetne
    showStatus();
}

function parseTracks(content: string) {
    const sections = content.split('---').slice(1);
    return sections.map(s => {
        // More lenient regex for markdown bold and status
        const nameMatch = s.match(/\*\*Track:\s*(.*?)\*\*/i);
        const statusMatch = s.match(/-\s*\[( |x|~)\]/i);
        
        const statusChar = statusMatch ? statusMatch[1] : ' ';
        const status = statusChar.toLowerCase() === 'x' ? 'completed' : (statusChar === '~' ? 'in-progress' : 'pending');

        return {
            name: nameMatch ? nameMatch[1].trim() : 'Ismeretlen track',
            status: status
        };
    });
}
