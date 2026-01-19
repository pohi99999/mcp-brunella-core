# MCP Brunella Core - Knowledge Base

## Overview
MCP Brunella Core is a comprehensive Model Context Protocol (MCP) server that provides secure and monitored access to file systems, knowledge bases, system commands, and web content for AI agents.

## Core Modules

### 1. Workspace Tool (`src/tools/workspace.ts`)
Provides secure file operations within the Brunella workspace.

**Features:**
- Read files with size limits (400KB default)
- Write files with validation
- List directories with security filtering
- Search files by pattern
- Restricted to configured workspace root

**Usage Example:**
```typescript
// Read a file
workspace_read_file({ path: "01_CONTEXT/readme.md" })

// List directory
workspace_list_directory({ path: "02_PROJECTS" })

// Search files
workspace_search_files({ 
  pattern: "*.md", 
  rootDir: "07_KNOWLEDGE_BASE" 
})
```

### 2. Knowledge Tool (`src/tools/knowledge.ts`)
Advanced semantic search and context building using LanceDB RAG.

**Features:**
- Semantic search across knowledge base
- Document indexing with embeddings
- Context-aware retrieval
- Project and documentation search

**Usage Example:**
```typescript
// Search knowledge base
knowledge_semantic_search({ 
  query: "How to integrate AnythingLLM?",
  limit: 5
})

// Index new documents
knowledge_index_file({ 
  path: "07_KNOWLEDGE_BASE/integration_guide.md" 
})
```

### 3. System Tool (`src/tools/system.ts`)
Execute whitelisted system commands with comprehensive logging.

**Allowed Commands:**
- `dir`, `ls` - Directory listing
- `type`, `cat` - File reading
- `python --version`, `node --version` - Version checks
- `echo` - Text output

**Usage Example:**
```typescript
// Check Node.js version
system_run_command({ 
  command: "node --version" 
})

// List directory
system_run_command({ 
  command: "ls -la",
  cwd: "/path/to/directory"
})
```

### 4. Browser Tool (`src/tools/browser.ts`)
Secure web browsing with Playwright.

**Features:**
- Navigate to URLs with safety checks
- Take screenshots (base64 encoded)
- Extract text content (readability mode)
- JavaScript execution support

**Usage Example:**
```typescript
// Navigate to URL
browser_navigate({ url: "https://example.com" })

// Take screenshot
browser_screenshot({ url: "https://example.com" })

// Extract text
browser_extract_text({ url: "https://example.com" })
```

### 5. Interpreter Tool (`src/tools/interpreter.ts`)
Sandboxed code execution for Python and Node.js.

**Features:**
- VM2 sandbox for Node.js (isolated environment)
- Python venv isolation
- Timeout protection (10s default)
- Size limits (50KB max code)

**Usage Example:**
```typescript
// Execute Python code
interpreter_run({ 
  language: "python",
  code: "print('Hello from Python')"
})

// Execute Node.js code
interpreter_run({ 
  language: "javascript",
  code: "console.log('Hello from Node.js')"
})
```

### 6. CLI Agent Tools

#### Copilot CLI (`src/tools/copilotCliTool.ts`)
Integration with GitHub Copilot CLI for code assistance.

#### Jules CLI (`src/tools/julesCliTool.ts`)
Integration with Jules AI agent for workflow automation.

#### Gemini CLI
Google Gemini integration for advanced AI tasks.

#### Claude Code
Anthropic Claude integration for complex coding tasks.

### 7. LLM Pipeline (`src/pipeline/llmPipeline.ts`)
Self-healing agent pipeline with iterative improvement.

**Features:**
- Generate → Test → Fix → Test cycle
- Error feedback to LLM
- Automatic retry mechanism
- Quality validation

**Usage Example:**
```typescript
// Run pipeline task
pipeline_execute({ 
  task: "Create a REST API endpoint",
  iterations: 3
})
```

### 8. Google Workspace (`src/tools/googleWorkspace.ts`)
Integration with Google Drive, Gmail, and Calendar.

**Features:**
- Upload/download files from Drive
- Send emails via Gmail
- Create calendar events
- OAuth2 authentication

### 9. Ollama Tool (`src/tools/ollamaTool.ts`)
Local LLM integration using Ollama.

**Features:**
- Run local LLM models
- Streaming responses
- Model management

## Architecture

### Security Model
1. **Workspace Isolation**: All file operations restricted to configured workspace
2. **Command Whitelisting**: Only approved commands can be executed
3. **Sandboxed Execution**: Code runs in isolated environments (VM2, venv)
4. **Comprehensive Logging**: All operations logged to `logs/` directory
5. **Sensitive Data Protection**: Automatic blocking of credentials and secrets

### Configuration
Configuration is centralized in `config.yaml` and `.env`:

- `workspaceRoot`: Base directory for file operations
- `allowedRoots`: Permitted subdirectories
- `denyContains`: Patterns to block (secrets, credentials)
- `maxReadBytes`: Maximum file read size
- `systemLogDir`: Log file location

### Logging
All operations are logged to `logs/`:
- `system_commands.log`: System command execution
- `health_status.json`: Health check results
- `brunella.db`: SQLite database for persistent storage

## System Integration

### Tool Registry
Tools are registered in `tools_registry.json` with:
- **Path**: Executable location
- **Category**: Tool classification
- **Triggers**: Conditions for automatic execution
- **Actions**: Available operations

### Task Routing
The query router (`query_router.py`) intelligently selects tools based on:
- Task type (optimization, monitoring, coding, etc.)
- System state (CPU load, memory usage, I/O latency)
- Tool availability and priority
- User preferences

### Agent Orchestration
The agent orchestrator (`agent_orchestrator.py`) delegates tasks to:
- **Gemini CLI**: Code generation, review, refactoring
- **Claude Code**: Complex coding, architecture design
- **Jules**: Automation, batch processing, workflows

Priority-based selection ensures optimal tool usage.

## Monitoring & Optimization

### System Monitoring
Automatic monitoring of:
- **CPU Load**: Triggers ProcessLasso when >80%
- **Memory Usage**: Alerts when >70%
- **I/O Latency**: Triggers CrystalDiskInfo when >100ms
- **Temperature**: HWiNFO monitoring for thermal issues

### Performance Tools
- **ProcessLasso**: CPU priority and affinity optimization
- **CrystalDiskInfo**: SSD health and performance
- **HWiNFO**: Comprehensive hardware monitoring

## Usage Patterns

### For Development
```bash
# Install dependencies
npm install

# Build project
npm run build

# Run in development mode
npm run dev

# Run health check
./status_report.sh  # Linux/Mac
.\healthcheck.ps1   # Windows
```

### For Production
```bash
# Build and start
npm run build
npm start

# Monitor logs
tail -f logs/system_commands.log
```

### For AI Agents
Agents interact through MCP protocol:
1. Connect to server via stdio transport
2. Discover available tools
3. Execute tools with validated parameters
4. Receive structured responses

## Best Practices

### Security
1. Never expose credentials in code or logs
2. Always validate file paths against allowed roots
3. Use sandboxed environments for code execution
4. Monitor command execution logs regularly

### Performance
1. Use semantic search for large knowledge bases
2. Enable caching for frequently accessed data
3. Monitor system resources and trigger optimization tools
4. Batch operations when possible

### Maintainability
1. Keep tools modular and focused
2. Document all new tools in this knowledge base
3. Update tools_registry.json when adding external tools
4. Regular health checks and log reviews

## External Tool Integration

### Adding New Tools
1. Define tool in `tools_registry.json`
2. Specify triggers and conditions
3. Add to task categories
4. Update query router logic
5. Document in knowledge base

### Example: ProcessLasso Integration
```json
{
  "ProcessLasso": {
    "path": "C:\\Tools\\ProcessLasso\\lasso.exe",
    "trigger": {
      "condition": "cpu_load > 80 AND llm_active = true"
    },
    "actions": [
      {"name": "optimize", "args": ["/optimize"]}
    ]
  }
}
```

## References

### Repository Structure
- `/src` - Source code (TypeScript)
- `/build` - Compiled JavaScript
- `/logs` - Operation logs
- `/public` - Web interface assets
- `/config.yaml` - Main configuration
- `/.env` - Environment variables

### Related Projects
- [Model Context Protocol](https://github.com/modelcontextprotocol/specification)
- [LanceDB](https://github.com/lancedb/lancedb) - Vector database
- [Playwright](https://playwright.dev/) - Browser automation
- [VM2](https://github.com/patriksimek/vm2) - Sandboxed execution

### Documentation
- `README.md` - Main documentation
- `CONDUCTOR_PLAN.md` - Upgrade roadmap
- `INTEGRATION_PLAN.md` - Integration strategy
- `SECURITY.md` - Security guidelines

## Troubleshooting

### Common Issues

#### Server Won't Start
```bash
# Check Node.js installation
node --version

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild project
npm run build
```

#### Tool Not Found
```bash
# Verify tool registration
grep "toolName" tools_registry.json

# Check path configuration
cat config.yaml | grep toolPath
```

#### Permission Denied
```bash
# Check workspace configuration
grep workspaceRoot config.yaml

# Verify file permissions
ls -la /path/to/workspace
```

## Future Enhancements

### Planned Features
- [ ] AnythingLLM integration
- [ ] Advanced agent orchestration
- [ ] Real-time system monitoring dashboard
- [ ] Automated task trigger system
- [ ] Enhanced RAG with multiple embedding models
- [ ] Multi-modal support (images, audio)

### Optimization Opportunities
- [ ] Parallel tool execution
- [ ] Caching layer for frequent queries
- [ ] Incremental knowledge base updates
- [ ] Load balancing for multiple agents
- [ ] Resource-aware task scheduling
