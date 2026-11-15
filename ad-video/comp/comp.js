// EvoSoft ad compositor: draws frame t (seconds) of the timeline in timeline.json. Deterministic: the same t always
// gives the same picture. render.js calls window.renderFrame(t) and takes a screenshot.
(() => {
  'use strict';
  const XF = 0.5; // crossfade between scenes, seconds
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeIO = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const easeOut = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
  const easeBack = (x) => { x = clamp(x, 0, 1); const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const lock = '<svg viewBox="0 0 24 24" fill="none" stroke="#22A447" stroke-width="2.6" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

  let TL, MARK = '';
  const clips = {};
  const scenes = [];

  // rise-in for an element: opacity + translate, starting at `at` seconds of the scene
  function rise(el, local, at, dist = 30, dur = 0.7) {
    if (!el) return;
    const k = easeOut((local - at) / dur);
    el.style.opacity = k;
    el.style.transform = `translateY(${(1 - k) * dist}px)`;
  }

  function frameAt(name, c) {
    const fr = clips[name].frames;
    let lo = 0, hi = fr.length - 1;
    if (c <= fr[0].t) return fr[0];
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (fr[mid].t <= c) lo = mid; else hi = mid - 1; }
    return fr[lo];
  }

  // Clip time for a scene-local time: a piecewise-linear map [[local, clipT], ...]; a repeated local is a cut.
  function clipAt(map, local) {
    if (local <= map[0][0]) return map[0][1];
    for (let i = map.length - 1; i > 0; i--) {
      const [l0, c0] = map[i - 1], [l1, c1] = map[i];
      if (local >= l0 && l1 > l0 && local <= l1) return c0 + (c1 - c0) * ((local - l0) / (l1 - l0));
      if (local >= l1 && i === map.length - 1) return c1 + (local - l1);
    }
    return map[map.length - 1][1];
  }

  function camAt(cam, local) {
    if (!cam || !cam.length) return { x: 0.5, y: 0, s: 1 };
    if (local <= cam[0].t) return cam[0];
    for (let i = 1; i < cam.length; i++) {
      if (local <= cam[i].t) {
        const a = cam[i - 1], b = cam[i];
        const k = easeIO((local - a.t) / Math.max(0.001, b.t - a.t));
        return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), s: lerp(a.s, b.s, k) };
      }
    }
    return cam[cam.length - 1];
  }

  // Place an image (aspect 16:10) in a viewport W×H so that the focus point (fx, fy) is centred at zoom s.
  function placeImg(img, W, H, cam, aspect = 1.6) {
    const iw = W * cam.s, ih = (W / aspect) * cam.s;
    let tx = W / 2 - cam.x * iw, ty = H / 2 - cam.y * ih;
    tx = clamp(tx, Math.min(0, W - iw), 0);
    ty = clamp(ty, Math.min(0, H - ih), 0);
    img.style.width = `${W}px`;
    img.style.height = `${W / aspect}px`;
    img.style.transform = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${cam.s.toFixed(4)})`;
  }

  const subHtml = (s) => s.split(' · ').map((x, i, a) => `<span style="white-space:nowrap">${esc(x)}${i < a.length - 1 ? ' ·' : ''}</span>`).join(' ');
  function copyHtml(sc) {
    return `<div class="copy">${sc.chip ? `<span class="chip" style="--c:${sc.color || '#22A447'}"><i></i>${esc(sc.chip)}</span>` : ''}<div class="bar"></div>${sc.onscreen ? `<h1>${esc(sc.onscreen)}</h1>` : ''}${sc.sub ? `<p>${subHtml(sc.sub)}</p>` : ''}</div>`;
  }
  const windowKinds = new Set(['browser', 'shots']);
  // Two neighbouring scenes that share a window (same layout) cut like one window changing page; with the same
  // left-hand text, the text stays put.
  const sameWindow = (a, b) => a && b && windowKinds.has(a.kind) && windowKinds.has(b.kind) && (a.layout || 'split') === (b.layout || 'split');
  const sameCopy = (a, b) => sameWindow(a, b) && a.beat === b.beat && a.chip === b.chip && a.onscreen === b.onscreen && a.sub === b.sub;
  function browserHtml(sc, inner) {
    return `<div class="browser"><div class="top"><b></b><b></b><b></b><div class="url">${lock}<span>${esc(sc.url || 'evosoft.solutions')}</span></div></div><div class="vp">${inner}</div></div>`;
  }

  function build(sc) {
    const el = document.createElement('div');
    el.className = `scene kind-${sc.kind} layout-${sc.layout || 'split'}`;
    if (sc.kind === 'title') {
      el.innerHTML = `<div class="center"><div class="logo-big"><div class="mark">${MARK}</div><div class="word">evosoft</div></div>${sc.onscreen ? `<h1>${sc.onscreenHtml || esc(sc.onscreen)}</h1>` : ''}${sc.sub ? `<p>${esc(sc.sub)}</p>` : ''}</div>`;
    } else if (sc.kind === 'end') {
      el.innerHTML = `<div class="center"><div class="logo-big"><div class="mark">${MARK}</div><div class="word">evosoft</div></div><div class="url-big">evosoft.solutions</div><div class="cta">${esc(sc.cta || 'Get a free quote')} <span>→</span></div><div class="contacts">${esc(sc.contacts || '')}</div><div class="langs">${esc(sc.langs || '')}</div><div class="copyright">${esc(sc.copyright || '')}</div></div>`;
    } else if (sc.kind === 'browser') {
      el.innerHTML = (sc.layout === 'split' ? copyHtml(sc) : '') + browserHtml(sc, '<img alt="">' + (sc.mask ? '<div class="vmask"></div>' : ''));
      if (sc.pills) el.querySelector('.browser .top').insertAdjacentHTML('beforeend', `<div class="pills">${sc.pills.map((p) => `<span>${esc(p.label)}</span>`).join('')}</div>`);
    } else if (sc.kind === 'shots') {
      el.innerHTML = (sc.layout === 'split' ? copyHtml(sc) : '') + browserHtml(sc, sc.shots.map((s) => `<img alt="" src="${esc(s.src)}">`).join(''));
    } else if (sc.kind === 'phone') {
      el.innerHTML = copyHtml(sc) + `<div class="phonebox"><div class="vp"><img alt=""></div></div>`;
    }
    document.getElementById('scenes').appendChild(el);
    return el;
  }

  async function load() {
    TL = await (await fetch('timeline.json', { cache: 'no-store' })).json();
    MARK = await (await fetch('mark.svg')).text();
    const names = [...new Set(TL.scenes.filter((s) => s.clip).map((s) => s.clip.name))];
    await Promise.all(names.map(async (n) => { clips[n] = await (await fetch(`../clips/${n}/index.json`)).json(); }));
    for (const sc of TL.scenes) scenes.push({ sc, el: build(sc) });
    // Scenes that aren't on screen are display:none, so load every face they use now, not on first sight.
    const sample = 'Aa Яя ქა 0123';
    await Promise.all(['500', '600', '700', '800'].flatMap((w) => [`${w} 40px Gabarito`, `${w} 40px Figtree`]).map((f) => document.fonts.load(f, sample)));
    await document.fonts.load('400 20px Mono', 'a');
    await document.fonts.ready;
    await Promise.all([...document.images].filter((i) => i.src).map((i) => i.decode().catch(() => {})));
  }
  window.ready = load();

  async function drawScene({ sc, el }, t) {
    const local = t - sc.start;
    const prev = scenes[sc.index - 1] && scenes[sc.index - 1].sc, next = scenes[sc.index + 1] && scenes[sc.index + 1].sc;
    const contIn = sameWindow(prev, sc), contOut = sameWindow(sc, next);
    const copyIn = sameCopy(prev, sc), copyOut = sameCopy(sc, next);
    const end = sc.dur + (sc.last ? 0 : XF);
    if (local < 0 || local >= end) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.visibility = 'visible';
    // enter: fade + rise; exit: the next scene fades in on top, this one settles back slightly
    // a quick crossfade, no movement: windows that share a layout sit on the same pixels
    const dipIn = !sc.first && !contIn, dipOut = !contOut && !sc.last;
    const kin = sc.first ? 1 : dipIn ? easeOut((local - 0.15) / 0.3) : easeOut(local / 0.3);
    const kout = dipOut ? clamp((local - sc.dur) / 0.2, 0, 1) : clamp((local - sc.dur) / XF, 0, 1);
    const isWindow = windowKinds.has(sc.kind);
    el.style.opacity = (((isWindow && copyIn) ? 1 : kin) * (contOut ? 1 : 1 - Math.pow(kout, 1.6))).toFixed(4);
    el.style.transform = isWindow || sc.kind === 'phone' ? 'none' : `translateY(${((1 - kin) * 26).toFixed(2)}px)`;
    const outCopy = copyOut ? 1 : 1 - easeOut(kout / 0.5);
    const delay = sc.first ? 0 : 0.08;
    el.style.zIndex = String(10 + sc.index);
    const pending = [];

    if (sc.kind === 'title') {
      const mark = el.querySelector('.mark'), word = el.querySelector('.word'), h1 = el.querySelector('h1'), p = el.querySelector('p');
      const km = easeBack((local - 0.1) / 0.8);
      mark.style.opacity = clamp((local - 0.1) / 0.3, 0, 1);
      mark.style.transform = `scale(${(0.4 + 0.6 * km).toFixed(4)}) rotate(${((1 - km) * -40).toFixed(2)}deg)`;
      const kw = easeOut((local - 0.45) / 0.7);
      word.style.opacity = kw;
      word.style.transform = `translateX(${((1 - kw) * -40).toFixed(2)}px)`;
      rise(h1, local, 1.0, 34, 0.8);
      rise(p, local, sc.subAt != null ? sc.subAt : 1.35, 24, 0.8);
    } else if (sc.kind === 'end') {
      const items = el.querySelectorAll('.logo-big, .url-big, .cta, .contacts, .langs, .copyright');
      items.forEach((it, i) => rise(it, local, 0.1 + i * 0.22, 30, 0.75));
      const cta = el.querySelector('.cta');
      const pulse = local > 2.2 ? 1 + 0.025 * Math.sin((local - 2.2) * 4.2) : 1;
      cta.style.transform += ` scale(${pulse.toFixed(4)})`;
    } else {
      const copy = el.querySelector('.copy');
      if (copy && copyIn) {
        copy.querySelectorAll('.chip, h1, p').forEach((x) => { x.style.opacity = 1; x.style.transform = 'none'; });
        copy.querySelector('.bar').style.transform = 'none';
        copy.style.opacity = outCopy.toFixed(4);
      } else if (copy) {
        rise(copy.querySelector('.chip'), local, 0.15 + delay);
        const bar = copy.querySelector('.bar');
        bar.style.transform = `scaleX(${easeOut((local - 0.3 - delay) / 0.8).toFixed(4)})`;
        rise(copy.querySelector('h1'), local, 0.3 + delay, 36, 0.8);
        rise(copy.querySelector('p'), local, 0.55 + delay, 26, 0.8);
        copy.style.opacity = outCopy.toFixed(4);
      }
      const box = el.querySelector('.browser, .phonebox');
      // the window floats in and keeps a slow drift
      const kb = contIn || sc.first ? 1 : easeOut((local - 0.05) / 0.9);
      const drift = Math.sin(t * 0.35) * 4;
      box.style.transform = `translateY(${((1 - kb) * 24 + drift).toFixed(2)}px)`;
      if (copyIn) box.style.opacity = kin.toFixed(4);
      const vp = box.querySelector('.vp');
      const W = vp.clientWidth, H = vp.clientHeight;

      if (sc.kind === 'browser' || sc.kind === 'phone') {
        const img = vp.querySelector('img');
        const c = sc.clip.map ? clipAt(sc.clip.map, local) : sc.clip.from + Math.max(0, local) * (sc.clip.speed || 1);
        const fr = frameAt(sc.clip.name, c);
        const src = `../clips/${sc.clip.name}/${fr.f}`;
        if (img.dataset.src !== src) { img.dataset.src = src; img.src = src; pending.push(img.decode().catch(() => {})); }
        if (sc.kind === 'browser') placeImg(img, W, H, camAt(sc.cam, local), 1.6);
        if (sc.mask) {
          const m = vp.querySelector('.vmask');
          m.style.background = `linear-gradient(90deg, rgba(238,245,252,1) 0px, rgba(238,245,252,1) ${sc.mask.solid}px, rgba(238,245,252,0) ${sc.mask.fade}px)`;
          m.style.opacity = easeIO(clamp((local - sc.mask.t0) / Math.max(0.01, sc.mask.t1 - sc.mask.t0), 0, 1)).toFixed(4);
        }
        else { img.style.width = '100%'; img.style.height = 'auto'; }
        if (sc.urls) {
          let u = sc.url;
          for (const x of sc.urls) if (local >= x.t) u = x.url;
          const span = el.querySelector('.url span');
          if (span.textContent !== u) span.textContent = u;
        }
        if (sc.pills) {
          let on = 0;
          sc.pills.forEach((p, i) => { if (local >= p.t) on = i; });
          el.querySelectorAll('.pills span').forEach((s, i) => s.classList.toggle('on', i === on));
          const pills = el.querySelector('.pills');
          pills.style.opacity = easeOut((local - 0.4) / 0.6);
        }
      } else if (sc.kind === 'shots') {
        const imgs = vp.querySelectorAll('img');
        sc.shots.forEach((s, i) => {
          const im = imgs[i];
          const a = s.from, b = s.to;
          const fadeIn = i === 0 ? 1 : easeOut((local - a) / 0.3);
          const visible = local >= a - 0.001 && (i === sc.shots.length - 1 || local < sc.shots[i + 1].from + 0.35);
          im.style.visibility = visible ? 'inherit' : 'hidden';
          im.style.opacity = fadeIn;
          im.style.zIndex = String(i + 1);
          const k = clamp((local - a) / Math.max(0.1, b - a), 0, 1);
          const kk = easeIO(k);
          const zs = lerp(s.kb[2], s.kb[5], kk), iw = W * zs, ih = (W / 1.6) * zs;
          const fx = lerp(s.kb[0], s.kb[3], kk), fy = lerp(s.kb[1], s.kb[4], kk);
          im.style.width = `${W}px`;
          im.style.height = `${W / 1.6}px`;
          im.style.transform = `translate(${(-fx * Math.max(0, iw - W)).toFixed(2)}px, ${(-fy * Math.max(0, ih - H)).toFixed(2)}px) scale(${zs.toFixed(4)})`;
          if (s.url && local >= a) { const span = el.querySelector('.url span'); if (span.textContent !== s.url) span.textContent = s.url; }
        });
      }
    }
    await Promise.all(pending);
  }

  function drawBg(t) {
    const b = document.querySelectorAll('#bg i');
    b[0].style.transform = `translate(${(Math.sin(t * 0.21) * 160).toFixed(1)}px, ${(Math.cos(t * 0.17) * 90).toFixed(1)}px) scale(${(1 + Math.sin(t * 0.13) * 0.08).toFixed(3)})`;
    b[1].style.transform = `translate(${(Math.cos(t * 0.15) * -170).toFixed(1)}px, ${(Math.sin(t * 0.19) * 110).toFixed(1)}px)`;
    b[2].style.transform = `translate(${(Math.sin(t * 0.11) * -220).toFixed(1)}px, ${(Math.cos(t * 0.23) * -80).toFixed(1)}px) scale(${(1 + Math.cos(t * 0.1) * 0.1).toFixed(3)})`;
    document.getElementById('grid').style.transform = `translate(${((t * 9) % 30).toFixed(2)}px, ${((t * 4.5) % 30).toFixed(2)}px)`;
  }

  function drawCaption(t) {
    const cap = document.getElementById('cap');
    const c = (TL.captions || []).find((x) => !x.srtOnly && t >= x.start && t < x.end);
    if (!c || TL.noCaptions) { cap.hidden = true; return; }
    cap.hidden = false;
    const span = cap.firstChild;
    if (span.textContent !== c.text) span.textContent = c.text;
    const k = Math.min(c.joinPrev ? 1 : easeOut((t - c.start) / 0.18), c.joinNext ? 1 : easeOut((c.end - t) / 0.18));
    span.style.opacity = k;
    span.style.transform = `translateY(${((1 - k) * 8).toFixed(1)}px)`;
  }

  window.renderFrame = async (t) => {
    await window.ready;
    drawBg(t);
    await Promise.all(scenes.map((s) => drawScene(s, t)));
    drawCaption(t);
    await document.fonts.ready;
  };
  window.timeline = () => TL;
})();
