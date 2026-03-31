import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { toast } from "sonner";
import { RemoteTargetPayload, RemoteSessionPayload } from "../../../utils/BrunellaRemoteClient";

type RemoteTargetMap = Record<string, RemoteTargetPayload>;

export function RemoteConsolePanel ()
{
    const [targets, setTargets] = useState<RemoteTargetPayload[]>( [] );
    const [sessions, setSessions] = useState<RemoteSessionPayload[]>( [] );
    const [selectedTarget, setSelectedTarget] = useState<string | null>( null );
    const [initiator, setInitiator] = useState( "Copilot Remote" );
    const [command, setCommand] = useState( "echo Hello Remote" );
    const [creating, setCreating] = useState( false );

    const targetMap = useMemo<RemoteTargetMap>( () =>
    {
        const map: RemoteTargetMap = {};
        targets.forEach( ( target ) => { map[target.id] = target; } );
        return map;
    }, [targets] );

    useEffect( () =>
    {
        void fetchTargets();
        void fetchSessions();
    }, [] );

    async function fetchTargets ()
    {
        try
        {
            const res = await fetch( "/api/v1/remote/targets" );
            const data = await res.json();
            setTargets( data.targets ?? [] );
            if ( !selectedTarget && Array.isArray( data.targets ) && data.targets.length > 0 )
            {
                setSelectedTarget( data.targets[0].id );
            }
        }
        catch
        {
            // fetch failed silently - state stays as default empty array
        }
    }

    async function fetchSessions ()
    {
        try
        {
            const res = await fetch( "/api/v1/remote/sessions" );
            const data = await res.json();
            setSessions( data.sessions ?? [] );
        }
        catch
        {
            // fetch failed silently - state stays as default empty array
        }
    }

    async function handleCreateSession ()
    {
        if ( !selectedTarget )
        {
            toast.error( "Válassz célt a létrehozáshoz" );
            return;
        }
        setCreating( true );
        try
        {
            const res = await fetch( "/api/v1/remote/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify( { targetId: selectedTarget, initiator } ),
            } );

            if ( !res.ok )
            {
                const json = await res.json();
                throw new Error( json?.error ?? "Nem sikerült új session-t létrehozni" );
            }

            const data = await res.json();
            setSessions( [...sessions, data.session] );
            toast.success( `Session létrehozva: ${ data.session.id }` );
        }
        catch ( error )
        {
            toast.error( error instanceof Error ? error.message : "Hiba" );
        }
        finally
        {
            setCreating( false );
        }
    }

    async function handleSendCommand ( sessionId: string )
    {
        try
        {
            const res = await fetch( `/api/v1/remote/sessions/${ sessionId }/commands`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify( { command, origin: "dashboard" } ),
            } );
            if ( !res.ok ) throw new Error( "Hiba a parancs küldésekor" );

            const updated = await res.json();
            setSessions( sessions.map( ( session ) =>
                session.id === sessionId ? { ...session, commands: [...session.commands, updated.command] } : session
            ) );
            toast.success( `Parancs elküldve ${ sessionId }` );
        }
        catch ( error )
        {
            toast.error( error instanceof Error ? error.message : "Hiba" );
        }
    }

    return (
        <Card className="h-full" id="remote-session-panel">
            <CardHeader>
                <CardTitle>Remote Layer Console</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                    <label className="flex flex-col gap-2 text-sm">
                        <span>Célválasztás</span>
                        <select
                            className="rounded border border-border px-3 py-2 text-sm"
                            value={ selectedTarget ?? "" }
                            onChange={ ( e ) => setSelectedTarget( e.target.value ) }
                        >
                            { targets.map( ( target ) => (
                                <option key={ target.id } value={ target.id }>{ target.name }</option>
                            ) ) }
                        </select>
                    </label>
                    <label className="flex flex-col gap-2 text-sm">
                        <span>Initiátor</span>
                        <Input value={ initiator } onChange={ ( event ) => setInitiator( event.target.value ) } />
                    </label>
                    <label className="flex flex-col gap-2 text-sm">
                        <span>Parancs</span>
                        <Input value={ command } onChange={ ( event ) => setCommand( event.target.value ) } />
                    </label>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" onClick={ handleCreateSession } size="sm" disabled={ creating }>
                        { creating ? "Létrehozás..." : "Új session" }
                    </Button>
                    <Button variant="secondary" size="sm" onClick={ () => void fetchSessions() }>
                        Frissítés
                    </Button>
                </div>
                <div className="space-y-2">
                    { sessions.length === 0 && <p className="text-sm text-muted-foreground">Nincsenek aktív session-ök.</p> }
                    { sessions.map( ( session ) => (
                        <article key={ session.id } className="rounded-lg border border-border/50 bg-background/60 p-3 shadow-sm">
                            <div className="flex flex-col gap-1">
                                <p className="text-xs text-muted-foreground">ID: { session.id }</p>
                                <p className="text-base font-medium">{ targetMap[session.targetId]?.name ?? session.targetId }</p>
                                <p className="text-sm text-muted-foreground">Initiátor: { session.initiator }</p>
                                <p className="text-sm text-muted-foreground">Expires: { new Date( session.expiresAt ).toLocaleTimeString() }</p>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <Button size="xs" onClick={ () => void handleSendCommand( session.id ) }>
                                    Küld parancs
                                </Button>
                                <span className="text-xs text-muted-foreground">{ session.commands.length } parancs</span>
                            </div>
                        </article>
                    ) ) }
                </div>
            </CardContent>
        </Card>
    );
}
