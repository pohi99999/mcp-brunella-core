"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const memory_1 = require("../src/cli/memory");
const python_bridge_1 = require("../src/cli/python_bridge");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const assert_1 = __importDefault(require("assert"));
// Mock Memory Test
const GEMINI_DIR = path_1.default.join(os_1.default.homedir(), '.gemini');
const MEMORY_FILE = path_1.default.join(GEMINI_DIR, 'cli_memory.json');
console.log('Testing MemoryManager...');
// Backup existing memory if any
let backupMemory = null;
if (fs_1.default.existsSync(MEMORY_FILE)) {
    backupMemory = fs_1.default.readFileSync(MEMORY_FILE, 'utf-8');
}
try {
    const memory = new memory_1.MemoryManager();
    memory.set('mode', 'safe');
    assert_1.default.strictEqual(memory.get('mode'), 'safe', 'Mode should be safe');
    // Reload to test persistence
    const memory2 = new memory_1.MemoryManager();
    assert_1.default.strictEqual(memory2.get('mode'), 'safe', 'Mode should persist');
    console.log('MemoryManager test passed.');
}
catch (e) {
    console.error('MemoryManager test failed:', e);
    process.exit(1);
}
finally {
    // Restore backup
    if (backupMemory) {
        fs_1.default.writeFileSync(MEMORY_FILE, backupMemory);
    }
    else if (fs_1.default.existsSync(MEMORY_FILE)) {
        fs_1.default.unlinkSync(MEMORY_FILE);
    }
}
console.log('Testing PythonBridge...');
try {
    const bridge = new python_bridge_1.PythonBridge();
    const pythonPath = bridge.getPythonPath();
    console.log(`Python path found: ${pythonPath}`);
    assert_1.default.ok(fs_1.default.existsSync(pythonPath), 'Python executable should exist');
    console.log('PythonBridge test passed.');
}
catch (e) {
    console.error('PythonBridge test failed:', e);
    process.exit(1);
}
