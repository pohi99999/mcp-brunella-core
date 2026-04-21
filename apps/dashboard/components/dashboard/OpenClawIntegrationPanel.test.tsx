import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpenClawIntegrationPanel } from './OpenClawIntegrationPanel';


afterEach( () =>
{
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
} );

describe( 'OpenClawIntegrationPanel', () =>
{
    it( 'renders the OpenClaw status snapshot returned by the API', async () =>
    {
        const fetchMock = vi.fn( async () => new Response( JSON.stringify( {
            success: true,
            data: {
                snapshot: {
                    config: {
                        baseUrl: 'https://openclaw.example.com',
                        timeoutMs: 5_000,
                        retryCount: 1,
                        retryDelayMs: 100,
                        defaultTrustZone: 'amber',
                        approvalThreshold: 'amber',
                        enabled: true,
                        allowedAgents: ['research-agent'],
                        allowedToolPresets: ['read-only'],
                        agentAllowlists: {},
                        redaction: {
                            enabled: true,
                            mask: '[REDACTED]',
                            sensitiveKeys: ['token'],
                        },
                    },
                    status: {
                        state: 'ready',
                        configured: true,
                        reachable: true,
                        baseUrl: 'https://openclaw.example.com',
                        defaultTrustZone: 'amber',
                        approvalThreshold: 'amber',
                        enabledExecutors: ['research-agent'],
                        redactionEnabled: true,
                        lastCheckedAt: '2026-04-17T00:00:00.000Z',
                        message: 'OpenClaw runtime ready',
                        details: {
                            notes: 'connected',
                        },
                    },
                },
                health: {
                    state: 'ready',
                    configured: true,
                    reachable: true,
                    baseUrl: 'https://openclaw.example.com',
                    defaultTrustZone: 'amber',
                    approvalThreshold: 'amber',
                    enabledExecutors: ['research-agent'],
                    redactionEnabled: true,
                    lastCheckedAt: '2026-04-17T00:00:00.000Z',
                    message: 'OpenClaw runtime ready',
                    details: {
                        notes: 'connected',
                    },
                },
            },
        } ), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        } ) );

        vi.stubGlobal( 'fetch', fetchMock );

        render( <OpenClawIntegrationPanel /> );

        expect( await screen.findByText( /OpenClaw Bridge/i ) ).toBeInTheDocument();
        expect( await screen.findByText( 'OpenClaw runtime ready' ) ).toBeInTheDocument();

        expect( screen.getByText( 'https://openclaw.example.com' ) ).toBeInTheDocument();
        expect( screen.getByText( /Allowed executors/i ) ).toBeInTheDocument();
        expect( fetchMock ).toHaveBeenCalledTimes( 1 );
    } );
} );
