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
exports.SafeZoneValidator = void 0;
exports.getSafeZoneValidator = getSafeZoneValidator;
// Removed static fs import
// import fs from 'fs';
var path_1 = require("path");
var minimatch_1 = require("minimatch");
var logger_js_1 = require("../utils/logger.js");
var SafeZoneValidator = /** @class */ (function () {
    function SafeZoneValidator(configPath) {
        if (configPath === void 0) { configPath = 'config/safe_zones.json'; }
        this.config = null;
        this.zones = [];
        this.blacklist = [];
        this.configPath = configPath;
        this.operationCounts = new Map();
        // Config loading is now async/lazy or handled via init
    }
    // New async init method to handle FS loading
    SafeZoneValidator.prototype.initialize = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.config)
                            return [2 /*return*/];
                        if (!(typeof process !== 'undefined' && process.versions && process.versions.node)) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, this.loadConfig(this.configPath)];
                    case 1:
                        _a.config = _b.sent();
                        this.zones = this.config.safe_zones.map(function (z) { return (__assign(__assign({}, z), { path: path_1.default.resolve(z.path) })); });
                        this.blacklist = this.config.blacklist;
                        (0, logger_js_1.logInfo)('SafeZoneValidator', "Loaded config with ".concat(this.zones.length, " safe zones"));
                        return [3 /*break*/, 3];
                    case 2:
                        (0, logger_js_1.logWarn)('SafeZoneValidator', 'Not running in Node.js environment, Safe Zones disabled.');
                        _b.label = 3;
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    SafeZoneValidator.prototype.loadConfig = function (configPath) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, fullPath, content, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 3, , 4]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                    case 1:
                        fs = _a.sent();
                        fullPath = path_1.default.resolve(configPath);
                        return [4 /*yield*/, fs.promises.readFile(fullPath, 'utf-8')];
                    case 2:
                        content = _a.sent();
                        return [2 /*return*/, JSON.parse(content)];
                    case 3:
                        error_1 = _a.sent();
                        (0, logger_js_1.logError)('SafeZoneValidator', "Failed to load config: ".concat(error_1.message));
                        // Return default safe config to prevent crash
                        return [2 /*return*/, {
                                version: "1.0",
                                description: "Fallback Config",
                                safe_zones: [],
                                blacklist: [],
                                audit: { enabled: false, log_path: "", retention_days: 0, log_denied_attempts: false, alert_on_suspicious_patterns: false, suspicious_patterns: [] },
                                rate_limiting: { enabled: false, max_operations_per_minute: 0, max_operations_per_hour: 0, burst_allowance: 0 },
                                security: { enforce_path_normalization: true, block_symlinks: true, verify_file_signatures: false, sandbox_mode: true }
                            }];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Validate if a file operation is allowed
     */
    SafeZoneValidator.prototype.validate = function (targetPath, operation, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var normalizedPath, error_2, _i, _a, pattern, _b, zone, ext, fs, stats, sizeMB, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        if (!!this.config) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.initialize()];
                    case 1:
                        _d.sent();
                        _d.label = 2;
                    case 2:
                        if (!this.config || this.zones.length === 0)
                            return [2 /*return*/, false];
                        if (!(this.config.rate_limiting.enabled && !this.checkRateLimit())) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, 'Rate limit exceeded', undefined, metadata)];
                    case 3:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 4:
                        _d.trys.push([4, 5, , 7]);
                        normalizedPath = this.config.security.enforce_path_normalization
                            ? path_1.default.resolve(targetPath)
                            : targetPath;
                        return [3 /*break*/, 7];
                    case 5:
                        error_2 = _d.sent();
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, 'Path normalization failed', undefined, metadata)];
                    case 6:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 7:
                        if (!this.config.audit.alert_on_suspicious_patterns) return [3 /*break*/, 11];
                        _i = 0, _a = this.config.audit.suspicious_patterns;
                        _d.label = 8;
                    case 8:
                        if (!(_i < _a.length)) return [3 /*break*/, 11];
                        pattern = _a[_i];
                        if (!normalizedPath.includes(pattern)) return [3 /*break*/, 10];
                        (0, logger_js_1.logWarn)('SafeZoneValidator', "Suspicious pattern detected: ".concat(pattern, " in ").concat(normalizedPath));
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, "Suspicious pattern: ".concat(pattern), undefined, metadata)];
                    case 9:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 10:
                        _i++;
                        return [3 /*break*/, 8];
                    case 11:
                        if (!this.isBlacklisted(normalizedPath)) return [3 /*break*/, 13];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, 'Blacklisted file/pattern', undefined, metadata)];
                    case 12:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 13:
                        _b = this.config.security.block_symlinks;
                        if (!_b) return [3 /*break*/, 15];
                        return [4 /*yield*/, this.isSymlink(normalizedPath)];
                    case 14:
                        _b = (_d.sent());
                        _d.label = 15;
                    case 15:
                        if (!_b) return [3 /*break*/, 17];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, 'Symlinks are blocked', undefined, metadata)];
                    case 16:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 17:
                        zone = this.findMatchingZone(normalizedPath);
                        if (!!zone) return [3 /*break*/, 19];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, 'Outside Safe Zone boundaries', undefined, metadata)];
                    case 18:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 19:
                        if (!!zone.permissions.includes(operation)) return [3 /*break*/, 21];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, "Permission denied in zone: ".concat(zone.name), zone.name, metadata)];
                    case 20:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 21:
                        if (!(operation === 'write' || operation === 'append')) return [3 /*break*/, 23];
                        ext = path_1.default.extname(normalizedPath).slice(1);
                        if (!(zone.allowed_extensions.length > 0 && !zone.allowed_extensions.includes(ext))) return [3 /*break*/, 23];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, "Extension .".concat(ext, " not allowed in zone"), zone.name, metadata)];
                    case 22:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 23:
                        if (!(operation === 'write' || operation === 'append')) return [3 /*break*/, 30];
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                    case 24:
                        fs = _d.sent();
                        _d.label = 25;
                    case 25:
                        _d.trys.push([25, 29, , 30]);
                        return [4 /*yield*/, fs.promises.stat(normalizedPath)];
                    case 26:
                        stats = _d.sent();
                        sizeMB = stats.size / (1024 * 1024);
                        if (!(sizeMB > zone.max_file_size_mb)) return [3 /*break*/, 28];
                        return [4 /*yield*/, this.audit('DENIED', targetPath, operation, "File size ".concat(sizeMB.toFixed(2), "MB exceeds limit ").concat(zone.max_file_size_mb, "MB"), zone.name, metadata)];
                    case 27:
                        _d.sent();
                        return [2 /*return*/, false];
                    case 28: return [3 /*break*/, 30];
                    case 29:
                        _c = _d.sent();
                        return [3 /*break*/, 30];
                    case 30:
                    // All checks passed
                    return [4 /*yield*/, this.audit('ALLOWED', targetPath, operation, "Operation permitted in ".concat(zone.name), zone.name, metadata)];
                    case 31:
                        // All checks passed
                        _d.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    /**
     * Check if path matches blacklist patterns
     */
    SafeZoneValidator.prototype.isBlacklisted = function (targetPath) {
        var relativePath = path_1.default.relative(process.cwd(), targetPath);
        for (var _i = 0, _a = this.blacklist; _i < _a.length; _i++) {
            var pattern = _a[_i];
            // Exact match
            if (relativePath === pattern) {
                return true;
            }
            // Glob pattern match
            if ((0, minimatch_1.minimatch)(relativePath, pattern, { dot: true })) {
                return true;
            }
            // Path contains pattern
            if (relativePath.includes(pattern)) {
                return true;
            }
        }
        return false;
    };
    /**
     * Check if path is a symlink
     */
    SafeZoneValidator.prototype.isSymlink = function (targetPath) {
        return __awaiter(this, void 0, void 0, function () {
            var fs, _a, stats, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _c.trys.push([0, 7, , 8]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                    case 1:
                        fs = _c.sent();
                        _c.label = 2;
                    case 2:
                        _c.trys.push([2, 4, , 5]);
                        // Use access to check existence first to avoid errors
                        return [4 /*yield*/, fs.promises.access(targetPath)];
                    case 3:
                        // Use access to check existence first to avoid errors
                        _c.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = _c.sent();
                        return [2 /*return*/, false];
                    case 5: return [4 /*yield*/, fs.promises.lstat(targetPath)];
                    case 6:
                        stats = _c.sent();
                        return [2 /*return*/, stats.isSymbolicLink()];
                    case 7:
                        _b = _c.sent();
                        return [2 /*return*/, false];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Find matching safe zone for a path
     */
    SafeZoneValidator.prototype.findMatchingZone = function (normalizedPath) {
        return this.zones.find(function (zone) { return normalizedPath.startsWith(zone.path); });
    };
    /**
     * Check rate limiting
     */
    SafeZoneValidator.prototype.checkRateLimit = function () {
        if (!this.config)
            return false;
        var key = 'global'; // Can be extended to per-user rate limiting
        var now = new Date();
        var counts = this.operationCounts.get(key) || { minute: 0, hour: 0, lastReset: now };
        // Reset counters if needed
        var minutesPassed = (now.getTime() - counts.lastReset.getTime()) / 60000;
        if (minutesPassed >= 60) {
            counts.hour = 0;
            counts.minute = 0;
            counts.lastReset = now;
        }
        else if (minutesPassed >= 1) {
            counts.minute = 0;
            counts.lastReset = now;
        }
        // Check limits
        if (counts.minute >= this.config.rate_limiting.max_operations_per_minute) {
            (0, logger_js_1.logWarn)('SafeZoneValidator', 'Rate limit exceeded: operations per minute');
            return false;
        }
        if (counts.hour >= this.config.rate_limiting.max_operations_per_hour) {
            (0, logger_js_1.logWarn)('SafeZoneValidator', 'Rate limit exceeded: operations per hour');
            return false;
        }
        // Increment counters
        counts.minute++;
        counts.hour++;
        this.operationCounts.set(key, counts);
        return true;
    };
    /**
     * Write audit entry to log
     */
    SafeZoneValidator.prototype.audit = function (verdict, targetPath, operation, reason, zone, metadata) {
        return __awaiter(this, void 0, void 0, function () {
            var entry, fs, logPath, logDir, _a, error_3;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.config || !this.config.audit.enabled) {
                            return [2 /*return*/];
                        }
                        // Skip logging allowed operations if config says so
                        if (verdict === 'DENIED' && !this.config.audit.log_denied_attempts) {
                            return [2 /*return*/];
                        }
                        entry = {
                            timestamp: new Date().toISOString(),
                            verdict: verdict,
                            operation: operation,
                            path: targetPath,
                            reason: reason,
                            zone: zone,
                            metadata: metadata
                        };
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                    case 2:
                        fs = _b.sent();
                        logPath = path_1.default.resolve(this.config.audit.log_path);
                        logDir = path_1.default.dirname(logPath);
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 7]);
                        return [4 /*yield*/, fs.promises.access(logDir)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 5:
                        _a = _b.sent();
                        return [4 /*yield*/, fs.promises.mkdir(logDir, { recursive: true })];
                    case 6:
                        _b.sent();
                        return [3 /*break*/, 7];
                    case 7:
                    // Append to audit log
                    return [4 /*yield*/, fs.promises.appendFile(logPath, JSON.stringify(entry) + '\n', 'utf-8')];
                    case 8:
                        // Append to audit log
                        _b.sent();
                        // Log to console for visibility
                        if (verdict === 'DENIED') {
                            (0, logger_js_1.logWarn)('SafeZoneValidator', "".concat(verdict, " - ").concat(operation, " on ").concat(targetPath, ": ").concat(reason));
                        }
                        else {
                            (0, logger_js_1.logInfo)('SafeZoneValidator', "".concat(verdict, " - ").concat(operation, " on ").concat(targetPath));
                        }
                        return [3 /*break*/, 10];
                    case 9:
                        error_3 = _b.sent();
                        (0, logger_js_1.logError)('SafeZoneValidator', "Failed to write audit log: ".concat(error_3.message));
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get all configured safe zones
     */
    SafeZoneValidator.prototype.getSafeZones = function () {
        return this.zones;
    };
    /**
     * Get audit log entries (last N entries)
     */
    SafeZoneValidator.prototype.getAuditLog = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var fs, logPath, _a, content, lines, recentLines, error_4;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.config)
                            return [2 /*return*/, []];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 8, , 9]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                    case 2:
                        fs = _b.sent();
                        logPath = path_1.default.resolve(this.config.audit.log_path);
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, fs.promises.access(logPath)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _a = _b.sent();
                        return [2 /*return*/, []];
                    case 6: return [4 /*yield*/, fs.promises.readFile(logPath, 'utf-8')];
                    case 7:
                        content = _b.sent();
                        lines = content.trim().split('\n').filter(function (l) { return l.length > 0; });
                        recentLines = lines.slice(-limit);
                        // Parse JSON entries
                        return [2 /*return*/, recentLines.map(function (line) {
                                try {
                                    return JSON.parse(line);
                                }
                                catch (_a) {
                                    return null;
                                }
                            }).filter(function (entry) { return entry !== null; })];
                    case 8:
                        error_4 = _b.sent();
                        (0, logger_js_1.logError)('SafeZoneValidator', "Failed to read audit log: ".concat(error_4.message));
                        return [2 /*return*/, []];
                    case 9: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Clean old audit log entries
     */
    SafeZoneValidator.prototype.cleanAuditLog = function () {
        return __awaiter(this, void 0, void 0, function () {
            var fs, logPath, _a, retentionMs, cutoffDate_1, content, lines, filteredLines, error_5;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this.config)
                            return [2 /*return*/];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 9, , 10]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require('fs'); })];
                    case 2:
                        fs = _b.sent();
                        logPath = path_1.default.resolve(this.config.audit.log_path);
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, fs.promises.access(logPath)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _a = _b.sent();
                        return [2 /*return*/];
                    case 6:
                        retentionMs = this.config.audit.retention_days * 24 * 60 * 60 * 1000;
                        cutoffDate_1 = new Date(Date.now() - retentionMs);
                        return [4 /*yield*/, fs.promises.readFile(logPath, 'utf-8')];
                    case 7:
                        content = _b.sent();
                        lines = content.trim().split('\n').filter(function (l) { return l.length > 0; });
                        filteredLines = lines.filter(function (line) {
                            try {
                                var entry = JSON.parse(line);
                                return new Date(entry.timestamp) > cutoffDate_1;
                            }
                            catch (_a) {
                                return false;
                            }
                        });
                        return [4 /*yield*/, fs.promises.writeFile(logPath, filteredLines.join('\n') + '\n', 'utf-8')];
                    case 8:
                        _b.sent();
                        (0, logger_js_1.logInfo)('SafeZoneValidator', "Audit log cleaned: ".concat(lines.length - filteredLines.length, " old entries removed"));
                        return [3 /*break*/, 10];
                    case 9:
                        error_5 = _b.sent();
                        (0, logger_js_1.logError)('SafeZoneValidator', "Failed to clean audit log: ".concat(error_5.message));
                        return [3 /*break*/, 10];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    return SafeZoneValidator;
}());
exports.SafeZoneValidator = SafeZoneValidator;
// Singleton instance
var validatorInstance = null;
/**
 * Get or create SafeZoneValidator singleton
 */
function getSafeZoneValidator() {
    if (!validatorInstance) {
        validatorInstance = new SafeZoneValidator();
    }
    return validatorInstance;
}
