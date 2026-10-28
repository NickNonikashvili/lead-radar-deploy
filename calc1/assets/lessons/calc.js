/* ============================================================
   M171 Calculus I: a lesson for every topic, laid over its notes when the class loads (app.js, mergeLessons):
   plain: the idea in plain words · figure: a picture (a drawing spec, assets/board-draw.js) · check: a self-check
   [question, answer] · addExamples: worked examples after the notes' own.
   ============================================================ */
(window.MathubLessons = window.MathubLessons || {}).calc = {
  '1.1': {
    plain: 'Velocity is how fast position is changing. Over a stretch of time, the <b>average</b> velocity is just distance moved divided by time taken: the slope of the line joining two points on the position graph. The <b>instantaneous</b> velocity at one moment is what those averages settle down to as you shrink the stretch of time around that moment.',
    figure: { type: 'graph', x: [0, 2], y: [40, 68], fns: [{ f: '64-16(x-1)^2', label: 's(t)' }], secant: { f: '64-16(x-1)^2', from: 0.5, to: 1 }, xlabel: 't (seconds)', ylabel: 'height (ft)', caption: 'The secant line from t = 0.5 to t = 1 has slope 8 ft/s, the average velocity there.' },
    check: [
      ['A car is at mile 12 at 1:00 and at mile 72 at 2:00. What is its average velocity?', '60 miles per hour: (72 − 12) / (2 − 1).'],
      ['Average velocity on [2, 2.1] is 5.1 m/s, on [2, 2.01] it is 5.01, on [2, 2.001] it is 5.001. Estimate the velocity at t = 2.', 'About 5 m/s: that is what the averages approach as the interval shrinks.'],
      ['On a position graph, what does the slope of a secant line mean?', 'The average velocity between the two times.']
    ],
    addExamples: [{ p: 'A stone dropped from a cliff has fallen $s(t) = 16t^2$ feet after $t$ seconds. Find its average velocity from $t = 1$ to $t = 3$.', s: 'Change in position: $s(3) - s(1) = 144 - 16 = 128$ ft.<br>Change in time: $3 - 1 = 2$ s.<br>Average velocity $= \\frac{128}{2} = 64$ ft/s.' }]
  },
  '1.2': {
    plain: 'A limit asks: as $x$ gets closer and closer to some number $a$, where are the outputs heading? It does not care what happens exactly at $a$, only near it. If the outputs from the left and from the right head to the same number, that number is the limit.',
    figure: { type: 'graph', x: [-1, 3], fns: [{ f: 'x+1', label: 'y = (x² − 1)/(x − 1)' }], points: [{ x: 1, y: 2, open: true, label: 'hole at (1, 2)' }], caption: 'The function is not defined at x = 1, but the outputs still head to 2: the limit is 2.' },
    check: [
      ['If $f(3)$ does not exist, can $\\lim_{x\\to3} f(x)$ still exist?', 'Yes. The limit only looks at x near 3, not at 3 itself.'],
      ['Plugging in gives $\\frac{5}{0}$. What does that tell you?', 'The outputs blow up near that point (a vertical asymptote), so the limit does not exist as a finite number.'],
      ['The left-hand limit is 4 and the right-hand limit is 6. What is the limit?', 'It does not exist: the two sides disagree.']
    ],
    addExamples: [{ p: 'Evaluate $\\lim_{x\\to 2}\\dfrac{x^2-4}{x-2}$.', s: 'Plugging in gives $\\frac00$, so simplify first.<br>Factor: $\\frac{(x-2)(x+2)}{x-2} = x+2$ for $x \\ne 2$.<br>So the limit is $2 + 2 = 4$.' }]
  },
  '1.3': {
    plain: 'The derivative at a point is the slope of the curve right there: zoom in far enough and the curve looks like a straight line, and the derivative is that line\'s slope. It is also the instantaneous rate of change: how fast the output is changing at that exact input.',
    figure: { type: 'graph', x: [-1, 3], fns: [{ f: 'x^2', label: 'y = x²' }], tangent: { f: 'x^2', at: 1 }, caption: 'The tangent line at x = 1 has slope 2, so f′(1) = 2 for f(x) = x².' },
    check: [
      ['In words, what is $f\'(a)$?', 'The slope of the tangent line to the graph of f at x = a, the instantaneous rate of change there.'],
      ['Write the limit definition of $f\'(a)$.', '$f\'(a) = \\lim_{h\\to0} \\dfrac{f(a+h) - f(a)}{h}$.'],
      ['A tangent line at $x = 4$ passes through $(4, 7)$ and $(6, 13)$. What is $f\'(4)$?', '3: the slope is (13 − 7)/(6 − 4).']
    ],
    addExamples: [{ p: 'Use the limit definition to find $f\'(3)$ for $f(x) = x^2$.', s: '$f\'(3) = \\lim_{h\\to0}\\frac{(3+h)^2 - 9}{h} = \\lim_{h\\to0}\\frac{6h + h^2}{h}$.<br>Cancel $h$: $\\lim_{h\\to0}(6 + h) = 6$.' }]
  },
  '1.4': {
    plain: 'Instead of finding the slope at one point at a time, the derivative function $f\'(x)$ gives the slope at every point at once. Reading it off a graph is like describing the hills of $f$: going uphill means $f\' > 0$, downhill means $f\' < 0$, and the flat top of a hill or bottom of a valley means $f\' = 0$.',
    figure: { type: 'graph', x: [-2.5, 2.5], fns: [{ f: 'x^3-3x', label: 'f(x) = x³ − 3x' }, { f: '3x^2-3', label: "f′(x) = 3x² − 3", dash: true }], caption: 'Where f has its peak and valley (x = −1 and x = 1), the derivative crosses zero.' },
    check: [
      ['$f$ is decreasing on $(0, 2)$. What do you know about $f\'$ there?', '$f\'(x) < 0$ on (0, 2).'],
      ['The graph of $f$ has a sharp corner at $x = 1$. What about $f\'(1)$?', 'It does not exist: the slope from the left and from the right disagree.'],
      ['Find $f\'(x)$ for $f(x) = 3x^2$ using the definition.', '$\\frac{3(x+h)^2 - 3x^2}{h} = 6x + 3h \\to 6x$.']
    ]
  },
  '1.5': {
    plain: 'A derivative always comes with units: units of the output per unit of the input. Saying what $f\'(a)$ means is a full sentence: at this input (with units), the output is going up or down at this rate (with units). From a table of data, estimate it with a difference quotient: the change in output over the change in input.',
    figure: { type: 'table', head: ['c (Calories)', '1600', '1700', '1800'], rows: [['W = f(c) (lb)', '165', '177', '190']], caption: 'A central difference: f′(1700) ≈ (190 − 165)/(1800 − 1600) = 0.125 lb per Calorie.' },
    check: [
      ['$P(t)$ is a town\'s population in thousands, $t$ in years. What are the units of $P\'(t)$?', 'Thousands of people per year.'],
      ['Interpret $P\'(5) = -0.4$.', 'Five years in, the population is falling by about 400 people per year.'],
      ['$f(2) = 10$ and $f(2.5) = 13$. Estimate $f\'(2)$.', '$\\frac{13 - 10}{0.5} = 6$.']
    ]
  },
  '1.6': {
    plain: 'The second derivative is the rate of change of the rate of change. For motion, $s\'$ is velocity and $s\'\'$ is acceleration. On a graph, $f\'\'$ tells you how the curve bends: $f\'\' > 0$ means it bends up like a cup, $f\'\' < 0$ means it bends down like a cap.',
    figure: { type: 'graph', x: [-2, 2], fns: [{ f: 'x^3', label: 'y = x³' }], points: [{ x: 0, y: 0, label: 'inflection point' }], notes: [{ x: -1.25, y: -5.5, text: 'concave down' }, { x: 0.75, y: 4, text: 'concave up' }], caption: 'Concavity switches at x = 0, where f″ changes sign.' },
    check: [
      ['A ball\'s velocity is 20 m/s and its acceleration is −9.8 m/s². What is happening?', 'It is moving up but slowing down.'],
      ['What does "increasing at a decreasing rate" mean in terms of $f\'$ and $f\'\'$?', '$f\' > 0$ and $f\'\' < 0$.'],
      ['Find $f\'\'(x)$ for $f(x) = x^4 - 2x^2$.', '$f\'(x) = 4x^3 - 4x$, so $f\'\'(x) = 12x^2 - 4$.']
    ]
  },
  '1.7': {
    plain: 'A function is continuous at a point if you could draw through it without lifting your pencil: no hole, no jump, no blow-up. It is differentiable there if, besides that, the graph is smooth: no sharp corner, cusp or vertical tangent. Every differentiable function is continuous, but not the other way round.',
    figure: { type: 'graph', x: [-3, 3], fns: [{ f: 'abs(x)', label: 'y = |x|' }], points: [{ x: 0, y: 0, label: 'corner' }], caption: '|x| is continuous at 0 but not differentiable there: the slopes −1 and 1 disagree.' },
    check: [
      ['Name the three conditions for continuity at $x = a$.', '$f(a)$ is defined, $\\lim_{x\\to a} f(x)$ exists, and the two are equal.'],
      ['Is $f(x) = |x - 2|$ differentiable at $x = 2$?', 'No: it has a corner there.'],
      ['The left limit is 3, the right limit is 3, and $f(a) = 5$. What kind of discontinuity?', 'Removable: the limit exists but does not equal the value.']
    ]
  },
  '1.8': {
    plain: 'Zoom in on a smooth curve and it looks like its tangent line. So near a point you know, you can estimate the function with the tangent line, which is easy to compute. The curve\'s bend tells you if the estimate is too high or too low.',
    figure: { type: 'graph', x: [0, 8], fns: [{ f: 'sqrt(x)', label: 'y = √x' }], tangent: { f: 'sqrt(x)', at: 4 }, caption: 'Near x = 4, √x is close to its tangent line L(x) = 2 + (x − 4)/4.' },
    check: [
      ['Write the tangent line approximation of $f$ at $a$.', '$L(x) = f(a) + f\'(a)(x - a)$.'],
      ['Use $L$ at $a = 4$ to estimate $\\sqrt{4.2}$.', '$2 + \\frac14(0.2) = 2.05$.'],
      ['$f$ is concave up near $a$. Is $L(x)$ an over- or underestimate?', 'An underestimate: the tangent line lies below the curve.']
    ]
  },
  '2.1': {
    plain: 'Instead of computing limits every time, a handful of rules give derivatives fast. The power rule says bring the exponent down and lower it by one. Constants multiply through and sums split up, so any polynomial is done term by term. $e^x$ is special: it is its own derivative.',
    figure: { type: 'table', head: ['function', 'derivative'], rows: [['$c$', '$0$'], ['$x^n$', '$nx^{n-1}$'], ['$e^x$', '$e^x$'], ['$a^x$', '$a^x\\ln a$']], caption: 'The basic rules. Rewrite roots and fractions as powers first.' },
    check: [
      ['Differentiate $f(x) = 5x^3 - 2x + 9$.', '$15x^2 - 2$.'],
      ['Differentiate $g(x) = \\sqrt{x}$.', 'Rewrite as $x^{1/2}$: $g\'(x) = \\frac12 x^{-1/2} = \\frac{1}{2\\sqrt x}$.'],
      ['What is the derivative of $3^x$?', '$3^x \\ln 3$.']
    ]
  },
  '2.2': {
    plain: 'The slope of the sine curve at any point is the value of the cosine curve there, and the slope of cosine is minus sine. Picture it: where sine is at its peak, it is flat, and cosine is zero there. This only works with angles in radians.',
    figure: { type: 'graph', x: [-3.2, 6.4], fns: [{ f: 'sin(x)', label: 'y = sin x' }, { f: 'cos(x)', label: 'y = cos x', dash: true }], caption: 'Where sin x peaks (x = π/2), its slope is 0 and cos x crosses 0.' },
    check: [
      ['What is $\\frac{d}{dx}[\\cos x]$?', '$-\\sin x$.'],
      ['Find $f\'(\\pi)$ for $f(x) = \\sin x$.', '$\\cos \\pi = -1$.'],
      ['Differentiate $4\\cos x - x^2$.', '$-4\\sin x - 2x$.']
    ]
  },
  '2.3': {
    plain: 'You cannot differentiate a product by multiplying the derivatives. The product rule: (first)′ × second + first × (second)′. For a quotient: bottom times top′ minus top times bottom′, all over bottom squared. Before reaching for these, check whether simplifying first makes it easier.',
    figure: { type: 'table', head: ['rule', 'formula'], rows: [['product', "$(fg)' = f'g + fg'$"], ['quotient', "$\\left(\\frac fg\\right)' = \\frac{gf' - fg'}{g^2}$"]], caption: 'In the quotient rule the order of the numerator matters.' },
    check: [
      ['Differentiate $x^2 \\sin x$.', '$2x\\sin x + x^2 \\cos x$.'],
      ['Differentiate $\\frac{x}{x+1}$.', '$\\frac{(x+1) - x}{(x+1)^2} = \\frac{1}{(x+1)^2}$.'],
      ['Do you need the quotient rule for $\\frac{x^3}{7}$?', 'No: it is $\\frac17 x^3$, so the derivative is $\\frac37 x^2$.']
    ]
  },
  '2.4': {
    plain: 'The derivatives of tangent, cotangent, secant and cosecant all come from writing them with sines and cosines and using the quotient rule. You mostly memorise four results; every function whose name starts with "co" has a minus sign in its derivative.',
    figure: { type: 'table', head: ['function', 'derivative'], rows: [['$\\tan x$', '$\\sec^2 x$'], ['$\\cot x$', '$-\\csc^2 x$'], ['$\\sec x$', '$\\sec x \\tan x$'], ['$\\csc x$', '$-\\csc x \\cot x$']], caption: 'The co-functions carry the minus signs.' },
    check: [
      ['What is $\\frac{d}{dx}[\\tan x]$?', '$\\sec^2 x$.'],
      ['Differentiate $\\sec x + \\cot x$.', '$\\sec x \\tan x - \\csc^2 x$.'],
      ['Find the slope of $\\tan x$ at $x = 0$.', '$\\sec^2 0 = 1$.']
    ]
  },
  '2.5': {
    plain: 'The chain rule handles a function inside another function. Differentiate the outside layer and leave the inside alone, then multiply by the derivative of the inside. Think of gears: if the outside turns 3 times for each turn of the inside, and the inside turns 2 times per turn of $x$, the outside turns 6 times per turn of $x$.',
    figure: { type: 'flow', steps: ['Spot the inside function u', 'Differentiate the outside, keeping u inside', 'Multiply by u′', 'Simplify'], caption: 'For (x² + 1)⁵: 5(x² + 1)⁴ · 2x.' },
    check: [
      ['Differentiate $(3x + 1)^4$.', '$4(3x+1)^3 \\cdot 3 = 12(3x+1)^3$.'],
      ['Differentiate $e^{x^2}$.', '$e^{x^2}\\cdot 2x$.'],
      ['What is the inside function in $\\cos(5x^3)$?', '$5x^3$, so the derivative is $-\\sin(5x^3)\\cdot 15x^2$.']
    ]
  },
  '2.6': {
    plain: 'An inverse function undoes the original, and its graph is the mirror image across the line $y = x$. Mirroring swaps rise and run, so the slopes flip: the slope of the inverse at $(b, a)$ is one over the slope of $f$ at $(a, b)$. This is where $\\frac{d}{dx}\\ln x = \\frac1x$ comes from.',
    figure: { type: 'graph', x: [-2, 4], y: [-2, 4], equal: true, fns: [{ f: 'exp(x)', label: 'y = eˣ' }, { f: 'ln(x)', label: 'y = ln x' }, { f: 'x', label: 'y = x', dash: true }], caption: 'eˣ and ln x mirror each other across y = x, and their slopes are reciprocals.' },
    check: [
      ['$f(1) = 4$ and $f\'(1) = 2$. Find $(f^{-1})\'(4)$.', '$\\frac12$.'],
      ['Differentiate $\\ln(3x)$.', '$\\frac{3}{3x} = \\frac1x$.'],
      ['What is $\\frac{d}{dx}[\\arctan x]$?', '$\\frac{1}{1+x^2}$.']
    ]
  },
  '2.7': {
    plain: 'Some curves, like a circle, are not of the form $y = f(x)$. You can still find slopes: differentiate both sides of the equation with respect to $x$, remembering that $y$ depends on $x$, so every time you differentiate a $y$ you multiply by $\\frac{dy}{dx}$. Then solve for $\\frac{dy}{dx}$.',
    figure: { type: 'graph', x: [-6, 6], y: [-6, 6], equal: true, fns: [{ x: '5cos(t)', y: '5sin(t)', t: [0, 6.29], label: 'x² + y² = 25' }, { f: '4-0.75(x-3)', domain: [0, 6.5], dash: true, label: 'tangent, slope −3/4' }], points: [{ x: 3, y: 4, label: '(3, 4)' }], caption: 'At (3, 4) on the circle, dy/dx = −x/y = −3/4.' },
    check: [
      ['Differentiate $y^2$ with respect to $x$.', '$2y\\frac{dy}{dx}$.'],
      ['Find $\\frac{dy}{dx}$ for $x^2 + y^2 = 25$.', '$2x + 2yy\' = 0$, so $y\' = -\\frac{x}{y}$.'],
      ['Why does the answer usually contain both $x$ and $y$?', 'Because each point on the curve is pinned down by both coordinates.']
    ]
  },
  '2.8': {
    plain: 'When a limit gives $\\frac00$ or $\\frac\\infty\\infty$, it is a race between the top and the bottom. L\'Hôpital\'s rule says: compare their rates instead, by taking the limit of top′ over bottom′. For limits as $x\\to\\infty$, think about which part grows fastest: exponentials beat powers, and powers beat logs.',
    figure: { type: 'graph', x: [0, 8], y: [0, 3], fns: [{ f: 'x^2/exp(x)', label: 'y = x²/eˣ' }], hlines: [{ y: 0 }], caption: 'x²/eˣ heads to 0: the exponential wins the race.' },
    check: [
      ['Can you use L\'Hôpital on $\\lim_{x\\to0}\\frac{x+1}{x}$?', 'No: the form is 1/0, not 0/0 or ∞/∞.'],
      ['Evaluate $\\lim_{x\\to0}\\frac{e^x - 1}{x}$.', 'Form 0/0, so $\\lim \\frac{e^x}{1} = 1$.'],
      ['Find $\\lim_{x\\to\\infty}\\frac{3x^2+1}{5x^2-x}$.', 'Equal degrees: $\\frac35$.']
    ]
  },
  '3.1': {
    plain: 'Peaks and valleys of a smooth curve happen where it is flat (derivative zero), or where the derivative does not exist. Those candidates are the critical numbers. To tell a peak from a valley, look at the sign of $f\'$ on each side: up then down is a peak, down then up is a valley.',
    figure: { type: 'graph', x: [-0.5, 3.2], fns: [{ f: '2x^3-9x^2+12x', label: 'f(x) = 2x³ − 9x² + 12x' }], points: [{ x: 1, y: 5, label: 'local max (1, 5)' }, { x: 2, y: 4, label: 'local min (2, 4)' }], caption: 'f′ = 6(x − 1)(x − 2) changes from + to − at 1 and from − to + at 2.' },
    check: [
      ['What is a critical number?', 'A point in the domain where $f\'$ is 0 or undefined.'],
      ['$f\'$ goes from negative to positive at $c$. What is at $c$?', 'A local minimum.'],
      ['Is every critical number an extremum? Think of $x^3$ at 0.', 'No: $x^3$ is flat at 0 but keeps increasing.']
    ]
  },
  '3.3': {
    plain: 'On a closed interval, a continuous function has a highest and a lowest value, and they hide either at critical numbers or at the endpoints. So list those few points, evaluate the function at each, and pick the largest and smallest.',
    figure: { type: 'graph', x: [0, 3], fns: [{ f: 'x^3-3x', label: 'f(x) = x³ − 3x on [0, 3]', domain: [0, 3] }], points: [{ x: 1, y: -2, label: 'abs min (1, −2)' }, { x: 3, y: 18, label: 'abs max (3, 18)' }, { x: 0, y: 0, label: '(0, 0)' }], caption: 'Check the critical number and both endpoints; the biggest and smallest values win.' },
    check: [
      ['Why must you check endpoints?', 'The highest or lowest value can sit at an end of the interval, where $f\'$ need not be zero.'],
      ['Find the absolute max of $f(x) = x^2$ on $[-1, 2]$.', 'Candidates: f(−1)=1, f(0)=0, f(2)=4. Max is 4 at x = 2.'],
      ['Does $f(x) = \\frac1x$ have an absolute max on $(0, 1]$?', 'No: it grows without bound near 0 (the interval is not closed).']
    ]
  },
  '3.4': {
    plain: 'Optimization word problems all follow the same plan: draw it, name the quantities, write what you want to make biggest or smallest, use the other fact (the constraint) to get it in terms of one variable, then find its maximum or minimum on the sensible domain and answer in words with units.',
    figure: { type: 'figure', shapes: [{ kind: 'rect', at: [0, 0], w: 6, h: 3, text: 'pen' }, { kind: 'segment', from: [-0.5, 3.4], to: [6.5, 3.4], label: 'river (no fence)' }, { kind: 'text', at: [-0.7, 1.5], text: 'x' }, { kind: 'text', at: [3, -0.5], text: 'y' }, { kind: 'text', at: [6.7, 1.5], text: 'x' }], caption: 'Fence: 2x + y = 200. Area: A = xy = x(200 − 2x).' },
    check: [
      ['What is the difference between the objective and the constraint?', 'The objective is what you optimize; the constraint is the condition that links the variables.'],
      ['A rectangle has perimeter 40. What dimensions give the most area?', 'A 10 by 10 square, area 100.'],
      ['After finding $x$, what else must the answer include?', 'The actual quantity asked for, with units.']
    ]
  },
  '3.5': {
    plain: 'In a related rates problem, two or more quantities change over time and are tied together by an equation, like a ladder against a wall. Differentiate that equation with respect to time, plug in the numbers at the moment you care about, and solve for the rate you do not know.',
    figure: { type: 'figure', shapes: [{ kind: 'polygon', points: [[0, 0], [6, 0], [0, 8]] }, { kind: 'angle', at: [0, 0], from: [6, 0], to: [0, 8], right: true }, { kind: 'text', at: [3, -0.6], text: 'x = 6 (growing 2 ft/s)' }, { kind: 'text', at: [-1.3, 4], text: 'y = 8' }, { kind: 'text', at: [3.6, 4.6], text: 'ladder 10' }], caption: 'x² + y² = 100, so 2x·x′ + 2y·y′ = 0.' },
    check: [
      ['Why do you substitute the numbers only after differentiating?', 'The quantities change; plugging in first freezes them and their rates become zero.'],
      ['A circle\'s radius grows at 2 cm/s. How fast is its area growing when $r = 5$?', '$A\' = 2\\pi r r\' = 2\\pi(5)(2) = 20\\pi$ cm²/s.'],
      ['What does a negative rate mean in the answer?', 'That quantity is decreasing.']
    ]
  },
  '4.1': {
    plain: 'If you know how fast something moves at every moment, the distance it covers is the area under the velocity graph. A constant 30 mph for 2 hours is a rectangle with area 60 miles. When velocity goes negative (moving backwards), that area counts against the net change in position.',
    figure: { type: 'graph', x: [0, 4], fns: [{ f: 'x-2', label: 'v(t) = t − 2' }], shade: { f: 'x-2', g: '0', from: 0, to: 4 }, xlabel: 't (s)', ylabel: 'v (m/s)', caption: 'Area below the axis (moving back) cancels area above: net change 0, distance 4 m.' },
    check: [
      ['What is the difference between net change and total distance?', 'Net change counts backward motion as negative; total distance adds every bit of motion as positive.'],
      ['A car drives at 50 mph for 3 hours. What area gives the distance?', 'A 3 by 50 rectangle: 150 miles.'],
      ['Velocity is negative from $t = 1$ to $t = 3$. Which way is the object moving?', 'Backwards, towards smaller positions.']
    ]
  },
  '4.2': {
    plain: 'When the area under a curve is not a simple shape, cut it into thin rectangles and add up their areas. That sum is a Riemann sum. Use the left edge, the right edge or the middle of each strip for the height. More, thinner rectangles give a better estimate.',
    figure: { type: 'graph', x: [0, 2], fns: [{ f: 'x^2', label: 'y = x²' }], riemann: { f: 'x^2', from: 0, to: 2, n: 4, rule: 'left' }, caption: 'The left sum L₄ = 1.75 is too low because x² is increasing.' },
    check: [
      ['For $n$ rectangles on $[a, b]$, what is $\\Delta x$?', '$\\frac{b-a}{n}$.'],
      ['$f$ is decreasing. Does the left sum over- or underestimate?', 'Overestimate: the left edge of each strip is the tallest point.'],
      ['Which is usually most accurate: left, right or midpoint?', 'The midpoint sum.']
    ]
  },
  '4.3': {
    plain: 'The definite integral $\\int_a^b f(x)\\,dx$ is the exact area you get from Riemann sums when the rectangles become infinitely thin, counting area above the axis as positive and below as negative. Dividing that area by the width of the interval gives the function\'s average height.',
    figure: { type: 'graph', x: [-0.5, 3.5], fns: [{ f: 'sin(x)+1', label: 'y = f(x)' }], shade: { f: 'sin(x)+1', g: '0', from: 0, to: 3 }, caption: '∫₀³ f(x) dx is the shaded area.' },
    check: [
      ['What is $\\int_2^2 f(x)\\,dx$?', '0: no width, no area.'],
      ['If $\\int_0^4 f = 10$, what is $\\int_4^0 f$?', '−10: swapping the limits flips the sign.'],
      ['Find $\\int_0^2 3\\,dx$ with geometry.', 'A 2 by 3 rectangle: 6.']
    ]
  },
  '4.4': {
    plain: 'The Fundamental Theorem connects slopes and areas: to find the exact area under $f$ from $a$ to $b$, find any function $F$ whose derivative is $f$ and compute $F(b) - F(a)$. It also says integrating a rate gives the total change: add up all the little changes and you get the overall change.',
    figure: { type: 'graph', x: [0, 3], fns: [{ f: 'x^2', label: 'f(x) = x²' }], shade: { f: 'x^2', g: '0', from: 0, to: 2 }, caption: '∫₀² x² dx = [x³/3]₀² = 8/3.' },
    check: [
      ['Evaluate $\\int_1^3 2x\\,dx$.', '$[x^2]_1^3 = 9 - 1 = 8$.'],
      ['Water flows in at $r(t)$ liters per minute. What does $\\int_0^{10} r(t)\\,dt$ mean?', 'The liters that flowed in during the first 10 minutes.'],
      ['Why can you ignore the $+C$ here?', 'It cancels: $(F(b)+C) - (F(a)+C) = F(b) - F(a)$.']
    ]
  },
  '5.1': {
    plain: 'If you know a function\'s slopes, you can sketch the function itself. Where $f$ is positive, its antiderivative $F$ rises; where $f$ is negative, $F$ falls; where $f$ crosses zero, $F$ has a peak or valley. The value of $F$ at a point is the area under $f$ so far.',
    figure: { type: 'graph', x: [0, 4], fns: [{ f: '2-x', label: 'f(t)' }, { f: '2x-x^2/2', label: 'F(x) = ∫₀ˣ f(t) dt', dash: true }], caption: 'F rises while f > 0, peaks where f crosses zero (x = 2), then falls.' },
    check: [
      ['$f$ changes from positive to negative at $x = 3$. What does $F$ have there?', 'A local maximum.'],
      ['What is $F(a)$ for $F(x) = \\int_a^x f(t)\\,dt$?', '0.'],
      ['Write the family of antiderivatives of $2x$.', '$x^2 + C$.']
    ]
  },
  '5.2': {
    plain: 'Build a function by accumulating area: $A(x) = \\int_a^x f(t)\\,dt$. As $x$ moves right a little, the area grows by a thin strip whose height is $f(x)$. So the rate the area grows is exactly $f(x)$: the derivative of an accumulation function is the function being accumulated.',
    figure: { type: 'graph', x: [0, 3], fns: [{ f: 'x^2-1', label: 'f(t) = t² − 1' }], shade: { f: 'x^2-1', g: '0', from: 1, to: 2.3 }, vlines: [{ x: 2.3, label: 'x' }], caption: 'A(x) is the shaded area from 1 to x; its rate of growth is f(x).' },
    check: [
      ['Find $\\frac{d}{dx}\\int_0^x \\cos t\\,dt$.', '$\\cos x$.'],
      ['Find $\\frac{d}{dx}\\int_1^{x^3} \\ln t\\,dt$.', '$\\ln(x^3)\\cdot 3x^2$ by the chain rule.'],
      ['Why does $\\int_0^x e^{-t^2}dt$ have a derivative even with no formula for it?', 'The second FTC gives the derivative directly: $e^{-x^2}$.']
    ]
  }
};
