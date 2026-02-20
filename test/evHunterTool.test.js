import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock pythonShell before importing the module
vi.mock("../src/utils/pythonShell.js", () => ({
    globalPythonShell: {
        run: vi.fn(),
    },
}));
// Mock logger
vi.mock("../src/utils/logger.js", () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    setAgentStatus: vi.fn(),
}));
describe("EV Hunter Tool", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    it("should register ev_hunter_search and ev_hunter_status tools", async () => {
        const { registerEvHunterTools } = await import("../src/tools/evHunterTool.js");
        const registeredTools = [];
        const mockServer = {
            tool: vi.fn((name, _desc, _schema, _handler) => {
                registeredTools.push(name);
            }),
        };
        registerEvHunterTools(mockServer);
        expect(registeredTools).toContain("ev_hunter_search");
        expect(registeredTools).toContain("ev_hunter_status");
        expect(registeredTools).toHaveLength(2);
    });
    it("ev_hunter_search should call pythonShell with mock flag", async () => {
        const { globalPythonShell } = await import("../src/utils/pythonShell.js");
        const runMock = vi.mocked(globalPythonShell.run);
        runMock.mockResolvedValue('[{"title": "Test EV", "score": 75.0}]');
        const { registerEvHunterTools } = await import("../src/tools/evHunterTool.js");
        let searchHandler;
        const mockServer = {
            tool: vi.fn((name, _desc, _schema, handler) => {
                if (name === "ev_hunter_search") {
                    searchHandler = handler;
                }
            }),
        };
        registerEvHunterTools(mockServer);
        expect(searchHandler).toBeDefined();
        const result = await searchHandler({ mock: true, dry_run: true });
        expect(runMock).toHaveBeenCalledOnce();
        const callArg = runMock.mock.calls[0][0];
        expect(callArg).toContain("mock=True");
        expect(callArg).toContain("dry_run=True");
        const typedResult = result;
        expect(typedResult.content[0].text).toContain("Test EV");
    });
    it("ev_hunter_search should handle errors gracefully", async () => {
        const { globalPythonShell } = await import("../src/utils/pythonShell.js");
        const runMock = vi.mocked(globalPythonShell.run);
        runMock.mockRejectedValue(new Error("Python not found"));
        const { registerEvHunterTools } = await import("../src/tools/evHunterTool.js");
        let searchHandler;
        const mockServer = {
            tool: vi.fn((name, _desc, _schema, handler) => {
                if (name === "ev_hunter_search") {
                    searchHandler = handler;
                }
            }),
        };
        registerEvHunterTools(mockServer);
        const result = await searchHandler({ mock: true });
        const typedResult = result;
        expect(typedResult.isError).toBe(true);
        expect(typedResult.content[0].text).toContain("Python not found");
    });
});
describe("EV Hunter Tool Permissions", () => {
    it("should have correct permissions mapped for ev_hunter tools", async () => {
        const { ToolPermissionMap } = await import("../src/tools/toolPermissions.js");
        expect(ToolPermissionMap["ev_hunter_search"]).toBeDefined();
        expect(ToolPermissionMap["ev_hunter_status"]).toBeDefined();
        expect(ToolPermissionMap["ev_hunter_search"]).toContain("browser_control");
        expect(ToolPermissionMap["ev_hunter_status"]).toContain("read_file");
    });
});
