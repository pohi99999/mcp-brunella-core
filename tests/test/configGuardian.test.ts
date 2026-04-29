import { afterEach, describe, expect, it } from "vitest";

import { createDocsConfigFixture } from "./docsConfigFixture.js";
import { buildDocsConfigSotSnapshot } from "@packages/utils/docsConfigSot.js";
import { buildConfigGuardianReport, renderConfigGuardianMarkdown } from "@packages/utils/configGuardian.js";

describe("configGuardian / report", () => {
  const fixtures: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.cleanup();
    }
  });

  it("reports healthy coverage when docs, example and runtime keys align", () => {
    const fixture = createDocsConfigFixture();
    fixtures.push(fixture);

    const snapshot = buildDocsConfigSotSnapshot(fixture.rootDir);
    const report = buildConfigGuardianReport(snapshot);

    expect(report.summary.status).toBe("healthy");
    expect(report.missingFromDocs).toHaveLength(0);
    expect(report.missingFromExample).toHaveLength(0);
    expect(report.yamlBindingsMissingFromRuntime).toHaveLength(0);
    expect(report.recommendations[0]?.id).toBe("config-healthy");
  });

  it("renders config guardian markdown", () => {
    const fixture = createDocsConfigFixture();
    fixtures.push(fixture);

    const snapshot = buildDocsConfigSotSnapshot(fixture.rootDir);
    const report = buildConfigGuardianReport(snapshot);
    const markdown = renderConfigGuardianMarkdown(report);

    expect(markdown).toContain("# Config Guardian");
    expect(markdown).toContain("## Missing from docs");
    expect(markdown).toContain("## Recommendations");
  });
});

