// scripts/sync/precommit-track-guard.mts
// Ellenőrzi: minden módosított src/ fájl mögött van-e aktív track
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

try {
  // 1. Megszerezzük a módosított TypeScript forrásfájlokat
  const changed = execSync('git diff --cached --name-only').toString().split('\n').filter(Boolean);
  const srcFiles = changed.filter(f => f.startsWith('src/') && (f.endsWith('.ts') || f.endsWith('.tsx')));

  if (srcFiles.length === 0) {
    console.log('✅ Track guard: Nincs forráskód módosítás, átlépés.');
    process.exit(0);
  }

  // 2. Ellenőrizzük az aktív trackeket a registry-ben
  const tracksPath = path.join(process.cwd(), 'conductor/tracks.md');
  if (!fs.existsSync(tracksPath)) {
    console.error('❌ EPP v2: A tracks.md fájl nem található!');
    process.exit(1);
  }

  const tracksRaw = fs.readFileSync(tracksPath, 'utf8');
  
  // Keressük az aktív trackeket ( [~] jelölés a BAS konvenció szerint)
  const activeTracks = tracksRaw.match(/- [~] **Track:/g) || 
                       tracksRaw.match(/## [~] Track:/g) ||
                       tracksRaw.match(/- [~] **.+**/g); // Általánosabb illeszkedés

  if (!activeTracks || activeTracks.length === 0) {
    console.error('\n' + '!'.repeat(80));
    console.error('❌ EPP v2 KRITIKUS HIBA: Nincs aktív track ([~]) a conductor/tracks.md-ben!');
    console.error('Minden forráskód módosításhoz (src/) kötelező egy aktív fejlesztési szál.');
    console.error('Indíts egyet: brunella tracks generate "Feladat leírása"');
    console.error('!'.repeat(80) + '\n');
    process.exit(1);
  }

  console.log(`✅ Track guard: OK (${activeTracks.length} aktív track észlelve)`);
  process.exit(0);
} catch (error) {
  console.error('❌ Track guard hiba:', error instanceof Error ? error.message : String(error));
  process.exit(1);
}
