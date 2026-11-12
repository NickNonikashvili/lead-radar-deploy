// Root component: boot splash -> sign-in screen or the signed-in app.
import { html } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { boot } from '../actions.js';
import { Icon, Logo, Spinner } from '../icons.js';
import { AuthScreen } from './AuthScreen.js';
import { MainLayout } from './MainLayout.js';
import { Toasts } from './Toasts.js';

function Splash() {
  return html`<div class="splash" aria-busy="true">
    <${Logo} size=${40} />
    <${Spinner} size=${18} label="Loading Mailtabs" />
  </div>`;
}

function BootError({ message }) {
  return html`<main class="auth-screen">
    <div class="auth-card center">
      <div class="empty-icon is-danger"><${Icon} name="alert" size=${22} /></div>
      <h1 class="auth-title">Can't reach Mailtabs</h1>
      <p class="muted">${message}</p>
      <button type="button" class="btn btn-primary" onClick=${() => boot()}>Try again</button>
    </div>
  </main>`;
}

export function App() {
  const { booted, user, bootError } = useStore((s) => ({ booted: s.booted, user: s.user, bootError: s.bootError }));
  let screen;
  if (!booted) screen = html`<${Splash} />`;
  else if (bootError) screen = html`<${BootError} message=${bootError} />`;
  else if (!user) screen = html`<${AuthScreen} />`;
  else screen = html`<${MainLayout} />`;
  return html`${screen}<${Toasts} />`;
}
