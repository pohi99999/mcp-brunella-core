# Spec: DeveloperAgent 2.0 - Technical Specification

**Track ID:** `developer_agent_2_0_20260206`
**Version:** 2.0.0
**Last Updated:** 2026-02-06

---

## 🎯 Overview

DeveloperAgent 2.0 is a self-healing AI developer that generates code, writes tests, fixes errors, and commits changes. Uses GPT-4o (GitHub Models) for intelligent code generation.

---

## 📦 Module Structure

```
src/agents/DeveloperAgent.ts
├── Core Agent (IAgent interface)
├── Task Routing (7 handlers)
├── Self-Healing Pipeline
└── Utility Methods
```

---

## 🔧 API Specification

### IAgent Interface Implementation

```typescript
interface IAgent {
  name: string;
  role: string;
  description: string;
  capabilities: string[];
  execute(task: string, context?: any): Promise<AgentResponse>;
}
```

### AgentResponse

```typescript
interface AgentResponse {
  status: "success" | "error" | "delegated" | "handoff";
  data?: any;
  error?: string;
  message?: string;
}
```

---

## 🎯 Task Handlers

### 1. handleCodeGeneration()

**Trigger:** Task includes keywords like "generate", "create", "write" + "function", "class", "module"

**Input:**
```typescript
{
  task: string;           // e.g., "generate function add(a, b)"
  context?: {
    filePath?: string;    // Where to save
    language?: string;    // TypeScript (default), Python, JS
  }
}
```

**Process:**
1. Build LLM prompt with system instructions
2. Call GPT-4o via `generateResponse()`
3. Parse and clean generated code
4. Save to file (if filePath provided)
5. Run `npm run build` to validate
6. If build fails → trigger `selfHealBuild()`

**Output:**
```typescript
{
  status: "success" | "error";
  data: {
    code: string;
    provider: string;     // "github"
    buildSuccess?: boolean;
  };
  message: string;
}
```

---

### 2. handleTestGeneration()

**Trigger:** Task includes "test", "spec", "vitest", "jest"

**Input:**
```typescript
{
  task: string;              // e.g., "generate tests for add function"
  context?: {
    sourceCode?: string;     // Code to test
    testFilePath?: string;   // Where to save test
  }
}
```

**Process:**
1. Build test generation prompt (Vitest syntax)
2. Call GPT-4o
3. Parse test code
4. Save to test file
5. Run tests: `npx vitest run <testFile>`

**Output:**
```typescript
{
  status: "success" | "error";
  data: {
    testCode: string;
    testResult?: {
      success: boolean;
      output: string;
    };
  };
  message: string;
}
```

---

### 3. handleErrorFix()

**Trigger:** Task includes "fix", "repair", "debug", "error", "bug"

**Input:**
```typescript
{
  task: string;           // e.g., "fix build error in file X"
  context: {
    error: string;        // Error message
    filePath?: string;    // File to fix
  }
}
```

**Process:**
1. Read source file (if filePath)
2. Build fix prompt with error + code
3. Call GPT-4o
4. Apply fix
5. Verify build

**Output:**
```typescript
{
  status: "success" | "error";
  data: {
    fixedCode: string;
    buildSuccess: boolean;
  };
  message: string;
}
```

---

### 4. handlePythonExecution()

**Trigger:** Task includes Python syntax OR context.code exists

**Input:**
```typescript
{
  task: string;      // Python code as string
  context?: {
    code: string;    // Explicit Python code
  }
}
```

**Process:**
1. Extract Python code
2. Execute via `globalPythonShell.run()`
3. Return output/error

**Output:**
```typescript
{
  status: "success" | "error";
  data: {
    output: any;     // Python execution result
  };
  error?: string;
}
```

---

### 5. handleGitOperation()

**Trigger:** Task includes "git", "commit", "push", "branch"

**Input:**
```typescript
{
  task: string;              // e.g., "commit changes"
  context?: {
    commitMessage?: string;  // Commit message
    branchName?: string;     // Branch name for new branch
  }
}
```

**Supported Operations:**
- `commit` - Stage all and commit
- `branch` - Create new branch

**Output:**
```typescript
{
  status: "success" | "error";
  message: string;    // e.g., "Committed: message"
}
```

---

### 6. handleGenericTask()

**Trigger:** Fallback for unrecognized tasks

**Process:**
1. Send entire task to GPT-4o
2. Let LLM decide what to do
3. Return response

---

## 🔄 Self-Healing Pipeline

### selfHealBuild()

**Purpose:** Automatically fix build errors

**Algorithm:**
```
1. Build fails with error
2. FOR attempt = 1 TO maxRetries (3):
   a. Send error + code to GPT-4o
   b. Get fixed code
   c. Save and re-build
   d. IF build succeeds → RETURN success
   e. ELSE update error message
3. IF all retries fail → RETURN error
```

**Parameters:**
```typescript
selfHealBuild(
  originalCode: string,
  buildError: string,
  filePath: string
): Promise<AgentResponse>
```

**Success Rate Target:** >70% of build errors auto-fixed

---

## 🧰 Utility Methods

### saveCode()
```typescript
async saveCode(filePath: string, code: string): Promise<void>
```
Creates directories if needed, writes file.

### tryBuild()
```typescript
async tryBuild(): Promise<{ success: boolean; error?: string }>
```
Runs `npm run build`, returns success/error.

### runTests()
```typescript
async runTests(testFile?: string): Promise<{ success: boolean; output?: string }>
```
Runs `npm test` or specific test file.

---

## 🔗 Dependencies

### Internal
- `src/core/llm_client.ts` - GPT-4o integration
- `src/utils/logger.ts` - Logging
- `src/utils/pythonShell.ts` - Python execution

### External
- `@google/generative-ai` - Gemini fallback
- `child_process` - Shell commands
- `fs/promises` - File operations

---

## ⚙️ Configuration

### Environment Variables

```env
# LLM Provider (default: github)
LLM_PROVIDER=github

# GitHub Models (GPT-4o)
GITHUB_TOKEN=ghp_xxxxx                    # Auto-detected via gh CLI
GITHUB_MODELS_DEFAULT_MODEL=gpt-4o       # Default model

# Timeouts
LLM_TIMEOUT_MS=120000                     # 2 minutes

# LangSmith (optional tracing)
LANGCHAIN_API_KEY=lsv2_xxxxx
```

### Agent Configuration

```typescript
private llmProvider = 'github';     // GPT-4o default
private maxRetries = 3;             // Self-healing attempts
private buildTimeout = 120000;      // 2 minutes
```

---

## 🧪 Testing Strategy

### Unit Tests (`test/developer_agent_2_0.test.ts`)

```typescript
describe('DeveloperAgent 2.0', () => {
  it('should generate code for simple function');
  it('should generate Vitest tests');
  it('should fix build errors automatically');
  it('should execute Python code');
  it('should commit changes to git');
  it('should self-heal after 3 retries');
});
```

### Integration Tests (CLI)

```bash
# Code generation
brunella agent Developer "generate function fibonacci(n)"

# Test generation
brunella agent Developer "generate tests for src/utils/math.ts"

# Error fixing
brunella agent Developer "fix error in src/agents/X.ts" --context error="TypeError"

# Python execution
brunella agent Developer "print('hello')" --context code="print('hello')"

# Git commit
brunella agent Developer "commit changes" --context commitMessage="Add feature X"
```

---

## 📊 Performance Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code generation success | >90% | % of valid code generated |
| Build auto-fix success | >70% | % of build errors fixed |
| Average response time | <30s | Time to GPT-4o response |
| Test generation accuracy | >80% | % of passing tests |
| Self-healing iterations | ≤2 | Avg. retries before success |

---

## 🚨 Error Handling

### Error Types

1. **LLM Error** - GPT-4o API failure
   - Fallback: Try Ollama
   - Log: LangSmith trace

2. **Build Error** - TypeScript compilation fails
   - Action: Trigger `selfHealBuild()`
   - Max retries: 3

3. **Test Error** - Generated tests fail
   - Action: Log warning, return error response
   - No auto-retry (tests might be correct, code might be wrong)

4. **File Error** - Cannot read/write file
   - Action: Return error immediately
   - No retry

### Error Response Format

```typescript
{
  status: "error";
  error: string;            // Human-readable error
  data?: {
    lastCode?: string;      // Last attempted code
    attempts?: number;      // Retry count
  };
}
```

---

## 🔐 Security Considerations

1. **Code Execution**
   - Python code runs in FastAPI subprocess (port 8000)
   - No shell injection (parameterized commands)

2. **File Operations**
   - Only writes to project directory
   - No directory traversal (path.resolve validation)

3. **Git Operations**
   - Sanitized commit messages (escape quotes)
   - No forced operations without confirmation

---

## 📝 Change Log

### v2.0.0 (2026-02-06)
- Complete rewrite from v1.0
- Added GPT-4o integration
- Added test generation
- Added self-healing pipeline
- Added git operations
- Expanded from 47 to 400+ lines

---

## 🔗 Related Documents

- [Track Plan](./plan.md)
- [README.md](../../../README.md) - Bootstrap protocol
- [src/core/llm_client.ts](../../../src/core/llm_client.ts) - LLM integration

---

**Status:** ✅ Implemented
**Next:** CLI integration + Memory Bank
