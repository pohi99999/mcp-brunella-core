// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { OpenClawIntegrationPanel } from '@/components/dashboard/OpenClawIntegrationPanel.js';
import type { OpenClawRuntimeSnapshot } from '@packages/core-logic/openclaw/index.js';

vi.mock( '@/components/ui/scroll-area.js', () => ( {
    ScrollArea: ( { children }: { children: unknown } ) => createElement( 'div', { 'data-testid': 'scroll-area' }, children ),
} ) );

const originalFetch = globalThis.fetch;

function createDeferred<T> ()
{
    let resolve!: ( value: T | PromiseLike<T> ) => void;

    const promise = new Promise<T>( ( promiseResolve ) =>
    {
        resolve = promiseResolve;
    } );

    return { promise, resolve };
}

function buildSnapshot ( overrides: Partial<OpenClawRuntimeSnapshot> = {} ): OpenClawRuntimeSnapshot
{
    const base: OpenClawRuntimeSnapshot = {
        config: {
            enabled: true,
            baseUrl: 'https://openclaw.example.com',
            timeoutMs: 10_000,
            retryCount: 2,
            retryDelayMs: 250,
            defaultTrustZone: 'amber',
            approvalThreshold: 'amber',
            allowedAgents: ['research-agent'],
            allowedToolPresets: ['read-only'],
            agentAllowlists: {
                'research-agent': ['read-only'],
            },
            redaction: {
                enabled: true,
                mask: '[REDACTED]',
                sensitiveKeys: ['apiKey', 'token'],
            },
        },
        status: {
            state: 'ready',
            configured: true,
            reachable: true,
            baseUrl: 'https://openclaw.example.com',
            defaultTrustZone: 'green',
            approvalThreshold: 'amber',
            enabledExecutors: ['research-executor'],
            redactionEnabled: true,
            lastCheckedAt: '2026-04-17T12:00:00.000Z',
            message: 'OpenClaw is ready',
            details: {
                mode: 'ready',
            },
        },
    };

    return {
        config: {
            ...base.config,
            ...( overrides.config ?? {} ),
        },
        status: {
            ...base.status,
            ...( overrides.status ?? {} ),
        },
    };
}

function makeJsonResponse ( snapshot: OpenClawRuntimeSnapshot, status = 200 )
{
    return new Response( JSON.stringify( { success: true, data: { snapshot, health: snapshot.status } } ), {
        status,
        headers: {
            'Content-Type': 'application/json',
        },
    } );
}

function mockFetch ( responseFactory: () => Response | Promise<Response> )
{
    const fetchMock = vi.fn( async () => responseFactory() );
    vi.stubGlobal( 'fetch', fetchMock );
    return fetchMock;
}

describe( 'OpenClawIntegrationPanel', () =>
{
    beforeEach( () =>
    {
        vi.stubGlobal( 'fetch', originalFetch );
    } );

    afterEach( () =>
    {
        cleanup();
        vi.stubGlobal( 'fetch', originalFetch );
        vi.clearAllMocks();
    } );

    it( 'renders the loading state and then a ready green snapshot', async () =>
    {
        const snapshot = buildSnapshot( {
            config: {
                ...buildSnapshot().config,
                defaultTrustZone: 'green',
            },
        } );
        const deferred = createDeferred<Response>();
        const fetchMock = mockFetch( () => deferred.promise );

        render( createElement( OpenClawIntegrationPanel ) );

        expect( screen.getByText( 'Loading OpenClaw status…' ) ).toBeInTheDocument();
        await waitFor( () => expect( screen.getByRole( 'button', { name: 'Refresh' } ) ).toBeDisabled() );

        deferred.resolve( makeJsonResponse( snapshot ) );
        await screen.findByText( 'OpenClaw is ready' );

        expect( fetchMock ).toHaveBeenCalledTimes( 1 );
        expect( screen.getByText( 'OpenClaw Bridge' ) ).toBeInTheDocument();
        expect( screen.getByText( 'ready' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Default zone: green' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Approval threshold: amber' ) ).toBeInTheDocument();
        expect( screen.getByText( 'research-executor' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Policy notes' ) ).toBeInTheDocument();
        expect(
            screen.getByText( ( content, element ) =>
                element?.tagName.toLowerCase() === 'pre'
                && content.includes( 'research-agent' )
                && content.includes( 'read-only' ),
            ),
        ).toBeInTheDocument();
        expect( screen.getByText( ( content ) => content.includes( '2026' ) ) ).toBeInTheDocument();
    } );

    it( 'renders the offline amber snapshot and preserves an invalid timestamp string', async () =>
    {
        const snapshot = buildSnapshot( {
            status: {
                state: 'offline',
                configured: true,
                reachable: false,
                defaultTrustZone: 'amber',
                approvalThreshold: 'red',
                enabledExecutors: [],
                redactionEnabled: false,
                lastCheckedAt: 'not-a-date',
                message: 'OpenClaw is offline',
                details: {
                    reason: 'waiting for bootstrap',
                },
            },
            config: {
                ...buildSnapshot().config,
                defaultTrustZone: 'amber',
            },
        } );

        mockFetch( () => makeJsonResponse( snapshot ) );

        render( createElement( OpenClawIntegrationPanel ) );

        await screen.findByText( 'OpenClaw is offline' );

        expect( screen.getByText( 'offline' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Default zone: amber' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Approval threshold: red' ) ).toBeInTheDocument();
        expect( screen.getByText( 'None configured' ) ).toBeInTheDocument();
        expect( screen.getByText( 'not-a-date' ) ).toBeInTheDocument();
        expect(
            screen.getByText( ( content, element ) =>
                element?.tagName.toLowerCase() === 'pre'
                && content.includes( 'waiting for bootstrap' ),
            ),
        ).toBeInTheDocument();
    } );

    it( 'renders the degraded red snapshot with allowlists and a redaction-disabled note', async () =>
    {
        const snapshot = buildSnapshot( {
            status: {
                state: 'degraded',
                configured: true,
                reachable: true,
                defaultTrustZone: 'red',
                approvalThreshold: 'red',
                enabledExecutors: ['ops-executor'],
                redactionEnabled: false,
                lastCheckedAt: '2026-04-17T13:45:00.000Z',
                message: 'OpenClaw is degraded',
                details: {
                    reason: 'policy gates tightened',
                },
            },
            config: {
                ...buildSnapshot().config,
                defaultTrustZone: 'red',
                agentAllowlists: {
                    'ops-agent': ['shell', 'deploy'],
                },
                redaction: {
                    enabled: false,
                    mask: '[REDACTED]',
                    sensitiveKeys: ['apiKey', 'token'],
                },
            },
        } );

        mockFetch( () => makeJsonResponse( snapshot ) );

        render( createElement( OpenClawIntegrationPanel ) );

        await screen.findByText( 'OpenClaw is degraded' );

        expect( screen.getByText( 'degraded' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Default zone: red' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Approval threshold: red' ) ).toBeInTheDocument();
        expect( screen.getByText( 'ops-executor' ) ).toBeInTheDocument();
        expect(
            screen.getByText( ( content, element ) =>
                element?.tagName.toLowerCase() === 'pre'
                && content.includes( 'ops-agent' )
                && content.includes( 'shell' )
                && content.includes( 'deploy' )
                && content.includes( 'policy gates tightened' ),
            ),
        ).toBeInTheDocument();
    } );

    it( 'renders the unconfigured snapshot state', async () =>
    {
        const snapshot = buildSnapshot( {
            status: {
                state: 'unconfigured',
                configured: false,
                reachable: false,
                defaultTrustZone: 'green',
                approvalThreshold: 'amber',
                enabledExecutors: [],
                redactionEnabled: true,
                lastCheckedAt: '2026-04-17T14:00:00.000Z',
                message: 'OpenClaw is not configured',
                details: {
                    reason: 'no base URL provided',
                },
            },
            config: {
                ...buildSnapshot().config,
                defaultTrustZone: 'green',
                baseUrl: null,
            },
        } );

        mockFetch( () => makeJsonResponse( snapshot ) );

        render( createElement( OpenClawIntegrationPanel ) );

        await screen.findByText( 'OpenClaw is not configured' );

        expect( screen.getByText( 'unconfigured' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Default zone: green' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Approval threshold: amber' ) ).toBeInTheDocument();
        expect( screen.getByText( 'None configured' ) ).toBeInTheDocument();
        expect(
            screen.getByText( ( content, element ) =>
                element?.tagName.toLowerCase() === 'pre'
                && content.includes( 'no base URL provided' ),
            ),
        ).toBeInTheDocument();
    } );

    it( 'renders a loading error when the status endpoint fails', async () =>
    {
        const fetchMock = vi.fn( async () =>
            new Response( JSON.stringify( { success: false, error: 'OpenClaw backend unavailable' } ), {
                status: 503,
                headers: {
                    'Content-Type': 'application/json',
                },
            } ),
        );

        vi.stubGlobal( 'fetch', fetchMock );

        render( createElement( OpenClawIntegrationPanel ) );

        await screen.findByText( 'OpenClaw backend unavailable' );
        expect( fetchMock ).toHaveBeenCalledTimes( 1 );
    } );
} );
