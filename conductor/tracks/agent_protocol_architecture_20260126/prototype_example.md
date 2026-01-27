# Prototype Example: Junior Python Developer Agent

This document demonstrates how the BUAP components work together for a specific agent.

## 1. The Manifest (`agent_manifest.json`)
```json
{
  "metadata": {
    "id": "junior-python-dev-v1",
    "name": "Junior Python Developer",
    "version": "1.0.0",
    "author": "Brunella Factory",
    "tags": ["python", "development", "junior"]
  },
  "model_config": {
    "provider": "vertex_ai",
    "model_name": "gemini-pro"
  },
  "system_prompt": "You are a junior Python developer. You write clean, PEP8 compliant code. When asked to write code, you first plan the steps, then write the code, then verify it.",
  "tools": [
    {
      "name": "file_system",
      "source": "mcp_server",
      "config": { "root_dir": "./workspace" }
    },
    {
      "name": "run_python",
      "source": "builtin"
    }
  ],
  "runtime": {
    "type": "declarative"
  },
  "ui_components": [
    {
      "id": "code_preview",
      "type": "custom",
      "label": "Generated Code",
      "props_schema": { "code": "string", "language": "string" }
    }
  ]
}
```

## 2. The Workflow Execution

### Step 1: User Request
**User (via Dashboard):** "Create a Python script that calculates the Fibonacci sequence."

### Step 2: Router Dispatch
The Router identifies the user intent and delegates the task to `junior-python-dev-v1`.

**Message:**
```json
{
  "method": "agent.delegate",
  "params": {
    "task": {
      "type": "chat",
      "content": "Create a Python script that calculates the Fibonacci sequence."
    }
  }
}
```

### Step 3: Agent Reasoning (Internal)
The agent (powered by Gemini Pro) processes the request.
1.  **Thought:** I need to write a recursive or iterative function. I'll write the file then test it.
2.  **Action:** Call `file_system.write_file`.

### Step 4: Tool Execution (MCP)
The agent sends an MCP tool call request to the Router (which acts as the MCP host).
**Tool Call:** `write_file(path="fib.py", content="def fib(n): ...")`
**Result:** `Success`

### Step 5: UI Feedback (CoPilotKit)
The agent wants to show the code to the user. It emits a UI event.

**Event:**
```json
{
  "method": "agent.emit",
  "params": {
    "topic": "ui.render",
    "payload": {
      "component_id": "code_preview",
      "props": {
        "code": "def fib(n): ...",
        "language": "python"
      }
    }
  }
}
```

**Dashboard:** Renders a syntax-highlighted code block.

### Step 6: Completion
The agent reports success to the Router.
```json
{
  "result": {
    "status": "completed",
    "output": "I have created the fib.py script."
  }
}
```

## 3. A2A Scenario (Advanced)
If the User asked: "Create a Fibonacci script **and write a test for it**."

1.  The `junior-python-dev-v1` might realize it's not good at testing.
2.  It sends a `agent.delegate` request to a `qa-engineer-v1` agent (if available).
3.  `qa-engineer-v1` writes `test_fib.py` and returns the result.
4.  `junior-python-dev-v1` reports final success.
