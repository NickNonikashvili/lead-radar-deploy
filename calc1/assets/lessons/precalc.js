/* M151 Precalculus: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).precalc = {
  fn: {
    plain: 'A function is a machine: put in an input, get exactly one output. $f(3)$ means "the output when the input is 3", not $f$ times 3. The same function can be shown as a formula, a table, a graph or a sentence. On a graph, a curve is a function if no vertical line crosses it twice.',
    figure: { type: 'graph', x: [-2, 5], fns: [{ f: 'x^2-3x+1', label: 'f(x) = x² − 3x + 1' }], points: [{ x: 0, y: 1, label: '(0, 1)' }, { x: 3, y: 1, label: '(3, 1)' }], hlines: [{ y: 1, label: 'f(x) = 1' }], caption: 'Solving f(x) = 1 means finding where the graph is at height 1: x = 0 and x = 3.' },
    check: [
      ['For $f(x) = x^2 - 3x + 1$, find $f(-2)$.', '$4 + 6 + 1 = 11$.'],
      ['Is a circle the graph of a function?', 'No: a vertical line crosses it twice.'],
      ['What is the domain of $f(x) = \\frac{1}{x-4}$?', 'All real numbers except 4.']
    ]
  },
  rate: {
    plain: 'Rate of change is how much the output moves per unit of input: rise over run, with units. A linear function changes by the same amount every step, so its graph is a straight line. In $y = b + mx$, $b$ is the starting value and $m$ is the slope, the change per step.',
    figure: { type: 'graph', x: [0, 13], y: [0, 33], fns: [{ f: '3.5+2.25x', label: 'C(m) = 3.50 + 2.25m' }], points: [{ x: 0, y: 3.5, label: 'start: 3.50' }, { x: 8, y: 21.5, label: '8 miles: 21.50' }], xlabel: 'miles', ylabel: 'cost (dollars)', caption: 'A taxi fare: the slope 2.25 is dollars per mile.' },
    check: [
      ['Find the slope through (1, 4) and (5, 12).', '$\\frac{12-4}{5-1} = 2$.'],
      ['How far does $30 take you in the taxi?', '$3.5 + 2.25m = 30$, so $m \\approx 11.8$ miles.'],
      ['What does a slope of 0 look like?', 'A horizontal line: the output never changes.']
    ]
  },
  models: {
    plain: 'Lots of real relationships are curved, not straight. Know the shapes of the basic functions ($x^2$, $x^3$, $\\sqrt x$, $\\frac1x$, $|x|$) so you can recognise them. A piecewise function uses different rules on different stretches of input; check which rule applies before you plug in.',
    figure: { type: 'graph', x: [-3, 5], y: [-1.5, 4], fns: [{ f: 'x+2', domain: [-3, 1], label: 'x + 2 (x < 1)' }, { f: '4-x', domain: [1, 5], label: '4 − x (x ≥ 1)' }], points: [{ x: 1, y: 3 }], caption: 'Both pieces meet at (1, 3), so this graph has no break.' },
    check: [
      ['For the piecewise $f$ above, find $f(3)$.', '$3 \\ge 1$, so use $4 - x$: $f(3) = 1$.'],
      ['Solve $x^2 = 20$.', '$x = \\pm\\sqrt{20} = \\pm 2\\sqrt5$.'],
      ['Which basic graph is a V shape?', '$y = |x|$.']
    ]
  },
  transform: {
    plain: 'Once you know a basic graph, you can move it without re-plotting. Adding outside the function moves it up or down. Changing the input, $f(x - h)$, slides it sideways, and the direction feels backwards: minus moves right. A minus sign in front flips it upside down; a number in front stretches it.',
    figure: { type: 'graph', x: [-1, 10], y: [-8, 4], fns: [{ f: 'sqrt(x)', label: 'y = √x', dash: true }, { f: '-sqrt(x-2)-5', domain: [2, 10], label: 'y = −√(x − 2) − 5' }], points: [{ x: 2, y: -5, label: '(2, −5)' }], caption: '√x moved right 2, flipped, then moved down 5.' },
    check: [
      ['Which way does $y = (x + 3)^2$ shift from $y = x^2$?', 'Left 3.'],
      ['What does $y = 2f(x)$ do to the graph?', 'Stretches it vertically by a factor of 2.'],
      ['What is the range of $y = -\\sqrt{x-2} - 5$?', '$y \\le -5$.']
    ]
  },
  absdom: {
    plain: 'Absolute value is distance from zero, so $|x - 3| < 2$ reads "$x$ is within 2 of 3". That turns into two ordinary statements. The domain of a formula is every input that does not break it: no dividing by zero and no even root of a negative number.',
    figure: { type: 'numberline', x: [-8, 3], intervals: [{ from: -7, to: 1, left: 'open', right: 'open' }], points: [{ x: -3, label: '−3' }], caption: '|x + 3| < 4: every number within 4 of −3, so −7 < x < 1.' },
    check: [
      ['Solve $|2x - 5| = 7$.', '$2x - 5 = 7$ or $-7$: $x = 6$ or $x = -1$.'],
      ['What is the domain of $\\sqrt{6 - 2x}$?', '$6 - 2x \\ge 0$, so $x \\le 3$.'],
      ['Can $|u| = -2$ have a solution?', 'No: a distance is never negative.']
    ]
  },
  variation: {
    plain: 'Direct variation means two quantities rise together in a fixed proportion: $y = kx$, or $y = kx^n$ for a power. Inverse variation means one goes up as the other goes down: $y = k/x$. Find $k$ from one known pair, then use the formula for any other.',
    figure: { type: 'graph', x: [0, 12], y: [0, 2500], fns: [{ f: '2400/x', domain: [1, 12], label: 'W = 2400 / L' }], points: [{ x: 4, y: 600, label: '4 m: 600 kg' }, { x: 10, y: 240, label: '10 m: 240 kg' }], xlabel: 'beam length (m)', ylabel: 'load (kg)', caption: 'Inverse variation: a longer beam holds less.' },
    check: [
      ['$y$ varies directly with $x$, and $y = 12$ when $x = 3$. Find $y$ when $x = 7$.', '$k = 4$, so $y = 28$.'],
      ['$y = kx^2$. What happens to $y$ when $x$ doubles?', 'It is multiplied by 4.'],
      ['Does the graph of $y = k/x$ ever touch the axes?', 'No.']
    ]
  },
  exponents: {
    plain: 'Exponent rules are shortcuts for counting repeated multiplication: multiplying adds exponents, dividing subtracts them, a power of a power multiplies them. A negative exponent means "flip it", not "make it negative". A fractional exponent is a root: the bottom is the root, the top is the power.',
    figure: { type: 'table', head: ['rule', 'example'], rows: [['$a^m a^n = a^{m+n}$', '$x^2 x^5 = x^7$'], ['$(a^m)^n = a^{mn}$', '$(x^3)^2 = x^6$'], ['$a^{-n} = 1/a^n$', '$2^{-3} = 1/8$'], ['$a^{m/n} = (\\sqrt[n]{a})^m$', '$8^{2/3} = 4$']], caption: 'Root first, then power: it keeps the numbers small.' },
    check: [
      ['Simplify $\\frac{(2x^3)^2 x^{-4}}{4x}$.', '$\\frac{4x^2}{4x} = x$.'],
      ['Evaluate $16^{-3/4}$.', '$\\frac{1}{(\\sqrt[4]{16})^3} = \\frac18$.'],
      ['Is $(x + y)^2 = x^2 + y^2$?', 'No: it is $x^2 + 2xy + y^2$.']
    ]
  },
  expgrowth: {
    plain: 'Linear growth adds the same amount each step; exponential growth multiplies by the same factor each step. Growing 6% a year means multiplying by 1.06 each year: $P = P_0(1.06)^t$. In a table, steady differences mean linear and steady ratios mean exponential. Exponential always wins in the long run.',
    figure: { type: 'graph', x: [0, 30], y: [0, 30000], fns: [{ f: '5000*1.06^x', label: 'exponential: ×1.06 a year' }, { f: '5000+300x', label: 'linear: +300 a year', dash: true }], xlabel: 'years', ylabel: 'population', caption: 'Both start at 5000 and grow 300 the first year; then exponential pulls away.' },
    check: [
      ['A population of 5000 grows 6% a year. What is it after 10 years?', '$5000(1.06)^{10} \\approx 8954$.'],
      ['A car loses 15% of its value each year. What is the decay factor?', '0.85.'],
      ['Values 3, 6, 12, 24: linear or exponential?', 'Exponential: each one is twice the last.']
    ]
  },
  logs: {
    plain: 'A logarithm answers "what power?": $\\log_2 8 = 3$ because $2^3 = 8$. That makes logs the tool for solving equations where the unknown is in the exponent. The log rules mirror the exponent rules: logs turn multiplying into adding and powers into multiplying.',
    figure: { type: 'table', head: ['exponent form', 'log form'], rows: [['$2^3 = 8$', '$\\log_2 8 = 3$'], ['$10^{-2} = 0.01$', '$\\log 0.01 = -2$'], ['$e^0 = 1$', '$\\ln 1 = 0$'], ['$3^x = 20$', '$x = \\log 20 / \\log 3$']], caption: 'The same fact written two ways.' },
    check: [
      ['Evaluate $\\log_3 81$.', '4, since $3^4 = 81$.'],
      ['Solve $5 \\cdot 2^x = 80$.', '$2^x = 16$, so $x = 4$.'],
      ['Expand $\\log(x^3 y)$.', '$3\\log x + \\log y$.']
    ]
  },
  expmodels: {
    plain: 'Two numbers describe exponential change in human terms: the doubling time and the half-life. After each half-life, half of what was there is left. To build a model from two data points, divide one by the other to find the growth factor, then work back to the start.',
    figure: { type: 'graph', x: [0, 20], y: [0, 210], fns: [{ f: '200*0.5^(x/6)', label: 'A = 200(½)^(t/6)' }], points: [{ x: 6, y: 100, label: '6 h: 100 mg' }, { x: 12, y: 50, label: '12 h: 50 mg' }, { x: 18, y: 25, label: '18 h: 25 mg' }], xlabel: 'hours', ylabel: 'mg left', caption: 'A 6-hour half-life: halve the amount every 6 hours.' },
    check: [
      ['Starting at 200 mg with a 6 h half-life, when is 25 mg left?', 'After three halvings: 18 hours.'],
      ['Something doubles every 5 years. By what factor does it grow in 20 years?', '$2^4 = 16$.'],
      ['Find the hourly decay factor for a 6 h half-life.', '$(\\frac12)^{1/6} \\approx 0.891$.']
    ]
  },
  inverse: {
    plain: 'An inverse function runs the machine backwards: if $f$ turns 2 into 7, then $f^{-1}$ turns 7 back into 2. To find its formula, swap $x$ and $y$ and solve for $y$. Its graph is the mirror image across the line $y = x$. Only functions that never repeat an output have inverses.',
    figure: { type: 'graph', x: [-3, 6], y: [-3, 6], equal: true, fns: [{ f: '(2x-1)/3', label: 'f(x) = (2x − 1)/3' }, { f: '(3x+1)/2', label: 'f⁻¹(x) = (3x + 1)/2' }, { f: 'x', dash: true, label: 'y = x' }], caption: 'A function and its inverse are mirror images across y = x.' },
    check: [
      ['Find $f^{-1}(x)$ for $f(x) = \\frac{2x-1}{3}$.', '$f^{-1}(x) = \\frac{3x+1}{2}$.'],
      ['If $f(4) = 9$, what is $f^{-1}(9)$?', '4.'],
      ['Does $f(x) = x^2$ have an inverse on all real numbers?', 'No: it repeats outputs ($f(2) = f(-2)$). Restrict to $x \\ge 0$.']
    ]
  },
  logfn: {
    plain: 'The graph of $\\log_b x$ is the graph of $b^x$ mirrored across $y = x$. It only accepts positive inputs, crosses the $x$-axis at 1, and climbs very slowly. The natural base $e \\approx 2.718$ shows up whenever growth is continuous; $\\ln$ undoes $e^x$.',
    figure: { type: 'graph', x: [-0.5, 10], y: [-3, 3], fns: [{ f: 'ln(x)', label: 'y = ln x' }, { f: 'log(x)/log(2)', label: 'y = log₂ x', dash: true }], points: [{ x: 1, y: 0, label: '(1, 0)' }], asymptotes: ['x = 0'], caption: 'Every log graph passes through (1, 0) and hugs the y-axis.' },
    check: [
      ['Solve $\\ln(2x - 3) = 2$.', '$2x - 3 = e^2$, so $x = \\frac{e^2 + 3}{2} \\approx 5.19$.'],
      ['What is the domain of $\\log(x - 4)$?', '$x > 4$.'],
      ['Simplify $e^{\\ln 7}$.', '7.']
    ]
  },
  quadratics: {
    plain: 'A quadratic $ax^2 + bx + c$ graphs as a parabola. Its $x$-intercepts are the solutions of $ax^2 + bx + c = 0$: factor if you can, otherwise use the quadratic formula. The vertex sits halfway between the intercepts at $x = -\\frac{b}{2a}$, and the sign of $a$ says whether it opens up or down.',
    figure: { type: 'graph', x: [-2, 6], y: [-8, 22], fns: [{ f: '-2x^2+8x+10', label: 'y = −2x² + 8x + 10' }], points: [{ x: -1, y: 0, label: '(−1, 0)' }, { x: 5, y: 0, label: '(5, 0)' }, { x: 2, y: 18, label: 'vertex (2, 18)' }], caption: 'The vertex is halfway between the roots; a < 0, so it opens down.' },
    check: [
      ['Factor $x^2 - 5x + 6$.', '$(x - 2)(x - 3)$.'],
      ['How many real roots does $x^2 + 2x + 5$ have?', 'None: $b^2 - 4ac = 4 - 20 < 0$.'],
      ['Find the vertex of $y = x^2 - 6x + 1$.', '$x = 3$, $y = -8$: $(3, -8)$.']
    ]
  },
  poly: {
    plain: 'A polynomial\'s far-left and far-right behaviour is set by its leading term alone. Each factor $(x - r)$ puts a zero at $r$. If the factor appears an odd number of times the graph crosses there; an even number of times, it just touches and bounces back.',
    figure: { type: 'graph', x: [-3.5, 5], y: [-30, 25], fns: [{ f: '-(x+2)(x-3)^2', label: 'y = −(x + 2)(x − 3)²' }], points: [{ x: -2, y: 0, label: 'crosses at −2' }, { x: 3, y: 0, label: 'bounces at 3' }], caption: 'Multiplicity 1 crosses; multiplicity 2 touches and turns back.' },
    check: [
      ['Describe the ends of $y = 2x^4 - x$.', 'Both go up (even degree, positive leading coefficient).'],
      ['Write a polynomial with zeros −2 and 3 (twice) and $y$-intercept −18.', '$y = -(x+2)(x-3)^2$.'],
      ['At most how many turning points can a degree-5 polynomial have?', '4.']
    ]
  },
  complex: {
    plain: 'There is no real number whose square is negative, so we invent one: $i$, with $i^2 = -1$. Complex numbers $a + bi$ work like binomials: add the like parts, multiply with FOIL and replace $i^2$ by $-1$. To divide, multiply top and bottom by the conjugate. Every quadratic now has two solutions.',
    figure: { type: 'figure', shapes: [{ kind: 'arrow', from: [-1, 0], to: [6, 0], label: 'real' }, { kind: 'arrow', from: [0, -1], to: [0, 5], label: 'imaginary' }, { kind: 'point', at: [3, 2], label: '3 + 2i' }, { kind: 'point', at: [3, -0.01], label: '' }, { kind: 'segment', from: [3, 0], to: [3, 2], dash: true }, { kind: 'segment', from: [0, 2], to: [3, 2], dash: true }], caption: 'A complex number is a point: real part across, imaginary part up.' },
    check: [
      ['Compute $(3 - 2i)(1 + 4i)$.', '$3 + 12i - 2i + 8 = 11 + 10i$.'],
      ['Simplify $\\sqrt{-20}$.', '$2i\\sqrt5$.'],
      ['Solve $x^2 + 4x + 13 = 0$.', '$x = -2 \\pm 3i$.']
    ]
  },
  rational: {
    plain: 'A rational function is one polynomial over another. It blows up (a vertical asymptote) where the bottom is zero, unless that factor cancels with the top, in which case there is just a hole. Far out to the left and right, compare the degrees to find the level it settles at.',
    figure: { type: 'graph', x: [-6, 10], y: [-8, 12], fns: [{ f: '2(x-2)/(x-3)', label: 'f(x) = 2(x − 2)/(x − 3)' }], asymptotes: ['x = 3', 'y = 2'], points: [{ x: -2, y: 1.6, open: true, label: 'hole at x = −2' }, { x: 2, y: 0, label: '(2, 0)' }], caption: '(2x² − 8)/(x² − x − 6): the (x + 2) cancels, leaving a hole instead of an asymptote.' },
    check: [
      ['Where are the vertical asymptotes of $\\frac{x+1}{x^2 - 4}$?', '$x = 2$ and $x = -2$.'],
      ['Horizontal asymptote of $\\frac{3x^2}{x^2 + 1}$?', '$y = 3$ (equal degrees: ratio of leading coefficients).'],
      ['Why must you check answers to fraction equations?', 'Multiplying by the denominator can create solutions that make it zero.']
    ]
  },
  triangles: {
    plain: 'Triangles carry a few dependable facts: the angles add to 180°, right triangles satisfy $a^2 + b^2 = c^2$, and similar triangles (same angles) have sides in the same ratio. Similar triangles let you measure things you cannot reach, like a tree from its shadow.',
    figure: { type: 'figure', shapes: [{ kind: 'polygon', points: [[0, 0], [2.4, 0], [0, 1.8]] }, { kind: 'polygon', points: [[4, 0], [8.67, 0], [4, 3.5]] }, { kind: 'text', at: [1.2, -0.45], text: '2.4 m shadow' }, { kind: 'text', at: [-0.7, 0.9], text: '1.8 m' }, { kind: 'text', at: [6.3, -0.45], text: '14 m shadow (scaled)' }, { kind: 'text', at: [3.4, 1.75], text: 'h?' }], caption: 'Same sun angle, similar triangles: h/14 = 1.8/2.4, so h = 10.5 m.' },
    check: [
      ['Two angles of a triangle are 50° and 60°. What is the third?', '70°.'],
      ['Legs 5 and 12: how long is the hypotenuse?', '13.'],
      ['Similar triangles have sides 3 and 9 matching. A side of 4 in the small one matches what?', '12.']
    ]
  },
  righttri: {
    plain: 'In a right triangle, the ratios of sides depend only on the angle: sine is opposite over hypotenuse, cosine is adjacent over hypotenuse, tangent is opposite over adjacent (SOH-CAH-TOA). Know one angle and one side and you can find everything else.',
    figure: { type: 'figure', shapes: [{ kind: 'polygon', points: [[0, 0], [2.25, 0], [2.25, 5.56]] }, { kind: 'angle', at: [2.25, 0], from: [0, 0], to: [2.25, 5.56], right: true }, { kind: 'angle', at: [0, 0], from: [2.25, 0], to: [2.25, 5.56], label: '68°' }, { kind: 'text', at: [0.5, 3.2], text: 'ladder 6 m' }, { kind: 'text', at: [3.4, 2.8], text: 'height = 6 sin 68°' }, { kind: 'text', at: [1.1, -0.45], text: 'base = 6 cos 68°' }], caption: 'Height ≈ 5.56 m; base ≈ 2.25 m from the wall.' },
    check: [
      ['What is $\\sin 30^\\circ$ exactly?', '$\\frac12$.'],
      ['Opposite 7, adjacent 7: what is the angle?', '45°: $\\tan\\theta = 1$.'],
      ['Does $\\sin 40^\\circ$ depend on how big the triangle is?', 'No: only on the angle.']
    ]
  },
  laws: {
    plain: 'For triangles without a right angle, two laws do the work. The Law of Sines, $\\frac{a}{\\sin A} = \\frac{b}{\\sin B}$, pairs each side with its opposite angle. The Law of Cosines, $c^2 = a^2 + b^2 - 2ab\\cos C$, is Pythagoras with a correction; use it when you know two sides and the angle between them, or all three sides.',
    figure: { type: 'figure', shapes: [{ kind: 'polygon', points: [[0, 0], [8, 0], [2.5, 4.33]] }, { kind: 'angle', at: [0, 0], from: [8, 0], to: [2.5, 4.33], label: 'C = 60°' }, { kind: 'text', at: [4, -0.5], text: 'a = 8' }, { kind: 'text', at: [0.6, 2.6], text: 'b = 5' }, { kind: 'text', at: [5.9, 2.6], text: 'c = ?' }], caption: 'Two sides and the angle between them: c² = 64 + 25 − 80 cos 60° = 49, so c = 7.' },
    check: [
      ['Which law fits two angles and a side?', 'The Law of Sines.'],
      ['Is $\\cos 120^\\circ$ positive or negative?', 'Negative: $-\\frac12$.'],
      ['When can the Law of Sines give two triangles?', 'When you know two sides and an angle not between them (SSA).']
    ]
  },
  trigfn: {
    plain: 'Trig works for any angle once you think of a point turning around a circle: sine is its height, cosine is its sideways position. The reference angle (the acute angle to the $x$-axis) gives the size of the value, and the quadrant gives the sign. Plotting height against angle gives the sine wave.',
    figure: { type: 'unitcircle', angles: [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330], highlight: 210, labels: 'deg', caption: '210° has reference angle 30° and sits in quadrant III: sin 210° = −½.' },
    check: [
      ['Find all $\\theta$ in $[0^\\circ, 360^\\circ)$ with $\\cos\\theta = -\\frac12$.', '120° and 240°.'],
      ['Which quadrant has sine positive and cosine negative?', 'Quadrant II.'],
      ['Name an angle coterminal with 45°.', '405° or −315°.']
    ]
  },
  identities: {
    plain: 'Identities are equations that hold for every angle, so you can swap one side for the other to simplify. The big one is $\\sin^2\\theta + \\cos^2\\theta = 1$, which is Pythagoras on the unit circle. Strategy: rewrite everything in sines and cosines, then factor or cancel.',
    figure: { type: 'figure', shapes: [{ kind: 'circle', at: [0, 0], r: 3 }, { kind: 'polygon', points: [[0, 0], [2.3, 0], [2.3, 1.93]] }, { kind: 'angle', at: [0, 0], from: [3, 0], to: [2.3, 1.93], label: 'θ' }, { kind: 'text', at: [1.15, -0.45], text: 'cos θ' }, { kind: 'text', at: [3.0, 0.95], text: 'sin θ' }, { kind: 'text', at: [0.8, 1.3], text: '1' }], caption: 'On the unit circle, cos²θ + sin²θ = 1 is just Pythagoras.' },
    check: [
      ['Simplify $\\frac{1 - \\cos^2\\theta}{\\sin\\theta\\cos\\theta}$.', '$\\frac{\\sin^2\\theta}{\\sin\\theta\\cos\\theta} = \\tan\\theta$.'],
      ['Is $\\sin 2\\theta = 2\\sin\\theta$?', 'No: $\\sin 2\\theta = 2\\sin\\theta\\cos\\theta$.'],
      ['Solve $2\\sin^2\\theta = 1$ on $[0^\\circ, 360^\\circ)$.', '$\\sin\\theta = \\pm\\frac{\\sqrt2}{2}$: 45°, 135°, 225°, 315°.']
    ]
  },
  radians: {
    plain: 'A radian measures an angle by the arc it cuts: one radian is the angle whose arc equals the radius. A full turn is $2\\pi$ radians, so $180^\\circ = \\pi$. Radians make the arc length and sector area formulas clean: $s = r\\theta$ and $A = \\frac12 r^2\\theta$.',
    figure: { type: 'unitcircle', angles: [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330], highlight: 150, caption: 'The unit circle in radians: 5π/6 is 150°, where cos is −√3/2.' },
    check: [
      ['Convert 40° to radians.', '$40 \\cdot \\frac{\\pi}{180} = \\frac{2\\pi}{9}$.'],
      ['A 12 cm arm swings through $\\frac{2\\pi}{9}$ rad. How long is the arc?', '$12 \\cdot \\frac{2\\pi}{9} \\approx 8.4$ cm.'],
      ['What is $\\cos\\frac{5\\pi}{6}$?', '$-\\frac{\\sqrt3}{2}$.']
    ]
  },
  sinusoid: {
    plain: 'Anything that repeats smoothly (tides, temperatures, a Ferris wheel) fits $y = A\\sin(B(x - h)) + k$. The midline $k$ is the average of the max and min, the amplitude $A$ is half the distance between them, the period is $\\frac{2\\pi}{B}$, and $h$ slides the wave left or right.',
    figure: { type: 'graph', x: [0, 24], y: [0, 9], fns: [{ f: '3cos(pi*(x-3)/6)+5', label: 'd(t) = 3cos(π(t − 3)/6) + 5' }], hlines: [{ y: 5, label: 'midline 5' }], points: [{ x: 3, y: 8, label: 'high tide t = 3' }], xlabel: 'hours', ylabel: 'depth (m)', caption: 'Depth swings between 2 m and 8 m every 12 hours.' },
    check: [
      ['What is the period of $y = \\sin(4x)$?', '$\\frac{2\\pi}{4} = \\frac{\\pi}{2}$.'],
      ['Max 8, min 2: what are the midline and amplitude?', 'Midline 5, amplitude 3.'],
      ['How does $y = \\sin(x - \\frac{\\pi}{3})$ differ from $\\sin x$?', 'Shifted right by $\\frac{\\pi}{3}$.']
    ]
  },
  invtrig: {
    plain: 'Inverse trig functions answer "which angle has this sine?". Since infinitely many angles share a sine, each inverse picks one standard answer: $\\sin^{-1}$ gives an angle between $-90^\\circ$ and $90^\\circ$, $\\cos^{-1}$ between $0^\\circ$ and $180^\\circ$. A right triangle sketch handles expressions like $\\tan(\\cos^{-1}\\frac{5}{13})$.',
    figure: { type: 'graph', x: [-1.2, 1.2], y: [-1.8, 3.4], equal: true, fns: [{ f: 'asin(x)', domain: [-1, 1], label: 'sin⁻¹ x' }, { f: 'acos(x)', domain: [-1, 1], label: 'cos⁻¹ x', dash: true }], caption: 'sin⁻¹ returns −π/2 to π/2; cos⁻¹ returns 0 to π. Inputs must be between −1 and 1.' },
    check: [
      ['Evaluate $\\cos^{-1}(-\\frac{\\sqrt2}{2})$.', '135° ($\\frac{3\\pi}{4}$).'],
      ['Is $\\sin^{-1}(\\sin 200^\\circ) = 200^\\circ$?', 'No: it is −20°, the angle in the allowed range with the same sine.'],
      ['Find $\\tan(\\cos^{-1}\\frac{5}{13})$.', 'Triangle 5, 12, 13: $\\frac{12}{5}$.']
    ]
  },
  quadform: {
    plain: 'Some equations are quadratics in disguise. If you spot a piece and its square, like $\\sin\\theta$ and $\\sin^2\\theta$, or $\\sqrt x$ and $x$, call the piece $u$. Solve the quadratic in $u$, then undo the substitution, and throw out any values the original piece cannot take.',
    figure: { type: 'flow', steps: ['Spot u and u² (like sin θ and sin² θ)', 'Rewrite as au² + bu + c = 0', 'Solve for u', 'Undo: solve sin θ = u, √x = u …', 'Reject impossible values'], caption: '2sin²θ − sinθ − 1 = 0 gives sinθ = −½ or 1.' },
    check: [
      ['Solve $x^4 - 5x^2 + 4 = 0$.', '$u = x^2$: $u = 1$ or $4$, so $x = \\pm1, \\pm2$.'],
      ['Solve $x - 5\\sqrt x + 6 = 0$.', '$\\sqrt x = 2$ or $3$: $x = 4$ or $9$.'],
      ['If you get $\\sin\\theta = 3$, what do you do?', 'Reject it: sine is never bigger than 1.']
    ]
  }
};
