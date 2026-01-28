import fs from 'fs/promises';
import path from 'path';

const TOOLS_DIR = path.join(process.cwd(), 'src', 'tools');
const OUTPUT_FILE = path.join(process.cwd(), 'Toolskeszlet.md');

async function scanTools() {
    console.log('Scanning tools in', TOOLS_DIR);
    const files = await fs.readdir(TOOLS_DIR);
    const toolMap = {};

    for (const file of files) {
        if (!file.endsWith('.ts')) continue;
        const content = await fs.readFile(path.join(TOOLS_DIR, file), 'utf-8');
        
        // Regex to find tool definitions: server.tool("name", "description", ...)
        const toolRegex = /server\.tool\(\s*["']([^"']+)["'],\s*["']([^"']+)["']/g;
        let match;
        
        const tools = [];
        while ((match = toolRegex.exec(content)) !== null) {
            tools.push({
                name: match[1],
                description: match[2]
            });
        }

        if (tools.length > 0) {
            toolMap[file] = tools;
        }
    }
    return toolMap;
}

async function main() {
    const tools = await scanTools();
    let md = `# 🛠️ MCP Brunella Core - Eszközkészlet (Tool Inventory)

Ez a dokumentum a szerver által biztosított MCP eszközök (tools) automatikusan generált listája.
**Generálva:** ${new Date().toLocaleString('hu-HU')}

---

`;

    for (const [file, toolList] of Object.entries(tools)) {
        md += `## 📦 ${file.replace('.ts', '')}\n`;
        for (const tool of toolList) {
            md += `- **${tool.name}**: ${tool.description}\n`;
        }
        md += '\n';
    }

    // Add Manual Entries for Agents
    md += `## 🤖 Ágensek (Agents)
- **agent_list**: Aktív ágensek listázása.
- **agent_registry**: Minden elérhető ágens definíció.
- **agent_delegate**: Feladat delegálása egy ágensnek.

## 💻 Brunella CLI Parancsok
- **brunella conductor status**: Projekt státuszának megjelenítése.
- **brunella conductor setup**: Conductor infrastruktúra ellenőrzése.
- **brunella memory list/show/refresh**: Kontextus kezelés (mag.md).
- **brunella run <tool>**: MCP eszköz futtatása.
- **brunella chat**: Interaktív chat (Ollama).
- **brunella agents**: Ágensek listázása CLI-ből.
`;

    await fs.writeFile(OUTPUT_FILE, md, 'utf-8');
    console.log(`Done! Saved to ${OUTPUT_FILE}`);
}

main();