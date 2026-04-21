import pytest
from unittest.mock import patch
from myai.core.project import analyze_project, refactor_project_highlevel

@patch("myai.core.project.summarize_project")
def test_analyze_project(mock_summarize):
    mock_summarize.return_value = "Summary"
    res = analyze_project()
    assert res == "Summary"
    mock_summarize.assert_called_once()

@patch("myai.core.project.refactor_project")
def test_refactor_project_highlevel(mock_refactor):
    mock_refactor.return_value = "Plan"
    res = refactor_project_highlevel("make it better")
    assert res == "Plan"
    mock_refactor.assert_called_once()
