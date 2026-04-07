import { useState, useEffect, useCallback, useMemo } from "react";
import { marked } from "marked";
import
  {
    ClipboardList,
    RefreshCw,
    ChevronDown,
    ChevronRight,
    Search,
    X,
    CalendarDays,
    User,
    Tag,
    TrendingUp,
    Archive,
    CheckCircle2,
    Lightbulb,
    Loader2,
  } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSystemSignal } from "@/hooks/useSystemSignal";
import
  {
    getTracksMonitor,
    getTrackDetail,
    type TrackMonitorEntry,
    type TrackMonitorResponse,
    type TrackDetailResponse,
  } from "@/lib/apiService";

// ─── Helpers ────────────────────────────────────────────────────────────────

function renderMarkdown ( md: string ): string
{
  return marked( md, { breaks: true, gfm: true } ) as string;
}

function priorityColor ( priority?: string ): string
{
  if ( priority === "P0" ) return "bg-red-500 text-white";
  if ( priority === "P1" ) return "bg-yellow-500 text-black";
  if ( priority === "P2" ) return "bg-green-600 text-white";
  return "bg-zinc-600 text-zinc-200";
}

function statusColor ( status: string ): string
{
  switch ( status )
  {
    case "active":
    case "in_progress":
    case "testing":
      return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
    case "proposed":
    case "planning":
      return "bg-blue-500/20 text-blue-300 border-blue-500/30";
    case "completed":
    case "done":
      return "bg-violet-500/20 text-violet-300 border-violet-500/30";
    case "archived":
      return "bg-zinc-700/30 text-zinc-500 border-zinc-600/30";
    default:
      return "bg-zinc-700/20 text-zinc-400 border-zinc-600/20";
  }
}

function statusLabel ( status: string ): string
{
  switch ( status )
  {
    case "in_progress":
      return "folyamatban";
    case "testing":
      return "tesztelés";
    case "proposed":
      return "javasolt";
    case "planning":
      return "tervezés";
    case "completed":
    case "done":
      return "kész";
    case "archived":
      return "archivált";
    default:
      return status;
  }
}

// ─── Stat Badge ──────────────────────────────────────────────────────────────

function StatBadge ( {
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
} )
{
  return (
    <div className={ `flex flex-col items-center px-4 py-2 rounded-lg border ${ color }` }>
      <span className="text-xl font-bold tabular-nums">{ value }</span>
      <span className="text-[10px] uppercase tracking-widest opacity-70">{ label }</span>
    </div>
  );
}

// ─── Track Row ───────────────────────────────────────────────────────────────

function TrackRow ( {
  track,
  onClick,
}: {
  track: TrackMonitorEntry;
  onClick: ( id: string ) => void;
} )
{
  return (
    <button
      onClick={ () => onClick( track.id ) }
      className="w-full text-left rounded-lg border border-zinc-700/40 bg-zinc-800/30 hover:bg-zinc-700/40 transition-colors p-3 group"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-medium text-zinc-100 text-sm truncate">{ track.title }</span>
            { track.priority && (
              <span className={ `text-[10px] font-bold px-1.5 py-0.5 rounded ${ priorityColor( track.priority ) }` }>
                { track.priority }
              </span>
            ) }
            <span className={ `text-[10px] px-2 py-0.5 rounded border ${ statusColor( track.status ) }` }>
              { statusLabel( track.status ) }
            </span>
          </div>
          { track.description && (
            <p className="text-xs text-zinc-400 line-clamp-1 mb-2">{ track.description }</p>
          ) }
          <div className="flex items-center gap-2">
            <Progress value={ track.progress } className="h-1.5 flex-1" />
            <span className="text-xs text-zinc-400 tabular-nums w-8 text-right">{ track.progress }%</span>
          </div>
        </div>
        <ChevronRight
          size={ 14 }
          className="text-zinc-500 group-hover:text-zinc-300 mt-1 shrink-0 transition-colors"
        />
      </div>
      { track.assignee && (
        <div className="flex items-center gap-1 mt-1.5">
          <User size={ 10 } className="text-zinc-500" />
          <span className="text-[10px] text-zinc-500">{ track.assignee }</span>
        </div>
      ) }
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel ( {
  detail,
  loading,
  onClose,
}: {
  detail: TrackDetailResponse | null;
  loading: boolean;
  onClose: () => void;
} )
{
  const [activeTab, setActiveTab] = useState<"plan" | "spec" | "track">( "plan" );

  const tabs = [
    { key: "plan" as const, label: "Plan", content: detail?.planMd },
    { key: "spec" as const, label: "Spec", content: detail?.specMd },
    { key: "track" as const, label: "Track", content: detail?.trackMd },
  ].filter( ( t ) => t.content );

  useEffect( () =>
  {
    if ( tabs.length > 0 ) setActiveTab( tabs[0].key );
  }, [detail?.id] );

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */ }
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        onClick={ onClose }
        aria-hidden="true"
      />
      {/* Panel */ }
      <div className="w-full max-w-2xl bg-zinc-900 border-l border-zinc-700/50 flex flex-col shadow-2xl">
        {/* Header */ }
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-700/50">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardList size={ 18 } className="text-zinc-400 shrink-0" />
            { loading ? (
              <Loader2 size={ 16 } className="animate-spin text-zinc-400" />
            ) : (
              <span className="font-semibold text-zinc-100 truncate">
                { detail?.title ?? "Track részletek" }
              </span>
            ) }
          </div>
          <button
            onClick={ onClose }
            className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-400 hover:text-zinc-200 transition-colors"
            aria-label="Bezár"
          >
            <X size={ 16 } />
          </button>
        </div>

        { loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={ 32 } className="animate-spin text-zinc-400" />
          </div>
        ) }

        { !loading && detail && (
          <>
            {/* Meta */ }
            <div className="px-5 py-3 border-b border-zinc-700/30 bg-zinc-800/30">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                { detail.priority && (
                  <span className={ `px-2 py-0.5 rounded font-bold text-[10px] ${ priorityColor( detail.priority ) }` }>
                    { detail.priority }
                  </span>
                ) }
                <span className={ `px-2 py-0.5 rounded border ${ statusColor( detail.status ) }` }>
                  { statusLabel( detail.status ) }
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <TrendingUp size={ 12 } />
                  { detail.progress }%
                </span>
                { detail.assignee && (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <User size={ 12 } />
                    { detail.assignee }
                  </span>
                ) }
                { detail.updated && (
                  <span className="flex items-center gap-1 text-zinc-500">
                    <CalendarDays size={ 12 } />
                    { detail.updated }
                  </span>
                ) }
                <span className="flex items-center gap-1 text-zinc-600">
                  <Tag size={ 12 } />
                  { detail.id }
                </span>
              </div>
              { detail.description && (
                <p className="mt-2 text-xs text-zinc-400">{ detail.description }</p>
              ) }
            </div>

            {/* Tabs */ }
            { tabs.length > 0 ? (
              <>
                <div className="flex gap-1 px-5 pt-3">
                  { tabs.map( ( t ) => (
                    <button
                      key={ t.key }
                      onClick={ () => setActiveTab( t.key ) }
                      className={ `px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors ${ activeTab === t.key
                          ? "border-emerald-500 text-emerald-300 bg-zinc-800/50"
                          : "border-transparent text-zinc-500 hover:text-zinc-300"
                        }` }
                    >
                      { t.label }
                    </button>
                  ) ) }
                </div>
                <ScrollArea className="flex-1">
                  { tabs.map( ( t ) =>
                    activeTab === t.key ? (
                      <div
                        key={ t.key }
                        className="prose prose-sm dark:prose-invert max-w-none px-5 py-4"
                        dangerouslySetInnerHTML={ {
                          __html: renderMarkdown( t.content! ),
                        } }
                      />
                    ) : null,
                  ) }
                </ScrollArea>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
                Nincs elérhető dokumentáció ehhez a trackhez.
              </div>
            ) }
          </>
        ) }

        { !loading && !detail && (
          <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
            Nem sikerült betölteni a track részleteit.
          </div>
        ) }
      </div>
    </div>
  );
}

// ─── Section ─────────────────────────────────────────────────────────────────

function Section ( {
  title,
  icon,
  tracks,
  onTrackClick,
  defaultOpen = true,
  empty = "Nincs elem",
}: {
  title: string;
  icon: React.ReactNode;
  tracks: TrackMonitorEntry[];
  onTrackClick: ( id: string ) => void;
  defaultOpen?: boolean;
  empty?: string;
} )
{
  const [open, setOpen] = useState( defaultOpen );

  return (
    <div className="space-y-1">
      <button
        onClick={ () => setOpen( ( v ) => !v ) }
        className="flex items-center gap-2 w-full text-left py-1.5 px-1 text-sm font-medium text-zinc-300 hover:text-zinc-100 transition-colors"
      >
        <span className="text-zinc-500">{ icon }</span>
        <span>{ title }</span>
        <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0">
          { tracks.length }
        </Badge>
        <span className="ml-auto text-zinc-600">
          { open ? <ChevronDown size={ 13 } /> : <ChevronRight size={ 13 } /> }
        </span>
      </button>

      { open && (
        <div className="space-y-1.5 pl-1">
          { tracks.length === 0 ? (
            <p className="text-xs text-zinc-600 px-2">{ empty }</p>
          ) : (
            tracks.map( ( t ) => (
              <TrackRow key={ t.id } track={ t } onClick={ onTrackClick } />
            ) )
          ) }
        </div>
      ) }
    </div>
  );
}

// ─── Archived Section ─────────────────────────────────────────────────────────

const ARCHIVED_PAGE_SIZE = 50;

function ArchivedSection ( {
  tracks,
  onTrackClick,
}: {
  tracks: TrackMonitorEntry[];
  onTrackClick: ( id: string ) => void;
} )
{
  const [open, setOpen] = useState( false );
  const [filter, setFilter] = useState( "" );
  const [page, setPage] = useState( 0 );

  const filtered = useMemo(
    () =>
      filter.trim() === ""
        ? tracks
        : tracks.filter(
          ( t ) =>
            t.id.toLowerCase().includes( filter.toLowerCase() ) ||
            t.title.toLowerCase().includes( filter.toLowerCase() ) ||
            ( t.description ?? "" ).toLowerCase().includes( filter.toLowerCase() ),
        ),
    [tracks, filter],
  );

  const page_count = Math.ceil( filtered.length / ARCHIVED_PAGE_SIZE );
  const visible = filtered.slice( page * ARCHIVED_PAGE_SIZE, ( page + 1 ) * ARCHIVED_PAGE_SIZE );

  return (
    <div className="space-y-1">
      <button
        onClick={ () => setOpen( ( v ) => !v ) }
        className="flex items-center gap-2 w-full text-left py-1.5 px-1 text-sm font-medium text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <Archive size={ 14 } className="text-zinc-600" />
        <span>Archivált</span>
        <Badge variant="outline" className="ml-1 text-[10px] px-1.5 py-0 text-zinc-600 border-zinc-700">
          { tracks.length }
        </Badge>
        <span className="ml-auto text-zinc-700">
          { open ? <ChevronDown size={ 13 } /> : <ChevronRight size={ 13 } /> }
        </span>
      </button>

      { open && (
        <div className="pl-1 space-y-2">
          {/* Filter */ }
          <div className="relative">
            <Search
              size={ 13 }
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            />
            <input
              type="text"
              placeholder="Szűrés..."
              value={ filter }
              onChange={ ( e ) =>
              {
                setFilter( e.target.value );
                setPage( 0 );
              } }
              className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-800/60 border border-zinc-700/50 rounded text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>

          { visible.length === 0 ? (
            <p className="text-xs text-zinc-600 px-2">Nincs találat</p>
          ) : (
            visible.map( ( t ) => <TrackRow key={ t.id } track={ t } onClick={ onTrackClick } /> )
          ) }

          {/* Pagination */ }
          { page_count > 1 && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-zinc-600">
                { page * ARCHIVED_PAGE_SIZE + 1 }–
                { Math.min( ( page + 1 ) * ARCHIVED_PAGE_SIZE, filtered.length ) } / { filtered.length }
              </span>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ page === 0 }
                  onClick={ () => setPage( ( p ) => p - 1 ) }
                  className="h-6 px-2 text-[10px] text-zinc-400"
                >
                  ←
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={ page >= page_count - 1 }
                  onClick={ () => setPage( ( p ) => p + 1 ) }
                  className="h-6 px-2 text-[10px] text-zinc-400"
                >
                  →
                </Button>
              </div>
            </div>
          ) }
        </div>
      ) }
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ConductorTracksMonitor ()
{
  const [data, setData] = useState<TrackMonitorResponse | null>( null );
  const [loading, setLoading] = useState( true );
  const [error, setError] = useState<string | null>( null );
  const [autoRefresh, setAutoRefresh] = useState( true );

  const [selectedId, setSelectedId] = useState<string | null>( null );
  const [detail, setDetail] = useState<TrackDetailResponse | null>( null );
  const [detailLoading, setDetailLoading] = useState( false );

  const { socket } = useSystemSignal();

  const fetchData = useCallback( async () =>
  {
    try
    {
      const result = await getTracksMonitor();
      setData( result );
      setError( null );
    } catch ( err )
    {
      setError( err instanceof Error ? err.message : "Betöltési hiba" );
    } finally
    {
      setLoading( false );
    }
  }, [] );

  // Initial load + auto-refresh
  useEffect( () =>
  {
    fetchData();
    if ( !autoRefresh ) return;
    const interval = setInterval( fetchData, 30_000 );
    return () => clearInterval( interval );
  }, [fetchData, autoRefresh] );

  // Socket.IO live updates
  useEffect( () =>
  {
    if ( !socket ) return;
    const onChanged = () => fetchData();
    socket.on( "track:changed", onChanged );
    socket.on( "track:generated", onChanged );
    return () =>
    {
      socket.off( "track:changed", onChanged );
      socket.off( "track:generated", onChanged );
    };
  }, [socket, fetchData] );

  const openDetail = useCallback( async ( trackId: string ) =>
  {
    setSelectedId( trackId );
    setDetail( null );
    setDetailLoading( true );
    try
    {
      const d = await getTrackDetail( trackId );
      setDetail( d );
    } catch
    {
      setDetail( null );
    } finally
    {
      setDetailLoading( false );
    }
  }, [] );

  const closeDetail = useCallback( () =>
  {
    setSelectedId( null );
    setDetail( null );
  }, [] );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      {/* Header */ }
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList size={ 20 } className="text-emerald-400" />
          <h2 className="text-base font-semibold text-zinc-100">Trackek állapota</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={ () => setAutoRefresh( ( v ) => !v ) }
            className={ `text-[10px] px-2 py-1 rounded border transition-colors ${ autoRefresh
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                : "border-zinc-600 text-zinc-500"
              }` }
          >
            Auto 30 mp
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={ () => { setLoading( true ); fetchData(); } }
            className="h-7 gap-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            <RefreshCw size={ 13 } />
            Frissítés
          </Button>
        </div>
      </div>

      {/* Stats */ }
      { data && (
        <div className="flex flex-wrap gap-2">
          <StatBadge
            label="Összesen"
            value={ data.stats.total }
            color="border-zinc-600/50 text-zinc-300"
          />
          <StatBadge
            label="Aktív"
            value={ data.stats.active }
            color="border-emerald-500/40 text-emerald-300 bg-emerald-500/5"
          />
          <StatBadge
            label="Javasolt"
            value={ data.stats.proposed }
            color="border-blue-500/40 text-blue-300 bg-blue-500/5"
          />
          <StatBadge
            label="Kész"
            value={ data.stats.completed }
            color="border-violet-500/40 text-violet-300 bg-violet-500/5"
          />
          <StatBadge
            label="Archivált"
            value={ data.stats.archived }
            color="border-zinc-700/40 text-zinc-500 bg-zinc-800/20"
          />
        </div>
      ) }

      {/* Error */ }
      { error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          { error }
        </div>
      ) }

      {/* Loading */ }
      { loading && !data && (
        <div className="flex-1 flex items-center justify-center text-zinc-500 gap-2">
          <Loader2 size={ 18 } className="animate-spin" />
          <span className="text-sm">Trackek betöltése…</span>
        </div>
      ) }

      {/* Content */ }
      { data && (
        <ScrollArea className="flex-1">
          <div className="space-y-6 pr-2">
            {/* Active */ }
            <Card className="bg-zinc-800/20 border-zinc-700/40">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Aktív Trackek
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                { data.active.length === 0 ? (
                  <p className="text-xs text-zinc-600">Nincs aktív track.</p>
                ) : (
                  <div className="space-y-1.5">
                    { data.active.map( ( t ) => (
                      <TrackRow key={ t.id } track={ t } onClick={ openDetail } />
                    ) ) }
                  </div>
                ) }
              </CardContent>
            </Card>

            {/* Other sections */ }
            <div className="space-y-4">
              <Section
                title="Javasolt"
                icon={ <Lightbulb size={ 14 } /> }
                tracks={ data.proposed }
                onTrackClick={ openDetail }
                empty="Nincs javasolt track."
              />
              <Section
                title="Befejezett"
                icon={ <CheckCircle2 size={ 14 } /> }
                tracks={ data.completed }
                onTrackClick={ openDetail }
                defaultOpen={ false }
                empty="Nincs befejezett track."
              />
              <ArchivedSection tracks={ data.archived } onTrackClick={ openDetail } />
            </div>
          </div>
        </ScrollArea>
      ) }

      {/* Detail slide-in panel */ }
      { selectedId !== null && (
        <DetailPanel
          detail={ detail }
          loading={ detailLoading }
          onClose={ closeDetail }
        />
      ) }
    </div>
  );
}

export default ConductorTracksMonitor;
