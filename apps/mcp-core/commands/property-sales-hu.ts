import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import { pSalesTrack, formatPSalesPhaseStatus } from "../../../packages/utils/pSalesTrack.js";
import { writeLine } from '../../../packages/utils/cliOutput.js';

function printStatus(): void {
  writeLine(
    boxen(chalk.cyan.bold("🏢 P-Sales20260327"), {
      padding: 1,
      margin: 1,
      borderStyle: "double",
      borderColor: "cyan",
    }),
  );

  writeLine(chalk.bold("Státusz:"), `${pSalesTrack.status.toUpperCase()} · ${pSalesTrack.progress}%`);
  writeLine(chalk.bold("Fókusz:"), pSalesTrack.currentFocus);
  writeLine(chalk.bold("Következő lépés:"), pSalesTrack.nextReadyStep);
  writeLine(chalk.bold("Architektúra:"), pSalesTrack.architectureDoc);
  writeLine(chalk.cyan("\nSzállítási modellek:"));
  pSalesTrack.surfaces.forEach((surface) => writeLine(`  • ${surface}`));
}

function printArchitecture(): void {
  writeLine(chalk.cyan.bold("\nArchitektúra összefoglaló"));
  writeLine(chalk.dim("Phase 0 output: shared core + enterprise + standalone + Cloudflare opciók."));

  writeLine(chalk.cyan("\nÜgynöki szerepkörök:"));
  pSalesTrack.agents.forEach((agent) => writeLine(`  • ${agent}`));

  writeLine(chalk.cyan("\nCloudflare opciók:"));
  pSalesTrack.cloudflare.forEach((item) => writeLine(`  • ${item}`));
}

function printIntake(): void {
  writeLine(chalk.cyan.bold("\nIntake és felmérés"));
  writeLine(chalk.dim("Dokumentumfeltöltés → hiánylista → felmérő ügynök kérdések → intake státusz."));

  writeLine(chalk.cyan("\nDokumentum-csomag:"));
  pSalesTrack.intake.documentBuckets.forEach((bucket) => {
    writeLine(chalk.bold(`  • ${bucket.title}`));
    bucket.examples.forEach((example) => writeLine(`    - ${example}`));
  });

  writeLine(chalk.cyan("\nFelmérő kérdések:"));
  pSalesTrack.intake.surveyQuestions.forEach((question, index) => {
    writeLine(`  ${index + 1}. ${question}`);
  });

  writeLine(chalk.cyan("\nVárt outputok:"));
  pSalesTrack.intake.outputs.forEach((output) => writeLine(`  • ${output}`));
}

function printResearch(): void {
  writeLine(chalk.cyan.bold("\nKutatási és értékelési modell"));
  writeLine(chalk.dim("Piaci komparátok → értéktartomány → riport → stratégiai átadás."));

  writeLine(chalk.cyan("\nForrástípusok:"));
  pSalesTrack.research.sourceTypes.forEach((sourceType) => writeLine(`  • ${sourceType}`));

  writeLine(chalk.cyan("\nKomparálási kritériumok:"));
  pSalesTrack.research.comparableCriteria.forEach((criterion, index) => {
    writeLine(`  ${index + 1}. ${criterion}`);
  });

  writeLine(chalk.cyan("\nÉrtéktartomány outputok:"));
  pSalesTrack.research.valuationOutputs.forEach((output) => writeLine(`  • ${output}`));

  writeLine(chalk.cyan("\nKockázati jelzések:"));
  pSalesTrack.research.riskFlags.forEach((risk) => writeLine(`  • ${risk}`));

  writeLine(chalk.cyan("\nRiport szekciók:"));
  pSalesTrack.research.reportSections.forEach((section) => writeLine(`  • ${section}`));
}

function printStrategy(): void {
  writeLine(chalk.cyan.bold("\nStratégia és approval"));
  writeLine(chalk.dim("Kutatási eredmény → csatorna-mix → jóváhagyás → végrehajtási irány."));

  writeLine(chalk.cyan("\nCsatorna-ajánlatok:"));
  pSalesTrack.strategy.channelOptions.forEach((channel) => writeLine(`  • ${channel}`));

  writeLine(chalk.cyan("\nCélcsoport és döntéshozók:"));
  pSalesTrack.strategy.targetSegments.forEach((segment, index) => {
    writeLine(`  ${index + 1}. ${segment}`);
  });

  writeLine(chalk.cyan("\nJóváhagyási lépések:"));
  pSalesTrack.strategy.approvalSteps.forEach((step) => writeLine(`  • ${step}`));

  writeLine(chalk.cyan("\nKimeneti fókuszok:"));
  pSalesTrack.strategy.executionPaths.forEach((path) => writeLine(`  • ${path}`));

  writeLine(chalk.cyan("\nRiport szekciók:"));
  pSalesTrack.strategy.reportSections.forEach((section) => writeLine(`  • ${section}`));

  writeLine(chalk.cyan("\nKérdések az approval előtt:"));
  pSalesTrack.strategy.questions.forEach((question, index) => {
    writeLine(`  ${index + 1}. ${question}`);
  });
}

function printExecution(): void {
  writeLine(chalk.cyan.bold("\nVégrehajtás és audit"));
  writeLine(chalk.dim("Jóváhagyott terv → csatornánkénti futtatás → audit → visszajelzés."));

  writeLine(chalk.cyan("\nVégrehajtási módok:"));
  pSalesTrack.execution.executionModes.forEach((mode) => writeLine(`  • ${mode}`));

  writeLine(chalk.cyan("\nMérföldkövek:"));
  pSalesTrack.execution.statusMilestones.forEach((milestone, index) => {
    writeLine(`  ${index + 1}. ${milestone}`);
  });

  writeLine(chalk.cyan("\nVisszajelzési pontok:"));
  pSalesTrack.execution.feedbackLoops.forEach((loop) => writeLine(`  • ${loop}`));

  writeLine(chalk.cyan("\nAudit napló:"));
  pSalesTrack.execution.auditTrail.forEach((entry) => writeLine(`  • ${entry}`));

  writeLine(chalk.cyan("\nRiport szekciók:"));
  pSalesTrack.execution.reportSections.forEach((section) => writeLine(`  • ${section}`));

  writeLine(chalk.cyan("\nKérdések a zárás előtt:"));
  pSalesTrack.execution.questions.forEach((question, index) => {
    writeLine(`  ${index + 1}. ${question}`);
  });
}

function printCloudflareOption(): void {
  writeLine(chalk.cyan.bold("\nCloudflare delivery opció"));
  writeLine(chalk.dim(pSalesTrack.cloudflareDecision.recommendedPath));

  writeLine(chalk.cyan("\nStorage és state:"));
  pSalesTrack.cloudflareDecision.storageOptions.forEach((option) => writeLine(`  • ${option}`));

  writeLine(chalk.cyan("\nRuntime és hosting:"));
  pSalesTrack.cloudflareDecision.runtimeOptions.forEach((option) => writeLine(`  • ${option}`));
  pSalesTrack.cloudflareDecision.hostingOptions.forEach((option) => writeLine(`  • ${option}`));

  writeLine(chalk.cyan("\nDöntési szempontok:"));
  pSalesTrack.cloudflareDecision.decisionCriteria.forEach((criterion, index) => {
    writeLine(`  ${index + 1}. ${criterion}`);
  });

  writeLine(chalk.cyan("\nNyitott kérdések:"));
  pSalesTrack.cloudflareDecision.openQuestions.forEach((question, index) => {
    writeLine(`  ${index + 1}. ${question}`);
  });

  writeLine(chalk.cyan("\nGyors opciók:"));
  pSalesTrack.cloudflare.forEach((option) => writeLine(`  • ${option}`));
}

function printPhaseRoadmap(): void {
  writeLine(chalk.cyan.bold("\nPhase roadmap"));
  pSalesTrack.phases.forEach((phase) => {
    const statusColor =
      phase.status === "completed"
        ? chalk.green
        : phase.status === "active"
          ? chalk.yellow
          : chalk.gray;

    writeLine(
      `${chalk.bold(phase.title)} · ${statusColor(formatPSalesPhaseStatus(phase.status))}`,
    );
    writeLine(chalk.dim(`  ${phase.summary}`));
    phase.checkpoints.forEach((checkpoint) => writeLine(`  • ${checkpoint}`));
  });
}

async function runMenu(): Promise<void> {
  while (true) {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Mit szeretnél megnézni?",
        choices: [
          { name: "📊 Track státusz", value: "status" },
          { name: "🧭 Architektúra összefoglaló", value: "architecture" },
          { name: "📄 Intake és felmérés", value: "intake" },
          { name: "🔎 Kutatás és értékelés", value: "research" },
          { name: "🎯 Stratégia és approval", value: "strategy" },
          { name: "🚀 Végrehajtás és audit", value: "execution" },
          { name: "☁ Cloudflare opció", value: "cloudflare" },
          { name: "🪜 Phase roadmap", value: "roadmap" },
          { name: "❌ Kilépés", value: "exit" },
        ],
      },
    ]);

    if (action === "exit") {
      return;
    }

    if (action === "status") {
      printStatus();
    } else if (action === "architecture") {
      printArchitecture();
    } else if (action === "intake") {
      printIntake();
    } else if (action === "research") {
      printResearch();
    } else if (action === "strategy") {
      printStrategy();
    } else if (action === "execution") {
      printExecution();
    } else if (action === "cloudflare") {
      printCloudflareOption();
    } else if (action === "roadmap") {
      printPhaseRoadmap();
    }

    const { again } = await inquirer.prompt([
      {
        type: "confirm",
        name: "again",
        message: "Vissza a menübe?",
        default: true,
      },
    ]);

    if (!again) {
      return;
    }
  }
}

export async function propertySalesCommand(): Promise<void> {
  writeLine(
    boxen(chalk.blue.bold("🏢 Brunella Ingatlan Értékesítési Track"), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  await runMenu();
}
