import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceAutomationWidget } from "@/components/dashboard/InvoiceAutomationWidget";
import * as api from "@/lib/apiService";
import { toast } from "sonner";

vi.mock( "@/lib/apiService", () => ( {
    executeAgent: vi.fn(),
} ) );

vi.mock( "sonner", () => ( {
    toast: {
        info: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
    },
} ) );

const mockedApi = vi.mocked( api );

type ToastMock = {
    info: ReturnType<typeof vi.fn>;
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
};

const mockedToast = toast as unknown as ToastMock;

describe( "InvoiceAutomationWidget", () =>
{
    const consoleErrorSpy = vi.spyOn( console, "error" ).mockImplementation( () => undefined );

    beforeEach( () =>
    {
        vi.clearAllMocks();
    } );

    afterEach( () =>
    {
        consoleErrorSpy.mockClear();
    } );

    it( "shows success state and result metrics after invoice automation completes", async () =>
    {
        let resolveAgent!: ( value: {
            success: boolean;
            message: string;
            data: {
                processedCount: number;
                failedCount: number;
            };
        } ) => void;

        mockedApi.executeAgent.mockReturnValue(
            new Promise( ( resolve ) =>
            {
                resolveAgent = resolve;
            } ),
        );

        await act( async () =>
        {
            render( <InvoiceAutomationWidget /> );
        } );

        expect( screen.getByText( "IDLE" ) ).toBeInTheDocument();
        expect( screen.getByRole( "button", { name: "Feldolgozás Indítása" } ) ).toBeEnabled();

        await act( async () =>
        {
            fireEvent.click( screen.getByRole( "button", { name: "Feldolgozás Indítása" } ) );
        } );

        expect( mockedToast.info ).toHaveBeenCalledWith( "Számlák keresése és feldolgozása elindult..." );
        expect( screen.getByText( "20%" ) ).toBeInTheDocument();

        await act( async () =>
        {
            resolveAgent( {
                success: true,
                message: "Invoice automation complete",
                data: {
                    processedCount: 12,
                    failedCount: 3,
                },
            } );
        } );

        await waitFor( () =>
        {
            expect( screen.getByText( "SUCCESS" ) ).toBeInTheDocument();
        } );

        expect( screen.getByText( "100%" ) ).toBeInTheDocument();
        expect( screen.getByText( "Sikeres:" ) ).toBeInTheDocument();
        expect( screen.getByText( "12" ) ).toBeInTheDocument();
        expect( screen.getByText( "Sikertelen:" ) ).toBeInTheDocument();
        expect( screen.getByText( "3" ) ).toBeInTheDocument();
        expect( mockedToast.success ).toHaveBeenCalledWith( "Invoice automation complete" );
        expect( mockedApi.executeAgent ).toHaveBeenCalledWith(
            "InvoiceAutomation",
            "process all invoices from gmail",
        );
    } );

    it( "shows an error state when the agent call rejects", async () =>
    {
        mockedApi.executeAgent.mockRejectedValueOnce( new Error( "Network down" ) );

        await act( async () =>
        {
            render( <InvoiceAutomationWidget /> );
        } );

        await act( async () =>
        {
            fireEvent.click( screen.getByRole( "button", { name: "Feldolgozás Indítása" } ) );
        } );

        expect( mockedToast.info ).toHaveBeenCalled();

        await waitFor( () =>
        {
            expect( screen.getByText( "ERROR" ) ).toBeInTheDocument();
        } );

        expect( screen.getByText( "20%" ) ).toBeInTheDocument();
        expect( mockedToast.error ).toHaveBeenCalledWith( "Hiba: Network down" );
        expect( screen.queryByText( "Eredmény" ) ).not.toBeInTheDocument();
    } );

    it( "shows an error state when the agent returns success false", async () =>
    {
        mockedApi.executeAgent.mockResolvedValueOnce( {
            success: false,
            message: "Nincs elég adat a feldolgozáshoz",
        } );

        await act( async () =>
        {
            render( <InvoiceAutomationWidget /> );
        } );

        await act( async () =>
        {
            fireEvent.click( screen.getByRole( "button", { name: "Feldolgozás Indítása" } ) );
        } );

        await waitFor( () =>
        {
            expect( screen.getByText( "ERROR" ) ).toBeInTheDocument();
        } );

        expect( screen.getByText( "100%" ) ).toBeInTheDocument();
        expect( mockedToast.error ).toHaveBeenCalledWith(
            "Hiba: Nincs elég adat a feldolgozáshoz",
        );
        expect( screen.queryByText( "Eredmény" ) ).not.toBeInTheDocument();
    } );
} );
