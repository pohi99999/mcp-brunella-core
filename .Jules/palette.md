## 2025-02-23 - Initial Setup
**Learning:** UX consistency and accessibility are key.
**Action:** Starting the journal to track critical UX/a11y learnings.

## 2025-02-27 - Icon Button Accessibility
**Learning:** Icon-only buttons often rely on native `title` attributes which are inaccessible to keyboard users and screen readers.
**Action:** Replace `title` with semantic `<Tooltip>` components and explicit `aria-label` attributes for all icon-only interactions.

## 2025-03-01 - Refresh Button Loading States
**Learning:** Manual refresh icon buttons (like `RefreshCw`) can confuse users if they lack immediate visual feedback when clicked. Depending solely on a parent component's generic `loading` state may be too slow or ambiguous.
**Action:** Implement an isolated `isRefreshing` state to trigger an `animate-spin` on the icon and set `disabled={isRefreshing}` on the button to prevent duplicate requests and provide clear, instant visual feedback.