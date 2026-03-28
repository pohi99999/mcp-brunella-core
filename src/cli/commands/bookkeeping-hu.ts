import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { agentManager } from '../../agents/AgentManager.js';

/**
 * Könyvelés Automatizálás CLI Felület
 * Lehetővé teszi a banki bizonylatok és NAV számlák párosítását.
 */
export async function bookkeepingCommand() {
  console.log(
    boxen(chalk.blue.bold('📊 Brunella Könyvelés Automatizálás'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'blue',
    })
  );

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Válassz műveletet:',
      choices: [
        { name: '📥 Adatok Ingesztálása (Bank + NAV)', value: 'ingest' },
        { name: '⚖️ Automatikus Párosítás Indítása', value: 'match' },
        { name: '📋 Függő Tételek Megtekintése', value: 'status' },
        { name: '❌ Kilépés', value: 'exit' },
      ],
    },
  ]);

  if (action === 'exit') return;

  if (action === 'ingest') {
    const spinner = ora('Banki és NAV adatok beolvasása...').start();
    try {
      // Ingest NAV
      const navResult: any = await agentManager.delegate('NavAgent', 'Process NAV invoices from samples');
      // Ingest Bank
      const bankResult: any = await agentManager.delegate('BankAgent', 'Process bank transactions from samples');
      
      spinner.stop();
      console.log(chalk.green(`✅ NAV számlák: ${navResult.data?.length || 0} db`));
      console.log(chalk.green(`✅ Banki tételek: ${bankResult.data?.length || 0} db`));
    } catch (error) {
      spinner.fail('Hiba az adatok beolvasása során.');
      console.error(chalk.red(error));
    }
  }

  if (action === 'match') {
    const spinner = ora('Intelligens párosítás folyamatban...').start();
    try {
      const result: any = await agentManager.delegate('MatchingAgent', 'Match all PENDING bank transactions');
      spinner.stop();

      if (result.status === 'success') {
        const { total, matched, manual } = result.data;
        console.log(boxen(
          chalk.white(`Összes tétel: ${chalk.bold(total)}\n`) +
          chalk.green(`Párosítva: ${chalk.bold(matched)}\n`) +
          chalk.yellow(`Kézi ellenőrzés: ${chalk.bold(manual)}`),
          { title: 'Eredmény', padding: 1, borderColor: 'green' }
        ));
      } else {
        console.log(chalk.red('Hiba a párosításban: ') + result.error);
      }
    } catch (error) {
      spinner.fail('Hiba a párosító ügynök futtatásakor.');
      console.error(chalk.red(error));
    }
  }

  if (action === 'status') {
    console.log(chalk.cyan('\n--- Könyvelési Állapot ---'));
    console.log(chalk.gray('Használt adatbázis: ') + chalk.white('data/bookkeeping.db'));
    console.log(chalk.gray('Aktív ügynökök: ') + chalk.white('BankAgent, NavAgent, MatchingAgent'));
    console.log(chalk.yellow('\nTipp: A részletes elemzéshez használd a Web Dashboard-ot.'));
  }
}
