import request from 'supertest';
import { createApp, setupMcpEndpoints } from '../web';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

jest.mock("@modelcontextprotocol/sdk/server/sse.js", () => {
    return {
        SSEServerTransport: jest.fn().mockImplementation((endpoint, res) => {
            return {
                sessionId: 'mock-session-id',
                onclose: jest.fn(),
                start: jest.fn().mockImplementation(async () => {
                    // Simulate SSE connection start and immediate close for testing
                    res.statusCode = 200;
                    res.end();
                }),
                handlePostMessage: jest.fn().mockResolvedValue(undefined),
                send: jest.fn().mockResolvedValue(undefined),
                close: jest.fn().mockResolvedValue(undefined)
            };
        })
    };
});

describe('MCP Endpoint', () => {
    let app: any;
    let mcpServer: McpServer;

    beforeEach(() => {
        app = createApp();
        mcpServer = new McpServer({ name: 'test', version: '1.0.0' });
        mcpServer.connect = jest.fn().mockResolvedValue(undefined);
        setupMcpEndpoints(app, mcpServer);
    });

    it('GET /sse should initialize transport and connect server', async () => {
        await request(app).get('/sse');
        expect(mcpServer.connect).toHaveBeenCalled();
        expect(SSEServerTransport).toHaveBeenCalledWith("/message", expect.anything());
    });
});