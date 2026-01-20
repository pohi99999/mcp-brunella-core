import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const logsDir = path.join(projectRoot, 'logs');

const filesToCheck = [
    'web_ui.log',
    'agent-manager.log',
    'brunella.db'
];

const status = {
    timestamp: new Date().toISOString(),
    status: 'ok',
    environment: {
        node_modules: fs.existsSync(path.join(projectRoot, 'node_modules')),
        venv: fs.existsSync(path.join(projectRoot, '.venv')),
    },
    logs: {}
};

if (!fs.existsSync(logsDir)) {
    status.status = 'warning';
    status.message = 'logs directory missing';
} else {
    filesToCheck.forEach(file => {
        const filePath = path.join(logsDir, file);
        if (fs.existsSync(filePath)) {
            status.logs[file] = 'exists';
        } else {
            status.logs[file] = 'missing';
            // We don't fail the whole check for missing logs, as they might be created on runtime
        }
    });
}

console.log(JSON.stringify(status, null, 2));