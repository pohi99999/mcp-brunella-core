"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cliLogger = exports.systemLogger = exports.Logger = exports.logEmitter = void 0;
exports.logInfo = logInfo;
exports.logError = logError;
exports.logWarn = logWarn;
exports.setAgentStatus = setAgentStatus;
var events_1 = require("events");
// Dynamic imports for Node.js-specific modules (Worker compatibility)
var fs = null;
var path = null;
exports.logEmitter = new events_1.EventEmitter();
function ensureNodeModules() {
    return __awaiter(this, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!(typeof process !== "undefined" && ((_a = process.versions) === null || _a === void 0 ? void 0 : _a.node))) return [3 /*break*/, 4];
                    if (!!fs) return [3 /*break*/, 2];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("fs/promises"); })];
                case 1:
                    fs = _b.sent();
                    _b.label = 2;
                case 2:
                    if (!!path) return [3 /*break*/, 4];
                    return [4 /*yield*/, Promise.resolve().then(function () { return require("path"); })];
                case 3:
                    path = _b.sent();
                    _b.label = 4;
                case 4: return [2 /*return*/];
            }
        });
    });
}
var Logger = /** @class */ (function () {
    function Logger(filename) {
        // Lazy init - will use config when available
        this.logFile = filename;
    }
    Logger.prototype.log = function (message, meta) {
        return __awaiter(this, void 0, void 0, function () {
            var timestamp, logEntry, config, fullPath, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        timestamp = new Date().toISOString();
                        logEntry = "[".concat(timestamp, "] ").concat(message, " ").concat(meta ? JSON.stringify(meta) : "", "\n");
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, ensureNodeModules()];
                    case 2:
                        _a.sent();
                        if (!fs || !path) {
                            // Fallback to console in Worker environments
                            console.log(logEntry.trim());
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../config/index.js"); })];
                    case 3:
                        config = (_a.sent()).config;
                        fullPath = path.join(config.systemLogDir, this.logFile);
                        return [4 /*yield*/, fs.mkdir(path.dirname(fullPath), { recursive: true })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, fs.appendFile(fullPath, logEntry)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_1 = _a.sent();
                        console.error("Failed to write to log file: ".concat(this.logFile), error_1);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    /** Structured JSON log: { level, timestamp, message, requestId?, ...meta } */
    Logger.prototype.structured = function (level, message, meta) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, line, config, fullPath, error_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        entry = __assign({ level: level, timestamp: new Date().toISOString(), message: message }, meta);
                        line = JSON.stringify(entry) + "\n";
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, ensureNodeModules()];
                    case 2:
                        _a.sent();
                        if (!fs || !path) {
                            // Fallback to console in Worker environments
                            console.log(line.trim());
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../config/index.js"); })];
                    case 3:
                        config = (_a.sent()).config;
                        fullPath = path.join(config.systemLogDir, this.logFile);
                        return [4 /*yield*/, fs.mkdir(path.dirname(fullPath), { recursive: true })];
                    case 4:
                        _a.sent();
                        return [4 /*yield*/, fs.appendFile(fullPath, line)];
                    case 5:
                        _a.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        error_2 = _a.sent();
                        console.error("Failed to write to log file: ".concat(this.logFile), error_2);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    Logger.prototype.info = function (message, meta) {
        return this.log("[INFO] ".concat(message), meta);
    };
    Logger.prototype.error = function (message, meta) {
        return this.log("[ERROR] ".concat(message), meta);
    };
    Logger.prototype.warn = function (message, meta) {
        return this.log("[WARN] ".concat(message), meta);
    };
    return Logger;
}());
exports.Logger = Logger;
exports.systemLogger = new Logger("system_commands.log");
exports.cliLogger = new Logger("cli_tools.log");
// Simple helper functions for quick logging (exported for agent use)
function logInfo(agent, message) {
    if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
        console.log("[INFO] [".concat(agent, "] ").concat(message));
    }
    exports.logEmitter.emit("log", {
        level: "info",
        message: message,
        timestamp: new Date().toISOString(),
        agent: agent,
    });
}
function logError(agent, message) {
    if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
        console.error("[ERROR] [".concat(agent, "] ").concat(message));
    }
    exports.logEmitter.emit("log", {
        level: "error",
        message: message,
        timestamp: new Date().toISOString(),
        agent: agent,
    });
}
function logWarn(agent, message) {
    if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
        console.warn("[WARN] [".concat(agent, "] ").concat(message));
    }
    exports.logEmitter.emit("log", {
        level: "warn",
        message: message,
        timestamp: new Date().toISOString(),
        agent: agent,
    });
}
function setAgentStatus(agent, status, task) {
    var statusMsg = task ? "".concat(status, " - ").concat(task) : status;
    if (process.env.BRUNELLA_QUIET_LOGS !== "true") {
        console.log("[STATUS] [".concat(agent, "] ").concat(statusMsg));
    }
    exports.logEmitter.emit("agent_status", {
        agent: agent,
        status: status,
        task: task,
        timestamp: new Date().toISOString(),
    });
}
