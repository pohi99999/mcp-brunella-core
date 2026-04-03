import { existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { Auth, google } from 'googleapis';
import { logWarn } from './logger.js';

const WORKSPACE_CREDENTIALS_DIR = path.join(process.cwd(), 'credentials');
const LEGACY_WORKSPACE_CONFIG_DIR = path.join(process.cwd(), 'config');
const DEFAULT_WORKSPACE_CREDENTIALS_PATH = path.join(
    WORKSPACE_CREDENTIALS_DIR,
    'google-oauth2-credentials.json',
);
const DEFAULT_WORKSPACE_TOKEN_PATH = path.join(
    WORKSPACE_CREDENTIALS_DIR,
    'google-token.json',
);
const LEGACY_WORKSPACE_CREDENTIALS_PATH = path.join(
    LEGACY_WORKSPACE_CONFIG_DIR,
    'google_credentials.json',
);
const LEGACY_WORKSPACE_TOKEN_PATH = path.join(
    LEGACY_WORKSPACE_CONFIG_DIR,
    'google_token.json',
);

export type GoogleWorkspaceAuthPaths = {
    credentialsPath: string;
    tokenPath: string;
    preferredCredentialsPath: string;
    preferredTokenPath: string;
    usingLegacyCredentialsPath: boolean;
    usingLegacyTokenPath: boolean;
};

function resolveGoogleWorkspacePath(
    configuredPath: string | undefined,
    preferredPath: string,
    legacyPath: string,
): {
    path: string;
    preferredPath: string;
    usingLegacyPath: boolean;
} {
    const normalizedConfiguredPath = configuredPath?.trim();
    if (normalizedConfiguredPath) {
        const configuredResolvesToLegacyPath =
            path.resolve(normalizedConfiguredPath) === path.resolve(legacyPath);
        return {
            path: normalizedConfiguredPath,
            preferredPath: configuredResolvesToLegacyPath
                ? preferredPath
                : normalizedConfiguredPath,
            usingLegacyPath: configuredResolvesToLegacyPath,
        };
    }

    if (existsSync(preferredPath)) {
        return {
            path: preferredPath,
            preferredPath,
            usingLegacyPath: false,
        };
    }

    if (existsSync(legacyPath)) {
        return {
            path: legacyPath,
            preferredPath,
            usingLegacyPath: true,
        };
    }

    return {
        path: preferredPath,
        preferredPath,
        usingLegacyPath: false,
    };
}

function warnAboutLegacyPath(kind: 'credentials' | 'token', actualPath: string, preferredPath: string): void {
    logWarn(
        'GoogleAuth',
        `Legacy Google Workspace ${kind} path detected (${actualPath}). Move it to ${preferredPath} or set the explicit workspace env override.`,
    );
}

function createOAuthClientFromSecretFile(secretContent: string, sourcePath: string): Auth.OAuth2Client {
    let credentials: Record<string, unknown>;
    try {
        credentials = JSON.parse(secretContent) as Record<string, unknown>;
    } catch (error) {
        throw new Error(
            `Invalid Google Workspace OAuth credentials JSON at ${sourcePath}.`,
            { cause: error },
        );
    }

    const creds = credentials.installed ?? credentials.web;
    if (!creds || typeof creds !== 'object') {
        throw new Error(
            `Invalid Google Workspace OAuth credentials format at ${sourcePath} (missing installed/web).`,
        );
    }

    const {
        client_secret,
        client_id,
        redirect_uris,
    } = creds as {
        client_secret?: string;
        client_id?: string;
        redirect_uris?: string[];
    };

    if (!client_id || !client_secret) {
        throw new Error(
            `Invalid Google Workspace OAuth credentials format at ${sourcePath} (missing client_id/client_secret).`,
        );
    }

    return new google.auth.OAuth2(
        client_id,
        client_secret,
        Array.isArray(redirect_uris) && redirect_uris.length > 0
            ? redirect_uris[0]
            : 'http://localhost',
    );
}

export function getGoogleWorkspaceAuthPaths(): GoogleWorkspaceAuthPaths {
    const credentialResolution = resolveGoogleWorkspacePath(
        process.env.GOOGLE_WORKSPACE_CREDENTIALS_FILE,
        DEFAULT_WORKSPACE_CREDENTIALS_PATH,
        LEGACY_WORKSPACE_CREDENTIALS_PATH,
    );
    const tokenResolution = resolveGoogleWorkspacePath(
        process.env.GOOGLE_WORKSPACE_TOKEN_FILE,
        DEFAULT_WORKSPACE_TOKEN_PATH,
        LEGACY_WORKSPACE_TOKEN_PATH,
    );

    return {
        credentialsPath: credentialResolution.path,
        tokenPath: tokenResolution.path,
        preferredCredentialsPath: credentialResolution.preferredPath,
        preferredTokenPath: tokenResolution.preferredPath,
        usingLegacyCredentialsPath: credentialResolution.usingLegacyPath,
        usingLegacyTokenPath: tokenResolution.usingLegacyPath,
    };
}

export async function ensureGoogleWorkspaceAuthDirectories(paths: GoogleWorkspaceAuthPaths): Promise<void> {
    await fs.mkdir(path.dirname(paths.preferredCredentialsPath), { recursive: true });
    await fs.mkdir(path.dirname(paths.preferredTokenPath), { recursive: true });
}

export async function createGoogleWorkspaceOAuthClient(): Promise<{
    oAuth2Client: Auth.OAuth2Client;
    paths: GoogleWorkspaceAuthPaths;
}> {
    const paths = getGoogleWorkspaceAuthPaths();

    if (paths.usingLegacyCredentialsPath) {
        warnAboutLegacyPath('credentials', paths.credentialsPath, paths.preferredCredentialsPath);
    }

    let secretContent: string;
    try {
        secretContent = await fs.readFile(paths.credentialsPath, 'utf-8');
    } catch (error) {
        const maybeFsError = error as NodeJS.ErrnoException;
        if (maybeFsError.code === 'ENOENT') {
            throw new Error(
                `Google Workspace OAuth credentials not found. Set GOOGLE_WORKSPACE_CREDENTIALS_FILE or place the file at ${paths.preferredCredentialsPath}.`,
            );
        }
        throw error;
    }

    return {
        oAuth2Client: createOAuthClientFromSecretFile(secretContent, paths.credentialsPath),
        paths,
    };
}

export async function getGoogleAuth(): Promise<Auth.OAuth2Client> {
    const { oAuth2Client, paths } = await createGoogleWorkspaceOAuthClient();

    if (paths.usingLegacyTokenPath) {
        warnAboutLegacyPath('token', paths.tokenPath, paths.preferredTokenPath);
    }

    try {
        const token = await fs.readFile(paths.tokenPath, 'utf-8');
        oAuth2Client.setCredentials(JSON.parse(token));
    } catch (error) {
        const maybeFsError = error as NodeJS.ErrnoException;
        if (maybeFsError.code !== 'ENOENT') {
            throw error;
        }
        logWarn(
            'GoogleAuth',
            `Google Workspace token not found at ${paths.tokenPath}. Run 'brunella workspace auth'.`,
        );
    }

    return oAuth2Client;
}
