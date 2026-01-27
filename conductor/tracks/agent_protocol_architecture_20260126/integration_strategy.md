# Integration Strategy: Frameworks & UI

## 1. The "Wrapper" Pattern
To support multiple frameworks, we define a standard **Brunella Agent Interface**. Any framework logic must be wrapped in an adapter that implements this interface.

### 1.1 LangGraph Adapter
**Concept:** A LangGraph `StateGraph` is compiled into a runnable. The Wrapper maps MCP Tool calls to LangGraph node executions.
- **Input:** `agent.delegate` params -> Graph Input State.
- **Output:** Graph Final State -> `agent.delegate` result.
- **State Persistence:** LangGraph checkpoints are saved to Brunella's LanceDB/SQLite.

### 1.2 AutoGen Adapter
**Concept:** AutoGen agents are "ConversableAgents". The Wrapper acts as a "UserProxy" for the AutoGen group chat.
- **Trigger:** A task comes in. The Wrapper initiates a chat with the AutoGen group.
- **Tools:** AutoGen agents are given "function definitions" that call back to the Brunella MCP Router.

### 1.3 CrewAI Adapter
**Concept:** CrewAI defines "Tasks" and "Agents". The Wrapper instantiates a `Crew` for a specific request.
- **Delegation:** If a CrewAI agent needs to call another Brunella agent, it uses a custom "Delegation Tool" provided by the Wrapper.

## 2. CoPilotKit Integration (Frontend)

### 2.1 The Problem
Traditional agents are text-in/text-out. CoPilotKit allows "Generative UI" (rendering widgets).

### 2.2 The Solution: `ui_components` in Manifest
Agents define what UI components they *might* render.

**Example Manifest:**
```json
"ui_components": [
  { "id": "stock_chart", "type": "chart", "props_schema": { "symbol": "str", "data": "array" } }
]
```

**Runtime Flow:**
1.  Agent wants to show a chart.
2.  Instead of just text, it sends a structured **UI Event** via BUAP:
    ```json
    {
      "type": "ui_render",
      "component_id": "stock_chart",
      "props": { "symbol": "AAPL", "data": [...] }
    }
    ```
3.  The React Dashboard (using CoPilotKit) subscribes to these events and renders the component.

### 2.3 Human-in-the-Loop
If an agent needs approval:
1.  Agent sends `ui_render` for a "Confirmation Dialog".
2.  Agent enters "Suspended" state.
3.  User clicks "Approve" on Dashboard.
4.  Dashboard sends `agent.resume` to the Router.
5.  Router wakes up the Agent Process.
