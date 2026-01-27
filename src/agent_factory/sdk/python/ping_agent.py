import time
import threading
from base_agent import BaseAgent
import logging

class PingAgent(BaseAgent):
    def on_message(self, sender_id, content):
        if content == "Pong":
            logging.info(f"Received Pong from {sender_id}!")
            # Stop or continue? Let's just log.

    def start_pinging(self):
        time.sleep(2) # Wait for registration and pong agent to be ready
        logging.info("Sending Ping...")
        self.send_message("pong-agent", "Ping")

if __name__ == "__main__":
    # Correct constructor: agent_id, name, capabilities
    agent = PingAgent("ping-agent", "Ping Agent", ["ping"])
    
    t = threading.Thread(target=agent.start_pinging)
    t.daemon = True
    t.start()
    
    agent.start()