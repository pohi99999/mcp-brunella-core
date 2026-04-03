import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  existsSyncMock,
  mkdirMock,
  readFileMock,
  oauthConstructorMock,
  setCredentialsMock,
  logWarnMock,
} = vi.hoisted(() => {
  return {
    existsSyncMock: vi.fn<(path: string) => boolean>(),
    mkdirMock: vi.fn(),
    readFileMock: vi.fn(),
    oauthConstructorMock: vi.fn(),
    setCredentialsMock: vi.fn(),
    logWarnMock: vi.fn(),
  };
});

vi.mock('fs', () => ({
  existsSync: existsSyncMock,
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: readFileMock,
    mkdir: mkdirMock,
  },
  readFile: readFileMock,
  mkdir: mkdirMock,
}));

vi.mock('../src/utils/logger.js', () => ({
  logWarn: logWarnMock,
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: oauthConstructorMock.mockImplementation(
        (clientId: string, clientSecret: string, redirectUri: string) => ({
          clientId,
          clientSecret,
          redirectUri,
          setCredentials: setCredentialsMock,
        }),
      ),
    },
  },
}));

describe('googleAuth', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    existsSyncMock.mockReset().mockReturnValue(false);
    mkdirMock.mockReset().mockResolvedValue(undefined);
    readFileMock.mockReset();
    oauthConstructorMock.mockClear();
    setCredentialsMock.mockReset();
    logWarnMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses credentials directory as the preferred workspace auth path', async () => {
    const mod = await import('../src/utils/googleAuth.js');

    const paths = mod.getGoogleWorkspaceAuthPaths();

    expect(paths.preferredCredentialsPath).toContain('credentials');
    expect(paths.preferredCredentialsPath).toContain('google-oauth2-credentials.json');
    expect(paths.preferredTokenPath).toContain('credentials');
    expect(paths.preferredTokenPath).toContain('google-token.json');
    expect(paths.usingLegacyCredentialsPath).toBe(false);
    expect(paths.usingLegacyTokenPath).toBe(false);
  });

  it('falls back to legacy config paths when compatibility files exist', async () => {
    existsSyncMock.mockImplementation((targetPath: string) => {
      return (
        targetPath.includes('config\\google_credentials.json') ||
        targetPath.includes('config\\google_token.json')
      );
    });

    const mod = await import('../src/utils/googleAuth.js');

    const paths = mod.getGoogleWorkspaceAuthPaths();

    expect(paths.credentialsPath).toContain('config');
    expect(paths.credentialsPath).toContain('google_credentials.json');
    expect(paths.tokenPath).toContain('config');
    expect(paths.tokenPath).toContain('google_token.json');
    expect(paths.usingLegacyCredentialsPath).toBe(true);
    expect(paths.usingLegacyTokenPath).toBe(true);
  });

  it('loads OAuth credentials and token from explicit workspace env overrides', async () => {
    vi.stubEnv('GOOGLE_WORKSPACE_CREDENTIALS_FILE', 'D:\\secure\\oauth.json');
    vi.stubEnv('GOOGLE_WORKSPACE_TOKEN_FILE', 'D:\\secure\\token.json');
    readFileMock.mockImplementation(async (targetPath: string) => {
      if (targetPath === 'D:\\secure\\oauth.json') {
        return JSON.stringify({
          installed: {
            client_id: 'workspace-client-id',
            client_secret: 'workspace-client-secret',
            redirect_uris: ['http://localhost'],
          },
        });
      }
      if (targetPath === 'D:\\secure\\token.json') {
        return JSON.stringify({
          access_token: 'workspace-access-token',
          refresh_token: 'workspace-refresh-token',
        });
      }
      throw new Error(`Unexpected path: ${targetPath}`);
    });

    const mod = await import('../src/utils/googleAuth.js');

    const auth = await mod.getGoogleAuth();

    expect(auth).toBeDefined();
    expect(readFileMock).toHaveBeenCalledWith('D:\\secure\\oauth.json', 'utf-8');
    expect(readFileMock).toHaveBeenCalledWith('D:\\secure\\token.json', 'utf-8');
    expect(oauthConstructorMock).toHaveBeenCalledWith(
      'workspace-client-id',
      'workspace-client-secret',
      'http://localhost',
    );
    expect(setCredentialsMock).toHaveBeenCalledWith({
      access_token: 'workspace-access-token',
      refresh_token: 'workspace-refresh-token',
    });
  });

  it('warns when legacy credential files are used', async () => {
    existsSyncMock.mockImplementation((targetPath: string) => {
      return targetPath.includes('config\\google_credentials.json');
    });
    readFileMock.mockResolvedValue(
      JSON.stringify({
        installed: {
          client_id: 'legacy-client-id',
          client_secret: 'legacy-client-secret',
          redirect_uris: ['http://localhost'],
        },
      }),
    );

    const mod = await import('../src/utils/googleAuth.js');

    await mod.createGoogleWorkspaceOAuthClient();

    expect(logWarnMock).toHaveBeenCalled();
  });
});
