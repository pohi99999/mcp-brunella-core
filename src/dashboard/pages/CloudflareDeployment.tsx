import { useState } from 'react';
import { Cloud, Zap, Database, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { logInfo, logError } from '@/utils/logger';

interface DeploymentStatus
{
  type: 'idle' | 'loading' | 'success' | 'error';
  message: string;
  timestamp?: number;
}

export const CloudflareDeployment = () =>
{
  const [accountId, setAccountId] = useState( '' );
  const [apiToken, setApiToken] = useState( '' );
  const [databaseName, setDatabaseName] = useState( 'brunella-cean-db' );
  const [selectedDbId, setSelectedDbId] = useState( '' );
  const [schemaPath, setSchemaPath] = useState( 'myai/agents/workers/schema/d1_schema.sql' );

  const [initStatus, setInitStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [deployStatus, setDeployStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [listStatus, setListStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [migrationStatus, setMigrationStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [queryStatus, setQueryStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [autoDeployStatus, setAutoDeployStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [tunnelStatus, setTunnelStatus] = useState<DeploymentStatus>( { type: 'idle', message: '' } );
  const [databases, setDatabases] = useState<unknown[]>( [] );
  const [query, setQuery] = useState( 'SELECT * FROM users LIMIT 5;' );
  const [queryResult, setQueryResult] = useState<unknown | null>( null );
  const [tunnelResults, setTunnelResults] = useState<unknown[]>( [] );

  const validateInputs = (): boolean =>
  {
    if ( !accountId.trim() )
    {
      logError( 'CloudflareDeployment', 'Account ID is required' );
      return false;
    }
    if ( !apiToken.trim() )
    {
      logError( 'CloudflareDeployment', 'API Token is required' );
      return false;
    }
    return true;
  };

  const handleAutoDeploy = async () =>
  {
    if ( !validateInputs() || !selectedDbId )
    {
      setAutoDeployStatus( {
        type: 'error',
        message: 'API Token és Database ID szükséges!',
      } );
      return;
    }

    setAutoDeployStatus( { type: 'loading', message: 'Syncing D1 schema & Deploying Worker...' } );
    logInfo( 'CloudflareDeployment', `Starting AutoDeploy for database: ${ selectedDbId }` );

    try
    {
      const response = await fetch( '/api/wrangler/auto-deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( {
          databaseId: selectedDbId,
          apiToken,
          workerDir: 'f:/mcp-brunella-core/myai/agents/workers/cean-test',
          schemaPath: 'f:/mcp-brunella-core/myai/agents/workers/schema/d1_schema.sql',
          projectName: 'cean-test'
        } ),
      } );

      if ( !response.ok )
      {
        const errorData = await response.json();
        throw new Error( errorData.error || `HTTP ${ response.status }` );
      }

      const data = await response.json();
      setAutoDeployStatus( {
        type: 'success',
        message: `✅ ${ data.message }`,
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `AutoDeploy failed: ${ error }` );
      setAutoDeployStatus( {
        type: 'error',
        message: `❌ Hiba: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const handleInitD1 = async () =>
  {
    if ( !validateInputs() || !databaseName.trim() )
    {
      setInitStatus( { type: 'error', message: 'Database name is required' } );
      return;
    }

    setInitStatus( { type: 'loading', message: 'Initializing D1 database...' } );
    logInfo( 'CloudflareDeployment', `Init D1: ${ databaseName }` );

    try
    {
      const response = await fetch( '/api/wrangler/init-d1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( {
          databaseName,
          accountId,
          apiToken,
        } ),
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
      }

      const data = ( await response.json() ) as { databaseName?: string };
      setInitStatus( {
        type: 'success',
        message: `✅ D1 database "${ data.databaseName }" created successfully!`,
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `Init failed: ${ error }` );
      setInitStatus( {
        type: 'error',
        message: `❌ Init failed: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const handleDeploy = async () =>
  {
    if ( !validateInputs() ) return;

    setDeployStatus( { type: 'loading', message: 'Deploying Worker...' } );
    logInfo( 'CloudflareDeployment', 'Deploy Worker' );

    try
    {
      const response = await fetch( '/api/wrangler/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( {
          accountId,
          apiToken,
        } ),
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
      }

      const data = ( await response.json() ) as { message?: string };
      setDeployStatus( {
        type: 'success',
        message: `✅ Worker deployed! ${ data.message || '' }`,
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `Deploy failed: ${ error }` );
      setDeployStatus( {
        type: 'error',
        message: `❌ Deploy failed: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const handleListDatabases = async () =>
  {
    if ( !validateInputs() ) return;

    setListStatus( { type: 'loading', message: 'Loading databases...' } );
    logInfo( 'CloudflareDeployment', 'List D1 databases' );

    try
    {
      const params = new URLSearchParams( { accountId, apiToken } );
      const response = await fetch( `/api/wrangler/list-databases?${ params }`, {
        method: 'GET',
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
      }

      const data = ( await response.json() ) as { databases?: unknown[] };
      setDatabases( data.databases || [] );
      setListStatus( {
        type: 'success',
        message: `✅ Found ${ data.databases?.length || 0 } database(s)`,
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `List failed: ${ error }` );
      setListStatus( {
        type: 'error',
        message: `❌ List failed: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const handleRunMigration = async () =>
  {
    if ( !validateInputs() || !selectedDbId )
    {
      setMigrationStatus( { type: 'error', message: 'Please select a database' } );
      return;
    }

    setMigrationStatus( { type: 'loading', message: 'Running migration...' } );
    logInfo( 'CloudflareDeployment', `Run migration on ${ selectedDbId }` );

    try
    {
      const response = await fetch( '/api/wrangler/run-migration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( {
          databaseId: selectedDbId,
          accountId,
          apiToken,
          schemaPath,
        } ),
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
      }

      const data = ( await response.json() ) as { message?: string };
      setMigrationStatus( {
        type: 'success',
        message: `✅ Migration completed! ${ data.message || '' }`,
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `Migration failed: ${ error }` );
      setMigrationStatus( {
        type: 'error',
        message: `❌ Migration failed: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const handleExecuteQuery = async () =>
  {
    if ( !validateInputs() || !selectedDbId || !query.trim() )
    {
      setQueryStatus( { type: 'error', message: 'Please select a database and provide a query' } );
      return;
    }

    setQueryStatus( { type: 'loading', message: 'Executing query...' } );
    setQueryResult( null );
    logInfo( 'CloudflareDeployment', `Exec query on ${ selectedDbId }: ${ query }` );

    try
    {
      const response = await fetch( '/api/wrangler/execute-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( {
          databaseId: selectedDbId,
          accountId,
          apiToken,
          query,
        } ),
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
      }

      const data = ( await response.json() ) as { result?: unknown };
      setQueryResult( data.result );
      setQueryStatus( {
        type: 'success',
        message: `✅ Query executed successfully!`,
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `Query failed: ${ error }` );
      setQueryStatus( {
        type: 'error',
        message: `❌ Query failed: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const handleCheckTunnels = async () =>
  {
    setTunnelStatus( { type: 'loading', message: 'Checking tunnels...' } );
    logInfo( 'CloudflareDeployment', 'Check tunnel health' );

    const urls = [
      'https://api-bas.trycloudflare.com',
      'https://n8n-bas.trycloudflare.com',
      'https://browser-bas.trycloudflare.com',
      'https://dashboard-bas.trycloudflare.com',
    ];

    try
    {
      const response = await fetch( '/api/wrangler/check-tunnels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify( { urls } ),
      } );

      if ( !response.ok )
      {
        throw new Error( `HTTP ${ response.status }` );
      }

      const data = ( await response.json() ) as { results: unknown[] };
      setTunnelResults( data.results );
      setTunnelStatus( {
        type: 'success',
        message: 'Tunnel check completed',
        timestamp: Date.now(),
      } );
    } catch ( e: unknown )
    {
      const error = e instanceof Error ? e.message : String( e );
      logError( 'CloudflareDeployment', `Tunnel check failed: ${ error }` );
      setTunnelStatus( {
        type: 'error',
        message: `❌ Check failed: ${ error }`,
        timestamp: Date.now(),
      } );
    }
  };

  const getStatusIcon = ( status: DeploymentStatus ) =>
  {
    switch ( status.type )
    {
      case 'loading':
        return <Loader size={ 16 } className="animate-spin" />;
      case 'success':
        return <CheckCircle size={ 16 } className="text-green-600" />;
      case 'error':
        return <AlertCircle size={ 16 } className="text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBg = ( status: DeploymentStatus ) =>
  {
    switch ( status.type )
    {
      case 'success':
        return 'bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700';
      case 'error':
        return 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700';
      case 'loading':
        return 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700';
      default:
        return 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const StatusBox = ( { status, title }: { status: DeploymentStatus; title: string } ) => (
    <div className={ `rounded border p-3 flex gap-2 ${ getStatusBg( status ) }` }>
      <div className="flex-shrink-0">{ getStatusIcon( status ) }</div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{ title }</p>
        <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{ status.message }</p>
        { status.timestamp && (
          <p className="text-xs text-gray-500 mt-1">{ new Date( status.timestamp ).toLocaleTimeString( 'hu-HU' ) }</p>
        ) }
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */ }
        <div className="flex items-center gap-3 pb-6 border-b border-gray-200 dark:border-gray-800">
          <Cloud size={ 32 } className="text-blue-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">☁️ Cloudflare Deployment</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">D1 Database & Worker Management</p>
          </div>
        </div>

        {/* Tunnel Monitoring Section */ }
        <div className="space-y-4 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
            <span className="flex items-center gap-2"><Zap size={ 18 } /> Tunnel Monitoring</span>
            <button
              onClick={ handleCheckTunnels }
              disabled={ tunnelStatus.type === 'loading' }
              className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-50"
            >
              { tunnelStatus.type === 'loading' ? 'Checking...' : 'Check Status' }
            </button>
          </h2>
          { tunnelResults.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              { tunnelResults.map( ( res: any, idx ) => (
                <div key={ idx } className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-800 border border-gray-100 dark:border-gray-700">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 truncate max-w-[150px]">{ res.url }</span>
                    <span className="text-xs font-medium">{ res.url.split( '.' )[0].replace( 'https://', '' ) }</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500">{ res.latency }ms</span>
                    { res.status === 'online' ? (
                      <CheckCircle size={ 14 } className="text-green-500" />
                    ) : (
                      <AlertCircle size={ 14 } className="text-red-500" />
                    ) }
                  </div>
                </div>
              ) ) }
            </div>
          ) }
        </div>

        {/* Credentials Section */ }
        <div className="space-y-4 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap size={ 18 } /> Cloudflare Hitelesítés
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Account ID
              </label>
              <input
                type="text"
                value={ accountId }
                onChange={ ( e ) => setAccountId( e.target.value ) }
                placeholder="your-account-id"
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                API Token
              </label>
              <input
                type="password"
                value={ apiToken }
                onChange={ ( e ) => setApiToken( e.target.value ) }
                placeholder="your-api-token"
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* D1 Init Section */ }
        <div className="space-y-3 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database size={ 18 } /> D1 Adatbázis Inicializálása
          </h2>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Database Name
            </label>
            <input
              type="text"
              value={ databaseName }
              onChange={ ( e ) => setDatabaseName( e.target.value ) }
              placeholder="e.g., brunella-cean-db"
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={ handleInitD1 }
            disabled={ initStatus.type === 'loading' }
            className="w-full px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2"
          >
            { initStatus.type === 'loading' && <Loader size={ 16 } className="animate-spin" /> }
            🚀 D1 Inicializálása
          </button>
          { initStatus.message && <StatusBox status={ initStatus } title="D1 Inicializálás" /> }
        </div>

        {/* Worker Deploy Section */ }
        <div className="space-y-3 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap size={ 18 } /> Worker Deploy
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Deploy your Cloudflare Worker to the edge. Requires wrangler.toml in project root.
          </p>
          <button
            onClick={ handleDeploy }
            disabled={ deployStatus.type === 'loading' }
            className="w-full px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2"
          >
            { deployStatus.type === 'loading' && <Loader size={ 16 } className="animate-spin" /> }
            🌍 Worker Deploy
          </button>
          { deployStatus.message && <StatusBox status={ deployStatus } title="Worker Deploy" /> }
        </div>

        {/* List & Migrate Section */ }
        <div className="space-y-3 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database size={ 18 } /> Adatbázis Kezelés
          </h2>

          {/* List Databases */ }
          <div>
            <button
              onClick={ handleListDatabases }
              disabled={ listStatus.type === 'loading' }
              className="w-full px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2"
            >
              { listStatus.type === 'loading' && <Loader size={ 16 } className="animate-spin" /> }
              📋 Adatbázisok Listázása
            </button>
            { listStatus.message && <StatusBox status={ listStatus } title="Adatbázis Lista" /> }
          </div>

          {/* Database Selector */ }
          { databases.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Válassz egy adatbázist
              </label>
              <select
                title="D1 Database Selector"
                value={ selectedDbId }
                onChange={ ( e ) => setSelectedDbId( e.target.value ) }
                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Kérlek válassz --</option>
                { databases.map( ( db: unknown, idx ) =>
                {
                  const dbItem = db as { id?: string; name?: string } | null;
                  return (
                    <option key={ idx } value={ dbItem?.id || String( idx ) }>
                      { dbItem?.name || `Database ${ idx + 1 }` }
                    </option>
                  );
                } ) }
              </select>
            </div>
          ) }

          {/* Migration */ }
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Schema Fájl Útvonala
            </label>
            <input
              type="text"
              value={ schemaPath }
              onChange={ ( e ) => setSchemaPath( e.target.value ) }
              placeholder="myai/agents/workers/schema/d1_schema.sql"
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 mb-2"
            />
            <button
              onClick={ handleRunMigration }
              disabled={ migrationStatus.type === 'loading' || !selectedDbId }
              className="w-full px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2"
            >
              { migrationStatus.type === 'loading' && <Loader size={ 16 } className="animate-spin" /> }
              ⚙️ Migráció Futtatása
            </button>
            { migrationStatus.message && <StatusBox status={ migrationStatus } title="Migráció" /> }
          </div>

          {/* D1 Query Runner */ }
          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <Zap size={ 14 } /> D1 Query Runner
            </h3>
            <textarea
              value={ query }
              onChange={ ( e ) => setQuery( e.target.value ) }
              placeholder="SELECT * FROM users;"
              className="w-full h-24 px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-slate-800 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            />
            <button
              onClick={ handleExecuteQuery }
              disabled={ queryStatus.type === 'loading' || !selectedDbId }
              className="w-full px-4 py-2 rounded bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-2"
            >
              { queryStatus.type === 'loading' && <Loader size={ 16 } className="animate-spin" /> }
              ⚡️ Query Futtatása
            </button>
            { queryStatus.message && <StatusBox status={ queryStatus } title="Query Eredmény" /> }
            { queryResult && (
              <div className="mt-2 p-2 bg-black rounded overflow-auto max-h-64 border border-gray-800">
                <pre className="text-[10px] text-green-400 font-mono">
                  { JSON.stringify( queryResult, null, 2 ) }
                </pre>
              </div>
            ) }
          </div>
        </div>

        {/* Info Box */ }
        <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded p-4">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 <strong>Tipp:</strong> Az Account ID és API Token a Cloudflare Dashboard-ból szerzéshez szükséges. Alapértelmezett D1 adatbázis neve: "brunella-cean-db"
          </p>
        </div>

        {/* AutoDeploy Section */ }
        <div className="space-y-4 bg-gray-50 dark:bg-slate-900 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <h2 className="font-semibold text-gray-900 dark:text-white flex items-center justify-between">
            <span className="flex items-center gap-2 text-indigo-600"><Zap size={ 18 } /> AutoDeploy (D1 -&gt; Worker)</span>
          </h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Automatikus szinkronizáció: D1 séma frissítése + Worker kód újratelepítése egyetlen lépésben.
          </p>
          <button
            onClick={ handleAutoDeploy }
            disabled={ autoDeployStatus.type === 'loading' || !selectedDbId }
            className="w-full px-4 py-3 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition text-sm font-bold flex items-center justify-center gap-2 shadow-lg"
          >
            { autoDeployStatus.type === 'loading' && <Loader size={ 16 } className="animate-spin" /> }
            🚀 SZINKRONIZÁLT AUTO-DEPLOY
          </button>
          { autoDeployStatus.message && <StatusBox status={ autoDeployStatus } title="CEAN AutoDeploy" /> }
        </div>
      </div>
    </div>
  );
};
