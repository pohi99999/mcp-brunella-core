"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const registry_1 = require("../src/cli/tools/registry");
require("../src/cli/tools/fs_tools");
const assert = __importStar(require("assert"));
const path = __importStar(require("path"));
async function testTools() {
    console.log('Testing CLI Tools...');
    console.log('Current Working Directory:', process.cwd());
    // Test List Tools
    const tools = registry_1.toolRegistry.listTools();
    console.log('Registered tools:', tools.map(t => t.name));
    assert.ok(tools.find(t => t.name === 'list_directory'), 'list_directory tool missing');
    assert.ok(tools.find(t => t.name === 'read_file'), 'read_file tool missing');
    // Test execute list_directory with absolute path to project root
    const projectRoot = path.resolve(__dirname, '..');
    const files = await registry_1.toolRegistry.executeTool('list_directory', { dirPath: projectRoot });
    console.log(`Files in ${projectRoot}:`, files.slice(0, 5), '...');
    assert.ok(Array.isArray(files), 'list_directory should return an array');
    assert.ok(files.includes('package.json'), 'package.json should be in the list');
    // Test execute read_file
    const pkgPath = path.join(projectRoot, 'package.json');
    const content = await registry_1.toolRegistry.executeTool('read_file', { filePath: pkgPath });
    const pkg = JSON.parse(content);
    console.log('Package name:', pkg.name);
    assert.strictEqual(pkg.name, 'mcp-brunella-core', 'Wrong package name read');
    console.log('ALL CLI TOOLS TESTS PASSED');
}
testTools().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
