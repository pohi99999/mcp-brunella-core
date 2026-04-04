import axios from "axios";
import { logInfo, logError } from "./logger.js";
import { generateResponse } from "../core/llm_client.js";
import { getCloudflareAuthHeaders, getCloudflareChatSyncUrl } from "./cloudflareConfig.js";

const CLOUDFLARE_CHAT_SYNC_URL = getCloudflareChatSyncUrl();
const SYNC_INTERVAL_MS = 5000;

interface ChatMessage {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  model: string;
  timestamp: string;
  synced: number;
}

/** Maximum new messages to process per poll cycle — prevents startup history replay flood. */
const MAX_MESSAGES_PER_POLL = 5;

class SyncService {
  private isRunning = false;
  private pollInProgress = false;
  private lastProcessedId = 0;
  private initialized = false;

  private buildHeaders(): Record<string, string> {
    return getCloudflareAuthHeaders();
  }

  /** On first start, set lastProcessedId to current max so historical messages are skipped. */
  private async initializeStartId(): Promise<void> {
    try {
      const response = await axios.get<ChatMessage[]>(`${CLOUDFLARE_CHAT_SYNC_URL}/chat/messages`, {
        headers: this.buildHeaders(),
        timeout: 10000,
      });
      const messages = response.data;
      if (Array.isArray(messages) && messages.length > 0) {
        this.lastProcessedId = Math.max(...messages.map((m) => m.id));
        logInfo("SyncService", `Initialized at message id=${this.lastProcessedId} — skipping history (${messages.length} messages)`);
      } else {
        logInfo("SyncService", "No historical messages — starting from id=0");
      }
    } catch {
      logInfo("SyncService", "Could not initialize start id — will start from id=0");
    }
    this.initialized = true;
  }

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    logInfo("SyncService", `Cloudflare chat sync started. URL: ${CLOUDFLARE_CHAT_SYNC_URL}`);
    await this.initializeStartId();
    this.poll();
  }

  private async poll() {
    while (this.isRunning) {
      if (!this.pollInProgress) {
        this.pollInProgress = true;
        try {
          const response = await axios.get<ChatMessage[]>(`${CLOUDFLARE_CHAT_SYNC_URL}/chat/messages`, {
            headers: this.buildHeaders(),
            timeout: 10000,
          });
          const messages = response.data;

          let processed = 0;
          for (const msg of messages) {
            if (msg.id > this.lastProcessedId) {
              this.lastProcessedId = msg.id;

              if (msg.role === "user" && processed < MAX_MESSAGES_PER_POLL) {
                logInfo("SyncService", `New remote message id=${msg.id}: ${msg.content.slice(0, 30)}...`);
                processed++;

                const aiResponse = await generateResponse(msg.content);

                await axios.post(`${CLOUDFLARE_CHAT_SYNC_URL}/chat/messages`, {
                  role: "assistant",
                  content: aiResponse,
                  model: "local-sync",
                  timestamp: new Date().toISOString()
                }, {
                  headers: this.buildHeaders(),
                  timeout: 10000,
                });

                logInfo("SyncService", "Response synced back to Cloudflare");
              }
            }
          }
        } catch (error: unknown) {
          const err = error as { response?: { data?: unknown }; message?: string };
          const errorDetail = err.response?.data ? JSON.stringify(err.response.data) : (err.message ?? String(error));
          logError("SyncService", `Sync error: ${errorDetail}`);
        } finally {
          this.pollInProgress = false;
        }
      }

      await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
    }
  }

  stop() {
    this.isRunning = false;
  }
}

export const syncService = new SyncService();
