import { google } from 'googleapis';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config/index.js';

// Paths to secrets - update based on found files
const SECRET_PATH = 'F:\\OneDrive\\Desktop\\Brunella_es_en\\09_SECRETS (1)\\client_secret_1086791794235-gekmub010ieg3ree7hut50ppu8clhj43.apps.googleusercontent.com.json';
const TOKEN_PATH = path.join(config.systemLogDir, 'google_token.json');

const SCOPES = [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/spreadsheets'
];

export async function getGoogleAuth() {
    const secretContent = await fs.readFile(SECRET_PATH, 'utf-8');
    const credentials = JSON.parse(secretContent);
    const creds = credentials.installed || credentials.web;
    if (!creds) {
        throw new Error('Invalid client_secret.json format (no installed or web property found)');
    }
    const { client_secret, client_id, redirect_uris } = creds;
    
    const oAuth2Client = new google.auth.OAuth2(
        client_id, 
        client_secret, 
        redirect_uris ? redirect_uris[0] : 'http://localhost'
    );

    try {
        const token = await fs.readFile(TOKEN_PATH, 'utf-8');
        oAuth2Client.setCredentials(JSON.parse(token));
    } catch (e) {
        console.error("Google Token not found. User needs to authenticate.");
        // In a real app, we'd trigger a flow. For now, we return the client 
        // and let tools handle the 'unauthorized' error.
    }

    return oAuth2Client;
}
