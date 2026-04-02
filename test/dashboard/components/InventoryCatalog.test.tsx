import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InventoryCatalog } from '@/components/dashboard/InventoryCatalog';
import * as api from '@/lib/apiService';

vi.mock( '@/components/ui/scroll-area', () => ({
    ScrollArea: ({ children }: any) => <div>{children}</div>,
    ScrollBar: () => null,
}));

vi.mock( '@/lib/apiService', () => ( {
    fetchInventoryValuation: vi.fn(),
    fetchOpenStocktakes: vi.fn(),
} ) );

const mockedApi = api as any;

const valuationResponse = [
    {
        sku: 'ITEM-A',
        name: 'Apple Watch',
        unit: 'db',
        current_stock: 5,
        reorder_point: 2,
        valuation_method: 'FIFO',
        fifo_stock_value: 120000,
        wac_stock_value: 115000,
    },
    {
        sku: 'ITEM-B',
        name: 'Banana Bread',
        unit: 'db',
        current_stock: 0,
        reorder_point: 5,
        valuation_method: 'WAC',
        fifo_stock_value: 0,
        wac_stock_value: 0,
    }
];

describe( 'InventoryCatalog', () =>
{
    beforeEach( () =>
    {
        vi.clearAllMocks();
        mockedApi.fetchOpenStocktakes.mockResolvedValue( [] );
    } );

    it( 'renders page title and loading state', async () =>
    {
        mockedApi.fetchInventoryValuation.mockReturnValue( new Promise( () => { } ) );
        render( <InventoryCatalog /> );
        expect( screen.getByText( /Készlet- és Leltárkezelés/i ) ).toBeDefined();
        expect( screen.getAllByText( /Adatok betöltése/i ).length ).toBeGreaterThan( 0 );
    } );

    it( 'displays valuation items', async () =>
    {
        mockedApi.fetchInventoryValuation.mockResolvedValue( valuationResponse );

        await act( async () =>
        {
            render( <InventoryCatalog /> );
        } );

        expect( screen.getByText( 'Készlet- és Leltárkezelés' ) ).toBeDefined();
        expect( await screen.findByText( 'Apple Watch' ) ).toBeDefined();
        expect( screen.getByText( 'Banana Bread' ) ).toBeDefined();
        expect( screen.getByText( '5 db' ) ).toBeDefined();
        expect( screen.getByText( '0 db' ) ).toBeDefined();
        // Just verify it's present, using getAll if multiple found
        expect( screen.getAllByText( ( c ) => c.includes( '120' ) && c.includes( '000' ) ).length ).toBeGreaterThan( 0 );
    } );

    it( 'displays empty state if no data', async () =>
    {
        mockedApi.fetchInventoryValuation.mockResolvedValue( [] );
        await act( async () =>
        {
            render( <InventoryCatalog /> );
        } );
        expect( screen.getByText( /Nincs elérhető készletadat/i ) ).toBeDefined();
    } );
} );
