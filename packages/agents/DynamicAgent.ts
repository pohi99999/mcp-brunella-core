import { IAgent, AgentResponse } from "./types.js";
import fs from "fs";
import path from "path";
import toml from "toml";
import { generateResponse } from "@packages/core-logic/llm_client.js";
import { logInfo, logError, setAgentStatus } from "@packages/utils/logger.js";
import { addToIndex } from "@packages/utils/rag.js";
import { ensureError } from "@packages/utils/ensureError.js";

interface DynamicAgentConfig {
  name?: string;
  displayName?: string;
  description?: string;
  systemPrompt?: string;
  query?: string;
  tags?: string[];
  tomlPath?: string;
}

export class DynamicAgent implements IAgent {
  public name: string = "DynamicAgent";
  public role: string = "Dynamic Agent";
  public description: string = "Dynamically configured agent";
  public capabilities: string[] = ["dynamic"];
  private systemPrompt: string = "";
  private queryTemplate: string = "${task}";

  constructor(configOrPath?: string | DynamicAgentConfig) {
    if (!configOrPath) {
      return;
    }

    if (typeof configOrPath === "string") {
      // Legacy: TOML file path
      try {
        const content = fs.readFileSync(configOrPath, "utf-8");
        const config = toml.parse(content);
        this.initFromConfig(config);
      } catch (error) {
        logError(
          "DynamicAgent",
          `Failed to load TOML from ${configOrPath}: ${error}`,
        );
      }
    } else {
      // New: Config object from registry
      // 1. First init from provided registry config
      this.initFromConfig(configOrPath);

      // 2. If tomlPath is provided, load TOML and merge (registry config overrides TOML)
      if (configOrPath.tomlPath) {
        try {
          const content = fs.readFileSync(configOrPath.tomlPath, "utf-8");
          const tomlConfig = toml.parse(content);
          // Registry config (configOrPath) takes precedence over TOML
          this.initFromConfig({ ...tomlConfig, ...configOrPath });
        } catch (error) {
          logError(
            this.name,
            `Failed to load TOML from ${configOrPath.tomlPath}: ${error}`,
          );
        }
      }
    }
  }

  private initFromConfig(config: DynamicAgentConfig): void {
    if (config.name) {
      this.name = config.name;
      // Default role to name if not provided
      if (!this.role || this.role === "Dynamic Agent") {
        this.role = config.name;
      }
    }

    if (config.displayName) this.role = config.displayName;
    if (config.description) this.description = config.description;
    if (config.systemPrompt) this.systemPrompt = config.systemPrompt;
    if (config.query) this.queryTemplate = config.query;
    if (config.tags) this.capabilities = config.tags;
  }

  async execute(task: string, context?: any): Promise<AgentResponse> {
    const taskDesc = task.length > 80 ? task.slice(0, 77) + "..." : task;
    setAgentStatus(this.name, "working", taskDesc);
    logInfo(this.name, `Executing task for ${this.name}: ${task}`);

    try {
      // Context enrichment for Project Organizer
      let contextData = "";
      if (this.name === "project_organizer") {
        const targetDir = context?.target_path || process.cwd();
        const files = fs.readdirSync(targetDir);

        // --- Proactive Indexing ---
        logInfo(
          this.name,
          `Project Organizer is indexing files in ${targetDir}`,
        );
        for (const file of files) {
          const fullPath = path.join(targetDir, file);
          const stats = fs.statSync(fullPath);
          // Only index relevant text files to save time
          if (stats.isFile() && file.match(/\.(md|ts|js|json|txt)$/)) {
            try {
              const content = fs.readFileSync(fullPath, "utf-8");
              await addToIndex(file, content);
            } catch (err) {
              logError(this.name, `Failed to index ${file}: ${err}`);
            }
          }
        }

        contextData = `\nCurrent directory contents of '${targetDir}' (THESE ARE NOW INDEXED TO MEMORY):\n${files.join("\n")}`;
      }

      const prompt = `${this.queryTemplate.replace("${target_path}", context?.target_path || ".")} \n\nUser Message: ${task} \n${contextData}`;

      // Call the LLM
      const fullPrompt = `${this.systemPrompt}\n\n${prompt}`;
      const response = await generateResponse(fullPrompt, context?.provider);

      return {
        status: "success",
        data: response,
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError(this.name, `Execution failed: ${err.message}`);
      return {
        status: "error",
        error: err.message,
      };
    } finally {
      setAgentStatus(this.name, "idle");
    }
  }
}

export default DynamicAgent;

