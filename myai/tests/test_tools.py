import os
import pytest
from myai.core.tools import list_files, read_file, write_file, summarize_project
from unittest.mock import patch, MagicMock

def test_file_operations(tmp_path):
    test_file = tmp_path / "test.txt"
    content = "Hello World"
    write_file(str(test_file), content)
    assert os.path.exists(test_file)
    assert read_file(str(test_file)) == content

def test_list_files(tmp_path):
    # Create a small dummy project structure
    (tmp_path / "src").mkdir()
    (tmp_path / "src" / "main.py").write_text("print(1)")
    (tmp_path / ".git").mkdir()
    (tmp_path / ".git" / "config").write_text("git config")
    
    files = list_files(str(tmp_path))
    # Should find main.py but ignore .git folder
    assert any("main.py" in f for f in files)
    assert not any(".git" in f for f in files)

@patch("myai.core.tools.simple_completion")
def test_summarize_project(mock_completion, tmp_path):
    mock_completion.return_value = "Project summary."
    (tmp_path / "README.md").write_text("# Test Project")
    
    summary = summarize_project(root=str(tmp_path))
    assert summary == "Project summary."
    mock_completion.assert_called_once()
