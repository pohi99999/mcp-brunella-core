# Brunella Universal Agent Protocol (BUAP) - A2A Specification

## 1. Introduction
The Brunella Universal Agent Protocol (BUAP) defines a standard way for AI agents to communicate with each other within the Brunella ecosystem. It is built on top of the Model Context Protocol (MCP) but adds specific semantics for agent orchestration.

## 2. Communication Model
- **Topology:** Hub & Spoke. All agents communicate via a central Router.
- **Transport:** JSON-RPC 2.0 over WebSocket or Stdio (inherited from MCP).
- **Addressing:** Agents are addressed by their unique `agent_id`.

## 3. Message Types

### 3.1 Handshake (Registration)
When an agent starts, it must register with the Router.

**Request (Agent -> Router):**
```json
{
  "jsonrpc": "2.0",
  "method": "agent.register",
  "params": {
    "agent_id": "junior-python-dev-v1",
    "manifest_version": "1.0.0",
    "capabilities": ["can_read_files", "memory_enabled"]
  },
  "id": 1
}
```

**Response (Router -> Agent):**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "registered",
    "router_time": "2026-01-26T12:00:00Z"
  },
  "id": 1
}
```

### 3.2 Task Delegation (Request)
One agent asks another to perform a task.

**Request (Agent A -> Router -> Agent B):**
```json
{
  "jsonrpc": "2.0",
  "method": "agent.delegate",
  "params": {
    "target_agent_id": "code-reviewer-v1",
    "task": {
      "type": "code_review",
      "content": "def hello(): print('world')",
      "context": { "language": "python" }
    },
    "timeout": 30000
  },
  "id": 2
}
```

### 3.3 Task Result (Response)
The target agent returns the result.

**Response (Agent B -> Router -> Agent A):**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "completed",
    "output": {
      "score": 85,
      "comments": ["Missing docstring"]
    },
    "executor_id": "code-reviewer-v1"
  },
  "id": 2
}
```

### 3.4 Events (Pub/Sub)
Agents can broadcast events to topics.

**Notification (Agent -> Router):**
```json
{
  "jsonrpc": "2.0",
  "method": "agent.emit",
  "params": {
    "topic": "system.alert",
    "payload": { "message": "High memory usage" }
  }
}
```

## 4. Error Handling
Standard JSON-RPC error codes are used, plus specific BUAP codes:
- `-32001`: Target agent not found.
- `-32002`: Target agent busy.
- `-32003`: Capability denied.

## 5. Security Context
Every message includes a `_context` field injected by the Router, containing the sender's verified identity and permissions. Agents CANNOT forge this.
