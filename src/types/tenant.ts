export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
}

export interface TenantContext {
  tenantId: string;
}

export interface TenantCounts {
  tasks: number;
  studioProjects: number;
  businessJobs: number;
  businessLeads: number;
  pullRequests: number;
}

export interface TenantStatus extends Tenant {
  storagePath: string;
  counts: TenantCounts;
  activeWorkItems: number;
}

export interface TenantCreateInput {
  id?: string;
  name: string;
  domain?: string;
  tier?: Tenant['tier'];
  status?: Tenant['status'];
}
