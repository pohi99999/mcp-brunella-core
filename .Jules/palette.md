## 2026-02-06 - Non-semantic Interactive Elements
**Learning:** Found interactive "buttons" implemented as `div`s with `onClick`, lacking keyboard support and ARIA roles.
**Action:** Refactor to use semantic `<Button>` components to ensure native accessibility (focus, enter/space activation).

## 2026-02-07 - Accessible Icon-Only Sidebars
**Learning:** Collapsed sidebars often hide text labels using `display: none` (e.g., `hidden lg:inline`), which removes them from the accessibility tree, leaving buttons unlabeled for screen readers on mobile devices.
**Action:** Always ensure conditionally icon-only buttons have an explicit `aria-label` to provide an accessible name when the visual label is hidden.
