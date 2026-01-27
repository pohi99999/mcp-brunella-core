import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { checkServerRunning } from "./serverManager.js";
import EventSource from "eventsource";
import path from 'path';

// Polyfill EventSource
// @ts-ignore
global.EventSource = EventSource;

export class BrunellaClient {
  private client: Client;
  private transport: any;

  constructor() {
    this.client = new Client(
      {
        name: "brunella-cli",
        version: "1.0.0",
      },
      {
        capabilities: {
            // We don't provide tools, we consume them
        },
      }
    );
  }

  async connect() {
    const isRunning = await checkServerRunning(3000);

    if (isRunning) {
      // console.log("Connecting to running server via SSE...");
      this.transport = new SSEClientTransport(
        new URL("http://localhost:3000/sse")
      );
    } else {
      // console.log("Launching embedded server...");
      const scriptPath = path.join(__dirname, '../../build/index.js');
      this.transport = new StdioClientTransport({
        command: "node",
        args: [scriptPath],
        env: { ...process.env, WEB_UI_ENABLED: 'true' }
      });
    }
    
    await this.client.connect(this.transport);
  }

  async listTools() {
    return this.client.listTools();
  }
  
  async callTool(name: string, args: any) {
    return this.client.callTool({ name, arguments: args });
  }

  async close() {
      if (this.transport && this.transport.close) {
          await this.transport.close();
      }
  }
}
