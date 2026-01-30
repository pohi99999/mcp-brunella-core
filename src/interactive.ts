import inquirer from 'inquirer';
import { execSync } from 'child_process';

export async function startInteractiveMenu() {
    console.log('🌟 Brunella CLI - Interactive Mode 🌟');
    
    while (true) {
        const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: 'Mit szeretnél tenni?',
            choices: [
                { name: '💬 Chat (Orchestrator)', value: 'chat' },
                { name: '🩺 Doctor (Diagnosztika)', value: 'doctor' },
                { name: '👥 Ügynökök listázása', value: 'agents' },
                { name: '🛠️ Eszközök listázása', value: 'tools' },
                { name: '🐍 Python Interpreter', value: 'interpreter' },
                { name: '❌ Kilépés', value: 'exit' }
            ]
        }]);

        if (action === 'exit') process.exit(0);

        try {
            console.log(`\n--- ${action.toUpperCase()} ---\n`);
            const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            execSync(`${npmCmd} run cli ${action}`, { stdio: 'inherit' });
            console.log(`\n-----------------------\n`);
        } catch (e) {
            // Ignore
        }
    }
}