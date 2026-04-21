import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = 'F:/mcp-brunella-core';
const ARCHIVE_ROOT = path.join(WORKSPACE_ROOT, '_archive');

const CORE_DOCS = [
    'README.md',
    'Brunella.md',
    'konyvtarfa.md',
    'Toolskeszlet.md',
    'workflow.md',
    'AGENTS.md',
    'CHANGELOG.md',
    'CONDUCTOR_PLAN.md'
];

interface FileAction {
    path: string;
    action: 'keep' | 'merge' | 'archive' | 'delete';
    reason: string;
    destination?: string;
}

async function audit() {
    const report: FileAction[] = [];

    // 1. Root MD files audit
    const rootFiles = fs.readdirSync(WORKSPACE_ROOT);
    for (const file of rootFiles) {
        if (file.endsWith('.md')) {
            const fullPath = path.join(WORKSPACE_ROOT, file);
            if (CORE_DOCS.includes(file)) {
                report.push({ path: fullPath, action: 'keep', reason: 'Core system documentation' });
            } else if (file === 'GEMINI.md') {
                report.push({ path: fullPath, action: 'merge', reason: 'Contains system memory, should be in Brunella.md', destination: 'Brunella.md' });
            } else if (file.match(/^(terv|JELENTES|REPORT|szerver_log)/i)) {
                report.push({ path: fullPath, action: 'archive', reason: 'Temporal/Log file', destination: '_archive/logs/' });
            } else {
                report.push({ path: fullPath, action: 'archive', reason: 'Non-core documentation', destination: '_archive/docs/' });
            }
        }
    }

    // 2. _KNOWLEDGE_BASE audit (Deep scan)
    const kbPath = path.join(WORKSPACE_ROOT, '_KNOWLEDGE_BASE');
    if (fs.existsSync(kbPath)) {
        const kbFiles = fs.readdirSync(kbPath);
        for (const file of kbFiles) {
            const fullPath = path.join(kbPath, file);
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                if (file === '1_reports_and_outputs') {
                    report.push({ path: fullPath, action: 'archive', reason: 'Old reports archive', destination: '_archive/reports/' });
                } else {
                    report.push({ path: fullPath, action: 'keep', reason: 'Knowledge base category' });
                }
            }
        }
    }

    // 3. 01_AI_ML_Projects audit
    const projectsPath = path.join(WORKSPACE_ROOT, '01_AI_ML_Projects');
    if (fs.existsSync(projectsPath)) {
        report.push({ 
            path: projectsPath, 
            action: 'archive', 
            reason: 'External reference projects, moving out of main workspace', 
            destination: 'external_research/' 
        });
    }

    console.log(JSON.stringify(report, null, 2));
}

audit().catch(console.error);
