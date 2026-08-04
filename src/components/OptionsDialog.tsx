import { useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Modal } from './Modal';
import { showToast } from './Toast';
import {
  settings,
  addElement,
  removeElement,
  moveElementToPage,
  updateElementOptions,
} from '../lib/settings';
import type { GridElement } from '../grid/types';
import opt from './options.module.css';

let seq = 0;
const nextId = () => `optdlg${++seq}`;

/* ---------- layout primitives ---------- */

/** A titled group of related controls. */
export function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class={opt.sec}>
      <h3 class={opt.secTitle}>{title}</h3>
      <div class={opt.group}>{children}</div>
    </section>
  );
}

/** Label on the left, control on the right. Use for compact controls. */
export function Field({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <div class={opt.field}>
      <span class={opt.fieldLabel}>{label}</span>
      <span class={opt.fieldCtl}>{children}</span>
    </div>
  );
}

/** Label above, full-width control below. Use for sliders and text inputs. */
export function WideField({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <label class={opt.fieldWide}>
      {label}
      {children}
    </label>
  );
}

/**
 * The one grammar for "follow the global setting, or override it here".
 *
 * The chip toggles between the two states and reports the current value when
 * overridden; the control itself only exists while overridden, so there's
 * never an ambiguous half-active control sitting next to a "System" button.
 * Replaces the three different shapes this idea used to have (title = 3 pills,
 * title colour = swatch + reset pill, opacity = pill beside a live slider).
 */
export function OverrideRow({
  label,
  overridden,
  value,
  onOverride,
  onReset,
  children,
}: {
  label: string;
  overridden: boolean;
  /** shown in the chip while overridden, e.g. "62%" */
  value?: string;
  /** switch to custom — seed the option with the current effective value */
  onOverride: () => void;
  onReset: () => void;
  children: ComponentChildren;
}) {
  const [id] = useState(nextId);
  return (
    <div class={opt.ovRow}>
      <div class={opt.ovHead}>
        <span id={id}>{label}</span>
        <button
          class={`${opt.ovChip}${overridden ? ` ${opt.ovChipOn}` : ''}`}
          aria-expanded={overridden}
          aria-describedby={id}
          onClick={() => (overridden ? onReset() : onOverride())}
        >
          {overridden ? `Custom${value ? ` · ${value}` : ''}` : 'System'}
        </button>
      </div>
      {overridden && (
        <div class={opt.ovBody} role="group" aria-labelledby={id}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ---------- the shared appearance / placement sections ---------- */

function AppearanceSection({
  pageId,
  element,
  withTitle,
}: {
  pageId: string;
  element: GridElement;
  withTitle: boolean;
}) {
  const rawShow = element.options?.showTitle;
  const show = typeof rawShow === 'boolean' ? rawShow : null;
  const rawColor = element.options?.titleColor;
  const color = typeof rawColor === 'string' && rawColor ? rawColor : null;
  const rawOpacity = element.options?.opacity;
  const opacity =
    typeof rawOpacity === 'number' && Number.isFinite(rawOpacity) ? rawOpacity : null;

  const set = (patch: Record<string, unknown>) => updateElementOptions(pageId, element.id, patch);

  const overrides =
    (withTitle && show !== null ? 1 : 0) +
    (withTitle && color !== null ? 1 : 0) +
    (opacity !== null ? 1 : 0);
  // nothing customised → nothing worth showing; open it when there is
  const [open, setOpen] = useState(overrides > 0);

  return (
    <section class={opt.sec}>
      <button class={opt.disclosure} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          <span class={`${opt.caret}${open ? ` ${opt.caretOpen}` : ''}`} aria-hidden="true">
            ▸
          </span>
          Appearance
        </span>
        <span class={opt.disclosureState}>
          {overrides === 0 ? 'All system' : `${overrides} custom`}
        </span>
      </button>
      {open && (
        <div class={opt.group}>
          {withTitle && (
            <OverrideRow
              label="Title"
              overridden={show !== null}
              value={show ? 'shown' : 'hidden'}
              onOverride={() => set({ showTitle: true })}
              onReset={() => set({ showTitle: undefined })}
            >
              <div class={opt.seg}>
                <button
                  class={`${opt.segBtn}${show === true ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ showTitle: true })}
                >
                  Show
                </button>
                <button
                  class={`${opt.segBtn}${show === false ? ` ${opt.segActive}` : ''}`}
                  onClick={() => set({ showTitle: false })}
                >
                  Hide
                </button>
              </div>
            </OverrideRow>
          )}
          {withTitle && (
            <OverrideRow
              label="Title colour"
              overridden={color !== null}
              value={color ?? undefined}
              onOverride={() => set({ titleColor: '#f28c28' })}
              onReset={() => set({ titleColor: undefined })}
            >
              <input
                type="color"
                value={color ?? '#f28c28'}
                onInput={(e) => set({ titleColor: (e.target as HTMLInputElement).value })}
                aria-label="Title colour"
              />
            </OverrideRow>
          )}
          <OverrideRow
            label="Card opacity"
            overridden={opacity !== null}
            value={opacity !== null ? `${opacity}%` : undefined}
            onOverride={() => set({ opacity: settings.peek().cardOpacity })}
            onReset={() => set({ opacity: undefined })}
          >
            <input
              type="range"
              min={0}
              max={100}
              value={opacity ?? settings.peek().cardOpacity}
              onInput={(e) => set({ opacity: Number((e.target as HTMLInputElement).value) })}
              style={{ flex: '1', minWidth: '140px' }}
            />
          </OverrideRow>
        </div>
      )}
    </section>
  );
}

function PlacementSection({ pageId, element }: { pageId: string; element: GridElement }) {
  const pages = settings.value.pages;
  const here = pages.find((p) => p.id === pageId);
  const others = pages.filter((p) => p.id !== pageId);
  const [picking, setPicking] = useState(false);
  if (others.length === 0) return null;

  const move = (toId: string, toTitle: string) => {
    moveElementToPage(pageId, element.id, toId);
    // undo puts it back on the original page; the exact slot isn't restored
    // because moveElementToPage re-places into the first free slot
    showToast({
      message: `Moved to ${toTitle}`,
      actionLabel: 'Undo',
      onAction: () => moveElementToPage(toId, element.id, pageId),
    });
  };

  return (
    <Section title="Placement">
      <div class={opt.field}>
        <span class={opt.fieldLabel}>
          Page · <span style={{ color: 'var(--text)' }}>{here?.title ?? 'this page'}</span>
        </span>
        <span class={opt.fieldCtl}>
          <button class={opt.segBtn} aria-expanded={picking} onClick={() => setPicking(!picking)}>
            Move…
          </button>
        </span>
      </div>
      {picking && (
        <ul class={opt.checklist}>
          {others.map((p) => (
            <li key={p.id}>
              <button
                class={opt.checkItem}
                style={{ width: '100%', background: 'none', border: 'none', color: 'inherit' }}
                onClick={() => move(p.id, p.title)}
              >
                <span class={opt.checkName}>{p.title}</span>
                {p.hidden && <span class={opt.checkId}>collection</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ---------- the shell ---------- */

/**
 * Shared shell for every per-element options editor: dialog chrome, the
 * preview, the common Appearance and Placement sections, an undoable remove
 * and the footer. Each editor supplies only its own type-specific fields as
 * children, so all of them stay consistent by construction (they used to
 * copy-paste the header/footer and stack the shared rows in varying order).
 */
export function OptionsDialog({
  title,
  pageId,
  element,
  onClose,
  maxWidth = 460,
  preview,
  withTitleOverride = true,
  withAppearance = true,
  withPlacement = true,
  removeLabel = 'Remove card',
  children,
}: {
  title: string;
  pageId: string;
  element: GridElement;
  onClose: () => void;
  maxWidth?: number;
  /** live preview of the thing being edited, shown at the top */
  preview?: ComponentChildren;
  /** elements without a card title (clock, collection) opt out of those rows */
  withTitleOverride?: boolean;
  withAppearance?: boolean;
  /** collections have their own page-targeting UI, so they opt out */
  withPlacement?: boolean;
  removeLabel?: string;
  children: ComponentChildren;
}) {
  const [headingId] = useState(nextId);

  const remove = () => {
    const snapshot = element;
    removeElement(pageId, element.id);
    onClose();
    showToast({
      message: `${title.replace(/ settings$/, '')} removed`,
      actionLabel: 'Undo',
      onAction: () => addElement(pageId, snapshot),
    });
  };

  return (
    <Modal onClose={onClose} maxWidth={maxWidth} labelledBy={headingId}>
      <header class={opt.header}>
        <span id={headingId}>{title}</span>
        <button class={opt.close} onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div class={opt.form}>
        {preview && (
          <div class={opt.preview} aria-hidden="true">
            {preview}
          </div>
        )}
        {children}
        {withAppearance && (
          <AppearanceSection pageId={pageId} element={element} withTitle={withTitleOverride} />
        )}
        {withPlacement && <PlacementSection pageId={pageId} element={element} />}
        <div class={opt.dangerRow}>
          <button class={opt.dangerBtn} onClick={remove}>
            {removeLabel}
          </button>
        </div>
        <div class={opt.footerRow}>
          <button class={opt.closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
