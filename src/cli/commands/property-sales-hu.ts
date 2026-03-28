import inquirer from "inquirer";
import chalk from "chalk";
import boxen from "boxen";
import { pSalesTrack, formatPSalesPhaseStatus } from "../../data/pSalesTrack.js";

function printStatus(): void {
  console.log(
    boxen(chalk.cyan.bold("🏢 P-Sales20260327"), {
      padding: 1,
      margin: 1,
      borderStyle: "double",
      borderColor: "cyan",
    }),
  );

  console.log(chalk.bold("Státusz:"), `${pSalesTrack.status.toUpperCase()} · ${pSalesTrack.progress}%`);
  console.log(chalk.bold("Fókusz:"), pSalesTrack.currentFocus);
  console.log(chalk.bold("Következő lépés:"), pSalesTrack.nextReadyStep);
  console.log(chalk.bold("Architektúra:"), pSalesTrack.architectureDoc);
  console.log(chalk.cyan("\nSzállítási modellek:"));
  pSalesTrack.surfaces.forEach((surface) => console.log(`  • ${surface}`));
}

function printArchitecture(): void {
  console.log(chalk.cyan.bold("\nArchitektúra összefoglaló"));
  console.log(chalk.dim("Phase 0 output: shared core + enterprise + standalone + Cloudflare opciók."));

  console.log(chalk.cyan("\nÜgynöki szerepkörök:"));
  pSalesTrack.agents.forEach((agent) => console.log(`  • ${agent}`));

  console.log(chalk.cyan("\nCloudflare opciók:"));
  pSalesTrack.cloudflare.forEach((item) => console.log(`  • ${item}`));
}

function printIntake(): void {
  console.log(chalk.cyan.bold("\nIntake és felmérés"));
  console.log(chalk.dim("Dokumentumfeltöltés → hiánylista → felmérő ügynök kérdések → intake státusz."));

  console.log(chalk.cyan("\nDokumentum-csomag:"));
  pSalesTrack.intake.documentBuckets.forEach((bucket) => {
    console.log(chalk.bold(`  • ${bucket.title}`));
    bucket.examples.forEach((example) => console.log(`    - ${example}`));
  });

  console.log(chalk.cyan("\nFelmérő kérdések:"));
  pSalesTrack.intake.surveyQuestions.forEach((question, index) => {
    console.log(`  ${index + 1}. ${question}`);
  });

  console.log(chalk.cyan("\nVárt outputok:"));
  pSalesTrack.intake.outputs.forEach((output) => console.log(`  • ${output}`));
}

function printResearch(): void {
  console.log(chalk.cyan.bold("\nKutatási és értékelési modell"));
  console.log(chalk.dim("Piaci komparátok → értéktartomány → riport → stratégiai átadás."));

  console.log(chalk.cyan("\nForrástípusok:"));
  pSalesTrack.research.sourceTypes.forEach((sourceType) => console.log(`  • ${sourceType}`));

  console.log(chalk.cyan("\nKomparálási kritériumok:"));
  pSalesTrack.research.comparableCriteria.forEach((criterion, index) => {
    console.log(`  ${index + 1}. ${criterion}`);
  });

  console.log(chalk.cyan("\nÉrtéktartomány outputok:"));
  pSalesTrack.research.valuationOutputs.forEach((output) => console.log(`  • ${output}`));

  console.log(chalk.cyan("\nKockázati jelzések:"));
  pSalesTrack.research.riskFlags.forEach((risk) => console.log(`  • ${risk}`));

  console.log(chalk.cyan("\nRiport szekciók:"));
  pSalesTrack.research.reportSections.forEach((section) => console.log(`  • ${section}`));
}

function printStrategy(): void {
  console.log(chalk.cyan.bold("\nStratégia és approval"));
  console.log(chalk.dim("Kutatási eredmény → csatorna-mix → jóváhagyás → végrehajtási irány."));

  console.log(chalk.cyan("\nCsatorna-ajánlatok:"));
  pSalesTrack.strategy.channelOptions.forEach((channel) => console.log(`  • ${channel}`));

  console.log(chalk.cyan("\nCélcsoport és döntéshozók:"));
  pSalesTrack.strategy.targetSegments.forEach((segment, index) => {
    console.log(`  ${index + 1}. ${segment}`);
  });

  console.log(chalk.cyan("\nJóváhagyási lépések:"));
  pSalesTrack.strategy.approvalSteps.forEach((step) => console.log(`  • ${step}`));

  console.log(chalk.cyan("\nKimeneti fókuszok:"));
  pSalesTrack.strategy.executionPaths.forEach((path) => console.log(`  • ${path}`));

  console.log(chalk.cyan("\nRiport szekciók:"));
  pSalesTrack.strategy.reportSections.forEach((section) => console.log(`  • ${section}`));

  console.log(chalk.cyan("\nKérdések az approval előtt:"));
  pSalesTrack.strategy.questions.forEach((question, index) => {
    console.log(`  ${index + 1}. ${question}`);
  });
}

function printExecution(): void {
  console.log(chalk.cyan.bold("\nVégrehajtás és audit"));
  console.log(chalk.dim("Jóváhagyott terv → csatornánkénti futtatás → audit → visszajelzés."));

  console.log(chalk.cyan("\nVégrehajtási módok:"));
  pSalesTrack.execution.executionModes.forEach((mode) => console.log(`  • ${mode}`));

  console.log(chalk.cyan("\nMérföldkövek:"));
  pSalesTrack.execution.statusMilestones.forEach((milestone, index) => {
    console.log(`  ${index + 1}. ${milestone}`);
  });

  console.log(chalk.cyan("\nVisszajelzési pontok:"));
  pSalesTrack.execution.feedbackLoops.forEach((loop) => console.log(`  • ${loop}`));

  console.log(chalk.cyan("\nAudit napló:"));
  pSalesTrack.execution.auditTrail.forEach((entry) => console.log(`  • ${entry}`));

  console.log(chalk.cyan("\nRiport szekciók:"));
  pSalesTrack.execution.reportSections.forEach((section) => console.log(`  • ${section}`));

  console.log(chalk.cyan("\nKérdések a zárás előtt:"));
  pSalesTrack.execution.questions.forEach((question, index) => {
    console.log(`  ${index + 1}. ${question}`);
  });
}

function printCloudflareOption(): void {
  console.log(chalk.cyan.bold("\nCloudflare delivery opció"));
  console.log(chalk.dim(pSalesTrack.cloudflareDecision.recommendedPath));

  console.log(chalk.cyan("\nStorage és state:"));
  pSalesTrack.cloudflareDecision.storageOptions.forEach((option) => console.log(`  • ${option}`));

  console.log(chalk.cyan("\nRuntime és hosting:"));
  pSalesTrack.cloudflareDecision.runtimeOptions.forEach((option) => console.log(`  • ${option}`));
  pSalesTrack.cloudflareDecision.hostingOptions.forEach((option) => console.log(`  • ${option}`));

  console.log(chalk.cyan("\nDöntési szempontok:"));
  pSalesTrack.cloudflareDecision.decisionCriteria.forEach((criterion, index) => {
    console.log(`  ${index + 1}. ${criterion}`);
  });

  console.log(chalk.cyan("\nNyitott kérdések:"));
  pSalesTrack.cloudflareDecision.openQuestions.forEach((question, index) => {
    console.log(`  ${index + 1}. ${question}`);
  });

  console.log(chalk.cyan("\nGyors opciók:"));
  pSalesTrack.cloudflare.forEach((option) => console.log(`  • ${option}`));
}

function printPhaseRoadmap(): void {
  console.log(chalk.cyan.bold("\nPhase roadmap"));
  pSalesTrack.phases.forEach((phase) => {
    const statusColor =
      phase.status === "completed"
        ? chalk.green
        : phase.status === "active"
          ? chalk.yellow
          : chalk.gray;

    console.log(
      `${chalk.bold(phase.title)} · ${statusColor(formatPSalesPhaseStatus(phase.status))}`,
    );
    console.log(chalk.dim(`  ${phase.summary}`));
    phase.checkpoints.forEach((checkpoint) => console.log(`  • ${checkpoint}`));
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
  console.log(
    boxen(chalk.blue.bold("🏢 Brunella Ingatlan Értékesítési Track"), {
      padding: 1,
      margin: 1,
      borderStyle: "round",
      borderColor: "blue",
    }),
  );

  await runMenu();
}
