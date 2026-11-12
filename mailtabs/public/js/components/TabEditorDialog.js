// Create / edit a tab: name, color, which accounts, optional rules, order, delete.
import { html, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, closeDialog, createTab, deleteTab, moveTab, openDialog, updateTab } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { MAX_RULES, MAX_TAB_NAME, RULE_FIELDS, RULE_OPS } from '../constants.js';
import { useUid } from '../hooks.js';
import { Dialog } from './Dialog.js';
import { ColorDot, ColorSwatches, InlineError, nextFreeColor } from './ui.js';

let conditionKey = 0;
const newCondition = (c = {}) => ({ key: ++conditionKey, field: c.field || 'from', op: c.op || 'contains', value: c.value || '' });

function joinList(items) {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** Live, plain-language summary of what the tab will show. */
export function describeTab({ mode, accountIds, accounts, rulesOn, match, conditions }) {
  let source;
  if (mode === 'all') {
    source = 'Shows mail from all your accounts';
  } else {
    const chosen = accounts.filter((a) => accountIds.includes(a.id));
    if (!chosen.length) return 'Pick at least one account — until then this tab stays empty.';
    source = `Shows mail from ${joinList(chosen.map((a) => (a.displayName ? `${a.displayName} (${a.email})` : a.email)))}`;
  }
  const active = rulesOn ? conditions.filter((c) => c.value.trim()) : [];
  if (!active.length) return `${source}.`;
  const parts = active.map((c) => {
    const field = (RULE_FIELDS.find((f) => f.value === c.field) || RULE_FIELDS[0]).label.toLowerCase();
    const op = (RULE_OPS.find((o) => o.value === c.op) || RULE_OPS[0]).label;
    return `${field} ${op} “${c.value.trim()}”`;
  });
  return `${source} where ${parts.join(match === 'all' ? ' and ' : ' or ')}.`;
}

function RuleRow({ cond, index, onChange, onRemove }) {
  const n = index + 1;
  return html`<div class="rule-row">
    <select class="input rule-field" aria-label=${`Condition ${n} field`} value=${cond.field} onChange=${(e) => onChange({ field: e.currentTarget.value })}>
      ${RULE_FIELDS.map((f) => html`<option key=${f.value} value=${f.value}>${f.label}</option>`)}
    </select>
    <select class="input rule-op" aria-label=${`Condition ${n} operator`} value=${cond.op} onChange=${(e) => onChange({ op: e.currentTarget.value })}>
      ${RULE_OPS.map((o) => html`<option key=${o.value} value=${o.value}>${o.label}</option>`)}
    </select>
    <input
      class="input rule-value"
      type="text"
      maxlength="200"
      aria-label=${`Condition ${n} text`}
      placeholder=${cond.field === 'from' ? 'e.g. @company.com' : cond.field === 'subject' ? 'e.g. invoice' : 'text'}
      value=${cond.value}
      onInput=${(e) => onChange({ value: e.currentTarget.value })}
    />
    <button type="button" class="icon-btn rule-remove" aria-label=${`Remove condition ${n}`} title="Remove condition" onClick=${onRemove}>
      <${Icon} name="x" size=${16} />
    </button>
  </div>`;
}

export function TabEditorDialog({ tabId = null, draft = null }) {
  const { tabs, accounts, presets } = useStore((s) => ({ tabs: s.tabs, accounts: s.accounts, presets: s.config.presets }));
  const tab = tabId != null ? tabs.find((t) => t.id === tabId) || null : null;
  const editing = !!tab;
  // `draft`: unsaved edits kept while the user connected another account from this dialog.
  const d = draft || {};

  const [name, setName] = useState(d.name !== undefined ? d.name : tab ? tab.name : '');
  const [color, setColor] = useState(d.color || (tab ? tab.color : nextFreeColor(tabs.map((t) => t.color))));
  const [mode, setMode] = useState(d.mode || (tab && tab.allAccounts ? 'all' : 'some'));
  const [accountIds, setAccountIds] = useState(d.accountIds || (tab ? tab.accountIds || [] : []));
  const initialConds = d.conditions || (tab && tab.rules && Array.isArray(tab.rules.conditions) ? tab.rules.conditions : []);
  const [rulesOn, setRulesOn] = useState(d.rulesOn !== undefined ? d.rulesOn : initialConds.length > 0);
  const [match, setMatch] = useState(d.match || (tab && tab.rules && tab.rules.match) || 'all');
  const [conditions, setConditions] = useState(() => (initialConds.length ? initialConds.map(newCondition) : [newCondition()]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const formId = useUid('tab-form');
  const hintId = useUid('tab-hint');

  const position = tab ? tabs.findIndex((t) => t.id === tab.id) : -1;

  const toggleAccount = (id, on) => setAccountIds((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  const updateCondition = (key, patch) => setConditions((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeCondition = (key) =>
    setConditions((cs) => {
      const next = cs.filter((c) => c.key !== key);
      if (!next.length) setRulesOn(false);
      return next.length ? next : [newCondition()];
    });

  // Keep everything typed so far: the account dialog brings the user back here afterwards,
  // with the new account ticked (it is attached when this tab is saved).
  const connectAccount = () =>
    openDialog('addAccount', {
      returnTo: {
        type: 'tabEditor',
        props: {
          tabId: editing ? tab.id : null,
          draft: { name, color, mode, accountIds, rulesOn, match, conditions: conditions.map(({ field, op, value }) => ({ field, op, value })) },
        },
      },
    });

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    const trimmed = name.trim();
    if (!trimmed) return setError('Give the tab a name.');
    if (trimmed.length > MAX_TAB_NAME) return setError(`Keep the name under ${MAX_TAB_NAME} characters.`);
    const active = rulesOn ? conditions.filter((c) => c.value.trim()) : [];
    const body = {
      name: trimmed,
      color,
      allAccounts: mode === 'all',
      accountIds: accountIds.filter((id) => accounts.some((a) => a.id === id)),
      rules: active.length ? { match, conditions: active.map((c) => ({ field: c.field, op: c.op, value: c.value.trim() })) } : null,
    };
    setBusy(true);
    try {
      if (editing) await updateTab(tab.id, body);
      else await createTab(body);
      closeDialog();
    } catch (err) {
      setError(err.message || "Couldn't save the tab.");
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteTab(tab.id);
      closeDialog();
    } catch (err) {
      setError(err.message || "Couldn't delete the tab.");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (tabId != null && !tab) {
    // The tab vanished (deleted elsewhere) while the dialog was opening.
    return html`<${Dialog} title="Tab not found" onClose=${closeDialog} footer=${html`<button type="button" class="btn" onClick=${closeDialog}>Close</button>`}>
      <p>This tab doesn't exist any more.</p>
    </${Dialog}>`;
  }

  const hint = describeTab({ mode, accountIds, accounts, rulesOn, match, conditions });

  const footer = confirmDelete
    ? html`<div class="confirm-inline" role="alert">
        <span>Delete “${tab.name}”? Your accounts and mail aren't affected.</span>
        <div class="row-gap">
          <button type="button" class="btn btn-ghost" onClick=${() => setConfirmDelete(false)} disabled=${busy} data-autofocus>Keep tab</button>
          <button type="button" class="btn btn-danger" onClick=${onDelete} disabled=${busy}>${busy ? html`<${Spinner} size=${14} />` : null} Delete tab</button>
        </div>
      </div>`
    : html`${editing
          ? html`<button type="button" class="btn btn-ghost btn-danger-text footer-start" onClick=${() => setConfirmDelete(true)}>
              <${Icon} name="trash" size=${15} /> Delete tab
            </button>`
          : null}
        <button type="button" class="btn btn-ghost" onClick=${closeDialog}>Cancel</button>
        <button type="submit" form=${formId} class="btn btn-primary" disabled=${busy}>
          ${busy ? html`<${Spinner} size=${14} />` : null} ${editing ? 'Save tab' : 'Create tab'}
        </button>`;

  return html`<${Dialog} title=${editing ? 'Edit tab' : 'New tab'} onClose=${closeDialog} footer=${footer} size="md" className="tab-editor">
    <form id=${formId} class="form" onSubmit=${onSubmit} aria-describedby=${hintId}>
      <label class="field">
        <span class="field-label">Name</span>
        <input class="input" type="text" required maxlength=${MAX_TAB_NAME} placeholder="e.g. Work" value=${name} onInput=${(e) => setName(e.currentTarget.value)} />
      </label>
      <${ColorSwatches} value=${color} onChange=${setColor} label="Color" />

      <fieldset class="fieldset">
        <legend class="field-label">Which accounts?</legend>
        <label class="radio-row">
          <input type="radio" name=${`${formId}-mode`} checked=${mode === 'all'} onChange=${() => setMode('all')} />
          <span>All accounts <span class="muted">(including ones you add later)</span></span>
        </label>
        <label class="radio-row">
          <input type="radio" name=${`${formId}-mode`} checked=${mode === 'some'} onChange=${() => setMode('some')} />
          <span>Only these:</span>
        </label>
        <div class=${`check-list field-indent ${mode === 'all' ? 'is-disabled' : ''}`}>
          ${accounts.length
            ? accounts.map(
                (a) => html`<label key=${a.id} class="check-row">
                  <input type="checkbox" disabled=${mode === 'all'} checked=${accountIds.includes(a.id)} onChange=${(e) => toggleAccount(a.id, e.currentTarget.checked)} />
                  <${ColorDot} color=${a.color} />
                  <span class="check-label">${accountLabel(a, presets)}</span>
                  <span class="check-note">${a.email}</span>
                </label>`
              )
            : html`<p class="muted small">You haven't connected any accounts yet.</p>`}
          <button type="button" class="link-btn small add-inline" onClick=${connectAccount}>
            <${Icon} name="plus" size=${14} /> Connect another account
          </button>
        </div>
      </fieldset>

      <fieldset class="fieldset">
        <legend class="visually-hidden">Rules</legend>
        <label class="check-row">
          <input type="checkbox" checked=${rulesOn} onChange=${(e) => setRulesOn(e.currentTarget.checked)} />
          <span class="check-label">Only show mail where…</span>
          <span class="check-note">optional</span>
        </label>
        ${rulesOn
          ? html`<div class="rules field-indent">
              <div class="rules-match">
                <span>Match</span>
                <select class="input input-inline" aria-label="Match" value=${match} onChange=${(e) => setMatch(e.currentTarget.value)}>
                  <option value="all">all</option>
                  <option value="any">any</option>
                </select>
                <span>of these conditions</span>
              </div>
              ${conditions.map(
                (c, i) => html`<${RuleRow}
                  key=${c.key}
                  cond=${c}
                  index=${i}
                  onChange=${(patch) => updateCondition(c.key, patch)}
                  onRemove=${() => removeCondition(c.key)}
                />`
              )}
              ${conditions.length < MAX_RULES
                ? html`<button type="button" class="link-btn small add-inline" onClick=${() => setConditions((cs) => [...cs, newCondition()])}>
                    <${Icon} name="plus" size=${14} /> Add condition
                  </button>`
                : html`<p class="muted small">That's the maximum of ${MAX_RULES} conditions.</p>`}
            </div>`
          : null}
      </fieldset>

      <p class="tab-hint" id=${hintId} aria-live="polite"><${Icon} name="info" size=${15} /> <span>${hint}</span></p>

      ${editing && tabs.length > 1
        ? html`<div class="position-row">
            <span class="field-label">Position in the tab bar</span>
            <div class="row-gap">
              <button type="button" class="btn btn-sm" disabled=${position <= 0} onClick=${() => moveTab(tab.id, -1)} aria-label="Move tab left">
                <${Icon} name="chevronLeft" size=${14} /> Move left
              </button>
              <span class="muted small" aria-live="polite">${position + 1} of ${tabs.length}</span>
              <button type="button" class="btn btn-sm" disabled=${position >= tabs.length - 1} onClick=${() => moveTab(tab.id, 1)} aria-label="Move tab right">
                Move right <${Icon} name="chevronRight" size=${14} />
              </button>
            </div>
          </div>`
        : null}

      <${InlineError} message=${error} />
    </form>
  </${Dialog}>`;
}
