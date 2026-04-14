import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TenantPlatformPanel } from '@/components/dashboard/TenantPlatformPanel';

describe('TenantPlatformPanel', () => {
  it('renders the tenant platform cockpit', () => {
    render(<TenantPlatformPanel />);

    expect(screen.getByTestId('tenant-platform-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Tenant Platform')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-action-list')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-action-create')).toBeInTheDocument();
    expect(screen.getByTestId('tenant-action-status')).toBeInTheDocument();
  });

  it('updates the command preview when tenant fields change', async () => {
    const user = userEvent.setup();
    render(<TenantPlatformPanel />);

    const tenantName = screen.getByLabelText('Tenant name');
    const tenantId = screen.getByLabelText('Tenant id');
    const domain = screen.getByLabelText('Tenant domain');

    await user.clear(tenantName);
    await user.type(tenantName, 'VV Luxury Drop');
    await user.clear(tenantId);
    await user.type(tenantId, 'vv-luxury-drop');
    await user.clear(domain);
    await user.type(domain, 'vv.example.com');
    await user.click(screen.getByTestId('tenant-action-create'));

    expect(screen.getByTestId('tenant-command-preview')).toHaveTextContent('brunella tenant create');
    expect(screen.getByTestId('tenant-command-preview')).toHaveTextContent('vv-luxury-drop');
    expect(screen.getByTestId('tenant-command-preview')).toHaveTextContent('vv.example.com');
    expect(screen.getByTestId('tenant-command-preview')).toHaveTextContent('--tier basic');
  });

  it('shows isolation and validation guidance', async () => {
    const user = userEvent.setup();
    render(<TenantPlatformPanel />);

    await user.click(screen.getByRole('tab', { name: 'Isolation' }));
    expect(screen.getByText(/X-Tenant-ID/i)).toBeInTheDocument();
    expect(screen.getByText(/storage\/tenants/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Tests' }));
    expect(screen.getByTestId('tenant-test-command')).toHaveTextContent('tenantRoutes.test.ts');
    expect(screen.getByTestId('tenant-test-command')).toHaveTextContent('TenantPlatformPanel.test.tsx');
  });
});
