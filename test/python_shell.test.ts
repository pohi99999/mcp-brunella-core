import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { config } from '../src/config/index.js';
import { PythonShell } from '../src/utils/pythonShell.js';

const venvPy = path.resolve(config.workspaceRoot, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
const hasPython = fs.existsSync(venvPy);
const suite = hasPython ? describe : describe.skip;

suite('PythonShell', () => {
    const shell = new PythonShell('interactive.py');

    it('should execute simple code via run()', async () => {
        const result = await shell.run('print(2 + 2)');
        assert.match(result, /4/);
    });

    it('should handle multi-line code', async () => {
        const code = `
def greet(name):
    return f"Hello, {name}"
print(greet("Brunella"))
`;
        const result = await shell.run(code);
        assert.match(result, /Hello, Brunella/);
    });

    it('should return error payload on Python exception', async () => {
        const result = await shell.run('print(undefined_variable)');
        const hasError = /error|NameError|undefined_variable/i.test(result);
        assert.ok(hasError, `Expected error info in result: ${result}`);
    });
});
