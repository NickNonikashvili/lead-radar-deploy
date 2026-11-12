// Mailtabs browser entry point (native ES module, no build step).
import { html, render } from '/vendor/preact-htm.js';
import { App } from './js/components/App.js';
import { applyTheme, boot, loadTheme } from './js/actions.js';

// Apply a saved light/dark choice before the first render to avoid a flash.
applyTheme(loadTheme());

const root = document.getElementById('app');
root.textContent = '';
render(html`<${App} />`, root);
boot();
