import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FederationCenter } from '@/components/FederationCenter';
import * as api from '@/lib/apiService';

vi.mock( '@/lib/apiService', () => ( {
    getFederationEvidence: vi.fn(),
    getFederationPeers: vi.fn(),
    getFederationNegotiations: vi.fn(),
    getLocalFederationManifest: vi.fn(),
    promoteFederationPeerRuntimeKey: vi.fn(),
    registerFederationPeer: vi.fn(),
    revokeFederationPeer: vi.fn(),
    stageFederationPeerRuntimeKey: vi.fn(),
    verifyFederationManifest: vi.fn(),
} ) );

vi.mock( 'sonner', () => ( {
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
} ) );

const mockedApi = api as unknown as {
    getFederationEvidence: ReturnType<typeof vi.fn>;
    getFederationPeers: ReturnType<typeof vi.fn>;
    getFederationNegotiations: ReturnType<typeof vi.fn>;
    getLocalFederationManifest: ReturnType<typeof vi.fn>;
    promoteFederationPeerRuntimeKey: ReturnType<typeof vi.fn>;
    registerFederationPeer: ReturnType<typeof vi.fn>;
    revokeFederationPeer: ReturnType<typeof vi.fn>;
    stageFederationPeerRuntimeKey: ReturnType<typeof vi.fn>;
    verifyFederationManifest: ReturnType<typeof vi.fn>;
};

describe( 'FederationCenter', () =>
{
    beforeEach( () =>
    {
        vi.clearAllMocks();
        mockedApi.getFederationEvidence.mockResolvedValue( {
            timestamp: '2026-03-30T10:10:00.000Z',
            peerFilter: null,
            limit: 24,
            truncated: false,
            peers: [
                {
                    peerId: 'peer-1',
                    displayName: 'Peer 1',
                    endpoint: 'https://peer-1',
                    trustState: 'trusted',
                    trustedAt: '2026-03-30T10:00:00.000Z',
                    revokedAt: null,
                    currentKeyId: 'current-key',
                    nextKeyId: 'next-key',
                    rotationState: 'staged',
                    lastEvidenceAt: '2026-03-30T10:10:00.000Z',
                    latestAction: 'Next kulcs stage-elve',
                    latestOutcome: 'allowed',
                    journalCount: 2,
                    registerCount: 1,
                    revokeCount: 0,
                    stageCount: 1,
                    promoteCount: 0,
                    routeDeniedCount: 0,
                },
            ],
            journal: [
                {
                    id: 'evt-1',
                    timestamp: '2026-03-30T10:10:00.000Z',
                    peerId: 'peer-1',
                    displayName: 'Peer 1',
                    endpoint: 'https://peer-1',
                    trustState: 'trusted',
                    kind: 'runtime_key_staged',
                    title: 'Next kulcs stage-elve',
                    detail: 'Key ID: next-key • előző current: current-key',
                    outcome: 'allowed',
                    keyId: 'next-key',
                    previousCurrentKeyId: 'current-key',
                    reason: null,
                    evidenceSources: ['phoenix', 'audit'],
                },
            ],
            totals: {
                peerCount: 1,
                trustedCount: 1,
                pendingCount: 0,
                revokedCount: 0,
                peersWithNextKey: 1,
                journalCount: 1,
                deniedCount: 0,
                registerCount: 1,
                revokeCount: 0,
                stageCount: 1,
                promoteCount: 0,
                routeDeniedCount: 0,
            },
        } );
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
        mockedApi.stageFederationPeerRuntimeKey.mockResolvedValue( {} );
        mockedApi.promoteFederationPeerRuntimeKey.mockResolvedValue( {} );
        mockedApi.verifyFederationManifest.mockResolvedValue( 'valid' );
    } );

    it( 'loads peers, manifest, and negotiations into the panel', async () =>
    {
        await act( async () =>
        {
            render( <FederationCenter /> );
        } );

        await screen.findByText( 'Federated MCP Center' );
        expect( screen.getByRole( 'cell', { name: 'peer-1' } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'tab', { name: /Manifestek/i } ) ).toBeInTheDocument();
        expect( screen.getByRole( 'tab', { name: /Tárgyalások/i } ) ).toBeInTheDocument();
        expect( screen.getByText( 'Operator journal' ) ).toBeInTheDocument();
        expect( screen.getAllByText( 'Next kulcs stage-elve' ).length ).toBeGreaterThan( 0 );
        expect( mockedApi.getFederationEvidence ).toHaveBeenCalledTimes( 1 );
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

    it( 'stages and promotes runtime keys from the dashboard operator surface', async () =>
    {
        await act( async () =>
        {
            render( <FederationCenter /> );
        } );

        fireEvent.click( screen.getByRole( 'combobox' ) );
        fireEvent.click( await screen.findByRole( 'option', { name: 'peer-1' } ) );
        fireEvent.change( screen.getByPlaceholderText( 'fingerprint vagy explicit key id' ), { target: { value: 'next-key' } } );
        fireEvent.change( screen.getByPlaceholderText( '-----BEGIN PUBLIC KEY-----' ), { target: { value: 'next-public-key' } } );
        fireEvent.click( screen.getByRole( 'button', { name: 'Next kulcs stage-elése' } ) );

        await waitFor( () =>
        {
            expect( mockedApi.stageFederationPeerRuntimeKey ).toHaveBeenCalledWith( 'peer-1', {
                publicKey: 'next-public-key',
                keyId: 'next-key',
            } );
        } );

        fireEvent.change( screen.getByPlaceholderText( 'pl. remote rollout confirmed' ), { target: { value: 'approved rollout' } } );
        fireEvent.click( screen.getByRole( 'button', { name: 'Next kulcs promotálása' } ) );

        await waitFor( () =>
        {
            expect( mockedApi.promoteFederationPeerRuntimeKey ).toHaveBeenCalledWith( 'peer-1', 'approved rollout' );
        } );
    } );

    it( 'renders rollout matrix values from federation evidence', async () =>
    {
        await act( async () =>
        {
            render( <FederationCenter /> );
        } );

        await screen.findByText( 'Runtime rollout feed' );
        expect( screen.getByText( 'Rotation staged' ) ).toBeInTheDocument();
        expect( screen.getByText( 'current-key' ) ).toBeInTheDocument();
        expect( screen.getByText( 'next-key' ) ).toBeInTheDocument();
        expect( screen.getByText( 'phoenix+audit' ) ).toBeInTheDocument();
    } );
} );
