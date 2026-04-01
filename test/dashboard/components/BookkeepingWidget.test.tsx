import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BookkeepingWidget } from "@/components/dashboard/BookkeepingWidget";
import * as api from "@/lib/apiService";
import { toast } from "sonner";

vi.mock( "@/lib/apiService", () => ( {
  executeAgent: vi.fn(),
  getBookkeepingStatus: vi.fn(),
} ) );

vi.mock( "sonner", () => ( {
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
} ) );

const mockedApi = api as unknown as {
  executeAgent: ReturnType<typeof vi.fn>;
  getBookkeepingStatus: ReturnType<typeof vi.fn>;
};

type ToastMock = {
  info: ReturnType<typeof vi.fn>;
  success: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};
const mockedToast = toast as unknown as ToastMock;

const statusResponse = {
  success: true,
  summary: {
    total: 1234,
    pending: 7,
    completed: 8,
    manualReview: 9,
    unmatched: 10,
    partiallyMatched: 11,
    error: 12,
    byStatus: {
      PENDING_MATCH: 7,
      COMPLETED: 8,
    },
    bySource: {
      BankAgent: 4,
      EmailAgent: 3,
    },
  },
  pendingTransactions: 7,
  snapshot: {
    summary: {
      matched: 8,
    },
    exceptions: [{ id: "exception-1" }],
    timestamp: "2026-03-28T22:00:00.000Z",
    updatedAt: "2026-03-28T22:01:00.000Z",
    source: "n8n",
  },
  timestamp: "2026-03-28T22:01:00.000Z",
};

describe( "BookkeepingWidget", () =>
{
  beforeEach( () =>
  {
    vi.clearAllMocks();
  } );

  afterEach( () =>
  {
    vi.useRealTimers();
  } );

  it( "loads the bookkeeping status and refreshes it periodically", async () =>
  {
    mockedApi.getBookkeepingStatus.mockResolvedValue( statusResponse );
    const intervalCallbacks: Array<() => void> = [];
    const intervalSpy = vi.spyOn( window, 'setInterval' ).mockImplementation( ( callback: TimerHandler ) =>
    {
      intervalCallbacks.push( callback as () => void );
      return 1 as unknown as number;
    } );
    const clearSpy = vi.spyOn( window, 'clearInterval' ).mockImplementation( () => { } );

    await act( async () =>
    {
      render( <BookkeepingWidget /> );
    } );

    await screen.findByText( "1234" );
    expect( screen.getByText( "Várakozó tételek: 7" ) ).toBeInTheDocument();
    expect( screen.getByText( "Kivételek: 1" ) ).toBeInTheDocument();
    expect( mockedApi.getBookkeepingStatus ).toHaveBeenCalledTimes( 1 );

    await act( async () =>
    {
      await intervalCallbacks[0]?.();
    } );

    await waitFor( () =>
    {
      expect( mockedApi.getBookkeepingStatus ).toHaveBeenCalledTimes( 2 );
    } );

    intervalSpy.mockRestore();
    clearSpy.mockRestore();
  } );

  it( "runs the reconciliation workflow and refreshes the live status", async () =>
  {
    mockedApi.getBookkeepingStatus.mockResolvedValue( statusResponse );
    mockedApi.executeAgent
      .mockResolvedValueOnce( { success: true } )
      .mockResolvedValueOnce( { success: true } )
      .mockResolvedValueOnce( {
        success: true,
        data: {
          total: 42,
          matched: 41,
          manual: 13,
        },
      } );

    await act( async () =>
    {
      render( <BookkeepingWidget /> );
    } );

    await screen.findByText( "1234" );

    fireEvent.click( screen.getByRole( "button", { name: "Párosítás Futtatása" } ) );

    await waitFor( () =>
    {
      expect( mockedApi.executeAgent ).toHaveBeenCalledTimes( 3 );
    } );

    expect( mockedApi.executeAgent ).toHaveBeenNthCalledWith(
      1,
      "NavAgent",
      "Process NAV invoices from samples",
    );
    expect( mockedApi.executeAgent ).toHaveBeenNthCalledWith(
      2,
      "BankAgent",
      "Process bank transactions from samples",
    );
    expect( mockedApi.executeAgent ).toHaveBeenNthCalledWith(
      3,
      "MatchingAgent",
      "Match all PENDING bank transactions",
    );

    await waitFor( () =>
    {
      expect( mockedApi.getBookkeepingStatus ).toHaveBeenCalledTimes( 2 );
    } );

    expect( screen.getByText( "42" ) ).toBeInTheDocument();
    expect( screen.getByText( "41" ) ).toBeInTheDocument();
    expect( screen.getByText( "13" ) ).toBeInTheDocument();
  } );

  describe( "error handling", () =>
  {
    it( "silently hides the live status panel when getBookkeepingStatus fails", async () =>
    {
      mockedApi.getBookkeepingStatus.mockRejectedValue( new Error( "API down" ) );
      await act( async () =>
      {
        render( <BookkeepingWidget /> );
      } );
      await waitFor( () => expect( mockedApi.getBookkeepingStatus ).toHaveBeenCalled() );
      expect( screen.queryByText( "Élő állapot" ) ).not.toBeInTheDocument();
      expect( mockedToast.error ).not.toHaveBeenCalled();
    } );

    it( "sets status to ERROR and shows toast when NavAgent throws", async () =>
    {
      mockedApi.getBookkeepingStatus.mockResolvedValue( statusResponse );
      mockedApi.executeAgent.mockRejectedValue( new Error( "NavAgent crash" ) );

      await act( async () =>
      {
        render( <BookkeepingWidget /> );
      } );
      await screen.findByText( "1234" );

      await act( async () =>
      {
        fireEvent.click( screen.getByRole( "button", { name: "Párosítás Futtatása" } ) );
      } );

      await waitFor( () =>
      {
        expect( mockedToast.error ).toHaveBeenCalledWith(
          "Sikertelen folyamat: NavAgent crash",
        );
      } );
      expect( screen.getByText( "ERROR" ) ).toBeInTheDocument();
    } );

    it( "sets status to ERROR when MatchingAgent returns success: false", async () =>
    {
      mockedApi.getBookkeepingStatus.mockResolvedValue( statusResponse );
      mockedApi.executeAgent
        .mockResolvedValueOnce( { success: true } )
        .mockResolvedValueOnce( { success: true } )
        .mockResolvedValueOnce( { success: false, message: "Párosítás sikertelen" } );

      await act( async () =>
      {
        render( <BookkeepingWidget /> );
      } );
      await screen.findByText( "1234" );

      await act( async () =>
      {
        fireEvent.click( screen.getByRole( "button", { name: "Párosítás Futtatása" } ) );
      } );

      await waitFor( () =>
      {
        expect( mockedToast.error ).toHaveBeenCalledWith(
          "Sikertelen folyamat: Párosítás sikertelen",
        );
      } );
      expect( screen.getByText( "ERROR" ) ).toBeInTheDocument();
    } );

    it( "disables the reconciliation button while the workflow is running", async () =>
    {
      mockedApi.getBookkeepingStatus.mockResolvedValue( statusResponse );
      let resolveNav!: ( v: { success: boolean } ) => void;
      mockedApi.executeAgent.mockImplementationOnce(
        () => new Promise<{ success: boolean }>( ( res ) => { resolveNav = res; } ),
      );

      await act( async () =>
      {
        render( <BookkeepingWidget /> );
      } );
      await screen.findByText( "1234" );

      const button = screen.getByRole( "button", { name: "Párosítás Futtatása" } );
      expect( button ).not.toBeDisabled();

      act( () =>
      {
        fireEvent.click( button );
      } );
      await waitFor( () => expect( button ).toBeDisabled() );

      // cleanup: resolve to avoid hanging promise
      await act( async () => { resolveNav( { success: true } ); } );
    } );
  } );
} );
