# Entity card settings modal — review & redesign

_2026-08-04. Reviewed `EntityOptionsEditor.tsx` and the shared rows it composes, against the
`ui-ux-pro-max` rule set (§1 Accessibility, §2 Touch & Interaction, §4 Style Selection,
§8 Forms & Feedback). The skill's `--design-system` generator is landing-page oriented — it
proposed a whole new palette and typeface, which is not applicable to a modal inside an
established design system ([[design-system]] tokens stand). Its **rule checklist** is what's used below._

Files: `src/elements/EntityOptionsEditor.tsx`, `src/elements/CardOpacityRow.tsx`,
`src/elements/TextSizeRow.tsx`, `src/grid/EntityPicker.tsx`, `src/components/Modal.tsx`,
`src/components/options.module.css`.

---

## Why it feels bandaided

It isn't one bad control — it's that **eight controls sit in one flat stack with no grouping, no
hierarchy, and three different visual grammars for the same "system default vs. override" idea.**
The stack grew a row at a time and nothing ever got re-grouped. Concretely:

| # | Row | What's wrong |
|---|-----|--------------|
| 1 | "Currently showing `sensor.x`" | Raw entity_id as dim text is the only indication of what the card shows |
| 2 | `EntityPicker` | A **whole device browser** — own search box, own fixed-height scroll pane — embedded inline |
| 3 | Decimals | Fine, but only applies to numeric sensors; shown unconditionally |
| 4 | Text size | Slider + a 2-line helper paragraph |
| 5 | Title | Crams a 3-pill segment **and** a colour swatch **and** a "Default colour" pill into one row |
| 6 | Card opacity | "System" pill sitting next to a range slider — a different override grammar than row 5 |
| 7 | Move to page | A `<select>` whose value is always `""` — a **command** disguised as a value control |
| 8 | Footer | Red "Remove element" adjacent to green "Done" — the two most opposite actions, side by side |

---

## Findings

### A. Information architecture

**A1. The rarest control dominates the dialog.** The `EntityPicker` (row 2) is a full device
browser with `max-height` scroll — it eats most of a 520px modal. You pick the entity **once**,
when the card is created; after that you're here to nudge text size or opacity, and those are
below the fold. Skill: `content-priority` (§5), `progressive-disclosure` (§8).
→ Collapse to a summary row — friendly name + entity_id + a **Change…** button that swaps in the picker.

**A2. No grouping at all.** Eight peer rows, no fieldsets, no section headings, no visual
separation. Skill: `field-grouping`, `whitespace-balance`.
→ Three groups: **Entity** · **Display** (decimals, text size) · **Appearance** (title, opacity) ·
**Placement** (move). Appearance collapses by default, since it's all system-default in the normal case.

**A3. The picker never shows what's already selected.** `EntityPicker.pickRow` has no
current/active state (`EntityPicker.tsx:69-75`) and takes no `current` prop, so the only way to
know what the card shows is to read the raw id in the dim line above. The `makeDomainOptionsEditor`
sibling *does* mark it (radio `checked`) — so the two pickers disagree.
→ Pass `current` into `EntityPicker` and highlight the row; scroll it into view on open.

**A4. Decimals shows for entities where it does nothing.** It only affects numeric sensors.
→ Hide unless the selected entity's state parses as a number (same conditional style as Graph's
`o.layout === 'tile'` icon row, `GraphOptionsEditor.tsx:79`).

### B. The tri-state "System / override" pattern — three shapes for one idea

This is the single biggest source of the clunky feel. The same concept appears three times, each
rendered differently (`CardOpacityRow.tsx`):

- **Title visibility** — three pills: `System | Show | Hide`
- **Title colour** — a native colour swatch **plus** a `Default color` pill acting as the reset
- **Card opacity** — a `System` pill **beside** a live range slider, with the current value spliced
  into the label text (`Card opacity · 62%` / `· system setting`)

Skill: `consistency` (§4), `visual-hierarchy` (§5), `state-clarity` (§4).

→ **Extract one `<OverrideRow>` primitive** used by all three (and by the 7 sibling editors):

```
Title          System ▾            ← reads "System" until overridden
Card opacity   Custom · 62% ▾  ↺   ← reveals its control; ↺ resets to system
```

One row, one grammar: a label, a state chip that says *System* or *Custom · value*, the control
revealed only when overridden, and a consistent reset affordance. Also fixes the "is the swatch
active or not?" ambiguity in the title-colour row.

Side note: the colour input uses `onChange` (`CardOpacityRow.tsx:45`) while every other control uses
`onInput` — so colour commits on picker-close while the rest are live. Unify.

### C. Move-to-page is a command wearing a value control's clothes

`MoveToPageRow` renders a `<select value="">` whose `onChange` immediately teleports the card and
implicitly closes the modal (the element vanishes from the page, so `GridPage` unmounts the editor).
A select that never holds its own value is a mis-used control, and the destructive-ish outcome is a
single un-confirmed change event with no undo. Skill: `system-controls` (§4), `undo-support` (§8).

→ Make it a **button** — `Page: Main floor  [Move…]` — opening a small picker; on completion show a
brief "Moved to Basement · Undo" toast. Also shows *which page it's on now*, which the current row doesn't.

### D. Destructive action placement

`Remove element` is a persistent red button in the **sticky** footer, permanently one click away,
directly beside the green primary. No confirmation, no undo. Skill: `confirmation-dialogs`
(severity **High**), `destructive-emphasis`, `destructive-nav-separation` (§9), `undo-support`.

→ Move it out of the footer: a de-emphasised text button at the **end of the scroll region**,
visually separated. Then either a confirm step or — better for a wall panel — remove immediately with
an **Undo** toast. Keep the footer for `Done` alone.

### E. "Done" is not a submit button

Everything saves live on change, so the green `--green` button submits nothing — it closes. But green
is the app's success colour and it's shaped like a CTA, which implies "commit". Meanwhile there is no
**Cancel**: Esc, backdrop-click and Done all mean "keep everything". Skill: `primary-action` (§4),
`escape-routes` (§1), `sheet-dismiss-confirm` / `undo-support` (§8).

→ Rename to **Close** and drop it to a neutral/secondary style; snapshot `element.options` on open and
offer **Reset changes** if anything differs. (Its text colour `#0c1f12` is also hardcoded —
`options.module.css:197` — the same class of bug as the `--on-accent` queue item.)

### F. You can't see what you're editing

Text size, opacity and title colour all change the card — which is behind a 520px modal that is
probably covering it. You adjust blind, close, look, reopen. Skill: `motion-meaning` (§7) in spirit;
practically it defeats the entire point of live-save.

→ Either render a **live mini-preview of the card at the top of the dialog**, or make the panel a
side-anchored sheet so the grid stays visible. The preview is less work and also gives the modal a
clear subject.

### G. Accessibility (skill §1 — CRITICAL)

- **G1. No label association.** `opt.row` is a `<div>` with a bare text node for the segmented rows
  (`EntityOptionsEditor.tsx:35`, `CardOpacityRow.tsx:18`, `:69`) — "Decimals", "Title", "Card opacity"
  are not programmatically tied to their controls. Only the slider/select rows use `<label>`.
  → `<fieldset><legend>` or `role="group" aria-labelledby`.
- **G2. Segmented controls are plain buttons** with no `aria-pressed` / `role="radio"` + `aria-checked`,
  so selection is invisible to a screen reader. Skill: `aria-labels`, accessibility state announcement.
- **G3. Selection is colour-only.** `.segActive` (`options.module.css:94`) signals active purely via
  accent colour/border. Skill: `color-not-only`. → Add a check glyph or a weight bump.
- **G4. No focus styling on any button.** `.row input:focus` exists (`:50`) but the pills, `.close`,
  `.doneBtn`, `.removeBtn` and every picker row have none. Skill: `focus-states`. → Covered by the
  global `:focus-visible` item in `queue.md`; this dialog is the place it's most needed (setup flow).
- **G5. The Modal primitive has no dialog semantics** — no `role="dialog"`, `aria-modal`, no focus
  trap, no initial focus, no focus restore. Esc and backdrop-click work, but Tab walks straight out
  into the grid behind. Skill: `keyboard-nav`, `escape-routes`, `focus-management`.

### H. Touch targets (skill §2 — CRITICAL)

- `.segBtn` — `7px 14px` at `0.8rem` ≈ **30px tall**, under the 44px minimum, and there are 4–5 in a row.
- `.checkItem input` — 17px radio.
- `.close` — `6px 10px`.

Wall-mounted touchscreen; setup is exactly when a person is poking this dialog with a finger.
→ Raise interactive rows to ≥44px in this modal.

### I. Type sizes bypass the token scale

`.row` `0.85rem`, `.segBtn` `0.8rem`, `.checkId` `0.72rem`, `.dim` `0.85rem`, `.warn` `0.82rem`,
`.linkBtn` `0.85rem` — all literals, none of them `--fs-*`. This is the same "chrome never went
through the type scale" gap tracked in `queue.md` item 1. `.warn` also hardcodes `#e7d3a6`.

### J. Eight editors, copy-pasted

`EntityOptionsEditor`, `GraphOptionsEditor`, `domainOptionsEditor`, Media, Camera, Clock, Weather,
Presence, Calendar, AlertRibbon, Popup each re-implement the same `<Modal>` + `opt.header` + ✕ +
`opt.footerRow` + Remove/Done, then stack `TextSizeRow` / `CardTitleRow` / `CardOpacityRow` in
**slightly different orders**. Nothing enforces consistency, so it drifts every time one is touched.

→ An `<OptionsDialog title=… element=… pageId=… onClose=…>` shell that owns the header, the common
Appearance/Placement sections and the footer; each editor supplies only its type-specific fields as
children. Removes ~30 duplicated lines per editor and makes every dialog consistent by construction.

---

## Proposed layout

```
┌ Entity card settings ─────────────────────── ✕ ┐
│  ┌────────────────────────────────┐            │
│  │   [ live preview of the card ] │            │   ← F: see what you're editing
│  └────────────────────────────────┘            │
│                                                 │
│  ENTITY                                         │
│  Living room lamp                               │   ← A1/A3: summary, not a browser
│  light.living_room_lamp            [ Change… ]  │
│                                                 │
│  DISPLAY                                        │
│  Decimals      [Auto][0][1][2]                  │   ← A4: only for numeric entities
│  Text size     ──●──────  110%          ↺       │
│                                                 │
│  ▸ APPEARANCE            System defaults        │   ← A2/B: collapsed until overridden
│      Title            System ▾                  │
│      Title colour     System ▾                  │
│      Card opacity     Custom · 62% ▾    ↺       │
│                                                 │
│  PLACEMENT                                      │
│  Page: Main floor                  [ Move… ]    │   ← C: command reads as a command
│                                                 │
│  Remove card                                    │   ← D: separated, undoable
│ ─────────────────────────────────────────────── │
│                                        [ Close ]│   ← E: not a submit
└─────────────────────────────────────────────────┘
```

## Suggested order of work

1. **`<OptionsDialog>` shell + `<OverrideRow>` primitive** (J + B) — the structural fix; everything
   else gets cheaper afterwards and all 8 editors improve at once.
2. **Collapse the entity picker to a summary + Change…** (A1, A3) — biggest single perceived improvement.
3. **Group into Entity / Display / Appearance / Placement** (A2).
4. **Destructive + footer** (D, E) — move Remove out of the footer, Done → Close, add undo.
5. **A11y + touch pass** (G, H) — fieldsets, `aria-pressed`, dialog semantics, 44px rows. Pairs with
   the global `:focus-visible` queue item.
6. **Live preview** (F) — nice-to-have, do it once the layout is stable.
7. **Token-ise the type sizes** (I) — fold into the chrome type-scale pass.
