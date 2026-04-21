import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZeroPromptNotificationPanel } from '@/components/dashboard/ZeroPromptNotificationPanel';
import * as api from '@/lib/apiService';

const { socketMock } = vi.hoisted( () =>
{
    const listeners = new Map<string, Set<() => void>>();

    return {
        socketMock: {
            on: vi.fn( ( event: string, handler: () => void ) =>
            {
                const current = listeners.get( event ) ?? new Set<() => void>();
                current.add( handler );
                listeners.set( event, current );
            } ),
            off: vi.fn( ( event: string, handler?: () => void ) =>
            {
                if ( !handler )
                {
                    listeners.delete( event );
                    return;
                }

                listeners.get( event )?.delete( handler );
            } ),
            emitLocal: ( event: string ) =>
            {
                const handlers = listeners.get( event );
                if ( !handlers )
                {
                    return;
                }

                for ( const handler of handlers )
                {
                    handler();
                }
            },
            reset: () =>
            {
                listeners.clear();
            },
        },
    };
} );

vi.mock( '@/lib/apiService', () => ( {
    getApprovalNotificationSummary: vi.fn(),
    getApprovalNotificationDeliveries: vi.fn(),
    dispatchApprovalWorkflowNotification: vi.fn(),
} ) );

vi.mock( '@/context/SocketContext', () => ( {
    useSocket: () => ( { socket: socketMock } ),
} ) );

vi.mock( 'sonner', () => ( {
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
} ) );

const mockedApi = api as unknown as {
    getApprovalNotificationSummary: ReturnType<typeof vi.fn>;
    getApprovalNotificationDeliveries: ReturnType<typeof vi.fn>;
    dispatchApprovalWorkflowNotification: ReturnType<typeof vi.fn>;
};

describe( 'ZeroPromptNotificationPanel', () =>
{
    beforeEach( () =>
    {
        vi.clearAllMocks();
        socketMock.reset();
        mockedApi.getApprovalNotificationSummary.mockResolvedValue( {
            total: 2,
            sent: 1,
            failed: 1,
            skipped: 0,
            byChannel: { email: 2 },
            availableChannels: [
                { channel: 'email', enabled: true, target: 'alerts@example.com' },
                { channel: 'slack', enabled: false },
                { channel: 'discord', enabled: false },
            ],
            workflowCounts: {
                pending: 2,
                approved: 1,
                rejected: 0,
                expired: 0,
            },
        } );
        mockedApi.getApprovalNotificationDeliveries.mockResolvedValue( [
            {
                id: 'del-1',
                workflowId: 'wf-1',
                approvalRequestId: 'apr-1',
                channel: 'email',
                status: 'failed',
                eventType: 'approval_requested',
                title: 'Brunella Approval kérés — github.workflow_run.failure',
                message: 'Workflow: wf-1',
                createdAt: '2026-03-29T16:30:00.000Z',
                error: 'SMTP config missing',
            },
        ] );
        mockedApi.dispatchApprovalWorkflowNotification.mockResolvedValue( [
            {
                id: 'del-2',
                workflowId: 'wf-1',
                approvalRequestId: 'apr-1',
                channel: 'email',
                status: 'sent',
                eventType: 'approval_requested',
                title: 'Brunella Approval kérés — github.workflow_run.failure',
                message: 'Workflow: wf-1',
                createdAt: '2026-03-29T16:35:00.000Z',
            },
        ] );
    } );

    it( 'loads summary and deliveries', async () =>
    {
        await act( async () =>
        {
            render( <ZeroPromptNotificationPanel /> );
        } );

        await screen.findByText( 'Zero-Prompt Értesítések' );
        expect( screen.getByText( '2' ) ).toBeInTheDocument();
        expect( screen.getByText( 'Brunella Approval kérés — github.workflow_run.failure' ) ).toBeInTheDocument();
    } );

    it( 're-dispatches a workflow notification', async () =>
    {
        await act( async () =>
        {
            render( <ZeroPromptNotificationPanel /> );
        } );

        await screen.findByText( 'Brunella Approval kérés — github.workflow_run.failure' );

        fireEvent.click( screen.getByRole( 'button', { name: /újra/i } ) );

        await waitFor( () =>
        {
            expect( mockedApi.dispatchApprovalWorkflowNotification ).toHaveBeenCalledWith( 'wf-1' );
        } );
    } );

    it( 'refreshes when approval phoenix events arrive over the socket', async () =>
    {
        await act( async () =>
        {
            render( <ZeroPromptNotificationPanel /> );
        } );

        await screen.findByText( 'Zero-Prompt Értesítések' );
        expect( mockedApi.getApprovalNotificationSummary ).toHaveBeenCalledTimes( 1 );

        await act( async () =>
        {
            socketMock.emitLocal( 'phoenix:approval_requested' );
        } );

        await waitFor( () =>
        {
            expect( mockedApi.getApprovalNotificationSummary ).toHaveBeenCalledTimes( 2 );
        } );
    } );
} );