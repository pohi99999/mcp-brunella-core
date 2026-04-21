import pytest
from unittest.mock import patch, MagicMock
from myai.core.agent import planner_agent, coder_agent, executor_agent, reviewer_agent, multi_agent_dev_flow

@patch("myai.core.agent.simple_completion")
def test_planner_agent(mock_completion):
    mock_completion.return_value = "1. Step one"
    res = planner_agent("do something")
    assert "1. Step one" in res
    mock_completion.assert_called_once()

@patch("myai.core.agent.generate_code")
def test_coder_agent(mock_gen):
    mock_gen.return_value = "print(1)"
    res = coder_agent("write code")
    assert res == "print(1)"
    mock_gen.assert_called_once()

@patch("myai.core.agent.run_python_sandbox")
def test_executor_agent(mock_run):
    mock_run.return_value = (0, "output", "")
    res = executor_agent("print(1)")
    assert "Return code: 0" in res
    assert "output" in res
    mock_run.assert_called_once()

@patch("myai.core.agent.simple_completion")
def test_reviewer_agent(mock_completion):
    mock_completion.return_value = "Code looks good."
    res = reviewer_agent("task", "plan", "code", "result")
    assert "Code looks good." in res
    mock_completion.assert_called_once()

@patch("myai.core.agent.planner_agent")
@patch("myai.core.agent.coder_agent")
@patch("myai.core.agent.executor_agent")
@patch("myai.core.agent.reviewer_agent")
def test_multi_agent_dev_flow(mock_rev, mock_exec, mock_coder, mock_plan):
    mock_plan.return_value = "Plan"
    mock_coder.return_value = "Code"
    mock_exec.return_value = "Result"
    mock_rev.return_value = "Review"
    
    res = multi_agent_dev_flow("task")
    assert res["plan"] == "Plan"
    assert res["code"] == "Code"
    assert res["exec_result"] == "Result"
    assert res["review"] == "Review"
