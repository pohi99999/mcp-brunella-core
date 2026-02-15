import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { persistentBrowser } from "../utils/persistentBrowser.js";

export function registerPersistentBrowserTools(server: McpServer) {
    server.tool(
        "pb_launch",
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
        "pb_navigate",
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
        "pb_click",
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
        "pb_type",
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
        "pb_screenshot",
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
        "pb_content",
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

    // ==================== NEW TOOLS (RobotkezV2) ====================

    server.tool(
        "pb_scroll",
        "Scroll the page in a specified direction.",
        {
            direction: z.enum(['up', 'down', 'left', 'right']).describe("Scroll direction"),
            amount: z.number().optional().default(100).describe("Scroll amount in pixels (default: 100)"),
        },
        async ({ direction, amount = 100 }) => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "scroll", direction, amount });
                await persistentBrowser.sendCommand({ action: "screenshot" }).catch(() => {});
                return { content: [{ type: "text", text: res.message || `Scrolled ${direction} by ${amount}px` }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "pb_wait",
        "Wait for an element to appear on the page.",
        {
            selector: z.string().describe("CSS selector to wait for"),
            timeout: z.number().optional().default(5000).describe("Timeout in milliseconds (default: 5000)"),
        },
        async ({ selector, timeout = 5000 }) => {
            try {
                const res = await persistentBrowser.sendCommand({ action: "wait", selector, timeout });
                return { content: [{ type: "text", text: res.message || `Element ${selector} is visible` }] };
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    server.tool(
        "pb_extract",
        "Extract data from elements on the page.",
        {
            selector: z.string().describe("CSS selector (supports multiple matches)"),
            type: z.enum(['text', 'attribute', 'html']).default('text').describe("Extraction type: text (innerText), attribute (specific attribute), html (innerHTML)"),
            attribute: z.string().optional().describe("Attribute name (required if type=attribute, e.g., 'href', 'src')"),
        },
        async ({ selector, type = 'text', attribute }) => {
            try {
                const res = await persistentBrowser.sendCommand({
                    action: "extract",
                    selector,
                    type,
                    attribute
                });

                if (res.data && res.count !== undefined) {
                    const summary = `Extracted ${res.count} element(s):\n${JSON.stringify(res.data, null, 2)}`;
                    return { content: [{ type: "text", text: summary }] };
                } else {
                    return { content: [{ type: "text", text: "No data extracted" }] };
                }
            } catch (e: any) {
                return { isError: true, content: [{ type: "text", text: `Error: ${e.message}` }] };
            }
        }
    );

    // ==================== END NEW TOOLS ====================

    server.tool(
        "pb_close",
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
