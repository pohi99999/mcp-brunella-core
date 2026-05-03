import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MissionControlHome } from "./MissionControlHome";

interface MotionSectionProps extends React.HTMLAttributes<HTMLElement>
{
    children?: React.ReactNode;
    initial?: unknown;
    animate?: unknown;
    transition?: unknown;
}

const { setLayoutModeMock, useLayoutMock, useSystemSignalMock } = vi.hoisted( () => ( {
    setLayoutModeMock: vi.fn(),
    useLayoutMock: vi.fn(),
    useSystemSignalMock: vi.fn(),
} ) );

vi.mock( "framer-motion", () => ( {
    motion: {
        section: ( { animate: _animate, children, initial: _initial, transition: _transition, ...props }: MotionSectionProps ) => (
            <section { ...props }>{ children }</section>
        ),
    },
} ) );

vi.mock( "@/lib/layout/LayoutContext", () => ( {
    useLayout: () => useLayoutMock(),
} ) );

vi.mock( "@/hooks/useSystemSignal", () => ( {
    useSystemSignal: () => useSystemSignalMock(),
} ) );

vi.mock( "@/lib/widgetRegistry", () => ( {
    WIDGET_REGISTRY: {
        health: { component: () => <div>System Health Widget</div> },
        agent_status: { component: () => <div>Agent Status Widget</div> },
        task_queue: { component: () => <div>Task Queue Widget</div> },
        jules: { component: () => <div>Jules Widget</div> },
        agent_chatter: { component: () => <div>Agent Chatter Widget</div> },
        track_progress: { component: () => <div>Track Progress Widget</div> },
        suggested_tasks: { component: () => <div>Suggested Tasks Widget</div> },
        cloudflare_agents: { component: () => <div>Cloudflare Agents Widget</div> },
        harvest_pipeline: { component: () => <div>Harvest Pipeline Widget</div> },
    },
} ) );

// Helper: default layout object (avoids repeating in every test)
function defaultLayout ()
{
    return {
        id: "default-dashboard",
        name: "Default Dashboard",
        description: "Default dashboard layout",
        gridTemplateAreas: [],
        widgetAssignments: {},
    };
}

// Helper: fully-populated system signal state used by the "live data" suite
function liveSignalState ()
{
    return {
        agents: new Map( [
            [ "builder",  { name: "builder",  status: "working" } ],
            [ "reviewer", { name: "reviewer", status: "idle"    } ],
        ] ),
        developerMetrics: {
            builds: { lastStatus: "success", lastDurationMs: 6200 },
        },
        healthStatus: {
            status: "ok",
            services: {
                api:    "healthy",
                socket: { status: "healthy" },
                queue:  { status: "degraded" },
            },
        },
        isConnected: true,
        taskStats: {
            total:        12,
            runningCount: 2,
            pendingCount: 1,
            successRate:  91.7,
            errorCount:   2,
        },
    };
}

// Helper: empty / null signal state (simulates cold start, no backend connection)
function emptySignalState ()
{
    return {
        agents:           new Map(),
        developerMetrics: null,
        healthStatus:     null,
        isConnected:      false,
        taskStats:        null,
    };
}

describe( "MissionControlHome", () =>
{
    beforeEach( () =>
    {
        vi.clearAllMocks();
        useLayoutMock.mockReturnValue( { currentLayout: defaultLayout(), setLayoutMode: setLayoutModeMock } );
        useSystemSignalMock.mockReturnValue( liveSignalState() );
    } );

    // -----------------------------------------------------------------------
    // Overview shell — default-dashboard layout with live data
    // -----------------------------------------------------------------------
    it( "should_render_dashboard_home_when_default_layout_is_active_and_key_widget_slots_exist", () =>
    {
        render( <MissionControlHome /> );

        expect( screen.getByTestId( "mc-dashboard-home" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-summary-strip" ) ).toBeInTheDocument();
        expect( screen.getByText( "Mission Control cockpit" ) ).toBeInTheDocument();
        expect( screen.getByText( "Operator overview" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-kpi-queue" ) ).toHaveTextContent( "3" );
        expect( screen.getByTestId( "mc-kpi-success-rate" ) ).toHaveTextContent( "91.7%" );
        expect( screen.getByTestId( "mc-kpi-agents" ) ).toHaveTextContent( "1/2" );
        expect( screen.getByTestId( "mc-kpi-health" ) ).toHaveTextContent( "2/3" );
        expect( screen.getByTestId( "mc-kpi-build" ) ).toHaveTextContent( "SUCCESS" );

        expect( screen.getByTestId( "mc-widget-health" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-agent_status" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-task_queue" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-jules" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-agent_chatter" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-track_progress" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-suggested_tasks" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-cloudflare_agents" ) ).toBeInTheDocument();
        expect( screen.getByTestId( "mc-widget-harvest_pipeline" ) ).toBeInTheDocument();
    } );

    it( "should_reset_cockpit_when_reset_button_is_clicked_and_default_layout_is_requested", () =>
    {
        render( <MissionControlHome /> );

        fireEvent.click( screen.getByRole( "button", { name: /Reset cockpit/i } ) );

        expect( setLayoutModeMock ).toHaveBeenCalledWith( "default-dashboard" );
    } );

    // -----------------------------------------------------------------------
    // Overview shell — renders correctly without live backend state (null data)
    // -----------------------------------------------------------------------
    describe( "overview shell — null / empty signal data (no backend)", () =>
    {
        beforeEach( () =>
        {
            useSystemSignalMock.mockReturnValue( emptySignalState() );
        } );

        it( "should_render_dashboard_home_root_and_summary_strip_when_all_signal_data_is_null", () =>
        {
            render( <MissionControlHome /> );

            expect( screen.getByTestId( "mc-dashboard-home" ) ).toBeInTheDocument();
            expect( screen.getByTestId( "mc-summary-strip" ) ).toBeInTheDocument();
            expect( screen.getByText( "Mission Control cockpit" ) ).toBeInTheDocument();
            expect( screen.getByText( "Operator overview" ) ).toBeInTheDocument();
        } );

        it( "should_render_all_five_kpi_cards_when_signal_data_is_null", () =>
        {
            render( <MissionControlHome /> );

            expect( screen.getByTestId( "mc-kpi-queue" ) ).toBeInTheDocument();
            expect( screen.getByTestId( "mc-kpi-success-rate" ) ).toBeInTheDocument();
            expect( screen.getByTestId( "mc-kpi-agents" ) ).toBeInTheDocument();
            expect( screen.getByTestId( "mc-kpi-health" ) ).toBeInTheDocument();
            expect( screen.getByTestId( "mc-kpi-build" ) ).toBeInTheDocument();
        } );

        it( "should_show_zero_queue_count_when_taskStats_is_null", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-queue" ) ).toHaveTextContent( "0" );
        } );

        it( "should_show_zero_point_zero_percent_success_rate_when_taskStats_is_null", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-success-rate" ) ).toHaveTextContent( "0.0%" );
        } );

        it( "should_show_zero_slash_zero_agents_when_agents_map_is_empty", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-agents" ) ).toHaveTextContent( "0/0" );
        } );

        it( "should_show_offline_telemetria_detail_when_isConnected_is_false", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-agents" ) ).toHaveTextContent( "offline telemetria" );
        } );

        it( "should_show_nincs_health_adat_fallback_when_healthStatus_is_null", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-health" ) ).toHaveTextContent( "nincs health adat" );
        } );

        it( "should_show_na_build_value_when_developerMetrics_is_null", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-build" ) ).toHaveTextContent( "N/A" );
        } );

        it( "should_show_nincs_build_telemetria_detail_when_developerMetrics_is_null", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-build" ) ).toHaveTextContent( "nincs build telemetria" );
        } );

        it( "should_render_widget_grid_and_all_nine_widget_slots_when_signal_data_is_null", () =>
        {
            render( <MissionControlHome /> );

            expect( screen.getByTestId( "mc-widget-grid" ) ).toBeInTheDocument();

            for ( const id of [
                "health", "agent_status", "task_queue", "jules", "agent_chatter",
                "track_progress", "suggested_tasks", "cloudflare_agents", "harvest_pipeline",
            ] )
            {
                expect( screen.getByTestId( `mc-widget-${ id }` ) ).toBeInTheDocument();
            }
        } );
    } );

    // -----------------------------------------------------------------------
    // KPI values — live signal data (regression for computation logic)
    // -----------------------------------------------------------------------
    describe( "KPI computation with live signal data", () =>
    {
        it( "should_sum_running_and_pending_for_queue_value", () =>
        {
            useSystemSignalMock.mockReturnValue( {
                ...emptySignalState(),
                taskStats: { runningCount: 4, pendingCount: 6, total: 15, successRate: 0, errorCount: 0 },
            } );
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-queue" ) ).toHaveTextContent( "10" );
        } );

        it( "should_format_success_rate_to_one_decimal_place", () =>
        {
            useSystemSignalMock.mockReturnValue( {
                ...emptySignalState(),
                taskStats: { runningCount: 0, pendingCount: 0, total: 10, successRate: 87.666, errorCount: 1 },
            } );
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-success-rate" ) ).toHaveTextContent( "87.7%" );
        } );

        it( "should_count_only_working_agents_in_numerator", () =>
        {
            useSystemSignalMock.mockReturnValue( {
                ...emptySignalState(),
                agents: new Map( [
                    [ "a1", { status: "working" } ],
                    [ "a2", { status: "idle" } ],
                    [ "a3", { status: "working" } ],
                    [ "a4", { status: "error" } ],
                ] ),
                isConnected: true,
            } );
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-agents" ) ).toHaveTextContent( "2/4" );
        } );

        it( "should_show_socket_el_detail_when_isConnected_is_true", () =>
        {
            useSystemSignalMock.mockReturnValue( { ...emptySignalState(), isConnected: true } );
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-agents" ) ).toHaveTextContent( "socket él" );
        } );

        it( "should_count_healthy_and_ok_string_services_as_healthy", () =>
        {
            useSystemSignalMock.mockReturnValue( {
                ...emptySignalState(),
                healthStatus: { status: "degraded", services: { a: "healthy", b: "error", c: "ok" } },
            } );
            render( <MissionControlHome /> );
            // a (healthy) + c (ok) = 2 out of 3
            expect( screen.getByTestId( "mc-kpi-health" ) ).toHaveTextContent( "2/3" );
        } );

        it( "should_count_object_services_with_healthy_or_ok_status_property", () =>
        {
            useSystemSignalMock.mockReturnValue( {
                ...emptySignalState(),
                healthStatus: {
                    status: "ok",
                    services: { svcA: { status: "healthy" }, svcB: { status: "degraded" } },
                },
            } );
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-health" ) ).toHaveTextContent( "1/2" );
        } );

        it( "should_uppercase_lastStatus_and_show_duration_when_developerMetrics_is_populated", () =>
        {
            useSystemSignalMock.mockReturnValue( {
                ...emptySignalState(),
                developerMetrics: { builds: { lastStatus: "failed", lastDurationMs: 3000 } },
            } );
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-kpi-build" ) ).toHaveTextContent( "FAILED" );
            expect( screen.getByTestId( "mc-kpi-build" ) ).toHaveTextContent( "3s utolsó build" );
        } );
    } );

    // -----------------------------------------------------------------------
    // Widget slot attributes (priority + widget-id forwarding)
    // -----------------------------------------------------------------------
    describe( "widget slot data attributes", () =>
    {
        it( "should_set_data_priority_hero_on_health_widget_slot", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-widget-health" ) ).toHaveAttribute( "data-priority", "hero" );
        } );

        it( "should_set_data_priority_primary_on_agent_status_task_queue_jules_agent_chatter_slots", () =>
        {
            render( <MissionControlHome /> );
            for ( const id of [ "agent_status", "task_queue", "jules", "agent_chatter" ] )
            {
                expect( screen.getByTestId( `mc-widget-${ id }` ) ).toHaveAttribute( "data-priority", "primary" );
            }
        } );

        it( "should_set_data_priority_secondary_on_track_suggested_cloudflare_harvest_slots", () =>
        {
            render( <MissionControlHome /> );
            for ( const id of [ "track_progress", "suggested_tasks", "cloudflare_agents", "harvest_pipeline" ] )
            {
                expect( screen.getByTestId( `mc-widget-${ id }` ) ).toHaveAttribute( "data-priority", "secondary" );
            }
        } );

        it( "should_forward_widget_id_as_data_widget_id_attribute_on_each_slot", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.getByTestId( "mc-widget-health" ) ).toHaveAttribute( "data-widget-id", "health" );
            expect( screen.getByTestId( "mc-widget-jules" ) ).toHaveAttribute( "data-widget-id", "jules" );
        } );

        it( "should_not_render_slot_for_unregistered_widget_id", () =>
        {
            render( <MissionControlHome /> );
            expect( screen.queryByTestId( "mc-widget-nonexistent" ) ).not.toBeInTheDocument();
        } );
    } );

    // -----------------------------------------------------------------------
    // Custom layout path (non-default-dashboard)
    // -----------------------------------------------------------------------
    describe( "custom layout path", () =>
    {
        it( "should_not_render_mc_dashboard_home_wrapper_when_layout_id_is_not_default_dashboard", () =>
        {
            useLayoutMock.mockReturnValue( {
                currentLayout: { id: "ops-mode", name: "Ops", widgetAssignments: {} },
                setLayoutMode: setLayoutModeMock,
            } );
            render( <MissionControlHome /> );
            expect( screen.queryByTestId( "mc-dashboard-home" ) ).not.toBeInTheDocument();
        } );

        it( "should_render_mc_widget_grid_with_grid_area_attributes_when_layout_has_widget_assignments", () =>
        {
            useLayoutMock.mockReturnValue( {
                currentLayout: {
                    id: "dev-mode",
                    name: "Dev",
                    widgetAssignments: { health: "health-area", task_queue: "tasks-area" },
                },
                setLayoutMode: setLayoutModeMock,
            } );
            render( <MissionControlHome /> );

            expect( screen.getByTestId( "mc-widget-grid" ) ).toBeInTheDocument();
            expect( screen.getByTestId( "mc-widget-health" ) ).toHaveAttribute( "data-grid-area", "health-area" );
            expect( screen.getByTestId( "mc-widget-task_queue" ) ).toHaveAttribute( "data-grid-area", "tasks-area" );
        } );
    } );
} );
