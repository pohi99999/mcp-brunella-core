import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getBasCloudflareApiToken,
  getCloudflareApiToken,
  getCloudflareAuthHeaders,
} from "@packages/utils/cloudflareConfig.js";

describe("cloudflareConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers BAS-scoped tokens for BAS routes", () => {
    vi.stubEnv("CF_BAS_API_TOKEN", "bas-token");
    vi.stubEnv("CF_AI_API_TOKEN", "ai-token");

    expect(getBasCloudflareApiToken()).toBe("bas-token");
    expect(getCloudflareApiToken()).toBe("bas-token");
  });

  it("does not reuse AI-only tokens for BAS auth headers", () => {
    vi.stubEnv("CF_BAS_API_TOKEN", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");
    vi.stubEnv("CF_API_TOKEN", "");
    vi.stubEnv("CF_TOKEN", "");
    vi.stubEnv("CF_AI_API_TOKEN", "ai-only-token");
    vi.stubEnv("CEAN_API_KEY", "");

    expect(getBasCloudflareApiToken()).toBeUndefined();
    expect(getCloudflareAuthHeaders()).toEqual({ "Content-Type": "application/json" });
  });
});
