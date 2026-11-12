// Small reusable hooks.
import { useEffect, useRef, useState } from '/vendor/preact-htm.js';

/** Current time, refreshed every `intervalMs` so relative labels stay fresh. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function useMediaQuery(query) {
  const get = () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Returns a stable function that calls `fn` once `delay` ms after the last call. */
export function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const debounced = useRef(null);
  if (!debounced.current) {
    debounced.current = (...args) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => fnRef.current(...args), delay);
    };
    debounced.current.cancel = () => clearTimeout(timer.current);
  }
  return debounced.current;
}

/** Calls handler when a pointerdown happens outside every ref'd element. */
export function useOutsideClick(refs, handler, active = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const onDown = (e) => {
      const inside = refs.some((r) => r.current && r.current.contains(e.target));
      if (!inside) handlerRef.current(e);
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [active]);
}

let idCounter = 0;
/** Stable unique id for label/aria wiring (this Preact build has no useId). */
export function useUid(prefix = 'mt') {
  const ref = useRef(null);
  if (ref.current === null) {
    idCounter += 1;
    ref.current = `${prefix}-${idCounter}`;
  }
  return ref.current;
}
