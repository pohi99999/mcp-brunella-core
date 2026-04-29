import { afterEach, describe, expect, it } from "vitest";

import { createDocsConfigFixture } from "./docsConfigFixture.js";
import {
  buildDocsConfigSotSnapshot,
  renderDocsConfigSotMarkdown,
} from "@packages/utils/docsConfigSot.js";

describe("docsConfigSot / snapshot", () => {
  const fixtures: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.cleanup();
    }
  });

  it("captures a fully aligned docs/config snapshot", () => {
    const fixture = createDocsConfigFixture();
    fixtures.push(fixture);

    const snapshot = buildDocsConfigSotSnapshot(fixture.rootDir);

    expect(snapshot.summary.status).toBe("healthy");
    expect(snapshot.summary.score).toBeGreaterThanOrEqual(95);
    expect(snapshot.documents.missingRequired).toHaveLength(0);
    expect(snapshot.documents.missingManagedMarkers).toHaveLength(0);
    expect(snapshot.config.missingFromDocs).toHaveLength(0);
    expect(snapshot.config.missingFromExample).toHaveLength(0);
    expect(snapshot.config.yamlBindingsMissingFromRuntime).toHaveLength(0);
  });

  it("renders the unified snapshot markdown", () => {
    const fixture = createDocsConfigFixture();
    fixtures.push(fixture);

    const snapshot = buildDocsConfigSotSnapshot(fixture.rootDir);
    const markdown = renderDocsConfigSotMarkdown(snapshot);

    expect(markdown).toContain("# Documentation / Config SOT Snapshot");
    expect(markdown).toContain("## Documents");
    expect(markdown).toContain("## Config surfaces");
  });
});

