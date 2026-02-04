## 2026-02-04 - Button Loading State Pattern
**Learning:** Adding a built-in `isLoading` state to the Shadcn UI Button component significantly simplifies form handling (removing manual disabled logic and text swapping) but must exclude the loader when `asChild` is true to avoid React children errors with Radix Slot.
**Action:** When enhancing Shadcn components, always check for `asChild` prop compatibility.
