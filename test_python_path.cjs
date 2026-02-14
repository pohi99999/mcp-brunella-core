const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

let pythonCmd = 'python';
const venvPath = path.resolve(process.cwd(), '.venv/bin/python');

if (fs.existsSync(venvPath)) {
    console.log('Using venv:', venvPath);
    pythonCmd = venvPath;
} else {
    try {
        execSync('python3 --version', { stdio: 'ignore' });
        console.log('Using python3');
        pythonCmd = 'python3';
    } catch (e) {
        console.log('Using fallback python');
    }
}
