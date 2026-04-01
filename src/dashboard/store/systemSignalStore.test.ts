/**
 * systemSignalStore.test.ts
 * Unit tests for the Zustand system signal store.
 * Tests state mutations via actions without any React rendering.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { useSystemSignalStore } from "./systemSignalStore";

// Reset the store to initial state before every test
beforeEach(() => {
  useSystemSignalStore.getState().clearAllData();
});

// ─────────────────────────────────────────────────────────────────────────────
// Connection state
// ─────────────────────────────────────────────────────────────────────────────

describe("connection state", () => {
  it("should_set_isConnected_true_when_setConnected_called_with_true", () => {
    useSystemSignalStore.getState().setConnected(true);

    expect(useSystemSignalStore.getState().isConnected).toBe(true);
  });

  it("should_set_isConnected_false_when_setConnected_called_with_false", () => {
    useSystemSignalStore.getState().setConnected(true);
    useSystemSignalStore.getState().setConnected(false);

    expect(useSystemSignalStore.getState().isConnected).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Log management
// ─────────────────────────────────────────────────────────────────────────────

describe("log management", () => {
  it("should_prepend_new_log_with_generated_id_when_addLog_called", () => {
    useSystemSignalStore.getState().addLog({ message: "hello", type: "info", timestamp: 1000 });

    const logs = useSystemSignalStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].message).toBe("hello");
    expect(logs[0].type).toBe("info");
    expect(logs[0].id).toMatch(/^log-\d+$/);
  });

  it("should_prepend_newer_logs_before_older_ones", () => {
    useSystemSignalStore.getState().addLog({ message: "first", type: "info", timestamp: 1000 });
    useSystemSignalStore.getState().addLog({ message: "second", type: "info", timestamp: 2000 });

    const logs = useSystemSignalStore.getState().logs;
    expect(logs[0].message).toBe("second");
    expect(logs[1].message).toBe("first");
  });

  it("should_not_exceed_200_logs_when_201_logs_added", () => {
    for (let i = 0; i < 201; i++) {
      useSystemSignalStore.getState().addLog({ message: `log-${i}`, type: "info", timestamp: i });
    }

    expect(useSystemSignalStore.getState().logs).toHaveLength(200);
  });

  it("should_keep_most_recent_logs_when_truncated", () => {
    for (let i = 0; i < 205; i++) {
      useSystemSignalStore.getState().addLog({ message: `msg-${i}`, type: "info", timestamp: i });
    }

    const logs = useSystemSignalStore.getState().logs;
    // Newest is msg-204, oldest retained is msg-5 (index 200 from the end = first element after slice)
    expect(logs[0].message).toBe("msg-204");
    expect(logs).toHaveLength(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent status
// ─────────────────────────────────────────────────────────────────────────────

describe("agent status", () => {
  it("should_add_agent_to_map_when_updateAgentStatus_called_with_new_agent", () => {
    useSystemSignalStore.getState().updateAgentStatus("Developer", "working", "building feature");

    const agent = useSystemSignalStore.getState().agents.get("Developer");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("Developer");
    expect(agent!.status).toBe("working");
    expect(agent!.taskDescription).toBe("building feature");
    expect(agent!.lastUpdated).toBeTypeOf("number");
  });

  it("should_update_existing_agent_status_when_updateAgentStatus_called_with_same_name", () => {
    useSystemSignalStore.getState().updateAgentStatus("Developer", "working");
    useSystemSignalStore.getState().updateAgentStatus("Developer", "idle");

    const agents = useSystemSignalStore.getState().agents;
    expect(agents.get("Developer")!.status).toBe("idle");
    expect(agents.size).toBe(1);
  });

  it("should_replace_all_agents_when_setAllAgentStatuses_called", () => {
    useSystemSignalStore.getState().updateAgentStatus("OldAgent", "idle");
    useSystemSignalStore.getState().setAllAgentStatuses([
      { name: "Developer", status: "working", lastUpdated: 0 },
      { name: "Evaluator", status: "idle", lastUpdated: 0 },
    ] as Parameters<typeof useSystemSignalStore.getState.prototype.setAllAgentStatuses>[0]);

    const agents = useSystemSignalStore.getState().agents;
    expect(agents.size).toBe(2);
    expect(agents.has("Developer")).toBe(true);
    expect(agents.has("Evaluator")).toBe(true);
    expect(agents.has("OldAgent")).toBe(false);
  });

  it("should_clear_all_agents_when_setAllAgentStatuses_called_with_empty_array", () => {
    useSystemSignalStore.getState().updateAgentStatus("Developer", "idle");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setAllAgentStatuses([] as any);

    expect(useSystemSignalStore.getState().agents.size).toBe(0);
  });

  it("should_record_lastUpdated_timestamp_when_agent_status_set", () => {
    const before = Date.now();
    useSystemSignalStore.getState().updateAgentStatus("Developer", "working");
    const after = Date.now();

    const ts = useSystemSignalStore.getState().agents.get("Developer")!.lastUpdated;
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task data
// ─────────────────────────────────────────────────────────────────────────────

describe("task data", () => {
  it("should_set_tasks_array_when_setTasks_called", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setTasks([{ id: 1, status: "running" }] as any);

    expect(useSystemSignalStore.getState().tasks).toHaveLength(1);
  });

  it("should_replace_tasks_when_setTasks_called_twice", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setTasks([{ id: 1 }] as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setTasks([{ id: 2 }, { id: 3 }] as any);

    expect(useSystemSignalStore.getState().tasks).toHaveLength(2);
  });

  it("should_set_taskStats_when_setTaskStats_called", () => {
    const stats = { total: 5, runningCount: 2, pendingCount: 1 } as Parameters<
      typeof useSystemSignalStore.getState.prototype.setTaskStats
    >[0];
    useSystemSignalStore.getState().setTaskStats(stats);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useSystemSignalStore.getState().taskStats as any).total).toBe(5);
  });

  it("should_set_healthStatus_when_setHealthStatus_called", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setHealthStatus({ status: "healthy", services: {} } as any);

    expect(useSystemSignalStore.getState().healthStatus).not.toBeNull();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useSystemSignalStore.getState().healthStatus as any).status).toBe("healthy");
  });

  it("should_set_developerMetrics_when_setDeveloperMetrics_called", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setDeveloperMetrics({ builds: { total: 10 } } as any);

    expect(useSystemSignalStore.getState().developerMetrics).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Robotkez plan
// ─────────────────────────────────────────────────────────────────────────────

describe("robotkez plan", () => {
  const samplePlan = {
    taskId: "task-1",
    plan: {
      estimatedDuration: 5000,
      plan: [
        { description: "Step 1", index: 0, status: "pending" as const },
        { description: "Step 2", index: 1, status: "pending" as const },
      ],
    },
  };

  it("should_set_robotkez_plan_and_generate_steps_with_pending_status_when_setRobotkezPlan_called", () => {
    useSystemSignalStore.getState().setRobotkezPlan(samplePlan);

    const { robotkezPlan, robotkezSteps } = useSystemSignalStore.getState();
    expect(robotkezPlan!.taskId).toBe("task-1");
    expect(robotkezSteps).toHaveLength(2);
    expect(robotkezSteps[0].status).toBe("pending");
    expect(robotkezSteps[0].index).toBe(0);
    expect(robotkezSteps[1].description).toBe("Step 2");
  });

  it("should_update_specific_step_by_index_when_updateRobotkezStep_called", () => {
    useSystemSignalStore.getState().setRobotkezPlan(samplePlan);
    useSystemSignalStore.getState().updateRobotkezStep({ index: 1, status: "completed" });

    const steps = useSystemSignalStore.getState().robotkezSteps;
    expect(steps[0].status).toBe("pending");
    expect(steps[1].status).toBe("completed");
    expect(steps[1].description).toBe("Step 2");
  });

  it("should_not_modify_other_steps_when_one_step_is_updated", () => {
    useSystemSignalStore.getState().setRobotkezPlan(samplePlan);
    useSystemSignalStore.getState().updateRobotkezStep({ index: 0, status: "working" });

    expect(useSystemSignalStore.getState().robotkezSteps[1].status).toBe("pending");
  });

  it("should_clear_plan_and_steps_when_clearRobotkez_called", () => {
    useSystemSignalStore.getState().setRobotkezPlan(samplePlan);
    useSystemSignalStore.getState().clearRobotkez();

    expect(useSystemSignalStore.getState().robotkezPlan).toBeNull();
    expect(useSystemSignalStore.getState().robotkezSteps).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error and loading state
// ─────────────────────────────────────────────────────────────────────────────

describe("error and loading state", () => {
  it("should_set_error_message_when_setError_called", () => {
    useSystemSignalStore.getState().setError("Connection timeout");

    expect(useSystemSignalStore.getState().error).toBe("Connection timeout");
  });

  it("should_clear_error_when_setError_called_with_null", () => {
    useSystemSignalStore.getState().setError("Some error");
    useSystemSignalStore.getState().setError(null);

    expect(useSystemSignalStore.getState().error).toBeNull();
  });

  it("should_set_isLoading_true_when_setLoading_called_with_true", () => {
    useSystemSignalStore.getState().setLoading(true);

    expect(useSystemSignalStore.getState().isLoading).toBe(true);
  });

  it("should_set_isLoading_false_when_setLoading_called_with_false", () => {
    useSystemSignalStore.getState().setLoading(true);
    useSystemSignalStore.getState().setLoading(false);

    expect(useSystemSignalStore.getState().isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// clearAllData
// ─────────────────────────────────────────────────────────────────────────────

describe("clearAllData", () => {
  it("should_reset_all_state_fields_to_initial_values_when_clearAllData_called", () => {
    // Populate state
    useSystemSignalStore.getState().setConnected(true);
    useSystemSignalStore.getState().addLog({ message: "test", type: "info", timestamp: 1 });
    useSystemSignalStore.getState().updateAgentStatus("Developer", "working");
    useSystemSignalStore.getState().setError("err");
    useSystemSignalStore.getState().setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setHealthStatus({ status: "healthy" } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSystemSignalStore.getState().setTasks([{ id: 1 }] as any);

    useSystemSignalStore.getState().clearAllData();

    const s = useSystemSignalStore.getState();
    expect(s.isConnected).toBe(false);
    expect(s.logs).toHaveLength(0);
    expect(s.agents.size).toBe(0);
    expect(s.chatter).toHaveLength(0);
    expect(s.tasks).toHaveLength(0);
    expect(s.taskStats).toBeNull();
    expect(s.healthStatus).toBeNull();
    expect(s.developerMetrics).toBeNull();
    expect(s.error).toBeNull();
    expect(s.isLoading).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Machine alerts
// ─────────────────────────────────────────────────────────────────────────────

describe("machine alerts", () => {
  it("should_add_alert_to_machineAlerts_when_addMachineAlert_called", () => {
    useSystemSignalStore.getState().addMachineAlert({ type: "cpu_spike", value: 95 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useSystemSignalStore.getState() as any).machineAlerts).toHaveLength(1);
  });

  it("should_clear_all_machine_alerts_when_clearMachineAlerts_called", () => {
    useSystemSignalStore.getState().addMachineAlert({ type: "cpu_spike" });
    useSystemSignalStore.getState().addMachineAlert({ type: "memory_high" });
    useSystemSignalStore.getState().clearMachineAlerts();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((useSystemSignalStore.getState() as any).machineAlerts).toHaveLength(0);
  });
});
