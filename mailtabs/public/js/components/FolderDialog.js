// Create, rename, delete and empty folders (on the mail server itself).
import { html, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { accountLabel, closeDialog, createFolder, deleteFolder, emptyFolders, openDialog, renameFolder } from '../actions.js';
import { Icon, Spinner } from '../icons.js';
import { plural } from '../format.js';
import { useUid } from '../hooks.js';
import { Dialog } from './Dialog.js';
import { ColorDot, InlineError } from './ui.js';
import { folderLabel, folderPathLabel, parentOptions, validateFolderName } from './navModel.js';

function delimiterFor(folders, accountId, parent) {
  if (parent && parent.delimiter) return parent.delimiter;
  const any = folders.find((f) => f.accountId === accountId && f.delimiter);
  return any ? any.delimiter : '/';
}

function siblingsOf(folders, accountId, parentPath) {
  return folders.filter((f) => f.accountId === accountId && (f.parentPath || null) === (parentPath || null)).map((f) => f.name);
}

/** Folder and everything below it. */
function subtree(folders, folder) {
  const prefix = `${folder.path}${folder.delimiter || '/'}`;
  return folders.filter((f) => f.accountId === folder.accountId && (f.id === folder.id || f.path.startsWith(prefix)));
}

function NameForm({ mode, folder, accountId, parentId: initialParent, initialName = '', returnTo }) {
  const { folders, accounts, presets } = useStore((s) => ({ folders: s.folders, accounts: s.accounts, presets: s.config.presets }));
  const create = mode === 'create';
  const acctId = create ? accountId : folder.accountId;
  const account = accounts.find((a) => a.id === acctId) || null;
  const [name, setName] = useState(create ? initialName : folder.name);
  const [parentId, setParentId] = useState(initialParent ? String(initialParent) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const formId = useUid('folder-form');
  const nameId = useUid('folder-name');

  const parents = parentOptions(folders, acctId);
  const parent = create ? folders.find((f) => String(f.id) === parentId) || null : null;
  const delimiter = create ? delimiterFor(folders, acctId, parent) : folder.delimiter || '/';
  const parentPath = create ? (parent ? parent.path : null) : folder.parentPath;

  const leave = () => (returnTo ? openDialog(returnTo.type, returnTo.props) : closeDialog());

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    const problem = validateFolderName(trimmed, { delimiter, siblings: siblingsOf(folders, acctId, parentPath), current: create ? null : folder.name });
    if (problem) return setError(problem);
    if (!create && trimmed === folder.name) return closeDialog();
    setBusy(true);
    setError('');
    try {
      if (create) await createFolder({ accountId: acctId, name: trimmed, parentId: parent ? parent.id : null });
      else await renameFolder(folder.id, trimmed);
      leave();
    } catch (err) {
      setError(err.message || (create ? "Couldn't create the folder." : "Couldn't rename the folder."));
      setBusy(false);
    }
  };

  const footer = html`<button type="button" class="btn btn-ghost" onClick=${leave} disabled=${busy}>Cancel</button>
    <button type="submit" form=${formId} class="btn btn-primary" disabled=${busy}>
      ${busy ? html`<${Spinner} size=${14} />` : null} ${create ? 'Create folder' : 'Rename'}
    </button>`;

  return html`<${Dialog} title=${create ? 'New folder' : `Rename “${folderLabel(folder)}”`} onClose=${() => !busy && leave()} footer=${footer} size="sm" className="folder-dialog">
    <form id=${formId} class="form" onSubmit=${onSubmit}>
      ${account
        ? html`<p class="move-account"><${ColorDot} color=${account.color} /> ${accountLabel(account, presets)} · <span class="muted">${account.email}</span></p>`
        : null}
      <label class="field" for=${nameId}>
        <span class="field-label">Name</span>
        <input
          id=${nameId}
          class="input"
          type="text"
          maxlength="100"
          autocomplete="off"
          spellcheck=${false}
          value=${name}
          onInput=${(e) => {
            setName(e.currentTarget.value);
            if (error) setError('');
          }}
          data-autofocus
        />
      </label>
      ${create
        ? html`<label class="field">
            <span class="field-label">Inside</span>
            <select class="input" value=${parentId} onChange=${(e) => setParentId(e.currentTarget.value)}>
              <option value="">Top level</option>
              ${parents.map((f) => html`<option key=${f.id} value=${String(f.id)}>${folderPathLabel(f)}</option>`)}
            </select>
          </label>`
        : null}
      <p class="field-hint">The folder is ${create ? 'created' : 'renamed'} on the mail server, so your other mail apps see it too.</p>
      <${InlineError} message=${error} />
    </form>
  </${Dialog}>`;
}

function DeleteForm({ folder }) {
  const folders = useStore((s) => s.folders);
  const tree = subtree(folders, folder);
  const known = tree.reduce((n, f) => n + (f.totalCount || 0), 0);
  const [count, setCount] = useState(known); // what we know (or the server told us) is inside
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const children = tree.length - 1;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      // Only force when the user has seen how many messages go with it.
      await deleteFolder(folder.id, { force: count !== 0 });
      closeDialog();
    } catch (err) {
      if (err.code === 'FOLDER_NOT_EMPTY') {
        // -1: the server didn't say how many.
        setCount(Number(err.data && err.data.count) || -1);
        setError('');
      } else setError(err.message || "Couldn't delete the folder.");
      setBusy(false);
    }
  };

  const footer = html`<button type="button" class="btn btn-ghost" onClick=${closeDialog} disabled=${busy} data-autofocus>Cancel</button>
    <button type="button" class="btn btn-danger" onClick=${confirm} disabled=${busy}>
      ${busy ? html`<${Spinner} size=${14} />` : null} ${count !== 0 ? 'Delete folder and messages' : 'Delete folder'}
    </button>`;

  return html`<${Dialog}
    title=${`Delete “${folderLabel(folder)}”?`}
    onClose=${() => !busy && closeDialog()}
    footer=${footer}
    size="sm"
    className="folder-dialog"
    titleIcon=${html`<span class="dialog-title-icon is-danger"><${Icon} name="alert" size=${18} /></span>`}
  >
    <div class="stack">
      <p class="confirm-text">
        ${count !== 0
          ? html`<strong>${folderPathLabel(folder)}</strong> ${children ? `and its ${plural(children, 'subfolder')} contain` : 'contains'} ${count > 0 ? plural(count, 'message') : 'messages'}. They'll be deleted from the mail server with the folder. This can't be undone.`
          : html`<strong>${folderPathLabel(folder)}</strong>${children ? ` and its ${plural(children, 'subfolder')}` : ''} will be deleted from the mail server.`}
      </p>
      <${InlineError} message=${error} />
    </div>
  </${Dialog}>`;
}

function EmptyForm({ folder }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    closeDialog();
    await emptyFolders([folder.id]);
  };
  const footer = html`<button type="button" class="btn btn-ghost" onClick=${closeDialog} disabled=${busy} data-autofocus>Cancel</button>
    <button type="button" class="btn btn-danger" onClick=${run} disabled=${busy}>Empty ${folderLabel(folder)}</button>`;
  return html`<${Dialog}
    title=${`Empty ${folderLabel(folder)}?`}
    onClose=${closeDialog}
    footer=${footer}
    size="sm"
    className="folder-dialog"
    titleIcon=${html`<span class="dialog-title-icon is-danger"><${Icon} name="alert" size=${18} /></span>`}
  >
    <p class="confirm-text">
      ${folder.totalCount ? `All ${plural(folder.totalCount, 'message')} in` : 'Everything in'} ${folderLabel(folder)} will be deleted from the mail server forever. This can't be undone.
    </p>
  </${Dialog}>`;
}

export function FolderDialog({ mode = 'create', folderId = null, accountId = null, parentId = null, initialName = '', returnTo = null }) {
  const folder = useStore((s) => (folderId != null ? s.folders.find((f) => f.id === folderId) || null : null));
  if (mode !== 'create' && !folder) {
    return html`<${Dialog} title="Folder not found" onClose=${closeDialog} size="sm" footer=${html`<button type="button" class="btn" onClick=${closeDialog}>Close</button>`}>
      <p class="muted">This folder doesn't exist any more. It may have been changed in another mail app.</p>
    </${Dialog}>`;
  }
  if (mode === 'delete') return html`<${DeleteForm} folder=${folder} />`;
  if (mode === 'empty') return html`<${EmptyForm} folder=${folder} />`;
  return html`<${NameForm} mode=${mode === 'rename' ? 'rename' : 'create'} folder=${folder} accountId=${accountId} parentId=${parentId} initialName=${initialName} returnTo=${returnTo} />`;
}
