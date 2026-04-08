import { Router } from "express";

import {
  buildDocsConfigSotSnapshot,
  renderDocsConfigSotMarkdown,
} from "../../tools/docsConfigSot.js";
import {
  buildDocsUnifierReport,
  renderDocsUnifierMarkdown,
} from "../../tools/docUnifier.js";
import {
  buildConfigGuardianReport,
  renderConfigGuardianMarkdown,
} from "../../tools/configGuardian.js";

export interface DocsConfigHealthResponse {
  snapshot: ReturnType<typeof buildDocsConfigSotSnapshot>;
  docs: ReturnType<typeof buildDocsUnifierReport>;
  config: ReturnType<typeof buildConfigGuardianReport>;
}

export interface DocsConfigMarkdownResponse {
  snapshot: string;
  docs: string;
  config: string;
}

function buildHealthResponse(): DocsConfigHealthResponse {
  const snapshot = buildDocsConfigSotSnapshot();
  return {
    snapshot,
    docs: buildDocsUnifierReport(snapshot),
    config: buildConfigGuardianReport(snapshot),
  };
}

export function createDocsConfigRoutes(): Router {
  const router = Router();

  router.get("/snapshot", (req, res) => {
    const snapshot = buildDocsConfigSotSnapshot();
    res.json(snapshot);
  });

  router.get("/health", (req, res) => {
    const response = buildHealthResponse();
    res.json(response);
  });

  router.get("/docs", (req, res) => {
    const snapshot = buildDocsConfigSotSnapshot();
    res.json(buildDocsUnifierReport(snapshot));
  });

  router.get("/config", (req, res) => {
    const snapshot = buildDocsConfigSotSnapshot();
    res.json(buildConfigGuardianReport(snapshot));
  });

  router.get("/markdown", (req, res) => {
    const snapshot = buildDocsConfigSotSnapshot();
    const markdown: DocsConfigMarkdownResponse = {
      snapshot: renderDocsConfigSotMarkdown(snapshot),
      docs: renderDocsUnifierMarkdown(buildDocsUnifierReport(snapshot)),
      config: renderConfigGuardianMarkdown(buildConfigGuardianReport(snapshot)),
    };
    res.json(markdown);
  });

  return router;
}

