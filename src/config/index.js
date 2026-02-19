"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
var path_1 = require("path");
var defaultWorkspace = process.cwd();
var defaultLogDir = path_1.default.join(process.cwd(), "logs");
exports.config = {
    workspaceRoot: process.env.BRUNELLA_WORKSPACE_ROOT || defaultWorkspace,
    allowedRoots: [
        // Legacy numbered folders
        "00_BAS_SYSTEM",
        "00_INBOX",
        "01_CONTEXT",
        "02_PROJECTS",
        "03_LIBRARY",
        "04_ARCHIVE",
        "05_CONFIG",
        "06_CORE",
        "07_KNOWLEDGE_BASE",
        "08_SCRIPTS",
        "99_SYSTEM_LOGS",
        // Active project directories
        "src",
        "myai",
        "conductor",
        "test",
        "docs",
        "scripts",
        "data",
        "public",
        "schemas",
        "ADR",
        "_KNOWLEDGE_BASE",
    ],
    denyContains: [
        "09_SECRETS",
        ".env",
        ".pem",
        ".p12",
        "client_secret",
        "credentials",
        "token",
        "id_rsa",
        "id_ed25519",
    ],
    maxReadBytes: 400000, // 400KB
    maxFileBytesForSearch: 2000000, // 2MB
    systemLogDir: process.env.BRUNELLA_SYSTEM_LOG_DIR || defaultLogDir,
    anythingllmBaseUrl: process.env.ANYTHINGLLM_BASE_URL || "http://localhost:3001",
    anythingllmWorkspace: process.env.ANYTHINGLLM_WORKSPACE || "",
    anythingllmApiKey: process.env.ANYTHINGLLM_API_KEY || "",
};
