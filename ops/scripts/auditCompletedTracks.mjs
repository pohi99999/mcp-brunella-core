import fs from 'node:fs';
import path from 'node:path';
import { auditTrackRepository } from './lib/trackAudit.mjs';

const args = new Set(process.argv.slice(2));
const jsonMode = args.has('--json');
const outputFlagIndex = process.argv.indexOf('--output');
const outputPath = outputFlagIndex >= 0 ? process.argv[outputFlagIndex + 1] : null;

const report = auditTrackRepository({ repoRoot: process.cwd() });

if (outputPath) {
  const absoluteOutput = path.resolve(process.cwd(), outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, JSON.stringify(report, null, 2), 'utf-8');
}

if (jsonMode) {
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} else {
  console.log(
    [
      `Track audit generated at ${report.generatedAt}`,
      `Closed tracks scanned: ${report.summary.totalClosedTracks}`,
      `Failing tracks: ${report.summary.failingTracks}`,
      `Warning-only tracks: ${report.summary.warningTracks}`,
    ].join('\n'),
  );

  for (const track of report.tracks.filter((item) => item.issues.length > 0)) {
    console.log(`\n[FAIL] ${track.id} (${track.relativePath})`);
    for (const issue of track.issues) {
      console.log(`  - ${issue}`);
    }
  }
}

if (report.summary.failingTracks > 0) {
  process.exit(1);
}
