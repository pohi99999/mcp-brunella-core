import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Színes kimenet
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    bold: "\x1b[1m"
};

// Mit hagyjunk figyelmen kívül
const IGNORE_DIRS = [
    'node_modules',
    '.git',
    'build',
    'dist',
    '.next',
    'coverage',
    '.ai', // Logok
    'external_research' // Külső kódok
];

const IGNORE_FILES = [
    'package-lock.json',
    'yarn.lock',
    '.env.example',
    'security_check.mjs', // Saját maga
    'uv.lock'
];

// Mit keresünk (Regex minták)
const PATTERNS = [
    { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{48}/ },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/ },
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
    { name: 'Generic Secret', regex: /(api_key|files_api_key|access_token|secret_key)[\s]*[:=][\s]*['"][a-zA-Z0-9_\-]{8,}['"]/i },
    { name: 'Hardcoded ENV', regex: /process\.env\.[A-Z_]+[\s]*=[\s]*['"][^'"]+['"]/ }
];

let issuesFound = 0;

function scanFile(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');

        // Gyors ellenőrzés: .env fájlokban ne legyen valódi érték, ha nem a .env.local/gitignored
        const filename = path.basename(filePath);

        // Ellenőrzés soronként
        const lines = content.split('\n');
        lines.forEach((line, index) => {
            // Túl hosszú sorokat (pl. minified kód) hagyjunk ki
            if (line.length > 500) return;

            PATTERNS.forEach(pattern => {
                if (pattern.regex.test(line)) {
                    // Kivételek (pl. placeholder szövegek)
                    if (line.includes('your-api-key') || line.includes('<API_KEY>') || line.includes('XXXXXXXX')) return;

                    console.log(`${colors.red}[VESZÉLY] ${pattern.name} gyanú:${colors.reset}`);
                    console.log(`  Fájl: ${colors.cyan}${path.relative(PROJECT_ROOT, filePath)}${colors.reset}:${colors.yellow}${index + 1}${colors.reset}`);
                    console.log(`  Tartalom: ${line.trim().substring(0, 80)}...`);
                    console.log('---');
                    issuesFound++;
                }
            });
        });

    } catch (err) {
        // Binary files or read errors ignored
    }
}

function scanDirectory(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            if (!IGNORE_DIRS.includes(file)) {
                scanDirectory(fullPath);
            }
        } else {
            if (!IGNORE_FILES.includes(file) && !file.endsWith('.png') && !file.endsWith('.jpg') && !file.endsWith('.ico')) {
                scanFile(fullPath);
            }
        }
    });
}

console.log(`${colors.bold}${colors.cyan}🛡️  Brunella Biztonsági Őr - Kódvizsgálat Indítása... 🛡️${colors.reset}\n`);
scanDirectory(PROJECT_ROOT);

if (issuesFound > 0) {
    console.log(`\n${colors.red}${colors.bold}❌ Vizsgálat kész: ${issuesFound} potenciális biztonsági kockázatot találtam!${colors.reset}`);
    console.log(`${colors.yellow}Kérlek ellenőrizd a fenti fájlokat és távolítsd el az érzékeny adatokat!${colors.reset}`);
    process.exit(1); // Hiba kód
} else {
    console.log(`\n${colors.green}${colors.bold}✅ Vizsgálat kész: Nem találtam érzékeny adatot. A kód tiszta.${colors.reset}`);
    process.exit(0);
}
