import { generateResponse } from "@packages/core-logic/llm_client.js";
import { getWorkspaceClient } from "@packages/utils/unifiedWorkspace.js";
import {
  captureValidationResult,
  callAnthropicText,
  optionalNumber,
  optionalString,
  requireString,
  stringArrayParam,
  type SkillParams,
} from "./skill-helpers.js";
import type { BrunellaSkill } from "./skill.interface.js";

function buildContentPrompt(params: {
  topic: string;
  audience?: string;
  keywords: string[];
  tone?: string;
  language?: string;
  wordCount: number;
}): string {
  return [
    "Írj egy SEO-optimalizált, publikálásra kész tartalmat az alábbi brief alapján.",
    `Téma: ${params.topic}`,
    params.audience ? `Célközönség: ${params.audience}` : undefined,
    params.keywords.length > 0 ? `Kulcsszavak: ${params.keywords.join(", ")}` : undefined,
    params.tone ? `Hangnem: ${params.tone}` : undefined,
    params.language ? `Nyelv: ${params.language}` : undefined,
    `Hosszkövetelmény: körülbelül ${params.wordCount} szó`,
    "Add meg a végén a javasolt címet, meta descriptiont és 5 SEO tippet is.",
  ]
    .filter(Boolean)
    .join("\n");
}

function validateContentWriterSkill(params: SkillParams) {
  return captureValidationResult(() => {
    requireString(params, "topic", "topic");
  });
}

export const ContentWriterSkill: BrunellaSkill = {
  name: "content-writer",
  description:
    "SEO-kompatibilis tartalmat generál Claude/Gemini modellekkel és Google Docs-ba menti.",
  version: "1.0.0",
  category: "marketing",
  tools: ["claude_message", "gemini_generate", "google_workspace"],
  agents: ["SpecWriter", "copywriter"],
  validate(params: SkillParams): boolean {
    return validateContentWriterSkill(params).valid;
  },
  getValidationResult: validateContentWriterSkill,
  async execute(params: SkillParams): Promise<unknown> {
    try {
      const topic = requireString(params, "topic", "topic");
      const audience = optionalString(params, "audience");
      const keywords = stringArrayParam(params, "keywords");
      const tone = optionalString(params, "tone") ?? "professzionális";
      const language = optionalString(params, "language") ?? "magyar";
      const documentTitle =
        optionalString(params, "documentTitle") ?? `${topic} — SEO content`;
      const wordCount = Math.max(300, Math.min(optionalNumber(params, "wordCount") ?? 900, 3000));

      const contentPrompt = buildContentPrompt({
        topic,
        audience,
        keywords,
        tone,
        language,
        wordCount,
      });

      const claudeDraft = await callAnthropicText(
        [
          {
            role: "system",
            content:
              "Te egy magyar nyelvű, senior SEO tartalomszerző vagy. Legyen a szöveg természetes, tiszta és üzletileg hatásos.",
          },
          { role: "user", content: contentPrompt },
        ],
      );

      const geminiReview = await generateResponse(
        [
          "Elemezd az alábbi tartalmat SEO és olvashatósági szempontból.",
          `Téma: ${topic}`,
          `Kulcsszavak: ${keywords.join(", ") || "nincs"}`,
          "Tartalom:",
          claudeDraft,
          "Adj rövid javítási javaslatokat, meta title-t és meta descriptiont.",
        ].join("\n\n"),
        "gemini",
      );

      const finalDocument = [
        `# ${documentTitle}`,
        "",
        claudeDraft,
        "",
        "## SEO review",
        "",
        geminiReview,
      ].join("\n");

      const workspace = await getWorkspaceClient();
      const documentUrl = await workspace.createDocument(finalDocument, documentTitle);

      return {
        success: true,
        skill: this.name,
        documentTitle,
        topic,
        audience,
        keywords,
        tone,
        language,
        documentUrl,
        contentPreview: claudeDraft.slice(0, 1200),
        seoReview: geminiReview,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        skill: this.name,
        error: message,
      };
    }
  },
};

export default ContentWriterSkill;


