function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function getBrowserOrigin(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return window.location.origin;
}

export function getBackendOrigin(): string {
  const explicitBackend = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (explicitBackend) {
    return trimTrailingSlash(explicitBackend);
  }

  if (import.meta.env.DEV && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  return trimTrailingSlash(getBrowserOrigin());
}

export function getSocketOrigin(): string {
  const explicitSocket = import.meta.env.VITE_SOCKET_URL as string | undefined;
  if (explicitSocket) {
    return trimTrailingSlash(explicitSocket);
  }

  return getBackendOrigin();
}
