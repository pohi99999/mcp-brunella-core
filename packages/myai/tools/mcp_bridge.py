"""
MCP Bridge - Python wrapper for MCP filesystem operations

Purpose:
- Provide Python API for MCP filesystem tools
- Communicate with Node.js backend via HTTP API
- Safe Zone validation through MCP protocol
- Used by DataScientist agent for secure file operations

Usage:
```python
from myai.tools.mcp_bridge import MCPBridge

bridge = MCPBridge()
await bridge.connect()  # Check backend availability

# Read file
result = await bridge.read_file("data/test.txt")
if result["success"]:
    print(result["content"])

# Write file
result = await bridge.write_file("data/output.json", '{"test": true}')

# List directory
result = await bridge.list_directory("data/")

# Search files
result = await bridge.search_files("**/*.py", "src/")

await bridge.disconnect()  # Cleanup (optional)
```
"""

import asyncio
import json
import os
from typing import Optional, Dict, Any
from pathlib import Path

try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False
    import urllib.request
    import urllib.parse


class MCPBridge:
    """Python bridge to Node.js MCP backend via HTTP API"""

    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize MCP Bridge

        Args:
            base_url: Backend API base URL (default: http://localhost:3000)
        """
        self.base_url = base_url or os.getenv("BRUNELLA_API_URL", "http://localhost:3000")
        self.api_base = f"{self.base_url}/api/v1/mcp"
        self.connected = False
        self.session: Optional[aiohttp.ClientSession] = None if HAS_AIOHTTP else None

    async def connect(self) -> bool:
        """
        Check backend availability

        Returns:
            True if backend is reachable, False otherwise
        """
        if self.connected:
            return True

        try:
            if HAS_AIOHTTP:
                self.session = aiohttp.ClientSession()
                async with self.session.get(f"{self.base_url}/api/health", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    if resp.status == 200:
                        self.connected = True
                        return True
            else:
                # Fallback to urllib
                req = urllib.request.Request(f"{self.base_url}/api/health")
                with urllib.request.urlopen(req, timeout=5) as response:
                    if response.status == 200:
                        self.connected = True
                        return True

            return False

        except Exception as e:
            print(f"[MCPBridge] Connection failed: {e}")
            print(f"[MCPBridge] Make sure backend is running at {self.base_url}")
            self.connected = False
            return False

    async def disconnect(self):
        """Cleanup HTTP session"""
        if self.session and HAS_AIOHTTP:
            await self.session.close()
            self.session = None
        self.connected = False

    async def _call_tool(
        self, tool_name: str, args: Dict[str, Any], timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Call MCP tool via HTTP API

        Args:
            tool_name: Name of the MCP tool
            args: Tool arguments
            timeout: Request timeout in seconds

        Returns:
            Tool result dictionary
        """
        if not self.connected:
            # Auto-connect if not connected
            connected = await self.connect()
            if not connected:
                return {
                    "success": False,
                    "error": f"Backend not reachable at {self.base_url}"
                }

        try:
            url = f"{self.api_base}/tools/{tool_name}"
            payload = {"args": args}

            if HAS_AIOHTTP and self.session:
                async with self.session.post(
                    url,
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=timeout)
                ) as resp:
                    if resp.status != 200:
                        error_text = await resp.text()
                        return {"success": False, "error": f"HTTP {resp.status}: {error_text}"}

                    return await resp.json()
            else:
                # Fallback to urllib
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode(),
                    headers={"Content-Type": "application/json"}
                )
                with urllib.request.urlopen(req, timeout=timeout) as response:
                    return json.loads(response.read().decode())

        except asyncio.TimeoutError:
            return {"success": False, "error": f"Timeout after {timeout}s"}
        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Invalid JSON response: {e}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def read_file(self, path: str) -> Dict[str, Any]:
        """
        Read file content via MCP

        Args:
            path: File path (must be within Safe Zone)

        Returns:
            {
                "success": bool,
                "content": str,
                "path": str,
                "size": int,
                "modified": str,
                "error": str  # if success=False
            }
        """
        return await self._call_tool("read_file", {"path": path})

    async def write_file(
        self, path: str, content: str, create_dirs: bool = False
    ) -> Dict[str, Any]:
        """
        Write file content via MCP

        Args:
            path: File path (must be within Safe Zone)
            content: File content to write
            create_dirs: Create parent directories if they don't exist

        Returns:
            {
                "success": bool,
                "path": str,
                "bytes_written": int,
                "error": str  # if success=False
            }
        """
        return await self._call_tool(
            "write_file", {"path": path, "content": content, "create_dirs": create_dirs}
        )

    async def list_directory(
        self, path: str, include_hidden: bool = False
    ) -> Dict[str, Any]:
        """
        List directory contents via MCP

        Args:
            path: Directory path (must be within Safe Zone)
            include_hidden: Include hidden files (starting with .)

        Returns:
            {
                "success": bool,
                "path": str,
                "items": [
                    {
                        "name": str,
                        "type": "file" | "directory",
                        "size": int,
                        "modified": str
                    }
                ],
                "count": int,
                "error": str  # if success=False
            }
        """
        return await self._call_tool(
            "list_directory", {"path": path, "include_hidden": include_hidden}
        )

    async def search_files(self, pattern: str, directory: str = ".") -> Dict[str, Any]:
        """
        Search files by glob pattern via MCP

        Args:
            pattern: Glob pattern (e.g., "**/*.py", "*.json")
            directory: Search root directory (default: current)

        Returns:
            {
                "success": bool,
                "pattern": str,
                "directory": str,
                "matches": [str],  # List of matching file paths
                "count": int,
                "error": str  # if success=False
            }
        """
        return await self._call_tool(
            "search_files", {"pattern": pattern, "directory": directory}
        )

    # Context manager support
    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()


# Convenience functions for quick usage
async def read_file(path: str) -> Dict[str, Any]:
    """Quick read file (creates temporary bridge)"""
    async with MCPBridge() as bridge:
        return await bridge.read_file(path)


async def write_file(path: str, content: str, create_dirs: bool = False) -> Dict[str, Any]:
    """Quick write file (creates temporary bridge)"""
    async with MCPBridge() as bridge:
        return await bridge.write_file(path, content, create_dirs)


async def list_directory(path: str, include_hidden: bool = False) -> Dict[str, Any]:
    """Quick list directory (creates temporary bridge)"""
    async with MCPBridge() as bridge:
        return await bridge.list_directory(path, include_hidden)


async def search_files(pattern: str, directory: str = ".") -> Dict[str, Any]:
    """Quick search files (creates temporary bridge)"""
    async with MCPBridge() as bridge:
        return await bridge.search_files(pattern, directory)


# Example usage
if __name__ == "__main__":
    async def main():
        print("[MCPBridge] Testing Python MCP Bridge...")
        print("[MCPBridge] Make sure backend is running: npm run dev")
        print()

        async with MCPBridge() as bridge:
            # Test read_file
            print("1. Reading file...")
            result = await bridge.read_file("README.md")
            if result.get("success"):
                print(f"   ✅ Read {result.get('size', 0)} bytes")
                content = result.get("content", "")
                print(f"   Preview: {content[:80]}...")
            else:
                print(f"   ❌ Error: {result.get('error')}")

            # Test list_directory
            print("\n2. Listing directory...")
            result = await bridge.list_directory("data/")
            if result.get("success"):
                print(f"   ✅ Found {result.get('count', 0)} items")
                for item in result.get("items", [])[:5]:
                    print(f"   - {item.get('name')} ({item.get('type')})")
            else:
                print(f"   ❌ Error: {result.get('error')}")

            # Test search_files
            print("\n3. Searching files...")
            result = await bridge.search_files("*.json", "data/")
            if result.get("success"):
                print(f"   ✅ Found {result.get('count', 0)} JSON files")
                for match in result.get("matches", [])[:5]:
                    print(f"   - {match}")
            else:
                print(f"   ❌ Error: {result.get('error')}")

            # Test write_file
            print("\n4. Writing file...")
            result = await bridge.write_file(
                "data/mcp_bridge_test.txt",
                "Hello from Python MCPBridge!\nHTTP API mode\nTimestamp: 2026-02-18",
                create_dirs=True
            )
            if result.get("success"):
                print(f"   ✅ Wrote {result.get('bytes_written', 0)} bytes")
            else:
                print(f"   ❌ Error: {result.get('error')}")

        print("\n[MCPBridge] Testing complete!")

    asyncio.run(main())
