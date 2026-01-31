"""
Proaktív Kódíró és Rendszerező Aszisztens Ügynök

Ez egy egyszerű, közvetlenül használható ügynök fájlkezelési eszközökkel.
Használhatod önállóan vagy integrálhatod a meglévő agents-chat rendszerbe.
"""

import os
from pathlib import Path
from google.adk.agents import LlmAgent
from google.adk.apps.app import App

# Import file management tools
from .file_tools import get_file_management_tools


def get_coding_assistant_agent(workspace_root: str = None) -> LlmAgent:
    """
    Create a proactive coding assistant agent with file management tools.
    
    Args:
        workspace_root: Root directory for the workspace (default: G:\Brunella)
    
    Returns:
        LlmAgent: Configured agent with all tools
    """
    
    # Default workspace root
    if workspace_root is None:
        workspace_root = os.getenv("WORKSPACE_ROOT", "G:\\Brunella")
    
    # Get all file management tools
    tools = get_file_management_tools(workspace_root=workspace_root)
    
    # Create agent with tools
    agent = LlmAgent(
        model="gemini-2.0-flash-exp",
        name="coding_assistant",
        tools=tools,
        instruction=f"""You are a proactive coding assistant that helps manage and organize projects.

Your capabilities:
- Read and write files in the workspace
- Organize project structure
- Search for files and content
- Manage git repositories
- Suggest improvements proactively
- Help with code organization

Workspace root: {workspace_root}

Guidelines:
- Be helpful, proactive, and always ask before making significant changes
- When reading files, provide context about what you found
- When writing files, ensure proper formatting and structure
- Proactively suggest improvements when you notice issues
- Help organize code and project structure
- Assist with git operations when needed
- Remember file paths relative to the workspace root

Remember: Always be helpful and proactive, but ask for confirmation before making major changes.""",
    )
    
    return agent


def create_coding_assistant_app(workspace_root: str = None) -> App:
    """
    Create the ADK app with the coding assistant agent.
    
    Args:
        workspace_root: Root directory for the workspace
    
    Returns:
        App: Configured ADK app
    """
    app = App()
    app.agent = get_coding_assistant_agent(workspace_root=workspace_root)
    app.name = "coding_assistant"
    return app


# Create default app instance (can be imported)
_workspace_root = os.getenv("WORKSPACE_ROOT", "G:\\Brunella")
app = create_coding_assistant_app(workspace_root=_workspace_root)

# Main entry point
if __name__ == "__main__":
    print(f"✅ Coding Assistant Agent created")
    print(f"📁 Workspace root: {_workspace_root}")
    print(f"🛠️  Tools loaded: {len(app.agent.tools)}")
    print(f"\n🚀 Start with: uv run adk web app.coding_assistant_agent --port=8504")

