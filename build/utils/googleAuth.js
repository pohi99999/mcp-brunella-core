"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleAuth = getGoogleAuth;
const googleapis_1 = require("googleapis");
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const index_js_1 = require("../config/index.js");
// Paths to secrets - update based on found files
const SECRET_PATH = 'F:\\OneDrive\\Desktop\\Brunella_es_en\\09_SECRETS (1)\\client_secret_1086791794235-gekmub010ieg3ree7hut50ppu8clhj43.apps.googleusercontent.com.json';
const TOKEN_PATH = path_1.default.join(index_js_1.config.systemLogDir, 'google_token.json');
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/drive.readonly'
];
async function getGoogleAuth() {
    const secretContent = await promises_1.default.readFile(SECRET_PATH, 'utf-8');
    const credentials = JSON.parse(secretContent);
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new googleapis_1.google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    try {
        const token = await promises_1.default.readFile(TOKEN_PATH, 'utf-8');
        oAuth2Client.setCredentials(JSON.parse(token));
    }
    catch (e) {
        console.error("Google Token not found. User needs to authenticate.");
        // In a real app, we'd trigger a flow. For now, we return the client 
        // and let tools handle the 'unauthorized' error.
    }
    return oAuth2Client;
}
