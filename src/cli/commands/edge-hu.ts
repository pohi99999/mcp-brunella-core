import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';
import { cloudflareClient } from '../../utils/cloudflareClient.js';

/**
 * Cloudflare Edge Agents Network (CEAN) CLI Vezérlő - MAGYAR
 */
export async function edgeCommand() {
  console.log(boxen(chalk.cyan.bold('BRUNELLA EDGE ORCHESTRATOR v2'), {
    padding: 1,
    margin: 1,
    borderStyle: 'double',
    borderColor: 'cyan'
  }));

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'Mit szeretnél tenni az Edge flottával?',
      choices: [
        { name: '🌐 Flotta állapota (16 Agent)', value: 'status' },
        { name: '🚀 Feladat küldése (Dispatch)', value: 'dispatch' },
        { name: '📊 Utolsó feladatok lekérdezése', value: 'tasks' },
        { name: '🔙 Vissza', value: 'exit' }
      ]
    }
  ]);

  if (action === 'exit') return;

  if (action === 'status') {
    const spinner = ora('Edge flotta lekérdezése...').start();
    try {
      const workers = await cloudflareClient.fetchWorkers();
      spinner.succeed('Flotta adatok betöltve.');
      
      console.log('\n' + chalk.bold('AKTÍV EDGE ÁGENSEK:'));
      workers.forEach((w: any) => {
        const status = w.is_healthy ? chalk.green('HEALTHY') : chalk.red('DOWN');
        console.log(`${chalk.cyan(w.agent_name.padEnd(25))} | ${status} | ${chalk.yellow(w.avg_latency_ms || 0)}ms | ${w.worker_url}`);
      });
    } catch (e) {
      spinner.fail('Hiba az Edge flotta lekérdezésekor: ' + e);
    }
  }

  if (action === 'dispatch') {
    const workers = await cloudflareClient.fetchWorkers();
    const { agent, task } = await inquirer.prompt([
      {
        type: 'list',
        name: 'agent',
        message: 'Melyik ágenst szeretnéd hívni?',
        choices: workers.map((w: any) => ({ name: w.agent_name, value: w.agent_name }))
      },
      {
        type: 'input',
        name: 'task',
        message: 'Mi a végrehajtandó feladat?',
        validate: (input) => input.length > 0 || 'A feladat nem lehet üres!'
      }
    ]);

    const spinner = ora(`Küldés az Edge-re: ${agent}...`).start();
    try {
      const result = await cloudflareClient.dispatch(agent, task);
      spinner.succeed(`Sikeres válasz: ${agent}`);
      console.log(boxen(JSON.stringify(result.result, null, 2), {
        title: 'AGENT VÁLASZ',
        padding: 1,
        borderColor: 'green'
      }));
    } catch (e) {
      spinner.fail('Hiba a küldés során: ' + e);
    }
  }

  // Rekurzív hívás a főmenühöz
  if (action !== 'exit') {
    await edgeCommand();
  }
}
