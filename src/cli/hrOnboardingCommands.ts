import { Command } from 'commander';
import {
  hrOnboardingDryRunCommand,
  hrOnboardingSamplesCommand,
  hrOnboardingStatusCommand,
} from './commands/hr-onboarding-hu.js';

export function registerHROnboardingCommands(program: Command): void {
  const hr = program.command('hr').description('HR automatizálás parancsok');

  const onboarding = hr.command('onboarding').description('HR onboarding és provisioning');

  onboarding
    .command('mintak')
    .description('Onboarding minták listázása')
    .action(async () => {
      await hrOnboardingSamplesCommand();
    });

  onboarding
    .command('futtat')
    .description('Onboarding dry-run futtatása')
    .option('--sample <key>', 'Minta kulcs')
    .option('--json <payload>', 'Nyers JSON payload')
    .option('--file <path>', 'Payload fájl')
    .option('--source <source>', 'Forrás címke', 'cli')
    .action(async (opts: { sample?: string; json?: string; file?: string; source?: string }) => {
      await hrOnboardingDryRunCommand(opts);
    });

  onboarding
    .command('allapot')
    .description('Legutóbbi onboarding dry-run jobok')
    .option('--limit <number>', 'Megjelenített jobok száma', '5')
    .action(async (opts: { limit: string }) => {
      await hrOnboardingStatusCommand(Number.parseInt(opts.limit, 10) || 5);
    });
}
