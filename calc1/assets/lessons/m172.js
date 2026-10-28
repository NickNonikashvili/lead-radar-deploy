/* M172 Calculus II: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).m172 = {
  sub: {
    plain: 'Substitution is the chain rule run backwards. Look inside the integral for a function and (up to a constant) its derivative sitting next to it. Call the inside $u$, swap $dx$ for $du$, and the integral collapses into a basic one. For a definite integral, change the limits to $u$-values too.',
    figure: { type: 'flow', steps: ['Spot the inside function: u = x²', 'du = 2x dx, so x dx = ½ du', 'Limits: x = 0 → u = 0, x = 2 → u = 4', '∫₀⁴ ½ eᵘ du = ½(e⁴ − 1)'], caption: '∫₀² x e^(x²) dx by substitution.' },
    check: [
      ['What $u$ would you choose for $\\int \\cos(3x)\\,dx$?', '$u = 3x$: the answer is $\\frac13\\sin(3x) + C$.'],
      ['Evaluate $\\int 2x(x^2+1)^4\\,dx$.', '$\\frac{(x^2+1)^5}{5} + C$.'],
      ['In a definite integral, what must you do with the limits?', 'Convert them to $u$-values (or switch back to $x$ before plugging in).']
    ]
  },
  parts: {
    plain: 'Integration by parts is the product rule run backwards: $\\int u\\,dv = uv - \\int v\\,du$. Choose $u$ to be the piece that gets simpler when you differentiate it (logs, inverse trig, then powers of $x$), and $dv$ the piece you can integrate. The goal is a new integral that is easier than the old one.',
    figure: { type: 'table', head: ['', 'differentiate', 'integrate'], rows: [['pick', '$u = x$', '$dv = \\cos x\\,dx$'], ['get', '$du = dx$', '$v = \\sin x$']], caption: '∫x cos x dx = x sin x − ∫sin x dx = x sin x + cos x + C.' },
    check: [
      ['For $\\int x e^x\\,dx$, what is $u$?', '$u = x$, $dv = e^x dx$: answer $xe^x - e^x + C$.'],
      ['For $\\int \\ln x\\,dx$, what are $u$ and $dv$?', '$u = \\ln x$, $dv = dx$: answer $x\\ln x - x + C$.'],
      ['What does LIATE help you choose?', 'Which factor to make $u$.']
    ]
  },
  pfd: {
    plain: 'A fraction with a factored denominator can be split back into simpler fractions, the way $\\frac{1}{x-1} - \\frac{1}{x+1}$ combine into one. Each simple piece integrates to a logarithm. If the top\'s degree is not smaller than the bottom\'s, divide first.',
    figure: { type: 'flow', steps: ['Factor: x² − 1 = (x − 1)(x + 1)', 'Write A/(x − 1) + B/(x + 1)', 'Solve: A = ½, B = −½', 'Integrate: ½ ln|x − 1| − ½ ln|x + 1| + C'], caption: '∫ dx/(x² − 1) by partial fractions.' },
    check: [
      ['What must be true before splitting $\\frac{P}{Q}$?', 'deg P < deg Q; otherwise divide first.'],
      ['How do you set up a repeated factor $(x-2)^2$?', '$\\frac{A}{x-2} + \\frac{B}{(x-2)^2}$.'],
      ['What does $\\int \\frac{dx}{x-3}$ give?', '$\\ln|x-3| + C$.']
    ]
  },
  trigsub: {
    plain: 'A square root like $\\sqrt{a^2 - x^2}$ is the side of a right triangle. Substituting $x = a\\sin\\theta$ turns it into $a\\cos\\theta$ thanks to $1 - \\sin^2 = \\cos^2$, and the root disappears. Draw the triangle at the end to convert back to $x$.',
    figure: { type: 'table', head: ['you see', 'substitute', 'root becomes'], rows: [['$\\sqrt{a^2 - x^2}$', '$x = a\\sin\\theta$', '$a\\cos\\theta$'], ['$\\sqrt{a^2 + x^2}$', '$x = a\\tan\\theta$', '$a\\sec\\theta$'], ['$\\sqrt{x^2 - a^2}$', '$x = a\\sec\\theta$', '$a\\tan\\theta$']], caption: 'Each substitution uses a Pythagorean identity.' },
    check: [
      ['Which substitution for $\\sqrt{9 + x^2}$?', '$x = 3\\tan\\theta$.'],
      ['What is $\\int_0^a \\sqrt{a^2 - x^2}\\,dx$, by geometry?', 'A quarter circle: $\\frac{\\pi a^2}{4}$.'],
      ['How do you get back to $x$ at the end?', 'Draw a right triangle from the substitution and read off the trig values.']
    ]
  },
  area: {
    plain: 'The area between two curves is the integral of the top curve minus the bottom one. Find where they cross first: those are usually the limits. If they swap places partway, split the integral there. Sometimes slicing horizontally (right minus left, with $dy$) is much easier.',
    figure: { type: 'graph', x: [-0.2, 1.3], y: [-0.2, 1.3], equal: true, fns: [{ f: 'x', label: 'y = x (top)' }, { f: 'x^2', label: 'y = x² (bottom)' }], shade: { f: 'x', g: 'x^2', from: 0, to: 1 }, caption: 'Area = ∫₀¹ (x − x²) dx = 1/6.' },
    check: [
      ['Find the area between $y = x$ and $y = x^2$.', '$\\int_0^1 (x - x^2)\\,dx = \\frac16$.'],
      ['How do you find the limits?', 'Solve $f(x) = g(x)$.'],
      ['What if the curves cross inside the interval?', 'Split there and integrate top minus bottom on each piece.']
    ]
  },
  arclength: {
    plain: 'To measure a curve, chop it into tiny pieces that are almost straight. Each piece is the hypotenuse of a tiny triangle with sides $dx$ and $dy$, so its length is $\\sqrt{1 + (f\')^2}\\,dx$. Add them up with an integral. Few curves give integrals you can do by hand, so the examples are chosen carefully.',
    figure: { type: 'graph', x: [0, 3.2], y: [0, 3.8], fns: [{ f: '(2/3)x^1.5', domain: [0, 3], label: 'y = (2/3)x^(3/2)' }], segments: [{ from: [1.5, 1.22], to: [2.3, 2.33], label: 'ΔL ≈ √(Δx² + Δy²)' }], caption: 'Length from 0 to 3: ∫₀³ √(1 + x) dx = 14/3.' },
    check: [
      ['Write the arc length formula.', '$L = \\int_a^b \\sqrt{1 + (f\'(x))^2}\\,dx$.'],
      ['Find the length of $y = \\frac23 x^{3/2}$ from 0 to 3.', '$\\int_0^3 \\sqrt{1+x}\\,dx = \\frac23(8 - 1) = \\frac{14}{3}$.'],
      ['What is the arc length of a straight line from (0,0) to (3,4)?', '5.']
    ]
  },
  washers: {
    plain: 'Spin a flat region around an axis and you get a solid. Slice it across the axis: each slice is a disk (area $\\pi R^2$) or, if there is a hole, a washer (area $\\pi(R^2 - r^2)$). Add up the slices with an integral. $R$ is the outer radius, $r$ the inner, both measured from the axis.',
    figure: { type: 'graph', x: [-0.2, 1.3], y: [-1.2, 1.2], equal: true, fns: [{ f: 'x', domain: [0, 1], label: 'R = x' }, { f: 'x^2', domain: [0, 1], label: 'r = x²' }], shade: { f: 'x', g: 'x^2', from: 0, to: 1 }, vlines: [{ x: 0.6, label: 'one slice' }], caption: 'Spin the region between y = x and y = x² about the x-axis: V = π∫₀¹ (x² − x⁴) dx = 2π/15.' },
    check: [
      ['What is the area of a washer?', '$\\pi(R^2 - r^2)$.'],
      ['Find the volume above.', '$\\pi\\int_0^1 (x^2 - x^4)\\,dx = \\frac{2\\pi}{15}$.'],
      ['Is $\\pi(R - r)^2$ the same as $\\pi(R^2 - r^2)$?', 'No: square each radius separately.']
    ]
  },
  shells: {
    plain: 'Shells slice the region parallel to the axis instead. Each thin strip, spun around, makes a hollow cylinder; unrolled, it is a thin slab of size $2\\pi(\\text{radius}) \\times (\\text{height}) \\times (\\text{thickness})$. Shells shine when washers would need solving for $x$ in terms of $y$.',
    figure: { type: 'graph', x: [-0.3, 2.3], y: [0, 4.4], fns: [{ f: 'x^2', domain: [0, 2], label: 'y = x²' }], shade: { f: 'x^2', g: '0', from: 0, to: 2 }, vlines: [{ x: 1.2, label: 'strip at radius x' }], caption: 'Spin the region under y = x², 0 ≤ x ≤ 2, about the y-axis: V = ∫₀² 2πx · x² dx = 8π.' },
    check: [
      ['Write the shell volume for spinning about the $y$-axis.', '$V = \\int_a^b 2\\pi x\\,h(x)\\,dx$.'],
      ['Find the volume above.', '$2\\pi\\int_0^2 x^3\\,dx = 8\\pi$.'],
      ['Spinning about $x = -1$ instead, what is the radius?', '$x + 1$.']
    ]
  },
  density: {
    plain: 'If a rod is heavier in some places than others, its mass is the integral of its density along it: density times a tiny length, added up. The center of mass is where it would balance: a weighted average of position, $\\bar x = \\frac{\\int x\\rho\\,dx}{\\int \\rho\\,dx}$. It sits closer to the heavy end.',
    figure: { type: 'graph', x: [0, 4.3], y: [0, 5.5], fns: [{ f: '1+x', domain: [0, 4], label: 'ρ(x) = 1 + x' }], shade: { f: '1+x', g: '0', from: 0, to: 4 }, vlines: [{ x: 2.44, label: 'balance x̄ ≈ 2.44' }], xlabel: 'x (m)', ylabel: 'kg/m', caption: 'Mass 12 kg; the balance point is past the middle, toward the heavy end.' },
    check: [
      ['A rod on [0, 4] has $\\rho = 1 + x$. Find its mass.', '$\\int_0^4 (1+x)\\,dx = 12$ kg.'],
      ['Find its center of mass.', '$\\frac{\\int_0^4 x(1+x)\\,dx}{12} = \\frac{88/3}{12} \\approx 2.44$ m.'],
      ['Where is the center of mass of a uniform rod?', 'At its middle.']
    ]
  },
  work: {
    plain: 'Work is force times distance. When the force changes as you go, like stretching a spring or lifting a leaking bucket, cut the motion into tiny steps where the force is nearly constant and add them up with an integral. For pumping a tank, slice the liquid into layers: each layer\'s weight times how far it travels.',
    figure: { type: 'graph', x: [0, 0.6], y: [0, 30], fns: [{ f: '50x', label: 'F = 50x (k = 50 N/m)' }], shade: { f: '50x', g: '0', from: 0.2, to: 0.5 }, xlabel: 'stretch (m)', ylabel: 'force (N)', caption: 'Work from 0.2 m to 0.5 m: ∫ 50x dx = 5.25 J.' },
    check: [
      ['10 N stretches a spring 0.2 m. What is $k$?', '50 N/m.'],
      ['How much work stretches it from 0.2 m to 0.5 m?', '$\\int_{0.2}^{0.5} 50x\\,dx = 5.25$ J.'],
      ['When pumping water out of a tank, what do you slice?', 'Horizontal layers: each one\'s weight times its distance to the top.']
    ]
  },
  fluid: {
    plain: 'Water pushes harder the deeper you go: pressure is weight density times depth. On a vertical plate the depth changes, so slice it into thin horizontal strips; each strip feels pressure times its area. Add the strips with an integral of depth times width.',
    figure: { type: 'figure', shapes: [{ kind: 'segment', from: [-1, 0], to: [5, 0], label: 'water surface' }, { kind: 'rect', at: [0.5, -2], w: 3, h: 2, text: '3 ft × 2 ft' }, { kind: 'segment', from: [0.5, -1.2], to: [3.5, -1.2], dash: true }, { kind: 'text', at: [4.6, -1.2], text: 'strip at depth y' }], caption: 'F = ∫₀² 62.4 · y · 3 dy = 374.4 lb.' },
    check: [
      ['Find the force on a 3 ft by 2 ft plate, top edge at the surface.', '$\\int_0^2 62.4 \\cdot 3y\\,dy = 374.4$ lb.'],
      ['Why slice horizontally?', 'Every point on a horizontal strip is at the same depth.'],
      ['Does pressure at a depth depend on direction?', 'No: it pushes equally in all directions.']
    ]
  },
  improper: {
    plain: 'An integral is improper when it runs out to infinity or the function blows up. Handle it as a limit: integrate to a finite $b$, then let $b$ run off. If the limit is a number, it converges. The benchmark: $\\int_1^\\infty \\frac{1}{x^p}dx$ converges exactly when $p > 1$.',
    figure: { type: 'graph', x: [0.5, 8], y: [0, 1.3], fns: [{ f: '1/x', label: '1/x: diverges' }, { f: '1/x^2', label: '1/x²: area 1' }], shade: { f: '1/x^2', g: '0', from: 1, to: 8 }, caption: 'Both shrink to 0, but only 1/x² does it fast enough to have finite area.' },
    check: [
      ['Does $\\int_1^\\infty \\frac{dx}{x^2}$ converge?', 'Yes, to 1.'],
      ['Does $\\int_1^\\infty \\frac{dx}{x}$ converge?', 'No: $\\ln b \\to \\infty$.'],
      ['Is $\\int_0^1 \\frac{dx}{\\sqrt x}$ improper? Does it converge?', 'Improper at 0; it converges to 2.']
    ]
  },
  odes: {
    plain: 'A differential equation describes how something changes, like "the population grows at a rate proportional to its size": $\\frac{dy}{dt} = ky$. A solution is a function that makes the equation true. There are usually many, and an initial condition picks the one that fits your situation.',
    figure: { type: 'graph', x: [0, 1.5], y: [0, 25], fns: [{ f: '3exp(2x)', label: 'y = 3e^(2t)' }, { f: '1exp(2x)', dash: true, label: 'y = e^(2t)' }, { f: '5exp(2x)', dash: true, label: 'y = 5e^(2t)' }], points: [{ x: 0, y: 3, label: 'y(0) = 3' }], xlabel: 't', caption: 'All solve y′ = 2y; the initial condition picks one.' },
    check: [
      ['Show $y = 3e^{2t}$ solves $y\' = 2y$.', '$y\' = 6e^{2t} = 2(3e^{2t}) = 2y$.'],
      ['What order is $y\'\' + y = 0$?', 'Second order.'],
      ['Why do we need an initial condition?', 'To pick one solution from the family.']
    ]
  },
  qualitative: {
    plain: 'You can understand a differential equation without solving it. A slope field draws the slope at many points, and solutions follow the little segments. Equilibria are constant solutions where the rate is zero. If nearby solutions move toward one, it is stable; if they move away, unstable.',
    figure: { type: 'graph', x: [0, 4], y: [-1, 5], slopefield: { dy: 'y*(3-y)', through: [[0, 0.3], [0, 4.5]] }, hlines: [{ y: 3, label: 'stable y = 3' }, { y: 0, label: 'unstable y = 0' }], caption: 'dy/dt = y(3 − y): solutions are pulled toward 3 and pushed away from 0.' },
    check: [
      ['Find the equilibria of $\\frac{dy}{dt} = y(3-y)$.', '$y = 0$ and $y = 3$.'],
      ['Which is stable?', '$y = 3$: just above or below it, solutions move back toward it.'],
      ['In an autonomous equation, what is the same along a horizontal row of the slope field?', 'The slope.']
    ]
  },
  euler: {
    plain: 'Euler\'s method walks along a solution in small straight steps. At each point, compute the slope from the equation, step forward by $\\Delta t$ along that slope, and repeat. Smaller steps give better answers. Keep a table so every step is easy to check.',
    figure: { type: 'table', head: ['t', 'y', 'slope t + y', 'next y'], rows: [['0', '1', '1', '1 + 0.5(1) = 1.5'], ['0.5', '1.5', '2', '1.5 + 0.5(2) = 2.5'], ['1', '2.5', '', '']], caption: 'dy/dt = t + y, y(0) = 1, Δt = 0.5: y(1) ≈ 2.5.' },
    check: [
      ['Write one Euler step.', '$y_{k+1} = y_k + \\Delta t\\,f(t_k, y_k)$.'],
      ['Estimate $y(1)$ above with two steps.', '2.5.'],
      ['If the solution is concave up, does Euler over- or underestimate?', 'Underestimate: tangent lines lie below the curve.']
    ]
  },
  separable: {
    plain: 'If the rate splits into a part with only $t$ times a part with only $y$, you can separate: move all the $y$ to one side with $dy$ and all the $t$ to the other with $dt$, integrate both sides, and add one constant. Exponential growth $y\' = ky$ is the classic example: $y = Ce^{kt}$.',
    figure: { type: 'flow', steps: ['dy/dx = xy', 'dy/y = x dx', 'ln|y| = x²/2 + C', 'y = Ae^(x²/2)', 'y(0) = 2 gives y = 2e^(x²/2)'], caption: 'Separate, integrate, solve, then use the initial condition.' },
    check: [
      ['Solve $\\frac{dy}{dx} = xy$, $y(0) = 2$.', '$y = 2e^{x^2/2}$.'],
      ['Is $\\frac{dy}{dt} = t + y$ separable?', 'No: a sum cannot be split into a product.'],
      ['Why only one constant?', 'The constants from both sides combine into one.']
    ]
  },
  sequences: {
    plain: 'A sequence is an endless list of numbers following a rule. It converges if the terms settle down toward one number. Often you can treat $a_n$ as a function of a real $x$ and take an ordinary limit. For fractions of polynomials, compare the highest powers.',
    figure: { type: 'scatter', points: [[1, 1], [2, 0.684], [3, 0.643], [4, 0.627], [5, 0.62], [6, 0.616], [7, 0.613], [8, 0.611], [9, 0.61], [10, 0.609]], fit: false, xlabel: 'n', caption: 'aₙ = (3n² + 1)/(5n² − n) settles toward 3/5.' },
    check: [
      ['Find $\\lim \\frac{3n^2+1}{5n^2-n}$.', '$\\frac35$.'],
      ['Does $a_n = (-1)^n$ converge?', 'No: it keeps jumping between −1 and 1.'],
      ['What is $\\lim \\frac{n}{e^n}$?', '0: exponentials beat powers.']
    ]
  },
  geometric: {
    plain: 'A geometric series multiplies by the same ratio $r$ each time. If $|r| < 1$ the terms shrink fast enough that the infinite sum is a finite number: first term over $1 - r$. If $|r| \\ge 1$ it runs off. Think of walking halfway to a wall, then half the rest: you never pass 1.',
    figure: { type: 'bars', bars: [['S₁', 1.667], ['S₂', 2.222], ['S₃', 2.407], ['S₄', 2.469], ['S₅', 2.49], ['S₆', 2.497]], caption: 'Partial sums of Σ 5(1/3)ᵏ from k = 1 climb toward (5/3)/(1 − 1/3) = 2.5.' },
    check: [
      ['Find $\\sum_{k=1}^\\infty 5(\\frac13)^k$.', '$\\frac{5/3}{1 - 1/3} = \\frac52$.'],
      ['Does $\\sum 2^k$ converge?', 'No: $|r| = 2 \\ge 1$.'],
      ['Write $0.\\overline{3}$ as a geometric series.', '$\\frac{3}{10} + \\frac{3}{100} + \\cdots = \\frac{3/10}{1 - 1/10} = \\frac13$.']
    ]
  },
  series: {
    plain: 'A series converges if its running totals settle to a number. Terms going to 0 is needed but not enough: the harmonic series $\\sum \\frac1k$ creeps to infinity anyway. Convergence tests compare a series to one you know: the integral test, comparison tests, and the ratio test, which is best for factorials and exponentials.',
    figure: { type: 'flow', steps: [{ text: 'Do the terms go to 0?', kind: 'decision', note: 'no: diverges' }, { text: 'Geometric or p-series?', kind: 'decision', note: 'yes: known rule' }, { text: 'Factorials or powers like 3ᵏ?', kind: 'decision', note: 'yes: ratio test' }, 'Otherwise: compare or use the integral test'], caption: 'Choosing a convergence test.' },
    check: [
      ['Does $\\sum \\frac{k}{3^k}$ converge?', 'Yes: the ratio tends to $\\frac13 < 1$.'],
      ['Terms go to 0. Must the series converge?', 'No: the harmonic series is the counterexample.'],
      ['For which $p$ does $\\sum \\frac{1}{k^p}$ converge?', '$p > 1$.']
    ]
  },
  ast: {
    plain: 'When the signs alternate, the terms partly cancel. If the sizes shrink steadily to 0, the series converges, and stopping after $n$ terms is off by no more than the next term. That makes alternating series easy to approximate to a guaranteed accuracy.',
    figure: { type: 'scatter', points: [[1, 1], [2, 0.75], [3, 0.861], [4, 0.799], [5, 0.839], [6, 0.811], [7, 0.832], [8, 0.816], [9, 0.828], [10, 0.818]], fit: false, xlabel: 'terms', caption: 'Partial sums of 1 − 1/4 + 1/9 − … zig-zag in toward π²/12 ≈ 0.822.' },
    check: [
      ['How many terms of $\\sum \\frac{(-1)^{k+1}}{k^2}$ guarantee error below 0.001?', 'Need $\\frac{1}{(n+1)^2} < 0.001$: $n = 31$.'],
      ['Does $\\sum \\frac{(-1)^k}{k}$ converge?', 'Yes, by the alternating series test (but not absolutely).'],
      ['What bounds the error after $n$ terms?', 'The size of the next term, $b_{n+1}$.']
    ]
  },
  taylor: {
    plain: 'A Taylor polynomial is a polynomial built to copy a function near one point: same value, same slope, same bend and so on, up to degree $n$. More terms match the function over a wider stretch. That is how calculators find $\\sin(0.1)$: a few terms of a polynomial.',
    figure: { type: 'graph', x: [-4, 4], y: [-2, 2], fns: [{ f: 'sin(x)', label: 'sin x' }, { f: 'x-x^3/6', label: 'P₃ = x − x³/6', dash: true }, { f: 'x-x^3/6+x^5/120', label: 'P₅', dash: true }], caption: 'Each extra term hugs sin x over a wider range.' },
    check: [
      ['Estimate $\\sin(0.1)$ with $P_3$.', '$0.1 - \\frac{0.001}{6} \\approx 0.0998333$.'],
      ['Write the Maclaurin series of $e^x$.', '$1 + x + \\frac{x^2}{2!} + \\frac{x^3}{3!} + \\cdots$'],
      ['What is the coefficient of $(x-a)^k$?', '$\\frac{f^{(k)}(a)}{k!}$.']
    ]
  },
  power: {
    plain: 'A power series is a polynomial that never ends: $\\sum c_k(x-a)^k$. It works (converges) on an interval centered at $a$, with a radius you find with the ratio test. The endpoints are the tricky part: test each one separately, because the ratio test says nothing there.',
    figure: { type: 'numberline', x: [-4, 4], intervals: [{ from: -2, to: 2, left: 'closed', right: 'open' }], caption: 'Σ xᵏ/(k·2ᵏ) converges on [−2, 2): alternating harmonic at −2, harmonic at 2.' },
    check: [
      ['Find the radius of $\\sum \\frac{x^k}{k 2^k}$.', '$R = 2$.'],
      ['Does it converge at $x = 2$?', 'No: it becomes the harmonic series.'],
      ['Where does a power series always converge?', 'At its center.']
    ]
  },
  eulerformula: {
    plain: 'Put $i\\theta$ into the series for $e^x$ and the real and imaginary parts sort themselves into the series for cosine and sine: $e^{i\\theta} = \\cos\\theta + i\\sin\\theta$. So $e^{i\\theta}$ is the point at angle $\\theta$ on the unit circle, and multiplying by it rotates. This topic is beyond Active Calculus, so your instructor\'s notes set the details.',
    figure: { type: 'unitcircle', angles: [0, 60, 120, 180, 240, 300], highlight: 60, caption: 'e^(iπ/3) = ½ + (√3/2)i; cubing it turns three times as far, to e^(iπ) = −1.' },
    check: [
      ['Write $e^{i\\pi/3}$ as $a + bi$.', '$\\frac12 + \\frac{\\sqrt3}{2}i$.'],
      ['What is $(e^{i\\pi/3})^3$?', '$e^{i\\pi} = -1$.'],
      ['What is $|e^{i\\theta}|$?', '1: it is on the unit circle.']
    ]
  },
  fourier: {
    plain: 'A Fourier series builds a repeating function from sines and cosines of increasing frequency, the way a chord is built from notes. Each coefficient measures how much of that frequency is in the function. Odd functions need only sines. This topic is beyond Active Calculus, so your instructor\'s conventions set the details.',
    figure: { type: 'graph', x: [-3.2, 3.2], y: [-1.5, 1.5], fns: [{ f: 'x/abs(x)', label: 'square wave' }, { f: '(4/pi)(sin(x)+sin(3x)/3+sin(5x)/5)', label: 'three terms', dash: true }], caption: 'Three sine terms already look like the square wave.' },
    check: [
      ['The square wave is odd. Which coefficients are zero?', 'All the cosine coefficients ($a_n$).'],
      ['Square-wave series: which sines appear?', 'Only odd ones: $\\frac{4}{\\pi}(\\sin x + \\frac{\\sin 3x}{3} + \\cdots)$.'],
      ['What does $a_0/2$ represent?', 'The average value of the function.']
    ]
  }
};
