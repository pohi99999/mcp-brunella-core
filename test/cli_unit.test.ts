import { MemoryManager } from '../src/cli/memory.js';
import { PythonBridge } from '../src/cli/python_bridge.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import assert from 'assert';

// Mock Memory Test
const GEMINI_DIR = path.join(os.homedir(), '.gemini');
const MEMORY_FILE = path.join(GEMINI_DIR, 'cli_memory.json');

console.log('Testing MemoryManager...');
// Backup existing memory if any
let backupMemory: string | null = null;
if (fs.existsSync(MEMORY_FILE)) {
    backupMemory = fs.readFileSync(MEMORY_FILE, 'utf-8');
}

try {
    const memory = new MemoryManager();
    memory.set('mode', 'safe');
    assert.strictEqual(memory.get('mode'), 'safe', 'Mode should be safe');
    
    // Reload to test persistence
    const memory2 = new MemoryManager();
    assert.strictEqual(memory2.get('mode'), 'safe', 'Mode should persist');
    
    console.log('MemoryManager test passed.');
} catch (e) {
    console.error('MemoryManager test failed:', e);
    process.exit(1);
} finally {
    // Restore backup
    if (backupMemory) {
        fs.writeFileSync(MEMORY_FILE, backupMemory);
    } else if (fs.existsSync(MEMORY_FILE)) {
        fs.unlinkSync(MEMORY_FILE);
    }
}

console.log('Testing PythonBridge...');
try {
    const bridge = new PythonBridge();
    const pythonPath = bridge.getPythonPath();
    console.log(`Python path found: ${pythonPath}`);
    assert.ok(fs.existsSync(pythonPath), 'Python executable should exist');
    console.log('PythonBridge test passed.');
} catch (e) {
    console.error('PythonBridge test failed:', e);
    process.exit(1);
}
