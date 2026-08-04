# HAView — work queue

The running list of what's next. Ordered by benefit for a **display-first wall screen**
(~95% glance-only — legibility, data freshness and burn-in outrank interaction polish).

Sources: [`ux-review.md`](ux-review.md) (usability, ranked) and
[`look-and-feel-review.md`](look-and-feel-review.md) (visual). Both reviews were generated
2026-07-29; every item below was **re-verified against the code on 2026-08-04** and is still open.

Done work lives in `git log` — when an item ships, move it to **Shipped** at the bottom with its commit.

---

## Now — highest leverage

### 1. Distance legibility on the wall — ★★★★★, Low–Med
Base font is `clamp(16px, 0.8vw, 34px)`; many TVs report a ~1920px CSS viewport regardless of
physical size, so `0.8vw` clamps to the 16px laptop baseline. Nav labels / brand subtitle sit at
`0.6–0.68rem`. Per-card Text-size sliders fix widget *content*, not app chrome.
- [ ] Zero-code first: raise **Display scale** on the TV to ~140 and judge from the couch.
- [ ] Add a "viewing distance" preset in Settings (Wall TV → `uiScale` ~140) so a fresh install on a big screen isn't laptop-sized. `uiScale` already exists and clamps 70–200 (`src/lib/settings.ts:351`).
- [ ] Structural: stop keying sizing off `vw`, or gate off a stored "wall display" flag.
- [ ] Run nav/settings chrome sizes through the `--fs-*` token scale (they never got the type-scale pass).

Evidence: `src/styles/base.css:20`, `:99`, `:199`, `:207`, `:283`.

### 2. Surface stale / disconnected data — ★★★★★, Med
On a screen nobody touches, a silently frozen value is the worst failure — the dashboard looks
fine while showing yesterday's temperature.
- [ ] Make WS disconnect / auth loss obvious **at distance** (`StatusBanner` exists; check it reads from across the room).
- [ ] Per-widget staleness cue when an entity hasn't updated within an expected window (faint "· 3h ago", or dim the state).
- [ ] Verify reconnect recovers with no human pressing refresh.
- [ ] Even out per-widget **"unavailable"** treatment — camera tiles and the calendar do this well, entity/graph/media cards don't.

Evidence: `src/components/StatusBanner.tsx`, `src/lib/ha/connection.ts`.

### 3. OLED burn-in protection — ★★★★★, Med
A near-static screen running 24/7 for years is the worst case for image retention. The screensaver
exists but only fires in the **night** window (`screensaver`, `screensaverBrightness/Speed/Intensity`
in `src/lib/settings.ts:87–98`).
- [ ] Second, longer idle threshold so the screensaver also engages during the **day**.
- [ ] Slow whole-shell **pixel-shift**: nudge the app container a few px on a multi-minute cycle (`transform: translate()` — imperceptible, GPU-cheap, the standard TV pixel-orbiter trick).
- [ ] Optional: brief hourly fade toward black.

---

## Quick correctness wins (an hour or two together)

### 4. `--on-accent` token — ★★★★☆, Low
On-accent text hardcodes dark brown in **six** places; the custom accent picker removed the
"keep accents mid-lightness" guardrail, so a dark custom accent renders unreadable text.
- [ ] Add a semantic `--on-accent`; compute black/white by luminance (`L = .2126R+.7152G+.0722B → L>0.55 ? dark : #fff`).
- [ ] Replace every literal: `base.css:242` (`#211a0d`), `base.css:256`, `base.css:579`, `grid.module.css:66`, `grid.module.css:679`, `settings.module.css:557`. Warning comment at `theme.css:119`.

### 5. Global `prefers-reduced-motion` guard — ★★★☆☆, Low
Only the Aurora respects it today (`base.css:430` — scoped to `.page-aurora`). Add the standard
global rule; it's also a free low-cost mode for the weak Pi GPU.
- [ ] Global `*` animation/transition guard.
- [ ] Consider auto-selecting the low-intensity screensaver under reduced-motion.

### 6. Global `:focus-visible` ring — ★★☆☆☆, Low
Only camera tiles have one (`cameras.module.css:91`, `:248`). Barely matters for the 95% glance
use, but it's one rule and it makes the **setup flow** (typing URL/token) usable.
```css
:where(button, a, input, select, textarea, .nav-item):focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
```

### 7. Weather cloud glyph colour — ★★★☆☆, Low
`CLOUD = 'var(--text-dim)'` (`src/views/main/weather/weatherIcons.tsx:9`) — the same warm gray as
body labels, so clouds look drab beside the vivid sun `#e9b949` and rain `#6aa9e0`.
- [ ] Give clouds a dedicated cool gray (e.g. `#9aa7b4`).

---

## The one interaction that matters

### 8. Unmistakable on/off on device toggles — ★★★★☆, Low–Med
Toggles are the only regular interaction. State is carried largely by **icon colour** today.
- [ ] Audit glance-level clarity from across the room; consider a signal stronger than colour alone (fill, an "ON" pill, brightness).
- [ ] Confirm hit areas are generous on the wall.

Evidence: `src/elements/EntityCard.tsx`, `src/elements/elements.module.css`.

---

## Setup-flow UX

### 9. Per-card settings modal — mostly SHIPPED, remainder below
Also shipped 91f040e: the dialog's horizontal scrollbar (inline summary spans + grid tracks
defaulting to `min-width:auto`) and an "Edit the cards inside this collection" badge, since a
collection's gear can only ever edit the container.
The rebuild landed (see Shipped). What's left from
[`entity-card-settings-review.md`](entity-card-settings-review.md):
- [ ] `aria-pressed` / `role="radio"` on the pill segments. The groups are now labelled (`role="group"` + `aria-labelledby`) and the active pill has a non-colour ✓ cue, but the pills are still plain buttons, so a screen reader doesn't announce which is selected.
- [x] ~~Delete the two files the refactor orphaned — `CardOpacityRow.tsx` and `FontSizeRow.tsx`.~~ Done 2026-08-04.
- [ ] `moveElementToPage` undo restores the page but not the original slot (it re-places into the first free slot both ways). Fine in practice; worth a note if slots ever matter.

---

## Backlog

- **Background-photo treatment** — `filter: blur(var(--bg-blur)) brightness(0.45) saturate(1.15)` (`base.css:351`). At the configured glass of 6 the blur is ≈2px: a near-sharp photo crushed to 45% brightness reads murky behind translucent cards. Try a **vignette/scrim** first, expose **brightness** as a control alongside `backgroundGlass`, and consider a slow Ken-Burns drift (doubles as burn-in mitigation → #3).
- **Icon cohesion** — three vocabularies (hand-drawn weather glyphs, MDI entity icons, bespoke nav paths) with different stroke/fill language. Pick a target density and nudge the custom glyphs toward it, as you touch icons.
- **Hover/active transitions** — non-active nav tabs snap at 0ms (`base.css:186`); add ~150ms. Sidebar resize handle and edit controls only reveal on hover (`base.css:175`) — undiscoverable without a pointer, but setup-time only.
- **Elevation + spacing scale** — shadows/radius are tokenized, ad-hoc paddings remain. Snap to 4/8px as you touch components; not worth a dedicated pass.
- **Secondary data hue** (taste call) — everything expressive is the one `ember` accent. A single restrained cool hue for graph lines / sparklines would give numeric content life without breaking the identity.
- **Used/total bar tile** — a value-against-max gauge ("2.1 TB / 4 TB"), distinct from the history sparkline. User-floated, never built.
- **Commit the review docs** — `ux-review.md`, `look-and-feel-review.md` and this file are all untracked.

---

## Shipped

**Per-card settings dialog rebuild (2026-08-04, uncommitted).** New `src/components/OptionsDialog.tsx`
owns the dialog chrome, the preview slot, the shared Appearance/Placement sections, an undoable remove
and the footer; all **10** editors now supply only their own fields as children. Also new:
`OverrideRow` (one System/Custom grammar replacing the three that had grown up), `Section`/`Field`/
`WideField`, `src/elements/EntityChooser.tsx` (summary row + on-demand picker), `src/components/Toast.tsx`
+ `ToastHost` in the Shell (undo for remove and move). `Modal` gained `role="dialog"`, `aria-modal`,
a focus trap and focus restore. `EntityPicker` gained a `current` prop, an active row and auto-reveal
of the selected entity's device. `options.module.css` moved onto the `--fs-*` scale with ≥44px targets,
a `:focus-visible` ring and a non-colour-only active cue. `Done` (green, submitted nothing) → neutral
`Close`; `Remove` left the sticky footer.

From the reviews (commits ad3bea7 → 7375334): self-hosted Inter + Plus Jakarta Sans, unified
`--fs-*` type scale and `--fs-title`, two-tier text colour, `--card-pad`, calendar-today header fix,
graph-tile rebuilt to match the entity-card family, opt-in Glass card style, animated Aurora
background. Collections (floors → collections → cards) shipped 281d3cc → 7375334, including the
self-referencing-panel recursion freeze fix (2a62a5d).

**Don't touch — already good:** semantic colour tokens, `tabular-nums` on every numeric readout,
calendar skeleton loaders, night-dim + screensaver, per-widget text scaling, `env(safe-area-inset-*)`,
`StatusBanner`, the alert ribbon hiding itself when idle, camera-tile image handling, person-avatar
initials fallback.
