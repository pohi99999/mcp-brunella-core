import { toolRegistry } from '../src/cli/tools/registry';
import '../src/cli/tools/fs_tools';
import * as assert from 'assert';
import * as path from 'path';

async function testTools() {
    console.log('Testing CLI Tools...');
    console.log('Current Working Directory:', process.cwd());

    // Test List Tools
    const tools = toolRegistry.listTools();
    console.log('Registered tools:', tools.map(t => t.name));
    assert.ok(tools.find(t => t.name === 'list_directory'), 'list_directory tool missing');
    assert.ok(tools.find(t => t.name === 'read_file'), 'read_file tool missing');

    // Test execute list_directory with absolute path to project root
    const projectRoot = path.resolve(__dirname, '..');
    const files = await toolRegistry.executeTool('list_directory', { dirPath: projectRoot });
    console.log(`Files in ${projectRoot}:`, files.slice(0, 5), '...');
    assert.ok(Array.isArray(files), 'list_directory should return an array');
    assert.ok(files.includes('package.json'), 'package.json should be in the list');

    // Test execute read_file
    const pkgPath = path.join(projectRoot, 'package.json');
    const content = await toolRegistry.executeTool('read_file', { filePath: pkgPath });
    const pkg = JSON.parse(content);
    console.log('Package name:', pkg.name);
    assert.strictEqual(pkg.name, 'mcp-brunella-core', 'Wrong package name read');

    console.log('ALL CLI TOOLS TESTS PASSED');
}

testTools().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
