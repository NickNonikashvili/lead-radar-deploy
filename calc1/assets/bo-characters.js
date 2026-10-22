/* ============================================================
   Mathub — Bo's characters (App.boChars): who Bo is when he tutors you, picked by each student.
   Professor Bo (the default) is an 80-year-old Harvard professor: exacting, dry and hard to impress.
   Each character has his own manner (the words he is told are in api/ai.php, mh_ai_character), his own voice and
   pace on calls (unless the student picked a voice or a speed), and his own look: Bo the bobcat with glasses and a
   bow tie, a cap and a whistle, a deerstalker, closed eyes and a leaf, or as he always was.
   App.boChar() is the one picked (settings.boPersona); App.boCharSvg(id, size) draws him; App.boCharPicker(opts)
   is the choice as radio cards (Settings, Ask Bo, a call's settings); App.boCharSet(id) picks one.
   ============================================================ */
(function (global) {
  'use strict';
  const App = global.App; if (!App) return;
  const { esc, settings, setSetting } = App;
  const t = (s, ...v) => (App.t ? App.t(s, ...v) : s.replace(/\{(\d)\}/g, (m, i) => v[i - 1]));
  const CHARS = [
    { id: 'professor', name: 'Professor Bo', line: 'An 80-year-old Harvard professor. Exacting, dry, and very hard to impress.', sample: '“Hmm. No. Eleven minus three has been eight since before I was born. Read me your second line again, slowly.”', live: 'ash', basic: 'ash', rate: 1 },
    { id: 'coach', name: 'Coach Bo', line: 'Treats every problem like practice. Loud, fast, no excuses.', sample: '“Nope! Again. Take the three away first. That’s the rep. Go!”', live: 'verse', basic: 'verse', rate: 1.1 },
    { id: 'detective', name: 'Detective Bo', line: 'Every problem is a case and every mistake a clue.', sample: '“Interesting. The trail goes cold on line two. Who moved that three?”', live: 'sage', basic: 'sage', rate: 1 },
    { id: 'zen', name: 'Zen Bo', line: 'Calm and patient. Good for stressful days.', sample: '“Let’s breathe. One line at a time. Look gently at line two.”', live: 'ballad', basic: 'ballad', rate: 0.9 },
    { id: 'buddy', name: 'Buddy Bo', line: 'A friend a year ahead of you. Relaxed, warm, a little funny.', sample: '“Oh, close! Check the second line though, the three snuck off somewhere.”', live: 'cedar', basic: 'coral', rate: 1 }
  ];
  const DEFAULT = 'professor';
  const byId = id => CHARS.find(c => c.id === id);
  const cur = () => (byId(settings().boPersona) || byId(DEFAULT)).id;

  /* ---------- his look: Bo the bobcat, with a touch for each character ---------- */
  const LOOK = {
    // white eyebrows, round glasses, a bow tie
    professor: '<g class="bc-prof"><path d="M36 45q9-7 18-2M66 43q9-5 18 2" stroke="#F5F2EA" stroke-width="4.2" stroke-linecap="round" fill="none"/><g fill="rgba(255,255,255,.18)" stroke="#33261A" stroke-width="2.6"><circle cx="46" cy="56" r="10.5"/><circle cx="74" cy="56" r="10.5"/></g><path d="M56.5 54.5q3.5-3 7 0M35.5 53l-8-3M84.5 53l8-3" stroke="#33261A" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M60 96l-14-8v16zM60 96l14-8v16z" fill="#9B1C1C"/><circle cx="60" cy="96" r="3.4" fill="#7A1414"/></g>',
    // a cap and a whistle
    coach: '<g class="bc-coach"><path d="M25 41Q60 3 95 41Z" fill="#1A64D6"/><path d="M60 22v17" stroke="#1450B0" stroke-width="2"/><circle cx="60" cy="19" r="3.2" fill="#1450B0"/><path d="M22 41q38-9 76 0q-2 5-6 5q-32-7-64 0q-4 0-6-5z" fill="#1450B0"/><path d="M44 91q16 15 32 0" stroke="#E11D48" stroke-width="2.4" fill="none"/><rect x="56" y="101" width="13" height="7" rx="3.5" fill="#C3C8D1" stroke="#8C93A0" stroke-width="1"/></g>',
    // a deerstalker
    detective: '<g class="bc-det"><path d="M26 41Q60 5 94 41Z" fill="#8A6A44"/><path d="M36 26l40 15M44 18l42 20M56 12l34 17M30 34l22 7" stroke="#6E5233" stroke-width="2.2"/><path d="M28 40q-10 3-12 10q16-3 30-7z" fill="#6E5233"/><path d="M92 40q10 3 12 10q-16-3-30-7z" fill="#6E5233"/><path d="M54 16q6-6 12 0" stroke="#5A4229" stroke-width="2.6" fill="none"/></g>',
    // closed eyes, a leaf
    zen: '<g class="bc-zen"><ellipse cx="46" cy="56" rx="8.5" ry="9.5" fill="#D9A15B"/><ellipse cx="74" cy="56" rx="8.5" ry="9.5" fill="#D9A15B"/><path d="M38.5 57q7.5 6 15 0M66.5 57q7.5 6 15 0" stroke="#2A1B0E" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M91 29q9-12 19-7q-5 11-19 7z" fill="#3E9B5B"/><path d="M92 29q7-4 14-6" stroke="#2F7A46" stroke-width="1.4" fill="none"/></g>',
    buddy: ''
  };
  function svg(id, size) {
    const base = App.bobcatSvg ? App.bobcatSvg(size) : ''; if (!base) return '';
    const look = LOOK[id] || ''; if (!look) return base;
    return base.replace(/<g class="bo-hat">[\s\S]*?<\/g>\s*(?=<\/svg>)/, '').replace(/<\/svg>\s*$/, `${look}</svg>`).replace('class="bobcat"', `class="bobcat bc bc-${id}"`);
  }

  /* ---------- picking one ---------- */
  function set(id) {
    if (!byId(id) || id === cur() && settings().boPersona) return false;
    setSetting('boPersona', id);
    // his own voice and pace, unless the student changes them again
    setSetting('boLiveVoice', ''); setSetting('boLiveRate', ''); if (settings().boVoice !== 'device') setSetting('boVoice', '');
    document.dispatchEvent(new CustomEvent('mathub:bo-character', { detail: { id } }));
    return true;
  }
  // radio cards: { name: input name, compact: no samples }
  function picker(o = {}) {
    const name = o.name || 'bo-char'; const now = cur();
    return `<div class="bc-pick${o.compact ? ' compact' : ''}" role="radiogroup" aria-label="${esc(t('Bo’s character'))}">${CHARS.map(c => `<label class="bc-card${c.id === now ? ' on' : ''}"><input type="radio" name="${esc(name)}" value="${c.id}"${c.id === now ? ' checked' : ''}><span class="bc-av" aria-hidden="true">${svg(c.id, o.compact ? 44 : 56)}</span><span class="bc-t"><b>${esc(t(c.name))}${c.id === DEFAULT ? ` <small class="bc-def">${esc(t('default'))}</small>` : ''}</b><span>${esc(t(c.line))}</span>${o.compact ? '' : `<i>${esc(t(c.sample))}</i>`}</span></label>`).join('')}</div>`;
  }
  // wires a picker inside el: a change picks the character, then onPick(id)
  function wire(el, onPick) {
    if (!el) return;
    el.addEventListener('change', e => {
      const r = e.target.closest('.bc-pick input[type="radio"]'); if (!r) return;
      set(r.value); el.querySelectorAll('.bc-card').forEach(c => c.classList.toggle('on', c.contains(r)));
      if (App.toast) App.toast(t('{1} it is.', t(byId(r.value).name)), 2200);
      if (onPick) onPick(r.value);
    });
  }

  App.boChars = CHARS; App.boCharDefault = DEFAULT;
  App.boChar = cur; App.boCharInfo = id => byId(id || cur()); App.boCharSvg = svg; App.boCharSet = set; App.boCharPicker = picker; App.boCharWire = wire;
})(window);
