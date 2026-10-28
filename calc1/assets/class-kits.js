/* ============================================================
   StudyCat — each Montana State class's own tools (the Tools page, assets/class-tools.js)
   Course material, like the notes: what each class needs on its Tools page, in the order it shows. A "link"
   opens one of the class's own pages (its grapher, labs, simulators). Formulas use * between letters and
   write angles in degrees as θ·π/180, so every one can be solved for any of its letters.
   A class you make yourself keeps its own list (TOOLS, from the class maker or from Bo reading its syllabus);
   until it has one, it gets the kit of its subject (MathubSubjectKits, at the end).
   ============================================================ */
(function (global) {
  'use strict';
  const F = (n, eq, vars, extra) => Object.assign({ n, eq, vars }, extra || {});
  const DEG = 'degrees, 0 to 180';
  global.MathubKits = {
    calc: [
      { kind: 'link', view: 'grapher', title: 'Function grapher', desc: 'Type any function: tangent and secant lines, the derivative made visible.' },
      { kind: 'link', view: 'labs', title: 'Calculus labs', desc: 'The course labs as experiments: type a function, compute, read the pattern.' },
      { kind: 'limit', f: '(x^2 - 4)/(x - 2)', at: '2', desc: 'Chapter 1: close in on a point from both sides and see what the values settle on.' },
      { kind: 'integral', f: 'x^2', a: 0, b: 2, n: 4, desc: 'Chapter 4: left, right, midpoint and trapezoid sums, and how far each is from the integral.' },
      { kind: 'equation', eq: 'x^3 - 2*x = 5', desc: 'Critical points (solve f′(x) = 0), where curves meet, Newton’s method answers to check.' },
      { kind: 'calculator' }
    ],
    precalc: [
      { kind: 'link', view: 'explorer', title: 'Function explorer', desc: 'Move a, b, h and k in y = a·f(b(x − h)) + k and watch the parent function change.' },
      { kind: 'link', view: 'unitcircle', title: 'Unit circle & triangles', desc: 'Drag the angle, read exact values, solve right and oblique triangles.' },
      { kind: 'link', view: 'grapher', title: 'Function grapher', desc: 'Graph anything, zoom in, read points off the curve.' },
      { kind: 'solver', title: 'Growth, decay and logs', formulas: [
        F('Exponential growth or decay', 'A = P*e^(r*t)', [['A', 'amount after time t'], ['P', 'starting amount'], ['r', 'rate (0.05 for 5%; negative for decay)'], ['t', 'time']], { tex: 'A = Pe^{rt}' }),
        F('Compound interest', 'A = P*(1 + r/n)^(n*t)', [['A', 'amount at the end', '$'], ['P', 'principal', '$'], ['r', 'yearly rate (0.04 for 4%)'], ['n', 'times compounded a year'], ['t', 'years']], { tex: 'A = P\\left(1 + \\frac{r}{n}\\right)^{nt}' }),
        F('Half-life', 'A = A0*(1/2)^(t/h)', [['A', 'amount left'], ['A0', 'starting amount'], ['t', 'time passed'], ['h', 'half-life', '', 0]], { tex: 'A = A_0\\left(\\tfrac12\\right)^{t/h}' }),
        F('Change of base', 'y = ln(x)/ln(b)', [['y', 'the logarithm, log base b of x'], ['x', 'the number', '', 0], ['b', 'the base', '', 0]], { tex: 'y = \\log_b x = \\frac{\\ln x}{\\ln b}' })
      ] },
      { kind: 'equation', eq: '2^x = 10' },
      { kind: 'calculator' }
    ],
    physics: [
      { kind: 'link', view: 'motion', title: 'Projectile & motion', desc: 'Launch a projectile, compare angles, read x(t), v(t) and a(t) off their graphs.' },
      { kind: 'link', view: 'solvers', title: 'Kinematics and force solvers', desc: 'Kinematics, vectors, inclines with friction, step by step.' },
      { kind: 'solver', title: 'Formula solver', formulas: [
        F('Velocity with constant acceleration', 'v = v0 + a*t', [['v', 'final velocity', 'm/s'], ['v0', 'initial velocity', 'm/s'], ['a', 'acceleration', 'm/s²'], ['t', 'time', 's', 0]], { tex: 'v = v_0 + at' }),
        F('Position with constant acceleration', 'x = x0 + v0*t + 0.5*a*t^2', [['x', 'position', 'm'], ['x0', 'starting position', 'm'], ['v0', 'initial velocity', 'm/s'], ['a', 'acceleration', 'm/s²'], ['t', 'time', 's', 0]], { tex: 'x = x_0 + v_0t + \\tfrac12at^2' }),
        F('Velocity without time', 'v^2 = v0^2 + 2*a*dx', [['v', 'final speed', 'm/s', 0], ['v0', 'initial speed', 'm/s'], ['a', 'acceleration', 'm/s²'], ['dx', 'displacement', 'm']], { tex: 'v^2 = v_0^2 + 2a\\,\\Delta x' }),
        F('Newton’s second law', 'F = m*a', [['F', 'net force', 'N'], ['m', 'mass', 'kg'], ['a', 'acceleration', 'm/s²']], { tex: '\\sum F = ma' }),
        F('Weight', 'W = m*g', [['W', 'weight', 'N'], ['m', 'mass', 'kg'], ['g', 'gravity (9.8 on Earth)', 'm/s²']]),
        F('Kinetic friction', 'f = mu*N', [['f', 'friction force', 'N'], ['mu', 'coefficient of friction'], ['N', 'normal force', 'N']], { tex: 'f_k = \\mu_k N' }),
        F('Work by a constant force', 'W = F*d*cos(theta*pi/180)', [['W', 'work', 'J'], ['F', 'force', 'N'], ['d', 'displacement', 'm'], ['theta', 'angle between them', DEG, 0, 180]], { tex: 'W = Fd\\cos\\theta' }),
        F('Kinetic energy', 'K = 0.5*m*v^2', [['K', 'kinetic energy', 'J'], ['m', 'mass', 'kg'], ['v', 'speed', 'm/s', 0]], { tex: 'K = \\tfrac12mv^2' }),
        F('Gravitational potential energy', 'U = m*g*h', [['U', 'potential energy', 'J'], ['m', 'mass', 'kg'], ['g', 'gravity', 'm/s²'], ['h', 'height', 'm']]),
        F('Momentum', 'p = m*v', [['p', 'momentum', 'kg·m/s'], ['m', 'mass', 'kg'], ['v', 'velocity', 'm/s']]),
        F('Centripetal acceleration', 'ac = v^2/r', [['ac', 'centripetal acceleration', 'm/s²'], ['v', 'speed', 'm/s', 0], ['r', 'radius', 'm']], { tex: 'a_c = \\frac{v^2}{r}' }),
        F('Spring force (Hooke’s law)', 'Fs = k*x', [['Fs', 'spring force (size)', 'N'], ['k', 'spring constant', 'N/m'], ['x', 'stretch or squeeze', 'm']])
      ] },
      { kind: 'calculator', consts: [['g', '9.8', 'free-fall acceleration, m/s²'], ['G', '6.674e-11', 'gravitational constant, N·m²/kg²']] },
      { kind: 'units', cats: ['length', 'mass', 'time', 'speed', 'acceleration', 'force', 'energy', 'power', 'angle'] },
      { kind: 'scatter', title: 'Lab data: best-fit line', xlabel: 'time (s)', ylabel: 'position (m)', points: [[0, 0.02], [0.5, 1.1], [1, 2.4], [1.5, 3.4], [2, 4.6], [2.5, 5.6]], desc: 'Paste your lab’s pairs: the slope of the line is often the quantity you are after.' }
    ],
    writ: [
      { kind: 'link', view: 'drafts', title: 'Draft feedback', desc: 'Bo reads your draft against the assignment and coaches; he never rewrites it.' },
      { kind: 'wordcount' },
      { kind: 'cite', desc: 'MLA 9 for WRIT 101, and APA 7 when another class asks for it.' },
      { kind: 'checklist', title: 'Revision checklists', sets: [
        { name: 'Big picture', note: 'Revise from the top down: the argument before the commas.', items: ['My thesis makes a claim someone could disagree with', 'The thesis answers what the assignment asks', 'Every paragraph moves the argument forward', 'The order makes sense: each paragraph needs the one before', 'I wrote for my audience, not only for my instructor', 'The conclusion says why the argument matters, not only what it was'] },
        { name: 'Paragraphs', items: ['Each paragraph opens with a claim, not a fact or a quotation', 'Evidence follows the claim and supports it', 'I explain how the evidence proves the claim (I do not let a quotation speak for itself)', 'Quotations are introduced with a signal phrase', 'Each paragraph ends by connecting back to the thesis', 'Transitions show how ideas relate (because, however, so)'] },
        { name: 'Sources', items: ['Every quotation and paraphrase has an in-text citation', 'Every in-text citation has an entry in Works Cited', 'Works Cited is alphabetical, with hanging indents', 'Paraphrases are in my own words and structure', 'I used sources to support my ideas, not replace them'] },
        { name: 'Sentences and proofreading', items: ['Read it aloud once: rewrite the sentences that trip', 'Cut words that add nothing (very, really, in order to)', 'Vary sentence length', 'Check commas, apostrophes and capitalization', 'Spell names and titles exactly', 'MLA format: heading, header with page numbers, title, double spacing'] },
        { name: 'Peer review', note: 'For a classmate’s draft: say what you see, not what you would write.', items: ['I can say the thesis in one sentence', 'I marked the paragraph that convinced me most, and why', 'I marked one place where I got lost', 'I asked one question the writer should answer', 'I named one piece of evidence that needs more explaining', 'My comments are specific and kind'] }
      ] },
      { kind: 'link', view: 'phonetics', title: 'Phonetics lab', desc: 'Hear and practice the sounds of English, for presentations and reading aloud.' }
    ],
    csci: [
      { kind: 'link', view: 'playground', title: 'Python playground', desc: 'Run Python in the browser, with the examples from the notes.' },
      { kind: 'base', desc: 'How values are stored: integers in binary, octal and hex, and the characters that numbers stand for.' },
      { kind: 'stats', title: 'Statistics of a list', label: 'a Python list', desc: 'What statistics.mean, median and stdev would give for a list, with a box plot and a histogram.' },
      { kind: 'scatter', title: 'Line of best fit', desc: 'The line numpy.polyfit(x, y, 1) finds, with r: check your data science answers.' },
      { kind: 'calculator' }
    ],
    biob: [
      { kind: 'punnett', p1: 'Aa', p2: 'Aa' },
      { kind: 'chisq', desc: 'Do your counts fit Mendel’s ratio? χ², degrees of freedom and the p-value.' },
      { kind: 'solver', title: 'Biology formulas', formulas: [
        F('Hardy–Weinberg: allele frequencies', 'p + q = 1', [['p', 'frequency of the dominant allele', '', 0, 1], ['q', 'frequency of the recessive allele', '', 0, 1]]),
        F('Hardy–Weinberg: recessive phenotype', 'aa = q^2', [['aa', 'fraction showing the recessive trait', '', 0, 1], ['q', 'frequency of the recessive allele', '', 0, 1]], { tex: 'q^2 = \\text{fraction homozygous recessive}' }),
        F('Hardy–Weinberg: carriers', 'Aa = 2*(1 - q)*q', [['Aa', 'fraction heterozygous (carriers)', '', 0, 0.5], ['q', 'frequency of the recessive allele', '', 0, 1]], { tex: '2pq,\\ p = 1 - q' }),
        F('Dilution', 'C1*V1 = C2*V2', [['C1', 'stock concentration'], ['V1', 'volume of stock to use'], ['C2', 'final concentration'], ['V2', 'final volume']], { tex: 'C_1V_1 = C_2V_2' }),
        F('Doubling (PCR cycles, cell divisions)', 'N = N0*2^c', [['N', 'copies at the end'], ['N0', 'copies at the start'], ['c', 'cycles or generations']], { tex: 'N = N_0 \\cdot 2^c' }),
        F('Total magnification', 'M = ob*oc', [['M', 'total magnification', '×'], ['ob', 'objective lens', '×'], ['oc', 'ocular (eyepiece) lens', '×']]),
        F('Surface area to volume (a cube)', 'ratio = 6/s', [['ratio', 'surface area ÷ volume', '1/µm'], ['s', 'side length', 'µm', 0]], { note: 'Why cells stay small: the ratio falls as the side grows.' })
      ] },
      { kind: 'stats', title: 'Lab data', label: 'your measurements' },
      { kind: 'units', cats: ['length', 'volume', 'mass', 'temperature', 'time'] }
    ],
    kin: [
      { kind: 'solver', title: 'Levers and movement', formulas: [
        F('Torque (moment of force)', 'T = F*d', [['T', 'torque', 'N·m'], ['F', 'force', 'N'], ['d', 'moment arm (perpendicular distance)', 'm']], { tex: '\\tau = F \\cdot d_\\perp' }),
        F('Lever balance', 'Fe*de = Fr*dr', [['Fe', 'effort (muscle) force', 'N'], ['de', 'effort arm', 'm'], ['Fr', 'resistance (load) force', 'N'], ['dr', 'resistance arm', 'm']], { tex: 'F_e d_e = F_r d_r', note: 'Most muscles work third-class levers: a short effort arm, so a big muscle force moves a light load fast.' }),
        F('Mechanical advantage', 'MA = de/dr', [['MA', 'mechanical advantage'], ['de', 'effort arm', 'm'], ['dr', 'resistance arm', 'm']], { note: 'Above 1: force is gained (second-class levers). Below 1: speed and range are gained (third-class).' }),
        F('Moment arm at an angle', 'dp = d*sin(theta*pi/180)', [['dp', 'moment arm', 'm'], ['d', 'distance from the joint', 'm'], ['theta', 'angle of pull to the segment', DEG, 0, 180]], { tex: 'd_\\perp = d\\sin\\theta' }),
        F('Gait speed', 'v = L*c/60', [['v', 'walking speed', 'm/s'], ['L', 'step length', 'm'], ['c', 'cadence', 'steps/min']]),
        F('Angular velocity', 'w = th/t', [['w', 'angular velocity', '°/s'], ['th', 'angle moved', '°'], ['t', 'time', 's']])
      ] },
      { kind: 'units', cats: ['length', 'mass', 'force', 'angle', 'speed', 'energy'] },
      { kind: 'stats', title: 'Range of motion data', label: 'joint angles in degrees', data: [140, 150, 145, 135, 160, 150, 148, 142, 155, 138] },
      { kind: 'scatter', title: 'Two measures together', xlabel: 'height (cm)', ylabel: 'stride length (cm)', points: [[160, 132], [165, 136], [170, 141], [175, 144], [180, 150], [185, 153]] },
      { kind: 'calculator' }
    ],
    psyx: [
      { kind: 'checklist', title: 'DSM-5 criteria practice', warn: 'For studying how the criteria work, never for diagnosing yourself or anyone else. Only a clinician diagnoses. If you are struggling, MSU Counseling & Psychological Services can help: (406) 994-4531, or call or text 988 in a crisis.', sets: [
        { name: 'Major depressive episode', need: 5, note: 'Five or more, in the same two weeks, a change from before, and at least one of them is depressed mood or loss of interest. They must cause distress or impairment, and not be due to a substance or another condition.', items: ['Depressed mood most of the day, nearly every day', 'Markedly less interest or pleasure in almost all activities', 'Significant weight or appetite change', 'Insomnia or sleeping too much', 'Psychomotor agitation or slowing that others can see', 'Fatigue or loss of energy', 'Feelings of worthlessness or excessive guilt', 'Trouble thinking, concentrating or deciding', 'Recurrent thoughts of death or suicide'] },
        { name: 'Generalized anxiety disorder', need: 3, note: 'Excessive anxiety and worry, more days than not for at least six months, about many things, and hard to control; with three or more of these (one in children).', items: ['Restlessness or feeling keyed up or on edge', 'Being easily fatigued', 'Trouble concentrating or the mind going blank', 'Irritability', 'Muscle tension', 'Sleep disturbance'] },
        { name: 'Panic attack', need: 4, note: 'An abrupt surge of intense fear or discomfort that peaks within minutes, with four or more of these.', items: ['Pounding heart or racing pulse', 'Sweating', 'Trembling or shaking', 'Shortness of breath or smothering', 'Feelings of choking', 'Chest pain or discomfort', 'Nausea or abdominal distress', 'Dizziness or light-headedness', 'Chills or heat sensations', 'Numbness or tingling', 'Derealization or depersonalization', 'Fear of losing control or going crazy', 'Fear of dying'] }
      ] },
      { kind: 'stats', title: 'Statistics for research', label: 'scores', data: [12, 15, 9, 22, 18, 14, 11, 25, 16, 13, 19, 21] },
      { kind: 'scatter', title: 'Correlation', xlabel: 'hours of sleep', ylabel: 'anxiety score', points: [[4, 31], [5, 27], [6, 24], [6.5, 22], [7, 19], [8, 15], [9, 14]], desc: 'How strongly two measures move together. A correlational study cannot show cause.' },
      { kind: 'cite', desc: 'APA 7, the style psychology uses.' }
    ],
    emec100: [
      { kind: 'matrix', title: 'Design decision matrix', options: ['Concept A', 'Concept B', 'Concept C'], criteria: [['Cost', 3], ['Strength', 5], ['Weight', 3], ['Ease of making', 4], ['Safety', 5]], desc: 'Score your design concepts against weighted criteria, the way the design process picks one.' },
      { kind: 'solver', title: 'Mechanics formulas', formulas: [
        F('Normal stress', 'sigma = F/A', [['sigma', 'stress', 'Pa'], ['F', 'axial force', 'N'], ['A', 'cross-section area', 'm²']], { tex: '\\sigma = \\frac{F}{A}' }),
        F('Strain', 'eps = dL/L', [['eps', 'strain (no units)'], ['dL', 'change in length', 'm'], ['L', 'original length', 'm']], { tex: '\\varepsilon = \\frac{\\Delta L}{L}' }),
        F('Hooke’s law for materials', 'sigma = E*eps', [['sigma', 'stress', 'Pa'], ['E', 'modulus of elasticity', 'Pa'], ['eps', 'strain']], { tex: '\\sigma = E\\varepsilon' }),
        F('Factor of safety', 'FS = Sy/sigma', [['FS', 'factor of safety'], ['Sy', 'yield strength', 'Pa'], ['sigma', 'working stress', 'Pa']], { tex: 'FS = \\frac{S_y}{\\sigma}' }),
        F('Weight', 'W = m*g', [['W', 'weight', 'N'], ['m', 'mass', 'kg'], ['g', 'gravity (9.81)', 'm/s²']]),
        F('Moment', 'M = F*d', [['M', 'moment', 'N·m'], ['F', 'force', 'N'], ['d', 'perpendicular distance', 'm']]),
        F('Density', 'rho = m/V', [['rho', 'density', 'kg/m³'], ['m', 'mass', 'kg'], ['V', 'volume', 'm³']], { tex: '\\rho = \\frac{m}{V}' }),
        F('Power', 'P = W/t', [['P', 'power', 'W'], ['W', 'work', 'J'], ['t', 'time', 's']])
      ] },
      { kind: 'units', desc: 'SI and US customary: an engineer’s daily conversions.' },
      { kind: 'sigfigs' },
      { kind: 'calculator', consts: [['g', '9.81', 'gravity, m/s²'], ['g', '32.174', 'gravity, ft/s²']] }
    ],
    jpns150d: [
      { kind: 'timeline', title: 'Japan through time', events: [
        ['c. 14,000–300 BCE', 'Jōmon period: hunter-gatherers and the world’s oldest pottery'], ['c. 300 BCE–300 CE', 'Yayoi period: wet-rice farming, bronze and iron arrive from the continent'], ['c. 300–538', 'Kofun period: great keyhole-shaped tombs and the rise of the Yamato court'],
        ['538', 'Buddhism reaches the Yamato court from Baekje (traditional date)'], ['604', 'Prince Shōtoku’s Seventeen-Article Constitution'], ['645', 'The Taika Reforms begin a Chinese-style state'],
        ['710', 'Nara becomes the capital (Nara period, 710–794)'], ['712', 'The Kojiki, Japan’s oldest chronicle'], ['720', 'The Nihon shoki chronicle'], ['794', 'The capital moves to Heian-kyō, Kyoto (Heian period, 794–1185)'],
        ['c. 1008', 'Murasaki Shikibu writes The Tale of Genji'], ['1185', 'The Minamoto defeat the Taira at Dan-no-ura (Kamakura period begins)'], ['1192', 'Minamoto no Yoritomo is named shōgun'],
        ['1274', 'First Mongol invasion, turned back'], ['1281', 'Second Mongol invasion, scattered by the kamikaze storm'], ['1336', 'The Ashikaga shogunate (Muromachi period, 1336–1573)'],
        ['1467', 'The Ōnin War begins the Warring States (Sengoku) era'], ['1543', 'Portuguese traders land on Tanegashima, bringing firearms'], ['1549', 'Francis Xavier brings Christianity'],
        ['1600', 'Tokugawa Ieyasu wins the Battle of Sekigahara'], ['1603', 'The Tokugawa shogunate (Edo period, 1603–1868)'], ['1639', 'The Portuguese are expelled: the sakoku policy of seclusion'],
        ['1853', 'Commodore Perry’s black ships arrive at Uraga'], ['1868', 'The Meiji Restoration'], ['1889', 'The Meiji Constitution'], ['1894–1895', 'The First Sino-Japanese War'], ['1904–1905', 'The Russo-Japanese War'],
        ['1912', 'The Taishō era begins'], ['1923', 'The Great Kantō earthquake'], ['1926', 'The Shōwa era begins'], ['1941', 'The attack on Pearl Harbor'], ['1945', 'The atomic bombings of Hiroshima and Nagasaki; Japan surrenders'],
        ['1945–1952', 'The Allied Occupation'], ['1947', 'The postwar constitution, with Article 9'], ['1964', 'The Tokyo Olympics and the first shinkansen'], ['1989', 'The Heisei era begins'], ['2011', 'The Tōhoku earthquake, tsunami and Fukushima nuclear disaster'], ['2019', 'The Reiwa era begins']
      ] },
      { kind: 'cite', desc: 'MLA 9 for your response papers, and APA 7.' },
      { kind: 'wordcount', desc: 'Keep a response paper inside its word limit.' }
    ],
    m170: [
      { kind: 'unitcircle', angle: 210 },
      { kind: 'grapher', title: 'Sinusoid grapher', fns: ['a*sin(b*(x - c)) + d'], x: [-7, 7], y: [-5, 5], sliders: [{ name: 'a', min: -4, max: 4, value: 2, step: 0.1 }, { name: 'b', min: 0.25, max: 4, value: 1, step: 0.05 }, { name: 'c', min: -3.2, max: 3.2, value: 0, step: 0.05 }, { name: 'd', min: -3, max: 3, value: 0, step: 0.1 }], desc: 'Drag a (amplitude), b (period 2π/b), c (phase shift) and d (midline).' },
      { kind: 'solver', title: 'Triangle solver', formulas: [
        F('Law of cosines', 'c^2 = a^2 + b^2 - 2*a*b*cos(C*pi/180)', [['c', 'side opposite C', '', 0], ['a', 'side a', '', 0], ['b', 'side b', '', 0], ['C', 'angle C', DEG, 0, 180]], { tex: 'c^2 = a^2 + b^2 - 2ab\\cos C' }),
        F('Law of sines', 'a/sin(A*pi/180) = b/sin(B*pi/180)', [['a', 'side a', '', 0], ['A', 'angle A', DEG, 0, 180], ['b', 'side b', '', 0], ['B', 'angle B', DEG, 0, 180]], { tex: '\\frac{a}{\\sin A} = \\frac{b}{\\sin B}', note: 'Solving for an angle can give two answers (the ambiguous SSA case): both are listed.' }),
        F('Right triangle: sine', 'sin(A*pi/180) = opp/hyp', [['A', 'angle', 'degrees, 0 to 90', 0, 90], ['opp', 'opposite side', '', 0], ['hyp', 'hypotenuse', '', 0]], { tex: '\\sin A = \\frac{\\text{opp}}{\\text{hyp}}' }),
        F('Right triangle: tangent', 'tan(A*pi/180) = opp/adj', [['A', 'angle', 'degrees, 0 to 90', 0, 90], ['opp', 'opposite side', '', 0], ['adj', 'adjacent side', '', 0]], { tex: '\\tan A = \\frac{\\text{opp}}{\\text{adj}}' }),
        F('Arc length', 's = r*th', [['s', 'arc length'], ['r', 'radius', '', 0], ['th', 'angle', 'radians']], { tex: 's = r\\theta' }),
        F('Area of a triangle (SAS)', 'K = 0.5*a*b*sin(C*pi/180)', [['K', 'area'], ['a', 'side a', '', 0], ['b', 'side b', '', 0], ['C', 'angle between them', DEG, 0, 180]], { tex: 'K = \\tfrac12ab\\sin C' })
      ] },
      { kind: 'equation', eq: '2*sin(x) = 1', x: [0, 6.283185307], desc: 'Solve trig equations on [0, 2π): every solution, and the graph that shows them.' },
      { kind: 'calculator' }
    ],
    m172: [
      { kind: 'integral', f: 'e^(-x^2)', a: 0, b: 1, n: 6, desc: 'Chapter 5: the numerical integration rules, and how fast each one closes in.' },
      { kind: 'series', term: '1/n^2', from: 1, desc: 'Chapter 8: watch the partial sums, then prove it with a test.' },
      { kind: 'grapher', title: 'Taylor polynomials', fns: ['sin(x)', 'x - x^3/6 + x^5/120'], x: [-7, 7], y: [-3, 3], desc: 'Compare a function with its Taylor polynomial: where does the approximation hold?' },
      { kind: 'limit', f: '(1 + 1/x)^x', at: 'inf', desc: 'Limits at infinity and indeterminate forms (for L’Hôpital’s rule).' },
      { kind: 'equation', eq: 'x^2 = 2 - x', desc: 'Where two curves meet: the limits of integration for areas and volumes.' },
      { kind: 'calculator' }
    ],
    psci230d: [
      { kind: 'timeline', title: 'International relations timeline', events: [
        ['1648', 'The Peace of Westphalia: the sovereign state system'], ['1815', 'The Congress of Vienna and the Concert of Europe'], ['1914', 'World War I begins'], ['1919', 'The Treaty of Versailles'], ['1920', 'The League of Nations meets'],
        ['1939', 'World War II begins'], ['1944', 'Bretton Woods creates the IMF and the World Bank'], ['1945', 'The United Nations is founded'], ['1947', 'The Truman Doctrine and the Marshall Plan: the Cold War begins'], ['1948', 'GATT takes effect (signed 1947)'],
        ['1949', 'NATO is founded'], ['1955', 'The Warsaw Pact'], ['1962', 'The Cuban missile crisis'], ['1968', 'The Nuclear Non-Proliferation Treaty is signed'], ['1972', 'SALT I limits nuclear arms'],
        ['1989', 'The Berlin Wall falls'], ['1991', 'The Soviet Union dissolves'], ['1993', 'The Maastricht Treaty creates the European Union'], ['1995', 'The World Trade Organization'], ['2001', 'The September 11 attacks; China joins the WTO'],
        ['2002', 'The International Criminal Court opens'], ['2008', 'The global financial crisis'], ['2015', 'The Paris climate agreement'], ['2022', 'Russia’s full-scale invasion of Ukraine']
      ] },
      { kind: 'game', title: 'Game theory', players: ['State A', 'State B'], presets: ['pd', 'chicken', 'stag', 'arms', 'bos'], desc: 'Prisoner’s dilemma, chicken, stag hunt, arms races: best responses and Nash equilibria.' },
      { kind: 'solver', title: 'Bargaining and war', formulas: [
        F('A’s value of fighting', 'EA = p - cA', [['EA', 'what war is worth to A (share of the prize)'], ['p', 'A’s chance of winning', '0 to 1', 0, 1], ['cA', 'A’s cost of fighting (as a share)']], { note: 'A should accept any deal giving it at least p − cA.' }),
        F('B’s value of fighting', 'EB = 1 - p - cB', [['EB', 'what war is worth to B'], ['p', 'A’s chance of winning', '0 to 1', 0, 1], ['cB', 'B’s cost of fighting (as a share)']], { note: 'B accepts any deal leaving A at most p + cB. The deals between p − cA and p + cB form the bargaining range: both prefer them to war.' }),
        F('Width of the bargaining range', 'w = cA + cB', [['w', 'width of the bargaining range'], ['cA', 'A’s cost of war'], ['cB', 'B’s cost of war']], { note: 'Costly war always leaves a range of deals; war comes from private information, commitment problems or indivisible stakes.' }),
        F('Opportunity cost', 'oc = given/gained', [['oc', 'opportunity cost of one unit'], ['given', 'units of the other good given up'], ['gained', 'units gained']], { note: 'For comparative advantage: whoever gives up less specializes.' })
      ] },
      { kind: 'cite', desc: 'APA 7 and MLA 9 citations for your papers.' }
    ]
  };

  /* a class you make, until you choose its tools: the kit of its subject, by its code's letters (CHMY 121 → chemistry), then by its kind */
  const SUBJECTS = [
    [/^(CHMY|CHEM)$/, [{ kind: 'calculator', consts: [['NA', '6.022e23', 'Avogadro’s number, per mol'], ['R', '0.08206', 'gas constant, L·atm/(mol·K)'], ['R', '8.314', 'gas constant, J/(mol·K)']] }, { kind: 'solver', title: 'Chemistry formulas', formulas: [F('Ideal gas law', 'P*V = n*R*T', [['P', 'pressure', 'atm'], ['V', 'volume', 'L'], ['n', 'amount', 'mol'], ['R', 'gas constant (0.08206)', 'L·atm/(mol·K)'], ['T', 'temperature', 'K']]), F('Molarity', 'M = n/V', [['M', 'molarity', 'mol/L'], ['n', 'amount of solute', 'mol'], ['V', 'volume of solution', 'L']]), F('Moles from mass', 'n = m/MM', [['n', 'amount', 'mol'], ['m', 'mass', 'g'], ['MM', 'molar mass', 'g/mol']]), F('Dilution', 'C1*V1 = C2*V2', [['C1', 'starting concentration'], ['V1', 'starting volume'], ['C2', 'final concentration'], ['V2', 'final volume']]), F('pH', 'pH = -log(H)', [['pH', 'pH'], ['H', '[H⁺]', 'mol/L']])] }, { kind: 'sigfigs' }, { kind: 'units', cats: ['mass', 'volume', 'pressure', 'temperature', 'energy', 'length'] }, { kind: 'scatter' }]],
    [/^(PHSX|PHYS|ASTR|ERTH|GEO|GPHY)$/, [{ kind: 'calculator', consts: [['g', '9.8', 'gravity, m/s²'], ['G', '6.674e-11', 'gravitational constant'], ['c', '2.998e8', 'speed of light, m/s']] }, { kind: 'solver', title: 'Physics formulas', formulas: [F('Velocity', 'v = v0 + a*t', [['v', 'final velocity', 'm/s'], ['v0', 'initial velocity', 'm/s'], ['a', 'acceleration', 'm/s²'], ['t', 'time', 's']]), F('Position', 'x = x0 + v0*t + 0.5*a*t^2', [['x', 'position', 'm'], ['x0', 'starting position', 'm'], ['v0', 'initial velocity', 'm/s'], ['a', 'acceleration', 'm/s²'], ['t', 'time', 's', 0]]), F('Newton’s second law', 'F = m*a', [['F', 'net force', 'N'], ['m', 'mass', 'kg'], ['a', 'acceleration', 'm/s²']]), F('Kinetic energy', 'K = 0.5*m*v^2', [['K', 'kinetic energy', 'J'], ['m', 'mass', 'kg'], ['v', 'speed', 'm/s', 0]])] }, { kind: 'units' }, { kind: 'scatter' }]],
    [/^(BIOB|BIOL|BIOM|BIOE|BIOO|MB|MCB|GEN|ANSC|PSPP)$/, [{ kind: 'punnett' }, { kind: 'chisq' }, { kind: 'stats' }, { kind: 'units', cats: ['length', 'volume', 'mass', 'temperature', 'time'] }]],
    [/^(M|MATH)$/, [{ kind: 'grapher', fns: ['a*x^2 + b*x + c'] }, { kind: 'equation' }, { kind: 'calculator' }, { kind: 'unitcircle' }]],
    [/^(STAT|STA)$/, [{ kind: 'stats' }, { kind: 'scatter' }, { kind: 'chisq', cats: [['A', 25, 1], ['B', 30, 1], ['C', 20, 1], ['D', 25, 1]] }, { kind: 'calculator' }]],
    [/^(CSCI|CS|ESOF|CSE|DATA)$/, [{ kind: 'base' }, { kind: 'calculator' }, { kind: 'stats' }]],
    [/^(E[A-Z]{3}|EGEN|ENGR|ME|CE|EE)$/, [{ kind: 'calculator', consts: [['g', '9.81', 'gravity, m/s²']] }, { kind: 'units' }, { kind: 'solver', title: 'Engineering formulas', formulas: [F('Stress', 'sigma = F/A', [['sigma', 'stress', 'Pa'], ['F', 'force', 'N'], ['A', 'area', 'm²']]), F('Factor of safety', 'FS = Sy/sigma', [['FS', 'factor of safety'], ['Sy', 'yield strength', 'Pa'], ['sigma', 'working stress', 'Pa']]), F('Ohm’s law', 'V = I*R', [['V', 'voltage', 'V'], ['I', 'current', 'A'], ['R', 'resistance', 'Ω']]), F('Power', 'P = W/t', [['P', 'power', 'W'], ['W', 'work', 'J'], ['t', 'time', 's']])] }, { kind: 'matrix', options: ['Concept A', 'Concept B', 'Concept C'], criteria: [['Cost', 3], ['Strength', 4], ['Weight', 3], ['Ease of making', 2]] }, { kind: 'sigfigs' }]],
    [/^(ECNS|ECON|AGBE|BFIN|BMGT|ACTG|BMKT|FIN)$/, [{ kind: 'grapher', fns: ['a - b*x', 'c + d*x'], x: [0, 20], y: [0, 20], title: 'Supply and demand' }, { kind: 'solver', title: 'Money and markets', formulas: [F('Compound interest', 'A = P*(1 + r/n)^(n*t)', [['A', 'amount at the end', '$'], ['P', 'principal', '$'], ['r', 'yearly rate (0.05 for 5%)'], ['n', 'times compounded a year'], ['t', 'years']]), F('Percent change', 'pct = (new - old)/old*100', [['pct', 'percent change', '%'], ['new', 'new value'], ['old', 'old value']]), F('Price elasticity', 'Ed = pctQ/pctP', [['Ed', 'elasticity of demand'], ['pctQ', '% change in quantity'], ['pctP', '% change in price']])] }, { kind: 'calculator' }, { kind: 'stats' }]],
    [/^(PSYX|PSY|SOCI|SOC|ANTY|HDFS|HHD|EDU|EDCI|EDLD)$/, [{ kind: 'stats' }, { kind: 'scatter' }, { kind: 'cite' }, { kind: 'wordcount' }]],
    [/^(KIN|HTH|NUTR|HADM|NRSG|HLTH|EXSC)$/, [{ kind: 'solver', title: 'Body and movement', formulas: [F('Torque', 'T = F*d', [['T', 'torque', 'N·m'], ['F', 'force', 'N'], ['d', 'moment arm', 'm']]), F('Body mass index', 'BMI = m/h^2', [['BMI', 'body mass index', 'kg/m²'], ['m', 'mass', 'kg'], ['h', 'height', 'm', 0]]), F('Speed', 'v = d/t', [['v', 'speed', 'm/s'], ['d', 'distance', 'm'], ['t', 'time', 's']])] }, { kind: 'units', cats: ['length', 'mass', 'force', 'speed', 'energy', 'angle'] }, { kind: 'stats' }, { kind: 'scatter' }]],
    [/^(HSTR|HIST|HSTA|PSCI|POLS|JPNS|CHIN|SPNS|FRCH|GRMN|LIT|ENGL|PHL|RLST|ARTH|MUSI|AMST|NASX|CLS|HONR|WGSS|LS)$/, [{ kind: 'timeline' }, { kind: 'cite' }, { kind: 'wordcount' }]],
    [/^(WRIT|COMX|JRNL|FILM)$/, [{ kind: 'wordcount' }, { kind: 'cite' }, { kind: 'checklist', sets: [{ name: 'Before you hand it in', items: ['The thesis answers the assignment’s question', 'Every paragraph opens with a claim that serves the thesis', 'Each claim has evidence, and the evidence is explained', 'Sources are cited in the text and in the list of works cited', 'The introduction and conclusion do more than repeat each other', 'Read aloud once, for sentences that trip', 'Proofread: names, numbers, commas and spelling'] }] }]]
  ];
  const BY_KIND = { code: SUBJECTS[5][1], science: [{ kind: 'calculator' }, { kind: 'units' }, { kind: 'sigfigs' }, { kind: 'stats' }, { kind: 'scatter' }], writing: SUBJECTS[11][1], reading: SUBJECTS[10][1], math: SUBJECTS[3][1] };
  global.MathubSubjectKits = { list: SUBJECTS, byKind: BY_KIND };
})(window);
