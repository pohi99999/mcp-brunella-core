import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { agentManager } from '@packages/agents/AgentManager.js';
import { writeLine } from '../../../packages/utils/cliOutput.js';

export async function invoiceCommand() {
  writeLine(
    boxen(chalk.green.bold('🧾 Brunella Számla Automatizálás'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'green',
    })
  );

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Mit szeretnél tenni?',
      choices: [
        { name: '📥 Új számlák keresése és feldolgozása', value: 'process' },
        { name: '📊 Feldolgozási statisztika megtekintése', value: 'status' },
        { name: '❌ Kilépés', value: 'exit' },
      ],
    },
  ]);

  if (action === 'exit') return;

  if (action === 'process') {
    const spinner = ora('Gmail átfésülése és számlák elemzése folyamatban...').start();

    try {
      const result = await agentManager.delegate('InvoiceAutomation', 'process');
      spinner.stop();

      const res = result as any;
      if (res.success) {
        writeLine(chalk.green.bold(`
✅ ${res.message}
`));
        
        if (res.data?.results && res.data.results.length > 0) {
          writeLine(chalk.yellow.bold('--- Feldolgozott fájlok ---'));
          res.data.results.forEach((r: any) => {
            const statusIcon = r.status === 'success' ? chalk.green('✔') : chalk.red('✘');
            const info = r.status === 'success' ? `${r.vendor} (${r.amount} HUF)` : chalk.red(r.reason);
            writeLine(`${statusIcon} ${chalk.cyan(r.filename)}: ${info}`);
          });
        }
      } else {
        writeLine(chalk.red.bold('\n❌ Hiba: ') + res.message);
      }
    } catch (error) {
      spinner.fail('Hiba a feldolgozás során.');
      console.error(chalk.red(error));
    }
  }

  if (action === 'status') {
    writeLine(chalk.blue.bold('\n--- Aktuális Állapot ---'));
    writeLine(`Ügynök: ${chalk.cyan('InvoiceAutomation')}`);
    writeLine(`Célmappa: ${chalk.cyan('Google Drive / Invoice')}`);
    writeLine(`Adattábla: ${chalk.cyan(process.env.INVOICE_SPREADSHEET_ID || 'Nincs megadva')}`);
    writeLine(chalk.gray('\n(Részletes statisztika a Dashboard-on érhető el)\n'));
  }
}
