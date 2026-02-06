# File: agent.py

import logging
from typing import AsyncGenerator
from typing_extensions import override

from google.adk.agents import LlmAgent, BaseAgent
from google.adk.agents.invocation_context import InvocationContext
from google.adk.events import Event

# Import sub-agents
from .sub_agents.box_agent import box_full_agent_llm

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BoxAgent(BaseAgent):
    # Field declarations for Pydantic
    box_full_agent: LlmAgent

    @override
    async def _run_async_impl(
        self, ctx: InvocationContext
    ) -> AsyncGenerator[Event, None]:
        agent_name = ctx.agent.name
        session_id = ctx.session.id
        print(
            f"Agent {agent_name} running in session {session_id} for invocation {ctx.invocation_id}"
        )

        async for event in self.box_full_agent.run_async(ctx):
            yield event


# Create and export the root_agent
# THIS IS THE CRITICAL LINE FOR THE ADK CLI
root_agent = BoxAgent(
    name="BoxFlowAgent",
    box_full_agent=box_full_agent_llm,
)
