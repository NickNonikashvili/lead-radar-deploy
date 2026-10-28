/* M170 Trigonometry: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).m170 = {
  angles: {
    plain: 'An angle measures a turn. Start on the positive $x$-axis and turn counterclockwise for positive angles, clockwise for negative. Degrees split a full turn into 360; radians measure it by arc length, so a full turn is $2\\pi$. To convert, multiply by $\\frac{\\pi}{180}$. In radians, arc length is simply $s = r\\theta$.',
    figure: { type: 'figure', shapes: [{ kind: 'circle', at: [0, 0], r: 4 }, { kind: 'segment', from: [0, 0], to: [4, 0], label: 'r = 4' }, { kind: 'segment', from: [0, 0], to: [-3.46, 2] }, { kind: 'angle', at: [0, 0], from: [4, 0], to: [-3.46, 2], label: '150° = 5π/6' }], caption: 'Arc length s = rθ = 4 · 5π/6 = 10π/3 ≈ 10.5.' },
    check: [
      ['Convert 150° to radians.', '$150 \\cdot \\frac{\\pi}{180} = \\frac{5\\pi}{6}$.'],
      ['Convert $\\frac{\\pi}{4}$ to degrees.', '45°.'],
      ['What arc does a 2 rad angle cut on a circle of radius 3?', '$s = 3 \\cdot 2 = 6$.']
    ]
  },
  righttri: {
    plain: 'In a right triangle, each acute angle fixes the shape, so the ratios of the sides depend only on the angle: sine is opposite over hypotenuse, cosine adjacent over hypotenuse, tangent opposite over adjacent (SOH CAH TOA). Know an angle and one side and you can find the rest, like a tree\'s height from its shadow or distance.',
    figure: { type: 'figure', shapes: [{ kind: 'polygon', points: [[0, 0], [5, 0], [5, 2.89]] }, { kind: 'angle', at: [5, 0], from: [0, 0], to: [5, 2.89], right: true }, { kind: 'angle', at: [0, 0], from: [5, 0], to: [5, 2.89], label: '30°' }, { kind: 'text', at: [2.5, -0.45], text: '50 ft' }, { kind: 'text', at: [6, 1.45], text: 'h = 50 tan 30°' }], caption: 'h = 50 tan 30° ≈ 28.9 ft.' },
    check: [
      ['From 50 ft away the angle of elevation to a treetop is 30°. How tall is the tree?', '$50\\tan30^\\circ \\approx 28.9$ ft.'],
      ['What is $\\cos60^\\circ$?', '$\\frac12$.'],
      ['Hypotenuse 10, angle 40°: how long is the opposite side?', '$10\\sin40^\\circ \\approx 6.43$.']
    ]
  },
  unitcircle: {
    plain: 'Put an angle in a circle of radius 1: where it lands is the point $(\\cos t, \\sin t)$. That defines sine and cosine for every angle, not just the ones in triangles. Learn the first quadrant (0, 30°, 45°, 60°, 90°) and use reference angles and quadrant signs for the rest.',
    figure: { type: 'unitcircle', angles: 'all', highlight: 150, caption: '5π/6 is in quadrant II with reference angle π/6: (−√3/2, 1/2).' },
    check: [
      ['Find $\\sin\\frac{5\\pi}{6}$ and $\\cos\\frac{5\\pi}{6}$.', '$\\frac12$ and $-\\frac{\\sqrt3}{2}$.'],
      ['Why is $\\sin^2 t + \\cos^2 t = 1$?', 'The point $(\\cos t, \\sin t)$ is on the circle $x^2 + y^2 = 1$.'],
      ['In which quadrant are both sine and cosine negative?', 'Quadrant III.']
    ]
  },
  otherfns: {
    plain: 'Tangent, secant, cosecant and cotangent are all built from sine and cosine: $\\tan t = \\frac{\\sin t}{\\cos t}$, $\\sec t = \\frac{1}{\\cos t}$, $\\csc t = \\frac{1}{\\sin t}$, $\\cot t = \\frac{\\cos t}{\\sin t}$. Each is undefined where its denominator is zero. Given one trig value and the quadrant, draw a reference triangle to find the others.',
    figure: { type: 'figure', shapes: [{ kind: 'arrow', from: [-5, 0], to: [2, 0] }, { kind: 'arrow', from: [0, -1], to: [0, 4] }, { kind: 'polygon', points: [[0, 0], [-4, 0], [-4, 3]] }, { kind: 'text', at: [-2, -0.45], text: '−4' }, { kind: 'text', at: [-4.5, 1.5], text: '3' }, { kind: 'text', at: [-1.5, 2], text: '5' }], caption: 'sin t = 3/5 in quadrant II: cos t = −4/5, tan t = −3/4, sec t = −5/4.' },
    check: [
      ['$\\sin t = \\frac35$ in quadrant II. Find $\\cos t$.', '$-\\frac45$.'],
      ['Where is $\\tan t$ undefined?', 'Where $\\cos t = 0$: $t = \\frac{\\pi}{2} + k\\pi$.'],
      ['Is cosine even or odd?', 'Even: $\\cos(-t) = \\cos t$.']
    ]
  },
  graphs: {
    plain: 'Unwrap the unit circle and plot the height: that is the sine wave, starting at 0. Cosine is the same wave started at its peak. In $y = A\\cos(Bx) + D$, $|A|$ is the amplitude (how tall), $\\frac{2\\pi}{B}$ is the period (how long one cycle takes) and $D$ is the midline.',
    figure: { type: 'graph', x: [-0.5, 6.6], y: [-4.5, 2.5], fns: [{ f: '3cos(2x)-1', label: 'y = 3cos(2x) − 1' }], hlines: [{ y: -1, label: 'midline y = −1' }], caption: 'Amplitude 3, period π, range from −4 to 2.' },
    check: [
      ['Describe $y = 3\\cos(2x) - 1$.', 'Amplitude 3, period $\\pi$, midline $y = -1$, range $[-4, 2]$.'],
      ['What is the period of $\\sin(\\frac{x}{2})$?', '$4\\pi$.'],
      ['Where does $\\sin x$ reach its maximum first after 0?', 'At $x = \\frac{\\pi}{2}$.']
    ]
  },
  inverse: {
    plain: 'Since trig functions repeat, many angles share a sine. The inverse functions pick one standard answer each: $\\arcsin$ returns an angle from $-\\frac{\\pi}{2}$ to $\\frac{\\pi}{2}$, $\\arccos$ from $0$ to $\\pi$, $\\arctan$ strictly between $-\\frac{\\pi}{2}$ and $\\frac{\\pi}{2}$. For an expression like $\\cos(\\arcsin\\frac35)$, draw the triangle the inside describes.',
    figure: { type: 'graph', x: [-1.3, 1.3], y: [-1.8, 3.4], equal: true, fns: [{ f: 'acos(x)', domain: [-1, 1], label: 'arccos x' }, { f: 'asin(x)', domain: [-1, 1], dash: true, label: 'arcsin x' }], points: [{ x: -0.5, y: 2.094, label: 'arccos(−½) = 2π/3' }], caption: 'arccos only returns angles from 0 to π.' },
    check: [
      ['Find $\\arccos(-\\frac12)$.', '$\\frac{2\\pi}{3}$.'],
      ['Find $\\cos(\\arcsin\\frac35)$.', 'Triangle 3, 4, 5: $\\frac45$.'],
      ['Is $\\arcsin 2$ defined?', 'No: sine never exceeds 1.']
    ]
  },
  identities: {
    plain: 'An identity is an equation true for every allowed angle. To verify one, work on one side only and rewrite it until it matches the other. Good first moves: rewrite in sines and cosines, combine fractions, factor, and use $\\sin^2 + \\cos^2 = 1$ in whichever form helps.',
    figure: { type: 'flow', steps: ['Start with the messier side', 'Rewrite in sin and cos', 'Combine fractions or factor', 'Use sin² + cos² = 1', 'Match the other side'], caption: 'sec θ − cos θ = (1 − cos²θ)/cos θ = sin²θ/cos θ = sin θ tan θ.' },
    check: [
      ['Why not work on both sides at once?', 'That treats it as an equation you are solving, which assumes what you are trying to prove.'],
      ['Verify $\\sec\\theta - \\cos\\theta = \\sin\\theta\\tan\\theta$.', '$\\frac{1 - \\cos^2\\theta}{\\cos\\theta} = \\frac{\\sin^2\\theta}{\\cos\\theta} = \\sin\\theta\\tan\\theta$.'],
      ['Rewrite $1 - \\sin^2\\theta$.', '$\\cos^2\\theta$.']
    ]
  },
  sumdiff: {
    plain: 'The sum and difference formulas break an angle into two you already know, like $75^\\circ = 45^\\circ + 30^\\circ$, to get exact values. Watch the signs: in the cosine formula the sign flips. Setting both angles equal gives the double-angle formulas.',
    figure: { type: 'table', head: ['formula', ''], rows: [['$\\sin(\\alpha \\pm \\beta)$', '$\\sin\\alpha\\cos\\beta \\pm \\cos\\alpha\\sin\\beta$'], ['$\\cos(\\alpha \\pm \\beta)$', '$\\cos\\alpha\\cos\\beta \\mp \\sin\\alpha\\sin\\beta$'], ['$\\sin 2\\theta$', '$2\\sin\\theta\\cos\\theta$'], ['$\\cos 2\\theta$', '$\\cos^2\\theta - \\sin^2\\theta$']], caption: 'In the cosine formula the sign flips.' },
    check: [
      ['Find $\\cos 75^\\circ$ exactly.', '$\\cos45\\cos30 - \\sin45\\sin30 = \\frac{\\sqrt6 - \\sqrt2}{4}$.'],
      ['Is $\\sin(\\alpha + \\beta) = \\sin\\alpha + \\sin\\beta$?', 'No: use the sum formula.'],
      ['$\\sin\\theta = \\frac35$, $\\cos\\theta = \\frac45$. Find $\\sin 2\\theta$.', '$2 \\cdot \\frac35 \\cdot \\frac45 = \\frac{24}{25}$.']
    ]
  },
  laws: {
    plain: 'For a triangle without a right angle, use the Law of Sines when you know a side and its opposite angle, and the Law of Cosines when you know two sides and the angle between them (or all three sides). The Law of Cosines is Pythagoras with a correction term for the angle.',
    figure: { type: 'figure', shapes: [{ kind: 'polygon', points: [[0, 0], [10, 0], [3.5, 6.06]] }, { kind: 'angle', at: [0, 0], from: [10, 0], to: [3.5, 6.06], label: 'C = 60°' }, { kind: 'text', at: [5, -0.5], text: 'b = 10' }, { kind: 'text', at: [0.9, 3.4], text: 'a = 7' }, { kind: 'text', at: [7.6, 3.4], text: 'c = ?' }], caption: 'c² = 49 + 100 − 140 cos 60° = 79, so c ≈ 8.89.' },
    check: [
      ['$a = 7$, $b = 10$, $C = 60^\\circ$: find $c$.', '$c = \\sqrt{79} \\approx 8.89$.'],
      ['Which law fits SSS (three sides)?', 'The Law of Cosines.'],
      ['Which case can give two triangles?', 'SSA, the ambiguous case of the Law of Sines.']
    ]
  }
};
