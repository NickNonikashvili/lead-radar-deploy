/* M 170 question bank. Calculated questions draw fresh values every time; bank items are
   [prompt, correct, [wrong answers], explanation]. Written for Mathub from standard trigonometry and the
   course outcomes; not from the instructor. Typed answers accept exact forms such as sqrt(3)/2 or 5pi/6. */
const R = String.raw;
const calc = (topic, o) => Object.assign({ type: 'calc', topic }, o);
const cmc = (topic, o) => Object.assign({ type: 'calc-mc', topic }, o);
const bank = (topic, items, extra = {}) => Object.assign({ type: 'bank', topic, items, options: 4 }, extra);

// special angles with their radian labels (TeX)
const ANG = [
  [0, R`0`], [30, R`\frac{\pi}{6}`], [45, R`\frac{\pi}{4}`], [60, R`\frac{\pi}{3}`], [90, R`\frac{\pi}{2}`],
  [120, R`\frac{2\pi}{3}`], [135, R`\frac{3\pi}{4}`], [150, R`\frac{5\pi}{6}`], [180, R`\pi`],
  [210, R`\frac{7\pi}{6}`], [225, R`\frac{5\pi}{4}`], [240, R`\frac{4\pi}{3}`], [270, R`\frac{3\pi}{2}`],
  [300, R`\frac{5\pi}{3}`], [315, R`\frac{7\pi}{4}`], [330, R`\frac{11\pi}{6}`]
].map(([deg, rad]) => ({ deg, rad }));
const NONZERO_COS = ANG.filter(a => a.deg % 180 !== 90);
const TRIPLES = [{ a: 3, b: 4, c: 5 }, { a: 5, b: 12, c: 13 }, { a: 8, b: 15, c: 17 }, { a: 7, b: 24, c: 25 }, { a: 4, b: 3, c: 5 }, { a: 12, b: 5, c: 13 }];

const topics = {
  angles: { unit: 1, sec: 'angles', label: 'Angles & radians' },
  righttri: { unit: 1, sec: 'righttri', label: 'Right triangles' },
  unitcircle: { unit: 1, sec: 'unitcircle', label: 'Unit circle' },
  otherfns: { unit: 1, sec: 'otherfns', label: 'Other trig functions' },
  graphs: { unit: 2, sec: 'graphs', label: 'Sine & cosine graphs' },
  inverse: { unit: 2, sec: 'inverse', label: 'Inverse trig' },
  identities: { unit: 2, sec: 'identities', label: 'Identities' },
  sumdiff: { unit: 2, sec: 'sumdiff', label: 'Sum & double angle' },
  laws: { unit: 2, sec: 'laws', label: 'Laws of Sines & Cosines' }
};

const ladders = {
  angles: ['180° is π radians.', 'Degrees to radians: × π/180. Radians to degrees: × 180/π.', 'Arc length s = rθ needs θ in radians.'],
  righttri: ['Label opposite, adjacent and hypotenuse from the angle you are using.', 'SOH CAH TOA.', 'Special triangles: 1 : 1 : √2 and 1 : √3 : 2.'],
  unitcircle: ['Find the quadrant and the reference angle.', 'Use the first-quadrant value of the reference angle.', 'Attach the sign: All Students Take Calculus.'],
  otherfns: ['Write it in sines and cosines.', 'Draw the reference triangle; find the missing side.', 'Signs come from the quadrant.'],
  graphs: ['Write it as A sin(B(x − C)) + D.', 'Amplitude |A|, period 2π/|B|, midline y = D.', 'Phase shift C: factor B out first.'],
  inverse: ['Remember each inverse’s range.', 'Pick the one angle in that range.', 'For compositions, draw the triangle for the inner angle.'],
  identities: ['Work on one side only.', 'Convert to sines and cosines.', 'Use sin² + cos² = 1 and common denominators.'],
  sumdiff: ['Split the angle into special angles (45 ± 30, 60 ± 45).', 'Sine keeps the sign; cosine flips it.', 'Double angle: sin 2θ = 2 sin θ cos θ.'],
  laws: ['Do you know a side and its opposite angle? Law of Sines.', 'SAS or SSS? Law of Cosines.', 'Area = ½ab sin C.']
};

const questions = [
  /* ---------------- angles ---------------- */
  calc('angles', { vars: { deg: [30, 45, 60, 90, 120, 135, 150, 210, 225, 240, 270, 300, 315, 330] },
    prompt: R`Convert $ {{deg}}^\circ$ to radians.`,
    answer: 'deg * pi / 180', decimals: 4,
    explain: R`Multiply by $\frac{\pi}{180^\circ}$: $ {{deg}}\cdot\frac{\pi}{180}\approx{{= answer | 4}}$ (type it exactly, like 5pi/6).` }),
  calc('angles', { vars: { it: [{ n: 1, d: 6, rs: R`\frac{\pi}{6}` }, { n: 5, d: 6, rs: R`\frac{5\pi}{6}` }, { n: 3, d: 4, rs: R`\frac{3\pi}{4}` }, { n: 7, d: 4, rs: R`\frac{7\pi}{4}` }, { n: 2, d: 3, rs: R`\frac{2\pi}{3}` }, { n: 5, d: 3, rs: R`\frac{5\pi}{3}` }, { n: 7, d: 6, rs: R`\frac{7\pi}{6}` }, { n: 11, d: 6, rs: R`\frac{11\pi}{6}` }, { n: 3, d: 2, rs: R`\frac{3\pi}{2}` }, { n: 5, d: 4, rs: R`\frac{5\pi}{4}` }] },
    prompt: R`Convert $ {{rs}}$ radians to degrees.`,
    answer: '180 * n / d', unit: '°',
    explain: R`Multiply by $\frac{180^\circ}{\pi}$: $ {{rs}}\cdot\frac{180^\circ}{\pi} = {{answer}}^\circ$.` }),
  calc('angles', { vars: { r: [2, 3, 4, 5, 6, 8, 10], deg: [30, 45, 60, 90, 120, 150] },
    prompt: R`Find the length of the arc cut off by a central angle of $ {{deg}}^\circ$ on a circle of radius {{r}} cm.`,
    answer: 'r * deg * pi / 180', decimals: 3, unit: 'cm',
    explain: R`$ {{deg}}^\circ = {{= deg/180 | 4}}\pi$ rad, so $s = r\theta = {{r}}\cdot{{= deg*pi/180 | 4}}\approx{{= answer | 3}}$ cm.` }),
  calc('angles', { vars: { th: [400, 520, 765, -45, -120, -300, 1000, 450] },
    prompt: R`Find the angle between $0^\circ$ and $360^\circ$ that is coterminal with $ {{th}}^\circ$.`,
    answer: '((th % 360) + 360) % 360', unit: '°',
    explain: R`Add or subtract $360^\circ$ until the angle lands in $[0^\circ,360^\circ)$: $ {{answer}}^\circ$.` }),
  calc('angles', { vars: { r: [3, 4, 5, 6, 8], deg: [60, 90, 120] },
    prompt: R`Find the area of a sector with radius {{r}} m and central angle $ {{deg}}^\circ$.`,
    answer: '0.5 * r^2 * deg * pi / 180', decimals: 3, unit: 'm²',
    explain: R`$A = \frac12r^2\theta = \frac12\cdot{{= r^2}}\cdot{{= deg*pi/180 | 4}}\approx{{= answer | 3}}$ m².` }),
  bank('angles', [
    [R`One radian is the angle that`, 'cuts off an arc as long as the radius', ['equals 1 degree', 'makes a full turn', 'cuts off a quarter of the circle'], R`That is why $s = r\theta$ when $\theta$ is in radians.`],
    [R`A full turn is`, R`$2\pi$ radians`, [R`$\pi$ radians`, R`$360$ radians`, R`$\frac\pi2$ radians`], R`$360^\circ = 2\pi$.`],
    [R`A negative angle in standard position turns`, 'clockwise', ['counterclockwise', 'toward the y-axis only', 'it is not allowed'], R`Positive angles turn counterclockwise.`],
    [R`Which angle is coterminal with $\frac\pi3$?`, R`$\frac{7\pi}3$`, [R`$\frac{2\pi}3$`, R`$-\frac\pi3$`, R`$\frac{4\pi}3$`], R`Add $2\pi = \frac{6\pi}3$.`]
  ]),

  /* ---------------- right triangles ---------------- */
  calc('righttri', { vars: { t: TRIPLES, f: [{ fn: 'cos', fs: R`\cos` }, { fn: 'tan', fs: R`\tan` }, { fn: 'sin', fs: R`\sin` }] },
    prompt: R`In a right triangle, the side opposite angle $\theta$ is {{a}}, the side adjacent to it is {{b}} and the hypotenuse is {{c}}. Find $ {{fs}}\theta$.`,
    answer: 'fn == "sin" ? a / c : (fn == "cos" ? b / c : a / b)', decimals: 4,
    explain: R`SOH CAH TOA: $\sin\theta = \frac{ {{a}} }{ {{c}} }$, $\cos\theta = \frac{ {{b}} }{ {{c}} }$, $\tan\theta = \frac{ {{a}} }{ {{b}} }$, so $ {{fs}}\theta\approx{{= answer | 4}}$.` }),
  calc('righttri', { vars: { d: [20, 30, 40, 50, 100], ang: [30, 45, 60] },
    prompt: R`From {{d}} ft away from the base of a tree, the angle of elevation to its top is $ {{ang}}^\circ$. How tall is the tree?`,
    answer: 'd * tand(ang)', decimals: 3, unit: 'ft',
    explain: R`$\tan{{ang}}^\circ = \frac{h}{ {{d}} }$, so $h = {{d}}\tan{{ang}}^\circ\approx{{= answer | 3}}$ ft.` }),
  calc('righttri', { vars: { s: [2, 3, 4, 5, 6, 8] },
    prompt: R`In a $30^\circ$-$60^\circ$-$90^\circ$ triangle the shorter leg is {{s}}. Find the longer leg.`,
    answer: 's * sqrt(3)', decimals: 4,
    explain: R`Sides are $1 : \sqrt3 : 2$, so the longer leg is $ {{s}}\sqrt3\approx{{= answer | 4}}$.` }),
  calc('righttri', { vars: { s: [2, 3, 4, 5, 7, 10] },
    prompt: R`An isosceles right triangle has legs of length {{s}}. Find the hypotenuse.`,
    answer: 's * sqrt(2)', decimals: 4,
    explain: R`Sides are $1 : 1 : \sqrt2$, so the hypotenuse is $ {{s}}\sqrt2\approx{{= answer | 4}}$.` }),
  calc('righttri', { vars: { h1: [5, 6], s1: [3, 4, 8], s2: [12, 18, 24, 30] },
    prompt: R`A {{h1}} ft person casts a {{s1}} ft shadow at the same moment a flagpole casts a {{s2}} ft shadow. How tall is the flagpole?`,
    answer: 'h1 * s2 / s1', decimals: 3, unit: 'ft',
    explain: R`The triangles are similar (same sun angle), so $\frac{h}{ {{s2}} } = \frac{ {{h1}} }{ {{s1}} }$ and $h = {{= answer | 3}}$ ft.` }),
  bank('righttri', [
    [R`$\sin30^\circ =$`, R`$\frac12$`, [R`$\frac{\sqrt3}2$`, R`$\frac{\sqrt2}2$`, R`$\sqrt3$`], R`Opposite 1, hypotenuse 2 in the $30$-$60$-$90$ triangle.`],
    [R`$\tan45^\circ =$`, '1', [R`$\frac{\sqrt2}2$`, R`$\sqrt3$`, '0'], R`The legs are equal.`],
    [R`$\cos60^\circ =$`, R`$\frac12$`, [R`$\frac{\sqrt3}2$`, R`$\sqrt3$`, R`$\frac{\sqrt2}2$`], R`Adjacent 1, hypotenuse 2.`],
    [R`$\tan60^\circ =$`, R`$\sqrt3$`, [R`$\frac{\sqrt3}3$`, '1', R`$\frac12$`], R`Opposite $\sqrt3$, adjacent 1.`],
    [R`If $\sin\theta = \frac{7}{25}$ for an acute angle, then $\cos(90^\circ-\theta) =$`, R`$\frac{7}{25}$`, [R`$\frac{24}{25}$`, R`$\frac{25}{7}$`, R`$\frac{7}{24}$`], R`Cofunction: $\cos(90^\circ-\theta) = \sin\theta$.`],
    [R`Trig ratios of an angle do not depend on the size of the right triangle because`, 'triangles with equal angles are similar', ['all right triangles are congruent', 'the hypotenuse is always 1', 'the angle is measured in radians'], R`Similar triangles have proportional sides.`]
  ]),

  /* ---------------- unit circle ---------------- */
  calc('unitcircle', { vars: { a: ANG, f: [{ fn: 'sin', fs: R`\sin` }, { fn: 'cos', fs: R`\cos` }] },
    prompt: R`Find the exact value of $ {{fs}}\left({{rad}}\right)$.`,
    answer: 'round(fn == "sin" ? sind(deg) : cosd(deg), 10)', decimals: 4,
    explain: R`Find the quadrant and reference angle of $ {{rad}}$ ($ {{deg}}^\circ$), take the first-quadrant value and attach the sign: $\approx{{= answer | 4}}$.` }),
  calc('unitcircle', { vars: { th: [120, 135, 150, 210, 225, 240, 300, 315, 330, 100, 200, 290] },
    prompt: R`Find the reference angle of $ {{th}}^\circ$.`,
    answer: 'th <= 90 ? th : (th <= 180 ? 180 - th : (th <= 270 ? th - 180 : 360 - th))', unit: '°',
    explain: R`The reference angle is the acute angle to the $x$-axis: $ {{answer}}^\circ$.` }),
  cmc('unitcircle', { vars: { q: [{ n: 'II', fs: R`\cos`, sgn: 'negative' }, { n: 'II', fs: R`\sin`, sgn: 'positive' }, { n: 'III', fs: R`\tan`, sgn: 'positive' }, { n: 'III', fs: R`\sin`, sgn: 'negative' }, { n: 'IV', fs: R`\cos`, sgn: 'positive' }, { n: 'IV', fs: R`\tan`, sgn: 'negative' }, { n: 'I', fs: R`\sin`, sgn: 'positive' }] },
    prompt: R`In quadrant {{n}}, $ {{fs}} t$ is`,
    answer: 'sgn', distractors: ['sgn == "positive" ? "negative" : "positive"', '"zero"', '"undefined"'],
    explain: R`All Students Take Calculus: all positive in I, sine in II, tangent in III, cosine in IV.` }),
  bank('unitcircle', [
    [R`The point on the unit circle at angle $t$ is`, R`$(\cos t,\sin t)$`, [R`$(\sin t,\cos t)$`, R`$(\tan t, 1)$`, R`$(t, \sin t)$`], R`Cosine is the $x$-coordinate, sine the $y$.`],
    [R`$\sin\frac{3\pi}2 =$`, R`$-1$`, ['0', '1', R`$\frac{\sqrt3}2$`], R`The point is $(0,-1)$.`],
    [R`$\cos\pi =$`, R`$-1$`, ['0', '1', 'undefined'], R`The point is $(-1, 0)$.`],
    [R`The range of $\sin t$ is`, R`$[-1,1]$`, [R`all real numbers`, R`$[0,1]$`, R`$[0,2\pi]$`], R`It is a $y$-coordinate on the unit circle.`],
    [R`$\sin^2t+\cos^2t =$`, '1', ['0', R`$\tan^2t$`, '2'], R`The unit circle is $x^2+y^2 = 1$.`]
  ]),

  /* ---------------- other functions ---------------- */
  calc('otherfns', { vars: { a: NONZERO_COS },
    prompt: R`Find the exact value of $\tan\left({{rad}}\right)$.`,
    answer: 'round(tand(deg), 10)', decimals: 4,
    explain: R`$\tan = \frac{\sin}{\cos}$ at $ {{rad}}$ ($ {{deg}}^\circ$): $\approx{{= answer | 4}}$.` }),
  calc('otherfns', { vars: { a: NONZERO_COS },
    prompt: R`Find the exact value of $\sec\left({{rad}}\right)$.`,
    answer: 'round(1 / cosd(deg), 10)', decimals: 4,
    explain: R`$\sec = \frac{1}{\cos}$, and $\cos{{deg}}^\circ\approx{{= cosd(deg) | 4}}$, so $\sec\approx{{= answer | 4}}$.` }),
  calc('otherfns', { vars: { t: TRIPLES },
    prompt: R`If $\sin t = \frac{ {{a}} }{ {{c}} }$ and $t$ is in quadrant II, find $\tan t$.`,
    answer: '-a / b', decimals: 4,
    explain: R`Reference triangle {{a}}-{{b}}-{{c}}: $\cos t = -\frac{ {{b}} }{ {{c}} }$ in quadrant II, so $\tan t = -\frac{ {{a}} }{ {{b}} }\approx{{= answer | 4}}$.` }),
  calc('otherfns', { vars: { t: TRIPLES },
    prompt: R`If $\cos t = \frac{ {{b}} }{ {{c}} }$ and $t$ is in quadrant IV, find $\sin t$.`,
    answer: '-a / c', decimals: 4,
    explain: R`The missing side is $\sqrt{ {{c}}^2-{{b}}^2} = {{a}}$; sine is negative in quadrant IV: $\sin t = -\frac{ {{a}} }{ {{c}} }$.` }),
  bank('otherfns', [
    [R`Which function is even?`, R`$\cos t$`, [R`$\sin t$`, R`$\tan t$`, R`$\csc t$`], R`$\cos(-t) = \cos t$; secant is the other even one.`],
    [R`$\csc t =$`, R`$\frac{1}{\sin t}$`, [R`$\frac{1}{\cos t}$`, R`$\frac{\cos t}{\sin t}$`, R`$\sin^{-1}t$`], R`Cosecant pairs with sine.`],
    [R`The period of $\tan x$ is`, R`$\pi$`, [R`$2\pi$`, R`$\frac\pi2$`, R`$4\pi$`], R`Tangent repeats twice as often as sine and cosine.`],
    [R`$\tan\frac\pi2$ is`, 'undefined', ['0', '1', R`$\infty$, a real number`], R`$\cos\frac\pi2 = 0$ is in the denominator.`],
    [R`$1+\tan^2t =$`, R`$\sec^2t$`, [R`$\csc^2t$`, '1', R`$\cot^2t$`], R`Divide $\sin^2+\cos^2 = 1$ by $\cos^2t$.`],
    [R`$\sin(-t) =$`, R`$-\sin t$`, [R`$\sin t$`, R`$\cos t$`, R`$-\cos t$`], R`Sine is odd.`]
  ]),

  /* ---------------- graphs ---------------- */
  calc('graphs', { vars: { it: [{ B: 2, bs: '2' }, { B: 3, bs: '3' }, { B: 4, bs: '4' }, { B: 0.5, bs: R`\tfrac12` }, { B: 6, bs: '6' }, { B: 0.25, bs: R`\tfrac14` }], A: [2, 3, 5] },
    prompt: R`Find the period of $y = {{A}}\sin\left({{bs}}x\right)$.`,
    answer: '2 * pi / B', decimals: 4,
    explain: R`Period $= \frac{2\pi}{|B|} = \frac{2\pi}{ {{bs}} }\approx{{= answer | 4}}$.` }),
  calc('graphs', { vars: { A: [-4, -3, -2, 2, 3, 5], D: [-2, -1, 1, 3] },
    prompt: R`Find the maximum value of $y = {{A}}\cos x + {{D}}$.`,
    answer: 'abs(A) + D',
    explain: R`Midline $y = {{D}}$, amplitude $|{{A}}| = {{= abs(A)}}$: the maximum is $ {{D}}+{{= abs(A)}} = {{answer}}$.` }),
  calc('graphs', { vars: { it: [{ B: 2, k: 1, ins: R`2x-\pi` }, { B: 2, k: 0.5, ins: R`2x-\frac{\pi}{2}` }, { B: 3, k: 1, ins: R`3x-\pi` }, { B: 4, k: 1, ins: R`4x-\pi` }, { B: 2, k: 2, ins: R`2x-2\pi` }, { B: 3, k: 0.5, ins: R`3x-\frac{\pi}{2}` }] },
    prompt: R`Find the phase shift (to the right) of $y = \sin\left({{ins}}\right)$.`,
    answer: 'k * pi / B', decimals: 4,
    explain: R`Factor out $ {{B}}$: $\sin\big({{B}}(x - \tfrac{ {{= k}}\pi}{ {{B}} })\big)$. The shift is $\frac{ {{= k}}\pi}{ {{B}} }\approx{{= answer | 4}}$ to the right.` }),
  calc('graphs', { vars: { A: [2, 3, 4], D: [-1, 1, 2] },
    prompt: R`What is the minimum value of $y = {{A}}\sin(2x) + {{D}}$?`,
    answer: 'D - A',
    explain: R`The minimum is the midline minus the amplitude: $ {{D}}-{{A}} = {{answer}}$.` }),
  bank('graphs', [
    [R`The graph of $y = \sin x$ is symmetric about`, 'the origin', ['the y-axis', 'the x-axis', 'the line y = x'], R`Sine is odd.`],
    [R`The graph of $y = \cos x$ is symmetric about`, 'the y-axis', ['the origin', 'the x-axis', 'the line y = x'], R`Cosine is even.`],
    [R`$y = \cos x$ at $x = 0$ is at its`, 'maximum', ['minimum', 'midline, going up', 'midline, going down'], R`$\cos0 = 1$.`],
    [R`The midline of $y = 2\sin x - 3$ is`, R`$y = -3$`, [R`$y = 2$`, R`$y = -1$`, R`$y = 3$`], R`The vertical shift $D = -3$.`],
    [R`Doubling $B$ in $y = \sin(Bx)$`, 'halves the period', ['doubles the period', 'doubles the amplitude', 'shifts the graph right'], R`Period $= \frac{2\pi}{B}$.`]
  ]),

  /* ---------------- inverses ---------------- */
  calc('inverse', { vars: { it: [
    { ex: R`\arcsin\left(\frac12\right)`, v: 0.5235987756, why: R`$\frac\pi6$` }, { ex: R`\arcsin\left(-\frac{\sqrt2}{2}\right)`, v: -0.7853981634, why: R`$-\frac\pi4$` },
    { ex: R`\arccos\left(-\frac12\right)`, v: 2.0943951024, why: R`$\frac{2\pi}3$` }, { ex: R`\arccos\left(\frac{\sqrt3}{2}\right)`, v: 0.5235987756, why: R`$\frac\pi6$` },
    { ex: R`\arctan\left(\sqrt3\right)`, v: 1.0471975512, why: R`$\frac\pi3$` }, { ex: R`\arctan(-1)`, v: -0.7853981634, why: R`$-\frac\pi4$` },
    { ex: R`\arccos(-1)`, v: 3.1415926536, why: R`$\pi$` }, { ex: R`\arcsin\left(-\frac{\sqrt3}{2}\right)`, v: -1.0471975512, why: R`$-\frac\pi3$` }
  ] },
    prompt: R`Evaluate $ {{ex}}$ in radians.`,
    answer: 'v', decimals: 4,
    explain: R`The one angle in the function's range with that value: {{why}} $\approx{{= v | 4}}$.` }),
  calc('inverse', { vars: { t: TRIPLES },
    prompt: R`Find $\cos\left(\arcsin\frac{ {{a}} }{ {{c}} }\right)$.`,
    answer: 'b / c', decimals: 4,
    explain: R`The angle has opposite {{a}} and hypotenuse {{c}}, so adjacent {{b}}; it lies in $\left[0,\frac\pi2\right]$, so the cosine is $\frac{ {{b}} }{ {{c}} }$.` }),
  calc('inverse', { vars: { t: TRIPLES },
    prompt: R`Find $\tan\left(\arccos\frac{ {{b}} }{ {{c}} }\right)$.`,
    answer: 'a / b', decimals: 4,
    explain: R`Adjacent {{b}}, hypotenuse {{c}}, so opposite {{a}}: $\tan = \frac{ {{a}} }{ {{b}} }$.` }),
  calc('inverse', { vars: { it: [
    { eq: R`\sin x = \frac12`, v: 2.6179938780, why: R`$\frac\pi6$ and $\frac{5\pi}6$` }, { eq: R`\cos x = -\frac12`, v: 4.1887902048, why: R`$\frac{2\pi}3$ and $\frac{4\pi}3$` },
    { eq: R`\sin x = -\frac{\sqrt2}{2}`, v: 5.4977871438, why: R`$\frac{5\pi}4$ and $\frac{7\pi}4$` }, { eq: R`\cos x = \frac{\sqrt3}{2}`, v: 5.7595865316, why: R`$\frac\pi6$ and $\frac{11\pi}6$` },
    { eq: R`\tan x = 1`, v: 3.9269908170, why: R`$\frac\pi4$ and $\frac{5\pi}4$` }
  ] },
    prompt: R`Solve $ {{eq}}$ on $[0,2\pi)$. Give the larger solution.`,
    answer: 'v', decimals: 4,
    explain: R`Solutions: {{why}}. The larger is $\approx{{= v | 4}}$.` }),
  bank('inverse', [
    [R`The range of $\arcsin x$ is`, R`$\left[-\frac\pi2,\frac\pi2\right]$`, [R`$[0,\pi]$`, R`$[-1,1]$`, R`$[0,2\pi)$`], R`It returns angles on the right half of the circle.`],
    [R`The range of $\arccos x$ is`, R`$[0,\pi]$`, [R`$\left[-\frac\pi2,\frac\pi2\right]$`, R`$[-1,1]$`, R`$(0,2\pi)$`], R`The top half of the circle.`],
    [R`$\arcsin\left(\sin\frac{5\pi}6\right) =$`, R`$\frac\pi6$`, [R`$\frac{5\pi}6$`, R`$-\frac\pi6$`, R`$\frac12$`], R`$\sin\frac{5\pi}6 = \frac12$, and arcsin returns $\frac\pi6$.`],
    [R`$\sin^{-1}x$ means`, R`the inverse sine, $\arcsin x$`, [R`$\frac{1}{\sin x}$`, R`$\csc x$`, R`$-\sin x$`], R`The $-1$ is not an exponent here.`],
    [R`$\arcsin2$ is`, 'undefined', [R`$\frac\pi2$`, R`$2\pi$`, '1'], R`Sine never exceeds 1.`]
  ]),

  /* ---------------- identities ---------------- */
  calc('identities', { vars: { s: [0.6, 0.8, 0.28, 0.96, 0.5] },
    prompt: R`If $\sin\theta = {{s}}$, find $\cos^2\theta$.`,
    answer: '1 - s^2', decimals: 4,
    explain: R`$\cos^2\theta = 1-\sin^2\theta = 1-{{= s^2 | 4}} = {{= answer | 4}}$.` }),
  calc('identities', { vars: { t: TRIPLES },
    prompt: R`If $\tan\theta = \frac{ {{a}} }{ {{b}} }$, find $\sec^2\theta$.`,
    answer: '1 + (a / b)^2', decimals: 4,
    explain: R`$\sec^2\theta = 1+\tan^2\theta = 1+\frac{ {{= a^2}} }{ {{= b^2}} } = \frac{ {{= c^2}} }{ {{= b^2}} }\approx{{= answer | 4}}$.` }),
  bank('identities', [
    [R`$\frac{1-\cos^2x}{\sin x}$ simplifies to`, R`$\sin x$`, [R`$\cos x$`, R`$\tan x$`, '1'], R`$1-\cos^2x = \sin^2x$.`],
    [R`$\tan x\cos x$ simplifies to`, R`$\sin x$`, [R`$\cos^2x$`, R`$\sec x$`, '1'], R`$\frac{\sin x}{\cos x}\cos x$.`],
    [R`$\sec^2x-\tan^2x =$`, '1', ['0', R`$\sec x$`, R`$-1$`], R`From $1+\tan^2x = \sec^2x$.`],
    [R`$\frac{\sin x}{\csc x}$ simplifies to`, R`$\sin^2x$`, ['1', R`$\cos x$`, R`$\tan x$`], R`$\csc x = \frac{1}{\sin x}$.`],
    [R`To verify an identity, you should`, 'transform one side until it matches the other', ['do the same operation to both sides', 'cross-multiply', 'plug in one value of x'], R`Working on both sides assumes what you want to prove.`],
    [R`$\cos x\sec x =$`, '1', [R`$\cos^2x$`, '0', R`$\tan x$`], R`Reciprocals multiply to 1.`],
    [R`A good first step for a stubborn identity is to`, 'rewrite everything in sines and cosines', ['square both sides', 'divide by zero', 'convert to degrees'], R`Then combine and simplify.`]
  ]),

  /* ---------------- sum, difference, double angle ---------------- */
  calc('sumdiff', { vars: { it: [{ deg: 15, fn: 'sin' }, { deg: 15, fn: 'cos' }, { deg: 75, fn: 'sin' }, { deg: 75, fn: 'cos' }, { deg: 105, fn: 'sin' }, { deg: 105, fn: 'cos' }, { deg: 165, fn: 'cos' }] },
    prompt: R`Find the exact value of $\{{fn}}{{deg}}^\circ$ using a sum or difference formula.`,
    answer: 'fn == "sin" ? sind(deg) : cosd(deg)', decimals: 4,
    explain: R`Write $ {{deg}}^\circ$ as a sum or difference of $30^\circ$, $45^\circ$, $60^\circ$ and apply the formula: $\approx{{= answer | 4}}$ (for example $\frac{\sqrt6\pm\sqrt2}{4}$).` }),
  calc('sumdiff', { vars: { t: TRIPLES },
    prompt: R`If $\sin\theta = \frac{ {{a}} }{ {{c}} }$ with $\theta$ in quadrant I, find $\sin2\theta$.`,
    answer: '2 * (a / c) * (b / c)', decimals: 4,
    explain: R`$\cos\theta = \frac{ {{b}} }{ {{c}} }$, so $\sin2\theta = 2\cdot\frac{ {{a}} }{ {{c}} }\cdot\frac{ {{b}} }{ {{c}} } = \frac{ {{= 2*a*b}} }{ {{= c^2}} }$.` }),
  calc('sumdiff', { vars: { t: TRIPLES },
    prompt: R`If $\sin\theta = \frac{ {{a}} }{ {{c}} }$, find $\cos2\theta$.`,
    answer: '1 - 2 * (a / c)^2', decimals: 4,
    explain: R`$\cos2\theta = 1-2\sin^2\theta = 1-2\cdot\frac{ {{= a^2}} }{ {{= c^2}} }\approx{{= answer | 4}}$.` }),
  calc('sumdiff', { vars: { p: [{ a1: 3, b1: 4, c1: 5 }, { a1: 4, b1: 3, c1: 5 }], q: [{ a2: 5, b2: 12, c2: 13 }, { a2: 12, b2: 5, c2: 13 }] },
    prompt: R`$\alpha$ and $\beta$ are in quadrant I with $\sin\alpha = \frac{ {{a1}} }{ {{c1}} }$ and $\cos\beta = \frac{ {{b2}} }{ {{c2}} }$. Find $\sin(\alpha+\beta)$.`,
    answer: '(a1 / c1) * (b2 / c2) + (b1 / c1) * (a2 / c2)', decimals: 4,
    explain: R`$\cos\alpha = \frac{ {{b1}} }{ {{c1}} }$, $\sin\beta = \frac{ {{a2}} }{ {{c2}} }$. $\sin(\alpha+\beta) = \sin\alpha\cos\beta+\cos\alpha\sin\beta = \frac{ {{= a1*b2 + b1*a2}} }{ {{= c1*c2}} }$.` }),
  bank('sumdiff', [
    [R`$\cos(\alpha+\beta) =$`, R`$\cos\alpha\cos\beta-\sin\alpha\sin\beta$`, [R`$\cos\alpha\cos\beta+\sin\alpha\sin\beta$`, R`$\cos\alpha+\cos\beta$`, R`$\sin\alpha\cos\beta+\cos\alpha\sin\beta$`], R`The cosine formula flips the sign.`],
    [R`$\sin2\theta =$`, R`$2\sin\theta\cos\theta$`, [R`$2\sin\theta$`, R`$\sin^2\theta-\cos^2\theta$`, R`$1-2\sin^2\theta$`], R`From $\sin(\theta+\theta)$.`],
    [R`Which is NOT a form of $\cos2\theta$?`, R`$2\sin\theta\cos\theta$`, [R`$\cos^2\theta-\sin^2\theta$`, R`$1-2\sin^2\theta$`, R`$2\cos^2\theta-1$`], R`That is $\sin2\theta$.`],
    [R`$15^\circ$ is best written as`, R`$45^\circ-30^\circ$`, [R`$\frac{30^\circ}{2}$ only`, R`$90^\circ-60^\circ$`, R`$10^\circ+5^\circ$`], R`Both are special angles.`],
    [R`$\sin(\alpha+\beta) = \sin\alpha+\sin\beta$ is`, 'false in general', ['always true', 'true for acute angles', 'true in radians'], R`Try $\alpha = \beta = 90^\circ$: $0\ne2$.`]
  ]),

  /* ---------------- triangle laws ---------------- */
  calc('laws', { vars: { a: [5, 6, 7, 8, 10], b: [6, 9, 10, 12], C: [30, 45, 60, 90, 120] },
    prompt: R`In a triangle, $a = {{a}}$, $b = {{b}}$ and $C = {{C}}^\circ$. Find $c$.`,
    answer: 'sqrt(a^2 + b^2 - 2*a*b*cosd(C))', decimals: 3,
    explain: R`Law of Cosines: $c^2 = {{= a^2}}+{{= b^2}}-2({{a}})({{b}})\cos{{C}}^\circ\approx{{= a^2 + b^2 - 2*a*b*cosd(C) | 3}}$, so $c\approx{{= answer | 3}}$.` }),
  calc('laws', { vars: { a: [5, 6, 7, 8], b: [6, 7, 8, 9], c: [7, 8, 10, 11] }, where: 'a + b > c && a + c > b && b + c > a',
    prompt: R`A triangle has sides $a = {{a}}$, $b = {{b}}$ and $c = {{c}}$. Find angle $C$ in degrees.`,
    answer: 'acosd((a^2 + b^2 - c^2) / (2*a*b))', decimals: 2, unit: '°',
    explain: R`Law of Cosines: $\cos C = \frac{ {{= a^2}}+{{= b^2}}-{{= c^2}} }{2({{a}})({{b}})}\approx{{= (a^2 + b^2 - c^2)/(2*a*b) | 4}}$, so $C\approx{{= answer | 2}}^\circ$.` }),
  calc('laws', { vars: { A: [30, 45, 60], B: [45, 60, 75], a: [6, 8, 10, 12] }, where: 'A + B < 180',
    prompt: R`In a triangle, $A = {{A}}^\circ$, $B = {{B}}^\circ$ and $a = {{a}}$. Find $b$.`,
    answer: 'a * sind(B) / sind(A)', decimals: 3,
    explain: R`Law of Sines: $b = \frac{a\sin B}{\sin A} = \frac{ {{a}}\sin{{B}}^\circ}{\sin{{A}}^\circ}\approx{{= answer | 3}}$.` }),
  calc('laws', { vars: { a: [4, 6, 8, 10], b: [5, 7, 9], C: [30, 45, 60, 90, 150] },
    prompt: R`Find the area of a triangle with sides {{a}} and {{b}} and an included angle of $ {{C}}^\circ$.`,
    answer: '0.5 * a * b * sind(C)', decimals: 3,
    explain: R`Area $= \frac12ab\sin C = \frac12({{a}})({{b}})\sin{{C}}^\circ\approx{{= answer | 3}}$.` }),
  bank('laws', [
    [R`You know two sides and the angle between them (SAS). Use`, 'the Law of Cosines', ['the Law of Sines', 'SOH CAH TOA only', 'the area formula'], R`No side-angle pair is known yet.`],
    [R`You know all three sides (SSS). To find an angle, use`, 'the Law of Cosines', ['the Law of Sines', 'the Pythagorean theorem only', 'arctan'], R`Solve $c^2 = a^2+b^2-2ab\cos C$ for $\cos C$.`],
    [R`You know two angles and a side (AAS). Use`, 'the Law of Sines', ['the Law of Cosines', 'the double-angle formula', 'nothing: it cannot be solved'], R`The third angle is $180^\circ$ minus the other two, then sides follow.`],
    [R`The ambiguous case is`, 'SSA', ['SAS', 'SSS', 'ASA'], R`Zero, one or two triangles can fit.`],
    [R`With $C = 90^\circ$, the Law of Cosines becomes`, 'the Pythagorean theorem', ['the Law of Sines', 'a sum formula', 'the area formula'], R`$\cos90^\circ = 0$.`]
  ])
];

module.exports = { hint: 'Draw a picture: a unit circle, a reference triangle or the triangle you are solving.', topics, ladders, questions };
