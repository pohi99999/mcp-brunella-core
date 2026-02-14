import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { persistentBrowser } from "../utils/persistentBrowser.js";

export function registerPersistentBrowserTools(server: McpServer) {
    server.tool(
        "browser_launch",
        "Launch a persistent browser session for interactive use.",
        {
            headless: z.boolean().optional().default(true).describe("Run headless (default: true). Set to false to see the browser (if supported environment)."),
        },
        async ({ headless = true }) => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "launch", headless });
                return { content: [{ type: "text", text: res.message || "Browser launched" }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "browser_navigate",
        "Navigate to a URL in the persistent browser.",
        {
            url: z.string().url().describe("The URL to navigate to"),
        },
        async ({ url }) => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "navigate", url });
                // Automatically update screenshot
                await persistentBrowser.sendCommand({ action: "screenshot" }).catch(() => {});
                return { content: [{ type: "text", text: `Navigated to ${res.url}` }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "browser_click",
        "Click an element on the page.",
        {
            selector: z.string().describe("CSS selector of the element to click"),
        },
        async ({ selector }) => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "click", selector });
                // Automatically take a screenshot after interaction to update view
                await persistentBrowser.sendCommand({ action: "screenshot" }).catch(() => {});
                return { content: [{ type: "text", text: res.message || `Clicked ${selector}` }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "browser_type",
        "Type text into an input field.",
        {
            selector: z.string().describe("CSS selector of the input field"),
            text: z.string().describe("Text to type"),
        },
        async ({ selector, text }) => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "type", selector, text });
                await persistentBrowser.sendCommand({ action: "screenshot" }).catch(() => {});
                return { content: [{ type: "text", text: res.message || `Typed into ${selector}` }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "browser_screenshot",
        "Take a screenshot of the current page. This updates the 'Live View' in the dashboard.",
        {},
        async () => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "screenshot" });
                return { content: [{ type: "text", text: "Screenshot taken and view updated." }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "browser_content",
        "Get the HTML content of the current page.",
        {},
        async () => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "content" });
                return { content: [{ type: "text", text: res.content || "" }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "browser_close",
        "Close the persistent browser session.",
        {},
        async () => {
            try {
                await persistentBrowser.close();
                return { content: [{ type: "text", text: "Browser closed" }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );
}
