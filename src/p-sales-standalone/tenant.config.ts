export interface TenantConfig {
  tenantId: string;
  name: string;
  authProvider: 'local' | 'clerk' | 'auth0';
}

export const defaultTenantConfig: TenantConfig = {
  tenantId: 'default',
  name: 'P-Sales',
  authProvider: 'local', // TODO [production-auth]: switch to 'clerk' or 'auth0' in production
};
