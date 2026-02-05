## 2024-05-22 - [Refactoring Active Filter Badges for Accessibility]
**Learning:** Using simple SVGs with `onClick` inside a Badge component is not accessible as it lacks keyboard support and semantic meaning.
**Action:** Wrap the removal icon in a semantic `<button type="button">` element with appropriate `aria-label` and focus styles (e.g., `focus:ring`) to ensure keyboard navigability and screen reader support.
