# Security Policy - Brunella Agent System

## MCP Safe Zone Security Framework

### Overview

The Brunella Agent System implements a **Safe Zone** security model for filesystem operations through the Model Context Protocol (MCP). This ensures AI agents can only access authorized directories and prevents unauthorized file access.

---

## Safe Zone Configuration

Safe Zones are defined in `config/safe_zones.json`:

```json
{
  "safe_zones": [
    {
      "name": "Data Directory",
      "path": "./data",
      "permissions": ["read", "write", "delete"],
      "max_file_size_mb": 100,
      "allowed_extensions": ["txt", "json", "csv", "md", "log", "png", "jpg", "pdf"]
    }
  ],
  "blacklist": [".env", ".env.*", ".git/**", "*.key", "*.pem"],
  "audit": {
    "enabled": true,
    "log_path": "./logs/mcp_audit.log",
    "retention_days": 90
  }
}
```

### Safe Zones

| Zone Name | Path | Permissions | Max File Size |
|-----------|------|-------------|---------------|
| **Data Directory** | `./data` | read, write, delete | 100 MB |
| **Tracks** | `./conductor/tracks` | read, write | 50 MB |
| **Incubator** | `./myai/incubator` | read, write | 200 MB |
| **Logs** | `./logs` | read, write, append | 50 MB |
| **Artifacts** | `./data/e2b_artifacts` | read, write | 500 MB |

---

## Blacklist Enforcement

The following patterns are **ALWAYS BLOCKED**, regardless of Safe Zone:

### Critical Files
- `.env`, `.env.*` - Environment variables
- `*.key`, `*.pem` - Cryptographic keys
- `credentials.json`, `token.json` - Legacy Google OAuth secrets
- `config/google-service-account.json` - Service account credentials
- `credentials/google-service-account.json` - Service account credentials
- `config/google_credentials.json`, `config/google_token.json` - Legacy Google Workspace OAuth secrets
- `credentials/google-oauth2-credentials.json`, `credentials/google-token.json` - Google Workspace OAuth secrets

### System Directories
- `.git/**` - Git repository internals
- `node_modules/**` - Package dependencies
- `.venv/**` - Python virtual environment

### Suspicious Patterns
- `../` - Path traversal attempts
- `~/` - Home directory access
- `/etc/`, `/sys/`, `/proc/` - System directories (Linux)
- `C:\Windows\`, `C:\Program Files\` - System directories (Windows)

---

## Security Features

### 1. Path Validation

All file paths are:
- ✅ Normalized (resolved to absolute paths)
- ✅ Checked against Safe Zone whitelist
- ✅ Checked against blacklist patterns
- ✅ Validated for suspicious patterns (path traversal)

```typescript
// Example: Safe Zone validation
const validator = getSafeZoneValidator();

if (!validator.validate(filePath, 'read')) {
  throw new Error('Access denied: Path outside Safe Zone');
}
```

### 2. Rate Limiting

Prevent abuse with configurable rate limits:
- **Max operations per minute:** 100
- **Max operations per hour:** 5,000

Exceeding limits results in automatic denial with audit log entry.

### 3. Audit Logging

All filesystem operations are logged:

```json
{
  "timestamp": "2026-02-18T10:30:45.123Z",
  "verdict": "ALLOWED",
  "path": "./data/output.json",
  "operation": "write",
  "zone": "Data Directory",
  "user_agent": "DataScientistAgent"
}
```

**Audit log location:** `./logs/mcp_audit.log`

**Retention:** 90 days (configurable)

### 4. E2B Sandbox Isolation

Python code execution via E2B sandboxes provides:
- ✅ **Network isolation** - No outbound connections by default
- ✅ **Filesystem isolation** - Code runs in containerized environment
- ✅ **Resource limits** - CPU, memory, timeout constraints
- ✅ **Artifact export** - Results copied to Safe Zone after validation

```python
# Example: E2B sandbox execution
from myai.security.e2b_sandbox_manager import getE2BSandboxManager

manager = getE2BSandboxManager()
result = await manager.executeCode(
    code="import pandas as pd; df = pd.read_csv('data.csv')",
    packages=["pandas"],
    timeout_ms=30000,
    export_artifacts=True,
    safe_zone_path="./data/e2b_artifacts"
)
```

---

## Best Practices

### For Developers

1. **Always use MCP tools** for filesystem operations
   ```typescript
   // ✅ Correct
   const result = await mcpServer.handleReadFile({ path: './data/file.txt' });

   // ❌ Wrong
   const content = fs.readFileSync('./data/file.txt');
   ```

2. **Never hardcode credentials** in code or config files
    - Use environment variables (`.env`)
    - Keep `.env` in `.gitignore`
    - Use Safe Zone validator to prevent `.env` access
    - Prefer `GOOGLE_CREDENTIALS_FILE` or `GOOGLE_SERVICE_ACCOUNT_JSON` for invoice automation service accounts
    - Prefer `GOOGLE_WORKSPACE_CREDENTIALS_FILE` and `GOOGLE_WORKSPACE_TOKEN_FILE` for interactive Google Workspace OAuth
    - Do not fall back to repository-root `credentials.json` or `token.json` in new setups

3. **Validate user input** before passing to MCP tools
   ```typescript
   if (!input.startsWith('./data/')) {
     throw new Error('Invalid path: must be within data directory');
   }
   ```

4. **Review audit logs regularly**
    ```bash
    # View recent denied operations
    tail -f logs/mcp_audit.log | grep DENIED
    ```

5. **Set required federation secrets in every environment**
   - `REMOTE_AUTH_SECRET` must be set for remote operator auth
   - `MANIFEST_SIGNING_SECRET` must be set to a random 32+ character secret for federation manifest signing
   - Do not rely on development fallbacks for production federation surfaces

### For Agent Developers

1. **Use Safe Zone paths** in agent logic
   ```python
   # ✅ Correct
   result = await bridge.write_file("./data/output.json", data)

   # ❌ Wrong
   result = await bridge.write_file("/tmp/output.json", data)
   ```

2. **Handle access denials gracefully**
   ```python
   result = await bridge.read_file(path)
   if not result["success"]:
       logger.error(f"Access denied: {result['error']}")
       # Fallback logic here
   ```

3. **Use E2B sandboxes for untrusted code**
   ```python
   # For user-provided Python code
   manager = getE2BSandboxManager()
   result = await manager.executeCode(user_code)
   ```

---

## Security Audit Checklist

Before deploying to production, verify:

- [ ] All Safe Zones configured correctly
- [ ] Blacklist includes all sensitive patterns
- [ ] Audit logging enabled and tested
- [ ] Rate limiting configured appropriately
- [ ] E2B API key secured (not in git)
- [ ] `.env` file in `.gitignore`
- [ ] No hardcoded credentials in codebase
- [ ] Audit log retention configured
- [ ] Test path traversal attacks (should be blocked)
- [ ] Test blacklist bypass (should be blocked)

### Path Traversal Test

```bash
# Should be DENIED
curl -X POST http://localhost:3000/api/v1/mcp/tools/read_file \
  -H "Content-Type: application/json" \
  -d '{"args": {"path": "../../etc/passwd"}}'
```

### Blacklist Test

```bash
# Should be DENIED
curl -X POST http://localhost:3000/api/v1/mcp/tools/read_file \
  -H "Content-Type: application/json" \
  -d '{"args": {"path": ".env"}}'
```

---

## Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Instead:
1. Email: security@brunella-ai.com (if available)
2. Or create a private security advisory on GitHub

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

---

## Security Updates

| Version | Date | Security Fix |
|---------|------|--------------|
| 1.0.0 | 2026-02-18 | Initial Safe Zone implementation |

---

## Additional Resources

- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [E2B Security Docs](https://e2b.dev/docs/security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Last Updated:** 2026-02-18
**Security Contact:** Brunella AI Development Team
