/* M 172: topic notes, formulas, flashcards, practice sets and checklists.
   Written for Mathub from standard Calculus II material, following the section numbers of Active Calculus
   used on the syllabus. The instructor's classes, labs and WeBWorK decide what the exams ask. */
const R = String.raw;
const AC = 'https://activecalculus.org/single/';
const AC1 = 'https://activecalculus.org/single1e/';

const SECTIONS = [
  /* ---------- Unit 1: integration techniques, area and arc length ---------- */
  { id: 'sub', label: '5.3', title: 'Integration by substitution', unit: 1, link: AC + 'sec-5-3-substitution.html', linkLabel: 'Active Calculus 5.3',
    ideas: [
      R`Substitution undoes the <b>chain rule</b>. If $u = g(x)$, then $\int f(g(x))\,g'(x)\,dx = \int f(u)\,du$.`,
      R`Look for a <b>function–derivative pair</b>: an inner function whose derivative, up to a constant factor, also appears. In $\int x^2\cos(x^3)\,dx$ the inner function is $x^3$ and $x^2\,dx$ is a third of its derivative.`,
      R`The steps: choose $u$, write $du = g'(x)\,dx$, rewrite the whole integral in $u$ (no $x$ may be left), integrate, then put $x$ back.`,
      R`Only <b>constants</b> can be fixed up: if $du = 3x^2\,dx$ and you have $x^2\,dx$, use $x^2\,dx = \tfrac13\,du$. If a leftover $x$ remains, solve $u = g(x)$ for $x$ or choose a different $u$.`,
      R`For a <b>definite</b> integral, change the limits to $u$-values, $\int_a^b f(g(x))g'(x)\,dx = \int_{g(a)}^{g(b)} f(u)\,du$, and do not substitute back.`
    ],
    formulas: [{ n: 'Substitution', t: R`\int f(g(x))\,g'(x)\,dx=\int f(u)\,du,\qquad u=g(x),\ du=g'(x)\,dx` }, { n: 'With limits', t: R`\int_a^b f(g(x))\,g'(x)\,dx=\int_{g(a)}^{g(b)} f(u)\,du` }],
    example: { p: R`Evaluate $\displaystyle\int_0^2 x\,e^{x^2}\,dx$.`, s: R`Let $u = x^2$, so $du = 2x\,dx$ and $x\,dx = \tfrac12\,du$. When $x=0$, $u=0$; when $x=2$, $u=4$. The integral is $\tfrac12\int_0^4 e^u\,du = \tfrac12\left(e^4-1\right)\approx 26.80$.` },
    pitfalls: [R`Keeping the $x$-limits after switching to $u$, or switching limits and then substituting back as well.`, R`Leaving an $x$ inside the $u$-integral.`, R`"Fixing" a missing variable factor: you can divide by 3, never by $x$.`, R`Forgetting $+C$ on indefinite integrals.`],
    tip: R`On exams, write "Let $u = \ldots$, $du = \ldots$" on its own line. Graders look for it, and it keeps the limits straight.` },

  { id: 'parts', label: '5.4', title: 'Integration by parts', unit: 1, link: AC + 'sec-5-4-parts.html', linkLabel: 'Active Calculus 5.4',
    ideas: [
      R`Integration by parts undoes the <b>product rule</b>: $\int u\,dv = uv - \int v\,du$.`,
      R`Choose $u$ to get simpler when differentiated and $dv$ to be something you can integrate. A rule of thumb for $u$ is <b>LIATE</b>: logarithms, inverse trig, algebraic (powers of $x$), trig, exponentials.`,
      R`Classic cases: $\int x e^x\,dx$ and $\int x\sin x\,dx$ ($u = x$); $\int \ln x\,dx$ and $\int\arctan x\,dx$ ($u$ is the function, $dv = dx$).`,
      R`Powers like $x^2e^x$ need parts twice. A <b>table</b> (differentiate $u$ down to 0, integrate $dv$ alongside, alternate signs) speeds this up.`,
      R`For $\int e^x\sin x\,dx$, parts twice brings the original integral back. Call it $I$, then solve the equation for $I$.`,
      R`With limits: $\int_a^b u\,dv = \big[uv\big]_a^b - \int_a^b v\,du$.`
    ],
    formulas: [{ n: 'Integration by parts', t: R`\int u\,dv = uv-\int v\,du` }, { n: 'With limits', t: R`\int_a^b u\,dv=\big[uv\big]_a^b-\int_a^b v\,du` }],
    example: { p: R`Find $\displaystyle\int x\cos x\,dx$.`, s: R`Let $u = x$ and $dv = \cos x\,dx$, so $du = dx$ and $v = \sin x$. Then $\int x\cos x\,dx = x\sin x - \int\sin x\,dx = x\sin x + \cos x + C$. Check: the derivative is $\sin x + x\cos x - \sin x = x\cos x$.` },
    pitfalls: [R`Choosing $u = e^x$ in $\int x e^x\,dx$: the new integral is harder.`, R`Losing the minus sign in $-\int v\,du$, especially the second time round.`, R`Evaluating only the integral part at the limits and forgetting $\big[uv\big]_a^b$.`],
    tip: R`Differentiate your answer to check it. It takes twenty seconds and catches nearly every sign error.` },

  { id: 'pfd', label: '5.5', title: 'Partial fractions', unit: 1, link: AC + 'sec-5-5-other-opt.html', linkLabel: 'Active Calculus 5.5',
    ideas: [
      R`Partial fractions splits a rational function $\frac{P(x)}{Q(x)}$ into simple pieces you can integrate. It needs $\deg P \lt \deg Q$; if not, do <b>polynomial long division</b> first.`,
      R`Factor the denominator. Each <b>distinct linear</b> factor $(x-a)$ gives $\frac{A}{x-a}$. A <b>repeated</b> factor $(x-a)^2$ gives $\frac{A}{x-a}+\frac{B}{(x-a)^2}$. An <b>irreducible quadratic</b> $x^2+c$ gives $\frac{Ax+B}{x^2+c}$.`,
      R`Find the constants by clearing denominators, then plugging in the roots (the cover-up shortcut) or matching coefficients.`,
      R`The pieces integrate to logs and arctangents: $\int\frac{A}{x-a}\,dx = A\ln|x-a|$ and $\int\frac{dx}{x^2+a^2} = \frac1a\arctan\frac xa$.`
    ],
    formulas: [{ n: 'Distinct linear factors', t: R`\frac{1}{(x-a)(x-b)}=\frac{A}{x-a}+\frac{B}{x-b}` }, { n: 'Repeated factor', t: R`\frac{p(x)}{(x-a)^2}=\frac{A}{x-a}+\frac{B}{(x-a)^2}` }, { n: 'Arctangent', t: R`\int\frac{dx}{x^2+a^2}=\frac1a\arctan\frac{x}{a}+C` }],
    example: { p: R`Find $\displaystyle\int\frac{dx}{x^2-1}$.`, s: R`Factor: $x^2-1 = (x-1)(x+1)$. Write $\frac{1}{(x-1)(x+1)} = \frac{A}{x-1}+\frac{B}{x+1}$, so $1 = A(x+1)+B(x-1)$. At $x=1$, $A=\tfrac12$; at $x=-1$, $B=-\tfrac12$. The integral is $\tfrac12\ln|x-1|-\tfrac12\ln|x+1|+C = \tfrac12\ln\left|\frac{x-1}{x+1}\right|+C$.` },
    pitfalls: [R`Skipping long division when the top's degree is not smaller.`, R`Using only $\frac{A}{(x-a)^2}$ for a repeated factor; you need $\frac{A}{x-a}$ too.`, R`A constant numerator over an irreducible quadratic: it needs $Ax+B$.`, R`Dropping the absolute values inside $\ln$.`],
    tip: R`Check your constants by adding the fractions back together before you integrate.` },

  { id: 'trigsub', label: '5.5', title: 'Trigonometric substitution and integral tables', unit: 1, link: AC + 'sec-5-5-other-opt.html', linkLabel: 'Active Calculus 5.5',
    ideas: [
      R`Square roots of quadratics call for a trig substitution that turns the root into a single trig function, thanks to a Pythagorean identity.`,
      R`$\sqrt{a^2-x^2}$: let $x = a\sin\theta$, so $dx = a\cos\theta\,d\theta$ and the root becomes $a\cos\theta$.`,
      R`$\sqrt{a^2+x^2}$: let $x = a\tan\theta$, so $dx = a\sec^2\theta\,d\theta$ and the root becomes $a\sec\theta$.`,
      R`$\sqrt{x^2-a^2}$: let $x = a\sec\theta$, so $dx = a\sec\theta\tan\theta\,d\theta$ and the root becomes $a\tan\theta$.`,
      R`After integrating in $\theta$, draw a right triangle from the substitution (for $x = a\sin\theta$: opposite $x$, hypotenuse $a$) to write the answer in $x$ again.`,
      R`Active Calculus also uses a short <b>table of integrals</b>: match your integral to a form, identify $a$, and apply it, often after a substitution.`
    ],
    formulas: [{ n: 'Half-angle identities', t: R`\cos^2\theta=\tfrac{1+\cos2\theta}{2},\qquad \sin^2\theta=\tfrac{1-\cos2\theta}{2}` }, { n: 'Arcsine', t: R`\int\frac{dx}{\sqrt{a^2-x^2}}=\arcsin\frac{x}{a}+C` }],
    example: { p: R`Evaluate $\displaystyle\int_0^a\sqrt{a^2-x^2}\,dx$.`, s: R`Let $x = a\sin\theta$, $dx = a\cos\theta\,d\theta$; $x=0\to\theta=0$ and $x=a\to\theta=\frac\pi2$. The integral is $\int_0^{\pi/2} a^2\cos^2\theta\,d\theta = a^2\left[\frac\theta2+\frac{\sin2\theta}{4}\right]_0^{\pi/2} = \frac{\pi a^2}{4}$, the area of a quarter circle of radius $a$.` },
    pitfalls: [R`Forgetting to convert $dx$ into $d\theta$.`, R`Leaving the answer in $\theta$ for an indefinite integral.`, R`Using trig substitution when a plain $u$-substitution works: $\int\frac{x}{\sqrt{1-x^2}}\,dx$ only needs $u = 1-x^2$.`],
    tip: R`Match the root to its identity: $1-\sin^2 = \cos^2$, $1+\tan^2 = \sec^2$, $\sec^2-1 = \tan^2$.` },

  { id: 'area', label: '6.1', title: 'Area between curves', unit: 1, link: AC + 'sec-6-1-area.html', linkLabel: 'Active Calculus 6.1',
    ideas: [
      R`For $f(x)\ge g(x)$ on $[a,b]$, the area between them is $A = \int_a^b \big(f(x)-g(x)\big)\,dx$: the integral of <b>top minus bottom</b>.`,
      R`The limits are usually the <b>intersection points</b>: solve $f(x) = g(x)$.`,
      R`If the curves cross inside the interval, split it at the crossing (or integrate $|f-g|$), so every piece is top minus bottom.`,
      R`When the curves are easier as functions of $y$, slice <b>horizontally</b>: $A = \int_c^d \big(x_{\text{right}}(y)-x_{\text{left}}(y)\big)\,dy$.`,
      R`Sketch first, and draw one representative slice. Its area, height times $\Delta x$, is what the integral adds up.`
    ],
    formulas: [{ n: 'Vertical slices', t: R`A=\int_a^b\big(f(x)-g(x)\big)\,dx` }, { n: 'Horizontal slices', t: R`A=\int_c^d\big(x_R(y)-x_L(y)\big)\,dy` }],
    example: { p: R`Find the area between $y = x$ and $y = x^2$.`, s: R`They meet where $x = x^2$, at $x = 0$ and $x = 1$. On $[0,1]$, $x\ge x^2$. So $A = \int_0^1 (x-x^2)\,dx = \tfrac12-\tfrac13 = \tfrac16$.` },
    pitfalls: [R`Bottom minus top, which gives a negative "area".`, R`Missing a crossing point inside the interval.`, R`Forcing $dx$ when the region is bounded by $x = $ curves; $dy$ is often one integral instead of two.`],
    tip: R`Test one point between the limits to see which curve is on top.` },

  { id: 'arclength', label: '6.1', title: 'Arc length', unit: 1, link: AC + 'sec-6-1-area.html', linkLabel: 'Active Calculus 6.1',
    ideas: [
      R`The length of $y = f(x)$ from $x=a$ to $x=b$ is $L = \int_a^b\sqrt{1+\big(f'(x)\big)^2}\,dx$.`,
      R`It comes from the Pythagorean theorem on a tiny piece: $\Delta L\approx\sqrt{\Delta x^2+\Delta y^2} = \sqrt{1+\left(\frac{\Delta y}{\Delta x}\right)^2}\,\Delta x$.`,
      R`Most arc length integrals cannot be done by hand. Exam problems either ask only for the setup or pick a curve where $1+(f')^2$ is a perfect square.`,
      R`For a curve $x = g(y)$, use $L = \int_c^d\sqrt{1+\big(g'(y)\big)^2}\,dy$.`
    ],
    formulas: [{ n: 'Arc length', t: R`L=\int_a^b\sqrt{1+\big(f'(x)\big)^2}\,dx` }],
    example: { p: R`Find the length of $y = \tfrac23x^{3/2}$ from $x = 0$ to $x = 3$.`, s: R`$f'(x) = x^{1/2}$, so $1+(f')^2 = 1+x$. Then $L = \int_0^3\sqrt{1+x}\,dx = \tfrac23(1+x)^{3/2}\Big|_0^3 = \tfrac23(8-1) = \tfrac{14}{3}$.` },
    pitfalls: [R`Forgetting to square $f'$, or forgetting the 1.`, R`"Simplifying" $\sqrt{1+x^2}$ to $1+x$.`],
    tip: R`If the problem says "set up", stop at the integral with correct limits; that is full credit.` },

  /* ---------- Unit 2: volume, mass, work, force and improper integrals ---------- */
  { id: 'washers', label: '6.2', title: 'Volume by disks and washers', unit: 2, link: AC + 'sec-6-2-volume.html', linkLabel: 'Active Calculus 6.2',
    ideas: [
      R`Revolve a region around an axis and slice <b>perpendicular to the axis</b>. Each slice is a disk of area $\pi R^2$ or a washer of area $\pi(R^2-r^2)$.`,
      R`About the $x$-axis with $dx$ slices: $V = \int_a^b\pi\big(R(x)^2-r(x)^2\big)\,dx$, where $R$ is the outer radius and $r$ the inner radius.`,
      R`Radii are <b>distances to the axis</b>. Around the line $y = k$, the radius of the curve $y = f(x)$ is $|f(x)-k|$.`,
      R`Around a vertical axis, washers use horizontal slices and $dy$, with the curves written as $x = $ functions of $y$.`,
      R`The same idea works for any known cross-section: $V = \int_a^b A(x)\,dx$, for example squares standing on a base region.`
    ],
    formulas: [{ n: 'Disk', t: R`V=\int_a^b\pi\,R(x)^2\,dx` }, { n: 'Washer', t: R`V=\int_a^b\pi\big(R(x)^2-r(x)^2\big)\,dx` }, { n: 'Known cross-sections', t: R`V=\int_a^b A(x)\,dx` }],
    example: { p: R`The region between $y = x$ and $y = x^2$ is revolved about the $x$-axis. Find the volume.`, s: R`On $[0,1]$ the outer radius is $R = x$ and the inner radius is $r = x^2$. $V = \pi\int_0^1\left(x^2-x^4\right)dx = \pi\left(\tfrac13-\tfrac15\right) = \tfrac{2\pi}{15}$.` },
    pitfalls: [R`Writing $\pi(R-r)^2$ instead of $\pi(R^2-r^2)$.`, R`Measuring radii from the $x$-axis when the axis is $y = k$.`, R`Slicing parallel to the axis while using the washer formula.`],
    tip: R`Draw the axis, one slice and both radii as arrows before writing anything.` },

  { id: 'shells', label: '6.2', title: 'Volume by cylindrical shells', unit: 2, link: AC + 'sec-6-2-volume.html', linkLabel: 'Active Calculus 6.2',
    ideas: [
      R`Slice <b>parallel to the axis</b>. Each thin strip sweeps out a cylindrical shell with volume about $2\pi\,(\text{radius})(\text{height})(\text{thickness})$.`,
      R`About the $y$-axis with $dx$ slices: $V = \int_a^b 2\pi x\,h(x)\,dx$, where $h(x)$ is top minus bottom.`,
      R`About the line $x = k$, the radius is $|x-k|$: for $x = -1$ it is $x+1$.`,
      R`Shells are the better choice when washers would need you to solve for $x$ in terms of $y$, or split into several integrals.`
    ],
    formulas: [{ n: 'Shells (vertical axis)', t: R`V=\int_a^b 2\pi\,(\text{radius})\,(\text{height})\,dx=\int_a^b 2\pi x\,h(x)\,dx` }],
    example: { p: R`The region under $y = x^2$ for $0\le x\le2$ is revolved about the $y$-axis. Find the volume.`, s: R`Shells: radius $x$, height $x^2$. $V = \int_0^2 2\pi x\cdot x^2\,dx = 2\pi\cdot\frac{x^4}{4}\Big|_0^2 = 8\pi$.` },
    pitfalls: [R`Forgetting the $2\pi$.`, R`Using $x$ as the radius when the axis is not the $y$-axis.`, R`Mixing up which method goes with which slice direction.`],
    tip: R`Washers: slice perpendicular to the axis. Shells: slice parallel. Pick whichever gives one integral in a convenient variable.` },

  { id: 'density', label: '6.3', title: 'Density, mass and center of mass', unit: 2, link: AC + 'sec-6-3-mass.html', linkLabel: 'Active Calculus 6.3',
    ideas: [
      R`For a rod with density $\rho(x)$ (mass per unit length), the mass is $M = \int_a^b\rho(x)\,dx$: density times length, added up over small pieces.`,
      R`For point masses, the center of mass is the weighted average $\bar x = \frac{\sum m_ix_i}{\sum m_i}$.`,
      R`For a rod, $\bar x = \frac{\int_a^b x\,\rho(x)\,dx}{\int_a^b\rho(x)\,dx}$: the moment divided by the mass.`,
      R`Other densities work the same way: people per mile along a road, or mass per area of a plate. For a density $\rho(r)$ depending on distance from a center, rings give $M = \int_0^R\rho(r)\,2\pi r\,dr$.`,
      R`For a flat plate of uniform density between $y = f(x)$ and $y = g(x)$, the centroid is $\bar x = \frac1A\int_a^b x\,(f-g)\,dx$ and $\bar y = \frac1A\int_a^b\tfrac12\left(f^2-g^2\right)dx$.`
    ],
    formulas: [{ n: 'Mass', t: R`M=\int_a^b\rho(x)\,dx` }, { n: 'Center of mass of a rod', t: R`\bar x=\frac{\int_a^b x\,\rho(x)\,dx}{\int_a^b\rho(x)\,dx}` }, { n: 'Point masses', t: R`\bar x=\frac{\sum m_ix_i}{\sum m_i}` }],
    example: { p: R`A rod on $0\le x\le4$ m has density $\rho(x) = 1+x$ kg/m. Find its mass and center of mass.`, s: R`$M = \int_0^4(1+x)\,dx = 4+8 = 12$ kg. Moment: $\int_0^4 x(1+x)\,dx = 8+\tfrac{64}{3} = \tfrac{88}{3}$. So $\bar x = \frac{88/3}{12} = \frac{22}{9}\approx2.44$ m, right of the midpoint, where the rod is heavier.` },
    pitfalls: [R`Dividing the moment by the length instead of the mass.`, R`Forgetting the factor $x$ in the moment.`, R`Not checking that the center of mass lies inside the object and leans toward the heavy end.`],
    tip: R`Sanity check: uniform density puts the center of mass at the midpoint.` },

  { id: 'work', label: '6.4', title: 'Work', unit: 2, link: AC + 'sec-6-4-physics.html', linkLabel: 'Active Calculus 6.4',
    ideas: [
      R`Work is force times distance when the force is constant. When it varies, $W = \int_a^b F(x)\,dx$.`,
      R`<b>Springs</b> (Hooke's law): $F = kx$, where $x$ is the stretch beyond natural length. Find $k$ from one given force and stretch, then $W = \int_a^b kx\,dx$.`,
      R`<b>Pumping liquid:</b> slice the liquid horizontally. Each slice's work is its weight times the distance it is lifted: $W = \int(\text{weight density})\cdot A(y)\cdot(\text{distance lifted})\,dy$.`,
      R`Water weighs $62.4$ lb/ft³. In SI units, use density $1000$ kg/m³ times $g = 9.8$ m/s² to get weight.`,
      R`<b>Ropes and chains:</b> a piece at depth $y$ is lifted $y$, so a hanging rope of length $L$ and weight $w$ per unit length takes $\int_0^L wy\,dy = \frac{wL^2}{2}$.`
    ],
    formulas: [{ n: 'Work', t: R`W=\int_a^b F(x)\,dx` }, { n: 'Hooke\'s law', t: R`F=kx,\qquad W=\int_a^b kx\,dx=\tfrac k2\left(b^2-a^2\right)` }, { n: 'Pumping', t: R`W=\int_c^d \delta\,A(y)\,D(y)\,dy` }],
    example: { p: R`A force of 10 N stretches a spring 0.2 m beyond its natural length. How much work stretches it from 0.2 m to 0.5 m beyond natural length?`, s: R`$k = 10/0.2 = 50$ N/m. $W = \int_{0.2}^{0.5}50x\,dx = 25\left(0.5^2-0.2^2\right) = 25(0.21) = 5.25$ J.` },
    pitfalls: [R`Measuring spring stretch from the wrong point: $x$ is always from natural length.`, R`Using mass instead of weight in SI (multiply by $g$).`, R`Using the depth of the slice instead of the distance it is lifted (to the top or above it).`],
    tip: R`Write the slice's three ingredients in words first: how much it weighs, how far it goes, and the thickness $dy$.` },

  { id: 'fluid', label: '6.4', title: 'Fluid force', unit: 2, link: AC + 'sec-6-4-physics.html', linkLabel: 'Active Calculus 6.4',
    ideas: [
      R`Pressure at depth $d$ is weight density times depth: $P = \delta d$. For water, $62.4\,d$ lb/ft². It pushes equally in all directions.`,
      R`On a vertical plate the depth changes, so slice <b>horizontally</b>. A strip at depth $y$ with width $w(y)$ feels force $\delta\,y\,w(y)\,dy$.`,
      R`Total force: $F = \int_a^b\delta\,y\,w(y)\,dy$, with $y$ measured <b>down</b> from the surface so that depth $= y$.`,
      R`For non-rectangular plates, find the width at depth $y$ from similar triangles or the plate's equation.`
    ],
    formulas: [{ n: 'Pressure', t: R`P=\delta\,d\qquad(\delta=62.4\ \text{lb/ft}^3\ \text{for water})` }, { n: 'Fluid force', t: R`F=\int_a^b\delta\cdot y\cdot w(y)\,dy` }],
    example: { p: R`A rectangular plate 3 ft wide and 2 ft tall stands vertically in water with its top edge at the surface. Find the force on one side.`, s: R`At depth $y$ the width is 3. $F = \int_0^2 62.4\,y\cdot3\,dy = 62.4\cdot3\cdot\frac{y^2}{2}\Big|_0^2 = 374.4$ lb.` },
    pitfalls: [R`Using the height above the bottom instead of the depth below the surface.`, R`Getting a triangle's width backwards (widest at the top versus at the bottom).`, R`Forgetting the weight density.`],
    tip: R`Put $y = 0$ at the surface and point $y$ downward. Then depth is just $y$.` },

  { id: 'improper', label: '6.5', title: 'Improper integrals', unit: 2, link: AC + 'sec-6-5-improper.html', linkLabel: 'Active Calculus 6.5',
    ideas: [
      R`An integral is improper when a limit is infinite or the integrand blows up inside $[a,b]$. Define it as a limit: $\int_a^\infty f\,dx = \lim_{b\to\infty}\int_a^b f\,dx$.`,
      R`It <b>converges</b> if the limit is a finite number and <b>diverges</b> otherwise.`,
      R`$p$-integrals: $\int_1^\infty\frac{dx}{x^p}$ converges exactly when $p\gt1$ (to $\frac{1}{p-1}$). $\int_0^1\frac{dx}{x^p}$ converges exactly when $p\lt1$ (to $\frac{1}{1-p}$).`,
      R`Exponentials: $\int_0^\infty e^{-kx}\,dx = \frac1k$ for $k\gt0$.`,
      R`<b>Comparison:</b> if $0\le f\le g$ and $\int g$ converges, so does $\int f$. If $\int f$ diverges, so does $\int g$.`,
      R`With two trouble spots, such as $\int_{-\infty}^{\infty}$, split the integral; every piece must converge.`
    ],
    formulas: [{ n: 'Infinite limit', t: R`\int_a^\infty f(x)\,dx=\lim_{b\to\infty}\int_a^b f(x)\,dx` }, { n: 'p-integral', t: R`\int_1^\infty\frac{dx}{x^p}=\frac{1}{p-1}\ (p\gt1),\ \text{diverges for } p\le1` }, { n: 'Exponential', t: R`\int_0^\infty e^{-kx}\,dx=\frac1k\quad(k\gt0)` }],
    example: { p: R`Decide whether $\displaystyle\int_1^\infty\frac{dx}{x^2}$ and $\displaystyle\int_1^\infty\frac{dx}{x}$ converge.`, s: R`$\int_1^b x^{-2}\,dx = 1-\frac1b\to1$, so the first converges to 1. $\int_1^b\frac{dx}{x} = \ln b\to\infty$, so the second diverges.` },
    pitfalls: [R`Missing an asymptote inside the interval: $\int_{-1}^1\frac{dx}{x^2}$ diverges, though careless work gives $-2$.`, R`Treating $\infty$ like a number instead of writing the limit.`, R`Claiming $\int_{-\infty}^\infty x\,dx = 0$ by symmetry; it diverges.`],
    tip: R`Write $\lim_{b\to\infty}$ in your work every time. Leaving it out costs notation points.` },

  /* ---------- Unit 3: differential equations ---------- */
  { id: 'odes', label: '7.1', title: 'Introduction to differential equations', unit: 3, link: AC + 'C-7.html', linkLabel: 'Active Calculus chapter 7',
    ideas: [
      R`A <b>differential equation</b> relates an unknown function to its derivatives, such as $\frac{dy}{dt} = ky$.`,
      R`Its <b>order</b> is the highest derivative that appears: $y'' + y = 0$ is second order.`,
      R`A <b>solution</b> is a function that makes the equation true. To check one, substitute it and its derivatives.`,
      R`The general solution has arbitrary constants. An <b>initial condition</b> $y(t_0) = y_0$ picks one particular solution: an initial value problem.`,
      R`Common models: growth and decay $y' = ky$, Newton's law of cooling $T' = -k(T-A)$, and falling objects with air resistance.`
    ],
    formulas: [{ n: 'Exponential model', t: R`\frac{dy}{dt}=ky\ \Rightarrow\ y=y_0e^{kt}` }],
    example: { p: R`Show that $y = 3e^{2t}$ solves $y' = 2y$, $y(0) = 3$.`, s: R`$y' = 6e^{2t} = 2\left(3e^{2t}\right) = 2y$, and $y(0) = 3e^0 = 3$. Both conditions hold.` },
    pitfalls: [R`Confusing order (highest derivative) with the power on $y$.`, R`Checking the equation but not the initial condition.`],
    tip: R`"Verify" means substitute and simplify both sides; you do not need to solve.` },

  { id: 'qualitative', label: '7.2', title: 'Slope fields and equilibrium solutions', unit: 3, link: 'https://activecalculus.org/single-alt/sec-7-2-qualitative.html', linkLabel: 'Active Calculus 7.2',
    ideas: [
      R`A <b>slope field</b> draws a short segment with slope $f(t,y)$ at many points. Solution curves follow the segments.`,
      R`In an <b>autonomous</b> equation $\frac{dy}{dt} = f(y)$ the slope depends only on $y$, so each horizontal row of segments looks the same.`,
      R`<b>Equilibrium solutions</b> are constant solutions $y = c$ with $f(c) = 0$: horizontal lines in the slope field.`,
      R`An equilibrium is <b>stable</b> if nearby solutions move toward it, <b>unstable</b> if they move away, and semi-stable if it attracts on one side only.`,
      R`Decide by the sign of $f(y)$ on each side: where $f\gt0$ solutions rise, and where $f\lt0$ they fall.`
    ],
    formulas: [{ n: 'Equilibria', t: R`\frac{dy}{dt}=f(y):\quad f(c)=0\ \Rightarrow\ y=c\ \text{is an equilibrium}` }],
    example: { p: R`Find and classify the equilibria of $\frac{dy}{dt} = y(3-y)$.`, s: R`$y(3-y) = 0$ at $y = 0$ and $y = 3$. For $0\lt y\lt3$ the right side is positive (solutions rise); for $y\gt3$ and $y\lt0$ it is negative (solutions fall). So $y = 3$ is stable and $y = 0$ is unstable.` },
    pitfalls: [R`Classifying by the size of $f$ instead of its sign.`, R`Thinking an equilibrium is a point; it is a whole horizontal line.`],
    tip: R`Draw a phase line: a vertical $y$-axis with arrows up where $f\gt0$ and down where $f\lt0$.` },

  { id: 'euler', label: '7.3', title: 'Euler’s method', unit: 3, link: AC + 'sec-7-3-euler.html', linkLabel: 'Active Calculus 7.3',
    ideas: [
      R`Euler's method follows tangent lines to approximate a solution of $\frac{dy}{dt} = f(t,y)$, $y(t_0) = y_0$.`,
      R`Each step: $y_{k+1} = y_k+\Delta t\cdot f(t_k,y_k)$ and $t_{k+1} = t_k+\Delta t$.`,
      R`Keep a table with columns $t$, $y$, slope $f(t,y)$ and $\Delta y = \Delta t\cdot$slope.`,
      R`Halving $\Delta t$ roughly halves the error: Euler's method is first order.`,
      R`If the true solution is concave up, the tangent lines lie below it and Euler <b>underestimates</b>; concave down, it overestimates.`
    ],
    formulas: [{ n: 'Euler step', t: R`y_{k+1}=y_k+\Delta t\,f(t_k,y_k),\qquad t_{k+1}=t_k+\Delta t` }],
    example: { p: R`Use two steps of Euler's method with $\Delta t = 0.5$ for $\frac{dy}{dt} = t+y$, $y(0) = 1$, to estimate $y(1)$.`, s: R`At $(0,1)$ the slope is 1, so $y(0.5)\approx1+0.5\cdot1 = 1.5$. At $(0.5,1.5)$ the slope is 2, so $y(1)\approx1.5+0.5\cdot2 = 2.5$. (The exact value is $2e-2\approx3.44$: the solution is concave up, so Euler underestimates.)` },
    pitfalls: [R`Using the new $t$ with the old $y$ when computing a slope.`, R`Forgetting to multiply the slope by $\Delta t$.`],
    tip: R`Count steps: from $t_0$ to $T$ takes $(T-t_0)/\Delta t$ of them.` },

  { id: 'separable', label: '7.4', title: 'Separable differential equations', unit: 3, link: 'https://activecalculus.org/single2e/sec-7-4-separable.html', linkLabel: 'Active Calculus 7.4',
    ideas: [
      R`A separable equation has the form $\frac{dy}{dt} = g(t)\,h(y)$.`,
      R`Separate and integrate: $\int\frac{dy}{h(y)} = \int g(t)\,dt$, add one constant, then solve for $y$ if you can.`,
      R`$\frac{dy}{dt} = ky$ gives $y = Ce^{kt}$, with $C = y(0)$.`,
      R`Newton's law of cooling, $\frac{dT}{dt} = -k(T-A)$, gives $T = A+(T_0-A)e^{-kt}$.`,
      R`Dividing by $h(y)$ can lose equilibrium solutions where $h(y) = 0$; check them separately.`
    ],
    formulas: [{ n: 'Separate', t: R`\frac{dy}{dt}=g(t)h(y)\ \Rightarrow\ \int\frac{dy}{h(y)}=\int g(t)\,dt` }, { n: 'Newton\'s law of cooling', t: R`T(t)=A+(T_0-A)e^{-kt}` }],
    example: { p: R`Solve $\frac{dy}{dx} = xy$, $y(0) = 2$.`, s: R`$\frac{dy}{y} = x\,dx$, so $\ln|y| = \frac{x^2}{2}+C$ and $y = Ke^{x^2/2}$. From $y(0) = 2$, $K = 2$: $y = 2e^{x^2/2}$.` },
    pitfalls: [R`Going from $\ln|y| = \frac{x^2}{2}+C$ to $y = e^{x^2/2}+C$; the constant becomes a factor.`, R`Trying to separate $\frac{dy}{dt} = t+y$, which is not separable.`, R`Applying the initial condition before solving for $y$ and then mishandling the constant.`],
    tip: R`Check your answer by substituting it back into the equation and the initial condition.` },

  /* ---------- Unit 4: sequences and series ---------- */
  { id: 'sequences', label: '8.1', title: 'Sequences', unit: 4, link: AC1 + 'sec-8-1-sequences.html', linkLabel: 'Active Calculus 8.1 (first edition)',
    ideas: [
      R`A <b>sequence</b> $\{a_n\}$ is an infinite list $a_1, a_2, a_3,\ldots$. It <b>converges</b> to $L$ if $a_n$ gets as close to $L$ as we like for all large $n$.`,
      R`If $a_n = f(n)$ and $\lim_{x\to\infty}f(x) = L$, then $a_n\to L$, so function tools such as L'Hôpital's rule apply to $f(x)$.`,
      R`Useful limits: for rational expressions, compare leading terms; $\left(1+\frac kn\right)^n\to e^k$; $r^n\to0$ when $|r|\lt1$.`,
      R`Squeeze: since $-\frac1n\le\frac{\sin n}{n}\le\frac1n$, $\frac{\sin n}{n}\to0$.`,
      R`Growth order for large $n$: $\ln n\ll n^p\ll b^n\ll n!\ll n^n$.`,
      R`$(-1)^n$ bounces between $-1$ and $1$, so it diverges.`
    ],
    formulas: [{ n: 'Exponential limit', t: R`\lim_{n\to\infty}\left(1+\frac{k}{n}\right)^n=e^k` }, { n: 'Geometric sequence', t: R`\lim_{n\to\infty}r^n=0\ \text{if}\ |r|\lt1` }],
    example: { p: R`Find $\displaystyle\lim_{n\to\infty}\frac{3n^2+1}{5n^2-n}$.`, s: R`Divide top and bottom by $n^2$: $\frac{3+1/n^2}{5-1/n}\to\frac35$.` },
    pitfalls: [R`Mixing up a sequence converging with the series of its terms converging.`, R`Using L'Hôpital on $n$ directly; switch to $x$ first.`],
    tip: R`Write the first five terms. The pattern usually tells you what the limit is.` },

  { id: 'geometric', label: '8.2', title: 'Geometric series', unit: 4, link: AC1 + 'sec-8-2-geometric.html', linkLabel: 'Active Calculus 8.2 (first edition)',
    ideas: [
      R`A <b>geometric series</b> multiplies by the same ratio $r$ each time: $\sum_{k=0}^\infty ar^k = a+ar+ar^2+\cdots$.`,
      R`It converges to $\frac{a}{1-r}$ when $|r|\lt1$, and diverges when $|r|\ge1$.`,
      R`Partial sums: $S_n = a+ar+\cdots+ar^{n-1} = a\,\frac{1-r^n}{1-r}$.`,
      R`$a$ is the <b>first term</b>, whatever index the sum starts at; $r$ is any term divided by the one before it.`,
      R`Uses: repeating decimals ($0.\overline{3} = \frac{3}{10}+\frac{3}{100}+\cdots$), bouncing balls, and steady-state drug levels.`
    ],
    formulas: [{ n: 'Geometric series', t: R`\sum_{k=0}^{\infty}ar^k=\frac{a}{1-r}\quad(|r|\lt1)` }, { n: 'Partial sum', t: R`S_n=\sum_{k=0}^{n-1}ar^k=a\,\frac{1-r^n}{1-r}` }],
    example: { p: R`Find $\displaystyle\sum_{k=1}^\infty5\left(\tfrac13\right)^k$.`, s: R`The first term ($k=1$) is $\frac53$ and $r = \frac13$. The sum is $\frac{5/3}{1-1/3} = \frac{5/3}{2/3} = \frac52$.` },
    pitfalls: [R`Using $a = 5$ when the sum starts at $k = 1$.`, R`Applying $\frac{a}{1-r}$ when $|r|\ge1$.`, R`Dropping the sign of a negative ratio.`],
    tip: R`Write out the first two terms: $a$ is the first, and $r$ is the second divided by the first.` },

  { id: 'series', label: '8.3', title: 'Series of real numbers and convergence tests', unit: 4, link: AC1 + 'sec-8-3-series.html', linkLabel: 'Active Calculus 8.3 (first edition)',
    ideas: [
      R`A series $\sum a_k$ <b>converges</b> when its sequence of partial sums $S_n = a_1+\cdots+a_n$ converges.`,
      R`<b>Divergence test:</b> if $\lim a_k\ne0$ (or does not exist), the series diverges. If the limit is 0, the test says nothing: the harmonic series $\sum\frac1k$ diverges.`,
      R`<b>Integral test:</b> if $f$ is positive, continuous and decreasing with $f(k) = a_k$, then $\sum a_k$ and $\int_1^\infty f(x)\,dx$ both converge or both diverge.`,
      R`<b>$p$-series:</b> $\sum\frac{1}{k^p}$ converges exactly when $p\gt1$.`,
      R`<b>Comparison and limit comparison:</b> compare with a $p$-series or geometric series. If $\lim\frac{a_k}{b_k} = c$ with $0\lt c\lt\infty$, both series do the same thing.`,
      R`<b>Ratio test:</b> $L = \lim\left|\frac{a_{k+1}}{a_k}\right|$. If $L\lt1$ the series converges, if $L\gt1$ it diverges, and $L = 1$ decides nothing. It suits factorials and exponentials. The root test uses $\lim|a_k|^{1/k}$ the same way.`
    ],
    formulas: [{ n: 'Divergence test', t: R`\lim_{k\to\infty}a_k\ne0\ \Rightarrow\ \sum a_k\ \text{diverges}` }, { n: 'p-series', t: R`\sum_{k=1}^{\infty}\frac{1}{k^p}\ \text{converges}\iff p\gt1` }, { n: 'Ratio test', t: R`L=\lim_{k\to\infty}\left|\frac{a_{k+1}}{a_k}\right|:\ L\lt1\ \text{converges},\ L\gt1\ \text{diverges}` }],
    example: { p: R`Does $\displaystyle\sum_{k=1}^\infty\frac{k}{3^k}$ converge?`, s: R`Ratio test: $\frac{a_{k+1}}{a_k} = \frac{k+1}{3^{k+1}}\cdot\frac{3^k}{k} = \frac{k+1}{3k}\to\frac13\lt1$, so it converges.` },
    pitfalls: [R`"The terms go to 0, so it converges." That is false; it only means the divergence test fails.`, R`Treating $L = 1$ in the ratio test as an answer.`, R`Comparing in the wrong direction: being smaller than a divergent series proves nothing.`],
    tip: R`Run the divergence test first. It takes one line and ends many problems.` },

  /* ---------- Unit 5: alternating, Taylor, power and Fourier series ---------- */
  { id: 'ast', label: '8.4', title: 'Alternating series', unit: 5, link: AC1 + 'sec-8-4-alternating.html', linkLabel: 'Active Calculus 8.4 (first edition)',
    ideas: [
      R`An alternating series has terms of alternating sign: $\sum(-1)^kb_k$ with $b_k\gt0$.`,
      R`<b>Alternating series test:</b> if $b_k$ decreases and $b_k\to0$, the series converges.`,
      R`<b>Error bound:</b> stopping after $n$ terms is off by at most the next term, $|S-S_n|\le b_{n+1}$.`,
      R`$\sum a_k$ <b>converges absolutely</b> if $\sum|a_k|$ converges, and then it converges. It <b>converges conditionally</b> if it converges but $\sum|a_k|$ does not, like the alternating harmonic series $\sum\frac{(-1)^{k+1}}{k} = \ln2$.`,
      R`A strategy for any series: divergence test; recognize geometric or $p$-series; compare algebraic terms; ratio test for factorials and exponentials; the alternating series test for alternating signs.`
    ],
    formulas: [{ n: 'Alternating series test', t: R`b_k\downarrow0\ \Rightarrow\ \sum(-1)^kb_k\ \text{converges}` }, { n: 'Error bound', t: R`|S-S_n|\le b_{n+1}` }],
    example: { p: R`How many terms of $\displaystyle\sum_{k=1}^\infty\frac{(-1)^{k+1}}{k^2}$ guarantee an error below 0.001?`, s: R`We need $b_{n+1} = \frac{1}{(n+1)^2}\lt0.001$, so $(n+1)^2\gt1000$ and $n+1\ge32$. Thirty-one terms suffice.` },
    pitfalls: [R`Using the alternating series test to prove divergence; it cannot.`, R`Skipping the check that $b_k$ is decreasing.`, R`Calling a series absolutely convergent without testing $\sum|a_k|$.`],
    tip: R`Test $\sum|a_k|$ first. If it converges, you are done (absolutely); if not, try the alternating series test.` },

  { id: 'taylor', label: '8.5', title: 'Taylor polynomials and Taylor series', unit: 5, link: AC1 + 'sec-8-5-taylor.html', linkLabel: 'Active Calculus 8.5 (first edition)',
    ideas: [
      R`The degree-$n$ <b>Taylor polynomial</b> of $f$ at $a$ is $P_n(x) = \sum_{k=0}^n\frac{f^{(k)}(a)}{k!}(x-a)^k$. It matches $f$ and its first $n$ derivatives at $a$.`,
      R`The <b>Taylor series</b> lets $n\to\infty$. Centered at $a = 0$ it is called a Maclaurin series.`,
      R`Know these by heart: $e^x = \sum\frac{x^k}{k!}$, $\sin x = \sum\frac{(-1)^kx^{2k+1}}{(2k+1)!}$, $\cos x = \sum\frac{(-1)^kx^{2k}}{(2k)!}$, and $\frac{1}{1-x} = \sum x^k$ for $|x|\lt1$.`,
      R`The coefficient of $(x-a)^k$ is $c_k = \frac{f^{(k)}(a)}{k!}$, so a series tells you derivatives: $f^{(k)}(a) = k!\,c_k$.`,
      R`<b>Error:</b> $|f(x)-P_n(x)|\le\frac{M}{(n+1)!}|x-a|^{n+1}$, where $M$ bounds $|f^{(n+1)}|$ between $a$ and $x$. For an alternating series, the next term bounds the error.`
    ],
    formulas: [{ n: 'Taylor polynomial', t: R`P_n(x)=\sum_{k=0}^{n}\frac{f^{(k)}(a)}{k!}(x-a)^k` }, { n: 'Lagrange error bound', t: R`|f(x)-P_n(x)|\le\frac{M}{(n+1)!}|x-a|^{n+1}` }],
    example: { p: R`Use the degree-3 Maclaurin polynomial of $\sin x$ to estimate $\sin(0.1)$.`, s: R`$P_3(x) = x-\frac{x^3}{6}$, so $\sin(0.1)\approx0.1-\frac{0.001}{6}\approx0.0998333$. The next term, $\frac{0.1^5}{120}\approx8\times10^{-8}$, bounds the error.` },
    pitfalls: [R`Forgetting the $k!$ in the denominator.`, R`Centering at $a$ but writing powers of $x$ instead of $(x-a)$.`, R`Getting the alternating signs of $\sin$ and $\cos$ wrong.`],
    tip: R`Build new series from known ones (substitute, multiply, differentiate) instead of computing derivatives from scratch.` },

  { id: 'power', label: '8.6', title: 'Power series', unit: 5, link: AC1 + 'sec-8-6-powerseries.html', linkLabel: 'Active Calculus 8.6 (first edition)',
    ideas: [
      R`A <b>power series</b> $\sum c_k(x-a)^k$ converges on an interval centered at $a$, with a <b>radius of convergence</b> $R$ (which can be 0 or $\infty$).`,
      R`Find $R$ with the ratio test: require $\lim\left|\frac{c_{k+1}(x-a)^{k+1}}{c_k(x-a)^k}\right|\lt1$.`,
      R`The ratio test says nothing at the <b>endpoints</b> $x = a\pm R$. Test each one separately.`,
      R`Inside the interval you can differentiate and integrate term by term; the radius stays the same.`,
      R`New series from old: $\frac{1}{(1-x)^2} = \sum kx^{k-1}$ by differentiating $\frac{1}{1-x}$; $-\ln(1-x) = \sum\frac{x^k}{k}$ by integrating; $e^{-x^2}$ by substituting $-x^2$ into $e^x$.`
    ],
    formulas: [{ n: 'Power series', t: R`\sum_{k=0}^{\infty}c_k(x-a)^k,\qquad |x-a|\lt R` }, { n: 'Geometric power series', t: R`\frac{1}{1-x}=\sum_{k=0}^{\infty}x^k\quad(|x|\lt1)` }],
    example: { p: R`Find the interval of convergence of $\displaystyle\sum_{k=1}^\infty\frac{x^k}{k\,2^k}$.`, s: R`Ratio: $\left|\frac{x^{k+1}}{(k+1)2^{k+1}}\cdot\frac{k\,2^k}{x^k}\right| = \frac{k}{k+1}\cdot\frac{|x|}{2}\to\frac{|x|}{2}$, so $R = 2$. At $x = 2$ it is $\sum\frac1k$, which diverges; at $x = -2$ it is $\sum\frac{(-1)^k}{k}$, which converges. Interval: $[-2,2)$.` },
    pitfalls: [R`Forgetting to test the endpoints.`, R`Giving the radius when the interval was asked, or the other way round.`, R`Getting the center wrong for $(x-a)^k$.`],
    tip: R`Radius from the ratio test, then two separate endpoint checks: always three steps.` },

  { id: 'eulerformula', label: 'Euler', title: 'Euler’s formula and complex exponentials', unit: 5, link: 'https://en.wikipedia.org/wiki/Euler%27s_formula', linkLabel: 'Euler’s formula (the textbook does not cover it; follow your class notes)',
    ideas: [
      R`This topic is beyond Active Calculus; your instructor's notes and lab decide the details. A complex number is $z = a+bi$ with $i^2 = -1$, plotted as the point $(a,b)$, with modulus $|z| = \sqrt{a^2+b^2}$.`,
      R`Substitute $x = i\theta$ into $e^x = \sum\frac{x^k}{k!}$ and group the real and imaginary terms. They are exactly the series for $\cos\theta$ and $\sin\theta$: <b>Euler's formula</b> $e^{i\theta} = \cos\theta+i\sin\theta$.`,
      R`$|e^{i\theta}| = 1$, so $e^{i\theta}$ is the point on the unit circle at angle $\theta$. At $\theta = \pi$: $e^{i\pi} = -1$, Euler's identity $e^{i\pi}+1 = 0$.`,
      R`Cosine and sine in exponentials: $\cos\theta = \frac{e^{i\theta}+e^{-i\theta}}{2}$ and $\sin\theta = \frac{e^{i\theta}-e^{-i\theta}}{2i}$.`,
      R`Polar form $z = re^{i\theta}$ makes multiplication easy: multiply the moduli and add the angles. De Moivre: $(\cos\theta+i\sin\theta)^n = \cos n\theta+i\sin n\theta$.`
    ],
    formulas: [{ n: 'Euler\'s formula', t: R`e^{i\theta}=\cos\theta+i\sin\theta` }, { n: 'De Moivre', t: R`\left(\cos\theta+i\sin\theta\right)^n=\cos n\theta+i\sin n\theta` }],
    example: { p: R`Write $e^{i\pi/3}$ in the form $a+bi$, and find $\left(e^{i\pi/3}\right)^3$.`, s: R`$e^{i\pi/3} = \cos\frac\pi3+i\sin\frac\pi3 = \frac12+\frac{\sqrt3}{2}i$. Cubing adds the angle three times: $e^{i\pi} = -1$.` },
    pitfalls: [R`Using degrees instead of radians.`, R`Sign slips with powers of $i$: $i^2 = -1$, $i^3 = -i$, $i^4 = 1$.`],
    tip: R`Picture $e^{i\theta}$ on the unit circle; most answers can be read off it.` },

  { id: 'fourier', label: 'Fourier', title: 'Fourier series', unit: 5, link: 'https://tutorial.math.lamar.edu/Classes/DE/FourierSeries.aspx', linkLabel: 'Fourier series (Paul’s notes; the textbook does not cover it)',
    ideas: [
      R`This topic is beyond Active Calculus; follow your instructor's conventions. A <b>Fourier series</b> writes a $2\pi$-periodic function as a sum of sines and cosines: $f(x)\sim\frac{a_0}{2}+\sum_{n=1}^\infty\left(a_n\cos nx+b_n\sin nx\right)$.`,
      R`The coefficients are averages against each wave: $a_n = \frac1\pi\int_{-\pi}^{\pi}f(x)\cos nx\,dx$ and $b_n = \frac1\pi\int_{-\pi}^{\pi}f(x)\sin nx\,dx$.`,
      R`They work because of <b>orthogonality</b>: over $[-\pi,\pi]$ the integral of $\sin mx\cos nx$ is 0, and $\sin mx\sin nx$ (or $\cos mx\cos nx$) integrates to 0 when $m\ne n$ and to $\pi$ when $m = n\ge1$.`,
      R`Symmetry saves work: an <b>odd</b> function has only sine terms ($a_n = 0$), and an <b>even</b> function only cosine terms ($b_n = 0$).`,
      R`At a jump, the series converges to the <b>average</b> of the left and right limits. Near a jump, partial sums overshoot (the Gibbs phenomenon).`,
      R`Conventions differ: some books write $a_0$ instead of $\frac{a_0}{2}$, or use an interval $[-L,L]$ with $\cos\frac{n\pi x}{L}$. Use your class's.`
    ],
    formulas: [{ n: 'Fourier series', t: R`f(x)\sim\frac{a_0}{2}+\sum_{n=1}^{\infty}\left(a_n\cos nx+b_n\sin nx\right)` }, { n: 'Coefficients', t: R`a_n=\frac1\pi\int_{-\pi}^{\pi}f(x)\cos nx\,dx,\qquad b_n=\frac1\pi\int_{-\pi}^{\pi}f(x)\sin nx\,dx` }],
    example: { p: R`Find the Fourier series of the square wave $f(x) = -1$ on $(-\pi,0)$ and $1$ on $(0,\pi)$.`, s: R`$f$ is odd, so $a_n = 0$. $b_n = \frac2\pi\int_0^\pi\sin nx\,dx = \frac{2}{n\pi}(1-\cos n\pi)$, which is $\frac{4}{n\pi}$ for odd $n$ and 0 for even $n$. So $f(x)\sim\frac4\pi\left(\sin x+\frac{\sin3x}{3}+\frac{\sin5x}{5}+\cdots\right)$.` },
    pitfalls: [R`Mixing conventions for $a_0$.`, R`Forgetting that $\cos n\pi = (-1)^n$.`, R`Integrating over $[0,\pi]$ without doubling, or doubling when the integrand is odd.`],
    tip: R`Check the symmetry of $f$ before integrating; it often kills half the coefficients.` }
];

const FORMULAS = [
  { group: 'Integrals to know', items: [
    { n: 'Power rule', t: R`\int x^n\,dx=\frac{x^{n+1}}{n+1}+C\quad(n\ne-1)` },
    { n: 'Reciprocal', t: R`\int\frac{dx}{x}=\ln|x|+C` },
    { n: 'Exponentials', t: R`\int e^{kx}\,dx=\frac{e^{kx}}{k}+C,\qquad\int a^x\,dx=\frac{a^x}{\ln a}+C` },
    { n: 'Sine and cosine', t: R`\int\sin x\,dx=-\cos x+C,\qquad\int\cos x\,dx=\sin x+C` },
    { n: 'Secant squared', t: R`\int\sec^2x\,dx=\tan x+C,\qquad\int\sec x\tan x\,dx=\sec x+C` },
    { n: 'Tangent and secant', t: R`\int\tan x\,dx=\ln|\sec x|+C,\qquad\int\sec x\,dx=\ln|\sec x+\tan x|+C` },
    { n: 'Arctangent and arcsine', t: R`\int\frac{dx}{x^2+a^2}=\frac1a\arctan\frac xa+C,\qquad\int\frac{dx}{\sqrt{a^2-x^2}}=\arcsin\frac xa+C` }
  ] },
  { group: 'Techniques', items: [
    { n: 'Substitution', t: R`\int f(g(x))g'(x)\,dx=\int f(u)\,du` },
    { n: 'Integration by parts', t: R`\int u\,dv=uv-\int v\,du` },
    { n: 'LIATE (choosing u)', d: 'Logarithms, inverse trig, algebraic, trig, exponentials: the earlier in the list, the better a choice for u.' },
    { n: 'Partial fractions', t: R`\frac{1}{(x-a)(x-b)}=\frac{A}{x-a}+\frac{B}{x-b}` },
    { n: 'Trig substitution', d: R`$\sqrt{a^2-x^2}$: $x=a\sin\theta$. $\sqrt{a^2+x^2}$: $x=a\tan\theta$. $\sqrt{x^2-a^2}$: $x=a\sec\theta$.` },
    { n: 'Half-angle identities', t: R`\cos^2\theta=\tfrac{1+\cos2\theta}{2},\qquad\sin^2\theta=\tfrac{1-\cos2\theta}{2}` }
  ] },
  { group: 'Applications', items: [
    { n: 'Area between curves', t: R`A=\int_a^b\big(f(x)-g(x)\big)\,dx` },
    { n: 'Arc length', t: R`L=\int_a^b\sqrt{1+\big(f'(x)\big)^2}\,dx` },
    { n: 'Washers', t: R`V=\int_a^b\pi\big(R^2-r^2\big)\,dx` },
    { n: 'Shells', t: R`V=\int_a^b2\pi\,(\text{radius})(\text{height})\,dx` },
    { n: 'Mass', t: R`M=\int_a^b\rho(x)\,dx` },
    { n: 'Center of mass', t: R`\bar x=\frac{\int_a^b x\rho(x)\,dx}{\int_a^b\rho(x)\,dx}` },
    { n: 'Work', t: R`W=\int_a^b F(x)\,dx` },
    { n: 'Hooke\'s law', t: R`F=kx` },
    { n: 'Fluid force', t: R`F=\int_a^b\delta\,y\,w(y)\,dy` },
    { n: 'Water', d: 'Weight density 62.4 lb/ft³; in SI, 1000 kg/m³ times g = 9.8 m/s².' }
  ] },
  { group: 'Improper integrals', items: [
    { n: 'Definition', t: R`\int_a^\infty f\,dx=\lim_{b\to\infty}\int_a^b f\,dx` },
    { n: 'p-integrals', t: R`\int_1^\infty\frac{dx}{x^p}\ \text{converges}\iff p\gt1;\qquad\int_0^1\frac{dx}{x^p}\ \text{converges}\iff p\lt1` },
    { n: 'Exponential', t: R`\int_0^\infty e^{-kx}\,dx=\frac1k` }
  ] },
  { group: 'Differential equations', items: [
    { n: 'Euler\'s method', t: R`y_{k+1}=y_k+\Delta t\,f(t_k,y_k)` },
    { n: 'Equilibrium', d: R`A constant solution $y=c$ of $y'=f(y)$, where $f(c)=0$. Stable if nearby solutions approach it.` },
    { n: 'Separable', t: R`\int\frac{dy}{h(y)}=\int g(t)\,dt` },
    { n: 'Exponential growth', t: R`y'=ky\ \Rightarrow\ y=y_0e^{kt}` },
    { n: 'Newton\'s law of cooling', t: R`T=A+(T_0-A)e^{-kt}` }
  ] },
  { group: 'Sequences and series', items: [
    { n: 'Geometric series', t: R`\sum_{k=0}^\infty ar^k=\frac{a}{1-r}\quad(|r|\lt1)` },
    { n: 'Partial sum', t: R`S_n=a\,\frac{1-r^n}{1-r}` },
    { n: 'Divergence test', t: R`\lim a_k\ne0\Rightarrow\text{diverges}` },
    { n: 'p-series', t: R`\sum\frac1{k^p}\ \text{converges}\iff p\gt1` },
    { n: 'Integral test', d: 'For positive, decreasing f with f(k) = a_k: the series and the integral from 1 to infinity behave the same.' },
    { n: 'Limit comparison', t: R`\lim\frac{a_k}{b_k}=c,\ 0\lt c\lt\infty\ \Rightarrow\ \text{same behavior}` },
    { n: 'Ratio test', t: R`L=\lim\left|\frac{a_{k+1}}{a_k}\right|:\ L\lt1\ \text{conv.},\ L\gt1\ \text{div.},\ L=1\ \text{no info}` },
    { n: 'Alternating series test', t: R`b_k\downarrow0\Rightarrow\sum(-1)^kb_k\ \text{converges},\quad|S-S_n|\le b_{n+1}` },
    { n: 'Absolute vs conditional', d: 'Absolute: the series of absolute values converges. Conditional: the series converges but not absolutely.' }
  ] },
  { group: 'Taylor and power series', items: [
    { n: 'Taylor polynomial', t: R`P_n(x)=\sum_{k=0}^n\frac{f^{(k)}(a)}{k!}(x-a)^k` },
    { n: 'e^x', t: R`e^x=\sum_{k=0}^\infty\frac{x^k}{k!}=1+x+\frac{x^2}{2}+\frac{x^3}{6}+\cdots` },
    { n: 'sin x', t: R`\sin x=\sum_{k=0}^\infty\frac{(-1)^kx^{2k+1}}{(2k+1)!}=x-\frac{x^3}{6}+\frac{x^5}{120}-\cdots` },
    { n: 'cos x', t: R`\cos x=\sum_{k=0}^\infty\frac{(-1)^kx^{2k}}{(2k)!}=1-\frac{x^2}{2}+\frac{x^4}{24}-\cdots` },
    { n: '1/(1−x)', t: R`\frac1{1-x}=\sum_{k=0}^\infty x^k\quad(|x|\lt1)` },
    { n: 'ln(1+x)', t: R`\ln(1+x)=\sum_{k=1}^\infty\frac{(-1)^{k+1}x^k}{k}\quad(-1\lt x\le1)` },
    { n: 'arctan x', t: R`\arctan x=\sum_{k=0}^\infty\frac{(-1)^kx^{2k+1}}{2k+1}\quad(|x|\le1)` },
    { n: 'Lagrange error', t: R`|f(x)-P_n(x)|\le\frac{M}{(n+1)!}|x-a|^{n+1}` }
  ] },
  { group: 'Euler and Fourier', items: [
    { n: 'Euler\'s formula', t: R`e^{i\theta}=\cos\theta+i\sin\theta` },
    { n: 'Euler\'s identity', t: R`e^{i\pi}+1=0` },
    { n: 'Cosine and sine', t: R`\cos\theta=\frac{e^{i\theta}+e^{-i\theta}}{2},\qquad\sin\theta=\frac{e^{i\theta}-e^{-i\theta}}{2i}` },
    { n: 'Fourier coefficients', t: R`a_n=\frac1\pi\int_{-\pi}^{\pi}f\cos nx\,dx,\quad b_n=\frac1\pi\int_{-\pi}^{\pi}f\sin nx\,dx` },
    { n: 'Orthogonality', t: R`\int_{-\pi}^{\pi}\sin mx\sin nx\,dx=\begin{cases}0&m\ne n\\\pi&m=n\end{cases}` }
  ] }
];

const fc = [];
const card = (unit, sec, f, b) => fc.push({ id: 'c-' + sec + '-' + (fc.filter(c => c.sec === sec).length + 1), unit, sec, f, b });
// unit 1
card(1, 'sub', R`When does $u$-substitution work?`, R`When the integrand contains a function and (a constant times) its derivative: $\int f(g(x))g'(x)\,dx$.`);
card(1, 'sub', R`What happens to the limits in a definite $u$-substitution?`, R`They become $u$-values: $x=a\to u=g(a)$, $x=b\to u=g(b)$. Then do not substitute back.`);
card(1, 'sub', R`$\int\frac{2x}{x^2+1}\,dx$`, R`$\ln(x^2+1)+C$ (let $u=x^2+1$).`);
card(1, 'parts', R`Integration by parts formula`, R`$\int u\,dv=uv-\int v\,du$`);
card(1, 'parts', R`What does LIATE help you choose?`, R`$u$: logarithms, inverse trig, algebraic, trig, exponentials, in that order of preference.`);
card(1, 'parts', R`$\int\ln x\,dx$`, R`$x\ln x-x+C$ ($u=\ln x$, $dv=dx$).`);
card(1, 'parts', R`$\int xe^x\,dx$`, R`$xe^x-e^x+C$`);
card(1, 'pfd', R`First step when $\deg P\ge\deg Q$ in $\int\frac PQ\,dx$?`, R`Polynomial long division.`);
card(1, 'pfd', R`Partial fraction form for $\frac{1}{x^2(x+1)}$`, R`$\frac Ax+\frac{B}{x^2}+\frac{C}{x+1}$`);
card(1, 'pfd', R`Partial fraction form for $\frac{1}{(x-1)(x^2+4)}$`, R`$\frac{A}{x-1}+\frac{Bx+C}{x^2+4}$`);
card(1, 'trigsub', R`Substitution for $\sqrt{a^2-x^2}$`, R`$x=a\sin\theta$, so the root is $a\cos\theta$.`);
card(1, 'trigsub', R`Substitution for $\sqrt{a^2+x^2}$`, R`$x=a\tan\theta$, so the root is $a\sec\theta$.`);
card(1, 'trigsub', R`Substitution for $\sqrt{x^2-a^2}$`, R`$x=a\sec\theta$, so the root is $a\tan\theta$.`);
card(1, 'trigsub', R`$\int\cos^2\theta\,d\theta$`, R`$\frac\theta2+\frac{\sin2\theta}{4}+C$, using $\cos^2\theta=\frac{1+\cos2\theta}{2}$.`);
card(1, 'area', R`Area between two curves`, R`$\int_a^b(\text{top}-\text{bottom})\,dx$ or $\int_c^d(\text{right}-\text{left})\,dy$.`);
card(1, 'area', R`How do you find the limits for an area between curves?`, R`Solve $f(x)=g(x)$ for the intersection points.`);
card(1, 'area', R`Area between $y=x$ and $y=x^2$`, R`$\int_0^1(x-x^2)\,dx=\frac16$`);
card(1, 'arclength', R`Arc length of $y=f(x)$ on $[a,b]$`, R`$\int_a^b\sqrt{1+(f'(x))^2}\,dx$`);
card(1, 'arclength', R`Where does the arc length formula come from?`, R`The Pythagorean theorem on a small piece: $\sqrt{\Delta x^2+\Delta y^2}$.`);
// unit 2
card(2, 'washers', R`Washer method volume`, R`$V=\int_a^b\pi(R^2-r^2)\,dx$: outer radius squared minus inner radius squared.`);
card(2, 'washers', R`Radius of $y=f(x)$ when revolving about $y=k$`, R`$|f(x)-k|$, the distance to the axis.`);
card(2, 'washers', R`Volume by known cross-sections`, R`$V=\int_a^bA(x)\,dx$, where $A(x)$ is the area of the slice.`);
card(2, 'shells', R`Shell method volume`, R`$V=\int_a^b2\pi\,(\text{radius})(\text{height})\,dx$`);
card(2, 'shells', R`Washers or shells: which way do you slice?`, R`Washers: perpendicular to the axis. Shells: parallel to the axis.`);
card(2, 'shells', R`Shell radius when revolving about $x=-1$`, R`$x+1$`);
card(2, 'density', R`Mass of a rod with density $\rho(x)$ on $[a,b]$`, R`$M=\int_a^b\rho(x)\,dx$`);
card(2, 'density', R`Center of mass of a rod`, R`$\bar x=\frac{\int_a^b x\rho(x)\,dx}{\int_a^b\rho(x)\,dx}$`);
card(2, 'density', R`Center of mass of point masses`, R`$\bar x=\frac{\sum m_ix_i}{\sum m_i}$`);
card(2, 'work', R`Work done by a variable force`, R`$W=\int_a^bF(x)\,dx$`);
card(2, 'work', R`Hooke's law`, R`$F=kx$, with $x$ the stretch beyond natural length.`);
card(2, 'work', R`Work to pump: what goes in the integral?`, R`Weight of a slice ($\delta\cdot A(y)\,dy$) times the distance that slice is lifted.`);
card(2, 'work', R`Weight density of water (US units)`, R`62.4 lb/ft³`);
card(2, 'fluid', R`Pressure at depth $d$`, R`$P=\delta d$ (62.4$d$ lb/ft² for water).`);
card(2, 'fluid', R`Fluid force on a vertical plate`, R`$F=\int_a^b\delta\,y\,w(y)\,dy$, with $y$ the depth and $w(y)$ the width there.`);
card(2, 'improper', R`When does $\int_1^\infty\frac{dx}{x^p}$ converge?`, R`When $p\gt1$; its value is $\frac{1}{p-1}$.`);
card(2, 'improper', R`When does $\int_0^1\frac{dx}{x^p}$ converge?`, R`When $p\lt1$; its value is $\frac{1}{1-p}$.`);
card(2, 'improper', R`$\int_0^\infty e^{-kx}\,dx$ for $k\gt0$`, R`$\frac1k$`);
card(2, 'improper', R`Comparison test for improper integrals`, R`$0\le f\le g$: if $\int g$ converges so does $\int f$; if $\int f$ diverges so does $\int g$.`);
// unit 3
card(3, 'odes', R`Order of a differential equation`, R`The highest derivative that appears.`);
card(3, 'odes', R`How do you check that a function solves a DE?`, R`Substitute it and its derivatives into the equation (and check any initial condition).`);
card(3, 'odes', R`Solution of $y'=ky$, $y(0)=y_0$`, R`$y=y_0e^{kt}$`);
card(3, 'qualitative', R`Equilibrium solution of $y'=f(y)$`, R`A constant $y=c$ with $f(c)=0$.`);
card(3, 'qualitative', R`Stable equilibrium`, R`Nearby solutions move toward it: $f\gt0$ just below and $f\lt0$ just above.`);
card(3, 'qualitative', R`What does a slope field show?`, R`Short segments with slope $f(t,y)$; solution curves follow them.`);
card(3, 'euler', R`Euler's method step`, R`$y_{k+1}=y_k+\Delta t\,f(t_k,y_k)$`);
card(3, 'euler', R`When does Euler's method underestimate?`, R`When the solution is concave up (tangent lines lie below the curve).`);
card(3, 'euler', R`Effect of halving $\Delta t$ in Euler's method`, R`The error roughly halves.`);
card(3, 'separable', R`What makes a DE separable?`, R`It can be written $\frac{dy}{dt}=g(t)h(y)$.`);
card(3, 'separable', R`Newton's law of cooling solution`, R`$T=A+(T_0-A)e^{-kt}$`);
card(3, 'separable', R`$\ln|y|=x^2+C$ solved for $y$`, R`$y=Ke^{x^2}$ (the constant becomes a factor).`);
// unit 4
card(4, 'sequences', R`$\lim_{n\to\infty}\left(1+\frac kn\right)^n$`, R`$e^k$`);
card(4, 'sequences', R`When does $r^n$ converge to 0?`, R`When $|r|\lt1$.`);
card(4, 'sequences', R`Order of growth for large $n$`, R`$\ln n\ll n^p\ll b^n\ll n!\ll n^n$`);
card(4, 'geometric', R`Sum of a geometric series`, R`$\frac{\text{first term}}{1-r}$ when $|r|\lt1$; diverges when $|r|\ge1$.`);
card(4, 'geometric', R`Partial sum of a geometric series`, R`$S_n=a\frac{1-r^n}{1-r}$`);
card(4, 'geometric', R`$\sum_{k=0}^\infty\left(\frac12\right)^k$`, R`2`);
card(4, 'series', R`Divergence test`, R`If $\lim a_k\ne0$, the series diverges. If the limit is 0, no conclusion.`);
card(4, 'series', R`When does $\sum\frac1{k^p}$ converge?`, R`When $p\gt1$.`);
card(4, 'series', R`Does the harmonic series converge?`, R`No: $\sum\frac1k$ diverges, although its terms go to 0.`);
card(4, 'series', R`Ratio test`, R`$L=\lim\left|\frac{a_{k+1}}{a_k}\right|$: $L\lt1$ converges, $L\gt1$ diverges, $L=1$ inconclusive.`);
card(4, 'series', R`Limit comparison test`, R`If $\lim\frac{a_k}{b_k}=c$ with $0\lt c\lt\infty$, both series converge or both diverge.`);
// unit 5
card(5, 'ast', R`Alternating series test`, R`If $b_k$ decreases to 0, then $\sum(-1)^kb_k$ converges.`);
card(5, 'ast', R`Alternating series error bound`, R`$|S-S_n|\le b_{n+1}$, the first term left out.`);
card(5, 'ast', R`Conditional convergence`, R`The series converges but the series of absolute values diverges, e.g. $\sum\frac{(-1)^{k+1}}{k}$.`);
card(5, 'ast', R`$\sum_{k=1}^\infty\frac{(-1)^{k+1}}{k}$`, R`$\ln2$`);
card(5, 'taylor', R`Taylor polynomial of degree $n$ at $a$`, R`$P_n(x)=\sum_{k=0}^n\frac{f^{(k)}(a)}{k!}(x-a)^k$`);
card(5, 'taylor', R`Maclaurin series for $e^x$`, R`$\sum_{k=0}^\infty\frac{x^k}{k!}$`);
card(5, 'taylor', R`Maclaurin series for $\sin x$`, R`$x-\frac{x^3}{3!}+\frac{x^5}{5!}-\cdots$`);
card(5, 'taylor', R`Maclaurin series for $\cos x$`, R`$1-\frac{x^2}{2!}+\frac{x^4}{4!}-\cdots$`);
card(5, 'taylor', R`From a series, $f^{(k)}(a)=$?`, R`$k!\,c_k$, where $c_k$ is the coefficient of $(x-a)^k$.`);
card(5, 'power', R`How do you find a radius of convergence?`, R`Ratio test on the terms with $x$ in them; solve $\lim|\ldots|\lt1$ for $|x-a|$.`);
card(5, 'power', R`What must you check after finding the radius?`, R`Both endpoints, separately.`);
card(5, 'power', R`$\frac{1}{1-x}$ as a power series`, R`$\sum_{k=0}^\infty x^k$ for $|x|\lt1$.`);
card(5, 'power', R`Interval of convergence of $\sum\frac{x^k}{k}$`, R`$[-1,1)$`);
card(5, 'eulerformula', R`Euler's formula`, R`$e^{i\theta}=\cos\theta+i\sin\theta$`);
card(5, 'eulerformula', R`$e^{i\pi}$`, R`$-1$`);
card(5, 'eulerformula', R`$\cos\theta$ in exponentials`, R`$\frac{e^{i\theta}+e^{-i\theta}}{2}$`);
card(5, 'fourier', R`Fourier coefficient $b_n$ on $[-\pi,\pi]$`, R`$\frac1\pi\int_{-\pi}^{\pi}f(x)\sin nx\,dx$`);
card(5, 'fourier', R`Fourier series of an odd function`, R`Only sine terms ($a_n=0$).`);
card(5, 'fourier', R`What does a Fourier series converge to at a jump?`, R`The average of the left and right limits.`);

const PRACTICE = {
  exam1: { title: 'Exam 1 practice: 5.3–6.1', subtitle: 'Integration techniques, area and arc length. Work by hand, no calculator, and show every step.', problems: [
    { n: 1, sec: 'sub', tags: ['substitution'], q: R`Evaluate $\displaystyle\int_0^1 x^2\left(x^3+1\right)^4dx$.`, s: R`Let $u = x^3+1$, $du = 3x^2\,dx$; $x=0\to u=1$, $x=1\to u=2$. $\frac13\int_1^2u^4\,du = \frac13\cdot\frac{u^5}{5}\Big|_1^2 = \frac{32-1}{15} = \frac{31}{15}$.` },
    { n: 2, sec: 'parts', tags: ['parts'], q: R`Find $\displaystyle\int x^2e^x\,dx$.`, s: R`Parts twice (or a table): $u = x^2$, $dv = e^xdx$ gives $x^2e^x-\int2xe^x\,dx$; then $\int2xe^x\,dx = 2xe^x-2e^x$. Answer: $e^x\left(x^2-2x+2\right)+C$.` },
    { n: 3, sec: 'parts', tags: ['parts', 'definite'], q: R`Evaluate $\displaystyle\int_1^e\ln x\,dx$.`, s: R`$u = \ln x$, $dv = dx$: $\big[x\ln x\big]_1^e-\int_1^e1\,dx = (e-0)-(e-1) = 1$.` },
    { n: 4, sec: 'pfd', tags: ['partial fractions'], q: R`Find $\displaystyle\int\frac{x+5}{x^2+x-2}\,dx$.`, s: R`$x^2+x-2 = (x+2)(x-1)$. $\frac{x+5}{(x+2)(x-1)} = \frac{A}{x+2}+\frac{B}{x-1}$ gives $x+5 = A(x-1)+B(x+2)$. At $x=1$: $B = 2$. At $x=-2$: $A = -1$. Answer: $-\ln|x+2|+2\ln|x-1|+C$.` },
    { n: 5, sec: 'trigsub', tags: ['trig substitution'], q: R`Find $\displaystyle\int\frac{dx}{x^2\sqrt{4-x^2}}$.`, s: R`$x = 2\sin\theta$, $dx = 2\cos\theta\,d\theta$, $\sqrt{4-x^2} = 2\cos\theta$. The integral is $\int\frac{2\cos\theta}{4\sin^2\theta\cdot2\cos\theta}\,d\theta = \frac14\int\csc^2\theta\,d\theta = -\frac14\cot\theta+C$. From the triangle, $\cot\theta = \frac{\sqrt{4-x^2}}{x}$, so the answer is $-\frac{\sqrt{4-x^2}}{4x}+C$.` },
    { n: 6, sec: 'area', tags: ['area'], q: R`Find the area of the region between $y = 4-x^2$ and $y = x+2$.`, s: R`Intersect: $4-x^2 = x+2$ gives $x^2+x-2 = 0$, so $x = -2$ and $x = 1$. The parabola is on top. $A = \int_{-2}^1\left(2-x-x^2\right)dx = \left[2x-\frac{x^2}{2}-\frac{x^3}{3}\right]_{-2}^1 = \frac76-\left(-\frac{10}{3}\right) = \frac92$.` },
    { n: 7, sec: 'arclength', tags: ['arc length'], q: R`Set up, but do not evaluate, the length of $y = \sin x$ from $x = 0$ to $x = \pi$. Then find the length of $y = \frac{x^2}{4}-\frac{\ln x}{2}$ from $x = 1$ to $x = 2$.`, s: R`First: $L = \int_0^\pi\sqrt{1+\cos^2x}\,dx$. Second: $y' = \frac x2-\frac{1}{2x}$, so $1+(y')^2 = \left(\frac x2+\frac{1}{2x}\right)^2$. $L = \int_1^2\left(\frac x2+\frac1{2x}\right)dx = \frac34+\frac{\ln2}{2}\approx1.097$.` },
    { n: 8, sec: 'sub', tags: ['choosing a method'], q: R`Name the first technique you would try for each: (a) $\int x\sqrt{x^2+9}\,dx$ (b) $\int x\sec^2x\,dx$ (c) $\int\frac{dx}{\sqrt{9+x^2}}$ (d) $\int\frac{3}{x^2-9}\,dx$.`, s: R`(a) substitution $u = x^2+9$. (b) parts with $u = x$. (c) trig substitution $x = 3\tan\theta$. (d) partial fractions.` }
  ] },
  exam2: { title: 'Exam 2 practice: 6.2–6.5', subtitle: 'Volumes, mass, work, fluid force and improper integrals. Sketch first and show your slices.', problems: [
    { n: 1, sec: 'washers', tags: ['washers'], q: R`The region between $y = \sqrt x$ and $y = x$ is revolved about the $x$-axis. Find the volume.`, s: R`On $[0,1]$, $\sqrt x\ge x$, so $R = \sqrt x$ and $r = x$. $V = \pi\int_0^1\left(x-x^2\right)dx = \pi\left(\frac12-\frac13\right) = \frac\pi6$.` },
    { n: 2, sec: 'shells', tags: ['shells'], q: R`The same region is revolved about the $y$-axis. Find the volume with shells.`, s: R`Radius $x$, height $\sqrt x-x$. $V = \int_0^12\pi x\left(x^{1/2}-x\right)dx = 2\pi\left(\frac25-\frac13\right) = \frac{2\pi}{15}$.` },
    { n: 3, sec: 'washers', tags: ['axis y = k'], q: R`The region under $y = x^2$ for $0\le x\le1$ is revolved about the line $y = -1$. Set up the volume.`, s: R`Washers about $y = -1$: outer radius $x^2+1$, inner radius 1. $V = \pi\int_0^1\left[\left(x^2+1\right)^2-1\right]dx = \pi\int_0^1\left(x^4+2x^2\right)dx = \pi\left(\frac15+\frac23\right) = \frac{13\pi}{15}$.` },
    { n: 4, sec: 'density', tags: ['center of mass'], q: R`A 3 m rod has density $\rho(x) = x^2$ kg/m, $0\le x\le3$. Find its mass and center of mass.`, s: R`$M = \int_0^3x^2\,dx = 9$ kg. Moment $= \int_0^3x^3\,dx = \frac{81}{4}$. $\bar x = \frac{81/4}{9} = \frac94 = 2.25$ m.` },
    { n: 5, sec: 'work', tags: ['pumping'], q: R`A cylindrical tank of radius 2 ft and height 6 ft is full of water. How much work pumps all the water out over the top? (Water weighs 62.4 lb/ft³.)`, s: R`Measure $y$ down from the top. A slice at depth $y$ has volume $\pi\cdot2^2\,dy$, weight $62.4\cdot4\pi\,dy$, and is lifted $y$ ft. $W = \int_0^6 62.4\cdot4\pi\,y\,dy = 62.4\cdot4\pi\cdot18 = 4492.8\pi\approx14{,}115$ ft·lb.` },
    { n: 6, sec: 'fluid', tags: ['fluid force'], q: R`A triangular plate with a 4 ft base at the water's surface and its vertex 3 ft below stands vertically. Find the fluid force on one side.`, s: R`At depth $y$ the width is $4\left(1-\frac y3\right)$. $F = \int_0^362.4\,y\cdot4\left(1-\frac y3\right)dy = 62.4\cdot4\left[\frac{y^2}{2}-\frac{y^3}{9}\right]_0^3 = 62.4\cdot4\cdot1.5 = 374.4$ lb.` },
    { n: 7, sec: 'improper', tags: ['improper'], q: R`Evaluate or show divergence: (a) $\int_0^\infty xe^{-x}\,dx$ (b) $\int_0^1\frac{dx}{\sqrt x}$ (c) $\int_1^\infty\frac{dx}{\sqrt x}$.`, s: R`(a) Parts: $\int_0^bxe^{-x}\,dx = 1-(b+1)e^{-b}\to1$. Converges to 1. (b) $\lim_{a\to0^+}2\sqrt x\big|_a^1 = 2$. (c) $\lim_{b\to\infty}\left(2\sqrt b-2\right) = \infty$: diverges.` },
    { n: 8, sec: 'work', tags: ['spring'], q: R`A spring's natural length is 10 cm. A 40 N force holds it at 15 cm. Find the work to stretch it from 15 cm to 20 cm.`, s: R`$k = \frac{40}{0.05} = 800$ N/m. Stretch goes from 0.05 to 0.10 m. $W = \int_{0.05}^{0.10}800x\,dx = 400\left(0.01-0.0025\right) = 3$ J.` }
  ] },
  exam3: { title: 'Exam 3 practice: 7.1–8.3', subtitle: 'Differential equations, sequences and series. Explain each conclusion in a sentence.', problems: [
    { n: 1, sec: 'odes', tags: ['verify'], q: R`For which $k$ is $y = e^{kt}$ a solution of $y''-y'-6y = 0$?`, s: R`Substitute: $e^{kt}\left(k^2-k-6\right) = 0$, so $(k-3)(k+2) = 0$: $k = 3$ or $k = -2$.` },
    { n: 2, sec: 'qualitative', tags: ['equilibria'], q: R`Find and classify the equilibrium solutions of $\frac{dy}{dt} = (y-1)(y-4)$.`, s: R`Equilibria $y = 1$ and $y = 4$. The right side is positive for $y\lt1$, negative for $1\lt y\lt4$ and positive for $y\gt4$. Solutions move toward 1 from both sides (stable) and away from 4 (unstable).` },
    { n: 3, sec: 'euler', tags: ['Euler'], q: R`Use Euler's method with $\Delta t = 0.1$ for two steps to estimate $y(0.2)$ if $y' = 2y-t$, $y(0) = 1$.`, s: R`Slope at $(0,1)$: 2, so $y(0.1)\approx1.2$. Slope at $(0.1,1.2)$: $2.4-0.1 = 2.3$, so $y(0.2)\approx1.2+0.23 = 1.43$.` },
    { n: 4, sec: 'separable', tags: ['separable'], q: R`Solve $\frac{dy}{dx} = \frac{x}{y}$, $y(0) = 3$.`, s: R`$y\,dy = x\,dx$, so $\frac{y^2}{2} = \frac{x^2}{2}+C$ and $y^2 = x^2+9$. Since $y(0) = 3\gt0$, $y = \sqrt{x^2+9}$.` },
    { n: 5, sec: 'separable', tags: ['cooling'], q: R`Coffee at 90°C sits in a 20°C room and cools to 60°C in 10 minutes. Assuming Newton's law of cooling, when does it reach 40°C?`, s: R`$T = 20+70e^{-kt}$. From $60 = 20+70e^{-10k}$, $e^{-10k} = \frac47$. Setting $40 = 20+70e^{-kt}$ gives $e^{-kt} = \frac27$, so $t = 10\cdot\frac{\ln(7/2)}{\ln(7/4)}\approx22.4$ minutes.` },
    { n: 6, sec: 'sequences', tags: ['limits'], q: R`Decide whether each sequence converges, and find its limit: (a) $\frac{n^2}{2^n}$ (b) $\left(1+\frac2n\right)^n$ (c) $\cos(n\pi)$.`, s: R`(a) Exponentials beat powers: limit 0. (b) $e^2$. (c) $\cos(n\pi) = (-1)^n$, which diverges.` },
    { n: 7, sec: 'geometric', tags: ['geometric'], q: R`A ball dropped from 10 ft rebounds to $\frac34$ of its previous height each bounce. Find the total vertical distance it travels.`, s: R`Down 10, then up and down $2\cdot10\left(\frac34\right)^k$ for $k\ge1$: $10+2\cdot\frac{10\cdot3/4}{1-3/4} = 10+60 = 70$ ft.` },
    { n: 8, sec: 'series', tags: ['tests'], q: R`Decide convergence and name the test: (a) $\sum\frac{k}{2k+1}$ (b) $\sum\frac{1}{k^{3/2}}$ (c) $\sum\frac{k+1}{k^3+2}$ (d) $\sum\frac{3^k}{k!}$.`, s: R`(a) Terms $\to\frac12\ne0$: diverges (divergence test). (b) $p = \frac32\gt1$: converges ($p$-series). (c) Limit compare with $\frac1{k^2}$: ratio $\to1$, converges. (d) Ratio $\frac{3}{k+1}\to0\lt1$: converges (ratio test).` }
  ] },
  exam4: { title: 'Exam 4 practice: 8.4 onward', subtitle: 'Alternating series, Taylor and power series, Euler’s formula and Fourier series. The syllabus does not list Exam 4’s sections; check with your instructor.', problems: [
    { n: 1, sec: 'ast', tags: ['absolute', 'conditional'], q: R`Classify as absolutely convergent, conditionally convergent or divergent: (a) $\sum\frac{(-1)^k}{\sqrt k}$ (b) $\sum\frac{(-1)^k}{k^2}$ (c) $\sum(-1)^k\frac{k}{k+1}$.`, s: R`(a) Conditionally: the alternating series test applies, but $\sum\frac1{\sqrt k}$ is a divergent $p$-series. (b) Absolutely: $\sum\frac1{k^2}$ converges. (c) Diverges: the terms do not go to 0.` },
    { n: 2, sec: 'ast', tags: ['error'], q: R`Estimate $\sum_{k=1}^\infty\frac{(-1)^{k+1}}{k^3}$ with its first three terms and bound the error.`, s: R`$S_3 = 1-\frac18+\frac1{27}\approx0.912$. The error is at most $b_4 = \frac1{64}\approx0.016$.` },
    { n: 3, sec: 'taylor', tags: ['Taylor polynomial'], q: R`Find the degree-2 Taylor polynomial of $f(x) = \sqrt x$ at $a = 4$ and use it to estimate $\sqrt{4.1}$.`, s: R`$f(4) = 2$, $f'(x) = \frac{1}{2\sqrt x}$ so $f'(4) = \frac14$, $f''(x) = -\frac{1}{4x^{3/2}}$ so $f''(4) = -\frac1{32}$. $P_2(x) = 2+\frac14(x-4)-\frac{1}{64}(x-4)^2$. $P_2(4.1) = 2+0.025-0.00015625 = 2.02484$.` },
    { n: 4, sec: 'taylor', tags: ['building series'], q: R`Find the Maclaurin series of $x^2e^{-x^2}$ and use it to find $f^{(6)}(0)$.`, s: R`$e^{-x^2} = \sum\frac{(-1)^kx^{2k}}{k!}$, so $x^2e^{-x^2} = \sum\frac{(-1)^kx^{2k+2}}{k!} = x^2-x^4+\frac{x^6}{2}-\cdots$. The $x^6$ coefficient is $\frac12$, so $f^{(6)}(0) = 6!\cdot\frac12 = 360$.` },
    { n: 5, sec: 'power', tags: ['interval'], q: R`Find the interval of convergence of $\displaystyle\sum_{k=1}^\infty\frac{(x-3)^k}{k\,5^k}$.`, s: R`Ratio: $\frac{|x-3|}{5}\cdot\frac{k}{k+1}\to\frac{|x-3|}{5}\lt1$, so $R = 5$ and the center is 3. At $x = 8$: $\sum\frac1k$ diverges. At $x = -2$: $\sum\frac{(-1)^k}{k}$ converges. Interval: $[-2,8)$.` },
    { n: 6, sec: 'power', tags: ['term by term'], q: R`Starting from $\frac{1}{1-x} = \sum x^k$, find a power series for $\frac{1}{(1-x)^2}$ and use it to sum $\sum_{k=1}^\infty\frac{k}{2^k}$.`, s: R`Differentiate: $\frac{1}{(1-x)^2} = \sum_{k=1}^\infty kx^{k-1}$. Multiply by $x$: $\sum kx^k = \frac{x}{(1-x)^2}$. At $x = \frac12$: $\frac{1/2}{1/4} = 2$.` },
    { n: 7, sec: 'eulerformula', tags: ['Euler'], q: R`Use Euler's formula to write $e^{i3\pi/4}$ as $a+bi$, and simplify $\left(\cos\frac\pi6+i\sin\frac\pi6\right)^6$.`, s: R`$e^{i3\pi/4} = -\frac{\sqrt2}{2}+\frac{\sqrt2}{2}i$. By De Moivre, the power is $\cos\pi+i\sin\pi = -1$.` },
    { n: 8, sec: 'fourier', tags: ['Fourier'], q: R`Find the Fourier coefficients of $f(x) = x$ on $[-\pi,\pi]$ using $f(x)\sim\frac{a_0}{2}+\sum(a_n\cos nx+b_n\sin nx)$.`, s: R`$f$ is odd, so every $a_n = 0$. $b_n = \frac2\pi\int_0^\pi x\sin nx\,dx = \frac2\pi\left[-\frac{x\cos nx}{n}+\frac{\sin nx}{n^2}\right]_0^\pi = -\frac{2\cos n\pi}{n} = \frac{2(-1)^{n+1}}{n}$. So $x\sim2\left(\sin x-\frac{\sin2x}{2}+\frac{\sin3x}{3}-\cdots\right)$.` }
  ] }
};

const CHECKLISTS = {
  exam1: ['I can spot a function–derivative pair and run a u-substitution, changing the limits for definite integrals.', 'I can choose u and dv for integration by parts, including ln x, x eˣ and repeated parts.', 'I can set up and solve partial fractions, including repeated and quadratic factors, after long division when needed.', 'I can pick the right trig substitution for each square root and convert back with a triangle.', 'I can find the area between curves with vertical or horizontal slices, splitting where curves cross.', 'I can set up arc length and evaluate it when 1 + (f′)² is a perfect square.', 'I can write my work with correct notation and a sentence explaining each step.'],
  exam2: ['I can find volumes with disks and washers about any horizontal or vertical axis.', 'I can find volumes with shells and choose between shells and washers.', 'I can compute mass and center of mass for rods and point masses.', 'I can set up work integrals for springs, ropes and pumping liquid.', 'I can set up fluid force on a vertical plate using depth and width at depth.', 'I can evaluate improper integrals with limits, know the p-integral rules and use comparison.'],
  exam3: ['I can verify a solution of a differential equation and use an initial condition.', 'I can read slope fields and find and classify equilibrium solutions.', 'I can carry out Euler’s method in a table and say whether it over- or underestimates.', 'I can solve separable equations, including growth and Newton’s law of cooling.', 'I can find limits of sequences using function limits, growth rates and squeezing.', 'I can sum geometric series and partial sums and set up applied geometric problems.', 'I can choose and apply the divergence, integral, p-series, comparison, limit comparison and ratio tests.'],
  exam4: ['I can apply the alternating series test and its error bound.', 'I can classify a series as absolutely convergent, conditionally convergent or divergent.', 'I can build Taylor polynomials and use them to approximate values, with an error estimate.', 'I can write and adapt the Maclaurin series for eˣ, sin x, cos x, 1/(1 − x) and ln(1 + x).', 'I can find a power series’ radius and interval of convergence, checking both endpoints.', 'I can use Euler’s formula and De Moivre’s theorem.', 'I can compute Fourier coefficients and use symmetry to skip zero terms.']
};

module.exports = { SECTIONS, FORMULAS, FLASHCARDS: fc, PRACTICE, CHECKLISTS };
