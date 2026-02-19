import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import { getSafeZoneValidator } from '../security/safe_zone_validator.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';

/**
 * MCP Filesystem Server
 *
 * Provides secure filesystem operations for AI agents via MCP protocol.
 * All operations are validated against Safe Zone configuration.
 */
export class MCPFilesystemServer {
  private server: Server;
  private validator: ReturnType<typeof getSafeZoneValidator>;

  constructor() {
    this.validator = getSafeZoneValidator();

    this.server = new Server(
      {
        name: 'brunella-mcp-filesystem',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    this.setupHandlers();
    logInfo('MCPFilesystemServer', 'MCP server initialized');
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      logInfo('MCPFilesystemServer', 'Listing tools');
      return {
        tools: this.getTools()
      };
    });

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      logInfo('MCPFilesystemServer', `Calling tool: ${name}`);

      try {
        switch (name) {
          case 'read_file':
            return await this.handleReadFile(args);
          case 'write_file':
            return await this.handleWriteFile(args);
          case 'list_directory':
            return await this.handleListDirectory(args);
          case 'search_files':
            return await this.handleSearchFiles(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error: any) {
        logError('MCPFilesystemServer', `Tool ${name} failed: ${error.message}`);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            } as TextContent
          ],
          isError: true
        };
      }
    });
  }

  /**
   * Get tool definitions
   */
  private getTools(): Tool[] {
    return [
      {
        name: 'read_file',
        description: 'Read file content from Safe Zone directories. Returns file content as text. Validates path against Safe Zone configuration and blacklist.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path (must be within Safe Zone). Can be relative or absolute.'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write content to file in Safe Zone. Creates file if it doesn\'t exist. Validates path, extension, and file size limits.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path (must be within Safe Zone)'
            },
            content: {
              type: 'string',
              description: 'File content to write'
            },
            create_dirs: {
              type: 'boolean',
              description: 'Create parent directories if they don\'t exist (default: true)'
            }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: 'List directory contents in Safe Zone. Returns array of file/directory names with metadata (type, size, modified time).',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Directory path (must be within Safe Zone)'
            },
            include_hidden: {
              type: 'boolean',
              description: 'Include hidden files (default: false)'
            }
          },
          required: ['path']
        }
      },
      {
        name: 'search_files',
        description: 'Search for files by glob pattern in Safe Zone. Returns array of matching file paths. Supports wildcards (*, **) and glob patterns.',
        inputSchema: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Glob pattern (e.g., "**/*.ts", "data/*.json")'
            },
            directory: {
              type: 'string',
              description: 'Search root directory (default: current working directory). Must be within Safe Zone.'
            }
          },
          required: ['pattern']
        }
      }
    ];
  }

  /**
   * Handle read_file tool
   */
  private async handleReadFile(args: any): Promise<any> {
    const filePath = args.path as string;

    // Validate access
    if (!this.validator.validate(filePath, 'read')) {
      throw new Error(`Access denied: ${filePath} is outside Safe Zone or blacklisted`);
    }

    // Read file
    try {
      const resolvedPath = path.resolve(filePath);

      let stats;
      try {
        stats = await fs.promises.stat(resolvedPath);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
           throw new Error(`File not found: ${filePath}`);
        }
        throw error;
      }

      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      const content = await fs.promises.readFile(resolvedPath, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: filePath,
              size: stats.size,
              content: content,
              modified: stats.mtime.toISOString()
            }, null, 2)
          } as TextContent
        ]
      };
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Handle write_file tool
   */
  private async handleWriteFile(args: any): Promise<any> {
    const filePath = args.path as string;
    const content = args.content as string;
    const createDirs = args.create_dirs !== false; // Default true

    // Validate access
    if (!this.validator.validate(filePath, 'write')) {
      throw new Error(`Access denied: ${filePath} is outside Safe Zone or blacklisted`);
    }

    try {
      const resolvedPath = path.resolve(filePath);
      const dirPath = path.dirname(resolvedPath);

      // Create parent directories if needed
      if (createDirs) {
        // Use async mkdir if not exists
        try {
            await fs.promises.access(dirPath);
        } catch {
             await fs.promises.mkdir(dirPath, { recursive: true });
        }
      }

      // Write file
      await fs.promises.writeFile(resolvedPath, content, 'utf-8');

      const stats = await fs.promises.stat(resolvedPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: filePath,
              size: stats.size,
              bytes_written: Buffer.byteLength(content, 'utf-8'),
              modified: stats.mtime.toISOString()
            }, null, 2)
          } as TextContent
        ]
      };
    } catch (error: any) {
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }

  /**
   * Handle list_directory tool
   */
  private async handleListDirectory(args: any): Promise<any> {
    const dirPath = args.path as string;
    const includeHidden = args.include_hidden === true;

    // Validate access (list operation is treated as read)
    if (!this.validator.validate(dirPath, 'read')) {
      throw new Error(`Access denied: ${dirPath} is outside Safe Zone`);
    }

    try {
      const resolvedPath = path.resolve(dirPath);

      let stats;
      try {
        stats = await fs.promises.stat(resolvedPath);
      } catch(e: any) {
         if (e.code === 'ENOENT') throw new Error(`Directory not found: ${dirPath}`);
         throw e;
      }

      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      // Read directory
      const entries = await fs.promises.readdir(resolvedPath);

      // Filter hidden files if needed
      const filteredEntries = includeHidden
        ? entries
        : entries.filter(e => !e.startsWith('.'));

      // Get metadata for each entry
      const items = await Promise.all(filteredEntries.map(async (entry) => {
        const entryPath = path.join(resolvedPath, entry);
        const entryStat = await fs.promises.stat(entryPath);

        return {
          name: entry,
          type: entryStat.isDirectory() ? 'directory' : 'file',
          size: entryStat.size,
          modified: entryStat.mtime.toISOString()
        };
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              path: dirPath,
              items: items,
              count: items.length
            }, null, 2)
          } as TextContent
        ]
      };
    } catch (error: any) {
      throw new Error(`Failed to list directory: ${error.message}`);
    }
  }

  /**
   * Handle search_files tool
   */
  private async handleSearchFiles(args: any): Promise<any> {
    const pattern = args.pattern as string;
    const directory = args.directory || process.cwd();

    // Validate directory access
    if (!this.validator.validate(directory, 'read')) {
      throw new Error(`Access denied: ${directory} is outside Safe Zone`);
    }

    try {
      const resolvedDir = path.resolve(directory);

      // Use glob to find matching files
      const matches = await glob(pattern, {
        cwd: resolvedDir,
        absolute: false,
        dot: false // Don't include hidden files
      });

      // Validate each match is in Safe Zone
      const validMatches = matches.filter(match => {
        const fullPath = path.join(resolvedDir, match);
        return this.validator.validate(fullPath, 'read');
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              pattern: pattern,
              directory: directory,
              matches: validMatches,
              count: validMatches.length
            }, null, 2)
          } as TextContent
        ]
      };
    } catch (error: any) {
      throw new Error(`Failed to search files: ${error.message}`);
    }
  }

  /**
   * Start MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logInfo('MCPFilesystemServer', 'MCP Filesystem Server running on stdio');
  }
}

/**
 * Main entry point for MCP server
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new MCPFilesystemServer();
  server.start().catch(error => {
    logError('MCPFilesystemServer', `Failed to start server: ${error.message}`);
    process.exit(1);
  });
}
