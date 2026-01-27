# Process-Based Runtime Design

## 1. Supervisor Architecture
The Supervisor is the "Kernel" of the Agent Factory. It is responsible for the lifecycle management of all agents.

### Responsibilities:
- **Spawn:** Creating new OS processes for agents based on their Manifest.
- **Monitor:** Checking heartbeats and restarting failed agents.
- **Limit:** Enforcing resource quotas (CPU, RAM) and sandbox policies.
- **Route:** Establishing the initial communication channel (stdio/websocket) between the Agent and the Router.

## 2. Agent Process Lifecycle

1.  **Instantiation:**
    - Supervisor reads `agent_manifest.json`.
    - Resolves dependencies (Python venv, Node modules).
    - Allocates a unique `PID` and `agent_id`.

2.  **Boot:**
    - Process starts.
    - Sandbox initializes (e.g., restricted file access).
    - Agent loads its "Brain" (Model & Prompt).

3.  **Handshake:**
    - Agent sends `agent.register` to the Router via StdIO.
    - Router verifies capabilities and returns a session token.

4.  **Active Loop:**
    - Agent waits for tasks (`agent.delegate`) or events.
    - Agent emits heartbeats to Supervisor.

5.  **Shutdown:**
    - Graceful: Supervisor sends `SIGTERM`. Agent saves state to LanceDB.
    - Force: Supervisor sends `SIGKILL` if timeout exceeded.

## 3. Security Boundaries
- **Network:** Agents have NO direct internet access unless explicitly granted in capabilities. All traffic goes through MCP Tools.
- **Filesystem:** Agents are chrooted or restricted to a specific `./workspace/<agent_id>` directory.
- **A2A:** Agents cannot "see" other agent processes. They can only communicate via the Router.

## 4. Implementation Strategy (Node.js + Python)
- **Node.js (Supervisor):** Uses `child_process.spawn` or `pm2` programmatic API.
- **Python (Agents):** Wrapped in a `BrunellaAgentRunner` class that handles the MCP boilerplate.
