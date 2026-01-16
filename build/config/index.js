"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path_1 = __importDefault(require("path"));
exports.config = {
    workspaceRoot: 'F:\\OneDrive\\Desktop\\Brunella_es_en',
    allowedRoots: [
        '00_BAS_SYSTEM',
        '00_INBOX',
        '01_CONTEXT',
        '02_PROJECTS',
        '03_LIBRARY',
        '04_ARCHIVE',
        '05_CONFIG',
        '06_CORE',
        '07_KNOWLEDGE_BASE',
        '08_SCRIPTS',
        '99_SYSTEM_LOGS'
    ],
    denyContains: [
        '09_SECRETS',
        '.env',
        '.pem',
        '.p12',
        'client_secret',
        'credentials',
        'token',
        'id_rsa',
        'id_ed25519'
    ],
    maxReadBytes: 400000, // 400KB
    maxFileBytesForSearch: 2000000, // 2MB
    systemLogDir: path_1.default.join(process.cwd(), 'logs')
};
