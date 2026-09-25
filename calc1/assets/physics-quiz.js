/* ============================================================
   Mathub — Physics I procedural question generators
   Same contract as the calculus module:
   { topic, type:'mc'|'num', prompt, options?, answer, answerTex?, explanation, hint?, tol? }
   ============================================================ */
(function (global) {
  'use strict';
  const R = String.raw;
  const g = 9.8, G = 6.67e-11, VS = 343, RHO_W = 1000, P0 = 1.013e5;
  const ME = 5.97e24, RE = 6.37e6;

  const TOPICS = {
    'units-conv':    { unit: 1, sec: 'units', label: 'Units & dimensional analysis' },
    'vectors-comp':  { unit: 1, sec: 'vectors', label: 'Vector components & addition' },
    'kin1d':         { unit: 1, sec: 'kin1d', label: '1D kinematics' },
    'freefall':      { unit: 1, sec: 'freefall', label: 'Free fall' },
    'kin2d':         { unit: 1, sec: 'kin2d', label: '2D velocity & acceleration' },
    'projectile':    { unit: 1, sec: 'projectile', label: 'Projectile motion' },
    'circkin':       { unit: 1, sec: 'circkin', label: 'Circular & relative motion' },
    'newton-laws':   { unit: 1, sec: 'newton', label: 'Newton’s laws' },
    'forces-fbd':    { unit: 1, sec: 'forces', label: 'Forces & free-body diagrams' },
    'apply-newton':  { unit: 2, sec: 'applynewton', label: 'Inclines, pulleys, elevators' },
    'friction':      { unit: 2, sec: 'friction', label: 'Friction' },
    'circ-dyn':      { unit: 2, sec: 'circdyn', label: 'Centripetal force & drag' },
    'statics':       { unit: 2, sec: 'statics', label: 'Torque & static equilibrium' },
    'fluids':        { unit: 2, sec: 'fluids', label: 'Pressure & buoyancy' },
    'rot-kin':       { unit: 2, sec: 'rotkin', label: 'Rotational kinematics' },
    'work-energy':   { unit: 2, sec: 'work', label: 'Work, KE & power' },
    'energy-cons':   { unit: 2, sec: 'energy', label: 'Conservation of energy' },
    'momentum':      { unit: 3, sec: 'momentum', label: 'Momentum & impulse' },
    'collisions':    { unit: 3, sec: 'collisions', label: 'Collisions & center of mass' },
    'rot-dyn':       { unit: 3, sec: 'rotdyn', label: 'Moment of inertia & torque' },
    'ang-mom':       { unit: 3, sec: 'angmom', label: 'Angular momentum & rolling' },
    'gravity':       { unit: 3, sec: 'gravity', label: 'Gravitation & orbits' },
    'shm':           { unit: 4, sec: 'shm', label: 'Simple harmonic motion' },
    'pendulum':      { unit: 4, sec: 'pendulum', label: 'Pendulums & resonance' },
    'waves':         { unit: 4, sec: 'waves', label: 'Waves on strings' },
    'sound':         { unit: 4, sec: 'sound', label: 'Sound, decibels & Doppler' }
  };

  /* ---------- helpers ---------- */
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const rnd = (a, b, step) => { const n = Math.round((b - a) / step); return +(a + step * ri(0, n)).toFixed(6); };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const rad = d => d * Math.PI / 180;
  function sig(x, n = 3) {
    if (!isFinite(x)) return String(x); if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e5 || ax < 1e-3) { const e = Math.floor(Math.log10(ax)); const m = x / Math.pow(10, e); return `${+m.toPrecision(n)}\\times10^{${e}}`; }
    return String(+x.toPrecision(n));
  }
  const s3 = x => sig(x, 3);
  const sci = (m, e) => R`${m}\times10^{${e}}`;
  function mc(topic, prompt, correct, distractors, explanation, hint) {
    const opts = [correct]; for (const d of distractors) if (!opts.includes(d)) opts.push(d);
    const options = shuffle(opts);
    return { topic, type: 'mc', prompt, options, answer: options.indexOf(correct), explanation, hint };
  }
  function num(topic, prompt, answer, answerTex, explanation, hint) {
    return { topic, type: 'num', prompt, answer, answerTex: answerTex || s3(answer), explanation, hint, tol: 0.02 };
  }
  const U = u => R`\ \text{${u}}`;

  /* ======================================================
     UNIT 1
     ====================================================== */
  function qConvert() {
    const k = ri(0, 5);
    if (k === 0) { const v = 9 * ri(2, 16); return num('units-conv', R`Convert $${v}$ km/h to m/s.`, v / 3.6, s3(v / 3.6), R`$${v}\ \frac{\text{km}}{\text{h}}\times\frac{1000\ \text{m}}{1\ \text{km}}\times\frac{1\ \text{h}}{3600\ \text{s}} = ${s3(v / 3.6)}$ m/s. (Divide km/h by 3.6.)`, 'Multiply by 1000 m/km and by 1 h/3600 s.'); }
    if (k === 1) { const v = ri(5, 40); return num('units-conv', R`Convert $${v}$ m/s to km/h.`, v * 3.6, s3(v * 3.6), R`$${v}\ \text{m/s}\times 3.6 = ${s3(v * 3.6)}$ km/h.`); }
    if (k === 2) { const A = ri(5, 90) * 10; return num('units-conv', R`Convert $${A}\ \text{cm}^2$ to $\text{m}^2$.`, A * 1e-4, sig(A * 1e-4), R`$1\ \text{cm} = 10^{-2}$ m, so $1\ \text{cm}^2 = 10^{-4}\ \text{m}^2$: $${A}\times10^{-4} = ${sig(A * 1e-4)}\ \text{m}^2$.`, 'Square the conversion factor for an area.'); }
    if (k === 3) { const d = rnd(0.5, 8, 0.1); return num('units-conv', R`A material has density $${d}\ \text{g/cm}^3$. Express it in $\text{kg/m}^3$.`, d * 1000, s3(d * 1000), R`$1\ \text{g/cm}^3 = \frac{10^{-3}\ \text{kg}}{10^{-6}\ \text{m}^3} = 1000\ \text{kg/m}^3$, so $${s3(d * 1000)}\ \text{kg/m}^3$.`); }
    if (k === 4) { const h = rnd(0.5, 4, 0.5); return num('units-conv', R`How many seconds are in $${h}$ hours?`, h * 3600, s3(h * 3600), R`$${h}\times3600 = ${h * 3600}$ s.`); }
    const v = ri(20, 80); return num('units-conv', R`A speed limit is $${v}$ mph. Express it in m/s (1 mi = 1609 m).`, v * 0.447, s3(v * 0.447), R`$${v}\ \frac{\text{mi}}{\text{h}}\times\frac{1609\ \text{m}}{\text{mi}}\times\frac{1\ \text{h}}{3600\ \text{s}} = ${s3(v * 0.447)}$ m/s.`);
  }
  function qDimensional() {
    const bank = [
      { q: 'Which combination has the SI units of force?', ok: 'kg·m/s²', bad: ['kg·m/s', 'kg·m²/s²', 'kg/s²'], why: 'F = ma has units kg × m/s² = N.' },
      { q: 'Which has the same units as energy?', ok: 'N·m', bad: ['N/m', 'N·s', 'kg·m/s'], why: 'Work = force × distance, so J = N·m.' },
      { q: 'x is a length, a an acceleration, t a time. Which expression could be a velocity?', ok: '√(2ax)', bad: ['at²', 'x/t²', 'a/x'], why: '√(2ax) has units √(m/s² · m) = m/s. at² is a length, x/t² an acceleration.' },
      { q: 'Which equation is dimensionally consistent (x length, v speed, a acceleration, t time)?', ok: 'x = vt + ½at²', bad: ['x = vt²', 'x = at', 'v = ax'], why: 'Both vt and at² are lengths. The others mix dimensions.' },
      { q: 'The SI units of momentum are', ok: 'kg·m/s', bad: ['kg·m/s²', 'N·m', 'J/s'], why: 'p = mv: kilogram times meters per second (also N·s).' },
      { q: 'The SI units of power are', ok: 'J/s', bad: ['N·m', 'kg·m/s', 'J·s'], why: 'Power is energy per time: 1 W = 1 J/s.' },
      { q: 'What must be true of the argument of sin, cos, or exp?', ok: 'It is dimensionless', bad: ['It has units of radians per second', 'It has units of meters', 'It can have any units'], why: 'Only pure numbers can be raised to powers in a series expansion; e.g. sin(ωt) with ω in rad/s and t in s.' }
    ];
    const it = pick(bank);
    return mc('units-conv', it.q, it.ok, it.bad, it.why, 'Write every quantity as kg, m, s and compare.');
  }
  const ANGLES = [30, 37, 45, 53, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330];
  function qComponents() {
    const A = ri(3, 20), th = pick(ANGLES), wantX = Math.random() < 0.5;
    const ans = wantX ? A * Math.cos(rad(th)) : A * Math.sin(rad(th));
    return num('vectors-comp', R`A vector has magnitude $${A}$ m and points at $${th}^\circ$ counterclockwise from the $+x$ axis. Find its $${wantX ? 'x' : 'y'}$-component (signed).`, ans, s3(ans),
      R`$A_${wantX ? 'x' : 'y'} = ${A}\,${wantX ? '\\cos' : '\\sin'}(${th}^\circ) = ${s3(ans)}$ m. ${th > 90 && th < 270 && wantX ? 'The angle is in quadrant II or III, so the x-component is negative.' : th > 180 && !wantX ? 'The angle is below the x-axis, so the y-component is negative.' : ''}`,
      'x uses cosine, y uses sine, when the angle is measured from the +x axis.');
  }
  function qMagnitudeAngle() {
    const tr = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 12, 15]]);
    const sx = pick([1, -1]), sy = pick([1, -1]);
    const ax = sx * tr[0], ay = sy * tr[1];
    if (Math.random() < 0.5) return num('vectors-comp', R`Find the magnitude of $\vec A = ${ax}\,\hat i ${ay < 0 ? '-' : '+'} ${Math.abs(ay)}\,\hat j$ (m).`, tr[2], `${tr[2]}`, R`$|\vec A| = \sqrt{${ax}^2 + (${ay})^2} = \sqrt{${tr[0] ** 2 + tr[1] ** 2}} = ${tr[2]}$ m.`);
    let ang = Math.atan2(ay, ax) * 180 / Math.PI; if (ang < 0) ang += 360;
    return num('vectors-comp', R`Find the direction of $\vec A = ${ax}\,\hat i ${ay < 0 ? '-' : '+'} ${Math.abs(ay)}\,\hat j$ as an angle in degrees measured counterclockwise from the $+x$ axis ($0^\circ$ to $360^\circ$).`, ang, s3(ang),
      R`$\tan^{-1}\!\left(\frac{${ay}}{${ax}}\right)$ gives a reference angle of $${s3(Math.atan(tr[1] / tr[0]) * 180 / Math.PI)}^\circ$; the components put the vector in quadrant ${ax > 0 && ay >= 0 ? 'I' : ax < 0 && ay >= 0 ? 'II' : ax < 0 ? 'III' : 'IV'}, so the angle is $${s3(ang)}^\circ$.`, 'Check the quadrant from the signs of the components; the calculator’s arctan only covers quadrants I and IV.');
  }
  function qVectorAdd() {
    const a = ri(3, 12), b = ri(3, 12), th = pick([30, 45, 60, 90, 120, 135, 150]);
    const rx = a + b * Math.cos(rad(th)), ry = b * Math.sin(rad(th)); const Rm = Math.hypot(rx, ry);
    return num('vectors-comp', R`$\vec A$ is $${a}$ m along the $+x$ axis. $\vec B$ has magnitude $${b}$ m at $${th}^\circ$ counterclockwise from $+x$. Find $|\vec A + \vec B|$ (m).`, Rm, s3(Rm),
      R`$R_x = ${a} + ${b}\cos${th}^\circ = ${s3(rx)}$, $R_y = ${b}\sin${th}^\circ = ${s3(ry)}$. $|\vec R| = \sqrt{${s3(rx)}^2 + ${s3(ry)}^2} = ${s3(Rm)}$ m.`, 'Add components, then take the magnitude.');
  }
  function qDot() {
    if (Math.random() < 0.5) { const ax = ri(-6, 6), ay = ri(-6, 6), bx = ri(-6, 6), by = ri(-6, 6); return num('vectors-comp', R`Compute $\vec A\cdot\vec B$ for $\vec A = ${ax}\hat i ${ay < 0 ? '-' : '+'} ${Math.abs(ay)}\hat j$ and $\vec B = ${bx}\hat i ${by < 0 ? '-' : '+'} ${Math.abs(by)}\hat j$.`, ax * bx + ay * by, `${ax * bx + ay * by}`, R`$A_xB_x + A_yB_y = (${ax})(${bx}) + (${ay})(${by}) = ${ax * bx + ay * by}$.`); }
    const A = ri(2, 10), B = ri(2, 10), th = pick([0, 30, 45, 60, 90, 120, 180]); const ans = A * B * Math.cos(rad(th));
    return num('vectors-comp', R`$|\vec A| = ${A}$, $|\vec B| = ${B}$, and the angle between them is $${th}^\circ$. Find $\vec A\cdot\vec B$.`, ans, s3(ans), R`$AB\cos\theta = ${A}(${B})\cos${th}^\circ = ${s3(ans)}$.${th === 90 ? ' Perpendicular vectors have zero dot product.' : ''}`);
  }
  function qKin1d() {
    const k = ri(0, 4);
    if (k === 0) { const v0 = ri(0, 20), a = rnd(0.5, 4, 0.5), t = ri(2, 12); return num('kin1d', R`A car moving at $${v0}$ m/s accelerates uniformly at $${a}\ \text{m/s}^2$ for $${t}$ s. Find its final speed (m/s).`, v0 + a * t, s3(v0 + a * t), R`$v = v_0 + at = ${v0} + ${a}(${t}) = ${s3(v0 + a * t)}$ m/s.`); }
    if (k === 1) { const v0 = ri(0, 20), a = rnd(0.5, 4, 0.5), t = ri(2, 12); const d = v0 * t + 0.5 * a * t * t; return num('kin1d', R`Starting at $${v0}$ m/s, an object accelerates at $${a}\ \text{m/s}^2$ for $${t}$ s. How far does it travel (m)?`, d, s3(d), R`$\Delta x = v_0t + \tfrac12at^2 = ${v0}(${t}) + \tfrac12(${a})(${t})^2 = ${s3(d)}$ m.`); }
    if (k === 2) { const v0 = ri(10, 40), d = ri(20, 200); const a = v0 * v0 / (2 * d); return num('kin1d', R`A car at $${v0}$ m/s brakes uniformly to a stop in $${d}$ m. Find the magnitude of its acceleration ($\text{m/s}^2$).`, a, s3(a), R`$v^2 = v_0^2 + 2a\Delta x \Rightarrow 0 = ${v0}^2 + 2a(${d}) \Rightarrow a = -\frac{${v0 * v0}}{${2 * d}} = -${s3(a)}\ \text{m/s}^2$; magnitude $${s3(a)}$.`, 'Use the equation without time.'); }
    if (k === 3) { const v0 = ri(10, 40), a = rnd(1, 6, 0.5); const d = v0 * v0 / (2 * a); return num('kin1d', R`A cyclist at $${v0}$ m/s decelerates at $${a}\ \text{m/s}^2$. What distance (m) does she cover before stopping?`, d, s3(d), R`$d = \frac{v_0^2}{2a} = \frac{${v0}^2}{2(${a})} = ${s3(d)}$ m. (Doubling the speed quadruples the stopping distance.)`); }
    const v0 = ri(0, 15), v = v0 + ri(5, 30), a = rnd(0.5, 4, 0.5); const t = (v - v0) / a; return num('kin1d', R`How long (s) does it take to go from $${v0}$ m/s to $${v}$ m/s at $${a}\ \text{m/s}^2$?`, t, s3(t), R`$t = \frac{v - v_0}{a} = \frac{${v} - ${v0}}{${a}} = ${s3(t)}$ s.`);
  }
  function qKinGraph() {
    const bank = [
      { q: 'The slope of a position–time graph gives', ok: 'velocity', bad: ['acceleration', 'displacement', 'distance'], why: 'v = dx/dt is the slope of x versus t.' },
      { q: 'The area under a velocity–time graph gives', ok: 'displacement', bad: ['acceleration', 'average speed', 'jerk'], why: 'Δx = ∫v dt: the area (with sign) under v–t.' },
      { q: 'The slope of a velocity–time graph gives', ok: 'acceleration', bad: ['position', 'displacement', 'speed'], why: 'a = dv/dt.' },
      { q: 'An object has negative velocity and positive acceleration. It is', ok: 'moving in the −x direction and slowing down', bad: ['moving in the −x direction and speeding up', 'moving in the +x direction and slowing down', 'at rest'], why: 'Opposite signs of v and a mean the speed is decreasing.' },
      { q: 'A position–time graph is a straight line with positive slope. The acceleration is', ok: 'zero', bad: ['positive and constant', 'negative and constant', 'increasing'], why: 'Constant slope means constant velocity, so a = 0.' },
      { q: 'A position–time graph curves upward (concave up). The object is', ok: 'accelerating in the +x direction', bad: ['moving at constant velocity', 'accelerating in the −x direction', 'at rest'], why: 'Concave up means the slope (velocity) is increasing: positive acceleration.' },
      { q: 'At the moment a ball thrown upward reaches its highest point,', ok: 'its velocity is zero and its acceleration is 9.8 m/s² downward', bad: ['its velocity and acceleration are both zero', 'its acceleration is zero but its velocity is not', 'its acceleration is momentarily upward'], why: 'Gravity never switches off; only the velocity passes through zero.' }
    ];
    const it = pick(bank); return mc('kin1d', it.q, it.ok, it.bad, it.why);
  }
  function qFreeFall() {
    const k = ri(0, 5);
    if (k === 0) { const h = ri(5, 120); const t = Math.sqrt(2 * h / g); return num('freefall', R`A stone is dropped from rest from a height of $${h}$ m. How long (s) does it take to hit the ground? (g = 9.8 m/s²)`, t, s3(t), R`$h = \tfrac12gt^2 \Rightarrow t = \sqrt{2h/g} = \sqrt{2(${h})/9.8} = ${s3(t)}$ s.`); }
    if (k === 1) { const h = ri(5, 120); const v = Math.sqrt(2 * g * h); return num('freefall', R`A stone dropped from rest falls $${h}$ m. Find its impact speed (m/s).`, v, s3(v), R`$v^2 = 2gh \Rightarrow v = \sqrt{2(9.8)(${h})} = ${s3(v)}$ m/s.`); }
    if (k === 2) { const v0 = ri(8, 40); const hm = v0 * v0 / (2 * g); return num('freefall', R`A ball is thrown straight up at $${v0}$ m/s. How high (m) above the launch point does it rise?`, hm, s3(hm), R`$0 = v_0^2 - 2gh \Rightarrow h = \frac{v_0^2}{2g} = \frac{${v0}^2}{19.6} = ${s3(hm)}$ m.`); }
    if (k === 3) { const v0 = ri(8, 40); return num('freefall', R`A ball is thrown straight up at $${v0}$ m/s. How long (s) until it returns to the launch height?`, 2 * v0 / g, s3(2 * v0 / g), R`Time to the top $v_0/g = ${s3(v0 / g)}$ s; total flight is twice that: $${s3(2 * v0 / g)}$ s.`); }
    if (k === 4) { const v0 = ri(5, 20), h = ri(10, 80); const v = Math.sqrt(v0 * v0 + 2 * g * h); return num('freefall', R`A ball is thrown straight <b>down</b> at $${v0}$ m/s from a height of $${h}$ m. Find its speed (m/s) when it hits the ground.`, v, s3(v), R`$v^2 = v_0^2 + 2gh = ${v0}^2 + 2(9.8)(${h}) = ${s3(v * v)} \Rightarrow v = ${s3(v)}$ m/s.`); }
    const v0 = ri(5, 20), h = ri(10, 60); const t = (v0 + Math.sqrt(v0 * v0 + 2 * g * h)) / g; return num('freefall', R`A ball is thrown straight <b>up</b> at $${v0}$ m/s from the top of a $${h}$ m building and lands on the ground. Find the time (s) in the air.`, t, s3(t), R`With up positive and the ground at $y=0$: $0 = ${h} + ${v0}t - 4.9t^2$. Quadratic formula: $t = \frac{${v0} + \sqrt{${v0}^2 + 4(4.9)(${h})}}{9.8} = ${s3(t)}$ s (keep the positive root).`, 'Set y = 0 at the ground and solve the quadratic.');
  }
  function qKin2d() {
    if (Math.random() < 0.5) { const dx = ri(-20, 20), dy = ri(-20, 20), dt = ri(2, 10); const v = Math.hypot(dx, dy) / dt; return num('kin2d', R`A hiker's displacement is $(${dx}, ${dy})$ m over $${dt}$ s. Find the magnitude of the average velocity (m/s).`, v, s3(v), R`$|\Delta\vec r| = \sqrt{${dx}^2 + ${dy}^2} = ${s3(Math.hypot(dx, dy))}$ m; divide by $${dt}$ s: $${s3(v)}$ m/s.`); }
    const vx = ri(5, 25), vy = ri(5, 25), dt = ri(2, 10); const a = Math.hypot(vx, vy) / dt;
    return num('kin2d', R`A car's velocity changes from $${vx}$ m/s east to $${vy}$ m/s north in $${dt}$ s. Find the magnitude of its average acceleration ($\text{m/s}^2$).`, a, s3(a), R`$\Delta\vec v = (0 - ${vx},\ ${vy} - 0)$, magnitude $\sqrt{${vx}^2 + ${vy}^2} = ${s3(Math.hypot(vx, vy))}$ m/s; divide by $${dt}$ s: $${s3(a)}\ \text{m/s}^2$.`, 'Subtract vectors component by component before dividing by time.');
  }
  function qProjectile() {
    const k = ri(0, 6);
    const v0 = ri(10, 40), th = pick([20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70]);
    const vx = v0 * Math.cos(rad(th)), vy = v0 * Math.sin(rad(th));
    if (k === 0) { const Rr = v0 * v0 * Math.sin(rad(2 * th)) / g; return num('projectile', R`A ball is launched at $${v0}$ m/s at $${th}^\circ$ above horizontal on level ground. Find the horizontal range (m).`, Rr, s3(Rr), R`$R = \frac{v_0^2\sin2\theta}{g} = \frac{${v0}^2\sin${2 * th}^\circ}{9.8} = ${s3(Rr)}$ m. (Or: $T = 2v_0\sin\theta/g = ${s3(2 * vy / g)}$ s and $R = v_0\cos\theta\,T$.)`); }
    if (k === 1) { const T = 2 * vy / g; return num('projectile', R`A ball is launched at $${v0}$ m/s at $${th}^\circ$ above horizontal on level ground. Find the time of flight (s).`, T, s3(T), R`$v_{0y} = ${v0}\sin${th}^\circ = ${s3(vy)}$ m/s; $T = 2v_{0y}/g = ${s3(T)}$ s.`); }
    if (k === 2) { const H = vy * vy / (2 * g); return num('projectile', R`A ball is launched at $${v0}$ m/s at $${th}^\circ$ above horizontal. Find the maximum height (m) above the launch point.`, H, s3(H), R`$H = \frac{v_{0y}^2}{2g} = \frac{(${s3(vy)})^2}{19.6} = ${s3(H)}$ m.`); }
    if (k === 3) { const h = ri(5, 80), u = ri(5, 30); const t = Math.sqrt(2 * h / g); return num('projectile', R`A ball rolls off a $${h}$ m cliff horizontally at $${u}$ m/s. How far (m) from the base does it land?`, u * t, s3(u * t), R`Vertical: $t = \sqrt{2h/g} = ${s3(t)}$ s. Horizontal: $x = v_0t = ${u}(${s3(t)}) = ${s3(u * t)}$ m.`, 'Time comes from the vertical motion; range from the horizontal.'); }
    if (k === 4) { const h = ri(5, 80), u = ri(5, 30); const v = Math.sqrt(u * u + 2 * g * h); return num('projectile', R`A ball rolls off a $${h}$ m cliff horizontally at $${u}$ m/s. Find its speed (m/s) just before landing.`, v, s3(v), R`$v_y = \sqrt{2gh} = ${s3(Math.sqrt(2 * g * h))}$ m/s, $v_x = ${u}$ m/s; $v = \sqrt{v_x^2 + v_y^2} = ${s3(v)}$ m/s. (Energy gives the same: $v^2 = v_0^2 + 2gh$.)`); }
    if (k === 5) return mc('projectile', R`A projectile launched at $${v0}$ m/s at $${th}^\circ$ reaches the top of its path. Its speed there is`, `${s3(vx)} m/s (only the horizontal component remains)`, ['0 m/s', `${v0} m/s (speed is constant)`, `${s3(vy)} m/s`], R`At the top $v_y = 0$ but $v_x = v_0\cos\theta = ${s3(vx)}$ m/s never changes.`);
    return mc('projectile', 'Ignoring air resistance, which statement about a projectile is TRUE?', 'Its horizontal velocity is constant and its vertical acceleration is g downward throughout', ['Its acceleration is zero at the top of the path', 'Its speed is constant throughout the flight', 'A heavier projectile launched the same way lands sooner'], 'Only gravity acts, so a = g downward always; there is no horizontal force. Mass does not matter.');
  }
  function qCircKin() {
    const k = ri(0, 4);
    if (k === 0) { const v = ri(5, 30), r = ri(10, 200); return num('circkin', R`A car rounds a curve of radius $${r}$ m at a steady $${v}$ m/s. Find its acceleration ($\text{m/s}^2$).`, v * v / r, s3(v * v / r), R`$a_c = v^2/r = ${v}^2/${r} = ${s3(v * v / r)}\ \text{m/s}^2$, directed toward the center of the curve.`); }
    if (k === 1) { const r = rnd(0.5, 5, 0.5), T = rnd(0.5, 4, 0.25); const v = 2 * Math.PI * r / T; return num('circkin', R`A point on a rotating platform moves in a circle of radius $${r}$ m with a period of $${T}$ s. Find its speed (m/s).`, v, s3(v), R`$v = 2\pi r/T = 2\pi(${r})/${T} = ${s3(v)}$ m/s.`); }
    if (k === 2) { const r = rnd(0.5, 5, 0.5), T = rnd(0.5, 4, 0.25); const a = 4 * Math.PI * Math.PI * r / (T * T); return num('circkin', R`An object moves on a circle of radius $${r}$ m with period $${T}$ s. Find its centripetal acceleration ($\text{m/s}^2$).`, a, s3(a), R`$a_c = 4\pi^2r/T^2 = ${s3(a)}\ \text{m/s}^2$.`); }
    if (k === 3) { const vb = ri(2, 6), vr = ri(1, 5), w = ri(50, 300); const which = ri(0, 2); if (which === 0) return num('circkin', R`A boat moves at $${vb}$ m/s relative to the water and heads straight across a river flowing at $${vr}$ m/s. The river is $${w}$ m wide. How long (s) does the crossing take?`, w / vb, s3(w / vb), R`Only the across-river component matters: $t = ${w}/${vb} = ${s3(w / vb)}$ s.`); if (which === 1) return num('circkin', R`A boat moves at $${vb}$ m/s relative to the water and heads straight across a river flowing at $${vr}$ m/s. The river is $${w}$ m wide. How far downstream (m) does it land?`, vr * w / vb, s3(vr * w / vb), R`$t = ${w}/${vb} = ${s3(w / vb)}$ s; drift $= v_{\text{river}}t = ${vr}(${s3(w / vb)}) = ${s3(vr * w / vb)}$ m.`); return num('circkin', R`A boat moves at $${vb}$ m/s relative to the water, heading straight across a river flowing at $${vr}$ m/s. Find the boat's speed relative to the ground (m/s).`, Math.hypot(vb, vr), s3(Math.hypot(vb, vr)), R`The velocities are perpendicular: $\sqrt{${vb}^2 + ${vr}^2} = ${s3(Math.hypot(vb, vr))}$ m/s.`); }
    return mc('circkin', 'A car drives around a circular track at constant speed. Its acceleration is', 'nonzero and directed toward the center', ['zero, because the speed is constant', 'directed along the velocity', 'directed away from the center'], 'The velocity vector changes direction, so there is an acceleration: v²/r toward the center.');
  }
  function qNewtonLaws() {
    const k = ri(0, 4);
    if (k === 0) { const F1 = ri(3, 20), F2 = ri(3, 20), m = ri(2, 10); const a = Math.hypot(F1, F2) / m; return num('newton-laws', R`Two forces act on a $${m}$ kg crate on frictionless ice: $${F1}$ N east and $${F2}$ N north. Find the magnitude of its acceleration ($\text{m/s}^2$).`, a, s3(a), R`$F_{\text{net}} = \sqrt{${F1}^2 + ${F2}^2} = ${s3(Math.hypot(F1, F2))}$ N; $a = F/m = ${s3(a)}\ \text{m/s}^2$, at $\tan^{-1}(${F2}/${F1}) = ${s3(Math.atan2(F2, F1) * 180 / Math.PI)}^\circ$ north of east.`); }
    if (k === 1) { const m = ri(2, 40), a = rnd(0.5, 5, 0.5); return num('newton-laws', R`What net force (N) is needed to give a $${m}$ kg object an acceleration of $${a}\ \text{m/s}^2$?`, m * a, s3(m * a), R`$F = ma = ${m}(${a}) = ${s3(m * a)}$ N.`); }
    if (k === 2) { const F = ri(10, 200), m = ri(2, 40); return num('newton-laws', R`A net force of $${F}$ N acts on a $${m}$ kg object. Find its acceleration ($\text{m/s}^2$).`, F / m, s3(F / m), R`$a = F/m = ${F}/${m} = ${s3(F / m)}\ \text{m/s}^2$.`); }
    if (k === 3) { const F = ri(10, 60); return num('newton-laws', R`A box slides across a rough floor at <b>constant velocity</b> while you push it with $${F}$ N. What is the magnitude of the friction force (N)?`, F, `${F}`, R`Constant velocity means zero net force (first law), so friction exactly balances the push: $${F}$ N.`); }
    const bank = [
      { q: 'A bug splatters on the windshield of a moving truck. During the collision,', ok: 'the bug and the truck exert forces of equal magnitude on each other', bad: ['the truck exerts a larger force on the bug', 'the bug exerts a larger force on the truck', 'only the truck exerts a force'], why: 'Third law: the forces are equal and opposite. The bug has a far larger acceleration because its mass is tiny.' },
      { q: 'The third-law partner of the normal force the floor exerts on you is', ok: 'the force your feet exert on the floor', bad: ['your weight', 'the force Earth exerts on you', 'the friction force on your shoes'], why: 'Pairs act on different bodies and are the same type of force (contact/contact). Weight is gravitational and acts on you, so it cannot be the partner.' },
      { q: 'A hockey puck slides on frictionless ice at constant velocity. The net force on it is', ok: 'zero', bad: ['in the direction of motion', 'opposite to the motion', 'downward'], why: 'Constant velocity requires zero net force (gravity and the normal force cancel).' },
      { q: 'You push a wall and it does not move. Newton’s third law says', ok: 'the wall pushes back on you with an equal and opposite force', bad: ['the wall exerts no force because it does not move', 'the wall exerts a smaller force because it is at rest', 'friction is what pushes back on you'], why: 'Every force is one half of an interaction; the wall pushes on you as hard as you push on it.' },
      { q: 'Which object has the most inertia?', ok: 'a 2000 kg truck at rest', bad: ['a 0.5 kg ball moving at 30 m/s', 'a 70 kg sprinter at 10 m/s', 'a 10 kg cannonball at 100 m/s'], why: 'Inertia is mass; motion does not affect it.' }
    ];
    const it = pick(bank); return mc('newton-laws', it.q, it.ok, it.bad, it.why);
  }
  function qForcesFbd() {
    const k = ri(0, 5);
    if (k === 0) { const m = ri(2, 90); return num('forces-fbd', R`What is the weight (N) of a $${m}$ kg object on Earth?`, m * g, s3(m * g), R`$w = mg = ${m}(9.8) = ${s3(m * g)}$ N.`); }
    if (k === 1) { const m = ri(2, 40), th = pick([15, 20, 25, 30, 35, 40, 45, 50, 60]); const N = m * g * Math.cos(rad(th)); return num('forces-fbd', R`A $${m}$ kg block rests on a $${th}^\circ$ incline. Find the normal force (N).`, N, s3(N), R`Perpendicular to the incline: $N = mg\cos\theta = ${m}(9.8)\cos${th}^\circ = ${s3(N)}$ N. (Not $mg$: part of the weight acts along the slope.)`, 'Tilt the axes; the normal force balances only the perpendicular part of the weight.'); }
    if (k === 2) { const m = ri(40, 100), a = rnd(0.5, 3, 0.5), up = Math.random() < 0.5; const N = m * (g + (up ? a : -a)); return num('forces-fbd', R`A $${m}$ kg person stands on a scale in an elevator accelerating ${up ? 'upward' : 'downward'} at $${a}\ \text{m/s}^2$. What does the scale read (N)?`, N, s3(N), R`$N - mg = ma$ with $a = ${up ? '+' : '-'}${a}$: $N = m(g ${up ? '+' : '-'} a) = ${m}(${s3(g + (up ? a : -a))}) = ${s3(N)}$ N. The scale reads the normal force, ${up ? 'more' : 'less'} than the weight.`); }
    if (k === 3) { const m = ri(5, 30), F = ri(10, 80), down = Math.random() < 0.5; const N = m * g + (down ? F : -F); if (N <= 0) return qForcesFbd(); return num('forces-fbd', R`A $${m}$ kg box sits on a table. Someone ${down ? 'pushes down' : 'pulls up'} on it with $${F}$ N (not enough to lift it). Find the normal force (N).`, N, s3(N), R`$N ${down ? '-' : '+'} ${F} - mg = 0 \Rightarrow N = ${s3(m * g)} ${down ? '+' : '-'} ${F} = ${s3(N)}$ N.`); }
    if (k === 4) { const m = ri(5, 40), th = pick([10, 15, 20, 30, 40, 45, 60]); const T = m * g / (2 * Math.sin(rad(th))); return num('forces-fbd', R`A $${m}$ kg sign hangs from two cables that each make $${th}^\circ$ with the horizontal. Find the tension in each cable (N).`, T, s3(T), R`Vertical equilibrium: $2T\sin${th}^\circ = mg \Rightarrow T = \frac{${s3(m * g)}}{2\sin${th}^\circ} = ${s3(T)}$ N.`, 'Only the vertical components of the two tensions hold the weight.'); }
    return mc('forces-fbd', 'A ball has been thrown upward and is at the top of its flight (ignore air). The forces acting on it are', 'gravity only, pointing down', ['gravity down and an upward "force of the throw"', 'no forces, because its velocity is zero', 'gravity down and a normal force up'], 'Once released, the only interaction is with Earth. There is no lingering push from the hand.');
  }

  /* ======================================================
     UNIT 2
     ====================================================== */
  function qApplyNewton() {
    const k = ri(0, 4);
    if (k === 0) { const th = pick([10, 15, 20, 25, 30, 35, 40, 45]); const a = g * Math.sin(rad(th)); return num('apply-newton', R`A block slides down a frictionless $${th}^\circ$ incline. Find its acceleration ($\text{m/s}^2$).`, a, s3(a), R`Along the slope: $mg\sin\theta = ma \Rightarrow a = g\sin${th}^\circ = ${s3(a)}\ \text{m/s}^2$, independent of mass.`); }
    if (k === 1) { const m1 = ri(1, 8), m2 = m1 + ri(1, 6); const a = (m2 - m1) * g / (m1 + m2); const T = 2 * m1 * m2 * g / (m1 + m2); if (Math.random() < 0.5) return num('apply-newton', R`Masses $${m1}$ kg and $${m2}$ kg hang from a massless string over an ideal pulley (Atwood machine). Find the magnitude of the acceleration ($\text{m/s}^2$).`, a, s3(a), R`$a = \frac{(m_2 - m_1)g}{m_1 + m_2} = \frac{(${m2 - m1})(9.8)}{${m1 + m2}} = ${s3(a)}\ \text{m/s}^2$.`, 'One Newton equation per mass; add them to cancel the tension.'); return num('apply-newton', R`Masses $${m1}$ kg and $${m2}$ kg hang over an ideal pulley. Find the tension in the string (N).`, T, s3(T), R`$a = ${s3(a)}\ \text{m/s}^2$; on the lighter mass $T - m_1g = m_1a \Rightarrow T = ${m1}(9.8 + ${s3(a)}) = ${s3(T)}$ N. Check: between $${s3(m1 * g)}$ N and $${s3(m2 * g)}$ N.`); }
    if (k === 2) { const m1 = ri(1, 10), m2 = ri(1, 10); const a = m2 * g / (m1 + m2); if (Math.random() < 0.5) return num('apply-newton', R`A $${m1}$ kg block on a frictionless table is connected by a string over a pulley to a hanging $${m2}$ kg mass. Find the acceleration ($\text{m/s}^2$).`, a, s3(a), R`Only the hanging weight drives the system: $a = \frac{m_2g}{m_1 + m_2} = \frac{${m2}(9.8)}{${m1 + m2}} = ${s3(a)}\ \text{m/s}^2$.`); return num('apply-newton', R`A $${m1}$ kg block on a frictionless table is pulled by a string attached to a hanging $${m2}$ kg mass. Find the tension (N).`, m1 * a, s3(m1 * a), R`$a = ${s3(a)}\ \text{m/s}^2$; the tension is the only horizontal force on the block: $T = m_1a = ${s3(m1 * a)}$ N.`); }
    if (k === 3) { const F = ri(10, 60), m1 = ri(2, 8), m2 = ri(1, 6); const a = F / (m1 + m2); return num('apply-newton', R`A $${F}$ N horizontal force pushes a $${m1}$ kg block that is in contact with a $${m2}$ kg block on a frictionless floor. Find the force (N) the first block exerts on the second.`, m2 * a, s3(m2 * a), R`Whole system: $a = ${F}/${m1 + m2} = ${s3(a)}\ \text{m/s}^2$. The second block is pushed only by the contact force: $F_c = m_2a = ${s3(m2 * a)}$ N.`, 'Find a from the whole system, then isolate the block that only feels the contact force.'); }
    const m = ri(20, 80), a = rnd(0.5, 3, 0.5); return num('apply-newton', R`A $${m}$ kg load hangs from a crane cable and accelerates upward at $${a}\ \text{m/s}^2$. Find the cable tension (N).`, m * (g + a), s3(m * (g + a)), R`$T - mg = ma \Rightarrow T = m(g + a) = ${m}(${s3(g + a)}) = ${s3(m * (g + a))}$ N.`);
  }
  function qFriction() {
    const k = ri(0, 5);
    if (k === 0) { const m = ri(5, 60), mu = rnd(0.2, 0.8, 0.05); const f = mu * m * g; return num('friction', R`A $${m}$ kg crate rests on a horizontal floor with $\mu_s = ${mu}$. What is the largest horizontal push (N) it can withstand without sliding?`, f, s3(f), R`$f_{s,\max} = \mu_sN = \mu_smg = ${mu}(${m})(9.8) = ${s3(f)}$ N.`); }
    if (k === 1) { const mu = rnd(0.1, 0.7, 0.05); return num('friction', R`A puck slides on a horizontal surface with $\mu_k = ${mu}$. Find the magnitude of its deceleration ($\text{m/s}^2$).`, mu * g, s3(mu * g), R`$f_k = \mu_kmg = ma \Rightarrow a = \mu_kg = ${mu}(9.8) = ${s3(mu * g)}\ \text{m/s}^2$ (mass cancels).`); }
    if (k === 2) { const v0 = ri(5, 30), mu = rnd(0.1, 0.8, 0.05); const d = v0 * v0 / (2 * mu * g); return num('friction', R`A car skids to a stop from $${v0}$ m/s with $\mu_k = ${mu}$. How far (m) does it skid?`, d, s3(d), R`$a = \mu_kg = ${s3(mu * g)}\ \text{m/s}^2$; $d = \frac{v_0^2}{2a} = \frac{${v0}^2}{2(${s3(mu * g)})} = ${s3(d)}$ m.`); }
    if (k === 3) { const th = pick([10, 15, 20, 25, 30, 35, 40]); return num('friction', R`A box just barely stays at rest on a $${th}^\circ$ incline. Find the coefficient of static friction.`, Math.tan(rad(th)), s3(Math.tan(rad(th))), R`On the verge of slipping: $\mu_smg\cos\theta = mg\sin\theta \Rightarrow \mu_s = \tan${th}^\circ = ${s3(Math.tan(rad(th)))}$.`); }
    if (k === 4) { const m = ri(5, 30), mu = rnd(0.1, 0.5, 0.05), F = ri(40, 200); const a = (F - mu * m * g) / m; if (a <= 0.3) return qFriction(); return num('friction', R`A $${m}$ kg box is pulled horizontally with $${F}$ N across a floor with $\mu_k = ${mu}$. Find its acceleration ($\text{m/s}^2$).`, a, s3(a), R`$f_k = \mu_kmg = ${s3(mu * m * g)}$ N; $a = \frac{F - f_k}{m} = \frac{${F} - ${s3(mu * m * g)}}{${m}} = ${s3(a)}\ \text{m/s}^2$.`); }
    const m = ri(5, 30), mus = rnd(0.3, 0.7, 0.05), F = ri(20, 200); const fmax = mus * m * g; const moves = F > fmax;
    return mc('friction', R`A $${m}$ kg crate rests on a floor with $\mu_s = ${mus}$. You push horizontally with $${F}$ N. What happens?`, moves ? `It slides, because ${F} N exceeds the maximum static friction of ${s3(fmax)} N` : `It stays put, and static friction is exactly ${F} N`, moves ? [`It stays put, and static friction is exactly ${F} N`, `It stays put, and static friction is ${s3(fmax)} N`, 'It slides, because any push overcomes static friction'] : [`It slides, because ${F} N exceeds the maximum static friction of ${s3(fmax)} N`, `It stays put, and static friction is ${s3(fmax)} N`, 'It slides at constant velocity'], R`$f_{s,\max} = \mu_smg = ${s3(fmax)}$ N. ${moves ? 'The push is larger, so it breaks free and kinetic friction takes over.' : 'The push is smaller, so static friction rises to match it exactly (not to its maximum).'}`, 'Static friction is an inequality: it equals the applied force until the maximum is reached.');
  }
  function qCircDyn() {
    const k = ri(0, 5);
    if (k === 0) { const m = ri(1, 1500), v = ri(5, 30), r = ri(5, 100); const F = m * v * v / r; return num('circ-dyn', R`A $${m}$ kg object moves at $${v}$ m/s in a circle of radius $${r}$ m. What net inward force (N) is required?`, F, s3(F), R`$F = mv^2/r = ${m}(${v})^2/${r} = ${s3(F)}$ N toward the center.`); }
    if (k === 1) { const mu = rnd(0.2, 0.9, 0.05), r = ri(20, 200); const v = Math.sqrt(mu * g * r); return num('circ-dyn', R`A flat curve has radius $${r}$ m and $\mu_s = ${mu}$ between tires and road. Find the maximum speed (m/s) to round it without skidding.`, v, s3(v), R`Friction supplies the centripetal force: $\mu_smg = mv^2/r \Rightarrow v = \sqrt{\mu_sgr} = \sqrt{${mu}(9.8)(${r})} = ${s3(v)}$ m/s (mass cancels).`); }
    if (k === 2) { const m = rnd(0.2, 3, 0.1), v = ri(2, 8), r = rnd(0.5, 2, 0.1); const T = m * (g + v * v / r); return num('circ-dyn', R`A $${m}$ kg ball on a $${r}$ m string swings in a vertical circle. At the bottom its speed is $${v}$ m/s. Find the tension (N) there.`, T, s3(T), R`At the bottom, inward is up: $T - mg = mv^2/r \Rightarrow T = m(g + v^2/r) = ${m}(9.8 + ${s3(v * v / r)}) = ${s3(T)}$ N.`, 'At the bottom the tension must supply the centripetal force AND hold up the weight.'); }
    if (k === 3) { const r = rnd(2, 20, 0.5); return num('circ-dyn', R`A roller-coaster car goes over the top of a loop of radius $${r}$ m. What minimum speed (m/s) keeps it on the track?`, Math.sqrt(g * r), s3(Math.sqrt(g * r)), R`At the minimum speed the normal force is zero and gravity alone provides $mv^2/r$: $v = \sqrt{gr} = \sqrt{9.8(${r})} = ${s3(Math.sqrt(g * r))}$ m/s.`); }
    if (k === 4) { const v = ri(10, 40), r = ri(30, 300); const th = Math.atan(v * v / (r * g)) * 180 / Math.PI; return num('circ-dyn', R`At what banking angle (degrees) can a car round a frictionless curve of radius $${r}$ m at $${v}$ m/s?`, th, s3(th), R`$\tan\theta = \frac{v^2}{rg} = \frac{${v}^2}{${r}(9.8)} = ${s3(v * v / (r * g))} \Rightarrow \theta = ${s3(th)}^\circ$.`); }
    return mc('circ-dyn', 'A skydiver has reached terminal velocity. Which is true?', 'The drag force equals her weight and her acceleration is zero', ['The drag force exceeds her weight, so she is slowing down', 'Her acceleration is g downward', 'The net force is her weight'], 'Terminal velocity means constant velocity: net force zero, drag = mg.');
  }
  function qStatics() {
    const k = ri(0, 3);
    if (k === 0) { const m1 = ri(20, 60), d1 = rnd(1, 3, 0.5), m2 = ri(20, 80); const d2 = m1 * d1 / m2; return num('statics', R`A $${m1}$ kg child sits $${d1}$ m from the pivot of a seesaw. How far (m) on the other side must a $${m2}$ kg child sit to balance it?`, d2, s3(d2), R`Torques balance: $m_1gd_1 = m_2gd_2 \Rightarrow d_2 = \frac{${m1}(${d1})}{${m2}} = ${s3(d2)}$ m.`); }
    if (k === 1) { const F = ri(10, 100), r = rnd(0.2, 2, 0.1), th = pick([30, 45, 60, 90, 120, 150]); const tau = r * F * Math.sin(rad(th)); return num('statics', R`A $${F}$ N force is applied $${r}$ m from a pivot, at $${th}^\circ$ to the lever arm. Find the torque magnitude (N·m).`, tau, s3(tau), R`$\tau = rF\sin\theta = ${r}(${F})\sin${th}^\circ = ${s3(tau)}$ N·m.${th === 90 ? ' A perpendicular force gives the maximum torque.' : ''}`); }
    if (k === 2) { const L = ri(4, 10), M = ri(10, 40), m = ri(40, 90), d = rnd(1, L - 1, 0.5); const FR = (M * g * L / 2 + m * g * d) / L; const FL = (M + m) * g - FR; const wantR = Math.random() < 0.5; return num('statics', R`A uniform $${L}$ m plank of mass $${M}$ kg rests on supports at both ends. A $${m}$ kg person stands $${d}$ m from the left end. Find the force (N) from the ${wantR ? 'right' : 'left'} support.`, wantR ? FR : FL, s3(wantR ? FR : FL), R`Torques about the left end: $F_R(${L}) = ${M}(9.8)(${L / 2}) + ${m}(9.8)(${d}) \Rightarrow F_R = ${s3(FR)}$ N. Then $F_L = (${M} + ${m})(9.8) - F_R = ${s3(FL)}$ N.`, 'Take torques about one support so its unknown force drops out.'); }
    return mc('statics', 'For an extended object to be in static equilibrium, which must hold?', 'Both the net force and the net torque (about any axis) must be zero', ['Only the net force must be zero', 'Only the net torque must be zero', 'The object must be symmetric'], 'Zero net force prevents translation; zero net torque prevents rotation. Both are required.');
  }
  function qFluids() {
    const k = ri(0, 6);
    if (k === 0) { const h = ri(2, 40); return num('fluids', R`Find the gauge pressure (Pa) at a depth of $${h}$ m in fresh water.`, RHO_W * g * h, s3(RHO_W * g * h), R`$P_{\text{gauge}} = \rho gh = 1000(9.8)(${h}) = ${s3(RHO_W * g * h)}$ Pa.`); }
    if (k === 1) { const h = ri(2, 40); const P = P0 + RHO_W * g * h; return num('fluids', R`Find the absolute pressure (Pa) at a depth of $${h}$ m in fresh water ($P_0 = 1.013\times10^5$ Pa).`, P, s3(P), R`$P = P_0 + \rho gh = 1.013\times10^5 + ${s3(RHO_W * g * h)} = ${s3(P)}$ Pa.`); }
    if (k === 2) { const F1 = ri(50, 500), A1 = rnd(0.005, 0.05, 0.005), A2 = rnd(0.1, 0.5, 0.05); const F2 = F1 * A2 / A1; return num('fluids', R`In a hydraulic lift a $${F1}$ N force is applied to a piston of area $${A1}\ \text{m}^2$. What force (N) appears at the $${A2}\ \text{m}^2$ piston?`, F2, s3(F2), R`Pascal: $\frac{F_1}{A_1} = \frac{F_2}{A_2} \Rightarrow F_2 = ${F1}\cdot\frac{${A2}}{${A1}} = ${s3(F2)}$ N.`); }
    if (k === 3) { const V = rnd(0.5, 20, 0.5); const F = RHO_W * (V / 1000) * g; return num('fluids', R`A $${V}$ L object is fully submerged in water. Find the buoyant force on it (N). (1 L = $10^{-3}\ \text{m}^3$)`, F, s3(F), R`$F_B = \rho_wVg = 1000(${V}\times10^{-3})(9.8) = ${s3(F)}$ N, regardless of what the object is made of.`); }
    if (k === 4) { const rho = ri(2, 9) * 100; return num('fluids', R`A block of density $${rho}\ \text{kg/m}^3$ floats in water. What fraction of its volume is submerged?`, rho / RHO_W, s3(rho / RHO_W), R`Floating: $\rho_{\text{obj}}Vg = \rho_wV_{\text{sub}}g \Rightarrow V_{\text{sub}}/V = \rho_{\text{obj}}/\rho_w = ${rho}/1000 = ${s3(rho / RHO_W)}$.`); }
    if (k === 5) { const m = rnd(0.5, 10, 0.5), rho = ri(15, 90) * 100; const Fb = RHO_W * (m / rho) * g; const app = m * g - Fb; return num('fluids', R`A $${m}$ kg object of density $${rho}\ \text{kg/m}^3$ hangs from a scale while fully submerged in water. What does the scale read (N)?`, app, s3(app), R`$V = m/\rho = ${s3(m / rho)}\ \text{m}^3$; $F_B = \rho_wVg = ${s3(Fb)}$ N; scale reads $mg - F_B = ${s3(m * g)} - ${s3(Fb)} = ${s3(app)}$ N.`, 'Apparent weight = true weight − buoyant force.'); }
    const m = ri(1, 20), V = rnd(0.001, 0.02, 0.001); return num('fluids', R`An object has mass $${m}$ kg and volume $${V}\ \text{m}^3$. Find its density ($\text{kg/m}^3$).`, m / V, s3(m / V), R`$\rho = m/V = ${m}/${V} = ${s3(m / V)}\ \text{kg/m}^3$ (${m / V > 1000 ? 'sinks' : 'floats'} in water).`);
  }
  function qRotKin() {
    const k = ri(0, 5);
    if (k === 0) { const rpm = ri(1, 60) * 100; const w = rpm * 2 * Math.PI / 60; return num('rot-kin', R`Convert $${rpm}$ rpm to rad/s.`, w, s3(w), R`$\omega = ${rpm}\ \frac{\text{rev}}{\text{min}}\times\frac{2\pi\ \text{rad}}{\text{rev}}\times\frac{1\ \text{min}}{60\ \text{s}} = ${s3(w)}$ rad/s.`); }
    if (k === 1) { const w0 = ri(0, 20), w = w0 + ri(5, 60), t = ri(2, 20); return num('rot-kin', R`A wheel's angular speed rises from $${w0}$ rad/s to $${w}$ rad/s in $${t}$ s. Find its angular acceleration ($\text{rad/s}^2$).`, (w - w0) / t, s3((w - w0) / t), R`$\alpha = \Delta\omega/\Delta t = (${w} - ${w0})/${t} = ${s3((w - w0) / t)}\ \text{rad/s}^2$.`); }
    if (k === 2) { const w0 = ri(0, 10), al = ri(1, 8), t = ri(2, 10); const th = w0 * t + 0.5 * al * t * t; return num('rot-kin', R`A disk starts at $${w0}$ rad/s and accelerates at $${al}\ \text{rad/s}^2$ for $${t}$ s. How many revolutions does it make?`, th / (2 * Math.PI), s3(th / (2 * Math.PI)), R`$\theta = \omega_0t + \tfrac12\alpha t^2 = ${w0}(${t}) + \tfrac12(${al})(${t})^2 = ${s3(th)}$ rad $= ${s3(th / (2 * Math.PI))}$ rev.`); }
    if (k === 3) { const r = rnd(0.1, 1, 0.05), w = ri(2, 40); return num('rot-kin', R`A point $${r}$ m from the axis of a wheel spinning at $${w}$ rad/s has what speed (m/s)?`, r * w, s3(r * w), R`$v = r\omega = ${r}(${w}) = ${s3(r * w)}$ m/s.`); }
    if (k === 4) { const r = rnd(0.1, 1, 0.05), w = ri(2, 40); return num('rot-kin', R`A point $${r}$ m from the axis of a wheel spinning at $${w}$ rad/s has what centripetal acceleration ($\text{m/s}^2$)?`, r * w * w, s3(r * w * w), R`$a_c = r\omega^2 = ${r}(${w})^2 = ${s3(r * w * w)}\ \text{m/s}^2$.`); }
    const r = rnd(0.1, 1, 0.05), al = ri(1, 20); return num('rot-kin', R`A wheel of radius $${r}$ m has angular acceleration $${al}\ \text{rad/s}^2$. Find the tangential acceleration ($\text{m/s}^2$) of a point on its rim.`, r * al, s3(r * al), R`$a_t = r\alpha = ${r}(${al}) = ${s3(r * al)}\ \text{m/s}^2$.`);
  }
  function qWork() {
    const k = ri(0, 5);
    if (k === 0) { const F = ri(10, 200), d = ri(2, 30), th = pick([0, 20, 30, 37, 45, 60]); const W = F * d * Math.cos(rad(th)); return num('work-energy', R`A $${F}$ N force pulls a sled $${d}$ m along the ground while directed $${th}^\circ$ above horizontal. Find the work done by the force (J).`, W, s3(W), R`$W = Fd\cos\theta = ${F}(${d})\cos${th}^\circ = ${s3(W)}$ J.`); }
    if (k === 1) { const mu = rnd(0.1, 0.6, 0.05), m = ri(5, 60), d = ri(2, 30); const W = -mu * m * g * d; return num('work-energy', R`A $${m}$ kg crate is dragged $${d}$ m across a floor with $\mu_k = ${mu}$. Find the (signed) work done by friction (J).`, W, s3(W), R`$f_k = \mu_kmg = ${s3(mu * m * g)}$ N opposite the motion, so $W = -f_kd = ${s3(W)}$ J (negative: it removes kinetic energy).`); }
    if (k === 2) { const m = ri(1, 50), v0 = ri(0, 10), W = ri(50, 800); const vf = Math.sqrt(v0 * v0 + 2 * W / m); return num('work-energy', R`A $${m}$ kg object moving at $${v0}$ m/s has $${W}$ J of net work done on it. Find its final speed (m/s).`, vf, s3(vf), R`$W_{\text{net}} = \tfrac12mv_f^2 - \tfrac12mv_0^2 \Rightarrow v_f = \sqrt{v_0^2 + 2W/m} = \sqrt{${v0}^2 + 2(${W})/${m}} = ${s3(vf)}$ m/s.`, 'Work–energy theorem.'); }
    if (k === 3) { const m = rnd(0.1, 80, 0.1), v = ri(2, 40); return num('work-energy', R`Find the kinetic energy (J) of a $${m}$ kg object moving at $${v}$ m/s.`, 0.5 * m * v * v, s3(0.5 * m * v * v), R`$K = \tfrac12mv^2 = \tfrac12(${m})(${v})^2 = ${s3(0.5 * m * v * v)}$ J.`); }
    if (k === 4) { const m = ri(20, 500), h = ri(2, 40), t = ri(2, 60); const P = m * g * h / t; return num('work-energy', R`A motor lifts a $${m}$ kg load $${h}$ m in $${t}$ s at constant speed. Find the power output (W).`, P, s3(P), R`$P = \frac{W}{t} = \frac{mgh}{t} = \frac{${m}(9.8)(${h})}{${t}} = ${s3(P)}$ W.`); }
    const F = ri(100, 3000), v = ri(2, 30); return num('work-energy', R`A car engine supplies a $${F}$ N forward force while the car moves at a steady $${v}$ m/s. Find the power delivered (W).`, F * v, s3(F * v), R`$P = Fv = ${F}(${v}) = ${s3(F * v)}$ W $= ${s3(F * v / 746)}$ hp.`);
  }
  function qEnergy() {
    const k = ri(0, 5);
    if (k === 0) { const h = rnd(1, 40, 0.5); return num('energy-cons', R`A child starts from rest at the top of a frictionless slide $${h}$ m high. Find her speed (m/s) at the bottom.`, Math.sqrt(2 * g * h), s3(Math.sqrt(2 * g * h)), R`$mgh = \tfrac12mv^2 \Rightarrow v = \sqrt{2gh} = \sqrt{2(9.8)(${h})} = ${s3(Math.sqrt(2 * g * h))}$ m/s, whatever the slide's shape.`); }
    if (k === 1) { const v = ri(3, 30); return num('energy-cons', R`A ball is launched upward at $${v}$ m/s along a frictionless ramp. What height (m) does it reach?`, v * v / (2 * g), s3(v * v / (2 * g)), R`$\tfrac12mv^2 = mgh \Rightarrow h = \frac{v^2}{2g} = \frac{${v}^2}{19.6} = ${s3(v * v / (2 * g))}$ m.`); }
    if (k === 2) { const kk = ri(50, 2000), x = rnd(0.02, 0.3, 0.01); return num('energy-cons', R`A spring with $k = ${kk}$ N/m is compressed $${x}$ m. How much energy (J) does it store?`, 0.5 * kk * x * x, s3(0.5 * kk * x * x), R`$U_s = \tfrac12kx^2 = \tfrac12(${kk})(${x})^2 = ${s3(0.5 * kk * x * x)}$ J.`); }
    if (k === 3) { const kk = ri(100, 2000), x = rnd(0.05, 0.3, 0.01), m = rnd(0.1, 2, 0.1); const v = x * Math.sqrt(kk / m); return num('energy-cons', R`A $${m}$ kg cart is pushed against a spring ($k = ${kk}$ N/m), compressing it $${x}$ m, then released on a frictionless track. Find the cart's speed (m/s) after leaving the spring.`, v, s3(v), R`$\tfrac12kx^2 = \tfrac12mv^2 \Rightarrow v = x\sqrt{k/m} = ${x}\sqrt{${kk}/${m}} = ${s3(v)}$ m/s.`); }
    if (k === 4) { const m = ri(1, 60), v0 = ri(5, 30), v = ri(1, v0 - 2); const lost = 0.5 * m * (v0 * v0 - v * v); return num('energy-cons', R`A $${m}$ kg sled slows from $${v0}$ m/s to $${v}$ m/s on level snow. How much mechanical energy (J) was converted to thermal energy by friction?`, lost, s3(lost), R`$|\Delta K| = \tfrac12m(v_0^2 - v^2) = \tfrac12(${m})(${v0 * v0} - ${v * v}) = ${s3(lost)}$ J.`); }
    return mc('energy-cons', 'Mechanical energy (K + U) of a system is conserved when', 'only conservative forces (gravity, ideal springs) do work', ['the net force is zero', 'friction acts but the object moves slowly', 'the object moves in a circle'], 'Non-conservative forces such as friction or air drag convert mechanical energy to thermal energy.');
  }

  /* ======================================================
     UNIT 3
     ====================================================== */
  function qMomentum() {
    const k = ri(0, 4);
    if (k === 0) { const m = rnd(0.1, 90, 0.1), v = ri(1, 40); return num('momentum', R`Find the momentum (kg·m/s) of a $${m}$ kg object moving at $${v}$ m/s.`, m * v, s3(m * v), R`$p = mv = ${m}(${v}) = ${s3(m * v)}$ kg·m/s.`); }
    if (k === 1) { const F = ri(10, 800), t = rnd(0.01, 0.5, 0.01); return num('momentum', R`A $${F}$ N average force acts for $${t}$ s. Find the impulse (N·s).`, F * t, s3(F * t), R`$J = F_{\text{avg}}\Delta t = ${F}(${t}) = ${s3(F * t)}$ N·s, equal to the change in momentum.`); }
    if (k === 2) { const m = rnd(0.05, 1, 0.05), v = ri(5, 40), t = rnd(0.005, 0.05, 0.005); const F = 2 * m * v / t; return num('momentum', R`A $${m}$ kg ball hits a wall at $${v}$ m/s and rebounds at the same speed. Contact lasts $${t}$ s. Find the average force (N) on the ball.`, F, s3(F), R`$\Delta p = m(v - (-v)) = 2mv = ${s3(2 * m * v)}$ kg·m/s (the velocity reverses). $F = \Delta p/\Delta t = ${s3(F)}$ N.`, 'The momentum change is 2mv because the direction flips.'); }
    if (k === 3) { const m = rnd(0.5, 10, 0.5), v1 = ri(-10, 10), v2 = ri(-10, 10); if (v1 === v2) return qMomentum(); return num('momentum', R`A $${m}$ kg cart's velocity changes from $${v1}$ m/s to $${v2}$ m/s. Find the impulse delivered (signed, N·s).`, m * (v2 - v1), s3(m * (v2 - v1)), R`$J = \Delta p = m(v_2 - v_1) = ${m}(${v2} - (${v1})) = ${s3(m * (v2 - v1))}$ N·s.`); }
    const mb = rnd(0.005, 0.05, 0.005), vb = ri(200, 900), mg = rnd(1, 6, 0.5); const vg = mb * vb / mg; return num('momentum', R`A $${mg}$ kg rifle fires a $${mb}$ kg bullet at $${vb}$ m/s. Find the recoil speed (m/s) of the rifle.`, vg, s3(vg), R`Momentum starts at zero: $m_gv_g = m_bv_b \Rightarrow v_g = \frac{${mb}(${vb})}{${mg}} = ${s3(vg)}$ m/s, opposite the bullet.`);
  }
  function qCollisions() {
    const k = ri(0, 4);
    if (k === 0) { const m1 = ri(1, 10), v1 = ri(2, 12), m2 = ri(1, 10), v2 = pick([0, 0, -ri(1, 8), ri(1, 5)]); const vf = (m1 * v1 + m2 * v2) / (m1 + m2); return num('collisions', R`A $${m1}$ kg cart moving at $${v1}$ m/s collides with a $${m2}$ kg cart moving at $${v2}$ m/s and they stick together. Find their common velocity (signed, m/s).`, vf, s3(vf), R`$v_f = \frac{m_1v_1 + m_2v_2}{m_1 + m_2} = \frac{${m1}(${v1}) + ${m2}(${v2})}{${m1 + m2}} = ${s3(vf)}$ m/s.`); }
    if (k === 1) { const m1 = ri(1, 10), m2 = ri(1, 10), v1 = ri(2, 12); const v1f = (m1 - m2) / (m1 + m2) * v1, v2f = 2 * m1 / (m1 + m2) * v1; const wantTarget = Math.random() < 0.5; return num('collisions', R`A $${m1}$ kg ball at $${v1}$ m/s makes a head-on <b>elastic</b> collision with a $${m2}$ kg ball at rest. Find the final velocity (signed, m/s) of the ${wantTarget ? 'target' : 'incoming'} ball.`, wantTarget ? v2f : v1f, s3(wantTarget ? v2f : v1f), R`Elastic, target at rest: $v_{1f} = \frac{m_1 - m_2}{m_1 + m_2}v_1 = ${s3(v1f)}$ m/s, $v_{2f} = \frac{2m_1}{m_1 + m_2}v_1 = ${s3(v2f)}$ m/s.${m1 === m2 ? ' Equal masses swap velocities.' : ''}`); }
    if (k === 2) { const m1 = ri(1, 10), v1 = ri(2, 12), m2 = ri(1, 10); const vf = m1 * v1 / (m1 + m2); const lost = 0.5 * m1 * v1 * v1 - 0.5 * (m1 + m2) * vf * vf; return num('collisions', R`A $${m1}$ kg cart at $${v1}$ m/s hits a $${m2}$ kg cart at rest and they stick. How much kinetic energy (J) is lost?`, lost, s3(lost), R`$v_f = ${s3(vf)}$ m/s. $K_i = \tfrac12(${m1})(${v1})^2 = ${s3(0.5 * m1 * v1 * v1)}$ J; $K_f = \tfrac12(${m1 + m2})(${s3(vf)})^2 = ${s3(0.5 * (m1 + m2) * vf * vf)}$ J; lost $${s3(lost)}$ J (${s3(100 * lost / (0.5 * m1 * v1 * v1))}%).`); }
    if (k === 3) { const m1 = ri(1, 10), x1 = ri(-5, 5), m2 = ri(1, 10), x2 = ri(-5, 5); if (x1 === x2) return qCollisions(); const xc = (m1 * x1 + m2 * x2) / (m1 + m2); return num('collisions', R`A $${m1}$ kg mass is at $x = ${x1}$ m and a $${m2}$ kg mass at $x = ${x2}$ m. Find the center of mass (m).`, xc, s3(xc), R`$x_{cm} = \frac{m_1x_1 + m_2x_2}{m_1 + m_2} = \frac{${m1}(${x1}) + ${m2}(${x2})}{${m1 + m2}} = ${s3(xc)}$ m (closer to the heavier mass).`); }
    return mc('collisions', 'In a collision between two carts on a frictionless track (no external horizontal forces), which is ALWAYS true?', 'Total momentum is conserved', ['Total kinetic energy is conserved', 'Each cart keeps its own momentum', 'The carts end with equal speeds'], 'Momentum conservation only needs zero net external force. Kinetic energy is conserved only in elastic collisions.');
  }
  function qRotDyn() {
    const k = ri(0, 6);
    if (k === 0) { const m1 = ri(1, 5), r1 = rnd(0.2, 1, 0.1), m2 = ri(1, 5), r2 = rnd(0.2, 1, 0.1); const I = m1 * r1 * r1 + m2 * r2 * r2; return num('rot-dyn', R`Two small masses, $${m1}$ kg at $${r1}$ m and $${m2}$ kg at $${r2}$ m from an axis, are joined by a massless rod. Find the moment of inertia ($\text{kg·m}^2$) about that axis.`, I, s3(I), R`$I = \sum m_ir_i^2 = ${m1}(${r1})^2 + ${m2}(${r2})^2 = ${s3(I)}\ \text{kg·m}^2$.`); }
    if (k === 1) { const shapes = [['solid disk', 0.5], ['solid sphere', 0.4], ['thin hoop', 1], ['thin spherical shell', 2 / 3]]; const sh = pick(shapes); const M = ri(1, 20), Rr = rnd(0.1, 1, 0.05); const I = sh[1] * M * Rr * Rr; return num('rot-dyn', R`Find the moment of inertia ($\text{kg·m}^2$) of a ${sh[0]} of mass $${M}$ kg and radius $${Rr}$ m about its central axis.`, I, s3(I), R`$I = ${sh[1] === 0.5 ? '\\tfrac12' : sh[1] === 0.4 ? '\\tfrac25' : sh[1] === 1 ? '' : '\\tfrac23'}MR^2 = ${s3(I)}\ \text{kg·m}^2$.`, 'Hoop MR², disk ½MR², solid sphere ⅖MR², shell ⅔MR².'); }
    if (k === 2) { const tau = ri(2, 60), I = rnd(0.5, 10, 0.5); return num('rot-dyn', R`A net torque of $${tau}$ N·m acts on an object with $I = ${I}\ \text{kg·m}^2$. Find its angular acceleration ($\text{rad/s}^2$).`, tau / I, s3(tau / I), R`$\alpha = \tau/I = ${tau}/${I} = ${s3(tau / I)}\ \text{rad/s}^2$.`); }
    if (k === 3) { const F = ri(2, 40), M = ri(1, 20), Rr = rnd(0.1, 0.6, 0.05); const al = 2 * F / (M * Rr); return num('rot-dyn', R`A $${F}$ N tangential force is applied to the rim of a solid disk (mass $${M}$ kg, radius $${Rr}$ m) free to spin about its center. Find $\alpha$ ($\text{rad/s}^2$).`, al, s3(al), R`$\tau = FR = ${s3(F * Rr)}$ N·m, $I = \tfrac12MR^2 = ${s3(0.5 * M * Rr * Rr)}\ \text{kg·m}^2$, $\alpha = \tau/I = \frac{2F}{MR} = ${s3(al)}\ \text{rad/s}^2$.`); }
    if (k === 4) { const I = rnd(0.5, 10, 0.5), w = ri(2, 50); return num('rot-dyn', R`An object with $I = ${I}\ \text{kg·m}^2$ spins at $${w}$ rad/s. Find its rotational kinetic energy (J).`, 0.5 * I * w * w, s3(0.5 * I * w * w), R`$K = \tfrac12I\omega^2 = \tfrac12(${I})(${w})^2 = ${s3(0.5 * I * w * w)}$ J.`); }
    if (k === 5) { const tau = ri(2, 40), n = ri(1, 20); const W = tau * 2 * Math.PI * n; return num('rot-dyn', R`A constant torque of $${tau}$ N·m turns a shaft through $${n}$ revolutions. Find the work done (J).`, W, s3(W), R`$W = \tau\theta = ${tau}(2\pi\cdot${n}) = ${s3(W)}$ J.`); }
    return mc('rot-dyn', 'A solid sphere rolls without slipping. What fraction of its kinetic energy is rotational?', '2/7', ['1/2', '2/5', '1/3'], R`$K_{\text{rot}}/K = \frac{\tfrac12I\omega^2}{\tfrac12mv^2 + \tfrac12I\omega^2}$ with $I = \tfrac25mR^2$ and $v = R\omega$: $\frac{2/5}{1 + 2/5} = \frac27$. (Disk: 1/3, hoop: 1/2.)`);
  }
  function qAngMom() {
    const k = ri(0, 4);
    if (k === 0) { const I = rnd(0.5, 20, 0.5), w = ri(1, 40); return num('ang-mom', R`Find the angular momentum ($\text{kg·m}^2/\text{s}$) of a body with $I = ${I}\ \text{kg·m}^2$ rotating at $${w}$ rad/s.`, I * w, s3(I * w), R`$L = I\omega = ${I}(${w}) = ${s3(I * w)}\ \text{kg·m}^2/\text{s}$.`); }
    if (k === 1) { const m = rnd(0.1, 5, 0.1), v = ri(1, 30), r = rnd(0.5, 5, 0.5); return num('ang-mom', R`A $${m}$ kg particle moves at $${v}$ m/s in a circle of radius $${r}$ m. Find its angular momentum ($\text{kg·m}^2/\text{s}$) about the center.`, m * v * r, s3(m * v * r), R`$L = mvr\sin90^\circ = ${m}(${v})(${r}) = ${s3(m * v * r)}\ \text{kg·m}^2/\text{s}$.`); }
    if (k === 2) { const Ii = rnd(2, 8, 0.5), wi = rnd(1, 4, 0.5), If = rnd(0.8, Ii - 0.5, 0.1); const wf = Ii * wi / If; return num('ang-mom', R`A skater spins at $${wi}$ rev/s with $I = ${Ii}\ \text{kg·m}^2$. She pulls her arms in so $I = ${If}\ \text{kg·m}^2$. Find her new spin rate (rev/s).`, wf, s3(wf), R`No external torque, so $I_i\omega_i = I_f\omega_f \Rightarrow \omega_f = \frac{${Ii}(${wi})}{${If}} = ${s3(wf)}$ rev/s. (Her kinetic energy increases; her muscles do the work.)`); }
    if (k === 3) { const I1 = rnd(1, 6, 0.5), w1 = ri(5, 40), I2 = rnd(0.5, 6, 0.5); const wf = I1 * w1 / (I1 + I2); return num('ang-mom', R`A disk ($I = ${I1}\ \text{kg·m}^2$) spins at $${w1}$ rad/s. A second, non-rotating disk ($I = ${I2}\ \text{kg·m}^2$) is dropped onto it and they stick. Find the final angular speed (rad/s).`, wf, s3(wf), R`$I_1\omega_1 = (I_1 + I_2)\omega_f \Rightarrow \omega_f = \frac{${I1}(${w1})}{${I1 + I2}} = ${s3(wf)}$ rad/s. Angular momentum is conserved; some kinetic energy is lost to friction between the disks.`); }
    const sh = pick([['solid sphere', 0.4], ['solid cylinder', 0.5], ['thin hoop', 1]]); const h = rnd(0.5, 5, 0.25); const v = Math.sqrt(2 * g * h / (1 + sh[1]));
    return num('ang-mom', R`A ${sh[0]} rolls without slipping from rest down a ramp of vertical height $${h}$ m. Find its speed (m/s) at the bottom.`, v, s3(v), R`$mgh = \tfrac12mv^2 + \tfrac12I\omega^2 = \tfrac12mv^2(1 + ${sh[1]})$ using $I = ${sh[1]}mR^2$ and $\omega = v/R$. $v = \sqrt{\frac{2gh}{1 + ${sh[1]}}} = ${s3(v)}$ m/s, less than the sliding value $\sqrt{2gh} = ${s3(Math.sqrt(2 * g * h))}$ m/s.`, 'Some of the energy goes into rotation; the shape factor I/(mR²) decides how much.');
  }
  const PLANETS = [
    { name: 'the Moon', M: 7.35e22, Rr: 1.74e6, mt: '7.35\\times10^{22}', rt: '1.74\\times10^{6}' },
    { name: 'Mars', M: 6.42e23, Rr: 3.39e6, mt: '6.42\\times10^{23}', rt: '3.39\\times10^{6}' },
    { name: 'Jupiter', M: 1.90e27, Rr: 6.99e7, mt: '1.90\\times10^{27}', rt: '6.99\\times10^{7}' },
    { name: 'Earth', M: ME, Rr: RE, mt: '5.97\\times10^{24}', rt: '6.37\\times10^{6}' }
  ];
  function qGravity() {
    const k = ri(0, 6);
    if (k === 0) { const m1 = ri(1, 9) * 100, m2 = ri(1, 9) * 1000, r = ri(1, 20); const F = G * m1 * m2 / (r * r); return num('gravity', R`Find the gravitational force (N) between a $${m1}$ kg and a $${m2}$ kg mass whose centers are $${r}$ m apart.`, F, s3(F), R`$F = \frac{Gm_1m_2}{r^2} = \frac{6.67\times10^{-11}(${m1})(${m2})}{${r}^2} = ${s3(F)}$ N: tiny, which is why everyday objects do not noticeably attract.`); }
    if (k === 1) { const p = pick(PLANETS.slice(0, 3)); const gp = G * p.M / (p.Rr * p.Rr); return num('gravity', R`Find the surface gravitational acceleration ($\text{m/s}^2$) on ${p.name} ($M = ${p.mt}$ kg, $R = ${p.rt}$ m).`, gp, s3(gp), R`$g = \frac{GM}{R^2} = \frac{6.67\times10^{-11}(${p.mt})}{(${p.rt})^2} = ${s3(gp)}\ \text{m/s}^2$.`); }
    if (k === 2) { const h = ri(2, 20) * 100; const r = RE + h * 1000; const v = Math.sqrt(G * ME / r); return num('gravity', R`A satellite orbits Earth in a circle $${h}$ km above the surface. Find its orbital speed (m/s). ($M_E = 5.97\times10^{24}$ kg, $R_E = 6.37\times10^6$ m)`, v, s3(v), R`$r = R_E + h = ${s3(r)}$ m. Gravity supplies the centripetal force: $\frac{GMm}{r^2} = \frac{mv^2}{r} \Rightarrow v = \sqrt{GM/r} = ${s3(v)}$ m/s.`, 'Distance is from Earth’s center, not the surface.'); }
    if (k === 3) { const h = ri(2, 20) * 100; const r = RE + h * 1000; const T = 2 * Math.PI * Math.sqrt(r ** 3 / (G * ME)); return num('gravity', R`A satellite orbits $${h}$ km above Earth's surface. Find its period (s).`, T, s3(T), R`$T = 2\pi\sqrt{\frac{r^3}{GM}}$ with $r = ${s3(r)}$ m: $T = ${s3(T)}$ s $= ${s3(T / 60)}$ min.`); }
    if (k === 4) { const p = pick(PLANETS); const ve = Math.sqrt(2 * G * p.M / p.Rr); return num('gravity', R`Find the escape speed (m/s) from the surface of ${p.name} ($M = ${p.mt}$ kg, $R = ${p.rt}$ m).`, ve, s3(ve), R`Total energy zero at infinity: $\tfrac12mv^2 - \frac{GMm}{R} = 0 \Rightarrow v = \sqrt{2GM/R} = ${s3(ve)}$ m/s.`); }
    if (k === 5) { const h = ri(1, 30) * 1000; const gh = 9.8 * Math.pow(RE / (RE + h * 1000), 2); return num('gravity', R`Find $g$ ($\text{m/s}^2$) at an altitude of $${h}$ km above Earth's surface, taking $g = 9.8$ at the surface and $R_E = 6370$ km.`, gh, s3(gh), R`$g_h = g_0\left(\frac{R}{R+h}\right)^2 = 9.8\left(\frac{6370}{${6370 + h}}\right)^2 = ${s3(gh)}\ \text{m/s}^2$.`); }
    const T1 = pick([1, 88, 365]), kk = pick([2, 3, 4, 8, 9]); const T2 = T1 * Math.pow(kk, 1.5); return num('gravity', R`Planet A orbits a star with period $${T1}$ days. Planet B's orbit radius is $${kk}$ times larger. Find B's period (days).`, T2, s3(T2), R`Kepler's third law: $T^2 \propto r^3$, so $T_B = T_A\cdot ${kk}^{3/2} = ${s3(T2)}$ days.`);
  }

  /* ======================================================
     UNIT 4
     ====================================================== */
  function qSHM() {
    const k = ri(0, 7);
    const kk = ri(20, 800), m = rnd(0.1, 5, 0.1), A = rnd(0.02, 0.3, 0.01); const w = Math.sqrt(kk / m);
    if (k === 0) return num('shm', R`A $${m}$ kg mass oscillates on a spring with $k = ${kk}$ N/m. Find the angular frequency $\omega$ (rad/s).`, w, s3(w), R`$\omega = \sqrt{k/m} = \sqrt{${kk}/${m}} = ${s3(w)}$ rad/s.`);
    if (k === 1) return num('shm', R`A $${m}$ kg mass on a spring with $k = ${kk}$ N/m. Find the period (s).`, 2 * Math.PI / w, s3(2 * Math.PI / w), R`$T = 2\pi\sqrt{m/k} = 2\pi\sqrt{${m}/${kk}} = ${s3(2 * Math.PI / w)}$ s.`);
    if (k === 2) return num('shm', R`A $${m}$ kg mass on a spring with $k = ${kk}$ N/m oscillates with amplitude $${A}$ m. Find its maximum speed (m/s).`, A * w, s3(A * w), R`$v_{\max} = A\omega = ${A}\sqrt{${kk}/${m}} = ${s3(A * w)}$ m/s (at the equilibrium position).`);
    if (k === 3) return num('shm', R`A $${m}$ kg mass on a spring with $k = ${kk}$ N/m oscillates with amplitude $${A}$ m. Find its maximum acceleration ($\text{m/s}^2$).`, A * w * w, s3(A * w * w), R`$a_{\max} = A\omega^2 = ${A}(${kk}/${m}) = ${s3(A * w * w)}\ \text{m/s}^2$ (at the extremes).`);
    if (k === 4) return num('shm', R`A spring with $k = ${kk}$ N/m oscillates with amplitude $${A}$ m. Find the total mechanical energy (J).`, 0.5 * kk * A * A, s3(0.5 * kk * A * A), R`$E = \tfrac12kA^2 = \tfrac12(${kk})(${A})^2 = ${s3(0.5 * kk * A * A)}$ J.`);
    if (k === 5) { const x = rnd(0.2 * A, 0.9 * A, 0.01); const v = w * Math.sqrt(A * A - x * x); return num('shm', R`A $${m}$ kg mass on a $${kk}$ N/m spring has amplitude $${A}$ m. Find its speed (m/s) when it is $${x}$ m from equilibrium.`, v, s3(v), R`$v = \omega\sqrt{A^2 - x^2} = ${s3(w)}\sqrt{${A}^2 - ${x}^2} = ${s3(v)}$ m/s.`); }
    if (k === 6) { const T = rnd(0.2, 3, 0.1); const kfromT = 4 * Math.PI * Math.PI * m / (T * T); return num('shm', R`A $${m}$ kg mass on a spring has a period of $${T}$ s. Find the spring constant (N/m).`, kfromT, s3(kfromT), R`$T = 2\pi\sqrt{m/k} \Rightarrow k = \frac{4\pi^2m}{T^2} = \frac{4\pi^2(${m})}{${T}^2} = ${s3(kfromT)}$ N/m.`); }
    return mc('shm', 'For a mass on an ideal spring, doubling the amplitude', 'leaves the period unchanged and quadruples the energy', ['doubles the period', 'halves the period', 'doubles the energy'], R`$T = 2\pi\sqrt{m/k}$ has no amplitude in it; $E = \tfrac12kA^2$ scales with $A^2$.`);
  }
  function qPendulum() {
    const k = ri(0, 4);
    if (k === 0) { const L = rnd(0.2, 3, 0.05); return num('pendulum', R`Find the period (s) of a simple pendulum of length $${L}$ m on Earth (small swings).`, 2 * Math.PI * Math.sqrt(L / g), s3(2 * Math.PI * Math.sqrt(L / g)), R`$T = 2\pi\sqrt{L/g} = 2\pi\sqrt{${L}/9.8} = ${s3(2 * Math.PI * Math.sqrt(L / g))}$ s.`); }
    if (k === 1) { const T = rnd(0.5, 4, 0.1); const L = g * T * T / (4 * Math.PI * Math.PI); return num('pendulum', R`What length (m) should a simple pendulum have for a period of $${T}$ s?`, L, s3(L), R`$L = \frac{gT^2}{4\pi^2} = \frac{9.8(${T})^2}{4\pi^2} = ${s3(L)}$ m.`); }
    if (k === 2) { const L = rnd(0.5, 2, 0.1), gp = pick([1.62, 3.71, 24.8, 8.87]); const T = 2 * Math.PI * Math.sqrt(L / gp); const gt = 2 * Math.PI * Math.sqrt(L / gp); return num('pendulum', R`A $${L}$ m pendulum on another world has a period of $${s3(T)}$ s. Find the local $g$ ($\text{m/s}^2$).`, gp, s3(gp), R`$g = \frac{4\pi^2L}{T^2} = \frac{4\pi^2(${L})}{(${s3(gt)})^2} = ${s3(gp)}\ \text{m/s}^2$.`); }
    if (k === 3) return mc('pendulum', 'Which change increases the period of a simple pendulum?', 'Making the string longer', ['Using a heavier bob', 'Doubling the (small) amplitude', 'Moving it to a planet with larger g'], R`$T = 2\pi\sqrt{L/g}$ depends only on $L$ and $g$. Mass and small amplitude do not enter.`);
    return mc('pendulum', 'Pushing a child on a swing works best when you push', 'once per cycle at the swing’s natural frequency', ['as fast as possible', 'at exactly twice the natural frequency', 'at random times'], 'Driving at the natural frequency is resonance: energy is added in phase with the motion, so the amplitude grows.');
  }
  function qWaves() {
    const k = ri(0, 5);
    if (k === 0) { const f = ri(2, 500), lam = rnd(0.1, 5, 0.1); const which = ri(0, 2); if (which === 0) return num('waves', R`A wave has frequency $${f}$ Hz and wavelength $${lam}$ m. Find its speed (m/s).`, f * lam, s3(f * lam), R`$v = \lambda f = ${lam}(${f}) = ${s3(f * lam)}$ m/s.`); const v = +(f * lam).toFixed(2); if (which === 1) return num('waves', R`A wave travels at $${v}$ m/s with frequency $${f}$ Hz. Find its wavelength (m).`, v / f, s3(v / f), R`$\lambda = v/f = ${v}/${f} = ${s3(v / f)}$ m.`); return num('waves', R`A wave travels at $${v}$ m/s with wavelength $${lam}$ m. Find its frequency (Hz).`, v / lam, s3(v / lam), R`$f = v/\lambda = ${v}/${lam} = ${s3(v / lam)}$ Hz.`); }
    if (k === 1) { const FT = ri(20, 400), mass = rnd(0.5, 10, 0.1), L = rnd(0.5, 3, 0.1); const mu = mass / 1000 / L; const v = Math.sqrt(FT / mu); return num('waves', R`A string of length $${L}$ m and mass $${mass}$ g is under $${FT}$ N of tension. Find the wave speed (m/s).`, v, s3(v), R`$\mu = \frac{${mass}\times10^{-3}}{${L}} = ${s3(mu)}$ kg/m; $v = \sqrt{F_T/\mu} = \sqrt{${FT}/${s3(mu)}} = ${s3(v)}$ m/s.`, 'μ is mass per unit length in kg/m.'); }
    if (k === 2) { const L = rnd(0.3, 2, 0.05), v = ri(50, 400); return num('waves', R`Waves travel at $${v}$ m/s on a $${L}$ m string fixed at both ends. Find the fundamental frequency (Hz).`, v / (2 * L), s3(v / (2 * L)), R`Fundamental: $\lambda_1 = 2L = ${2 * L}$ m, $f_1 = v/2L = ${v}/${2 * L} = ${s3(v / (2 * L))}$ Hz.`); }
    if (k === 3) { const f1 = ri(50, 500), n = ri(2, 6), L = rnd(0.3, 2, 0.05); const which = Math.random() < 0.5; if (which) return num('waves', R`A string's fundamental frequency is $${f1}$ Hz. Find the frequency (Hz) of its $${n}$${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} harmonic.`, n * f1, `${n * f1}`, R`$f_n = nf_1 = ${n}(${f1}) = ${n * f1}$ Hz.`); return num('waves', R`A $${L}$ m string is fixed at both ends and vibrates in its $${n}$${n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} harmonic (${n} loops). Find the wavelength (m).`, 2 * L / n, s3(2 * L / n), R`$\lambda_n = 2L/n = 2(${L})/${n} = ${s3(2 * L / n)}$ m.`); }
    if (k === 4) { const kk = rnd(1, 20, 0.5), w = ri(5, 200); const which = ri(0, 2); const A = rnd(0.01, 0.2, 0.01); const base = R`A wave is described by $y(x,t) = ${A}\sin(${kk}x - ${w}t)$ (SI units).`; if (which === 0) return num('waves', base + R` Find its wavelength (m).`, 2 * Math.PI / kk, s3(2 * Math.PI / kk), R`$k = 2\pi/\lambda \Rightarrow \lambda = 2\pi/${kk} = ${s3(2 * Math.PI / kk)}$ m.`); if (which === 1) return num('waves', base + R` Find its period (s).`, 2 * Math.PI / w, s3(2 * Math.PI / w), R`$\omega = 2\pi/T \Rightarrow T = 2\pi/${w} = ${s3(2 * Math.PI / w)}$ s.`); return num('waves', base + R` Find its speed (m/s).`, w / kk, s3(w / kk), R`$v = \omega/k = ${w}/${kk} = ${s3(w / kk)}$ m/s, moving in the $+x$ direction (minus sign).`); }
    return mc('waves', 'A guitarist tightens a string (increases the tension). The wave speed on the string', 'increases, so the fundamental frequency rises', ['decreases, so the pitch drops', 'stays the same; only the amplitude changes', 'increases, but the frequency stays fixed'], R`$v = \sqrt{F_T/\mu}$ and $f_1 = v/2L$: more tension, faster waves, higher pitch.`);
  }
  function qSound() {
    const k = ri(0, 8);
    if (k === 0) { const e = -ri(2, 10), mant = rnd(1, 9, 0.5); const I = mant * Math.pow(10, e); const b = 10 * Math.log10(I / 1e-12); return num('sound', R`A sound has intensity $${sci(mant, e)}\ \text{W/m}^2$. Find its sound level (dB).`, b, s3(b), R`$\beta = 10\log_{10}\frac{I}{10^{-12}} = 10\log_{10}(${sci(mant, e + 12)}) = ${s3(b)}$ dB.`); }
    if (k === 1) { const b = ri(3, 12) * 10; const I = 1e-12 * Math.pow(10, b / 10); return num('sound', R`Find the intensity ($\text{W/m}^2$) of a $${b}$ dB sound.`, I, sig(I), R`$I = I_0\,10^{\beta/10} = 10^{-12}\times10^{${b / 10}} = ${sig(I)}\ \text{W/m}^2$.`); }
    if (k === 2) { const db = pick([3, 6, 10, 20, 30]); const ratio = Math.pow(10, db / 10); return num('sound', R`One sound is $${db}$ dB louder than another. What is the ratio of their intensities?`, ratio, s3(ratio), R`$\Delta\beta = 10\log_{10}(I_2/I_1) \Rightarrow I_2/I_1 = 10^{${db}/10} = ${s3(ratio)}$.`, '+10 dB is ×10 in intensity; +3 dB is about ×2.'); }
    if (k === 3) { const I1 = rnd(1, 9, 0.5), e = -ri(3, 6), r1 = ri(2, 10), r2 = r1 * ri(2, 4); const I2 = I1 * Math.pow(10, e) * (r1 / r2) ** 2; return num('sound', R`A point source produces intensity $${sci(I1, e)}\ \text{W/m}^2$ at $${r1}$ m. Find the intensity ($\text{W/m}^2$) at $${r2}$ m.`, I2, sig(I2), R`Inverse square: $I_2 = I_1\left(\frac{r_1}{r_2}\right)^2 = ${sci(I1, e)}\left(\frac{${r1}}{${r2}}\right)^2 = ${sig(I2)}\ \text{W/m}^2$.`); }
    if (k === 4) { const f = ri(300, 1000), vs = ri(10, 40); const fp = f * VS / (VS - vs); return num('sound', R`An ambulance siren at $${f}$ Hz approaches a stationary listener at $${vs}$ m/s (speed of sound 343 m/s). What frequency (Hz) is heard?`, fp, s3(fp), R`Source approaching: $f' = f\frac{v}{v - v_s} = ${f}\cdot\frac{343}{343 - ${vs}} = ${s3(fp)}$ Hz (higher).`); }
    if (k === 5) { const f = ri(300, 1000), vo = ri(10, 40); const fp = f * (VS + vo) / VS; return num('sound', R`A listener moves at $${vo}$ m/s toward a stationary $${f}$ Hz source (sound speed 343 m/s). What frequency (Hz) is heard?`, fp, s3(fp), R`Observer approaching: $f' = f\frac{v + v_o}{v} = ${f}\cdot\frac{343 + ${vo}}{343} = ${s3(fp)}$ Hz.`); }
    if (k === 6) { const f = ri(300, 1000), vs = ri(10, 40); const fp = f * VS / (VS + vs); return num('sound', R`A train horn at $${f}$ Hz moves away from you at $${vs}$ m/s. What frequency (Hz) do you hear? (343 m/s)`, fp, s3(fp), R`Source receding: $f' = f\frac{v}{v + v_s} = ${f}\cdot\frac{343}{343 + ${vs}} = ${s3(fp)}$ Hz (lower).`); }
    if (k === 7) { const f1 = ri(200, 600), d = ri(1, 8); return num('sound', R`Two tuning forks sound at $${f1}$ Hz and $${f1 + d}$ Hz together. What beat frequency (Hz) is heard?`, d, `${d}`, R`$f_{\text{beat}} = |f_1 - f_2| = ${d}$ Hz.`); }
    const L = rnd(0.2, 2, 0.05), closed = Math.random() < 0.5; const f = closed ? VS / (4 * L) : VS / (2 * L);
    return num('sound', R`Find the fundamental frequency (Hz) of a $${L}$ m pipe that is ${closed ? 'closed at one end' : 'open at both ends'} (sound speed 343 m/s).`, f, s3(f), R`${closed ? 'Closed–open: $\\lambda_1 = 4L$, $f_1 = v/4L$' : 'Open–open: $\\lambda_1 = 2L$, $f_1 = v/2L$'} $= ${s3(f)}$ Hz.`);
  }

  /* ---------- registry ---------- */
  const GENERATORS = [qConvert, qDimensional, qComponents, qMagnitudeAngle, qVectorAdd, qDot, qKin1d, qKinGraph, qFreeFall, qKin2d, qProjectile, qCircKin, qNewtonLaws, qForcesFbd,
    qApplyNewton, qFriction, qCircDyn, qStatics, qFluids, qRotKin, qWork, qEnergy, qMomentum, qCollisions, qRotDyn, qAngMom, qGravity, qSHM, qPendulum, qWaves, qSound];
  const BY_TOPIC = {};
  for (const gfn of GENERATORS) { const t = gfn().topic; (BY_TOPIC[t] = BY_TOPIC[t] || []).push(gfn); }
  function topicsForUnits(units) { return Object.keys(TOPICS).filter(t => units.includes(TOPICS[t].unit)); }
  function generateSet(topics, n) {
    const pool = topics.filter(t => BY_TOPIC[t]); if (!pool.length) return [];
    const out = []; const order = shuffle(pool); let guard = 0;
    while (out.length < n && guard++ < n * 25) {
      const t = order[out.length % order.length]; const q = pick(BY_TOPIC[t])();
      if (q.type === 'mc' && q.options.length < 2) continue;
      if (out.some(o => o.prompt === q.prompt)) continue;
      q.id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); out.push(q);
    }
    return out;
  }
  global.Courses = global.Courses || {};
  global.Courses.physics = global.Courses.physics || {};
  global.Courses.physics.quiz = { TOPICS, GENERATORS, BY_TOPIC, generateSet, topicsForUnits, helpers: { fmt: s3, shuffle } };
})(window);
