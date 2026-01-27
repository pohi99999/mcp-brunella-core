import fs from 'fs';
import path from 'path';
import { toolRegistry } from './registry.js';

// List Directory Tool
toolRegistry.registerTool({
    name: 'list_directory',
    description: 'Lists files in a directory',
    inputSchema: {
        type: 'object',
        properties: {
            dirPath: { type: 'string', description: 'Directory path (relative to cwd)' }
        }
    },
    execute: async ({ dirPath = '.' }) => {
        const fullPath = path.resolve(process.cwd(), dirPath);
        return fs.readdirSync(fullPath);
    }
});

// Read File Tool
toolRegistry.registerTool({
    name: 'read_file',
    description: 'Reads the content of a file',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'File path (relative to cwd)' }
        },
        required: ['filePath']
    },
    execute: async ({ filePath }) => {
        const fullPath = path.resolve(process.cwd(), filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error(`File not found: ${filePath}`);
        }
        return fs.readFileSync(fullPath, 'utf-8');
    }
});

// Write File Tool
toolRegistry.registerTool({
    name: 'write_file',
    description: 'Writes content to a file',
    inputSchema: {
        type: 'object',
        properties: {
            filePath: { type: 'string', description: 'File path (relative to cwd)' },
            content: { type: 'string', description: 'File content' }
        },
        required: ['filePath', 'content']
    },
    execute: async ({ filePath, content }) => {
        const fullPath = path.resolve(process.cwd(), filePath);
        const dirPath = path.dirname(fullPath);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(fullPath, content, 'utf-8');
        return `Successfully wrote to ${filePath}`;
    }
});
