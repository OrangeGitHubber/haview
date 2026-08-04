import { signal } from '@preact/signals';
import { useEffect } from 'preact/hooks';
import styles from './toast.module.css';

export interface ToastSpec {
  message: string;
  /** label for the single action button, e.g. "Undo" */
  actionLabel?: string;
  onAction?: () => void;
  /** ms before it auto-dismisses; undoable toasts get longer */
  duration?: number;
}

interface ActiveToast extends ToastSpec {
  id: number;
}

const active = signal<ActiveToast | null>(null);
let seq = 0;

/**
 * Show a transient message, optionally with one action. Only one toast is
 * visible at a time — a new one replaces the old (an undo you didn't take is
 * stale the moment you do something else).
 */
export function showToast(spec: ToastSpec): void {
  active.value = { ...spec, id: ++seq };
}

export function dismissToast(): void {
  active.value = null;
}

/** Mounted once, in the Shell. */
export function ToastHost() {
  const t = active.value;

  useEffect(() => {
    if (!t) return;
    const ms = t.duration ?? (t.actionLabel ? 8000 : 4000);
    const timer = window.setTimeout(() => {
      // only clear if this is still the toast on screen
      if (active.peek()?.id === t.id) active.value = null;
    }, ms);
    return () => window.clearTimeout(timer);
  }, [t?.id]);

  if (!t) return null;

  return (
    // polite + no autofocus: a wall display must never have focus yanked, and
    // the action stays reachable by tab
    <div class={styles.host} role="status" aria-live="polite">
      <span class={styles.msg}>{t.message}</span>
      {t.actionLabel && (
        <button
          class={styles.action}
          onClick={() => {
            t.onAction?.();
            active.value = null;
          }}
        >
          {t.actionLabel}
        </button>
      )}
      <button class={styles.dismiss} onClick={dismissToast} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
}
