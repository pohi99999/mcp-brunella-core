const path = require('path');
const { execSync } = require('child_process');

// Determine correct python command
let pythonCmd = 'python';
const venvPath = process.platform === 'win32'
  ? '.venv/Scripts/python.exe'
  : '.venv/bin/python';

if (require('fs').existsSync(venvPath)) {
    pythonCmd = venvPath;
} else {
    try {
        execSync('python3 --version', { stdio: 'ignore' });
        pythonCmd = 'python3';
    } catch (e) {
        // Fallback to 'python'
    }
}

console.log('Detected python:', pythonCmd);
