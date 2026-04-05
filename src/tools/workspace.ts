import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/index.js';

export function registerWorkspaceTools(server: McpServer) {
  
  // Helper function to validate path
  function validatePath(targetPath: string) {
    // 1. Must be within workspace root
    if (!targetPath.startsWith(config.workspaceRoot)) {
      throw new Error(`Access denied: Path must be within workspace root.`);
    }

    // 2. Must be within allowed roots (subdirectories)
    const relativePath = path.relative(config.workspaceRoot, targetPath);
    const rootDir = relativePath.split(path.sep)[0];
    
    // If it's in the root folder directly, it might be allowed if allowedRoots contains '.' or specific files logic
    // But based on config, allowedRoots are folder names.
    // We check if the path starts with any of the allowed roots relative to workspace
    const isAllowed = config.allowedRoots.some(root => 
        relativePath.startsWith(root) || relativePath === root
    );

    if (!isAllowed) {
        // Special case: allow listing the root directory itself
        if (targetPath === config.workspaceRoot) return;
        throw new Error(`Access denied: Path is not in an allowed directory.`);
    }

    // 3. Must not contain denied patterns
    for (const denied of config.denyContains) {
      if (targetPath.includes(denied)) {
         throw new Error(`Access denied: File path contains restricted pattern '${denied}'`);
      }
    }
  }

  // List Directory Tool
  server.tool(
    "workspace_list_directory",
    "Lists files and directories in the workspace.",
    {
      dir_path: z.string().describe("Relative or absolute path within the workspace"),
    },
    async ({ dir_path }) => {
      const targetPath = path.resolve(config.workspaceRoot, dir_path);
      
      try {
        validatePath(targetPath);

        const files = await fs.readdir(targetPath, { withFileTypes: true });
        const listing = files.map(file => ({
          name: file.name,
          isDirectory: file.isDirectory(),
          path: path.relative(config.workspaceRoot, path.join(targetPath, file.name))
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(listing, null, 2)
          }]
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error listing directory: ${err.message}`
          }]
        };
      }
    }
  );

  // Read File Tool
  server.tool(
    "workspace_read_file",
    "Reads the content of a file in the workspace.",
    {
      file_path: z.string().describe("Relative or absolute path to the file"),
    },
    async ({ file_path }) => {
      const targetPath = path.resolve(config.workspaceRoot, file_path);

      try {
        validatePath(targetPath);

        const stats = await fs.stat(targetPath);
        if (stats.size > config.maxReadBytes) {
           throw new Error(`File too large: ${stats.size} bytes (max ${config.maxReadBytes})`);
        }

        const content = await fs.readFile(targetPath, 'utf-8');
        return {
          content: [{
            type: "text",
            text: content
          }]
        };
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        return {
          isError: true,
          content: [{
            type: "text",
            text: `Error reading file: ${err.message}`
          }]
        };
      }
    }
  );
}