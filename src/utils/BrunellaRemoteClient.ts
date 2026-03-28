export interface RemoteSessionPayload
{
  id: string;
  targetId: string;
  initiator: string;
  streamId: string;
  createdAt: number;
  expiresAt: number;
  commands: {
    id: string;
    command: string;
    timestamp: number;
    origin: string;
  }[];
  metadata: Record<string, unknown>;
}

export interface RemoteTargetPayload
{
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export class BrunellaRemoteClient
{
  constructor( private readonly baseUrl: string ) {}

  private async request( path: string, options: RequestInit = {} )
  {
    const res = await fetch( `${ this.baseUrl }${ path }`, {
      headers: {
        "Content-Type": "application/json",
      },
      ...options,
    } );

    if ( !res.ok )
    {
      throw new Error( `Remote client request failed (${ res.status }): ${ await res.text() }` );
    }

    return res.json();
  }

  async listTargets(): Promise<RemoteTargetPayload[]> {
    const data = await this.request( "/remote/targets" );
    return data.targets ?? [];
  }

  async listSessions(): Promise<RemoteSessionPayload[]> {
    const data = await this.request( "/remote/sessions" );
    return data.sessions ?? [];
  }

  async createSession( targetId: string, initiator: string, metadata?: Record<string, unknown> ): Promise<RemoteSessionPayload>
  {
    const payload = await this.request( "/remote/sessions", {
      method: "POST",
      body: JSON.stringify( {
        targetId,
        initiator,
        metadata,
      } ),
    } );
    return payload.session;
  }

  async appendCommand( sessionId: string, command: string, origin?: string )
  {
    const payload = await this.request( "/remote/sessions/" + sessionId + "/commands", {
      method: "POST",
      body: JSON.stringify( {
        command,
        origin,
      } ),
    } );
    return payload.command;
  }
}