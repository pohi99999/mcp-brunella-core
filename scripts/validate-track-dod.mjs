import { validateStagedTrackClosures } from './lib/trackAudit.mjs';

const stagedMode = process.argv.includes('--staged');
if (!stagedMode) {
  console.error('Usage: node scripts/validate-track-dod.mjs --staged');
  process.exit(1);
}

const result = validateStagedTrackClosures({ repoRoot: process.cwd() });

if (result.issues.length === 0) {
  if (result.tracks.length > 0) {
    console.log(`Track DoD guard OK for: ${result.tracks.join(', ')}`);
  }
  process.exit(0);
}

console.error('Track DoD validation failed:');
for (const issue of result.issues) {
  console.error(`- ${issue}`);
}
process.exit(1);
