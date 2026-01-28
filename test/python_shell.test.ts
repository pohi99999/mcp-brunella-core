import { describe, it, after, before } from 'node:test';
import assert from 'node:assert';
import { PythonShell } from '../src/utils/pythonShell.js';

describe('Persistent Python Shell', () => {
    let shell: PythonShell;

    before(async () => {
        shell = new PythonShell();
        await shell.start();
    });

    after(() => {
        shell.stop();
    });

    it('should execute simple math', async () => {
        const result = await shell.execute('print(2 + 2)');
        assert.match(result, /4/);
    });

    it('should maintain state (variables)', async () => {
        await shell.execute('x = 42');
        const result = await shell.execute('print(x)');
        assert.match(result, /42/);
    });

    it('should handle multiple lines', async () => {
        const code = `
def greet(name):
    return f"Hello, {name}"

print(greet("Brunella"))
    `;
        const result = await shell.execute(code);
        assert.match(result, /Hello, Brunella/);
    });

    it('should handle errors gracefully', async () => {
        // Python syntax error handling
        // The shell streams output, so error might be in the result string
        const result = await shell.execute('print(undefined_variable)');
        assert.match(result, /NameError/);
    });
});
