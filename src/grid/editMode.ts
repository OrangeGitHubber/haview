import { signal } from '@preact/signals';
import { navigate } from '../lib/router';

/**
 * Page that should open already in edit mode.
 *
 * A collection's cards live on the collection's own page, so the gear on a
 * collection element edits the *container*, not the cards inside it. This is
 * how "edit the cards in this collection" gets you there in one tap instead of
 * navigating and then hunting for the pencil.
 */
export const editOnArrive = signal<string | null>(null);

export function openPageForEditing(pageId: string): void {
  editOnArrive.value = pageId;
  navigate(pageId);
}
