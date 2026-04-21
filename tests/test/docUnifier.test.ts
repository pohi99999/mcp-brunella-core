import { afterEach, describe, expect, it } from "vitest";

import { createDocsConfigFixture } from "./docsConfigFixture.js";
import { buildDocsConfigSotSnapshot } from "../src/tools/docsConfigSot.js";
import { buildDocsUnifierReport, renderDocsUnifierMarkdown } from "../src/tools/docUnifier.js";

describe("docUnifier / report", () => {
  const fixtures: Array<{ cleanup: () => void }> = [];

  afterEach(() => {
    while (fixtures.length > 0) {
      fixtures.pop()?.cleanup();
    }
  });

  it("reports a healthy canonical docs surface when everything is present", () => {
    const fixture = createDocsConfigFixture();
    fixtures.push(fixture);

    const snapshot = buildDocsConfigSotSnapshot(fixture.rootDir);
    const report = buildDocsUnifierReport(snapshot);

    expect(report.summary.status).toBe("healthy");
    expect(report.missingCanonical).toHaveLength(0);
    expect(report.missingManagedMarkers).toHaveLength(0);
    expect(report.recommendations[0]?.id).toBe("docs-healthy");
  });

  it("renders docs unifier markdown", () => {
    const fixture = createDocsConfigFixture();
    fixtures.push(fixture);

    const snapshot = buildDocsConfigSotSnapshot(fixture.rootDir);
    const report = buildDocsUnifierReport(snapshot);
    const markdown = renderDocsUnifierMarkdown(report);

    expect(markdown).toContain("# Docs Unifier");
    expect(markdown).toContain("## Canonical docs");
    expect(markdown).toContain("## Recommendations");
  });
});

