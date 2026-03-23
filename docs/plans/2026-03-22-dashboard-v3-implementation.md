# BAS Dashboard v3 Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Perform a complete visual and functional refactor of the BAS Dashboard to achieve a high-resolution, ultra-minimalist "Integrated Shell" design with Masonry grid and Docked Terminal.

**Architecture:** The dashboard will be structured as a vertical stack consisting of a sticky 64px header, a flexible main content area using Masonry layout (Tailwind columns), and a fixed-height docked terminal footer (250-400px). This ensures layout stability and high visual fidelity.

**Tech Stack:** React, Tailwind CSS v4, Lucide React Icons, Geist/Inter Fonts.

---

### Task 1: CSS Foundations & Global Styles

**Files:**
- Modify: `src/dashboard/styles/theme.css`
- Modify: `tailwind.config.js`

**Step 1: Update theme variables for Zinc-950 and hairline borders**
```css
@layer base {
  :root {
    --color-bg-base: #020203;
    --color-bg-card: #09090b;
    --color-border-subtle: rgba(39, 39, 42, 0.5); /* zinc-800/50 */
    --color-text-muted: #71717a; /* zinc-500 */
  }
}
```

**Step 2: Ensure antialiasing is forced globally**
```css
@layer base {
  body {
    @apply antialiased text-zinc-300 bg-[#020203];
    font-feature-settings: "cv02", "cv03", "cv04", "ss01";
  }
}
```

**Step 3: Verify build**
Run: `npm run build`
Expected: Build SUCCESS

**Step 4: Commit**
```bash
git add src/dashboard/styles/theme.css tailwind.config.js
git commit -m "style: establish high-res CSS foundations and global zinc variables"
```

---

### Task 2: Sticky Header Refactor

**Files:**
- Modify: `src/dashboard/components/dashboard/MissionControlLayout.tsx`

**Step 1: Restructure header for 64px height and sharp borders**
Modify the `<header>` element to have `h-16 shrink-0 border-b border-zinc-800 bg-black/40 backdrop-blur-xl`.

**Step 2: Refactor Status Indicators**
Change core status circle to `w-1.5 h-1.5` with subtle outer glow and text to `text-[10px] font-bold tracking-widest uppercase`.

**Step 3: Verify in browser**
Run: `npm run dev:ui`
Expected: Header is 64px high, background has blur, borders are sharp zinc-800.

**Step 4: Commit**
```bash
git add src/dashboard/components/dashboard/MissionControlLayout.tsx
git commit -m "feat: refactor sticky header with high-res status indicators"
```

---

### Task 3: Docked Terminal Footer

**Files:**
- Modify: `src/dashboard/components/dashboard/MissionControlLayout.tsx`
- Modify: `src/dashboard/components/dashboard/TerminalLog.tsx`

**Step 1: Add Footer Container to Layout**
Insert a `<footer>` after the `<main>` tag in `MissionControlLayout.tsx`.
```tsx
<footer className="h-[250px] max-h-[400px] border-t border-zinc-800 bg-black/80 backdrop-blur-xl shrink-0 z-40 overflow-hidden">
  <TerminalLog className="h-full border-none rounded-none bg-transparent" />
</footer>
```

**Step 2: Update TerminalLog Tipography and Scrolling**
Use `font-mono text-[12px] leading-relaxed` and implement `useEffect` for auto-scroll.

**Step 3: Verify Terminal visibility**
Run: `npm run dev:ui`
Expected: Terminal is fixed at bottom, widget grid scrolls independently above it.

**Step 4: Commit**
```bash
git add src/dashboard/components/dashboard/MissionControlLayout.tsx src/dashboard/components/dashboard/TerminalLog.tsx
git commit -m "feat: implement docked terminal footer with auto-scroll and monospace typography"
```

---

### Task 4: Masonry Widget Grid

**Files:**
- Modify: `src/dashboard/components/dashboard/WidgetGrid.tsx`

**Step 1: Replace CSS Grid with Tailwind Columns**
Change the main div from `md:grid` to:
```tsx
<div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 p-2">
```

**Step 2: Remove aspect-ratio/fixed-height constraints from Card wrappers**
Ensure kártya containers use `break-inside-avoid` to prevent splitting across columns.

**Step 3: Verify Masonry behavior**
Run: `npm run dev:ui`
Expected: Widgets of varying heights stack vertically without stretching.

**Step 4: Commit**
```bash
git add src/dashboard/components/dashboard/WidgetGrid.tsx
git commit -m "feat: transition to masonry layout using tailwind columns"
```

---

### Task 5: Ultra-Minimalist Widget Styling

**Files:**
- Modify: `src/dashboard/components/dashboard/SystemHealthCard.tsx`
- Modify: `src/dashboard/components/dashboard/AgentStatusCard.tsx`

**Step 1: Apply Zinc-950 and sharp borders to widgets**
Update Card styles to: `bg-zinc-950/40 border-zinc-800/50 rounded-lg`.

**Step 2: Refine Widget Typography**
Update headers to `text-[11px] font-medium tracking-wider uppercase text-zinc-500`.

**Step 3: Verify visual fidelity**
Run: `npm run dev:ui`
Expected: Widgets look "High-Res" with sharp edges and clear hierarchy.

**Step 4: Commit**
```bash
git add src/dashboard/components/dashboard/SystemHealthCard.tsx src/dashboard/components/dashboard/AgentStatusCard.tsx
git commit -m "style: apply ultra-minimalist styling to core widgets"
```
