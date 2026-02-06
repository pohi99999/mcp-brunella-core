"""
Példa fájlkezelési eszközök proaktív kódíró ügynökhöz.

Ezeket az eszközöket hozzáadhatod bármely ADK ügynökhöz.
"""

from pathlib import Path
from typing import Optional
from google.adk.tools import Tool
from pydantic import BaseModel, Field


# ============================================================================
# Fájlkezelési Eszközök
# ============================================================================

class ReadFileInput(BaseModel):
    """Input for reading a file."""
    file_path: str = Field(description="Path to the file to read (relative to workspace root)")


class WriteFileInput(BaseModel):
    """Input for writing to a file."""
    file_path: str = Field(description="Path to the file to write (relative to workspace root)")
    content: str = Field(description="Content to write to the file")
    append: bool = Field(default=False, description="Append to file if True, overwrite if False")


class ListDirectoryInput(BaseModel):
    """Input for listing directory contents."""
    directory_path: str = Field(default=".", description="Path to the directory to list")
    recursive: bool = Field(default=False, description="List recursively if True")
    file_types: Optional[list[str]] = Field(default=None, description="Filter by file extensions (e.g., ['py', 'md'])")


class CreateDirectoryInput(BaseModel):
    """Input for creating a directory."""
    directory_path: str = Field(description="Path to the directory to create")


class SearchFilesInput(BaseModel):
    """Input for searching files."""
    pattern: str = Field(description="Search pattern (filename or content)")
    directory: str = Field(default=".", description="Directory to search in")
    search_content: bool = Field(default=False, description="Search in file contents if True, filenames if False")


def read_file_tool(workspace_root: str = ".") -> Tool:
    """Tool for reading files from the workspace."""
    async def read_file(input: ReadFileInput) -> str:
        file_path = Path(workspace_root) / input.file_path
        if not file_path.exists():
            return f"Error: File {input.file_path} does not exist"
        if not file_path.is_file():
            return f"Error: {input.file_path} is not a file"
        try:
            content = file_path.read_text(encoding="utf-8")
            return f"File: {input.file_path}\n\n{content}"
        except UnicodeDecodeError:
            return f"Error: File {input.file_path} is not a text file (binary file)"
        except Exception as e:
            return f"Error reading file: {str(e)}"
    
    return Tool(
        name="read_file",
        description="Read the contents of a file from the workspace. Returns the file content as text.",
        input_type=ReadFileInput,
        func=read_file,
    )


def write_file_tool(workspace_root: str = ".") -> Tool:
    """Tool for writing files to the workspace."""
    async def write_file(input: WriteFileInput) -> str:
        file_path = Path(workspace_root) / input.file_path
        try:
            # Create parent directories if they don't exist
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            if input.append:
                with file_path.open("a", encoding="utf-8") as f:
                    f.write(input.content)
                return f"✅ Appended content to {input.file_path}"
            else:
                file_path.write_text(input.content, encoding="utf-8")
                return f"✅ Written content to {input.file_path}"
        except Exception as e:
            return f"❌ Error writing file: {str(e)}"
    
    return Tool(
        name="write_file",
        description="Write content to a file in the workspace. Can append or overwrite. Creates parent directories if needed.",
        input_type=WriteFileInput,
        func=write_file,
    )


def list_directory_tool(workspace_root: str = ".") -> Tool:
    """Tool for listing directory contents."""
    async def list_directory(input: ListDirectoryInput) -> str:
        dir_path = Path(workspace_root) / input.directory_path
        if not dir_path.exists():
            return f"Error: Directory {input.directory_path} does not exist"
        if not dir_path.is_dir():
            return f"Error: {input.directory_path} is not a directory"
        
        try:
            if input.recursive:
                files = []
                for item in dir_path.rglob("*"):
                    rel_path = str(item.relative_to(Path(workspace_root)))
                    if item.is_file():
                        if input.file_types:
                            if item.suffix.lstrip('.') in input.file_types:
                                files.append(f"📄 {rel_path}")
                        else:
                            files.append(f"📄 {rel_path}")
                    elif item.is_dir():
                        files.append(f"📁 {rel_path}/")
                return "\n".join(sorted(files)) if files else "No files found"
            else:
                items = []
                for item in sorted(dir_path.iterdir()):
                    if item.is_file():
                        if input.file_types:
                            if item.suffix.lstrip('.') in input.file_types:
                                items.append(f"📄 {item.name}")
                        else:
                            items.append(f"📄 {item.name}")
                    elif item.is_dir():
                        items.append(f"📁 {item.name}/")
                return "\n".join(items) if items else "Directory is empty"
        except Exception as e:
            return f"Error listing directory: {str(e)}"
    
    return Tool(
        name="list_directory",
        description="List contents of a directory. Can list recursively and filter by file types.",
        input_type=ListDirectoryInput,
        func=list_directory,
    )


def create_directory_tool(workspace_root: str = ".") -> Tool:
    """Tool for creating directories."""
    async def create_directory(input: CreateDirectoryInput) -> str:
        dir_path = Path(workspace_root) / input.directory_path
        try:
            dir_path.mkdir(parents=True, exist_ok=True)
            return f"✅ Created directory: {input.directory_path}"
        except Exception as e:
            return f"❌ Error creating directory: {str(e)}"
    
    return Tool(
        name="create_directory",
        description="Create a directory in the workspace. Creates parent directories if needed.",
        input_type=CreateDirectoryInput,
        func=create_directory,
    )


def search_files_tool(workspace_root: str = ".") -> Tool:
    """Tool for searching files by name or content."""
    async def search_files(input: SearchFilesInput) -> str:
        search_path = Path(workspace_root) / input.directory
        if not search_path.exists():
            return f"Error: Directory {input.directory} does not exist"
        
        results = []
        try:
            if input.search_content:
                # Search in file contents
                for file_path in search_path.rglob("*"):
                    if file_path.is_file():
                        try:
                            content = file_path.read_text(encoding="utf-8")
                            if input.pattern.lower() in content.lower():
                                rel_path = str(file_path.relative_to(Path(workspace_root)))
                                results.append(f"📄 {rel_path} (contains '{input.pattern}')")
                        except (UnicodeDecodeError, Exception):
                            continue
            else:
                # Search in filenames
                for file_path in search_path.rglob(f"*{input.pattern}*"):
                    if file_path.is_file():
                        rel_path = str(file_path.relative_to(Path(workspace_root)))
                        results.append(f"📄 {rel_path}")
            
            if results:
                return f"Found {len(results)} file(s):\n" + "\n".join(results[:50])  # Limit to 50 results
            else:
                return f"No files found matching '{input.pattern}'"
        except Exception as e:
            return f"Error searching files: {str(e)}"
    
    return Tool(
        name="search_files",
        description="Search for files by name or content. Can search recursively in directory tree.",
        input_type=SearchFilesInput,
        func=search_files,
    )


# ============================================================================
# Git Eszközök (Proaktív Projektkezelés)
# ============================================================================

import subprocess
from typing import Optional

class GitStatusInput(BaseModel):
    """Input for checking git status."""
    repo_path: str = Field(default=".", description="Path to the git repository")


class GitCommitInput(BaseModel):
    """Input for creating a git commit."""
    repo_path: str = Field(default=".", description="Path to the git repository")
    message: str = Field(description="Commit message")
    files: Optional[list[str]] = Field(default=None, description="Specific files to commit (None = all staged files)")


def git_status_tool() -> Tool:
    """Tool for checking git status."""
    async def git_status(input: GitStatusInput) -> str:
        repo_path = Path(input.repo_path)
        try:
            result = subprocess.run(
                ["git", "status", "--short"],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                output = result.stdout.strip()
                return output if output else "✅ Working tree clean - no changes"
            return f"Error: {result.stderr}"
        except FileNotFoundError:
            return "Error: Git is not installed or not in PATH"
        except Exception as e:
            return f"Error checking git status: {str(e)}"
    
    return Tool(
        name="git_status",
        description="Check git status of the repository. Shows modified, staged, and untracked files.",
        input_type=GitStatusInput,
        func=git_status,
    )


def git_commit_tool() -> Tool:
    """Tool for creating git commits."""
    async def git_commit(input: GitCommitInput) -> str:
        repo_path = Path(input.repo_path)
        try:
            # Stage files if specified
            if input.files:
                for file in input.files:
                    subprocess.run(
                        ["git", "add", file],
                        cwd=repo_path,
                        capture_output=True,
                        timeout=10
                    )
            else:
                # Stage all changes
                subprocess.run(
                    ["git", "add", "-A"],
                    cwd=repo_path,
                    capture_output=True,
                    timeout=10
                )
            
            # Create commit
            result = subprocess.run(
                ["git", "commit", "-m", input.message],
                cwd=repo_path,
                capture_output=True,
                text=True,
                timeout=10
            )
            
            if result.returncode == 0:
                return f"✅ Committed: {input.message}"
            else:
                return f"Error: {result.stderr}"
        except FileNotFoundError:
            return "Error: Git is not installed or not in PATH"
        except Exception as e:
            return f"Error creating commit: {str(e)}"
    
    return Tool(
        name="git_commit",
        description="Create a git commit with the specified message. Can commit specific files or all staged changes.",
        input_type=GitCommitInput,
        func=git_commit,
    )


# ============================================================================
# Összes Eszköz Exportálása
# ============================================================================

def get_all_tools(workspace_root: str = ".") -> list[Tool]:
    """Get all tools for the coding assistant."""
    return [
        read_file_tool(workspace_root),
        write_file_tool(workspace_root),
        list_directory_tool(workspace_root),
        create_directory_tool(workspace_root),
        search_files_tool(workspace_root),
        git_status_tool(),
        git_commit_tool(),
    ]


