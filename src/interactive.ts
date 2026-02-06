import inquirer from 'inquirer';
import { execSync } from 'child_process';
import chalk from 'chalk';
import boxen from 'boxen';
import { configManager } from './utils/cliConfig.js';

export async function startInteractiveMenu() {
    console.clear();
    console.log(boxen(chalk.bold.blue(' Brunella CLI ') + chalk.dim(' vPro'), {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'cyan'
    }));

    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const runCli = (args: string) => {
        try {
            console.clear();
            execSync(`${npmCmd} run cli -- ${args}`, { stdio: 'inherit' });
            console.log(chalk.dim('\nNyomj Enter-t a folytatáshoz...'));
            // We can't easily wait for Enter specifically here without another lib or raw mode, 
            // but execSync usually returns control. 
            // Let's just pause briefly or let the user see the output.
            // Actually, `src/cli.ts` commands usually exit(0) which is fine.
        } catch (e) {
            console.error(chalk.red('Hiba történt a parancs futtatása közben.'));
        }
    };

    while (true) {
        console.log(chalk.cyan(`\nAktív Workspace: ${process.cwd()}\n`));

        const { mainMenu } = await inquirer.prompt([{
            type: 'list',
            name: 'mainMenu',
            message: 'Válassz kategóriát:',
            choices: [
                { name: '💬 Kommunikáció (Chat & AI)', value: 'comm' },
                { name: '👥 Ügynökök (Agents)', value: 'agents' },
                { name: '⚙️ Beállítások (Settings)', value: 'settings' },
                { name: '🛠️ Fejlesztői Eszközök (Dev Tools)', value: 'dev' },
                { name: '📁 Projekt (Conductor)', value: 'conductor' },
                new inquirer.Separator(),
                { name: '❌ Kilépés', value: 'exit' }
            ]
        }]);

        if (mainMenu === 'exit') process.exit(0);

        if (mainMenu === 'comm') {
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Válassz chat módot:',
                choices: [
                    { name: '🤖 Helyi Brunella Chat (Ollama)', value: 'chat' },
                    { name: '☁️ Cloudflare Edge Chat (/edge on)', value: 'chat_edge' },
                    { name: '🔙 Vissza', value: 'back' }
                ]
            }]);

            if (action === 'back') continue;
            if (action === 'chat_edge') {
                console.log(chalk.cyan('\nTipp: A chatben használd az /edge on parancsot!\n'));
                runCli('chat');
            } else {
                runCli('chat');
            }
        }

        if (mainMenu === 'agents') {
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Ügynök Műveletek:',
                choices: [
                    { name: '📋 Ügynökök listázása', value: 'list' },
                    { name: '🔙 Vissza', value: 'back' }
                ]
            }]);

            if (action === 'back') continue;
            if (action === 'list') runCli('agents');
        }

        if (mainMenu === 'settings') {
            const key = configManager.get('apiKey') ? '********' : '(nincs megadva)';

            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Beállítások:',
                choices: [
                    { name: `🔐 Auth (Jelenlegi kulcs: ${key})`, value: 'auth' },
                    { name: '🔙 Vissza', value: 'back' }
                ]
            }]);

            if (action === 'back') continue;
            if (action === 'auth') runCli('auth login');
        }

        if (mainMenu === 'dev') {
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Fejlesztői Eszközök:',
                choices: [
                    { name: '🩺 Rendszer Diagnosztika (Doctor)', value: 'doctor' },
                    { name: '🐍 Python Interpreter', value: 'interpreter' },
                    { name: '🧰 Eszközök listázása (Tools)', value: 'tools' },
                    { name: '🔙 Vissza', value: 'back' }
                ]
            }]);

            if (action === 'back') continue;
            if (action === 'doctor') runCli('doctor');
            if (action === 'interpreter') runCli('interpreter');
            if (action === 'tools') runCli('tools');
        }

        if (mainMenu === 'conductor') {
            const { action } = await inquirer.prompt([{
                type: 'list',
                name: 'action',
                message: 'Projekt Menedzsment:',
                choices: [
                    { name: '📊 Státusz Jelentés', value: 'status' },
                    { name: '🔄 Dokumentáció Szinkron (Sync)', value: 'sync' },
                    { name: '🏥 Health Check', value: 'health' },
                    { name: '🔙 Vissza', value: 'back' }
                ]
            }]);

            if (action === 'back') continue;
            if (action === 'status') runCli('conductor status');
            if (action === 'sync') runCli('conductor sync');
            if (action === 'health') runCli('conductor health');
        }
    }
}