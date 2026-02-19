"use strict";
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
exports.E2BSandboxManager = void 0;
exports.getE2BSandboxManager = getE2BSandboxManager;
var code_interpreter_1 = require("@e2b/code-interpreter");
var logger_js_1 = require("../utils/logger.js");
var safe_zone_validator_js_1 = require("./safe_zone_validator.js");
var promises_1 = require("fs/promises");
var path_1 = require("path");
/**
 * Manages E2B sandbox lifecycle for secure Python execution
 */
var E2BSandboxManager = /** @class */ (function () {
    function E2BSandboxManager() {
        this.validator = (0, safe_zone_validator_js_1.getSafeZoneValidator)();
        this.activeSandboxes = new Map();
        this.executionCount = 0;
        this.totalDuration = 0;
    }
    /**
     * Execute Python code in isolated E2B sandbox
     *
     * @param code - Python code to execute
     * @param options - Execution options (timeout, packages, etc.)
     * @returns ExecutionResult with output, artifacts, and metadata
     */
    E2BSandboxManager.prototype.executeCode = function (code_1) {
        return __awaiter(this, arguments, void 0, function (code, options) {
            var startTime, _a, timeout_ms, _b, apiKey, _c, template, _d, packages, _e, export_artifacts, _f, safe_zone_path, sandbox, logs, artifacts, sandboxPromise, timeoutPromise, installCode_1, installResult, execution, duration, stdoutOutput, richOutput, output, exportedArtifacts, e_1, error;
            var _g;
            if (options === void 0) { options = {}; }
            return __generator(this, function (_h) {
                switch (_h.label) {
                    case 0:
                        startTime = Date.now();
                        _a = options.timeout_ms, timeout_ms = _a === void 0 ? 60000 : _a, _b = options.apiKey, apiKey = _b === void 0 ? process.env.E2B_API_KEY : _b, _c = options.template, template = _c === void 0 ? 'python' : _c, _d = options.packages, packages = _d === void 0 ? [] : _d, _e = options.export_artifacts, export_artifacts = _e === void 0 ? true : _e, _f = options.safe_zone_path, safe_zone_path = _f === void 0 ? './data/e2b_artifacts' : _f;
                        if (!apiKey || apiKey === '' || apiKey === 'your-e2b-api-key-here') {
                            (0, logger_js_1.logError)('E2BSandboxManager', 'E2B_API_KEY not configured in .env');
                            return [2 /*return*/, {
                                    success: false,
                                    error: 'E2B_API_KEY not configured. Please add it to .env file.',
                                    duration_ms: Date.now() - startTime
                                }];
                        }
                        sandbox = null;
                        logs = [];
                        artifacts = [];
                        _h.label = 1;
                    case 1:
                        _h.trys.push([1, 8, 9, 12]);
                        // 1. Create sandbox (with startup timeout)
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Creating ".concat(template, " sandbox..."));
                        sandboxPromise = code_interpreter_1.Sandbox.create({ apiKey: apiKey });
                        timeoutPromise = new Promise(function (_, reject) {
                            return setTimeout(function () { return reject(new Error('Sandbox startup timeout (5s)')); }, 5000);
                        });
                        return [4 /*yield*/, Promise.race([sandboxPromise, timeoutPromise])];
                    case 2:
                        sandbox = (_h.sent());
                        this.activeSandboxes.set(sandbox.sandboxId, sandbox);
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Sandbox ".concat(sandbox.sandboxId, " created"));
                        if (!(packages.length > 0)) return [3 /*break*/, 4];
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Installing packages: ".concat(packages.join(', ')));
                        installCode_1 = "\nimport subprocess\nimport sys\npackages = ".concat(JSON.stringify(packages), "\nfor pkg in packages:\n    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', pkg])\nprint(f\"Installed {len(packages)} packages\")\n");
                        return [4 /*yield*/, this.runWithTimeout(function () { return sandbox.runCode(installCode_1); }, 10000, 'Package installation timeout (10s)')];
                    case 3:
                        installResult = _h.sent();
                        if (installResult.error) {
                            throw new Error("Package installation failed: ".concat(installResult.error.value));
                        }
                        logs.push("Installed packages: ".concat(packages.join(', ')));
                        _h.label = 4;
                    case 4:
                        // 3. Execute user code (with execution timeout)
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Executing code (".concat(code.length, " chars)..."));
                        return [4 /*yield*/, this.runWithTimeout(function () { return sandbox.runCode(code); }, timeout_ms, "Execution timeout (".concat(timeout_ms, "ms)"))];
                    case 5:
                        execution = _h.sent();
                        duration = Date.now() - startTime;
                        this.executionCount++;
                        this.totalDuration += duration;
                        if (execution.error) {
                            (0, logger_js_1.logWarn)('E2BSandboxManager', "Execution error: ".concat(execution.error.name));
                            return [2 /*return*/, {
                                    success: false,
                                    error: "".concat(execution.error.name, ": ").concat(execution.error.value),
                                    logs: logs,
                                    duration_ms: duration,
                                    metadata: {
                                        sandbox_id: sandbox.sandboxId,
                                        python_version: '3.11'
                                    }
                                }];
                        }
                        stdoutOutput = (((_g = execution.logs) === null || _g === void 0 ? void 0 : _g.stdout) || []).join('\n');
                        richOutput = execution.results
                            .map(function (r) { return r.text || r.html || r.png || ''; })
                            .filter(Boolean)
                            .join('\n');
                        output = [stdoutOutput, richOutput].filter(Boolean).join('\n');
                        logs.push("Execution successful (".concat(duration, "ms)"));
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Execution complete: ".concat(output.slice(0, 100), "..."));
                        if (!export_artifacts) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.exportArtifacts(sandbox, safe_zone_path, execution, stdoutOutput)];
                    case 6:
                        exportedArtifacts = _h.sent();
                        artifacts.push.apply(artifacts, exportedArtifacts);
                        _h.label = 7;
                    case 7: return [2 /*return*/, {
                            success: true,
                            output: output,
                            logs: logs,
                            artifacts: artifacts,
                            duration_ms: duration,
                            metadata: {
                                sandbox_id: sandbox.sandboxId,
                                python_version: '3.11',
                                packages_installed: packages
                            }
                        }];
                    case 8:
                        e_1 = _h.sent();
                        error = e_1 instanceof Error ? e_1.message : String(e_1);
                        (0, logger_js_1.logError)('E2BSandboxManager', "Execution failed: ".concat(error));
                        return [2 /*return*/, {
                                success: false,
                                error: error,
                                logs: logs,
                                duration_ms: Date.now() - startTime,
                                metadata: sandbox ? { sandbox_id: sandbox.sandboxId } : undefined
                            }];
                    case 9:
                        if (!sandbox) return [3 /*break*/, 11];
                        return [4 /*yield*/, this.cleanup(sandbox)];
                    case 10:
                        _h.sent();
                        _h.label = 11;
                    case 11: return [7 /*endfinally*/];
                    case 12: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Export sandbox artifacts to Safe Zone directory
     *
     * @param sandbox - Active E2B sandbox
     * @param targetPath - Safe Zone target directory
     * @param execution - Execution result containing artifacts
     * @returns Array of exported file paths
     */
    E2BSandboxManager.prototype.exportArtifacts = function (sandbox, targetPath, execution, stdoutText) {
        return __awaiter(this, void 0, void 0, function () {
            var exported, filename, filepath, _a, i, result, filename, filepath, buffer, filename, filepath, filename, filepath, _b, e_2, error;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        exported = [];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 23, , 24]);
                        // Create target directory (no need to validate directory path itself)
                        return [4 /*yield*/, promises_1.default.mkdir(targetPath, { recursive: true })];
                    case 2:
                        // Create target directory (no need to validate directory path itself)
                        _c.sent();
                        if (!(stdoutText && (stdoutText.trim().startsWith('{') || stdoutText.trim().startsWith('[')))) return [3 /*break*/, 8];
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 7, , 8]);
                        JSON.parse(stdoutText.trim()); // Validate JSON
                        filename = "artifact_".concat(Date.now(), "_stdout.json");
                        filepath = path_1.default.join(targetPath, filename);
                        return [4 /*yield*/, this.validator.validate(filepath, 'write')];
                    case 4:
                        if (!_c.sent()) return [3 /*break*/, 6];
                        return [4 /*yield*/, promises_1.default.writeFile(filepath, stdoutText.trim(), 'utf-8')];
                    case 5:
                        _c.sent();
                        exported.push(filepath);
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Exported JSON: ".concat(filepath));
                        _c.label = 6;
                    case 6: return [3 /*break*/, 8];
                    case 7:
                        _a = _c.sent();
                        return [3 /*break*/, 8];
                    case 8:
                        i = 0;
                        _c.label = 9;
                    case 9:
                        if (!(i < execution.results.length)) return [3 /*break*/, 22];
                        result = execution.results[i];
                        if (!result.png) return [3 /*break*/, 12];
                        filename = "artifact_".concat(Date.now(), "_").concat(i, ".png");
                        filepath = path_1.default.join(targetPath, filename);
                        return [4 /*yield*/, this.validator.validate(filepath, 'write')];
                    case 10:
                        if (!_c.sent()) return [3 /*break*/, 12];
                        buffer = Buffer.from(result.png, 'base64');
                        return [4 /*yield*/, promises_1.default.writeFile(filepath, buffer)];
                    case 11:
                        _c.sent();
                        exported.push(filepath);
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Exported PNG: ".concat(filepath));
                        _c.label = 12;
                    case 12:
                        if (!result.html) return [3 /*break*/, 15];
                        filename = "artifact_".concat(Date.now(), "_").concat(i, ".html");
                        filepath = path_1.default.join(targetPath, filename);
                        return [4 /*yield*/, this.validator.validate(filepath, 'write')];
                    case 13:
                        if (!_c.sent()) return [3 /*break*/, 15];
                        return [4 /*yield*/, promises_1.default.writeFile(filepath, result.html, 'utf-8')];
                    case 14:
                        _c.sent();
                        exported.push(filepath);
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Exported HTML: ".concat(filepath));
                        _c.label = 15;
                    case 15:
                        if (!(result.text && (result.text.startsWith('{') || result.text.startsWith('[')))) return [3 /*break*/, 21];
                        _c.label = 16;
                    case 16:
                        _c.trys.push([16, 20, , 21]);
                        JSON.parse(result.text); // Validate JSON
                        filename = "artifact_".concat(Date.now(), "_").concat(i, ".json");
                        filepath = path_1.default.join(targetPath, filename);
                        return [4 /*yield*/, this.validator.validate(filepath, 'write')];
                    case 17:
                        if (!_c.sent()) return [3 /*break*/, 19];
                        return [4 /*yield*/, promises_1.default.writeFile(filepath, result.text, 'utf-8')];
                    case 18:
                        _c.sent();
                        exported.push(filepath);
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Exported JSON: ".concat(filepath));
                        _c.label = 19;
                    case 19: return [3 /*break*/, 21];
                    case 20:
                        _b = _c.sent();
                        return [3 /*break*/, 21];
                    case 21:
                        i++;
                        return [3 /*break*/, 9];
                    case 22: return [2 /*return*/, exported];
                    case 23:
                        e_2 = _c.sent();
                        error = e_2 instanceof Error ? e_2.message : String(e_2);
                        (0, logger_js_1.logError)('E2BSandboxManager', "Artifact export failed: ".concat(error));
                        return [2 /*return*/, exported];
                    case 24: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Run async operation with timeout
     */
    E2BSandboxManager.prototype.runWithTimeout = function (operation, timeout_ms, errorMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var timeoutPromise;
            return __generator(this, function (_a) {
                timeoutPromise = new Promise(function (_, reject) {
                    return setTimeout(function () { return reject(new Error(errorMessage)); }, timeout_ms);
                });
                return [2 /*return*/, Promise.race([operation(), timeoutPromise])];
            });
        });
    };
    /**
     * Cleanup sandbox and remove from active list
     */
    E2BSandboxManager.prototype.cleanup = function (sandbox) {
        return __awaiter(this, void 0, void 0, function () {
            var e_3, error;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 2, , 3]);
                        this.activeSandboxes.delete(sandbox.sandboxId);
                        return [4 /*yield*/, sandbox.kill()];
                    case 1:
                        _a.sent();
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Sandbox ".concat(sandbox.sandboxId, " terminated"));
                        return [3 /*break*/, 3];
                    case 2:
                        e_3 = _a.sent();
                        error = e_3 instanceof Error ? e_3.message : String(e_3);
                        (0, logger_js_1.logWarn)('E2BSandboxManager', "Cleanup warning: ".concat(error));
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Kill all active sandboxes (emergency cleanup)
     */
    E2BSandboxManager.prototype.cleanupAll = function () {
        return __awaiter(this, void 0, void 0, function () {
            var cleanupPromises;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        (0, logger_js_1.logInfo)('E2BSandboxManager', "Cleaning up ".concat(this.activeSandboxes.size, " sandboxes..."));
                        cleanupPromises = Array.from(this.activeSandboxes.values()).map(function (sandbox) { return _this.cleanup(sandbox); });
                        return [4 /*yield*/, Promise.allSettled(cleanupPromises)];
                    case 1:
                        _a.sent();
                        this.activeSandboxes.clear();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Get execution statistics
     */
    E2BSandboxManager.prototype.getStats = function () {
        return {
            total_executions: this.executionCount,
            active_sandboxes: this.activeSandboxes.size,
            avg_duration_ms: this.executionCount > 0
                ? Math.round(this.totalDuration / this.executionCount)
                : 0
        };
    };
    return E2BSandboxManager;
}());
exports.E2BSandboxManager = E2BSandboxManager;
// Singleton instance
var managerInstance = null;
/**
 * Get singleton E2BSandboxManager instance
 */
function getE2BSandboxManager() {
    if (!managerInstance) {
        managerInstance = new E2BSandboxManager();
    }
    return managerInstance;
}
