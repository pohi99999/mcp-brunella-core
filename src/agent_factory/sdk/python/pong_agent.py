from base_agent import BaseAgent
import sys
import logging

class PongAgent(BaseAgent):
    def on_message(self, sender_id, content):
        if content == "Ping":
            # Log to stderr so we can see it in Supervisor logs
            logging.info(f"Received Ping from {sender_id}, sent Pong.")
            self.send_message(sender_id, "Pong")

if __name__ == "__main__":
    # Correct constructor: agent_id, name, capabilities
    agent = PongAgent("pong-agent", "Pong Agent", ["pong"])
    agent.start()