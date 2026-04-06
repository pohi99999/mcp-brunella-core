/**
 * MCP-style tool definition (skeleton) for creating a CRM lead.
 * This module exports a lightweight tool descriptor and a handler that returns a stub response.
 */

export interface CrmLeadParams {
  name: string;
  email?: string;
  note?: string;
  [key: string]: unknown;
}

export const crmCreateLeadTool = {
  name: 'crm_create_lead',
  description: 'Create a lead in the KKV CRM (stubbed tool).',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      email: { type: 'string' },
      note: { type: 'string' },
    },
    required: ['name'],
  },
};

export async function crmCreateLeadHandler(params: Partial<CrmLeadParams> = {}): Promise<{
  success: boolean;
  leadId: string;
  received: Partial<CrmLeadParams>;
  message: string;
}> {
  // Stubbed handler - in a real implementation this would call kkvCrmService or an external CRM API.
  return {
    success: true,
    leadId: 'crm-stub-1234',
    received: params,
    message: 'Stub response from crm_create_lead handler.',
  };
}
