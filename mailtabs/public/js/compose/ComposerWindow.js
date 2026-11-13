// One composer: header, From/To/Cc/Bcc/Subject, rich-text body, attachments, send/schedule.
// Desktop: a docked window (minimise/maximise/close). Phones: a full-screen sheet.
import { html, useEffect, useLayoutEffect, useMemo, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { reconnectAccount } from '../actions.js';
import { Spinner } from '../icons.js';
import { useOutsideClick, useUid } from '../hooks.js';
import { CIcon } from './compose-icons.js';
import { EditorSurface, EditorController, FormatToolbar, MOD_KEY } from './editor.js';
import { RecipientField } from './RecipientField.js';
import {
  addFiles,
  canSendFrom,
  closeComposer,
  discardComposer,
  editComposer,
  ensureAccount,
  expandQuote,
  focusComposer,
  markChanged,
  maximizeComposer,
  minimizeComposer,
  registerEditor,
  removeAttachment,
  resolveConfirm,
  retryAttachment,
  retryLoad,
  saveDraft,
  sendBlockReason,
  sendComposer,
  setFrom,
  sheetBack,
} from './compose.js';
import {
  LIMITS,
  composerTitle,
  formatBytes,
  formatSendTime,
  isImageType,
  parseLocalInputValue,
  scheduleOptions,
  toLocalInputValue,
  validateSendAt,
} from './compose-utils.js';

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

function senderLabel(account, user) {
  const name = (account.senderName || (user && user.name) || '').trim();
  return name ? `${name} <${account.email}>` : account.email;
}

// ------------------------------------------------------------------------------- small parts

function FromRow({ model, accounts, user, disabled }) {
  const uid = useUid('cmp-from');
  const current = accounts.find((a) => a.id === model.accountId);
  return html`<div class="cmp-row cmp-from">
    <label class="cmp-row-label" for=${uid}>From</label>
    <span class="cmp-from-dot" style=${{ background: (current && current.color) || 'var(--text-3)' }} aria-hidden="true"></span>
    <select
      id=${uid}
      class="cmp-from-select"
      value=${model.accountId == null ? '' : String(model.accountId)}
      disabled=${disabled}
      onChange=${(e) => setFrom(model.id, Number(e.currentTarget.value))}
    >
      ${model.accountId == null ? html`<option value="" disabled>Choose an account</option>` : null}
      ${accounts.map((a) => {
        const reason = sendBlockReason(a);
        return html`<option key=${a.id} value=${String(a.id)} disabled=${!!reason && a.id !== model.accountId}>
          ${senderLabel(a, user)}${reason ? ` — ${reason}` : ''}
        </option>`;
      })}
    </select>
  </div>`;
}

function SendBlockedBanner({ account }) {
  const reason = sendBlockReason(account);
  if (!reason) return null;
  return html`<div class="cmp-banner is-warning" role="status">
    <${CIcon} name="alert" size=${16} />
    <span>Sending isn't set up for <strong>${account.email}</strong> yet. You can still save this as a draft.</span>
    <button type="button" class="btn btn-sm" onClick=${() => reconnectAccount(account)}>${reason}</button>
  </div>`;
}

function Notice({ model }) {
  if (!model.notice) return null;
  return html`<div class=${`cmp-banner ${model.notice.type === 'error' ? 'is-error' : 'is-info'}`} role=${model.notice.type === 'error' ? 'alert' : 'status'}>
    <${CIcon} name=${model.notice.type === 'error' ? 'alert' : 'info'} size=${16} />
    <span>${model.notice.text}</span>
    <button type="button" class="icon-btn cmp-banner-x" aria-label="Dismiss" onClick=${() => editComposer(model.id, { notice: null }, { changed: false })}>
      <${CIcon} name="x" size=${14} />
    </button>
  </div>`;
}

function ConfirmStrip({ model }) {
  const ref = useRef(null);
  const c = model.confirm;
  useEffect(() => {
    if (!c || !ref.current) return;
    const btn = ref.current.querySelector('[data-autofocus]') || ref.current.querySelector('button');
    if (btn) btn.focus();
  }, [c && c.kind, c && c.text]);
  if (!c) return null;
  const safeIndex = c.actions.findIndex((a) => a.id === 'keep');
  return html`<div ref=${ref} class="cmp-confirm" role="alertdialog" aria-label="Confirm" aria-describedby=${`${model.id}-confirm-text`}>
    <p class="cmp-confirm-text" id=${`${model.id}-confirm-text`}>${c.text}</p>
    <div class="cmp-confirm-actions">
      ${c.actions.map(
        (a, i) => html`<button
          key=${a.id}
          type="button"
          class=${`btn btn-sm ${a.primary ? 'btn-primary' : a.danger ? 'btn-ghost btn-danger-text' : 'btn-ghost'}`}
          data-autofocus=${i === (safeIndex >= 0 ? safeIndex : 0) ? '' : undefined}
          onClick=${() => resolveConfirm(model.id, a.id)}
        >
          ${a.label}
        </button>`
      )}
    </div>
  </div>`;
}

function Attachments({ model }) {
  const ref = useRef(null);
  const count = useRef(model.attachments.length);
  // Bring newly added files into view (the body may be long).
  useEffect(() => {
    const grew = model.attachments.length > count.current;
    count.current = model.attachments.length;
    const last = grew && ref.current && ref.current.lastElementChild;
    if (last && typeof last.scrollIntoView === 'function') last.scrollIntoView({ block: 'nearest' });
  }, [model.attachments.length]);
  if (!model.attachments.length) return null;
  return html`<ul ref=${ref} class="cmp-atts" aria-label="Attachments">
    ${model.attachments.map((a) => {
      const pct = Math.round((a.progress || 0) * 100);
      const name = a.filename || 'Attachment';
      let meta = formatBytes(a.size);
      if (a.status === 'uploading') meta = `Uploading… ${pct}%`;
      else if (a.status === 'error') meta = a.error || "Couldn't upload";
      else if (!a.filename) meta = 'Loading…';
      return html`<li key=${a.key} class=${`cmp-att is-${a.status}`}>
        <span class="cmp-att-icon" aria-hidden="true"><${CIcon} name=${a.status === 'error' ? 'alert' : isImageType(a.contentType) ? 'image' : 'file'} size=${16} /></span>
        <span class="cmp-att-text">
          <span class="cmp-att-name" title=${name}>${name}</span>
          <span class="cmp-att-meta">${meta}</span>
          ${a.status === 'uploading'
            ? html`<span class="cmp-att-bar" role="progressbar" aria-label=${`Uploading ${name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct}>
                <span class="cmp-att-fill" style=${{ width: `${pct}%` }}></span>
              </span>`
            : null}
        </span>
        ${a.status === 'error' && a.file
          ? html`<button type="button" class="icon-btn cmp-att-btn" aria-label=${`Try uploading ${name} again`} title="Try again" onClick=${() => retryAttachment(model.id, a.key)}>
              <${CIcon} name="refresh" size=${15} />
            </button>`
          : null}
        <button type="button" class="icon-btn cmp-att-btn" aria-label=${`Remove ${name}`} title="Remove" onClick=${() => removeAttachment(model.id, a.key)}>
          <${CIcon} name="x" size=${15} />
        </button>
      </li>`;
    })}
  </ul>`;
}

function SaveStatus({ model }) {
  const s = model.saveState;
  if (s === 'saving') return html`<span class="cmp-status">Saving…</span>`;
  if (s === 'saved') {
    const at = model.savedAt ? new Date(model.savedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    return html`<span class="cmp-status" title=${at ? `Draft saved at ${at}` : 'Draft saved'}>Saved</span>`;
  }
  if (s === 'error') {
    return html`<button type="button" class="cmp-status is-error" title=${model.saveError || ''} onClick=${() => saveDraft(model.id)}>
      Not saved · Retry
    </button>`;
  }
  return html`<span class="cmp-status"></span>`;
}

function ScheduleMenu({ onPick, onCustom, onClose, anchorRef }) {
  const ref = useRef(null);
  const options = useMemo(() => scheduleOptions(Date.now()), []);
  useOutsideClick([ref, anchorRef], onClose, true);
  useLayoutEffect(() => {
    const first = ref.current && ref.current.querySelector('[role=menuitem]');
    if (first) first.focus();
  }, []);
  const onKeyDown = (e) => {
    const items = Array.from(ref.current.querySelectorAll('[role=menuitem]'));
    const i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length];
      if (next) next.focus();
    } else if (e.key === 'Tab') {
      onClose();
    }
  };
  return html`<div ref=${ref} class="cmp-menu" role="menu" aria-label="Schedule send" onKeyDown=${onKeyDown}>
    <div class="cmp-menu-title" aria-hidden="true">Schedule send</div>
    ${options.map(
      (o) => html`<button key=${o.id} type="button" role="menuitem" class="cmp-menu-item" onClick=${() => onPick(o.at)}>
        <${CIcon} name="clock" size=${15} />
        <span class="cmp-menu-label">${o.label}</span>
        <span class="cmp-menu-hint">${formatSendTime(o.at)}</span>
      </button>`
    )}
    <button type="button" role="menuitem" class="cmp-menu-item" onClick=${onCustom}>
      <${CIcon} name="clock" size=${15} />
      <span class="cmp-menu-label">Pick date & time…</span>
    </button>
  </div>`;
}

function CustomSchedule({ onSchedule, onCancel }) {
  const [value, setValue] = useState(() => toLocalInputValue(scheduleOptions(Date.now())[0].at));
  const [error, setError] = useState('');
  const uid = useUid('cmp-sched');
  const ref = useRef(null);
  useLayoutEffect(() => {
    const input = ref.current && ref.current.querySelector('input');
    if (input) input.focus();
  }, []);
  const submit = () => {
    const at = parseLocalInputValue(value);
    const problem = validateSendAt(at);
    if (problem) {
      setError(problem);
      return;
    }
    onSchedule(at);
  };
  const now = Date.now();
  return html`<div
    ref=${ref}
    class="cmp-schedule"
    role="group"
    aria-labelledby=${`${uid}-label`}
    onKeyDown=${(e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      }
    }}
  >
    <label class="cmp-schedule-field">
      <span id=${`${uid}-label`} class="cmp-schedule-label">Send at</span>
      <input
        class=${`input input-inline ${error ? 'is-invalid' : ''}`}
        type="datetime-local"
        value=${value}
        min=${toLocalInputValue(now + 60_000)}
        max=${toLocalInputValue(now + LIMITS.maxScheduleMs)}
        aria-invalid=${error ? 'true' : 'false'}
        onInput=${(e) => {
          setValue(e.currentTarget.value);
          setError('');
        }}
      />
    </label>
    ${error ? html`<span class="cmp-schedule-error" role="alert">${error}</span>` : html`<span class="cmp-schedule-hint">${Number.isFinite(parseLocalInputValue(value)) ? formatSendTime(parseLocalInputValue(value)) : ''}</span>`}
    <span class="cmp-schedule-actions">
      <button type="button" class="btn btn-sm btn-ghost" onClick=${onCancel}>Cancel</button>
      <button type="button" class="btn btn-sm btn-primary" onClick=${submit}>Schedule send</button>
    </span>
  </div>`;
}

function MoreMenu({ items, onClose, anchorRef }) {
  const ref = useRef(null);
  useOutsideClick([ref, anchorRef], onClose, true);
  useLayoutEffect(() => {
    const first = ref.current && ref.current.querySelector('[role=menuitem]');
    if (first) first.focus();
  }, []);
  return html`<div
    ref=${ref}
    class="cmp-menu cmp-menu-down"
    role="menu"
    aria-label="More options"
    onKeyDown=${(e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose(true);
      }
    }}
  >
    ${items.map(
      (it) => html`<button
        key=${it.id}
        type="button"
        role="menuitem"
        class=${`cmp-menu-item ${it.danger ? 'is-danger' : ''}`}
        onClick=${(e) => {
          // The window re-renders between listeners of a real click (e.g. into a minimised
          // header with its own click handler), so don't let this click travel any further.
          e.stopPropagation();
          onClose();
          it.run();
        }}
      >
        <${CIcon} name=${it.icon} size=${15} />
        <span class="cmp-menu-label">${it.label}</span>
      </button>`
    )}
  </div>`;
}

// ------------------------------------------------------------------------------- window

export function ComposerWindow({ model, mobile }) {
  const { accounts, user } = useStore((s) => ({ accounts: s.accounts, user: s.user }));
  const id = model.id;
  const rootRef = useRef(null);
  const fileRef = useRef(null);
  const menuBtnRef = useRef(null);
  const moreBtnRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [showFormatting, setShowFormatting] = useState(!mobile);
  const [dragDepth, setDragDepth] = useState(0);
  const titleId = useUid('cmp-title');

  const controller = useMemo(
    () =>
      new EditorController({
        onChange: () => markChanged(id),
        onFiles: (files) => addFiles(id, files),
      }),
    [id]
  );
  useEffect(
    () =>
      registerEditor(id, {
        getHtml: () => controller.getHtml(),
        getText: () => controller.getText(),
        swapSignature: (sig) => controller.swapSignature(sig),
        appendQuote: (quote) => controller.appendQuote(quote),
        focus: (where) => controller.focus(where),
      }),
    [id, controller]
  );

  const ready = model.status === 'ready';
  const sheet = mobile && !model.minimized;
  const account = accounts.find((a) => a.id === model.accountId) || null;
  const title = composerTitle(model.payloadMode === 'new' ? model.mode : model.payloadMode, model.subject);
  const busy = model.sending || model.closing;

  useEffect(() => {
    if (ready && accounts.length) ensureAccount(id);
  }, [ready, accounts, model.accountId]);

  // Move focus where the controller asked (To for a new message, the body for replies).
  useEffect(() => {
    if (!ready || model.minimized || !model.focusSeq) return undefined;
    const t = setTimeout(() => {
      const root = rootRef.current;
      if (!root) return;
      if (model.focusTarget === 'to') {
        const input = root.querySelector('[data-field="to"] .chip-input');
        if (input) input.focus();
      } else {
        controller.focus('start');
      }
    }, 40);
    return () => clearTimeout(t);
  }, [model.focusSeq, ready, model.minimized]);

  // The sheet is modal on phones: keep Tab inside it.
  const trapFocus = (e) => {
    const root = rootRef.current;
    if (!sheet || !root) return;
    const items = Array.from(root.querySelectorAll(FOCUSABLE)).filter((el) => el.tabIndex >= 0 && (el.offsetParent !== null || el === document.activeElement));
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onKeyDown = (e) => {
    // App-wide single-key shortcuts (archive, delete, ...) must never fire from inside a composer.
    e.stopPropagation();
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      sendComposer(id);
    } else if (e.key === 'Escape' && !e.defaultPrevented) {
      e.preventDefault();
      if (model.confirm) resolveConfirm(id, 'keep');
      else if (customOpen) setCustomOpen(false);
      else if (model.maximized) maximizeComposer(id, false);
      else if (mobile) sheetBack();
      else minimizeComposer(id, true);
    } else if (e.key === 'Tab') {
      trapFocus(e);
    }
  };

  const hasFiles = (e) => !!(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files'));
  const onDragEnter = (e) => {
    if (!ready || !hasFiles(e)) return;
    e.preventDefault();
    setDragDepth((d) => d + 1);
  };
  const onDragOver = (e) => {
    if (!ready || !hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e) => {
    if (!hasFiles(e)) return;
    setDragDepth((d) => Math.max(0, d - 1));
  };
  const onDrop = (e) => {
    setDragDepth(0);
    if (!ready || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
    e.preventDefault();
    addFiles(id, e.dataTransfer.files);
  };

  const pickFiles = () => {
    if (fileRef.current) fileRef.current.click();
  };
  const send = () => sendComposer(id);
  const schedule = (at) => {
    setMenuOpen(false);
    setCustomOpen(false);
    sendComposer(id, { sendAt: at });
  };

  const classes = [
    'cmp',
    model.minimized ? 'is-min' : 'is-open',
    model.maximized && !mobile ? 'is-max' : '',
    sheet ? 'is-sheet' : '',
    dragDepth > 0 ? 'is-dragging' : '',
  ].join(' ');

  const headButton = (label, icon, onClick, extra = '') => html`<button
    type="button"
    class=${`cmp-head-btn ${extra}`}
    aria-label=${label}
    title=${label}
    onClick=${(e) => {
      e.stopPropagation();
      onClick();
    }}
  >
    <${CIcon} name=${icon} size=${16} />
  </button>`;

  const header = sheet
    ? html`<header class="cmp-head is-mobile">
        <button type="button" class="cmp-head-btn" aria-label="Back" onClick=${() => sheetBack()}><${CIcon} name="arrowLeft" size=${20} /></button>
        <h2 class="cmp-title" id=${titleId}>${title}</h2>
        ${ready ? headButton('Attach files', 'paperclip', pickFiles) : null}
        ${ready
          ? html`<button type="button" class="cmp-send-icon" aria-label="Send" title="Send" disabled=${busy} onClick=${send}>
              ${model.sending ? html`<${Spinner} size=${16} />` : html`<${CIcon} name="send" size=${18} />`}
            </button>`
          : null}
        <span class="cmp-more-wrap">
          <button
            ref=${moreBtnRef}
            type="button"
            class="cmp-head-btn"
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded=${moreOpen ? 'true' : 'false'}
            onClick=${() => setMoreOpen((o) => !o)}
          >
            <${CIcon} name="dots" size=${18} />
          </button>
          ${moreOpen
            ? html`<${MoreMenu}
                anchorRef=${moreBtnRef}
                onClose=${() => setMoreOpen(false)}
                items=${[
                  ...(ready ? [{ id: 'schedule', label: 'Schedule send', icon: 'clock', run: () => setCustomOpen(true) }] : []),
                  { id: 'min', label: 'Minimise', icon: 'chevronDown', run: () => minimizeComposer(id, true) },
                  ...(ready ? [{ id: 'discard', label: 'Discard draft', icon: 'trash', danger: true, run: () => discardComposer(id) }] : []),
                ]}
              />`
            : null}
        </span>
      </header>`
    : html`<header
        class="cmp-head"
        onClick=${(e) => {
          if (e.target.closest && e.target.closest('button, [role=menu]')) return;
          if (model.minimized) focusComposer(id);
          else minimizeComposer(id, true);
        }}
        title=${model.minimized ? 'Open' : 'Minimise'}
      >
        <h2 class="cmp-title" id=${titleId}>${title}</h2>
        ${model.minimized && model.saveState === 'saving' ? html`<${Spinner} size=${12} />` : null}
        <div class="cmp-head-actions">
          ${model.minimized ? headButton('Open', 'chevronUp', () => focusComposer(id)) : headButton('Minimise', 'minus', () => minimizeComposer(id, true))}
          ${!model.minimized && !mobile
            ? headButton(model.maximized ? 'Exit full screen' : 'Full screen', model.maximized ? 'minimize' : 'maximize', () => maximizeComposer(id, !model.maximized))
            : null}
          ${headButton('Close (saves a draft)', 'x', () => closeComposer(id))}
        </div>
      </header>`;

  let body;
  if (model.status === 'loading') {
    body = html`<div class="cmp-loading" aria-busy="true">
      <${Spinner} size=${18} label="Loading" />
      <span>Getting the message ready…</span>
    </div>`;
  } else if (model.status === 'error') {
    body = html`<div class="cmp-loading is-error" role="alert">
      <${CIcon} name="alert" size=${20} />
      <span>${model.error || "Couldn't open this message."}</span>
      <div class="row-gap">
        <button type="button" class="btn btn-sm" onClick=${() => retryLoad(id)}>Try again</button>
        <button type="button" class="btn btn-sm btn-ghost" onClick=${() => closeComposer(id)}>Close</button>
      </div>
    </div>`;
  } else {
    const senders = accounts.length > 1 || (account && !canSendFrom(account)) || model.accountId == null;
    body = html`
      <div class="cmp-fields">
        ${senders ? html`<${FromRow} model=${model} accounts=${accounts} user=${user} disabled=${busy} />` : null}
        <${RecipientField} composerId=${id} field="to" label="To" recipients=${model.to} disabled=${busy} onChange=${(to) => editComposer(id, { to, notice: null })}>
          <span class="cmp-cc-toggles">
            ${!model.showCc ? html`<button type="button" class="cmp-link-btn" onClick=${() => editComposer(id, { showCc: true }, { changed: false })}>Cc</button>` : null}
            ${!model.showBcc ? html`<button type="button" class="cmp-link-btn" onClick=${() => editComposer(id, { showBcc: true }, { changed: false })}>Bcc</button>` : null}
          </span>
        <//>
        ${model.showCc
          ? html`<${RecipientField} composerId=${id} field="cc" label="Cc" recipients=${model.cc} disabled=${busy} onChange=${(cc) => editComposer(id, { cc, notice: null })} />`
          : null}
        ${model.showBcc
          ? html`<${RecipientField} composerId=${id} field="bcc" label="Bcc" recipients=${model.bcc} disabled=${busy} onChange=${(bcc) => editComposer(id, { bcc, notice: null })} />`
          : null}
        <div class="cmp-row">
          <label class="visually-hidden" for=${`${id}-subject`}>Subject</label>
          <input
            id=${`${id}-subject`}
            class="cmp-subject"
            type="text"
            placeholder="Subject"
            maxlength=${LIMITS.maxSubject}
            autocomplete="off"
            value=${model.subject}
            disabled=${busy}
            onInput=${(e) => editComposer(id, { subject: e.currentTarget.value })}
          />
        </div>
      </div>
      ${account ? html`<${SendBlockedBanner} account=${account} />` : null}
      <${Notice} model=${model} />
      <div class="cmp-scroll">
        <${EditorSurface} controller=${controller} html=${model.bodyHtml} version=${model.bodyVersion} label="Message body" className="cmp-editor" />
        ${model.quoteCollapsed
          ? html`<button type="button" class="cmp-quote-toggle" aria-label="Show quoted text" title="Show trimmed content" aria-expanded="false" onClick=${() => expandQuote(id)}>
              <span aria-hidden="true">•••</span>
            </button>`
          : null}
        <${Attachments} model=${model} />
        <div class="cmp-scroll-fill" aria-hidden="true" onMouseDown=${(e) => {
          e.preventDefault();
          controller.focus('end');
        }}></div>
      </div>
      ${showFormatting ? html`<${FormatToolbar} controller=${controller} className="cmp-toolbar" compact=${mobile} />` : null}
      ${customOpen ? html`<${CustomSchedule} onSchedule=${schedule} onCancel=${() => setCustomOpen(false)} />` : null}
      <${ConfirmStrip} model=${model} />
      <footer class="cmp-foot">
        ${sheet
          ? null
          : html`<div class="cmp-send-group">
              <button type="button" class="btn btn-primary cmp-send" disabled=${busy} title=${`Send (${MOD_KEY}Enter)`} onClick=${send}>
                ${model.sending ? html`<${Spinner} size=${14} /> Sending…` : 'Send'}
              </button>
              <button
                ref=${menuBtnRef}
                type="button"
                class="btn btn-primary cmp-send-more"
                aria-label="Schedule send"
                title="Schedule send"
                aria-haspopup="menu"
                aria-expanded=${menuOpen ? 'true' : 'false'}
                disabled=${busy}
                onClick=${() => setMenuOpen((o) => !o)}
              >
                <${CIcon} name="chevronDown" size=${16} />
              </button>
              ${menuOpen
                ? html`<${ScheduleMenu}
                    anchorRef=${menuBtnRef}
                    onPick=${schedule}
                    onCustom=${() => {
                      setMenuOpen(false);
                      setCustomOpen(true);
                    }}
                    onClose=${(refocus) => {
                      setMenuOpen(false);
                      if (refocus && menuBtnRef.current) menuBtnRef.current.focus();
                    }}
                  />`
                : null}
            </div>`}
        <button
          type="button"
          class=${`icon-btn cmp-foot-btn ${showFormatting ? 'is-on' : ''}`}
          aria-label="Formatting options"
          title="Formatting options"
          aria-pressed=${showFormatting ? 'true' : 'false'}
          onClick=${() => setShowFormatting((v) => !v)}
        >
          <${CIcon} name="textFormat" size=${17} />
        </button>
        ${sheet ? null : html`<button type="button" class="icon-btn cmp-foot-btn" aria-label="Attach files" title="Attach files" disabled=${busy} onClick=${pickFiles}><${CIcon} name="paperclip" size=${17} /></button>`}
        <${SaveStatus} model=${model} />
        <span class="spacer"></span>
        <button type="button" class="icon-btn cmp-foot-btn cmp-discard" aria-label="Discard draft" title="Discard draft" disabled=${model.sending} onClick=${() => discardComposer(id)}>
          <${CIcon} name="trash" size=${17} />
        </button>
      </footer>
      <input
        ref=${fileRef}
        type="file"
        multiple
        class="visually-hidden"
        tabindex="-1"
        aria-hidden="true"
        onChange=${(e) => {
          addFiles(id, e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
      ${dragDepth > 0
        ? html`<div class="cmp-drop" aria-hidden="true">
            <${CIcon} name="upload" size=${26} />
            <span>Drop files to attach</span>
          </div>`
        : null}
    `;
  }

  return html`<section
    ref=${rootRef}
    class=${classes}
    role="dialog"
    aria-modal=${sheet ? 'true' : 'false'}
    aria-labelledby=${titleId}
    data-composer=${id}
    onKeyDown=${onKeyDown}
    onDragEnter=${onDragEnter}
    onDragOver=${onDragOver}
    onDragLeave=${onDragLeave}
    onDrop=${onDrop}
  >
    ${header}
    <div class="cmp-body" hidden=${model.minimized}>${body}</div>
  </section>`;
}
