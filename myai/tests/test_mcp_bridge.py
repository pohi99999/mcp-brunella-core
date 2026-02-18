"""
Tests for MCPBridge - Python MCP filesystem wrapper

Run: pytest myai/tests/test_mcp_bridge.py -v
"""

import pytest
import asyncio
import os
from pathlib import Path
from myai.tools.mcp_bridge import MCPBridge


@pytest.fixture
async def bridge():
    """Create and connect MCPBridge instance"""
    bridge = MCPBridge()
    connected = await bridge.connect()

    if not connected:
        pytest.skip("MCP server not available (build/index.js missing)")

    yield bridge

    await bridge.disconnect()


@pytest.fixture
def test_data_dir():
    """Create test data directory"""
    test_dir = Path("data/test_mcp_bridge")
    test_dir.mkdir(parents=True, exist_ok=True)
    yield test_dir

    # Cleanup
    import shutil
    if test_dir.exists():
        shutil.rmtree(test_dir)


class TestMCPBridge:
    """Test suite for MCPBridge"""

    @pytest.mark.asyncio
    async def test_connection(self):
        """Test bridge connection and disconnection"""
        bridge = MCPBridge()

        # Connect
        result = await bridge.connect()
        assert result is True
        assert bridge.connected is True

        # Disconnect
        await bridge.disconnect()
        assert bridge.connected is False

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test async context manager"""
        async with MCPBridge() as bridge:
            assert bridge.connected is True

        assert bridge.connected is False

    @pytest.mark.asyncio
    async def test_read_file(self, bridge):
        """Test reading a file"""
        # Read README.md (should exist)
        result = await bridge.read_file("README.md")

        assert result["success"] is True
        assert "content" in result
        assert result["size"] > 0
        assert len(result["content"]) > 0
        assert "modified" in result

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self, bridge):
        """Test reading non-existent file"""
        result = await bridge.read_file("this_file_does_not_exist_12345.txt")

        assert result["success"] is False
        assert "error" in result
        assert "not found" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_read_outside_safezone(self, bridge):
        """Test reading file outside Safe Zone"""
        # Try to read /etc/passwd or C:\Windows\System32\drivers\etc\hosts
        if os.name == "posix":
            result = await bridge.read_file("/etc/passwd")
        else:
            result = await bridge.read_file("C:\\Windows\\System32\\drivers\\etc\\hosts")

        assert result["success"] is False
        assert "error" in result
        assert "denied" in result["error"].lower() or "access" in result["error"].lower()

    @pytest.mark.asyncio
    async def test_write_file(self, bridge, test_data_dir):
        """Test writing a file"""
        test_file = test_data_dir / "test_write.txt"
        content = "Hello from MCPBridge test!\nLine 2"

        result = await bridge.write_file(str(test_file), content, create_dirs=True)

        assert result["success"] is True
        assert result["bytes_written"] == len(content.encode())
        assert test_file.exists()

        # Verify content
        with open(test_file, "r") as f:
            assert f.read() == content

    @pytest.mark.asyncio
    async def test_write_file_create_dirs(self, bridge, test_data_dir):
        """Test writing file with directory creation"""
        nested_file = test_data_dir / "nested" / "deep" / "file.txt"
        content = "Nested file content"

        result = await bridge.write_file(str(nested_file), content, create_dirs=True)

        assert result["success"] is True
        assert nested_file.exists()

    @pytest.mark.asyncio
    async def test_list_directory(self, bridge, test_data_dir):
        """Test listing directory contents"""
        # Create some test files
        (test_data_dir / "file1.txt").write_text("test1")
        (test_data_dir / "file2.json").write_text('{"test": true}')
        (test_data_dir / "subdir").mkdir()

        result = await bridge.list_directory(str(test_data_dir))

        assert result["success"] is True
        assert result["count"] >= 3
        assert len(result["items"]) >= 3

        # Check for expected items
        item_names = [item["name"] for item in result["items"]]
        assert "file1.txt" in item_names
        assert "file2.json" in item_names
        assert "subdir" in item_names

        # Check item metadata
        file1_item = next(item for item in result["items"] if item["name"] == "file1.txt")
        assert file1_item["type"] == "file"
        assert file1_item["size"] > 0
        assert "modified" in file1_item

    @pytest.mark.asyncio
    async def test_list_directory_nonexistent(self, bridge):
        """Test listing non-existent directory"""
        result = await bridge.list_directory("this_directory_does_not_exist_12345/")

        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio
    async def test_search_files(self, bridge, test_data_dir):
        """Test searching files by pattern"""
        # Create test files
        (test_data_dir / "test1.py").write_text("# Python file 1")
        (test_data_dir / "test2.py").write_text("# Python file 2")
        (test_data_dir / "data.json").write_text('{"test": true}')
        subdir = test_data_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested.py").write_text("# Nested Python file")

        # Search for Python files
        result = await bridge.search_files("*.py", str(test_data_dir))

        assert result["success"] is True
        assert result["count"] >= 2
        assert len(result["matches"]) >= 2

        # Check matches
        match_names = [Path(m).name for m in result["matches"]]
        assert "test1.py" in match_names
        assert "test2.py" in match_names

    @pytest.mark.asyncio
    async def test_search_files_recursive(self, bridge, test_data_dir):
        """Test recursive file search with **"""
        # Create nested structure
        (test_data_dir / "root.txt").write_text("root")
        subdir = test_data_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested.txt").write_text("nested")

        # Search recursively
        result = await bridge.search_files("**/*.txt", str(test_data_dir))

        assert result["success"] is True
        assert result["count"] >= 2

        # Should find both root and nested files
        match_paths = result["matches"]
        assert any("root.txt" in m for m in match_paths)
        assert any("nested.txt" in m for m in match_paths)

    @pytest.mark.asyncio
    async def test_search_files_no_matches(self, bridge, test_data_dir):
        """Test search with no matching files"""
        result = await bridge.search_files("*.xyz", str(test_data_dir))

        assert result["success"] is True
        assert result["count"] == 0
        assert result["matches"] == []

    @pytest.mark.asyncio
    async def test_convenience_functions(self, test_data_dir):
        """Test convenience wrapper functions"""
        from myai.tools.mcp_bridge import read_file, write_file, list_directory

        # Write file
        test_file = test_data_dir / "convenience_test.txt"
        write_result = await write_file(str(test_file), "Test content", create_dirs=True)
        assert write_result["success"] is True

        # Read file
        read_result = await read_file(str(test_file))
        assert read_result["success"] is True
        assert read_result["content"] == "Test content"

        # List directory
        list_result = await list_directory(str(test_data_dir))
        assert list_result["success"] is True
        assert list_result["count"] > 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
