import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BadgePlus, Building2, Database, FileKey2, ListChecks, ShieldCheck } from 'lucide-react';

const TIER_OPTIONS = ['free', 'basic', 'premium', 'enterprise'] as const;
const ACTIONS = ['list', 'create', 'status'] as const;

type TenantAction = (typeof ACTIONS)[number];

function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'tenant';
}

export function TenantPlatformPanel() {
  const [tenantName, setTenantName] = useState('vv-luxury');
  const [tenantId, setTenantId] = useState('vv-luxury');
  const [domain, setDomain] = useState('vv.example.com');
  const [tier, setTier] = useState<(typeof TIER_OPTIONS)[number]>('basic');
  const [action, setAction] = useState<TenantAction>('create');

  const safeTenantId = useMemo(() => slugify(tenantId || tenantName), [tenantId, tenantName]);
  const storageRoot = useMemo(() => `storage/tenants/${safeTenantId}`, [safeTenantId]);
  const apiRoute = useMemo(() => `/api/v1/tenants${action === 'status' ? `/${safeTenantId}/status` : ''}`, [action, safeTenantId]);

  const command = useMemo(() => {
    if (action === 'list') {
      return 'brunella tenant list';
    }

    if (action === 'status') {
      return `brunella tenant status ${safeTenantId}`;
    }

    const parts = [
      'brunella tenant create',
      `--name "${tenantName}"`,
      `--id ${safeTenantId}`,
      `--domain ${domain}`,
      `--tier ${tier}`,
    ];

    return parts.join(' ');
  }, [action, domain, safeTenantId, tenantName, tier]);

  return (
    <div className="space-y-6" data-testid="tenant-platform-dashboard">
      <Card className="overflow-hidden border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.16),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_28%),linear-gradient(180deg,rgba(9,12,20,0.96),rgba(6,8,14,0.98))] shadow-[0_24px_80px_-42px_rgba(0,0,0,0.92)]">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-zinc-200">
                <ShieldCheck className="h-6 w-6 text-cyan-300" />
                <CardTitle className="text-3xl font-semibold tracking-tight text-white">Tenant Platform</CardTitle>
              </div>
              <CardDescription className="max-w-3xl text-sm leading-6 text-zinc-300">
                Multi-tenant foundation cockpit. The primary workflow is list {'->'} create {'->'} status, with X-Tenant-ID enforced at the API boundary and a tenant-specific storage root under storage/tenants.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-cyan-400/20 bg-cyan-400/10 text-cyan-200">X-Tenant-ID required</Badge>
              <Badge className="border-emerald-400/20 bg-emerald-400/10 text-emerald-200">storage isolation</Badge>
              <Badge className="border-violet-400/20 bg-violet-400/10 text-violet-200">system tenant guard</Badge>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Frictionless</div>
              <div className="mt-2 text-sm font-medium text-white">1 cockpit, 3 admin actions, deterministic tenant context</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Craft</div>
              <div className="mt-2 text-sm font-medium text-white">Dark ops palette + explicit tenant identity cues</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-[11px] uppercase tracking-[0.24em] text-zinc-500">Trustworthy</div>
              <div className="mt-2 text-sm font-medium text-white">Tenant scope is visible before any command or API call</div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="border-white/10 bg-zinc-950/70 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.92)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Building2 className="h-5 w-5 text-cyan-300" /> Tenant setup
            </CardTitle>
            <CardDescription>Define the active tenant context before switching commands or checking status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Tenant name</label>
              <Input value={tenantName} onChange={(event) => setTenantName(event.target.value)} aria-label="Tenant name" className="border-white/10 bg-white/[0.03] text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Tenant ID</label>
              <Input value={tenantId} onChange={(event) => setTenantId(event.target.value)} aria-label="Tenant id" className="border-white/10 bg-white/[0.03] text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Domain</label>
              <Input value={domain} onChange={(event) => setDomain(event.target.value)} aria-label="Tenant domain" className="border-white/10 bg-white/[0.03] text-white" />
            </div>

            <Separator className="bg-white/10" />

            <div className="space-y-3">
              <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">Tier</div>
              <div className="grid grid-cols-2 gap-2">
                {TIER_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    type="button"
                    variant={tier === option ? 'default' : 'outline'}
                    className={tier === option ? 'justify-start bg-emerald-600 text-white hover:bg-emerald-500' : 'justify-start border-white/10 bg-transparent text-zinc-300 hover:bg-white/[0.05]'}
                    onClick={() => setTier(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-cyan-400/15 bg-cyan-400/5 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Isolation footprint</div>
              <div className="mt-3 space-y-2 text-sm text-zinc-200">
                <div><span className="text-zinc-500">Header:</span> X-Tenant-ID: {safeTenantId}</div>
                <div><span className="text-zinc-500">Storage:</span> {storageRoot}</div>
                <div><span className="text-zinc-500">API route:</span> {apiRoute}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-white/10 bg-zinc-950/70 shadow-[0_18px_60px_-36px_rgba(0,0,0,0.92)]">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-white">Tenant operations</CardTitle>
                  <CardDescription>The selected action updates the command preview and the API shape.</CardDescription>
                </div>
                <div className="min-w-[180px]">
                  <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-500">
                    <span>Coverage footprint</span>
                    <span>3/3</span>
                  </div>
                  <Progress value={100} aria-label="Tenant operations coverage" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 xl:grid-cols-3">
              {ACTIONS.map((candidate) => {
                const active = action === candidate;
                const Icon = candidate === 'list' ? ListChecks : candidate === 'create' ? BadgePlus : FileKey2;

                return (
                  <button
                    key={candidate}
                    type="button"
                    onClick={() => setAction(candidate)}
                    className={`rounded-3xl border p-5 text-left transition ${active ? 'border-white/20 bg-white/[0.06] shadow-[0_18px_50px_-40px_rgba(255,255,255,0.35)]' : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'}`}
                    data-testid={`tenant-action-${candidate}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.04] text-cyan-300">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="text-sm font-semibold text-white">{candidate}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          {candidate === 'list' ? 'Tenant registry view' : candidate === 'create' ? 'Bootstrap a new tenant' : 'Check one tenant boundary'}
                        </div>
                      </div>
                      {active ? <Badge className="border-white/15 bg-white/10 text-white">active</Badge> : null}
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-300">
                      {candidate === 'list'
                        ? 'Shows the registered tenants and their metadata.'
                        : candidate === 'create'
                          ? 'Initializes the tenant storage root and inserts the tenant record.'
                          : 'Shows the tenant-specific task counts, storage root and isolation footprint.'}
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Tabs defaultValue="commands" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3 bg-zinc-950/70">
              <TabsTrigger value="commands">Commands</TabsTrigger>
              <TabsTrigger value="isolation">Isolation</TabsTrigger>
              <TabsTrigger value="tests">Tests</TabsTrigger>
            </TabsList>

            <TabsContent value="commands">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Primary command preview</CardTitle>
                  <CardDescription>The preview follows the selected action and the current tenant form values.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 text-xs uppercase tracking-[0.2em] text-cyan-300">Selected action</div>
                    <div className="text-sm font-medium text-white">{action}</div>
                  </div>
                  <pre className="overflow-x-auto rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-100" data-testid="tenant-command-preview">{command}</pre>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" className="bg-cyan-600 hover:bg-cyan-500" onClick={() => setAction('create')}>Create</Button>
                    <Button type="button" variant="outline" className="border-white/10 text-zinc-200 hover:bg-white/[0.05]" onClick={() => setAction('list')}>List</Button>
                    <Button type="button" variant="outline" className="border-white/10 text-zinc-200 hover:bg-white/[0.05]" onClick={() => setAction('status')}>Status</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="isolation">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Isolation guarantees</CardTitle>
                  <CardDescription>Tenant boundaries must remain visible at the API, data and storage layers.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Database className="h-4 w-4 text-emerald-300" />
                      Data boundary
                    </div>
                    <div className="mt-2 text-sm text-zinc-300">SQLite rows carry tenant_id and tenant-aware queries must stay filtered.</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <FileKey2 className="h-4 w-4 text-fuchsia-300" />
                      API boundary
                    </div>
                    <div className="mt-2 text-sm text-zinc-300">X-Tenant-ID is part of the request contract for tenant-scoped operations.</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tests">
              <Card className="border-white/10 bg-zinc-950/70">
                <CardHeader>
                  <CardTitle className="text-white">Validation slice</CardTitle>
                  <CardDescription>Tenant route, CLI and panel coverage can be run with focused Vitest commands.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <pre className="overflow-x-auto rounded-3xl border border-white/10 bg-black/40 p-4 text-sm text-zinc-100" data-testid="tenant-test-command">npx vitest run test/tenantRoutes.test.ts test/tenantCommands.test.ts test/dashboard/components/TenantPlatformPanel.test.tsx</pre>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-zinc-300">
                    The tenant management track should keep the system tenant visible while ensuring every other tenant remains isolated behind its own header and storage root.
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
