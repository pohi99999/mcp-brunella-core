import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SalesPipelineWidget } from './SalesPipelineWidget.js';
import { toast } from 'sonner';

vi.mock( 'sonner', () => ( {
    toast: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
} ) );

function createResponse<T> ( body: T, ok = true, status = 200 ): Response
{
    return {
        ok,
        status,
        json: async () => body,
        text: async () => ( typeof body === 'string' ? body : JSON.stringify( body ) ),
    } as unknown as Response;
}

describe( 'SalesPipelineWidget', () =>
{
    afterEach( () =>
    {
        vi.unstubAllGlobals();
        vi.clearAllMocks();
    } );

    it( 'loads live sales pipeline data on mount', async () =>
    {
        let phase = 0;
        const fetchMock = vi.fn( async ( input: RequestInfo | URL ) =>
        {
            const url = String( input );

            if ( url.includes( '/pipeline/stats' ) )
            {
                return createResponse( {
                    success: true,
                    stats: phase === 0
                        ? [
                            { status: 'new', count: 1 },
                            { status: 'outreach', count: 1 },
                            { status: 'closed', count: 1 },
                        ]
                        : [],
                } );
            }

            if ( url.includes( '/leads/all' ) )
            {
                const response = phase === 0
                    ? {
                        success: true,
                        leads: [
                            {
                                id: 'lead-1',
                                company_name: 'Acme Kft.',
                                contact_person: 'Kiss Anna',
                                status: 'new',
                                last_interaction_at: '2026-04-15T08:00:00Z',
                                email_status: 'verified',
                                outreach_status: 'pending',
                            },
                            {
                                id: 'lead-2',
                                company_name: 'Northwind Zrt.',
                                contact_person: 'Nagy Péter',
                                status: 'outreach',
                                last_interaction_at: '2026-04-15T09:00:00Z',
                                email_status: 'unknown',
                                outreach_status: 'sent',
                            },
                            {
                                id: 'lead-3',
                                company_name: 'Futura Studio',
                                contact_person: 'Tóth Réka',
                                status: 'closed',
                                last_interaction_at: '2026-04-15T10:00:00Z',
                                email_status: 'verified',
                                outreach_status: 'done',
                            },
                        ],
                    }
                    : { success: true, leads: [] };

                phase += 1;
                return createResponse( response );
            }

            throw new Error( `Unexpected fetch: ${ url }` );
        } );

        vi.stubGlobal( 'fetch', fetchMock );

        render( <SalesPipelineWidget /> );

        expect( await screen.findByText( 'Acme Kft.' ) ).toBeInTheDocument();
        expect( screen.getByLabelText( 'Összegzés: Új' ) ).toHaveTextContent( '1' );
        expect( screen.getByLabelText( 'Összegzés: Futó' ) ).toHaveTextContent( '1' );
        expect( screen.getByLabelText( 'Összegzés: Lezárt' ) ).toHaveTextContent( '1' );

        expect( within( screen.getByLabelText( 'Stage: Új Leadek' ) ).getByText( 'Acme Kft.' ) ).toBeInTheDocument();
        expect( within( screen.getByLabelText( 'Stage: Megkeresés' ) ).getByText( 'Northwind Zrt.' ) ).toBeInTheDocument();
        expect( within( screen.getByLabelText( 'Stage: Lezárva' ) ).getByText( 'Futura Studio' ) ).toBeInTheDocument();
        expect( within( screen.getByLabelText( 'Lead: Acme Kft.' ) ).getByText( 'Email: verified' ) ).toBeInTheDocument();
    } );

    it( 'refreshes the live pipeline data when requested', async () =>
    {
        let phase = 0;
        const fetchMock = vi.fn( async ( input: RequestInfo | URL ) =>
        {
            const url = String( input );

            if ( url.includes( '/pipeline/stats' ) )
            {
                return createResponse( {
                    success: true,
                    stats: phase === 0
                        ? [{ status: 'new', count: 1 }]
                        : [
                            { status: 'responded', count: 1 },
                            { status: 'meeting', count: 1 },
                        ],
                } );
            }

            if ( url.includes( '/leads/all' ) )
            {
                const response = phase === 0
                    ? {
                        success: true,
                        leads: [
                            {
                                id: 'lead-1',
                                company_name: 'Acme Kft.',
                                status: 'new',
                            },
                        ],
                    }
                    : {
                        success: true,
                        leads: [
                            {
                                id: 'lead-2',
                                company_name: 'Gamma Studio Kft.',
                                status: 'meeting',
                                contact_person: 'Varga Dóra',
                            },
                        ],
                    };

                phase += 1;
                return createResponse( response );
            }

            throw new Error( `Unexpected fetch: ${ url }` );
        } );

        vi.stubGlobal( 'fetch', fetchMock );
        const user = userEvent.setup();

        render( <SalesPipelineWidget /> );

        expect( await screen.findByText( 'Acme Kft.' ) ).toBeInTheDocument();
        await user.click( screen.getByRole( 'button', { name: 'Sales pipeline frissítése' } ) );

        expect( await screen.findByText( 'Gamma Studio Kft.' ) ).toBeInTheDocument();
        await waitFor( () => expect( toast.success ).toHaveBeenCalledWith( 'Sales pipeline frissítve.' ) );
        expect( screen.queryByText( 'Acme Kft.' ) ).not.toBeInTheDocument();
        expect( screen.getByLabelText( 'Összegzés: Futó' ) ).toHaveTextContent( '2' );
    } );

    it( 'shows a warning banner when only one source fails', async () =>
    {
        const fetchMock = vi.fn( async ( input: RequestInfo | URL ) =>
        {
            const url = String( input );

            if ( url.includes( '/pipeline/stats' ) )
            {
                return createResponse( {
                    success: true,
                    stats: [
                        { status: 'new', count: 2 },
                        { status: 'closed', count: 1 },
                    ],
                } );
            }

            if ( url.includes( '/leads/all' ) )
            {
                return createResponse( { success: false, error: 'Lead lista nem érhető el' }, false, 503 );
            }

            throw new Error( `Unexpected fetch: ${ url }` );
        } );

        vi.stubGlobal( 'fetch', fetchMock );

        render( <SalesPipelineWidget /> );

        expect( await screen.findByRole( 'alert' ) ).toHaveTextContent( 'A sales pipeline lead lista része nem töltődött be.' );
        expect( screen.getByLabelText( 'Összegzés: Új' ) ).toHaveTextContent( '2' );
        expect( screen.getByLabelText( 'Összegzés: Lezárt' ) ).toHaveTextContent( '1' );
        expect( toast.warning ).not.toHaveBeenCalled();
    } );
} );
