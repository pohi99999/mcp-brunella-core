import pytest
from unittest.mock import patch, MagicMock

# Attempt to import NativeComputerUse, but handle if it fails due to missing display/pyautogui
try:
    from myai.robotkez.computer_use import NativeComputerUse
except Exception:
    NativeComputerUse = None

@pytest.fixture
def mock_pyautogui():
    with patch('myai.robotkez.computer_use.pyautogui') as mock:
        yield mock

def test_click(mock_pyautogui):
    if NativeComputerUse is None:
        pytest.skip("NativeComputerUse not available")
        
    cu = NativeComputerUse()
    # Mock the internal import method to return the patched pyautogui
    cu._ensure_pyautogui = MagicMock(return_value=mock_pyautogui)
    
    result = cu.click(100, 200)
    mock_pyautogui.click.assert_called_once_with(x=100, y=200)
    assert result == {"status": "success", "action": "click", "x": 100, "y": 200}

def test_type_text(mock_pyautogui):
    if NativeComputerUse is None:
        pytest.skip("NativeComputerUse not available")
        
    cu = NativeComputerUse()
    cu._ensure_pyautogui = MagicMock(return_value=mock_pyautogui)
    
    result = cu.type_text("Hello", press_enter=True)
    mock_pyautogui.write.assert_called_once_with("Hello", interval=0.05)
    mock_pyautogui.press.assert_called_once_with('enter')
    assert result == {"status": "success", "action": "type_text", "text": "Hello"}
