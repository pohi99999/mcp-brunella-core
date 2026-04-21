import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

interface McpServerConfig {
  name: string;
  transport?: string;
  command?: string;
  args?: string[];
  autoStart?: boolean;
  disabled?: boolean;
}

interface VscodeMcpConfig {
  servers?: Record<string, { type?: string; command?: string; args?: string[] }>;
}

const workspaceRoot = process.cwd();

describe("workspace-mcp-server integration", () => {
  it("should have the standalone workspace MCP project files", () => {
    const projectRoot = path.resolve(workspaceRoot, "workspace-mcp-server");

    expect(fs.existsSync(path.join(projectRoot, "pyproject.toml"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "README.md"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "server.py"))).toBe(true);
    expect(fs.existsSync(path.join(projectRoot, "src", "workspace_mcp_server", "server.py"))).toBe(true);
  });

  it("should be registered in mcp_servers.json for Brunella runtime discovery", () => {
    const configPath = path.resolve(workspaceRoot, "mcp_servers.json");
    const servers = JSON.parse(fs.readFileSync(configPath, "utf-8")) as McpServerConfig[];
    const workspaceServer = servers.find((server) => server.name === "workspace-mcp-server");

    expect(workspaceServer).toBeDefined();
    expect(workspaceServer?.transport).toBe("stdio");
    expect(workspaceServer?.command).toBe("uv");
    expect(workspaceServer?.args).toEqual(
      expect.arrayContaining([
        "run",
        "--project",
        "workspace-mcp-server",
        "workspace-mcp-server",
        "--workspace-root",
        "${WORKSPACE_ROOT}",
      ]),
    );
    expect(workspaceServer?.autoStart).toBe(true);
    expect(workspaceServer?.disabled).toBe(false);
  });

  it("should be exposed in .vscode/mcp.json for editor MCP access", () => {
    const vscodeConfigPath = path.resolve(workspaceRoot, ".vscode", "mcp.json");
    const vscodeConfig = JSON.parse(fs.readFileSync(vscodeConfigPath, "utf-8")) as VscodeMcpConfig;
    const workspaceServer = vscodeConfig.servers?.["workspace-mcp-server"];

    expect(workspaceServer).toBeDefined();
    expect(workspaceServer?.type).toBe("stdio");
    expect(workspaceServer?.command).toBe("uv");
    expect(workspaceServer?.args).toEqual(
      expect.arrayContaining([
        "run",
        "--project",
        "workspace-mcp-server",
        "workspace-mcp-server",
        "--workspace-root",
        ".",
      ]),
    );
  });
});
