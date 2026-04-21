import platform

pyautogui = None

class NativeComputerUse:
    def __init__(self):
        # Only import pyautogui if needed to avoid display errors in headless CI
        pass

    def _ensure_pyautogui(self):
        global pyautogui
        if pyautogui is not None:
            return pyautogui
        try:
            import pyautogui
            globals()['pyautogui'] = pyautogui
            return pyautogui
        except ImportError:
            raise RuntimeError("pyautogui is not installed. Run: pip install pyautogui")
        except Exception as e:
            raise RuntimeError(f"Error loading pyautogui (might be running headless without X server): {e}")

    def click(self, x: int, y: int):
        pyautogui = self._ensure_pyautogui()
        print(f"[ComputerUse] Clicking at ({x}, {y})")
        pyautogui.click(x=x, y=y)
        return {"status": "success", "action": "click", "x": x, "y": y}

    def type_text(self, text: str, press_enter: bool = False):
        pyautogui = self._ensure_pyautogui()
        print(f"[ComputerUse] Typing text: {text}")
        pyautogui.write(text, interval=0.05)
        if press_enter:
            pyautogui.press('enter')
        return {"status": "success", "action": "type_text", "text": text}

    def press_key(self, key: str):
        pyautogui = self._ensure_pyautogui()
        print(f"[ComputerUse] Pressing key: {key}")
        pyautogui.press(key)
        return {"status": "success", "action": "press_key", "key": key}

    def scroll(self, amount: int):
        pyautogui = self._ensure_pyautogui()
        print(f"[ComputerUse] Scrolling by {amount}")
        pyautogui.scroll(amount)
        return {"status": "success", "action": "scroll", "amount": amount}

computer_use = NativeComputerUse()
