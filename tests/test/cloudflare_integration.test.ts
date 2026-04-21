import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { CloudflareClient } from "../src/utils/cloudflareClient";
import axios from "axios";

// Mock axios
vi.mock("axios");

describe("Cloudflare Edge Integration", () => {
  let client: CloudflareClient;
  // Use explicit casting for axios mock
  const mockedAxios = axios as unknown as {
    post: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
  };
  const baseUrl = "https://bas-orchestrator.iam-dd1.workers.dev"; // Default URL

  beforeEach(() => {
    client = new CloudflareClient(baseUrl);
    vi.clearAllMocks();
  });

  it("should submit task successfully", async () => {
    const mockResponse = {
      data: {
        success: true,
        taskId: "task-123",
        type: "task_submitted",
        result: { response: "Task received" },
        message: "Task queued",
      },
    };

    mockedAxios.post.mockResolvedValueOnce(mockResponse);

    const result = await client.submitTask("Test instruction", { foo: "bar" });

    expect(mockedAxios.post).toHaveBeenCalledWith(
      `${baseUrl}/task`,
      {
        instruction: "Test instruction",
        context: { foo: "bar" },
      },
      expect.any(Object),
    );
    expect(result.taskId).toBe("task-123");
    expect(result.success).toBe(true);
  });

  it("should handle submission errors", async () => {
    mockedAxios.post.mockRejectedValueOnce({
      response: {
        data: { error: "Worker Error" },
      },
    });

    await expect(client.submitTask("Fail")).rejects.toThrow(
      "Cloudflare submission failed: Worker Error",
    );
  });

  it("should fetch history", async () => {
    const mockResponse = {
      data: {
        tasks: [
          { id: "1", instruction: "Task 1", status: "completed" },
          { id: "2", instruction: "Task 2", status: "pending" },
        ],
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const history = await client.fetchHistory(5);

    expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/history?limit=5`);
    expect(history.tasks).toHaveLength(2);
    expect(history.tasks[0].id).toBe("1");
  });

  it("should fetch workers and routing tables", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: [
        {
          id: "worker-1",
          agent_name: "Agent One",
          is_healthy: true,
          avg_latency_ms: 12.5,
          worker_url: "https://worker-one.example",
        },
      ],
    });

    const workers = await client.fetchWorkers();

    expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/workers`, {
      headers: expect.any(Object),
    });
    expect(workers).toHaveLength(1);
    expect(workers[0].agent_name).toBe("Agent One");
    expect(workers[0].worker_url).toBe("https://worker-one.example");

    mockedAxios.get.mockResolvedValueOnce({
      data: [
        {
          agent_name: "Agent One",
          worker_url: "https://worker-one.example",
        },
      ],
    });

    const routing = await client.fetchRouting();

    expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/routing`, {
      headers: expect.any(Object),
    });
    expect(routing).toHaveLength(1);
    expect(routing[0].agent_name).toBe("Agent One");
    expect(routing[0].worker_url).toBe("https://worker-one.example");
  });

  it("should check status", async () => {
    const mockResponse = {
      data: {
        id: "task-123",
        status: "completed",
        result: "Done",
      },
    };

    mockedAxios.get.mockResolvedValueOnce(mockResponse);

    const status = await client.checkStatus("task-123");

    expect(mockedAxios.get).toHaveBeenCalledWith(`${baseUrl}/status/task-123`);
    expect(status.status).toBe("completed");
  });
});
