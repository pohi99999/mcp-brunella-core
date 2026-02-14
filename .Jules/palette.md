## 2026-02-06 - Non-semantic Interactive Elements
**Learning:** Found interactive "buttons" implemented as `div`s with `onClick`, lacking keyboard support and ARIA roles.
**Action:** Refactor to use semantic `<Button>` components to ensure native accessibility (focus, enter/space activation).

## 2026-02-06 - Missing ARIA Labels on Icon Buttons
**Learning:** Icon-only buttons (like "Edit" or "Remove") frequently lack `aria-label`, making them invisible to screen readers.
**Action:** Ensure every icon-only interactive element has a descriptive `aria-label`.
