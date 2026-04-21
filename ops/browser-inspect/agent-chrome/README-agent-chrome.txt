Agent - Personal Gmail Chrome

This is an isolated Chrome instance for agent use.

Usage:
1. From the repo root, run `browser-inspect/agent-chrome/setup-agent-chrome.bat` once (or run `setup-agent-chrome.bat` directly from this folder).
2. It creates the separate Chrome profile folder and the desktop shortcut.
3. Then start `browser-inspect/agent-chrome/launch-agent-chrome.bat` (or `launch-agent-chrome.bat` from this folder) or the desktop shortcut.

Isolation:
- user-data-dir: C:\ChromeProfiles\AgentPersonal
- profile-directory: Agent - Personal Gmail
- desktop shortcut: Agent - Personal Gmail Chrome

First sign-in:
- In the separate Chrome window, sign in first with peterpohankapersonal@gmail.com.
- Do not add another Google account on the first pass.

Important:
- This does not modify your main Chrome profile.
- If Chrome is not installed in a typical location, the scripts will show a clear error.
- Manual sign-in on the first launch is expected and intentional.
