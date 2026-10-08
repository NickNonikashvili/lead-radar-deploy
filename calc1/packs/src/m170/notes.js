/* M 170: topic notes, formulas, flashcards, practice sets and checklists.
   Written for Mathub from standard trigonometry, following OpenStax Algebra and Trigonometry 2e,
   chapters 7–10, and the course's learning outcomes. Class, WeBWorK and the written homework decide
   what the exams ask. */
const R = String.raw;
const OS = 'https://openstax.org/books/algebra-and-trigonometry-2e/pages/';

const SECTIONS = [
  /* ---------- Unit 1: angles, triangles and the unit circle ---------- */
  { id: 'angles', label: '7.1', title: 'Angles, degrees and radians', unit: 1, link: OS + '7-1-angles', linkLabel: 'OpenStax 7.1',
    ideas: [
      R`An angle in <b>standard position</b> starts on the positive $x$-axis; positive angles turn counterclockwise, negative angles clockwise.`,
      R`A <b>radian</b> is the angle that cuts off an arc as long as the radius. A full turn is $2\pi$ radians, so $360^\circ = 2\pi$ and $180^\circ = \pi$.`,
      R`To convert, multiply by $\frac{\pi}{180^\circ}$ (degrees to radians) or $\frac{180^\circ}{\pi}$ (radians to degrees). Memorize the landmarks: $30^\circ = \frac\pi6$, $45^\circ = \frac\pi4$, $60^\circ = \frac\pi3$, $90^\circ = \frac\pi2$.`,
      R`<b>Coterminal</b> angles share a terminal side: add or subtract $360^\circ$ (or $2\pi$) as many times as you like.`,
      R`With $\theta$ in radians: <b>arc length</b> $s = r\theta$, <b>sector area</b> $A = \frac12r^2\theta$, and linear speed $v = r\omega$ for angular speed $\omega$.`
    ],
    formulas: [{ n: 'Conversion', t: R`180^\circ=\pi\ \text{rad}` }, { n: 'Arc length', t: R`s=r\theta\quad(\theta\ \text{in radians})` }, { n: 'Sector area', t: R`A=\tfrac12r^2\theta` }],
    example: { p: R`Convert $150^\circ$ to radians and find the arc it cuts off on a circle of radius 4.`, s: R`$150^\circ\cdot\frac{\pi}{180^\circ} = \frac{5\pi}{6}$. Then $s = r\theta = 4\cdot\frac{5\pi}{6} = \frac{10\pi}{3}\approx10.47$.` },
    pitfalls: [R`Using degrees in $s = r\theta$; it needs radians.`, R`Converting the wrong way: multiplying degrees by $\frac{180}{\pi}$.`],
    tip: R`Think of $\pi$ as $180^\circ$: then $\frac{5\pi}{6}$ is $5\cdot30^\circ = 150^\circ$ at a glance.` },

  { id: 'righttri', label: '7.2', title: 'Right triangle trigonometry and similar triangles', unit: 1, link: OS + '7-2-right-triangle-trigonometry', linkLabel: 'OpenStax 7.2',
    ideas: [
      R`For an acute angle $\theta$ in a right triangle: $\sin\theta = \frac{\text{opp}}{\text{hyp}}$, $\cos\theta = \frac{\text{adj}}{\text{hyp}}$, $\tan\theta = \frac{\text{opp}}{\text{adj}}$ (SOH CAH TOA).`,
      R`<b>Similar triangles</b> have the same angles, so their sides are proportional. That is why the ratios depend only on the angle, not on the size of the triangle, and why you can find heights from shadows.`,
      R`The special triangles: $45^\circ$-$45^\circ$-$90^\circ$ has sides $1 : 1 : \sqrt2$; $30^\circ$-$60^\circ$-$90^\circ$ has sides $1 : \sqrt3 : 2$ (short leg opposite $30^\circ$).`,
      R`<b>Cofunctions:</b> $\sin\theta = \cos(90^\circ-\theta)$, because the two acute angles of a right triangle share the same sides.`,
      R`Angles of elevation (looking up) and depression (looking down) turn real situations into right triangles: height $=$ distance $\times\tan(\text{angle})$.`
    ],
    formulas: [{ n: 'SOH CAH TOA', t: R`\sin\theta=\frac{\text{opp}}{\text{hyp}},\ \cos\theta=\frac{\text{adj}}{\text{hyp}},\ \tan\theta=\frac{\text{opp}}{\text{adj}}` }, { n: 'Cofunction', t: R`\sin\theta=\cos(90^\circ-\theta)` }],
    example: { p: R`From 50 ft away, the angle of elevation to the top of a tree is $30^\circ$. How tall is the tree?`, s: R`$\tan30^\circ = \frac{h}{50}$, so $h = 50\tan30^\circ = \frac{50}{\sqrt3} = \frac{50\sqrt3}{3}\approx28.9$ ft.` },
    pitfalls: [R`Mixing up opposite and adjacent: they depend on which angle you are using.`, R`Putting the $\sqrt3$ on the wrong leg of the $30$-$60$-$90$ triangle: the longer leg is opposite $60^\circ$.`],
    tip: R`Draw both special triangles in the margin at the start of every exam.` },

  { id: 'unitcircle', label: '7.3', title: 'The unit circle', unit: 1, link: OS + '7-3-unit-circle', linkLabel: 'OpenStax 7.3',
    ideas: [
      R`On the <b>unit circle</b> (radius 1), the angle $t$ lands at the point $(\cos t, \sin t)$. This defines sine and cosine for every angle, not just acute ones.`,
      R`Since $x^2+y^2 = 1$: $\sin^2t+\cos^2t = 1$, and both $\sin t$ and $\cos t$ lie between $-1$ and $1$.`,
      R`First-quadrant values: at $\frac\pi6$ the point is $\left(\frac{\sqrt3}2,\frac12\right)$; at $\frac\pi4$, $\left(\frac{\sqrt2}2,\frac{\sqrt2}2\right)$; at $\frac\pi3$, $\left(\frac12,\frac{\sqrt3}2\right)$.`,
      R`The <b>reference angle</b> is the acute angle to the $x$-axis. Every other angle's values are the reference angle's values with signs set by the quadrant.`,
      R`Signs by quadrant: I all positive; II sine positive; III tangent positive; IV cosine positive ("All Students Take Calculus").`
    ],
    formulas: [{ n: 'Unit circle point', t: R`(x,y)=(\cos t,\ \sin t)` }, { n: 'Pythagorean identity', t: R`\sin^2t+\cos^2t=1` }],
    example: { p: R`Find $\sin\frac{5\pi}{6}$ and $\cos\frac{5\pi}{6}$.`, s: R`$\frac{5\pi}{6}$ is in quadrant II with reference angle $\frac\pi6$. So $\sin\frac{5\pi}{6} = \frac12$ (positive in II) and $\cos\frac{5\pi}{6} = -\frac{\sqrt3}{2}$.` },
    pitfalls: [R`Swapping $\sin$ and $\cos$: cosine is the $x$-coordinate, sine the $y$.`, R`Forgetting the sign from the quadrant.`],
    tip: R`Memorize only the first quadrant. Every other value is a reference angle plus a sign.` },

  { id: 'otherfns', label: '7.4', title: 'The other trigonometric functions', unit: 1, link: OS + '7-4-the-other-trigonometric-functions', linkLabel: 'OpenStax 7.4',
    ideas: [
      R`$\tan t = \frac{\sin t}{\cos t}$, $\sec t = \frac{1}{\cos t}$, $\csc t = \frac{1}{\sin t}$ and $\cot t = \frac{\cos t}{\sin t}$. Each is undefined where its denominator is 0, such as $\tan\frac\pi2$.`,
      R`<b>Even and odd:</b> cosine and secant are even, $\cos(-t) = \cos t$. Sine, cosecant, tangent and cotangent are odd, $\sin(-t) = -\sin t$.`,
      R`More Pythagorean identities: divide $\sin^2t+\cos^2t = 1$ by $\cos^2t$ to get $1+\tan^2t = \sec^2t$, or by $\sin^2t$ to get $1+\cot^2t = \csc^2t$.`,
      R`Sine and cosine repeat every $2\pi$; tangent and cotangent repeat every $\pi$.`,
      R`Given one value and the quadrant, find the rest by drawing a reference triangle and attaching signs.`
    ],
    formulas: [{ n: 'Quotient and reciprocal', t: R`\tan t=\frac{\sin t}{\cos t},\ \sec t=\frac1{\cos t},\ \csc t=\frac1{\sin t},\ \cot t=\frac{\cos t}{\sin t}` }, { n: 'Pythagorean', t: R`1+\tan^2t=\sec^2t,\qquad1+\cot^2t=\csc^2t` }],
    example: { p: R`If $\sin t = \frac35$ and $t$ is in quadrant II, find $\cos t$, $\tan t$ and $\sec t$.`, s: R`Reference triangle 3-4-5. In quadrant II cosine is negative: $\cos t = -\frac45$, $\tan t = \frac{3/5}{-4/5} = -\frac34$, $\sec t = -\frac54$.` },
    pitfalls: [R`Thinking $\sec t = \frac{1}{\sin t}$; secant goes with cosine, cosecant with sine.`, R`Dropping the sign when finding the missing side of the reference triangle.`],
    tip: R`"Co" pairs with "non-co": secant with cosine, cosecant with sine.` },

  /* ---------- Unit 2: graphs, identities, inverses and the triangle laws ---------- */
  { id: 'graphs', label: '8.1', title: 'Graphs of sine and cosine', unit: 2, link: OS + '8-1-graphs-of-the-sine-and-cosine-functions', linkLabel: 'OpenStax 8.1',
    ideas: [
      R`$y = \sin x$ starts at 0, rises to 1 at $\frac\pi2$, returns to 0 at $\pi$, falls to $-1$ at $\frac{3\pi}2$ and is back at 0 at $2\pi$. $y = \cos x$ is the same wave shifted left by $\frac\pi2$: it starts at its maximum.`,
      R`Sine is <b>odd</b>: its graph is symmetric about the origin. Cosine is <b>even</b>: its graph is symmetric about the $y$-axis.`,
      R`For $y = A\sin\big(B(x-C)\big)+D$: <b>amplitude</b> $|A|$, <b>period</b> $\frac{2\pi}{|B|}$, <b>phase shift</b> $C$ (right if positive), <b>midline</b> $y = D$.`,
      R`The maximum is $D+|A|$ and the minimum $D-|A|$, so the range is $[D-|A|,\ D+|A|]$.`,
      R`To sketch one period, split it into four equal parts and plot the five key points: midline, max, midline, min, midline (for sine).`
    ],
    formulas: [{ n: 'Sinusoid', t: R`y=A\sin\big(B(x-C)\big)+D` }, { n: 'Features', t: R`\text{amplitude }|A|,\quad\text{period }\frac{2\pi}{|B|},\quad\text{midline }y=D` }],
    example: { p: R`Describe $y = 3\cos(2x)-1$.`, s: R`Amplitude 3, period $\frac{2\pi}{2} = \pi$, midline $y = -1$, range $[-4, 2]$. It starts at its maximum, $2$, at $x = 0$.` },
    pitfalls: [R`Reading the phase shift from $\sin(2x-\pi)$ as $\pi$; factor first: $\sin\big(2(x-\frac\pi2)\big)$ shifts by $\frac\pi2$.`, R`Using $B$ as the period instead of $\frac{2\pi}{B}$.`],
    tip: R`Find the midline and amplitude first, then the period; the sketch follows.` },

  { id: 'inverse', label: '8.3', title: 'Inverse trigonometric functions', unit: 2, link: OS + '8-3-inverse-trigonometric-functions', linkLabel: 'OpenStax 8.3',
    ideas: [
      R`Trig functions repeat, so they are not one-to-one. Their inverses use <b>restricted domains</b>, and each returns one angle.`,
      R`$\arcsin x$ (or $\sin^{-1}x$) takes $x\in[-1,1]$ and returns an angle in $\left[-\frac\pi2,\frac\pi2\right]$. $\arccos x$ returns an angle in $[0,\pi]$. $\arctan x$ takes any $x$ and returns an angle in $\left(-\frac\pi2,\frac\pi2\right)$.`,
      R`$\sin(\arcsin x) = x$ for $x$ in $[-1,1]$, but $\arcsin(\sin x) = x$ only when $x$ is in $\left[-\frac\pi2,\frac\pi2\right]$: $\arcsin\left(\sin\frac{5\pi}6\right) = \frac\pi6$.`,
      R`For expressions like $\cos(\arcsin\frac35)$, draw the triangle for the inner angle and read off the outer function.`,
      R`To solve $\sin x = \frac12$ on $[0,2\pi)$, find the reference angle $\frac\pi6$ and every quadrant where sine is positive: $x = \frac\pi6$ or $\frac{5\pi}6$.`
    ],
    formulas: [{ n: 'Ranges', t: R`\arcsin:\left[-\tfrac\pi2,\tfrac\pi2\right],\quad\arccos:[0,\pi],\quad\arctan:\left(-\tfrac\pi2,\tfrac\pi2\right)` }],
    example: { p: R`Find $\arccos\left(-\frac12\right)$ and $\cos\left(\arcsin\frac35\right)$.`, s: R`$\arccos$ returns an angle in $[0,\pi]$ with cosine $-\frac12$: $\frac{2\pi}3$. For the second, $\arcsin\frac35$ is an angle with opposite 3 and hypotenuse 5, so adjacent 4 and the cosine is $\frac45$.` },
    pitfalls: [R`Answering $\arcsin\left(-\frac12\right) = \frac{7\pi}6$; the range forces $-\frac\pi6$.`, R`Reading $\sin^{-1}x$ as $\frac{1}{\sin x}$; that is $\csc x$.`],
    tip: R`Memorize each range as a picture: arcsin and arctan live on the right half of the circle, arccos on the top half.` },

  { id: 'identities', label: '9.1', title: 'Verifying identities', unit: 2, link: OS + '9-1-verifying-trigonometric-identities-and-using-trigonometric-identities-to-simplify-trigonometric-expressions', linkLabel: 'OpenStax 9.1',
    ideas: [
      R`An <b>identity</b> is true for every value where both sides are defined. To verify one, transform one side until it matches the other; never work on both sides at once as if it were an equation.`,
      R`Toolkit: reciprocal and quotient identities, the Pythagorean identities $\sin^2+\cos^2 = 1$, $1+\tan^2 = \sec^2$, $1+\cot^2 = \csc^2$, and even and odd identities.`,
      R`Strategies: start with the more complicated side; rewrite everything in sines and cosines; combine fractions over a common denominator; factor; multiply by a conjugate like $1+\cos x$.`,
      R`Simplifying is the same skill: $\frac{1-\cos^2x}{\sin x} = \frac{\sin^2x}{\sin x} = \sin x$.`
    ],
    formulas: [{ n: 'Fundamental identities', t: R`\sin^2x+\cos^2x=1,\quad\tan x=\frac{\sin x}{\cos x},\quad\sec x=\frac1{\cos x}` }],
    example: { p: R`Verify $\sec\theta-\cos\theta = \sin\theta\tan\theta$.`, s: R`Left side: $\frac{1}{\cos\theta}-\cos\theta = \frac{1-\cos^2\theta}{\cos\theta} = \frac{\sin^2\theta}{\cos\theta} = \sin\theta\cdot\frac{\sin\theta}{\cos\theta} = \sin\theta\tan\theta$.` },
    pitfalls: [R`Cross-multiplying or adding to both sides, which assumes what you are trying to prove.`, R`Writing $\sin^2x$ as $\sin(x^2)$.`],
    tip: R`When stuck, convert to sines and cosines; it nearly always opens a path.` },

  { id: 'sumdiff', label: '9.2–9.3', title: 'Sum, difference and double-angle formulas', unit: 2, link: OS + '9-2-sum-and-difference-identities', linkLabel: 'OpenStax 9.2 (and 9.3)',
    ideas: [
      R`$\sin(\alpha\pm\beta) = \sin\alpha\cos\beta\pm\cos\alpha\sin\beta$.`,
      R`$\cos(\alpha\pm\beta) = \cos\alpha\cos\beta\mp\sin\alpha\sin\beta$: note the sign flips.`,
      R`They give exact values for angles like $15^\circ = 45^\circ-30^\circ$ and $75^\circ = 45^\circ+30^\circ$.`,
      R`<b>Double angle:</b> $\sin2\theta = 2\sin\theta\cos\theta$ and $\cos2\theta = \cos^2\theta-\sin^2\theta = 1-2\sin^2\theta = 2\cos^2\theta-1$.`,
      R`To use them you need both the sine and cosine of each angle: find the missing one from a reference triangle and the quadrant.`
    ],
    formulas: [{ n: 'Sum and difference', t: R`\sin(\alpha\pm\beta)=\sin\alpha\cos\beta\pm\cos\alpha\sin\beta,\quad\cos(\alpha\pm\beta)=\cos\alpha\cos\beta\mp\sin\alpha\sin\beta` }, { n: 'Double angle', t: R`\sin2\theta=2\sin\theta\cos\theta,\quad\cos2\theta=1-2\sin^2\theta` }],
    example: { p: R`Find the exact value of $\cos75^\circ$.`, s: R`$\cos(45^\circ+30^\circ) = \cos45^\circ\cos30^\circ-\sin45^\circ\sin30^\circ = \frac{\sqrt2}{2}\cdot\frac{\sqrt3}{2}-\frac{\sqrt2}{2}\cdot\frac12 = \frac{\sqrt6-\sqrt2}{4}\approx0.2588$.` },
    pitfalls: [R`Writing $\sin(\alpha+\beta) = \sin\alpha+\sin\beta$.`, R`Keeping the plus sign in the cosine sum formula; it becomes a minus.`],
    tip: R`Check an exact answer with a calculator at home: $\cos75^\circ\approx0.2588$.` },

  { id: 'laws', label: '10.1–10.2', title: 'The Laws of Sines and Cosines', unit: 2, link: OS + '10-1-non-right-triangles-law-of-sines', linkLabel: 'OpenStax 10.1 (and 10.2)',
    ideas: [
      R`They solve triangles that are not right triangles. Label sides $a, b, c$ opposite angles $A, B, C$.`,
      R`<b>Law of Sines:</b> $\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C}$. Use it when you know a side and its opposite angle (AAS, ASA, or SSA).`,
      R`SSA is the <b>ambiguous case</b>: there may be no triangle, one, or two, because $\sin B = k$ has two solutions between $0^\circ$ and $180^\circ$.`,
      R`<b>Law of Cosines:</b> $c^2 = a^2+b^2-2ab\cos C$. Use it for two sides and the angle between them (SAS) or all three sides (SSS). With $C = 90^\circ$ it becomes the Pythagorean theorem.`,
      R`<b>Area</b> of any triangle: $\frac12ab\sin C$, half the product of two sides and the sine of the angle between them.`
    ],
    formulas: [{ n: 'Law of Sines', t: R`\frac{a}{\sin A}=\frac{b}{\sin B}=\frac{c}{\sin C}` }, { n: 'Law of Cosines', t: R`c^2=a^2+b^2-2ab\cos C` }, { n: 'Area', t: R`\text{Area}=\tfrac12ab\sin C` }],
    example: { p: R`In a triangle, $a = 7$, $b = 10$ and $C = 60^\circ$. Find $c$.`, s: R`Two sides and the included angle: Law of Cosines. $c^2 = 49+100-2(7)(10)\cos60^\circ = 149-70 = 79$, so $c = \sqrt{79}\approx8.89$.` },
    pitfalls: [R`Using the Law of Sines with SAS or SSS, where no side-angle pair is known.`, R`Forgetting the second triangle in the ambiguous case.`],
    tip: R`Ask: do I know a side and its opposite angle? Yes, Law of Sines. No, Law of Cosines.` }
];

const FORMULAS = [
  { group: 'Angles', items: [
    { n: 'Degrees and radians', t: R`180^\circ=\pi,\quad1^\circ=\tfrac{\pi}{180}` },
    { n: 'Landmarks', t: R`30^\circ=\tfrac\pi6,\ 45^\circ=\tfrac\pi4,\ 60^\circ=\tfrac\pi3,\ 90^\circ=\tfrac\pi2` },
    { n: 'Arc length and sector area', t: R`s=r\theta,\qquad A=\tfrac12r^2\theta` },
    { n: 'Coterminal', d: R`Add or subtract $360^\circ$ (or $2\pi$).` }
  ] },
  { group: 'Triangles and the unit circle', items: [
    { n: 'SOH CAH TOA', t: R`\sin\theta=\tfrac{\text{opp}}{\text{hyp}},\ \cos\theta=\tfrac{\text{adj}}{\text{hyp}},\ \tan\theta=\tfrac{\text{opp}}{\text{adj}}` },
    { n: '45-45-90 triangle', t: R`1:1:\sqrt2` },
    { n: '30-60-90 triangle', t: R`1:\sqrt3:2` },
    { n: 'Unit circle', t: R`(\cos t,\ \sin t)` },
    { n: 'π/6, π/4, π/3', t: R`\left(\tfrac{\sqrt3}2,\tfrac12\right),\ \left(\tfrac{\sqrt2}2,\tfrac{\sqrt2}2\right),\ \left(\tfrac12,\tfrac{\sqrt3}2\right)` },
    { n: 'Signs', d: 'Quadrant I: all positive. II: sine. III: tangent. IV: cosine.' },
    { n: 'Reciprocal and quotient', t: R`\tan=\tfrac{\sin}{\cos},\ \sec=\tfrac1{\cos},\ \csc=\tfrac1{\sin},\ \cot=\tfrac{\cos}{\sin}` },
    { n: 'Even and odd', t: R`\cos(-t)=\cos t,\quad\sin(-t)=-\sin t,\quad\tan(-t)=-\tan t` }
  ] },
  { group: 'Graphs and inverses', items: [
    { n: 'Sinusoid', t: R`y=A\sin\big(B(x-C)\big)+D` },
    { n: 'Amplitude, period, midline', t: R`|A|,\quad\tfrac{2\pi}{|B|},\quad y=D` },
    { n: 'Periods', d: 'Sine and cosine 2π; tangent and cotangent π.' },
    { n: 'Inverse ranges', t: R`\arcsin\in\left[-\tfrac\pi2,\tfrac\pi2\right],\ \arccos\in[0,\pi],\ \arctan\in\left(-\tfrac\pi2,\tfrac\pi2\right)` }
  ] },
  { group: 'Identities', items: [
    { n: 'Pythagorean', t: R`\sin^2x+\cos^2x=1,\quad1+\tan^2x=\sec^2x,\quad1+\cot^2x=\csc^2x` },
    { n: 'Sum and difference', t: R`\sin(\alpha\pm\beta)=\sin\alpha\cos\beta\pm\cos\alpha\sin\beta` },
    { n: 'Cosine sum and difference', t: R`\cos(\alpha\pm\beta)=\cos\alpha\cos\beta\mp\sin\alpha\sin\beta` },
    { n: 'Double angle', t: R`\sin2\theta=2\sin\theta\cos\theta,\quad\cos2\theta=\cos^2\theta-\sin^2\theta` },
    { n: 'Cofunction', t: R`\sin\theta=\cos\left(\tfrac\pi2-\theta\right)` }
  ] },
  { group: 'Triangle laws', items: [
    { n: 'Law of Sines', t: R`\frac{a}{\sin A}=\frac{b}{\sin B}=\frac{c}{\sin C}` },
    { n: 'Law of Cosines', t: R`c^2=a^2+b^2-2ab\cos C` },
    { n: 'Area', t: R`\tfrac12ab\sin C` },
    { n: 'Which law?', d: 'A side and its opposite angle known: Law of Sines. SAS or SSS: Law of Cosines.' }
  ] }
];

const fc = [];
const card = (unit, sec, f, b) => fc.push({ id: 'c-' + sec + '-' + (fc.filter(c => c.sec === sec).length + 1), unit, sec, f, b });
card(1, 'angles', R`$180^\circ$ in radians`, R`$\pi$`);
card(1, 'angles', R`Convert degrees to radians`, R`Multiply by $\frac{\pi}{180^\circ}$.`);
card(1, 'angles', R`$\frac{2\pi}3$ in degrees`, R`$120^\circ$`);
card(1, 'angles', R`Arc length formula`, R`$s = r\theta$, with $\theta$ in radians.`);
card(1, 'angles', R`Sector area`, R`$\frac12r^2\theta$`);
card(1, 'angles', R`Coterminal angle of $400^\circ$ in $[0^\circ,360^\circ)$`, R`$40^\circ$`);
card(1, 'righttri', R`SOH CAH TOA`, R`$\sin = \frac{\text{opp}}{\text{hyp}}$, $\cos = \frac{\text{adj}}{\text{hyp}}$, $\tan = \frac{\text{opp}}{\text{adj}}$`);
card(1, 'righttri', R`Sides of a 30-60-90 triangle`, R`$1 : \sqrt3 : 2$ (short leg opposite $30^\circ$).`);
card(1, 'righttri', R`Sides of a 45-45-90 triangle`, R`$1 : 1 : \sqrt2$`);
card(1, 'righttri', R`Why do trig ratios not depend on triangle size?`, R`Triangles with the same angles are similar, so their sides are proportional.`);
card(1, 'righttri', R`Cofunction identity`, R`$\sin\theta = \cos(90^\circ-\theta)$`);
card(1, 'unitcircle', R`Point on the unit circle at angle $t$`, R`$(\cos t, \sin t)$`);
card(1, 'unitcircle', R`$\sin\frac\pi6$, $\cos\frac\pi6$`, R`$\frac12$, $\frac{\sqrt3}2$`);
card(1, 'unitcircle', R`$\sin\frac\pi4$, $\cos\frac\pi4$`, R`$\frac{\sqrt2}2$, $\frac{\sqrt2}2$`);
card(1, 'unitcircle', R`$\sin\frac\pi3$, $\cos\frac\pi3$`, R`$\frac{\sqrt3}2$, $\frac12$`);
card(1, 'unitcircle', R`Which functions are positive in quadrant III?`, R`Tangent and cotangent.`);
card(1, 'unitcircle', R`Reference angle of $\frac{7\pi}6$`, R`$\frac\pi6$`);
card(1, 'unitcircle', R`$\cos\pi$, $\sin\frac{3\pi}2$`, R`$-1$, $-1$`);
card(1, 'otherfns', R`$\sec t$ and $\csc t$`, R`$\frac{1}{\cos t}$ and $\frac{1}{\sin t}$`);
card(1, 'otherfns', R`Which trig functions are even?`, R`Cosine and secant.`);
card(1, 'otherfns', R`$1+\tan^2t =$`, R`$\sec^2t$`);
card(1, 'otherfns', R`Period of $\tan x$`, R`$\pi$`);
card(1, 'otherfns', R`$\tan\frac\pi3$`, R`$\sqrt3$`);
card(2, 'graphs', R`Amplitude of $y = A\sin(Bx)$`, R`$|A|$`);
card(2, 'graphs', R`Period of $y = \sin(Bx)$`, R`$\frac{2\pi}{|B|}$`);
card(2, 'graphs', R`Midline of $y = \cos x+D$`, R`$y = D$`);
card(2, 'graphs', R`Phase shift of $y = \sin(2x-\pi)$`, R`$\frac\pi2$ to the right (factor: $\sin2(x-\frac\pi2)$).`);
card(2, 'graphs', R`Symmetry of the sine and cosine graphs`, R`Sine: about the origin (odd). Cosine: about the $y$-axis (even).`);
card(2, 'inverse', R`Range of $\arcsin$`, R`$\left[-\frac\pi2,\frac\pi2\right]$`);
card(2, 'inverse', R`Range of $\arccos$`, R`$[0,\pi]$`);
card(2, 'inverse', R`$\arctan1$`, R`$\frac\pi4$`);
card(2, 'inverse', R`$\arcsin\left(-\frac12\right)$`, R`$-\frac\pi6$`);
card(2, 'inverse', R`$\arcsin\left(\sin\frac{5\pi}6\right)$`, R`$\frac\pi6$`);
card(2, 'identities', R`Pythagorean identity`, R`$\sin^2x+\cos^2x = 1$`);
card(2, 'identities', R`First move when verifying a stubborn identity`, R`Rewrite everything in sines and cosines.`);
card(2, 'identities', R`$\frac{1-\cos^2x}{\sin x}$ simplifies to`, R`$\sin x$`);
card(2, 'sumdiff', R`$\sin(\alpha+\beta)$`, R`$\sin\alpha\cos\beta+\cos\alpha\sin\beta$`);
card(2, 'sumdiff', R`$\cos(\alpha+\beta)$`, R`$\cos\alpha\cos\beta-\sin\alpha\sin\beta$`);
card(2, 'sumdiff', R`$\sin2\theta$`, R`$2\sin\theta\cos\theta$`);
card(2, 'sumdiff', R`$\cos2\theta$ (three forms)`, R`$\cos^2\theta-\sin^2\theta = 1-2\sin^2\theta = 2\cos^2\theta-1$`);
card(2, 'sumdiff', R`Exact $\sin15^\circ$`, R`$\frac{\sqrt6-\sqrt2}4$`);
card(2, 'laws', R`Law of Sines`, R`$\frac{a}{\sin A} = \frac{b}{\sin B} = \frac{c}{\sin C}$`);
card(2, 'laws', R`Law of Cosines`, R`$c^2 = a^2+b^2-2ab\cos C$`);
card(2, 'laws', R`Which law for SAS or SSS?`, R`Law of Cosines.`);
card(2, 'laws', R`What is the ambiguous case?`, R`SSA: zero, one or two triangles can fit.`);
card(2, 'laws', R`Area of a triangle from two sides and the included angle`, R`$\frac12ab\sin C$`);

const PRACTICE = {
  exam1: { title: 'Exam 1 practice', subtitle: 'Angles, right triangles and the unit circle. No calculator: give exact values and explain each step.', problems: [
    { n: 1, sec: 'angles', tags: ['radians'], q: R`Convert $225^\circ$ to radians and $\frac{7\pi}{6}$ to degrees.`, s: R`$225\cdot\frac{\pi}{180} = \frac{5\pi}{4}$. $\frac{7\pi}6\cdot\frac{180^\circ}{\pi} = 210^\circ$.` },
    { n: 2, sec: 'angles', tags: ['arc length'], q: R`A circle has radius 6 cm. Find the length of the arc cut off by a central angle of $40^\circ$, and the area of that sector.`, s: R`$40^\circ = \frac{2\pi}9$. Arc $s = 6\cdot\frac{2\pi}{9} = \frac{4\pi}3\approx4.19$ cm. Area $\frac12\cdot36\cdot\frac{2\pi}9 = 4\pi\approx12.57$ cm².` },
    { n: 3, sec: 'righttri', tags: ['similar triangles'], q: R`A 6 ft person casts a 4 ft shadow while a flagpole casts a 22 ft shadow. How tall is the flagpole? Explain why your method works.`, s: R`The sun's rays make the same angle with both, so the triangles are similar and their sides proportional: $\frac{h}{22} = \frac64$, so $h = 33$ ft.` },
    { n: 4, sec: 'righttri', tags: ['elevation'], q: R`From a point 40 m from the base of a building, the angle of elevation to its top is $60^\circ$. How tall is the building?`, s: R`$\tan60^\circ = \frac{h}{40}$, so $h = 40\sqrt3\approx69.3$ m.` },
    { n: 5, sec: 'unitcircle', tags: ['exact values'], q: R`Find exactly: $\sin\frac{4\pi}3$, $\cos\frac{3\pi}4$, $\tan\frac{11\pi}6$.`, s: R`$\frac{4\pi}3$: quadrant III, reference $\frac\pi3$: $-\frac{\sqrt3}2$. $\frac{3\pi}4$: quadrant II, reference $\frac\pi4$: $-\frac{\sqrt2}2$. $\frac{11\pi}6$: quadrant IV, reference $\frac\pi6$: $\tan = -\frac{1}{\sqrt3} = -\frac{\sqrt3}3$.` },
    { n: 6, sec: 'otherfns', tags: ['reference triangle'], q: R`If $\cos t = -\frac{5}{13}$ and $t$ is in quadrant III, find $\sin t$, $\tan t$ and $\csc t$.`, s: R`Reference triangle 5-12-13. In quadrant III sine is negative and tangent positive: $\sin t = -\frac{12}{13}$, $\tan t = \frac{12}{5}$, $\csc t = -\frac{13}{12}$.` },
    { n: 7, sec: 'otherfns', tags: ['even and odd'], q: R`Use even/odd properties to find $\cos\left(-\frac\pi3\right)$ and $\sin\left(-\frac\pi4\right)$.`, s: R`Cosine is even: $\cos\frac\pi3 = \frac12$. Sine is odd: $-\sin\frac\pi4 = -\frac{\sqrt2}2$.` },
    { n: 8, sec: 'unitcircle', tags: ['identity'], q: R`If $\sin t = 0.6$ and $\cos t\lt0$, find $\cos t$ using $\sin^2t+\cos^2t = 1$.`, s: R`$\cos^2t = 1-0.36 = 0.64$, so $\cos t = \pm0.8$; since $\cos t\lt0$, $\cos t = -0.8$.` }
  ] },
  exam2: { title: 'Exam 2 practice', subtitle: 'Graphs, inverses, identities and the triangle laws. No calculator: exact answers, with each step explained.', problems: [
    { n: 1, sec: 'graphs', tags: ['features'], q: R`For $y = -2\sin\left(3x-\pi\right)+1$, find the amplitude, period, phase shift, midline and range.`, s: R`Rewrite as $-2\sin\big(3(x-\frac\pi3)\big)+1$. Amplitude 2, period $\frac{2\pi}3$, phase shift $\frac\pi3$ right, midline $y = 1$, range $[-1, 3]$.` },
    { n: 2, sec: 'inverse', tags: ['exact values'], q: R`Evaluate $\arcsin\left(-\frac{\sqrt3}2\right)$, $\arccos\left(-\frac{\sqrt2}2\right)$ and $\arctan(-1)$.`, s: R`$-\frac\pi3$ (arcsin range), $\frac{3\pi}4$ (arccos range $[0,\pi]$), $-\frac\pi4$.` },
    { n: 3, sec: 'inverse', tags: ['composition'], q: R`Find $\tan\left(\arccos\frac{2}{3}\right)$.`, s: R`The angle has adjacent 2, hypotenuse 3, so opposite $\sqrt{9-4} = \sqrt5$. It is in $[0,\frac\pi2]$, so $\tan = \frac{\sqrt5}2$.` },
    { n: 4, sec: 'inverse', tags: ['equations'], q: R`Solve $2\cos x+1 = 0$ on $[0,2\pi)$.`, s: R`$\cos x = -\frac12$: reference angle $\frac\pi3$, cosine negative in II and III: $x = \frac{2\pi}3, \frac{4\pi}3$.` },
    { n: 5, sec: 'identities', tags: ['verify'], q: R`Verify $\frac{\sin x}{1-\cos x} = \frac{1+\cos x}{\sin x}$.`, s: R`Multiply the left side by $\frac{1+\cos x}{1+\cos x}$: $\frac{\sin x(1+\cos x)}{1-\cos^2x} = \frac{\sin x(1+\cos x)}{\sin^2x} = \frac{1+\cos x}{\sin x}$.` },
    { n: 6, sec: 'sumdiff', tags: ['exact value'], q: R`Find the exact value of $\sin105^\circ$.`, s: R`$\sin(60^\circ+45^\circ) = \frac{\sqrt3}2\cdot\frac{\sqrt2}2+\frac12\cdot\frac{\sqrt2}2 = \frac{\sqrt6+\sqrt2}{4}$.` },
    { n: 7, sec: 'sumdiff', tags: ['double angle'], q: R`If $\sin\theta = \frac45$ with $\theta$ in quadrant II, find $\sin2\theta$ and $\cos2\theta$.`, s: R`$\cos\theta = -\frac35$. $\sin2\theta = 2\cdot\frac45\cdot\left(-\frac35\right) = -\frac{24}{25}$. $\cos2\theta = 1-2\cdot\frac{16}{25} = -\frac{7}{25}$.` },
    { n: 8, sec: 'laws', tags: ['which law'], q: R`(a) A triangle has $A = 30^\circ$, $B = 45^\circ$ and $a = 10$. Find $b$. (b) A triangle has sides 5, 7 and 8. Find the angle opposite the side of length 7.`, s: R`(a) Law of Sines: $b = \frac{10\sin45^\circ}{\sin30^\circ} = \frac{10\cdot\frac{\sqrt2}2}{\frac12} = 10\sqrt2\approx14.1$. (b) Law of Cosines: $49 = 25+64-80\cos B$, so $\cos B = \frac{40}{80} = \frac12$ and $B = 60^\circ$.` }
  ] }
};

const CHECKLISTS = {
  exam1: ['I can convert between degrees and radians and find coterminal angles.', 'I can find arc length and sector area with the angle in radians.', 'I can use SOH CAH TOA, the special triangles and similar triangles to find sides and heights.', 'I can write the first quadrant of the unit circle from memory.', 'I can find sine, cosine and tangent of any special angle using reference angles and signs.', 'I can find all six trig values from one value and the quadrant.', 'I can use even/odd properties and the Pythagorean identities.'],
  exam2: ['I can find the amplitude, period, phase shift and midline of a sinusoid and sketch it.', 'I can describe why sine is odd and cosine is even from their graphs.', 'I can evaluate inverse trig functions within their ranges and simplify compositions with triangles.', 'I can solve basic trig equations on [0, 2π).', 'I can verify identities by working one side.', 'I can use the sum, difference and double-angle formulas for exact values.', 'I can choose and apply the Law of Sines or Cosines, and find a triangle’s area.']
};

module.exports = { SECTIONS, FORMULAS, FLASHCARDS: fc, PRACTICE, CHECKLISTS };
