import { ExtensionManager } from '../extensions.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

const extensions = new ExtensionManager();

export async function extensionCommand(action: string, extensionName?: string) {
    // Felfedezzük a bővítményeket a művelet előtt
    await extensions.discoverExtensions();

    switch (action) {
        case 'list':
            console.log(chalk.blue('📦 Telepített bővítmények:'));
            const extList = extensions.getExtensions();
            if (extList.length === 0) {
                console.log(chalk.gray('Nincs telepített bővítmény.'));
            } else {
                extList.forEach(ext => console.log(`${chalk.green('✔')} ${chalk.bold(ext.name)} (v${ext.version}): ${ext.description}`));
            }
            break;
        case 'install':
            if (!extensionName) {
                const answer = await inquirer.prompt([{
                    type: 'input',
                    name: 'name',
                    message: 'Add meg a telepítendő bővítmény nevét (npm package vagy URL):'
                }]);
                extensionName = answer.name;
            }
            console.log(chalk.yellow(`⏳ Bővítmény telepítése: ${extensionName}...`));
            try {
                extensions.installExtension(extensionName!);
                // Telepítés után újra felfedezzük, hogy betöltődjön
                await extensions.discoverExtensions();
                console.log(chalk.green(`✔ ${extensionName} sikeresen telepítve.`));
                console.log(chalk.dim(`Telepítési hely: ${extensions.getExtensionRoot()}`));
                console.log(chalk.cyan(`Betöltött bővítmények: ${extensions.summarizeLoaded().join(', ')}`));
            } catch (error) {
                console.error(chalk.red(`✖ Telepítés sikertelen: ${(error as Error).message}`));
            }
            break;
        case 'uninstall':
            if (!extensionName) {
                console.log(chalk.red('Hiba: Add meg az eltávolítandó bővítmény nevét.'));
                return;
            }
            console.log(chalk.yellow(`⏳ Bővítmény eltávolítása: ${extensionName}...`));
            try {
                extensions.uninstallExtension(extensionName);
                console.log(chalk.green(`✔ ${extensionName} sikeresen eltávolítva.`));
                await extensions.discoverExtensions();
                console.log(chalk.cyan(`Betöltött bővítmények: ${extensions.summarizeLoaded().join(', ')}`));
            } catch (error) {
                console.error(chalk.red(`✖ Eltávolítás sikertelen: ${(error as Error).message}`));
            }
            break;
        case 'update':
            console.log(chalk.yellow(`⏳ Bővítmény frissítése${extensionName ? `: ${extensionName}` : ''}...`));
            try {
                extensions.updateExtension(extensionName);
                await extensions.discoverExtensions();
                console.log(chalk.green('✔ Frissítés sikeresen lefutott.'));
                console.log(chalk.cyan(`Betöltött bővítmények: ${extensions.summarizeLoaded().join(', ')}`));
            } catch (error) {
                console.error(chalk.red(`✖ Frissítés sikertelen: ${(error as Error).message}`));
            }
            break;
        case 'reload':
            console.log(chalk.yellow('⏳ Bővítmények újratöltése...'));
            await extensions.discoverExtensions();
            console.log(chalk.green('✔ Bővítmények újratöltve.'));
            console.log(chalk.cyan(`Betöltött bővítmények: ${extensions.summarizeLoaded().join(', ')}`));
            break;
        default:
            console.log(chalk.red(`Ismeretlen művelet: ${action}`));
            console.log(chalk.yellow('Használat: brunella extension <list|install|uninstall|update|reload> [name]'));
    }
}