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
  it('watches the bank import folder and routes CSVs through BankAgent', () => {
    const workflow = readWorkflow('wf2-bank-reconciliation.json');
    const triggerNode = getNode(workflow, 'bank-file-trigger');
    const importNode = getNode(workflow, 'bank-csv-import');
    const scheduleNode = getNode(workflow, 'schedule-trigger');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;

    expect(triggerNode.name).toBe('Bank CSV Folder Watch');
    expect(triggerNode.type).toBe('n8n-nodes-base.localFileTrigger');
    expect((triggerNode.parameters as Record<string, unknown>).triggerOn).toBe('folder');
    expect(String((triggerNode.parameters as Record<string, unknown>).path)).toContain('/app/data/bank-imports');
    expect(JSON.stringify(importNode.parameters)).toContain('/api/v1/agents/BankAgent/execute');
    expect(JSON.stringify(importNode.parameters)).toContain('bankCsvPath');
    expect((scheduleNode.parameters as Record<string, unknown>).rule).toMatchObject({
      interval: [{ field: 'days', daysInterval: 1, triggerAtHour: 8, triggerAtMinute: 0 }],
    });
    expect(connections['Bank CSV Folder Watch']).toMatchObject({
      main: [[{ node: 'Import Bank CSV via BAS Route', type: 'main', index: 0 }]],
    });
    expect(connections['Import Bank CSV via BAS Route']).toMatchObject({
      main: [[{ node: 'Fetch Bookkeeping Status', type: 'main', index: 0 }]],
    });
    expect(connections['Every Day 08:00']).toMatchObject({
      main: [[{ node: 'Fetch Bookkeeping Status', type: 'main', index: 0 }]],
    });
  });

  it('routes outgoing invoices through the BAS invoice create alias', () => {
    const workflow = readWorkflow('wf6-szamlazz-outgoing-live.json');
    const requestNode = getNode(workflow, 'szamlazz-request');
    const normalizeNode = getNode(workflow, 'temp-set-safe-full');
    const codeNode = getNode(workflow, 'temp-code-safe-full-2');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;

    expect(requestNode.name).toBe('Create Invoice via BAS Route');
    expect((requestNode.parameters as Record<string, unknown>).url).toBe('http://localhost:3000/api/v1/invoice/create');
    expect(normalizeNode.name).toBe('Normalize Temp Result');
    expect(normalizeNode.typeVersion).toBe(3.4);
    expect(codeNode.name).toBe('Add Invoice Number to Summary');
    expect(codeNode.type).toBe('n8n-nodes-base.code');
    expect(connections['Create Invoice via BAS Route']).toMatchObject({
      main: [[{ node: 'Normalize Temp Result', type: 'main', index: 0 }]],
    });
    expect(connections['Normalize Temp Result']).toMatchObject({
      main: [[{ node: 'Add Invoice Number to Summary', type: 'main', index: 0 }]],
    });
    expect(connections['Add Invoice Number to Summary']).toMatchObject({
      main: [[{ node: 'Szamlazz Success?', type: 'main', index: 0 }]],
    });
  });

  it('hands successful intake emails off to NAV validation', () => {
    const workflow = readWorkflow('wf7-imap-email-intake-live.json');
    const imapNode = getNode(workflow, 'imap-intake');
    const filterNode = getNode(workflow, 'invoice-filter');
    const saveNode = getNode(workflow, 'save-attachments');
    const triggerNode = getNode(workflow, 'nav-live-trigger');
    const normalizeNode = getNode(workflow, 'normalize-email');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;
    const normalizeAssignments = (normalizeNode.parameters as Record<string, unknown>).assignments as Record<string, unknown>;
    const saveCode = String((saveNode.parameters as Record<string, unknown>).jsCode);

    expect(imapNode.typeVersion).toBe(2.1);
    expect(imapNode.parameters).toMatchObject({
      mailbox: 'INBOX',
      postProcessAction: 'read',
      format: 'resolved',
      dataPropertyAttachmentsPrefixName: 'attachment_',
    });
    expect((imapNode.parameters as Record<string, unknown>).options).toMatchObject({
      customEmailConfig: '["UNSEEN"]',
      forceReconnect: 60,
      trackLastMessageId: true,
    });
    expect(normalizeNode.typeVersion).toBe(3.4);
    expect(normalizeNode.parameters).toMatchObject({
      mode: 'manual',
      includeOtherFields: true,
    });
    expect(filterNode.name).toBe('Filter Invoice Subject');
    expect(saveNode.name).toBe('Save Attachments to Inbox');
    expect(saveCode).toContain('BRUNELLA_WORKSPACE_ROOT');
    expect(saveCode).toContain("path.join(workspaceRoot, 'data', 'inbox')");
    expect(triggerNode.name).toBe('Trigger NAV Validation');
    expect((triggerNode.parameters as Record<string, unknown>).url).toBe('http://localhost:5678/webhook/nav-validate-live');
    expect(JSON.stringify(normalizeAssignments)).toContain('data?.invoice');
    expect(JSON.stringify(normalizeAssignments)).toContain('data?.invoices?.[0]');
    expect(JSON.stringify(normalizeAssignments)).toContain('savedAttachmentPaths');
    expect(connections['Filter Invoice Subject']).toMatchObject({
      main: [
        [{ node: 'Save Attachments to Inbox', type: 'main', index: 0 }],
        [{ node: 'Skip Non-Invoice Email', type: 'main', index: 0 }],
      ],
    });
    expect(connections['Save Attachments to Inbox']).toMatchObject({
      main: [[{ node: 'Parse Invoice with EmailAgent', type: 'main', index: 0 }]],
    });
    expect(connections['Record Intake Success']).toMatchObject({
      main: [[{ node: 'Trigger NAV Validation', type: 'main', index: 0 }]],
    });
  });

  it('exposes the live NAV validation webhook and mismatch branch', () => {
    const workflow = readWorkflow('wf8-nav-validation-live.json');
    const webhookNode = getNode(workflow, 'nav-live-webhook');
    const normalizeNode = getNode(workflow, 'temp-set-safe-nav');
    const codeNode = getNode(workflow, 'temp-code-safe-nav-2');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;

    expect((webhookNode.parameters as Record<string, unknown>).path).toBe('nav-validate-live');
    expect(normalizeNode.name).toBe('Normalize Temp Result');
    expect(normalizeNode.typeVersion).toBe(3.4);
    expect(codeNode.name).toBe('Add NAV Status to Summary');
    expect(connections['Validate Invoice with NavAgent']).toMatchObject({
      main: [[{ node: 'Normalize Temp Result', type: 'main', index: 0 }]],
    });
    expect(connections['Normalize Temp Result']).toMatchObject({
      main: [[{ node: 'Add NAV Status to Summary', type: 'main', index: 0 }]],
    });
    expect(connections['Add NAV Status to Summary']).toMatchObject({
      main: [
        [{ node: 'Update Bookkeeping Status', type: 'main', index: 0 }],
        [{ node: 'Mismatch?', type: 'main', index: 0 }],
      ],
    });
    expect(connections['Mismatch?']).toMatchObject({
      main: [[{ node: 'Notify NAV Mismatch', type: 'main', index: 0 }]],
    });
  });

  it('uses bookkeeping status for the weekly report workflow', () => {
    const workflow = readWorkflow('wf9-weekly-report-live.json');
    const cronNode = getNode(workflow, 'weekly-cron');
    const formatNode = getNode(workflow, 'format-weekly-report');
    const normalizeNode = getNode(workflow, 'temp-code-weekly');
    const statusNode = getNode(workflow, 'get-bookkeeping-status');
    const connections = workflow.connections as Record<string, Record<string, unknown>>;

    expect((cronNode.parameters as Record<string, unknown>).triggerTimes).toMatchObject({
      item: [{ mode: 'everyX', value: 168, unit: 'hours' }],
    });
    expect(formatNode.name).toBe('Format Weekly Report');
    expect(normalizeNode.name).toBe('Normalize Weekly Report');
    expect(normalizeNode.type).toBe('n8n-nodes-base.code');
    expect((statusNode.parameters as Record<string, unknown>).url).toBe('http://localhost:3000/api/v1/bookkeeping/status');
    expect(connections['Cron Trigger (Weekly)']).toMatchObject({
      main: [{ node: 'Get Bookkeeping Status', type: 'main', index: 0 }],
    });
    expect(connections['Get Bookkeeping Status']).toMatchObject({
      main: [{ node: 'Format Weekly Report', type: 'main', index: 0 }],
    });
    expect(connections['Format Weekly Report']).toMatchObject({
      main: [[{ node: 'Normalize Weekly Report', type: 'main', index: 0 }]],
    });
    expect(connections['Normalize Weekly Report']).toMatchObject({
      main: [[{ node: 'Send Weekly Report Email', type: 'main', index: 0 }]],
    });
  });

  it('keeps bookkeeping IMAP and Set nodes on n8n-supported versions', () => {
    for (const fileName of [
      'wf1-email-intake.json',
      'wf3-nav-validation.json',
      'wf4-exception-notify.json',
      'wf6-szamlazz-outgoing-live.json',
      'wf7-imap-email-intake-live.json',
      'wf8-nav-validation-live.json',
      'wf9-weekly-report-live.json',
    ]) {
      const workflow = readWorkflow(fileName);
      for (const node of workflow.nodes as Array<Record<string, unknown>>) {
        if (node.type === 'n8n-nodes-base.set') {
          expect(node.typeVersion).toBe(3.4);
        }
        if (node.type === 'n8n-nodes-base.emailReadImap') {
          expect(node.typeVersion).toBe(2.1);
        }
      }
    }
  });
});
