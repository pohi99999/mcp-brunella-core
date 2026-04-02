import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryRadarWidget } from "@/components/dashboard/InventoryRadarWidget";
import * as api from "@/lib/apiService";

vi.mock( "@/lib/apiService", () => ( {
    fetchInventoryValuation: vi.fn(),
    fetchOpenStocktakes: vi.fn(),
} ) );

const mockedApi = api as any;

const valuationResponse = {
    success: true,
    summary: [
        {
            sku: "PROD-001",
            name: "Test Product 1",
            current_stock: 10,
            reorder_point: 15,
            valuation_method: "FIFO",
            fifo_stock_value: 50000,
            wac_stock_value: 48000,
        },
        {
            sku: "PROD-002",
            name: "Test Product 2",
            current_stock: 0, // Critical
            reorder_point: 20,
            valuation_method: "WAC",
            fifo_stock_value: 0,
            wac_stock_value: 0,
        }
    ],
    timestamp: "2026-04-02T10:00:00Z"
};

describe( "InventoryRadarWidget", () =>
{
    beforeEach( () =>
    {
        vi.clearAllMocks();
        mockedApi.fetchOpenStocktakes.mockResolvedValue( [] );
    } );

    it( "renders loading state initially", async () =>
    {
        mockedApi.fetchInventoryValuation.mockReturnValue( new Promise( () => { } ) );
        render( <InventoryRadarWidget /> );
        expect( screen.getByText( /Betöltése/i ) ).toBeDefined();
    } );

    it( "displays inventory metrics correctly", async () =>
    {
        mockedApi.fetchInventoryValuation.mockResolvedValue( valuationResponse );

        await act( async () =>
        {
            render( <InventoryRadarWidget /> );
        } );

        // Check for calculated total value (50,000 using FIFO as primary in summary)
        const totalValue = await screen.findByText( ( content ) => content.includes( "50" ) && content.includes( "000" ) );
        expect( totalValue ).toBeDefined();

        // Check for critical items count (PROD-002 has 0 stock)
        const criticalCount = screen.getByText( /1 tétel/i );
        expect( criticalCount ).toBeDefined();

        // Check for header titles
        expect( screen.getByText( "Készletérték Radar" ) ).toBeDefined();
        expect( screen.getByText( "Aktív Leltárvizsgálat" ) ).toBeDefined();
        expect( screen.getByText( "Beszerzési Radar" ) ).toBeDefined();
    } );

    it( "displays error message on fetch failure", async () =>
    {
        mockedApi.fetchInventoryValuation.mockRejectedValue( new Error( "API Error" ) );

        await act( async () =>
        {
            render( <InventoryRadarWidget /> );
        } );

        expect( await screen.findByText( /Hiba a készletadatok betöltésekor/i ) ).toBeDefined();
    } );
} );
