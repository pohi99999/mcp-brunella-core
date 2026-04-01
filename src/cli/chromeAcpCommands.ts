import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';

const ACP_URL = 'http://localhost:9315';
const INSTALL_ARGS = ['install', '-g', '@chrome-acp/proxy-server', '@anthropic-ai/claude-code', '@zed-industries/claude-code-acp'];
const INSTALL_COMMAND = `npm ${INSTALL_ARGS.join(' ')}`;
const WINDOWS_START_SCRIPT = resolve(process.cwd(), 'scripts', 'start-chrome-acp.bat');

interface ChromeAcpDoctorReport {
  proxyInstalled: boolean;
  adapterInstalled: boolean;
  claudeInstalled: boolean;
  startScriptExists: boolean;
  uiReachable: boolean;
  adapterEntryPoint?: string;
}

function writeLine(message = ''): void {
  process.stdout.write(`${message}\n`);
}

function hasBinary(binaryName: string): boolean {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(locator, [binaryName], {
    stdio: 'ignore',
    shell: false,
  });

  return result.status === 0;
}

async function isChromeAcpReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(ACP_URL, { signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function collectDoctorReport(): Promise<ChromeAcpDoctorReport> {
  const npmPrefix = spawnSync('npm', ['prefix', '-g'], {
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });

  const prefix = npmPrefix.status === 0 ? npmPrefix.stdout.trim() : '';
  const adapterEntryPoint = prefix
    ? resolve(prefix, 'node_modules', '@zed-industries', 'claude-code-acp', 'dist', 'index.js')
    : undefined;

  return {
    proxyInstalled: hasBinary('acp-proxy'),
    adapterInstalled: Boolean(adapterEntryPoint && existsSync(adapterEntryPoint)),
    claudeInstalled: hasBinary('claude'),
    startScriptExists: existsSync(WINDOWS_START_SCRIPT),
    uiReachable: await isChromeAcpReachable(),
    adapterEntryPoint,
  };
}

function printDoctorReport(report: ChromeAcpDoctorReport): void {
  writeLine(chalk.bold.cyan('\n🌐 Chrome ACP állapot\n'));
  writeLine(`  acp-proxy:       ${report.proxyInstalled ? chalk.green('OK') : chalk.red('HIÁNYZIK')}`);
  writeLine(`  claude-code-acp: ${report.adapterInstalled ? chalk.green('OK') : chalk.red('HIÁNYZIK')}`);
  writeLine(`  claude:          ${report.claudeInstalled ? chalk.green('OK') : chalk.yellow('nem található')}`);
  writeLine(`  start script:    ${report.startScriptExists ? chalk.green('OK') : chalk.red('HIÁNYZIK')}`);
  writeLine(`  UI (${ACP_URL}): ${report.uiReachable ? chalk.green('ELÉRHETŐ') : chalk.yellow('nem elérhető')}`);
  if (report.adapterEntryPoint) {
    writeLine(chalk.gray(`  adapter entry:   ${report.adapterEntryPoint}`));
  }

  if (!report.proxyInstalled || !report.adapterInstalled) {
    writeLine(chalk.yellow('\nTelepítés szükséges:'));
    writeLine(chalk.gray(`  ${INSTALL_COMMAND}`));
  }

  if (!report.uiReachable) {
    writeLine(chalk.gray('\nIndítás után nyisd meg: http://localhost:9315'));
  }
}

function startChromeAcp(): void {
  if (process.platform !== 'win32') {
    writeLine(chalk.yellow('Automatikus start jelenleg Windows scriptre van előkészítve.'));
    writeLine(chalk.gray('Futtasd kézzel: acp-proxy --no-auth claude-code-acp'));
    return;
  }

  if (!existsSync(WINDOWS_START_SCRIPT)) {
    writeLine(chalk.red(`Hiányzó start script: ${WINDOWS_START_SCRIPT}`));
    return;
  }

  const child = spawn('cmd', ['/c', 'start', '', WINDOWS_START_SCRIPT], {
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  child.unref();

  writeLine(chalk.green('Chrome ACP indítás elindítva külön ablakban.'));
  writeLine(chalk.gray(`UI: ${ACP_URL}`));
}

function runInstall(): void {
  writeLine(chalk.cyan('Chrome ACP csomagok globális telepítése...'));
  const result = spawnSync('npm', INSTALL_ARGS, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    writeLine(chalk.red('A globális telepítés hibával állt le.'));
    return;
  }

  writeLine(chalk.green('Globális Chrome ACP telepítés kész.'));
}

export function registerChromeAcpCommands(program: Command): void {
  const chromeAcp = program
    .command('chrome-acp')
    .description('Chrome ACP lokális proxy és dashboard integráció kezelése');

  const runDoctor = async (): Promise<void> => {
    printDoctorReport(await collectDoctorReport());
  };

  chromeAcp
    .command('doctor')
    .description('Binárisok, start script és localhost UI ellenőrzése')
    .action(async () => {
      await runDoctor();
    });

  chromeAcp
    .command('status')
    .description('Gyors állapotlekérdezés a Chrome ACP UI-ról')
    .action(async () => {
      const reachable = await isChromeAcpReachable();
      writeLine(reachable ? chalk.green(`Chrome ACP elérhető: ${ACP_URL}`) : chalk.yellow(`Chrome ACP nem érhető el: ${ACP_URL}`));
    });

  chromeAcp
    .command('start')
    .description('A Windows start script segítségével elindítja a Chrome ACP proxyt')
    .action(() => {
      startChromeAcp();
    });

  chromeAcp
    .command('install')
    .description('Megmutatja vagy lefuttatja a szükséges globális npm telepítést')
    .option('--run', 'Azonnal lefuttatja a globális npm install parancsot')
    .action((options: { run?: boolean }) => {
      if (options.run) {
        runInstall();
        return;
      }

      writeLine(chalk.bold.cyan('\nChrome ACP telepítés\n'));
      writeLine(chalk.gray(INSTALL_COMMAND));
    });

  chromeAcp.action(async () => {
    const { action } = await inquirer.prompt<{ action: string }>([
      {
        type: 'list',
        name: 'action',
        message: 'Chrome ACP művelet kiválasztása',
        choices: [
          { name: '🩺 Doctor — binárisok és localhost ellenőrzése', value: 'doctor' },
          { name: '▶ Start — proxy indítása külön ablakban', value: 'start' },
          { name: '📦 Install — globális npm parancs megjelenítése', value: 'install' },
          { name: '🌍 Status — UI elérhetőség ellenőrzése', value: 'status' },
          { name: '❌ Kilépés', value: 'cancel' },
        ],
      },
    ]);

    switch (action) {
      case 'doctor':
        await runDoctor();
        return;
      case 'start':
        startChromeAcp();
        return;
      case 'install':
        writeLine(chalk.gray(INSTALL_COMMAND));
        return;
      case 'status':
        writeLine((await isChromeAcpReachable()) ? chalk.green(`Chrome ACP elérhető: ${ACP_URL}`) : chalk.yellow(`Chrome ACP nem érhető el: ${ACP_URL}`));
        return;
      default:
        writeLine(chalk.gray('Chrome ACP művelet megszakítva.'));
    }
  });
}
