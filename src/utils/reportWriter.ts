import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export interface MarkdownReportMetadata {
  title: string;
  date: string;
  generatedAt: string;
  generatedBy: string;
  reportType: string;
  periodStart?: string;
  periodEnd?: string;
  sources?: string[];
  tags?: string[];
  extra?: Record<string, string | number | boolean | string[]>;
}

function formatYamlArray(values: string[]): string {
  return `[${values.map((value) => JSON.stringify(value)).join(', ')}]`;
}

function buildFrontMatter(metadata: MarkdownReportMetadata): string {
  const lines = [
    '---',
    `title: ${JSON.stringify(metadata.title)}`,
    `date: ${JSON.stringify(metadata.date)}`,
    `generatedAt: ${JSON.stringify(metadata.generatedAt)}`,
    `generatedBy: ${JSON.stringify(metadata.generatedBy)}`,
    `reportType: ${JSON.stringify(metadata.reportType)}`,
  ];

  if (metadata.periodStart) lines.push(`periodStart: ${JSON.stringify(metadata.periodStart)}`);
  if (metadata.periodEnd) lines.push(`periodEnd: ${JSON.stringify(metadata.periodEnd)}`);
  if (metadata.sources && metadata.sources.length > 0) {
    lines.push(`sources: ${formatYamlArray(metadata.sources)}`);
  }
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`tags: ${formatYamlArray(metadata.tags)}`);
  }

  if (metadata.extra) {
    for (const [key, value] of Object.entries(metadata.extra)) {
      if (Array.isArray(value)) {
        lines.push(`${key}: ${formatYamlArray(value)}`);
      } else {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      }
    }
  }

  lines.push('---');
  return lines.join('\n');
}

export async function writeMarkdownReport(
  metadata: MarkdownReportMetadata,
  body: string,
  outputDir = 'docs/001_Jelentés',
  fileName = `${metadata.date}.md`,
): Promise<string> {
  const absoluteOutputDir = path.resolve(process.cwd(), outputDir);
  await mkdir(absoluteOutputDir, { recursive: true });

  const reportPath = path.join(absoluteOutputDir, fileName);
  const content = `${buildFrontMatter(metadata)}\n\n${body.trim()}\n`;
  await writeFile(reportPath, content, 'utf-8');

  return reportPath;
}
