import inquirer from 'inquirer';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';

import { agentManager } from '../../agents/AgentManager.js';
import { ensureError } from '../../utils/ensureError.js';
import { writeLine } from '../../utils/cliOutput.js';
import {
  DEFAULT_GRANT_PROFILE,
  buildGrantTask,
  formatGrantAmount,
  formatPercent,
  type GrantProfileForm,
  type GrantWatcherAgentResponse,
  type GrantWatcherPayload,
} from '../../lib/grantFlow.js';

function printBanner(): void {
  writeLine(
    boxen(chalk.green.bold('📑 Brunella Pályázatfigyelő'), {
      padding: 1,
      margin: 1,
      borderStyle: 'double',
      borderColor: 'green',
    }),
  );
}

function printProfile(profile: GrantProfileForm): void {
  writeLine(
    boxen(
      chalk.white(`Cég: ${chalk.bold(profile.companyName)}\n`) +
        chalk.white(`TEÁOR: ${chalk.bold(profile.teaorCode)}\n`) +
        chalk.white(`Létszám: ${chalk.bold(String(profile.employeeCount))}\n`) +
        chalk.white(`Árbevétel: ${chalk.bold(formatGrantAmount(profile.annualRevenue))}\n`) +
        chalk.white(`Régió: ${chalk.bold(profile.location)}\n\n`) +
        chalk.gray(profile.projectDescription),
      { title: 'Aktuális profil', padding: 1, borderColor: 'cyan' },
    ),
  );
}

function printGrantSummary(result: GrantWatcherPayload): void {
  const eligible = result.eligibleGrants.slice(0, 5);
  const body =
    chalk.white(`Összes találat: ${chalk.bold(String(result.stats.totalFound))}\n`) +
    chalk.green(`Illeszkedő: ${chalk.bold(String(result.stats.eligible))}\n`) +
    chalk.yellow(`Átlag pontszám: ${chalk.bold(formatPercent(result.stats.avgMatchScore))}\n`) +
    chalk.cyan(`Közelgő határidők: ${chalk.bold(String(result.upcomingDeadlines.length))}`) +
    (result.summaryDocUrl ? `\n${chalk.gray(`Dokumentum: ${result.summaryDocUrl}`)}` : '');

  writeLine(
    boxen(body, { title: 'Pályázati shortlist', padding: 1, borderColor: 'green' }),
  );

  if (eligible.length === 0) {
    writeLine(chalk.yellow('\nNincs 50% feletti találat az aktuális profilhoz.'));
    return;
  }

  writeLine(chalk.cyan('\n--- Top találatok ---'));
  eligible.forEach((match, index) => {
    writeLine(
      chalk.bold(`${index + 1}. ${match.grant.title}`) +
        ` · ${formatPercent(match.matchScore)} · ${formatGrantAmount(match.grant.fundingAmount, match.grant.currency)}`,
    );
    writeLine(chalk.gray(`   Határidő: ${match.grant.deadline} · Forrás: ${match.grant.source}`));
    writeLine(chalk.gray(`   Indoklás: ${match.matchReasons.join(' · ')}`));
    if (match.warnings?.length) {
      writeLine(chalk.yellow(`   Figyelmeztetés: ${match.warnings.join(' · ')}`));
    }
  });
}

function printDraft(result: GrantWatcherPayload): void {
  if (!result.applicationDraft) {
    writeLine(chalk.yellow('\nA kiválasztott pályázathoz még nem érkezett draft.'));
    return;
  }

  writeLine(
    boxen(
      chalk.white(`Cím: ${chalk.bold(result.applicationDraft.title)}\n`) +
        chalk.white(`Cég: ${chalk.bold(result.applicationDraft.companyName ?? 'N/A')}`),
      { title: 'Pályázati draft', padding: 1, borderColor: 'blue' },
    ),
  );

  result.applicationDraft.sections.forEach((section) => {
    writeLine(
      boxen(
        chalk.bold(section.title) + `\n\n${section.content}`,
        { padding: 1, borderColor: 'blue' },
      ),
    );
  });
}

async function promptProfile(profile: GrantProfileForm): Promise<GrantProfileForm> {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'companyName',
      message: 'Cégnév:',
      default: profile.companyName,
      validate: (input: string) => (input.trim() ? true : 'A cégnév nem lehet üres.'),
    },
    {
      type: 'input',
      name: 'teaorCode',
      message: 'TEÁOR kód:',
      default: profile.teaorCode,
      validate: (input: string) => (input.trim() ? true : 'A TEÁOR kód nem lehet üres.'),
    },
    {
      type: 'input',
      name: 'employeeCount',
      message: 'Létszám:',
      default: String(profile.employeeCount),
      validate: (input: string) => {
        const parsed = Number(input);
        return Number.isFinite(parsed) && parsed > 0 ? true : 'Pozitív számot adj meg.';
      },
    },
    {
      type: 'input',
      name: 'annualRevenue',
      message: 'Árbevétel (Ft):',
      default: String(profile.annualRevenue),
      validate: (input: string) => {
        const parsed = Number(input);
        return Number.isFinite(parsed) && parsed >= 0 ? true : 'Adj meg egy nem negatív számot.';
      },
    },
    {
      type: 'input',
      name: 'location',
      message: 'Régió:',
      default: profile.location,
      validate: (input: string) => (input.trim() ? true : 'A régió nem lehet üres.'),
    },
    {
      type: 'input',
      name: 'projectDescription',
      message: 'Projektleírás:',
      default: profile.projectDescription,
      validate: (input: string) => (input.trim() ? true : 'A projektleírás nem lehet üres.'),
    },
  ]);

  return {
    companyName: answers.companyName.trim(),
    teaorCode: answers.teaorCode.trim(),
    employeeCount: Number(answers.employeeCount),
    annualRevenue: Number(answers.annualRevenue),
    location: answers.location.trim(),
    projectDescription: answers.projectDescription.trim(),
  };
}

async function runGrantWatcher(profile: GrantProfileForm, grantId?: string): Promise<GrantWatcherPayload | null> {
  const spinner = ora(grantId ? 'Pályázati draft generálása...' : 'Pályázatok keresése...').start();

  try {
    const response = await agentManager.delegate(
      'GrantWatcher',
      buildGrantTask(profile, grantId),
    ) as GrantWatcherAgentResponse;

    spinner.stop();

    if (response.status !== 'success' || !response.data) {
      throw new Error(response.error || response.message || 'A GrantWatcher nem adott vissza eredményt.');
    }

    printGrantSummary(response.data);
    if (response.data.applicationDraft) {
      printDraft(response.data);
    }

    return response.data;
  } catch (error: unknown) {
    const message = ensureError(error).message;
    spinner.fail(message);
    return null;
  }
}

export async function palyazatCommand(): Promise<void> {
  printBanner();

  let profile = DEFAULT_GRANT_PROFILE;
  let lastResult: GrantWatcherPayload | null = null;

  printProfile(profile);

  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Válassz műveletet:',
        choices: [
          { name: '🔎 Pályázatok keresése', value: 'scan' },
          { name: '🧩 Draft generálása', value: 'draft' },
          { name: '✏️ Profil szerkesztése', value: 'profile' },
          { name: '📋 Utolsó eredmény újranyomtatása', value: 'status' },
          { name: '❌ Kilépés', value: 'exit' },
        ],
      },
    ]);

    if (action === 'exit') {
      return;
    }

    if (action === 'profile') {
      profile = await promptProfile(profile);
      printProfile(profile);
      continue;
    }

    if (action === 'scan') {
      lastResult = await runGrantWatcher(profile);
      continue;
    }

    if (action === 'draft') {
      if (!lastResult?.eligibleGrants.length) {
        writeLine(chalk.yellow('\nElőbb futtass keresést, hogy legyen választható pályázat.'));
        lastResult = await runGrantWatcher(profile);
        if (!lastResult?.eligibleGrants.length) {
          continue;
        }
      }

      const { grantTitle } = await inquirer.prompt([
        {
          type: 'list',
          name: 'grantTitle',
          message: 'Melyik pályázathoz generáljunk draftot?',
          choices: lastResult.eligibleGrants.map((match) => ({
            name: `${match.grant.title} · ${formatPercent(match.matchScore)}`,
            value: match.grant.title,
          })),
        },
      ]);

      lastResult = await runGrantWatcher(profile, grantTitle);
      continue;
    }

    if (action === 'status') {
      if (lastResult) {
        printGrantSummary(lastResult);
        if (lastResult.applicationDraft) {
          printDraft(lastResult);
        }
      } else {
        writeLine(chalk.gray('\nMég nincs lekért pályázati eredmény.'));
      }
    }
  }
}
