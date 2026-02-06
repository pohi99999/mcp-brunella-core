"""
Proaktív Kódíró és Rendszerező Aszisztens Ügynök - Példa Implementáció

Ez egy teljes működő példa, amit azonnal használhatsz.
"""

from google.adk.agents import LlmAgent
from google.adk.apps.app import App
from google.genai import types as genai_types

# Import custom tools
from coding_assistant_tools_example import get_all_tools


def get_agent(workspace_root: str = ".") -> LlmAgent:
    """
    Create the proactive coding assistant agent with file management tools.
    
    Args:
        workspace_root: Root directory for the workspace (default: current directory)
    
    Returns:
        LlmAgent: Configured agent with all tools
    """
    
    # Get all tools
    tools = get_all_tools(workspace_root=workspace_root)
    
    # Create agent with tools
    agent = LlmAgent(
        model="gemini-2.0-flash-exp",
        tools=tools,
        system_instruction="""You are a proactive coding assistant that helps manage and organize projects.

Your capabilities:
- Read and write files in the workspace
- Organize project structure
- Search for files and content
- Manage git repositories
- Suggest improvements proactively
- Help with code organization

Guidelines:
- Be helpful, proactive, and always ask before making significant changes
- When reading files, provide context about what you found
- When writing files, ensure proper formatting and structure
- Proactively suggest improvements when you notice issues
- Help organize code and project structure
- Assist with git operations when needed

Workspace root: {workspace_root}

Remember: Always be helpful and proactive, but ask for confirmation before making major changes.""".format(workspace_root=workspace_root),
    )
    
    return agent


def create_app(workspace_root: str = ".") -> App:
    """
    Create the ADK app with the coding assistant agent.
    
    Args:
        workspace_root: Root directory for the workspace
    
    Returns:
        App: Configured ADK app
    """
    app = App()
    app.agent = get_agent(workspace_root=workspace_root)
    return app


# Main entry point
if __name__ == "__main__":
    import os
    
    # Get workspace root from environment or use current directory
    workspace_root = os.getenv("WORKSPACE_ROOT", ".")
    
    # Create app
    app = create_app(workspace_root=workspace_root)
    
    # Run with ADK web UI
    # Use: uv run adk web --port=8504
    print(f"✅ Coding Assistant Agent created")
    print(f"📁 Workspace root: {workspace_root}")
    print(f"🛠️  Tools loaded: {len(app.agent.tools)}")
    print(f"\n🚀 Start with: uv run adk web --port=8504")


