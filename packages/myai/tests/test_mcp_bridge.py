"""
Tests for MCPBridge - Python MCP filesystem wrapper

Run: pytest myai/tests/test_mcp_bridge.py -v
"""

import pytest
import os
from pathlib import Path
from myai.tools.mcp_bridge import MCPBridge


async def make_bridge() -> MCPBridge:
    bridge = MCPBridge()
    connected = await bridge.connect()
    if not connected:
        pytest.skip("MCP server not available (backend not running)")
    return bridge


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
        if not result:
            pytest.skip("MCP server not available (backend not running)")
        assert result is True
        assert bridge.connected is True

        # Disconnect
        await bridge.disconnect()
        assert bridge.connected is False

    @pytest.mark.asyncio
    async def test_context_manager(self):
        """Test async context manager"""
        probe = MCPBridge()
        if not await probe.connect():
            pytest.skip("MCP server not available (backend not running)")
        await probe.disconnect()

        async with MCPBridge() as bridge:
            assert bridge.connected is True

        assert bridge.connected is False

    @pytest.mark.asyncio
    async def test_read_file(self):
        """Test reading a file"""
        bridge = await make_bridge()
        try:
            safe_file = Path("data/test_mcp_bridge/read_test.txt")
            safe_file.parent.mkdir(parents=True, exist_ok=True)
            safe_file.write_text("Bridge read ok", encoding="utf-8")

            result = await bridge.read_file(str(safe_file))

            assert result["success"] is True
            assert "content" in result
            assert result["size"] > 0
            assert result["content"] == "Bridge read ok"
            assert "modified" in result
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_read_nonexistent_file(self):
        """Test reading non-existent file"""
        bridge = await make_bridge()
        try:
            result = await bridge.read_file("data/test_mcp_bridge/this_file_does_not_exist_12345.txt")

            assert result["success"] is False
            assert "error" in result
            assert "not found" in result["error"].lower()
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_read_outside_safezone(self):
        """Test reading file outside Safe Zone"""
        bridge = await make_bridge()
        # Try to read /etc/passwd or C:\Windows\System32\drivers\etc\hosts
        try:
            if os.name == "posix":
                result = await bridge.read_file("/etc/passwd")
            else:
                result = await bridge.read_file("C:\\Windows\\System32\\drivers\\etc\\hosts")

            assert result["success"] is False
            assert "error" in result
            assert "denied" in result["error"].lower() or "access" in result["error"].lower()
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_write_file(self, test_data_dir):
        """Test writing a file"""
        bridge = await make_bridge()
        test_file = test_data_dir / "test_write.txt"
        content = "Hello from MCPBridge test!\nLine 2"
        try:
            result = await bridge.write_file(str(test_file), content, create_dirs=True)

            assert result["success"] is True
            assert result["bytes_written"] == len(content.encode())
            assert test_file.exists()

            with open(test_file, "r") as f:
                assert f.read() == content
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_write_file_create_dirs(self, test_data_dir):
        """Test writing file with directory creation"""
        bridge = await make_bridge()
        nested_file = test_data_dir / "nested" / "deep" / "file.txt"
        content = "Nested file content"
        try:
            result = await bridge.write_file(str(nested_file), content, create_dirs=True)

            assert result["success"] is True
            assert nested_file.exists()
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_list_directory(self, test_data_dir):
        """Test listing directory contents"""
        bridge = await make_bridge()
        # Create some test files
        (test_data_dir / "file1.txt").write_text("test1")
        (test_data_dir / "file2.json").write_text('{"test": true}')
        (test_data_dir / "subdir").mkdir()
        try:
            result = await bridge.list_directory(str(test_data_dir))

            assert result["success"] is True
            assert result["count"] >= 3
            assert len(result["items"]) >= 3

            item_names = [item["name"] for item in result["items"]]
            assert "file1.txt" in item_names
            assert "file2.json" in item_names
            assert "subdir" in item_names

            file1_item = next(item for item in result["items"] if item["name"] == "file1.txt")
            assert file1_item["type"] == "file"
            assert file1_item["size"] > 0
            assert "modified" in file1_item
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_list_directory_nonexistent(self):
        """Test listing non-existent directory"""
        bridge = await make_bridge()
        try:
            result = await bridge.list_directory("this_directory_does_not_exist_12345/")

            assert result["success"] is False
            assert "error" in result
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_search_files(self, test_data_dir):
        """Test searching files by pattern"""
        bridge = await make_bridge()
        # Create test files
        (test_data_dir / "test1.py").write_text("# Python file 1")
        (test_data_dir / "test2.py").write_text("# Python file 2")
        (test_data_dir / "data.json").write_text('{"test": true}')
        subdir = test_data_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested.py").write_text("# Nested Python file")

        # Search for Python files
        try:
            result = await bridge.search_files("*.py", str(test_data_dir))

            assert result["success"] is True
            assert result["count"] >= 2
            assert len(result["matches"]) >= 2

            match_names = [Path(m).name for m in result["matches"]]
            assert "test1.py" in match_names
            assert "test2.py" in match_names
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_search_files_recursive(self, test_data_dir):
        """Test recursive file search with **"""
        bridge = await make_bridge()
        # Create nested structure
        (test_data_dir / "root.txt").write_text("root")
        subdir = test_data_dir / "subdir"
        subdir.mkdir()
        (subdir / "nested.txt").write_text("nested")

        # Search recursively
        try:
            result = await bridge.search_files("**/*.txt", str(test_data_dir))

            assert result["success"] is True
            assert result["count"] >= 2

            match_paths = result["matches"]
            assert any("root.txt" in m for m in match_paths)
            assert any("nested.txt" in m for m in match_paths)
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_search_files_no_matches(self, test_data_dir):
        """Test search with no matching files"""
        bridge = await make_bridge()
        try:
            result = await bridge.search_files("*.xyz", str(test_data_dir))

            assert result["success"] is True
            assert result["count"] == 0
            assert result["matches"] == []
        finally:
            await bridge.disconnect()

    @pytest.mark.asyncio
    async def test_convenience_functions(self, test_data_dir):
        """Test convenience wrapper functions"""
        from myai.tools.mcp_bridge import read_file, write_file, list_directory

        probe = MCPBridge()
        if not await probe.connect():
            pytest.skip("MCP server not available (backend not running)")
        await probe.disconnect()

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
