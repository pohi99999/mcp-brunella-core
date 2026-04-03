# Palette's Journal - Critical Learnings

## 2025-02-23 - Initial Setup
**Learning:** UX consistency and accessibility are key.
**Action:** Starting the journal to track critical UX/a11y learnings.

## 2025-02-27 - Icon Button Accessibility
**Learning:** Icon-only buttons often rely on native `title` attributes which are inaccessible to keyboard users and screen readers.
**Action:** Replace `title` with semantic `<Tooltip>` components and explicit `aria-label` attributes for all icon-only interactions.

## 2025-04-03 - Refresh Button Accessibility in RobotkezPanel
**Learning:** Manual refresh buttons using icons (like `RefreshCw`) require explicit `title` and `aria-label` properties, as well as distinct `focus-visible` states to be keyboard accessible.
**Action:** Added `aria-label`, `title`, and `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring` to the refresh button in `RobotkezPanel.tsx`. Also fixed the missing `Zap` import.
