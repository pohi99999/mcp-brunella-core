"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkspaceTools = registerWorkspaceTools;
const zod_1 = require("zod");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
function registerWorkspaceTools(server) {
    // Helper function to validate path
    function validatePath(targetPath) {
        // 1. Must be within workspace root
        if (!targetPath.startsWith(index_js_1.config.workspaceRoot)) {
            throw new Error(`Access denied: Path must be within workspace root.`);
        }
        // 2. Must be within allowed roots (subdirectories)
        const relativePath = path_1.default.relative(index_js_1.config.workspaceRoot, targetPath);
        const rootDir = relativePath.split(path_1.default.sep)[0];
        // If it's in the root folder directly, it might be allowed if allowedRoots contains '.' or specific files logic
        // But based on config, allowedRoots are folder names.
        // We check if the path starts with any of the allowed roots relative to workspace
        const isAllowed = index_js_1.config.allowedRoots.some(root => relativePath.startsWith(root) || relativePath === root);
        if (!isAllowed) {
            // Special case: allow listing the root directory itself
            if (targetPath === index_js_1.config.workspaceRoot)
                return;
            throw new Error(`Access denied: Path is not in an allowed directory.`);
        }
        // 3. Must not contain denied patterns
        for (const denied of index_js_1.config.denyContains) {
            if (targetPath.includes(denied)) {
                throw new Error(`Access denied: File path contains restricted pattern '${denied}'`);
            }
        }
    }
    // List Directory Tool
    server.tool("workspace_list_directory", "Lists files and directories in the workspace.", {
        dir_path: zod_1.z.string().describe("Relative or absolute path within the workspace"),
    }, async ({ dir_path }) => {
        const targetPath = path_1.default.resolve(index_js_1.config.workspaceRoot, dir_path);
        try {
            validatePath(targetPath);
            const files = await promises_1.default.readdir(targetPath, { withFileTypes: true });
            const listing = files.map(file => ({
                name: file.name,
                isDirectory: file.isDirectory(),
                path: path_1.default.relative(index_js_1.config.workspaceRoot, path_1.default.join(targetPath, file.name))
            }));
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(listing, null, 2)
                    }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{
                        type: "text",
                        text: `Error listing directory: ${error.message}`
                    }]
            };
        }
    });
    // Read File Tool
    server.tool("workspace_read_file", "Reads the content of a file in the workspace.", {
        file_path: zod_1.z.string().describe("Relative or absolute path to the file"),
    }, async ({ file_path }) => {
        const targetPath = path_1.default.resolve(index_js_1.config.workspaceRoot, file_path);
        try {
            validatePath(targetPath);
            const stats = await promises_1.default.stat(targetPath);
            if (stats.size > index_js_1.config.maxReadBytes) {
                throw new Error(`File too large: ${stats.size} bytes (max ${index_js_1.config.maxReadBytes})`);
            }
            const content = await promises_1.default.readFile(targetPath, 'utf-8');
            return {
                content: [{
                        type: "text",
                        text: content
                    }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{
                        type: "text",
                        text: `Error reading file: ${error.message}`
                    }]
            };
        }
    });
}
