function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

/**
 * Helper to get environment variables safely in both Node and Browser
 */
function getEnv(name: string): string | undefined {
  // Try Node.js process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }
  
  // Try Vite/Browser import.meta.env
  // @ts-ignore - Vite specific
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // @ts-ignore
    return import.meta.env[name];
  }
  
  return undefined;
}

export function getBackendOrigin(): string {
  const explicit = getEnv("VITE_BACKEND_URL") ?? getEnv("BACKEND_URL");
  if (explicit) return trimTrailingSlash(explicit);
  
  const port = getEnv("PORT") ?? "3000";
  
  // Default for browser if no env set
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    // If we are on port 5173 (Vite dev), assume backend is on 3000
    if (window.location.port === '5173') {
      return `${protocol}//${hostname}:3000`;
    }
    return `${protocol}//${hostname}${window.location.port ? ':' + window.location.port : ''}`;
  }
  
  return `http://localhost:${port}`;
}

export function getSocketOrigin(): string {
  const explicit = getEnv("VITE_SOCKET_URL") ?? getEnv("SOCKET_URL");
  if (explicit) return trimTrailingSlash(explicit);
  return getBackendOrigin();
}
