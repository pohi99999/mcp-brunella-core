"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const pythonShell_js_1 = require("../src/utils/pythonShell.js");
(0, node_test_1.describe)('Persistent Python Shell', () => {
    let shell;
    (0, node_test_1.before)(async () => {
        shell = new pythonShell_js_1.PythonShell();
        await shell.start();
    });
    (0, node_test_1.after)(() => {
        shell.stop();
    });
    (0, node_test_1.it)('should execute simple math', async () => {
        const result = await shell.execute('print(2 + 2)');
        node_assert_1.default.match(result, /4/);
    });
    (0, node_test_1.it)('should maintain state (variables)', async () => {
        await shell.execute('x = 42');
        const result = await shell.execute('print(x)');
        node_assert_1.default.match(result, /42/);
    });
    (0, node_test_1.it)('should handle multiple lines', async () => {
        const code = `
def greet(name):
    return f"Hello, {name}"

print(greet("Brunella"))
    `;
        const result = await shell.execute(code);
        node_assert_1.default.match(result, /Hello, Brunella/);
    });
    (0, node_test_1.it)('should handle errors gracefully', async () => {
        // Python syntax error handling
        // The shell streams output, so error might be in the result string
        const result = await shell.execute('print(undefined_variable)');
        node_assert_1.default.match(result, /NameError/);
    });
});
