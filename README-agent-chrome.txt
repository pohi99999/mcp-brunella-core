Agent - Personal Gmail Chrome

This is an isolated Chrome instance for agent use.

Usage:
1. Run setup-agent-chrome.bat once.
2. It creates the separate Chrome profile folder and the desktop shortcut.
3. Then start launch-agent-chrome.bat or the desktop shortcut.

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
