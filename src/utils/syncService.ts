import axios from "axios";
import { logInfo, logError } from "./logger.js";
import { generateResponse } from "../core/llm_client.js";

const CLOUDFLARE_WORKER_URL = process.env.CLOUDFLARE_WORKER_URL || "https://bas-orchestrator.pohi99999.workers.dev";
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

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logInfo("SyncService", "D1 Message Sync started");
    this.poll();
  }

  private async poll() {
    while (this.isRunning) {
      try {
        const response = await axios.get<ChatMessage[]>(`${CLOUDFLARE_WORKER_URL}/chat/messages`);
        const messages = response.data;

        for (const msg of messages) {
          if (msg.id > this.lastProcessedId) {
            this.lastProcessedId = msg.id;

            // If it's a new user message from mobile, process it!
            if (msg.role === "user") {
              logInfo("SyncService", `New remote message: ${msg.content.slice(0, 30)}...`);
              
              // Run AI locally
              const aiResponse = await generateResponse(msg.content); 
              
              // Post response back to D1
              await axios.post(`${CLOUDFLARE_WORKER_URL}/chat/messages`, {
                role: "assistant",
                content: aiResponse,
                model: "local-sync",
                timestamp: new Date().toISOString()
              });
              
              logInfo("SyncService", "Response synced back to Cloudflare");
            }
          }
        }
      } catch (error: any) {
        logError("SyncService", `Sync error: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
    }
  }

  stop() {
    this.isRunning = false;
  }
}

export const syncService = new SyncService();
