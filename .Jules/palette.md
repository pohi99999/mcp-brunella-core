## 2026-01-31 - Icon-Only Buttons Need Labels
**Learning:** The application uses several icon-only buttons (like Send, Clear) without `aria-label` attributes. This makes them inaccessible to screen reader users who only hear "button" or the icon name.
**Action:** Always add `aria-label` or `aria-labelledby` to buttons that rely solely on iconography for meaning.
