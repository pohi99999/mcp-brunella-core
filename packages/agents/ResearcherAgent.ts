import { BaseAgent, AgentContext, AgentResult } from "./BaseAgent.js";
import { AgentHandoff, ISwarmContext } from "./types.js";
import { logInfo, logError } from "@packages/utils/logger.js";

interface RAGResult {
  text: string;
  source: string;
  page_num: number;
  score: number;
}

interface RAGQueryRequest {
  query: string;
  limit: number;
}

interface RAGQueryResponse {
  results?: RAGResult[];
}

const PYTHON_RAG_QUERY_URL = "http://127.0.0.1:8000/rag/query";

export class ResearcherAgent extends BaseAgent {
  name = "Researcher";
  description =
    "Webes keresésre és információgyűjtésre specializálódott ügynök. Képes a belső tudásbázis (RAG) és a világháló keresésére.";
  role = "researcher";
  capabilities = ["web_search", "rag_search", "information_gathering"];

  private async queryRAG(query: string): Promise<RAGResult[]> {
    try {
      logInfo("ResearcherAgent", `Querying RAG Knowledge Base: ${query}`);
      const requestBody: RAGQueryRequest = {
        query,
        limit: 5,
      };
      const response = await fetch(PYTHON_RAG_QUERY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`RAG API error: ${response.statusText}`);
      }

      const data: RAGQueryResponse = (await response.json()) as RAGQueryResponse;
      return Array.isArray(data.results) ? data.results : [];
    } catch (error) {
      logError("ResearcherAgent", `RAG query failed: ${error}`);
      return [];
    }
  }

  async executeTask(context: AgentContext): Promise<AgentResult> {
    const task = context.task || "";
    const taskLower = task.toLowerCase();
    const swarmContext = context.swarm;

    // 1. RAG Search (Priority if explicitly requested or context implies internal knowledge)
    if (
      taskLower.includes("tudásbázis") ||
      taskLower.includes("rag") ||
      taskLower.includes("belső") ||
      taskLower.includes("internal")
    ) {
      logInfo("ResearcherAgent", `RAG Search activated for: ${task}`);
      const ragResults = await this.queryRAG(task);

      if (ragResults.length > 0) {
        const formattedResults = ragResults
          .map(
            (r) =>
              `- **${r.source}** (Page ${r.page_num}): "${r.text.substring(0, 150)}..."`,
          )
          .join("\n");

        if (swarmContext) {
          swarmContext.artifacts["ragResults"] = ragResults;
          swarmContext.history.push({
            role: "assistant",
            agent: this.name,
            content: `Tudásbázis találatok:\n${formattedResults}`,
          });
        }

        return {
          success: true,
          message: `Találtam ${ragResults.length} releváns elemet a tudásbázisban.`,
          data: {
            source: "rag",
            results: ragResults,
            summary: `Találtam ${ragResults.length} releváns elemet a tudásbázisban.`,
          },
          contextUsed: ragResults.map((r) => r.source),
        };
      } else {
        return {
          success: true,
          message: "Nem találtam releváns információt a tudásbázisban.",
          data: {
            source: "rag",
            results: [],
            summary: "Nem találtam releváns információt a tudásbázisban.",
          },
        };
      }
    }

    // 2. Mock Web Search (Fallback)
    if (
      taskLower.includes("keress") ||
      taskLower.includes("search") ||
      taskLower.includes("web")
    ) {
      logInfo("ResearcherAgent", `Web Searching for: ${task}`);

      // Simulate finding data
      const searchResults = [
        { title: "Result 1", snippet: "Information about " + task },
        { title: "Result 2", snippet: "More details on " + task },
      ];

      // Store in Swarm Context if available
      if (swarmContext) {
        swarmContext.artifacts["searchResults"] = searchResults;
        swarmContext.history.push({
          role: "assistant",
          agent: this.name,
          content: `Found ${searchResults.length} results for "${task}". Saved to artifacts.`,
        });
      }

      // Handoff to Data Scientist for analysis if needed
      if (taskLower.includes("elemz") || taskLower.includes("analyze")) {
        return this.createHandoff(
          "DataScientist",
          `Analyze the search results for: ${task}`,
          "Search complete, analysis required.",
        );
      }

      return {
        success: true,
        message: `Webes keresés sikeres: ${searchResults.length} találat`,
        data: searchResults,
      };
    }

    return {
      success: false,
      message:
        'Nem tudom értelmezni a kutatási feladatot. Használj kulcsszavakat: "rag", "tudásbázis", "keress", "web".',
    };
  }
}

export default ResearcherAgent;

