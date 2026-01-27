import sys
import os
import logging

# Add project root to sys.path to import base_agent
# Assuming this script is in src/agents/ and base_agent is in src/agent_factory/sdk/python/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../agent_factory/sdk/python')))

from base_agent import BaseAgent

logging.basicConfig(level=logging.INFO, stream=sys.stderr)

class MytestagentAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="mytestagent",
            name="mytestagent",
            capabilities=["chat", "example"]
        )

    def on_message(self, sender_id: str, content: str):
        logging.info(f"Received message from {sender_id}: {content}")
        # Echo back
        self.send_message(sender_id, f"Echo: {content}")

if __name__ == "__main__":
    agent = MytestagentAgent()
    agent.start()
