import sys
import json
import logging
import threading
from typing import List, Dict, Any, Optional, Callable

# Configure logging to stderr to avoid interfering with stdout JSON communication
logging.basicConfig(level=logging.INFO, stream=sys.stderr, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger("BaseAgent")

class BaseAgent:
    def __init__(self, agent_id: str, name: str, capabilities: List[str]):
        self.agent_id = agent_id
        self.name = name
        self.capabilities = capabilities
        self.running = False
        self._handlers: Dict[str, Callable[[Any], Any]] = {}

        # Register default handlers
        self.register_handler("ping", self._handle_ping)
        self.register_handler("agent.on_message", self._handle_on_message)

    def register_handler(self, method: str, handler: Callable[[Any], Any]):
        """Registers a method handler for JSON-RPC requests."""
        self._handlers[method] = handler

    def start(self):
        """Starts the agent loop."""
        self.running = True
        self._perform_handshake()
        self._listen_loop()

    def stop(self):
        """Stops the agent loop."""
        self.running = False

    def on_message(self, sender_id: str, content: str):
        """Virtual method to be overridden by subclasses."""
        pass

    def _perform_handshake(self):
        """Sends the handshake request to the router."""
        request = {
            "jsonrpc": "2.0",
            "method": "agent.register",
            "params": {
                "agent_id": self.agent_id,
                "capabilities": self.capabilities
            },
            "id": 1
        }
        self._send_json(request)
        logger.info(f"Sent handshake for agent {self.agent_id}")

    def _listen_loop(self):
        """Reads from stdin line by line."""
        logger.info("Starting input listener loop")
        for line in sys.stdin:
            if not self.running:
                break
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                self._handle_incoming(data)
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {line}")
            except Exception as e:
                logger.error(f"Error handling message: {e}")

    def _handle_incoming(self, data: Dict[str, Any]):
        """Dispatches incoming JSON-RPC messages."""
        # Handle Request
        if "method" in data:
            self._handle_request(data)
        # Handle Response (not implemented fully for base yet, primarily acting as server)
        elif "result" in data or "error" in data:
            self._handle_response(data)
        else:
            logger.warning(f"Unknown message format: {data}")

    def _handle_request(self, request: Dict[str, Any]):
        method = request.get("method")
        params = request.get("params")
        msg_id = request.get("id")

        if method in self._handlers:
            try:
                result = self._handlers[method](params)
                if msg_id is not None:
                    response = {
                        "jsonrpc": "2.0",
                        "result": result,
                        "id": msg_id
                    }
                    self._send_json(response)
            except Exception as e:
                logger.error(f"Error executing handler for {method}: {e}")
                if msg_id is not None:
                    error_response = {
                        "jsonrpc": "2.0",
                        "error": {"code": -32603, "message": str(e)},
                        "id": msg_id
                    }
                    self._send_json(error_response)
        else:
            logger.warning(f"Method not found: {method}")
            if msg_id is not None:
                error_response = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32601, "message": "Method not found"},
                    "id": msg_id
                }
                self._send_json(error_response)

    def _handle_response(self, response: Dict[str, Any]):
        # TODO: Link responses to sent requests if needed
        logger.info(f"Received response: {response}")

    def _send_json(self, data: Dict[str, Any]):
        """Writes JSON to stdout."""
        try:
            json_str = json.dumps(data)
            sys.stdout.write(json_str + "\n")
            sys.stdout.flush()
        except Exception as e:
            logger.error(f"Failed to send JSON: {e}")

    # --- Default Handlers ---

    def _handle_ping(self, params: Any):
        return "pong"

    def _handle_on_message(self, params: Any):
        sender_id = params.get("from")
        content = params.get("content")
        self.on_message(sender_id, content)
        return "received"

    # --- User Methods ---
    
    def send_message(self, target_agent_id: str, content: str):
        """Sends a message to another agent."""
        request = {
            "jsonrpc": "2.0",
            "method": "agent.message",
            "params": {
                "target_agent_id": target_agent_id,
                "content": content
            },
            # Using a random ID or managing ID generation would be better
            "id": f"msg_{id(content)}" 
        }
        self._send_json(request)