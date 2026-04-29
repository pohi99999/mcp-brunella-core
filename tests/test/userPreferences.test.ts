import { describe, it, expect, afterEach } from "vitest";
import {
  savePreference,
  queryPreferences,
  deletePreference,
  getPreferenceContext,
  getPreferenceStats,
  purgeExpiredPreferences,
} from "@packages/core-logic/userPreferences.js";

const makeTestPref = (overrides: Partial<{
  user_id: string; key: string; value: string; memory_type: "episodic" | "semantic" | "procedural";
}>) => ({
  user_id: overrides.user_id ?? "test-user",
  key: overrides.key ?? "test-key",
  value: overrides.value ?? "test-value",
  memory_type: overrides.memory_type ?? "semantic" as const,
  category: "general",
  confidence: 0.8,
  source_agent: "test",
  metadata_json: "{}",
  expires_at: null,
});

describe("userPreferences", () => {
  const testUserId = "test-user-" + Date.now();

  afterEach(() => {
    try {
      const prefs = queryPreferences({ user_id: testUserId, limit: 1000 });
      for (const p of prefs) {
        deletePreference(testUserId, p.key, p.memory_type as "episodic" | "semantic" | "procedural");
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should initialize schema via first save call", () => {
    // initSchema is called internally by getDb(), test it by saving
    expect(() => {
      savePreference(makeTestPref({ user_id: testUserId, key: "init-test", value: "ok" }));
    }).not.toThrow();
  });

  it("should save and query a preference", () => {
    savePreference(makeTestPref({ user_id: testUserId, key: "language", value: "hungarian" }));

    const results = queryPreferences({ user_id: testUserId });
    expect(results.length).toBeGreaterThanOrEqual(1);
    const found = results.find((p) => p.key === "language");
    expect(found).toBeDefined();
    expect(found!.value).toBe("hungarian");
  });

  it("should upsert on duplicate key", () => {
    savePreference(makeTestPref({ user_id: testUserId, key: "theme", value: "dark" }));
    savePreference(makeTestPref({ user_id: testUserId, key: "theme", value: "light" }));

    const results = queryPreferences({ user_id: testUserId, key: "theme" });
    expect(results.length).toBe(1);
    expect(results[0].value).toBe("light");
  });

  it("should filter by memory type", () => {
    savePreference(makeTestPref({ user_id: testUserId, key: "session-note", value: "crawl4ai", memory_type: "episodic" }));
    savePreference(makeTestPref({ user_id: testUserId, key: "pref-lang", value: "typescript", memory_type: "semantic" }));

    const episodic = queryPreferences({ user_id: testUserId, memory_type: "episodic" });
    expect(episodic.every((p) => p.memory_type === "episodic")).toBe(true);

    const semantic = queryPreferences({ user_id: testUserId, memory_type: "semantic" });
    expect(semantic.every((p) => p.memory_type === "semantic")).toBe(true);
  });

  it("should delete a preference", () => {
    savePreference(makeTestPref({ user_id: testUserId, key: "to-delete" }));

    const deleted = deletePreference(testUserId, "to-delete", "semantic");
    expect(deleted).toBe(true);

    const results = queryPreferences({ user_id: testUserId, key: "to-delete" });
    expect(results.length).toBe(0);
  });

  it("should generate preference context string", () => {
    savePreference(makeTestPref({ user_id: testUserId, key: "context-test", value: "test-value" }));

    const context = getPreferenceContext(testUserId);
    expect(typeof context).toBe("string");
    expect(context.length).toBeGreaterThan(0);
    expect(context).toContain("context-test");
  });

  it("should return stats", () => {
    savePreference(makeTestPref({ user_id: testUserId, key: "stats-test", value: "v1", memory_type: "procedural" }));

    const stats = getPreferenceStats(testUserId);
    expect(stats.total).toBeGreaterThanOrEqual(1);
    expect(stats.by_type).toBeDefined();
  });

  it("should purge expired preferences", () => {
    const count = purgeExpiredPreferences();
    expect(typeof count).toBe("number");
  });
});
