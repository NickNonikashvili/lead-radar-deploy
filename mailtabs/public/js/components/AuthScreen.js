// Sign in / create account screen (shown whenever /api/auth/me is 401).
import { html, useEffect, useRef, useState } from '/vendor/preact-htm.js';
import { useStore } from '../store.js';
import { signIn, signUp } from '../actions.js';
import { Logo, Spinner } from '../icons.js';
import { InlineError } from './ui.js';
import { useUid } from '../hooks.js';

function friendlyAuthError(err, mode) {
  if (!err) return '';
  if (err.code === 'INVALID_CREDENTIALS') return "That email and password don't match. Check them and try again.";
  if (err.code === 'EMAIL_TAKEN') return 'An account with that email already exists. Sign in instead.';
  if (err.code === 'SIGNUPS_DISABLED') return "New sign-ups are turned off on this server. Ask the person who runs it for an account.";
  if (err.code === 'RATE_LIMITED') return 'Too many attempts. Wait a few minutes and try again.';
  return err.message || (mode === 'signup' ? "Couldn't create your account." : "Couldn't sign you in.");
}

export function AuthScreen() {
  const allowSignups = useStore((s) => s.config.allowSignups);
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const errorId = useUid('auth-error');
  const pwHintId = useUid('pw-hint');
  const isSignup = mode === 'signup';
  const emailRef = useRef(null);

  // Start in the email field (but don't pop the keyboard over the form on phones).
  useEffect(() => {
    const coarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (!coarse && emailRef.current) emailRef.current.focus();
  }, []);

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (isSignup && password.length < 8) {
      setError('Use a password with at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      if (isSignup) await signUp({ email: email.trim(), password, name: name.trim() });
      else await signIn({ email: email.trim(), password });
    } catch (err) {
      setError(friendlyAuthError(err, mode));
      setBusy(false);
    }
  };

  return html`<main class="auth-screen">
    <div class="auth-card">
      <div class="auth-brand">
        <${Logo} size=${40} />
        <div>
          <h1 class="auth-title">Mailtabs</h1>
          <p class="auth-tagline">All your inboxes in one place, organised into tabs you design.</p>
        </div>
      </div>

      ${allowSignups
        ? html`<div class="segmented auth-switch" role="group" aria-label="Choose">
            <button type="button" class="segment" aria-pressed=${!isSignup} onClick=${() => switchMode('signin')}>Sign in</button>
            <button type="button" class="segment" aria-pressed=${isSignup} onClick=${() => switchMode('signup')}>Create account</button>
          </div>`
        : null}

      <form class="form auth-form" onSubmit=${onSubmit} aria-describedby=${error ? errorId : undefined}>
        <h2 class="visually-hidden">${isSignup ? 'Create account' : 'Sign in'}</h2>
        ${isSignup
          ? html`<label class="field">
              <span class="field-label">Your name <span class="muted">(optional)</span></span>
              <input class="input" type="text" autocomplete="name" value=${name} onInput=${(e) => setName(e.currentTarget.value)} maxlength="80" />
            </label>`
          : null}
        <label class="field">
          <span class="field-label">Email</span>
          <input
            class="input"
            type="email"
            autocomplete="username"
            required
            value=${email}
            onInput=${(e) => setEmail(e.currentTarget.value)}
            ref=${emailRef}
          />
        </label>
        <label class="field">
          <span class="field-label">Password</span>
          <input
            class="input"
            type="password"
            autocomplete=${isSignup ? 'new-password' : 'current-password'}
            required
            minlength=${isSignup ? 8 : undefined}
            value=${password}
            onInput=${(e) => setPassword(e.currentTarget.value)}
            aria-describedby=${isSignup ? pwHintId : undefined}
          />
          ${isSignup ? html`<span class="field-hint" id=${pwHintId}>At least 8 characters.</span>` : null}
        </label>

        <${InlineError} message=${error} id=${errorId} />

        <button type="submit" class="btn btn-primary btn-block" disabled=${busy}>
          ${busy ? html`<${Spinner} size=${14} />` : null}
          ${busy ? (isSignup ? 'Creating your account…' : 'Signing in…') : isSignup ? 'Create account' : 'Sign in'}
        </button>
      </form>

      ${!allowSignups && !isSignup
        ? html`<p class="auth-foot muted small">
            Setting up a brand-new server?${' '}
            <button type="button" class="link-btn" onClick=${() => switchMode('signup')}>Create the first account</button>
          </p>`
        : null}
      ${!allowSignups && isSignup
        ? html`<p class="auth-foot muted small">
            <button type="button" class="link-btn" onClick=${() => switchMode('signin')}>Back to sign in</button>
          </p>`
        : null}
    </div>
    <p class="auth-footer muted small">Self-hosted. Your passwords and tokens are encrypted on this server.</p>
  </main>`;
}
