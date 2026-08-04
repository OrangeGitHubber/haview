# HAView — Look & Feel Review: Images & Text

_Generated 2026-07-29. A visual-design review of the **actual rendered look** of type and imagery, grounded in the current CSS/components. Companion to `docs/ux-review.md` (which covers usability); this one is purely about how it **looks**._

Ranked by **impact on perceived visual quality** for an ambient wall display. Each item cites the code it's based on.

---

## TL;DR

The bones are good — consistent tokens, tabular numerals everywhere, well-handled camera imagery, tasteful elevation. What holds the "look" back from feeling like a *designed product* rather than a *web app* is mostly **two things**: it rides on the **system font**, and the **type scale + secondary-color** have grown organically into ~30 near-duplicate sizes and one muddy gray doing all the work. Fixing those two is 80% of the visual uplift. On the image side, the **background-photo treatment** is the biggest lever.

---

## TEXT

### 1. Adopt a distinctive, self-hosted typeface — ★★★★★ impact, Med effort

**Today:** `font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` (`base.css:26`), no `@font-face` anywhere. That means the dashboard **literally looks like a different product on every device** — Segoe on the Windows browser, Roboto/Noto/DejaVu on the Raspberry Pi's Linux browser, San Francisco on a Mac. For a fixed-install appliance whose whole value is a curated, glanceable surface, inheriting the OS default is the single biggest thing making it read as "web app" rather than "designed dashboard."

**Why it matters most here:** the content is display type at a distance and lots of numbers. A purpose-chosen font with real weights and good tabular figures instantly lifts perceived quality more than any color or spacing tweak — and it renders *identically* on the TV and the Pi.

**Recommendation:**
- Self-host a variable font (bundle the `.woff2` through Vite + `@font-face` with `font-display: swap`) so it works **offline on the Pi with no CDN** — important given the deploy model.
- Safe high-legibility pick: **Inter** (superb at distance, excellent tabular numerals). More characterful alternative (the skill's pick for smart-home dashboards): **Plus Jakarta Sans**. If you want the numbers to have personality, pair a rounded display face for the big readouts (clock, temp) with Inter for everything else.
- One `@font-face` + changing one line in `base.css:26` rolls it out everywhere, because every size is already relative.

### 2. Consolidate the type scale and weight set — ★★★★☆ impact, Med effort

**Today** there is no systematic scale. Across the widget CSS I count ~30 distinct font sizes, many a hair apart: `0.6 / 0.62 / 0.64 / 0.66 / 0.68 / 0.7 / 0.72 / 0.75 / 0.76 / 0.77 / 0.78 / 0.8 / 0.82 / 0.85 / 0.88 / 0.9 / 0.92 / 0.95 / 1.0 / 1.05 / 1.2 / 1.25 / 1.3 / 1.35 …`. Differences like `0.76` vs `0.77` vs `0.78em` are invisible individually but collectively there's **no rhythm** — and rhythm is exactly what reads subconsciously as "polished."

Same story with weight: `500 / 550 / 600 / 650 / 700 / 750` are all in use (`font-weight: 550` appears across most modules). With a system font, **`550` and `650` aren't real weights** — they round to whatever the font ships (often 500/600/700), so the intended fine gradation doesn't even render. You're carrying complexity that the renderer discards.

**Recommendation:** define a small modular scale as tokens (e.g. `--fs-2xs .69 / --fs-xs .79 / --fs-sm .89 / --fs-base 1 / --fs-lg 1.27 / --fs-xl 1.6 / --fs-2xl 2.4rem`) and 3 weights (`400 / 600 / 700`). Snap every widget's sizes to the nearest step. Tightens the whole surface and removes the phantom weights. Pairs naturally with #1.

### 3. Give secondary text more than one muddy gray — ★★★☆☆ impact, Low–Med effort

Almost all non-primary text is a single token, `--text-dim: #a89e95` (`theme.css:10`) — a warm gray-brown used for labels, units, dates, conditions, addresses, device names, weather/presence/camera titles' fallback, graph windows, sub-values. Leaning the *entire* secondary tier on one flat, slightly muddy color makes dense cards read as gray soup and flattens hierarchy.

**Recommendation:** introduce a second step (e.g. `--text-2` brighter for on-card secondary text vs `--text-dim` for the faintest tertiary), and lean on **weight/size** for hierarchy so color isn't doing all of it. Consider nudging `--text-dim` very slightly cooler/brighter so it doesn't muddy against the warm dark surfaces.

### 4. Numerals & tabular figures — ★★★★★ (already excellent — keep)

`font-variant-numeric: tabular-nums` is applied consistently to every numeric readout — clock, temp, sensor values, battery %, graph values, thermostat target (`elements.module.css:163,260,306,642`, `weather.module.css:98`, `people.module.css:181`). This is a genuine pro touch that stops numbers from jittering as they update. Don't lose it when you change fonts — pick a face with real tabular figures (Inter/Jakarta both have them).

---

## IMAGES

### 5. Rework the background-photo treatment — ★★★★☆ impact, Low–Med effort

This is the biggest **image** lever, because the page background is the main non-widget imagery on the wall. Current treatment (`base.css:351`): `filter: blur(var(--bg-blur)) brightness(0.45) saturate(1.15); transform: scale(1.08)`, where `--bg-blur = round(glass/100 * 28)px`.

Your config has `backgroundGlass: 6` → **≈2px blur** — i.e. the doorbell photo is **nearly sharp** but crushed to 45% brightness, sitting behind 76%-opaque cards. A sharp-but-dark photo behind translucent cards tends to read as **noisy/murky** — fine detail competes with card text instead of providing calm ambient texture.

**Recommendation:**
- Either raise the default blur substantially (frosted, calm — detail becomes texture) **or** keep it sharp but add a **scrim/vignette** (a radial or top-to-bottom gradient over the photo) so card regions stay clean and edges fall off. A vignette alone makes cards "pop" markedly.
- Expose **brightness** as a control alongside `backgroundGlass` (you already tune blur; brightness is the other half). It lets a bright daytime photo and a dark card set coexist.
- Consider a very slow **Ken-Burns drift** on the background (respecting reduced-motion) — high ambient-quality payoff, and it doubles as burn-in mitigation (see `ux-review.md` #3).

### 6. Weather icons — clean set, one dull note — ★★★☆☆ impact, Low effort

The hand-drawn inline SVG glyphs (`weatherIcons.tsx`) are a real asset: one coherent ~9-glyph set, consistent construction, theme-following. Two refinements:
- **Cloud color is `--text-dim`** (`weatherIcons.tsx:9`) — the same muddy warm gray as body labels. Against the vivid sun (`#e9b949`) and rain (`#6aa9e0`), clouds look drab and "unfinished." Give clouds a **dedicated cool gray** (e.g. `#9aa7b4`) so the set looks intentional and weather-y.
- The glyph palette is hardcoded hex (fine, weather colors are semantic) but sits outside the token system — if you ever theme the dashboard cool/warm, the weather set won't follow. Low priority; note it.

### 7. Iconography cohesion across sources — ★★★☆☆ impact, Low–Med effort

Three icon vocabularies coexist: hand-drawn **weather** glyphs (`~1.8px` stroke, 24×26 box), **MDI** entity icons (`@mdi/js`, filled, 24×24), and bespoke **nav/refresh** paths. They live in different contexts so it mostly works, but the stroke-weight/fill language differs enough that entity icons and weather icons don't feel like one family up close. Be deliberate: pick a target stroke weight and filled-vs-outline stance, and nudge the custom glyphs toward the MDI density (or vice-versa). Cohesive iconography is a big part of "designed, not assembled."

### 8. Imagery that's already handled well — keep

- **Camera tiles** (`cameras.module.css`): `object-fit: cover`, gradient scrim under the name, `snapshotIn` fade, hover `scale(1.03)`, unavailable → `grayscale(.6)+opacity`, a blurred "STALE" pill. This is genuinely polished image handling — the standard to bring the rest up to.
- **Person avatars** (`people.module.css:62`): circular, `object-fit: cover`, and a proper **initials fallback** on `accent-dim` with accent text. Good.
- **Media art / graph fills / battery bars**: rounded, on-brand accent fills, color-coded status. Solid.
- **Elevation**: single `--shadow`/`--shadow-sm` scale, `--radius 12 / --radius-sm 8`, used uniformly. Good discipline — don't fragment it.

---

## The whole-look question: monochrome-accent identity — ★★☆☆☆, taste call

Everything expressive is one accent (your `ember` red-orange): titles, "on" icons, graph lines, chips, active states. It's **cohesive**, but one-note — the surface can feel monochrome-amber. Optional: introduce a single restrained **secondary hue** for data (e.g. graph lines / sparklines / a "cool" status) so numeric content gets a little life without breaking the identity. Deliberate either way — just flagging it as a choice, not an oversight.

---

## Suggested order (visual uplift per unit effort)

1. **#1 typeface** + **#2 type scale** together — one focused pass, by far the biggest jump in perceived quality of *text*.
2. **#5 background treatment** — biggest jump for *images* on the main page; try a vignette + brightness control first.
3. **#3 secondary color** and **#6 cloud color** — quick, tighten the palette.
4. **#7 icon cohesion** — as you touch icons.
