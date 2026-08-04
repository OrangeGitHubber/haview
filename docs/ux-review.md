# HAView — UX/UI Review

_Generated 2026-07-29, via the `ui-ux-pro-max` design-intelligence skill, grounded in the current codebase. Re-ranked for a **display-first** usage model (see below)._

## Usage model (this drives the whole ranking)

HAView on the wall screen is **~95% display-only**. Almost all interaction happens once, at **setup**. In regular use the *only* interaction is a few **toggle buttons** to switch certain devices on/off. It is an ambient **"10-foot" display** read from across a room, running on a large TV and a **Raspberry Pi** (weak GPU).

That inverts the usual UX priorities. The skill's rule DB assumes a touch/mobile app where interaction quality dominates; here, **what the screen shows at a glance matters far more than how it responds to input.** So legibility, glanceability, data freshness, and burn-in rise to the top, and interaction polish (focus rings, hover states, drag affordances) drops to "nice, cheap, do it if idle."

Ranked **by benefit for a display-first wall screen**, effort noted. Top = do first.

---

## Summary table

| # | Recommendation | Benefit | Effort | Category |
|---|----------------|---------|--------|----------|
| 1 | Make everything readable at TV viewing distance | ★★★★★ | Low–Med | Legibility |
| 2 | Surface stale / disconnected data (don't show it silently) | ★★★★★ | Med | Data integrity |
| 3 | OLED burn-in protection for a ~static 24/7 screen | ★★★★★ | Med | Hardware longevity |
| 4 | Unmistakable on/off state on the device-toggle buttons | ★★★★☆ | Low–Med | The one interaction |
| 5 | Fix on-accent text color for the custom accent picker | ★★★★☆ | Low | Correctness / A11y |
| 6 | Per-widget "unavailable" states for missing entities | ★★★☆☆ | Low–Med | Data integrity |
| 7 | Respect `prefers-reduced-motion` (also helps the Pi) | ★★★☆☆ | Low | Performance / A11y |
| 8 | Visible focus ring (`:focus-visible`) — mainly for setup | ★★☆☆☆ | Low | Setup usability |
| 9 | Hover/active transitions + reveal hover-only affordances | ★★☆☆☆ | Low–Med | Polish (setup/edit) |
| 10 | Consolidate elevation + spacing into a scale | ★☆☆☆☆ | Med | Consistency |

**What's already good** (don't touch): semantic color tokens (`theme.css`), calendar skeleton loaders, night-dim + screensaver + screensaver-intensity for the Pi, per-widget text-size scaling, `env(safe-area-inset-*)` handling, `StatusBanner`, and the alert ribbon hiding itself when idle. Strong base — these are refinements.

---

## 1. Readable at TV viewing distance — ★★★★★, Low–Med effort

**Why it's #1:** a display-first screen has one job — be read at a glance from across the room. If the chrome is laptop-sized on a 55" wall, everything else is secondary.

**The problem.** Base font is `clamp(16px, 0.8vw, 34px)` (`base.css:20`). Many TVs report a ~1920px CSS viewport regardless of physical size, so `0.8vw` (≈15px) clamps to the **16px design baseline** — laptop-sized text on a wall. Nav labels, brand subtitle and the "current dashboard" line are `0.6–0.68rem` (≈10–11px) — unreadable from a couch. Per-widget text-size knobs fix widget *content*, not the app chrome.

**Recommendation (escalating):**
- **Try first, zero code:** raise the global **UI scale** setting on the TV to ~140. It scales all chrome.
- **Better default:** a "display size / viewing distance" preset in Settings that sets `uiScale` (Wall TV → ~140) so a fresh install on a big screen isn't laptop-sized.
- **Structural:** don't key sizing off `vw` (the TV misreports it) — lift the clamp floor, or gate off a stored "wall display" flag.

Evidence: `base.css:20`, `:99`, `:199`, `:207`, `:283`.

---

## 2. Surface stale / disconnected data — ★★★★★, Med effort

**Why it's #2 (and new):** on a screen nobody interacts with, a **silently frozen value is the worst failure** — the dashboard looks fine while showing yesterday's temperature or a light that's actually off. With a touch app the user pokes it and notices; here, nobody does.

**Recommendation.**
- On WS disconnect / auth loss, make it obvious at a glance — you have `StatusBanner`; ensure it's prominent enough to read at distance and that reconnection is automatic.
- Consider a subtle per-widget staleness cue when an entity hasn't updated within an expected window (e.g. a faint "· 3h ago" or a dimmed state), so a dead sensor reads as *dead*, not *current*.
- Verify the auto-refresh / reconnect path recovers without a human pressing the refresh button (since no human will).

Evidence: `src/components/StatusBanner.tsx`, connection handling in `src/lib/ha/connection.ts`.

---

## 3. OLED burn-in protection — ★★★★★, Med effort

**Why it rose:** "95% display-only" means the pixels barely change — the **worst case for burn-in / image retention** on OLED (and some LCD) panels. A static sidebar, fixed borders and unchanging labels for years will ghost.

**Recommendation.**
- Engage the screensaver during the **day** too (a second, longer idle threshold), not only in the night window.
- Add an optional very slow **whole-shell pixel-shift**: nudge the app container a few px on a multi-minute cycle (`transform: translate(...)` — imperceptible, GPU-cheap). Standard TV "pixel orbiter" trick, directly protects the panel.
- Optional: hourly, briefly fade the UI toward black for a few seconds.

TV-hardware-specific (outside the skill's mobile scope) but high-value for a multi-year wall install.

---

## 4. Unmistakable on/off state on the toggle buttons — ★★★★☆, Low–Med effort

**Why:** device toggles are literally the *only* regular interaction. Their on/off state must be readable at a glance and the target big enough to hit reliably (touch or pointer). Today entity state is conveyed largely by **icon color** (per the project's design) — verify that on/off is unambiguous at distance for someone who isn't studying it, and that the tap target is comfortably large on the wall.

**Recommendation.** Audit the entity-card on/off treatment for glance-level clarity — consider a stronger state signal than color alone (fill, a subtle "ON" pill, or brightness) so it doesn't rely on color discrimination from across a room. Confirm hit areas are generous.

Evidence: `src/elements/EntityCard.tsx`, `src/elements/elements.module.css`.

---

## 5. Fix on-accent text color for the custom accent picker — ★★★★☆, Low effort

**The problem.** On-accent button text hardcodes dark brown (`#1d1206`, and `#211a0d` on yellow). `theme.css:72` warns: _"Keep accents mid-lightness — several buttons render dark #1d1206 text on var(--accent)."_ The **custom accent picker you just shipped removes that guardrail** — a dark custom accent makes the text unreadable. It's a small surface here (toggle buttons + the setup submit button), but it's a genuine regression and a 10-minute fix.

**Recommendation.** Add a semantic `--on-accent` token; for the custom accent compute black/white by luminance (`L = 0.2126R+0.7152G+0.0722B → L>0.55 ? dark : #fff`). Replace the literal hex.

Evidence: `base.css:242,256,507`; `grid.module.css:66,614`; `theme.css:72`.

---

## 6. Per-widget "unavailable" states — ★★★☆☆, Low–Med effort

Pairs with #2. When an entity is missing, ensure the card shows a clear "unavailable" treatment rather than a blank, so a broken entity reads as *intentional*, not *current data*. You already do this well in places (calendar skeletons, alert ribbon "All clear ✓"); the gap is uneven coverage across entity/graph/media cards.

---

## 7. Respect `prefers-reduced-motion` — ★★★☆☆, Low effort

No reduced-motion guard exists (grep → 0). Less about accessibility-interaction here and more that it's a free, low-cost mode for the **weak Pi GPU** and reduces motion on a screen meant to sit calmly in a room. Add the standard global guard; consider auto-selecting the low-intensity screensaver.

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important; animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Evidence: animations at `base.css:377,395,419`; `src/components/Screensaver.tsx`.

---

## 8. Visible focus ring — ★★☆☆☆, Low effort

Dropped from a top item to a minor one: with ~no regular interaction, keyboard/remote focus barely matters. It's still worth the one-line global `:focus-visible` rule **for the setup flow** (entering URL/token with a keyboard), and it's essentially free.

```css
:where(button, a, input, select, textarea, .nav-item):focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
```

Evidence: grep for `:focus-visible` → 0 matches (only `.setup-card input:focus`).

---

## 9. Transitions + hover-only affordances — ★★☆☆☆, Low–Med effort

Polish, mostly relevant to setup/edit (rare). Non-active nav tabs have no hover and states snap at 0ms (`base.css:186`); add 150ms transitions. The sidebar resize handle and edit controls only reveal on hover (`base.css:175`) — undiscoverable without a pointer, but these are setup-time actions, so low urgency.

---

## 10. Consolidate elevation + spacing into a scale — ★☆☆☆☆, Med effort

Backlog. Shadows/radius are tokenized; some ad-hoc paddings remain. Snap spacing to 4/8px as you touch each component; not worth a dedicated pass.

---

## Suggested order of attack

- **Highest leverage:** #1 (legibility — try raising UI scale first, it may be a settings change not code), #2 (stale-data surfacing), #3 (burn-in). These are what a display-first screen lives or dies on.
- **Quick correctness wins (Low effort):** #5 (on-accent), #7 (reduced-motion), #8 (focus ring) — an hour or two together.
- **The one interaction that matters:** #4 (toggle on/off clarity) — pairs naturally with any entity-card work.
- **Backlog:** #6, #9, #10 as you touch the relevant areas.
