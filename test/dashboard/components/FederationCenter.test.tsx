import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FederationCenter } from '@/components/FederationCenter';
import * as api from '@/lib/apiService';

vi.mock( '@/lib/apiService', () => ( {
    getFederationPeers: vi.fn(),
    getFederationNegotiations: vi.fn(),
    getLocalFederationManifest: vi.fn(),
    registerFederationPeer: vi.fn(),
    revokeFederationPeer: vi.fn(),
    verifyFederationManifest: vi.fn(),
} ) );

vi.mock( 'sonner', () => ( {
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
} ) );

const mockedApi = api as unknown as {
    getFederationPeers: ReturnType<typeof vi.fn>;
    getFederationNegotiations: ReturnType<typeof vi.fn>;
    getLocalFederationManifest: ReturnType<typeof vi.fn>;
    registerFederationPeer: ReturnType<typeof vi.fn>;
    revokeFederationPeer: ReturnType<typeof vi.fn>;
    verifyFederationManifest: ReturnType<typeof vi.fn>;
};

describe( 'FederationCenter', () =>
{
    beforeEach( () =>
    {
        vi.clearAllMocks();
        mockedApi.getFederationPeers.mockResolvedValue( [
            {
                peerId: 'peer-1',
                displayName: 'Peer 1',
                endpoint: 'https://peer-1',
                trustState: 'trusted',
                trustedAt: '2026-03-30T10:00:00.000Z',
            },
        ] );
        mockedApi.getFederationNegotiations.mockResolvedValue( [
            {
                sessionId: 'session-1',
                state: 'offering',
                initialOffer: {
                    offerId: 'offer-1',
                    fromPeerId: 'local',
                    toPeerId: 'peer-1',
                    capabilities: ['agent_list'],
                    terms: {},
                    proposedAt: '2026-03-30T10:00:00.000Z',
                },
                createdAt: '2026-03-30T10:00:00.000Z',
                requiresApproval: false,
                transcript: [
                    {
                        timestamp: '2026-03-30T10:05:00.000Z',
                        action: 'offer_created',
                        actor: 'local',
                    },
                ],
            },
        ] );
        mockedApi.getLocalFederationManifest.mockResolvedValue( {
            manifestId: 'manifest-1',
            peerId: 'local-bas',
            capabilities: [
                { name: 'agent_list', description: 'Lists agents', version: '1.0.0' },
                { name: 'dynamic-tool', description: 'Dynamic tool', version: '2.0.0', deprecated: true },
            ],
            version: '1.0',
            issuedAt: '2026-03-30T10:00:00.000Z',
            expiresAt: '2026-03-30T11:00:00.000Z',
            signature: 'abc123signature',
        } );
        mockedApi.registerFederationPeer.mockResolvedValue( {} );
        mockedApi.revokeFederationPeer.mockResolvedValue( {} );
        mockedApi.verifyFederationManifest.mockResolvedValue( 'valid' );
    } );

    it( 'loads peers, manifest, and negotiations into the panel', async () =>
    {
        await act( async () =>
        {
            render( <FederationCenter /> );
        } );

        await screen.findByText( 'Federated MCP Center' );
        expect( screen.getByText( 'peer-1' ) ).toBeInTheDocument();
        expect( screen.getByRole( 'tab', { name: /Manifestek/i } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'tab', { name: /Tárgyalások/i } ) ).toBeInTheDocument();
        expect( mockedApi.getFederationPeers ).toHaveBeenCalledTimes( 1 );
        expect( mockedApi.getLocalFederationManifest ).toHaveBeenCalledTimes( 1 );
        expect( mockedApi.getFederationNegotiations ).toHaveBeenCalledTimes( 1 );
    } );

    it( 'registers a peer from the dashboard form', async () =>
    {
        await act( async () =>
        {
            render( <FederationCenter /> );
        } );

        fireEvent.change( screen.getByPlaceholderText( 'peer-id' ), { target: { value: 'peer-2' } } );
        fireEvent.change( screen.getByPlaceholderText( 'Megjelenítési név' ), { target: { value: 'Peer 2' } } );
        fireEvent.change( screen.getByPlaceholderText( 'https://peer.example.com' ), { target: { value: 'https://peer-2' } } );
        fireEvent.click( screen.getByRole( 'button', { name: 'Partner regisztrálása' } ) );

        await waitFor( () =>
        {
            expect( mockedApi.registerFederationPeer ).toHaveBeenCalledWith( {
                peerId: 'peer-2',
                displayName: 'Peer 2',
                endpoint: 'https://peer-2',
            } );
        } );
    } );
} );