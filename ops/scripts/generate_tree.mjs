import fs from 'fs/promises';
import path from 'path';

const ROOT_DIR = process.cwd();
const OUTPUT_FILE = path.join(ROOT_DIR, 'konyvtarfa.md');

const IGNORE_DIRS = [
    'node_modules', '.git', '.venv', 'build', 'test_build', '.vscode', '.vs', 
    '.cursor', '.gemini', '.pytest_cache', '.qodo', 'logs', 'coverage'
];

const IGNORE_FILES = [
    'package-lock.json', 'uv.lock', '.DS_Store', 'Thumbs.db', '.gitignore', '.python-version'
];

async function getFolderDescription(dirPath) {
    try {
        const readmePath = path.join(dirPath, 'README.md');
        const pkgPath = path.join(dirPath, 'package.json');
        
        // Try package.json description first
        try {
            const pkgContent = await fs.readFile(pkgPath, 'utf-8');
            const pkg = JSON.parse(pkgContent);
            if (pkg.description) return pkg.description;
        } catch {} // Ignore errors if package.json or description is missing

        // Try README title
        try {
            const readmeContent = await fs.readFile(readmePath, 'utf-8');
            const match = readmeContent.match(/^#\s+(.+)$/m);
            if (match) return match[1].trim();
        } catch {} // Ignore errors if README.md or title is missing
        
        return '';
    } catch (e) {
        console.error(`Error getting folder description for ${dirPath}:`, e);
        return '';
    }
}

async function scanDir(currentPath, depth = 0) {
    const indent = '  '.repeat(depth);
    const name = path.basename(currentPath);
    let output = '';

    if (depth > 0) { // Don't print root
        let desc = await getFolderDescription(currentPath);
        if (desc) desc = ` _(${desc})_`;
        output += `${indent}- 📂 **${name}**${desc}\n`;
    }

    try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });
        
        // Sort: directories first, then files
        entries.sort((a, b) => {
            if (a.isDirectory() && !b.isDirectory()) return -1;
            if (!a.isDirectory() && b.isDirectory()) return 1;
            return a.name.localeCompare(b.name);
        });

        for (const entry of entries) {
            if (entry.name.startsWith('.')) continue; // Skip hidden files mostly
            if (entry.isDirectory()) {
                if (IGNORE_DIRS.includes(entry.name)) continue;
                output += await scanDir(path.join(currentPath, entry.name), depth + 1);
            } else {
                if (IGNORE_FILES.includes(entry.name)) continue;
                // Only list important files in root or specific folders to avoid clutter
                // For now, list all non-ignored files
                output += `${indent}  - 📄 ${entry.name}\n`;
            }
        }
    } catch (e) {
        output += `${indent}  - ⚠️ Error reading directory: ${e.message}\n`;
    }
    return output;
}

async function main() {
    console.log('Generating konyvtarfa.md...');
    const header = `# 🌳 MCP Brunella Core - Könyvtárfa (File Tree)

Ez a dokumentum a projekt aktuális fájlszerkezetét és a könyvtárak tartalmának rövid leírását tartalmazza.
**Generálva:** ${new Date().toLocaleString('hu-HU')}
**Script:** 

---\n\n`;

    const tree = await scanDir(ROOT_DIR);
    await fs.writeFile(OUTPUT_FILE, header + tree, 'utf-8');
    console.log(`Done! Saved to ${OUTPUT_FILE}`);
}

main();