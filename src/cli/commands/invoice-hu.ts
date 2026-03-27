import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { agentManager } from '../../agents/AgentManager.js';

export async function invoiceCommand() {
  console.log(
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
        console.log(chalk.green.bold(`
✅ ${res.message}
`));
        
        if (res.data?.results && res.data.results.length > 0) {
          console.log(chalk.yellow.bold('--- Feldolgozott fájlok ---'));
          res.data.results.forEach((r: any) => {
            const statusIcon = r.status === 'success' ? chalk.green('✔') : chalk.red('✘');
            const info = r.status === 'success' ? `${r.vendor} (${r.amount} HUF)` : chalk.red(r.reason);
            console.log(`${statusIcon} ${chalk.cyan(r.filename)}: ${info}`);
          });
        }
      } else {
        console.log(chalk.red.bold('\n❌ Hiba: ') + res.message);
      }
    } catch (error) {
      spinner.fail('Hiba a feldolgozás során.');
      console.error(chalk.red(error));
    }
  }

  if (action === 'status') {
    console.log(chalk.blue.bold('\n--- Aktuális Állapot ---'));
    console.log(`Ügynök: ${chalk.cyan('InvoiceAutomation')}`);
    console.log(`Célmappa: ${chalk.cyan('Google Drive / Invoice')}`);
    console.log(`Adattábla: ${chalk.cyan(process.env.INVOICE_SPREADSHEET_ID || 'Nincs megadva')}`);
    console.log(chalk.gray('\n(Részletes statisztika a Dashboard-on érhető el)\n'));
  }
}
