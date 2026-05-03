import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeveloperPanel } from "./DeveloperPanel";

const {
  executeResponseMock,
  issueAnalysisResponseMock,
  issueAttemptListResponseMock,
  issueAttemptDetailResponseMock,
  pipelineResponseMock,
  approvalsResponseMock,
  activityResponseMock,
  gitStatusResponseMock,
  gitBranchesResponseMock,
} = vi.hoisted(() => ({
  executeResponseMock: { taskId: "dev-1" },
  pipelineResponseMock: {
    pipeline: {
      taskId: "dev-1",
      task: "generate code",
      status: "done",
      phases: [
        { id: "plan", label: "Planning", status: "done" },
        { id: "generate", label: "Generating", status: "done" },
        { id: "validate", label: "Validating", status: "done" },
        { id: "save", label: "Saving", status: "done" },
        { id: "test", label: "Testing", status: "done" },
      ],
      createdAt: Date.now(),
      completedAt: Date.now(),
    },
  },
  issueAnalysisResponseMock: {
    analysis: {
      mode: "analysis-only",
      profile: {
        profileId: "developer-mcp-safe-v1",
        workspaceRoot: "F:\\mcp-brunella-core",
        repositoryOwner: "pohi9",
        repositoryName: "mcp-brunella-core",
        repositoryFullName: "pohi9/mcp-brunella-core",
        preferredMcpServers: ["filesystem", "git", "github"],
        availableMcpServers: [
          {
            name: "filesystem",
            enabled: true,
            source: "root-config",
          },
        ],
        safeCommandExamples: ["npm run build"],
        defaultVerificationCommands: ["npm run test:fast"],
        commandCategories: { build: ["npm run build"] },
      },
      issue: {
        issueNumber: 42,
        issueTitle: "Fix developer panel issue loop",
        issueBody: "Investigate issue loop rendering",
        issueState: "open",
        repositoryOwner: "pohi9",
        repositoryName: "mcp-brunella-core",
        repositoryFullName: "pohi9/mcp-brunella-core",
        requestedAt: "2026-04-01T18:00:00.000Z",
        labels: ["bug", "dashboard"],
        author: "pohi9",
      },
      context: {
        targetFile:
          "src/dashboard/components/dashboard/DeveloperPanel.tsx",
        targetExists: true,
        candidates: [
          {
            filePath:
              "src/dashboard/components/dashboard/DeveloperPanel.tsx",
            exists: true,
          },
        ],
        gathered: {
          targetFile:
            "src/dashboard/components/dashboard/DeveloperPanel.tsx",
          totalSize: 2048,
          truncated: false,
          files: [
            {
              relativePath:
                "src/dashboard/components/dashboard/DeveloperPanel.tsx",
              reason: "target",
              size: 1024,
            },
            {
              relativePath: "test/routes_developer.test.ts",
              reason: "paired test",
              size: 1024,
            },
          ],
        },
      },
      recommendation: {
        summary:
          "A legvalószínűbb belépési pont: src/dashboard/components/dashboard/DeveloperPanel.tsx.",
        nextActions: [
          "Olvasd el a kiválasztott célfájlt és a kapcsolódó kontextusfájlokat.",
          "Készíts kis blast-radiusú módosítást.",
        ],
        verificationCommands: ["npm run build", "npm run test:dashboard"],
        validatedCommands: [
          {
            normalizedCommand: "npm run build",
            policyId: "build",
            category: "build",
          },
        ],
      },
    },
  },
  issueAttemptListResponseMock: {
    attempts: [
      {
        taskId: "dev-issue-1",
        approvalRequestId: "approval-12345678",
        status: "awaiting_approval",
        createdAt: "2026-04-01T18:01:00.000Z",
        updatedAt: "2026-04-01T18:01:00.000Z",
        issueNumber: 42,
        issueTitle: "Fix developer panel issue loop",
        repositoryFullName: "pohi9/mcp-brunella-core",
        targetFile:
          "src/dashboard/components/dashboard/DeveloperPanel.tsx",
        analysisSummary:
          "A legvalószínűbb belépési pont: src/dashboard/components/dashboard/DeveloperPanel.tsx.",
        verificationCommands: ["npm run build", "npm run test:dashboard"],
      },
    ],
  },
  issueAttemptDetailResponseMock: {
    attempt: {
      taskId: "dev-issue-1",
      approvalRequestId: "approval-12345678",
      status: "awaiting_approval",
      createdAt: "2026-04-01T18:01:00.000Z",
      updatedAt: "2026-04-01T18:02:00.000Z",
      issueNumber: 42,
      issueTitle: "Fix developer panel issue loop",
      repositoryFullName: "pohi9/mcp-brunella-core",
      targetFile:
        "src/dashboard/components/dashboard/DeveloperPanel.tsx",
      analysisSummary:
        "A legvalószínűbb belépési pont: src/dashboard/components/dashboard/DeveloperPanel.tsx.",
      verificationCommands: ["npm run build", "npm run test:dashboard"],
      verificationResults: [
        {
          normalizedCommand: "npm run build",
          success: true,
          exitCode: 0,
          combinedOutput: "Build ok",
        },
      ],
    },
  },
  approvalsResponseMock: { requests: [] },
  activityResponseMock: { activities: [] },
  gitStatusResponseMock: {
    status: {
      branch: "main",
      ahead: 0,
      behind: 0,
      staged: [],
      unstaged: [],
      untracked: [],
    },
  },
  gitBranchesResponseMock: { branches: [] },
}));

vi.mock("./DeveloperPipeline", () => ({
  DeveloperPipeline: ({
    progress,
  }: {
    progress: number;
    phases: Array<{ label: string; status: string }>;
  }) => <div data-testid="developer-pipeline">Progress: {progress}%</div>,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function mockFetchResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe("DeveloperPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith("/api/v1/developer/status")) {
          return Promise.resolve(
            mockFetchResponse({
              activeTasks: 0,
              completedTasks: 0,
              failedTasks: 0,
              totalTasks: 0,
            }),
          );
        }

        if (url.includes("/api/v1/developer/history")) {
          return Promise.resolve(mockFetchResponse({ history: [] }));
        }

        if (url.endsWith("/api/v1/developer/profile")) {
          return Promise.resolve(
            mockFetchResponse({
              profile: issueAnalysisResponseMock.analysis.profile,
            }),
          );
        }

        if (url.endsWith("/api/v1/developer/issue-fix-attempts")) {
          return Promise.resolve(mockFetchResponse(issueAttemptListResponseMock));
        }

        if (url.endsWith("/api/v1/developer/issue-fix-attempts/dev-issue-1")) {
          return Promise.resolve(
            mockFetchResponse(issueAttemptDetailResponseMock),
          );
        }

        if (url.endsWith("/api/v1/developer/issue/42/analyze")) {
          return Promise.resolve(mockFetchResponse(issueAnalysisResponseMock));
        }

        if (url.endsWith("/api/v1/developer/issue/42/fix-attempt")) {
          return Promise.resolve(
            mockFetchResponse({
              taskId: "dev-issue-1",
              approvalRequestId: "approval-12345678",
              status: "awaiting_approval",
              analysis: issueAnalysisResponseMock.analysis,
            }),
          );
        }

        if (url.endsWith("/api/v1/developer/execute")) {
          return Promise.resolve(mockFetchResponse(executeResponseMock));
        }

        if (url.endsWith("/api/v1/developer/pipeline/dev-1")) {
          return Promise.resolve(mockFetchResponse(pipelineResponseMock));
        }

        if (url.includes("/api/v1/developer/approval")) {
          return Promise.resolve(mockFetchResponse(approvalsResponseMock));
        }

        if (url.includes("/api/v1/developer/feed")) {
          return Promise.resolve(mockFetchResponse(activityResponseMock));
        }

        if (url.endsWith("/api/v1/developer/git/status")) {
          return Promise.resolve(mockFetchResponse(gitStatusResponseMock));
        }

        if (url.includes("/api/v1/developer/git/branches")) {
          return Promise.resolve(mockFetchResponse(gitBranchesResponseMock));
        }

        if (
          url.endsWith("/api/v1/developer/review") ||
          url.endsWith("/api/v1/developer/context") ||
          url.endsWith("/api/v1/developer/coverage")
        ) {
          return Promise.resolve(mockFetchResponse({}));
        }

        throw new Error(`Unhandled fetch: ${url} ${init?.method || "GET"}`);
      }),
    );
  });

  it("renders Review tab input when Review tab is active", async () => {
    render(<DeveloperPanel />);

    await userEvent.click(
      screen.getByRole("button", { name: /Review/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Enter file path to review/i),
      ).toBeInTheDocument();
    });
  });

  it("renders Approvals tab when Approvals button is clicked", async () => {
    render(<DeveloperPanel />);

    await userEvent.click(
      screen.getByRole("button", { name: /Approvals/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Approval Requests"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Human-in-the-loop confirmations for critical actions"),
      ).toBeInTheDocument();
    });
  });
});
