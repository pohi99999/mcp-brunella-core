import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const LOG_DIR = path.join(ROOT, 'logs');
const CONDUCTOR_DIR = path.join(ROOT, 'conductor');

function checkFile(filePath, critical = false) {
    if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const mtime = stats.mtime.toLocaleString('hu-HU');
        return `✅ [OK] ${path.basename(filePath)} (Módosítva: ${mtime})`;
    }
    return critical ? `❌ [CRITICAL] HIÁNYZIK: ${filePath}` : `⚠️ [MISSING] ${filePath}`;
}

function tailLog(filePath, lines = 5) {
    if (!fs.existsSync(filePath)) return "   (Log fájl üres vagy hiányzik)";
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const allLines = content.split('\n').filter(l => l.trim().length > 0);
        return allLines.slice(-lines).map(l => `   > ${l}`).join('\n');
    } catch {
        return "   (Hiba a log olvasásakor)";
    }
}

function checkProcess(processName) {
    try {
        // Windows specific tasklist
        const stdout = execSync(`tasklist /FI "IMAGENAME eq ${processName}"`, { encoding: 'utf-8' });
        return stdout.includes(processName) ? `✅ FUT: ${processName}` : `❌ ÁLL: ${processName}`;
    } catch {
        return `❓ ISMERETLEN: ${processName}`;
    }
}

console.log("# 🏥 Rendszer Diagnosztika (Conductor Check)\n");

console.log("## 1. Kritikus Fájlok");
console.log(checkFile(path.join(ROOT, 'mag.md'), true));
console.log(checkFile(path.join(ROOT, 'konyvtarfa.md'), true));
console.log(checkFile(path.join(ROOT, 'Toolskeszlet.md'), true));
console.log(checkFile(path.join(CONDUCTOR_DIR, 'tracks.md'), true));
console.log(checkFile(path.join(CONDUCTOR_DIR, 'workflow.md'), true));

console.log("\n## 2. Aktív Folyamatok");
console.log(checkProcess('ollama app.exe'));
console.log(checkProcess('node.exe')); // MCP Szerver
console.log(checkProcess('AnythingLLM.exe'));

console.log("\n## 3. Legfrissebb Naplók");
console.log("**Szerver Log (utolsó 3 sor):**");
console.log(tailLog(path.join(ROOT, 'szerver_log.md'), 3));

console.log("\n**Agent Manager Log (utolsó 3 sor):**");
console.log(tailLog(path.join(LOG_DIR, 'agent-manager.log'), 3));

console.log("\n**Adat Refiner Log (utolsó 3 sor):**");
console.log(tailLog(path.join(LOG_DIR, 'data_refiner.log'), 3));

console.log("\n## 4. Aktív Track Állapot");
try {
    const tracks = fs.readFileSync(path.join(CONDUCTOR_DIR, 'tracks.md'), 'utf-8');
    const activeSection = tracks.split('### 🔧 Aktív Szálak')[1]?.split('---')[0];
    if (activeSection && activeSection.includes('- [')) {
        console.log(activeSection.trim());
    } else {
        console.log("ℹ️ Nincs aktív szál.");
    }
} catch {
    console.log("⚠️ Nem olvasható a tracks.md");
}
