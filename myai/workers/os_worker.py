import pyautogui
import mss
import mss.tools
import pygetwindow as gw
import os
import time
from typing import Optional, Tuple

# Fail-safe: move mouse to corner to abort
pyautogui.FAILSAFE = True

class OSWorker:
    def __init__(self):
        self.screenshot_dir = os.path.join(os.getcwd(), 'data', 'screenshots')
        os.makedirs(self.screenshot_dir, exist_ok=True)

    async def take_screenshot(self, filename: str = 'screen.png') -> str:
        """Captures the full screen and returns the file path."""
        with mss.mss() as sct:
            output = os.path.join(self.screenshot_dir, filename)
            sct.shot(output=output)
            return output

    async def click(self, x: int, y: int, clicks: int = 1, button: str = 'left'):
        """Performs a mouse click at specified coordinates."""
        pyautogui.click(x=x, y=y, clicks=clicks, button=button)
        return {"status": "success", "action": "click", "x": x, "y": y}

    async def type_text(self, text: str, interval: float = 0.05):
        """Types text using the keyboard."""
        pyautogui.write(text, interval=interval)
        return {"status": "success", "action": "type", "text_length": len(text)}

    async def press_key(self, key: str):
        """Presses a specific key (e.g., 'enter', 'esc')."""
        pyautogui.press(key)
        return {"status": "success", "action": "press", "key": key}

    async def find_window(self, title: str):
        """Finds a window by its title."""
        try:
            windows = gw.getWindowsWithTitle(title)
            if windows:
                win = windows[0]
                return {
                    "status": "success", 
                    "title": win.title,
                    "box": {
                        "left": win.left,
                        "top": win.top,
                        "width": win.width,
                        "height": win.height
                    }
                }
            return {"status": "error", "message": "Window not found"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

os_worker = OSWorker()
