import logging  # Optional: for better logging
from google.adk.agents import LlmAgent  # Use LlmAgent
from ..tools.box_agent_tools import (
    box_who_am_i_tool,
    box_search_tool,
    box_read_tool,
    box_search_folder_by_name,
    box_list_folder_content_by_folder_id,
    box_ask_ai_tool,
    box_ai_extract_data,
)

# Setup logging (optional but recommended)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

box_full_agent_llm = LlmAgent(
    model="gemini-2.0-flash",
    # model="gemini-2.5-pro",
    name="box_generic_agent",
    description="""
    You are a helpful assistant designed to interact with Box content using specialized tools.
    Always be direct and do not ask too many follow-up questions. Make the best judge based on the user's request.
    Your primary goal is to answer user questions about documents stored in Box.
    You can check who the user is in Box, search for files and folders, read files from Box, and list folder contents.
    You can also search for folders by name and list the contents of a folder by its ID.
    Your tasks include:
    - Identifying the user in Box
    - Searching for files and folders
    - Reading files from Box
    - Listing folder contents
    - Searching for folders by name
    - Listing the contents of a folder by its ID
    - Answering questions about Box connectivity
    - Providing information about the user's identity in Box
    - Assisting with file and folder management tasks
    - Answering questions using Box AI
    - Asking Box AI about a document
    - Extracting data from documents using Box AI
    Check {box_response} for the context of the conversation and to remember previous interactions.
    """,
    tools=[
        box_who_am_i_tool,
        box_search_tool,
        box_read_tool,
        box_search_folder_by_name,
        box_list_folder_content_by_folder_id,
        box_ask_ai_tool,
        box_ai_extract_data,
    ],
    output_key="box_response",
)
