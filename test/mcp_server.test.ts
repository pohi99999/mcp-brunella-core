import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MCPFilesystemServer } from '../src/server/mcp_server.js';
import fs from 'fs';
import path from 'path';

describe('MCP Filesystem Server', () => {
  let server: MCPFilesystemServer;
  const testDataDir = path.resolve('data/test_mcp_server');
  const testFile = path.join(testDataDir, 'test_file.txt');
  const testFileContent = 'Hello MCP Server!';

  beforeEach(() => {
    server = new MCPFilesystemServer();

    // Create test directory
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }

    // Create test file
    fs.writeFileSync(testFile, testFileContent, 'utf-8');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    // Clean audit log with error handling
    const auditLogPath = path.resolve('logs/mcp_audit.log');
    if (fs.existsSync(auditLogPath)) {
      try {
        fs.unlinkSync(auditLogPath);
      } catch (err) {
        // Ignore file deletion errors (file may be in use)
        console.debug('Could not delete audit log:', err);
      }
    }
  });

  describe('read_file tool', () => {
    it('should read file content successfully', async () => {
      const result = await (server as any).handleReadFile({ path: testFile });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.content).toBe(testFileContent);
      expect(responseData.path).toBe(testFile);
    });

    it('should return file metadata (size, modified)', async () => {
      const result = await (server as any).handleReadFile({ path: testFile });
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.size).toBeGreaterThan(0);
      expect(responseData.modified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should throw error for non-existent file', async () => {
      const nonExistentFile = path.join(testDataDir, 'does_not_exist.txt');

      await expect((server as any).handleReadFile({ path: nonExistentFile }))
        .rejects.toThrow('File not found');
    });

    it('should throw error for access outside Safe Zone', async () => {
      const outsideFile = path.resolve('../../etc/passwd');

      await expect((server as any).handleReadFile({ path: outsideFile }))
        .rejects.toThrow('Access denied');
    });

    it('should throw error for blacklisted files', async () => {
      const envFile = path.resolve('.env');

      await expect((server as any).handleReadFile({ path: envFile }))
        .rejects.toThrow('Access denied');
    });
  });

  describe('write_file tool', () => {
    it('should write file content successfully', async () => {
      const newFile = path.join(testDataDir, 'new_file.txt');
      const newContent = 'New content from MCP!';

      const result = await (server as any).handleWriteFile({
        path: newFile,
        content: newContent
      });

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);
      expect(responseData.path).toBe(newFile);
      expect(responseData.bytes_written).toBe(Buffer.byteLength(newContent, 'utf-8'));

      // Verify file was actually written
      const writtenContent = fs.readFileSync(newFile, 'utf-8');
      expect(writtenContent).toBe(newContent);
    });

    it('should create parent directories if create_dirs is true', async () => {
      const nestedFile = path.join(testDataDir, 'subdir', 'nested', 'file.txt');

      const result = await (server as any).handleWriteFile({
        path: nestedFile,
        content: 'Nested content',
        create_dirs: true
      });

      const responseData = JSON.parse(result.content[0].text);
      expect(responseData.success).toBe(true);

      // Verify directories and file were created
      expect(fs.existsSync(path.dirname(nestedFile))).toBe(true);
      expect(fs.existsSync(nestedFile)).toBe(true);
    });

    it('should overwrite existing file', async () => {
      const overwriteContent = 'Overwritten content!';

      await (server as any).handleWriteFile({
        path: testFile,
        content: overwriteContent
      });

      const readContent = fs.readFileSync(testFile, 'utf-8');
      expect(readContent).toBe(overwriteContent);
    });

    it('should throw error for access outside Safe Zone', async () => {
      const outsideFile = path.resolve('../../tmp/malicious.txt');

      await expect((server as any).handleWriteFile({
        path: outsideFile,
        content: 'malicious'
      })).rejects.toThrow('Access denied');
    });

    it('should throw error for blacklisted files', async () => {
      const envFile = path.resolve('.env');

      await expect((server as any).handleWriteFile({
        path: envFile,
        content: 'API_KEY=stolen'
      })).rejects.toThrow('Access denied');
    });
  });

  describe('list_directory tool', () => {
    beforeEach(() => {
      // Create additional test files
      fs.writeFileSync(path.join(testDataDir, 'file1.txt'), 'Content 1');
      fs.writeFileSync(path.join(testDataDir, 'file2.json'), '{"key": "value"}');
      fs.mkdirSync(path.join(testDataDir, 'subdir'));
      fs.writeFileSync(path.join(testDataDir, '.hidden'), 'Hidden file');
    });

    it('should list directory contents', async () => {
      const result = await (server as any).handleListDirectory({ path: testDataDir });
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.success).toBe(true);
      expect(responseData.items).toBeDefined();
      expect(responseData.items.length).toBeGreaterThan(0);

      // Check for expected items (excluding hidden by default)
      const fileNames = responseData.items.map((item: any) => item.name);
      expect(fileNames).toContain('file1.txt');
      expect(fileNames).toContain('file2.json');
      expect(fileNames).toContain('subdir');
    });

    it('should include file metadata (type, size, modified)', async () => {
      const result = await (server as any).handleListDirectory({ path: testDataDir });
      const responseData = JSON.parse(result.content[0].text);

      const fileItem = responseData.items.find((item: any) => item.name === 'file1.txt');
      expect(fileItem).toBeDefined();
      expect(fileItem.type).toBe('file');
      expect(fileItem.size).toBeGreaterThan(0);
      expect(fileItem.modified).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const dirItem = responseData.items.find((item: any) => item.name === 'subdir');
      expect(dirItem).toBeDefined();
      expect(dirItem.type).toBe('directory');
    });

    it('should exclude hidden files by default', async () => {
      const result = await (server as any).handleListDirectory({
        path: testDataDir,
        include_hidden: false
      });
      const responseData = JSON.parse(result.content[0].text);

      const fileNames = responseData.items.map((item: any) => item.name);
      expect(fileNames).not.toContain('.hidden');
    });

    it('should include hidden files when requested', async () => {
      const result = await (server as any).handleListDirectory({
        path: testDataDir,
        include_hidden: true
      });
      const responseData = JSON.parse(result.content[0].text);

      const fileNames = responseData.items.map((item: any) => item.name);
      expect(fileNames).toContain('.hidden');
    });

    it('should throw error for non-existent directory', async () => {
      const nonExistentDir = path.join(testDataDir, 'does_not_exist');

      await expect((server as any).handleListDirectory({ path: nonExistentDir }))
        .rejects.toThrow('Directory not found');
    });

    it('should throw error for access outside Safe Zone', async () => {
      const outsideDir = path.resolve('../../etc');

      await expect((server as any).handleListDirectory({ path: outsideDir }))
        .rejects.toThrow('Access denied');
    });
  });

  describe('search_files tool', () => {
    beforeEach(() => {
      // Create test file structure
      fs.writeFileSync(path.join(testDataDir, 'file1.txt'), 'Content');
      fs.writeFileSync(path.join(testDataDir, 'file2.json'), '{}');
      fs.mkdirSync(path.join(testDataDir, 'subdir'), { recursive: true });
      fs.writeFileSync(path.join(testDataDir, 'subdir', 'nested.txt'), 'Nested');
      fs.writeFileSync(path.join(testDataDir, 'subdir', 'data.csv'), 'a,b,c');
    });

    it('should find files matching glob pattern', async () => {
      const result = await (server as any).handleSearchFiles({
        pattern: '*.txt',
        directory: testDataDir
      });
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.success).toBe(true);
      expect(responseData.matches).toBeDefined();
      expect(responseData.matches.length).toBeGreaterThan(0);

      const matchNames = responseData.matches.map((m: string) => path.basename(m));
      expect(matchNames).toContain('file1.txt');
      expect(matchNames).toContain('test_file.txt');
    });

    it('should support recursive glob patterns (**)', async () => {
      const result = await (server as any).handleSearchFiles({
        pattern: '**/*.txt',
        directory: testDataDir
      });
      const responseData = JSON.parse(result.content[0].text);

      const matchNames = responseData.matches;
      const hasNestedFile = matchNames.some((m: string) => m.includes('nested.txt'));
      expect(hasNestedFile).toBe(true);
    });

    it('should support multiple extension matching', async () => {
      const result = await (server as any).handleSearchFiles({
        pattern: '**/*.{txt,json}',
        directory: testDataDir
      });
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.matches.length).toBeGreaterThanOrEqual(3);

      const extensions = responseData.matches.map((m: string) => path.extname(m));
      expect(extensions).toContain('.txt');
      expect(extensions).toContain('.json');
    });

    it('should return empty array for non-matching pattern', async () => {
      const result = await (server as any).handleSearchFiles({
        pattern: '*.xyz',
        directory: testDataDir
      });
      const responseData = JSON.parse(result.content[0].text);

      expect(responseData.success).toBe(true);
      expect(responseData.matches).toEqual([]);
      expect(responseData.count).toBe(0);
    });

    it('should throw error for directory outside Safe Zone', async () => {
      const outsideDir = path.resolve('../../etc');

      await expect((server as any).handleSearchFiles({
        pattern: '*.conf',
        directory: outsideDir
      })).rejects.toThrow('Access denied');
    });
  });

  describe('Tool Listing', () => {
    it('should return 4 filesystem tools', () => {
      const tools = (server as any).getTools();

      expect(tools.length).toBe(4);

      const toolNames = tools.map((t: any) => t.name);
      expect(toolNames).toContain('read_file');
      expect(toolNames).toContain('write_file');
      expect(toolNames).toContain('list_directory');
      expect(toolNames).toContain('search_files');
    });

    it('should include input schemas for all tools', () => {
      const tools = (server as any).getTools();

      tools.forEach((tool: any) => {
        expect(tool.inputSchema).toBeDefined();
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.properties).toBeDefined();
        expect(tool.inputSchema.required).toBeDefined();
      });
    });
  });
});
