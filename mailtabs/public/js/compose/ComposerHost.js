// Renders every open composer (mounted once by MainLayout) and the send/undo snackbar.
// Desktop: windows docked bottom-right (oldest on the right), one can be maximised.
// Phones: the open composer is a full-screen sheet with a history entry; others wait as pills.
import { html, useEffect, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { MOBILE_QUERY } from '../constants.js';
import { Spinner } from '../icons.js';
import { useMediaQuery, useNow } from '../hooks.js';
import { CIcon } from './compose-icons.js';
import { ComposerWindow } from './ComposerWindow.js';
import {
  composerOwner,
  dismissSnack,
  ensureComposerOwner,
  fitComposers,
  maximizeComposer,
  retrySend,
  syncSheetHistory,
  undoSend,
  useComposerStore,
} from './compose.js';

let hosts = 0;

function Snackbar({ snack }) {
  const now = useNow(500);
  if (!snack) return null;
  const left = snack.sendAt ? Math.max(0, Math.ceil((snack.sendAt - now) / 1000)) : 0;
  const canUndo = (snack.kind === 'sending' && left > 0) || snack.kind === 'scheduled';
  const alert = snack.kind === 'failed' || snack.kind === 'retrying';
  let text = snack.text;
  if (snack.kind === 'sending') text = left > 0 ? `Sending in ${left} s…` : 'Sending…';
  const icon =
    snack.kind === 'sending' ? html`<${Spinner} size=${14} />` : html`<${CIcon} name=${alert ? 'alert' : snack.kind === 'scheduled' ? 'clock' : 'check'} size=${16} />`;
  return html`<div class=${`cmp-snack is-${snack.kind}`} role=${alert ? 'alert' : undefined}>
    <span class="cmp-snack-icon" aria-hidden="true">${icon}</span>
    <span class="cmp-snack-text">
      <span aria-hidden=${snack.kind === 'sending' ? 'true' : undefined}>${text}</span>
      ${snack.kind === 'sending' ? html`<span class="visually-hidden">Sending your message. You can undo for a few seconds.</span>` : null}
    </span>
    ${canUndo
      ? html`<button type="button" class="cmp-snack-btn" disabled=${!!snack.busy} onClick=${() => undoSend(snack.outboxId)}>Undo</button>`
      : null}
    ${snack.kind === 'failed' && snack.outboxId != null
      ? html`<button type="button" class="cmp-snack-btn" onClick=${() => retrySend(snack.outboxId)}>Retry</button>`
      : null}
    <button type="button" class="cmp-snack-x" aria-label="Dismiss" onClick=${() => dismissSnack(snack.id)}>
      <${CIcon} name="x" size=${14} />
    </button>
  </div>`;
}

export function ComposerHost() {
  // Only the first mounted host renders, so an accidental second mount can't duplicate windows.
  const [primary] = useState(() => {
    hosts += 1;
    return hosts === 1;
  });
  useEffect(
    () => () => {
      hosts -= 1;
    },
    []
  );
  const allComposers = useComposerStore((s) => s.composers);
  const ownSnack = useComposerStore((s) => s.snack);
  const userId = useStore((s) => (s.user ? s.user.id : null));
  const mobile = useMediaQuery(MOBILE_QUERY);

  // Composers belong to the user who opened them: whoever is signed in now never sees anybody
  // else's (e.g. after a session expired and another person signed in); those are dropped.
  const owned = userId != null && composerOwner() === userId;
  const composers = owned ? allComposers : [];
  const snack = owned ? ownSnack : null;
  useEffect(() => {
    ensureComposerOwner(userId);
  }, [userId]);

  useEffect(() => {
    if (!primary) return undefined;
    const onResize = () => fitComposers(window.innerWidth, mobile);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mobile, primary]);

  const sheetOpen = mobile && composers.some((c) => !c.minimized);
  useEffect(() => {
    if (!primary) return undefined;
    syncSheetHistory(mobile);
    document.documentElement.classList.toggle('cmp-sheet-open', sheetOpen);
    document.documentElement.classList.toggle('cmp-docked', !mobile && composers.length > 0);
    document.documentElement.classList.toggle('cmp-has-snack', !!snack);
    document.documentElement.classList.toggle('cmp-has-pills', mobile && composers.some((c) => c.minimized));
    return undefined;
  });
  useEffect(
    () => () => {
      document.documentElement.classList.remove('cmp-sheet-open');
      document.documentElement.classList.remove('cmp-docked');
      document.documentElement.classList.remove('cmp-has-snack');
      document.documentElement.classList.remove('cmp-has-pills');
    },
    []
  );

  if (!primary) return null;
  const maximized = !mobile && composers.find((c) => c.maximized && !c.minimized);
  return html`<div class="cmp-host">
    <div class=${`cmp-dock ${mobile ? 'is-mobile' : ''}`}>
      ${maximized ? html`<div class="cmp-backdrop" aria-hidden="true" onClick=${() => maximizeComposer(maximized.id, false)}></div>` : null}
      ${composers.map((c) => html`<${ComposerWindow} key=${c.id} model=${c} mobile=${mobile} />`)}
    </div>
    <div class="cmp-snack-wrap" aria-live="polite">
      <${Snackbar} snack=${snack} />
    </div>
  </div>`;
}
