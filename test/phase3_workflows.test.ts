import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const workflowDir = path.join(
  process.cwd(),
  'conductor',
  'tracks',
  'n8n_konyveles_pipeline_20260328',
  'n8n-workflows',
);

function readWorkflow(fileName: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(workflowDir, fileName), 'utf8')) as Record<string, unknown>;
}

function getNode(workflow: Record<string, unknown>, nodeId: string): Record<string, unknown> {
  const nodes = workflow.nodes as Array<Record<string, unknown>>;
  const node = nodes.find((item) => item.id === nodeId);
  expect(node).toBeDefined();
  return node as Record<string, unknown>;
}

describe('Phase 3 workflow scaffolds', () => {
  it('routes outgoing invoices through the BAS invoice create alias', () => {
    const workflow = readWorkflow('wf6-szamlazz-outgoing-live.json');
    const requestNode = getNode(workflow, 'szamlazz-request');

    expect(requestNode.name).toBe('Create Invoice via BAS Route');
    expect((requestNode.parameters as Record<string, unknown>).url).toBe('http://localhost:3000/api/v1/invoice/create');
  });

  it('hands successful intake emails off to NAV validation', () => {
    const workflow = readWorkflow('wf7-imap-email-intake-live.json');
    const triggerNode = getNode(workflow, 'nav-live-trigger');
    const normalizeNode = getNode(workflow, 'normalize-email');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;
    const invoiceField = (normalizeNode.parameters as Record<string, unknown>).values as Record<string, unknown>;

    expect(triggerNode.name).toBe('Trigger NAV Validation');
    expect((triggerNode.parameters as Record<string, unknown>).url).toBe('http://localhost:5678/webhook/nav-validate-live');
    expect(JSON.stringify(invoiceField)).toContain('data?.invoice');
    expect(JSON.stringify(invoiceField)).toContain('data?.invoices?.[0]');
    expect(connections['Record Intake Success']).toMatchObject({
      main: [[{ node: 'Trigger NAV Validation', type: 'main', index: 0 }]],
    });
  });

  it('exposes the live NAV validation webhook and mismatch branch', () => {
    const workflow = readWorkflow('wf8-nav-validation-live.json');
    const webhookNode = getNode(workflow, 'nav-live-webhook');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;

    expect((webhookNode.parameters as Record<string, unknown>).path).toBe('nav-validate-live');
    expect(connections['Normalize NAV Result']).toMatchObject({
      main: [
        [{ node: 'Update Bookkeeping Status', type: 'main', index: 0 }],
        [{ node: 'Mismatch?', type: 'main', index: 0 }],
      ],
    });
  });

  it('uses bookkeeping status for the weekly report workflow', () => {
    const workflow = readWorkflow('wf9-weekly-report-live.json');
    const statusNode = getNode(workflow, 'get-bookkeeping-status');

    expect((statusNode.parameters as Record<string, unknown>).url).toBe('http://localhost:3000/api/v1/bookkeeping/status');
  });
});
