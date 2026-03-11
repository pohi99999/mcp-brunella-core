import axios from "axios";
import { logInfo, logError } from "./logger.js";
import { generateResponse } from "../core/llm_client.js";

const CLOUDFLARE_CHAT_SYNC_URL = (
  process.env.CLOUDFLARE_CHAT_SYNC_URL ||
  process.env.CLOUDFLARE_CHAT_URL ||
  process.env.CLOUDFLARE_WORKER_URL ||
  "https://bas-orchestrator.peterpohankapersonal.workers.dev"
).replace(/\/+$/, "");
const SYNC_INTERVAL_MS = 5000;

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  model: string;
  timestamp: string;
  synced: number;
}

class SyncService {
  private isRunning = false;
  private lastProcessedId = 0;

  private buildHeaders(): Record<string, string> {
    const token = (process.env.CLOUDFLARE_API_TOKEN || "").replace(/"/g, "").trim();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-CEAN-API-Key"] = token; // legacy support
    }

    return headers;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logInfo("SyncService", `Cloudflare chat sync started. URL: ${CLOUDFLARE_CHAT_SYNC_URL}`);
    this.poll();
  }

  private async poll() {
    while (this.isRunning) {
      try {
        const response = await axios.get<ChatMessage[]>(`${CLOUDFLARE_CHAT_SYNC_URL}/chat/messages`, {
          headers: this.buildHeaders(),
        });
        const messages = response.data;

        for (const msg of messages) {
          if (msg.id > this.lastProcessedId) {
            this.lastProcessedId = msg.id;

            if (msg.role === "user") {
              logInfo("SyncService", `New remote message: ${msg.content.slice(0, 30)}...`);
              
              const aiResponse = await generateResponse(msg.content); 
              
              await axios.post(`${CLOUDFLARE_CHAT_SYNC_URL}/chat/messages`, {
                role: "assistant",
                content: aiResponse,
                model: "local-sync",
                timestamp: new Date().toISOString()
              }, {
                headers: this.buildHeaders(),
              });
              
              logInfo("SyncService", "Response synced back to Cloudflare");
            }
          }
        }
      } catch (error: any) {
        const errorDetail = error.response?.data ? JSON.stringify(error.response.data) : error.message;
        logError("SyncService", `Sync error: ${errorDetail}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
    }
  }

  stop() {
    this.isRunning = false;
  }
}

export const syncService = new SyncService();
