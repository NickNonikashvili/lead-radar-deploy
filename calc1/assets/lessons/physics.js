/* PHSX 220 Physics I: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).physics = {
  units: {
    plain: 'Every number in physics comes with a unit, and the unit is half the answer. All of mechanics is built from three base units: meters, kilograms and seconds. To convert, multiply by a fraction that equals 1, like $\\frac{1000\\text{ m}}{1\\text{ km}}$, so the old unit cancels. Checking that units match on both sides of an equation catches most algebra mistakes.',
    figure: { type: 'table', head: ['unit', 'built from', 'measures'], rows: [['newton (N)', 'kg·m/s²', 'force'], ['joule (J)', 'N·m', 'energy, work'], ['watt (W)', 'J/s', 'power'], ['pascal (Pa)', 'N/m²', 'pressure']], caption: 'Every derived unit is made of meters, kilograms and seconds.' },
    check: [
      ['Convert 72 km/h to m/s.', '$72 \\times \\frac{1000}{3600} = 20$ m/s.'],
      ['Can $x = vt^2$ be a position?', 'No: $vt^2$ has units of m·s, not m.'],
      ['How many m² is 1 cm²?', '$(10^{-2})^2 = 10^{-4}$ m²: square the conversion factor.']
    ]
  },
  vectors: {
    plain: 'A vector is an arrow: it has a size and a direction. Adding arrows by drawing them is slow, so split each one into an $x$ part and a $y$ part (its components), add the $x$ parts and the $y$ parts separately, then rebuild the arrow with Pythagoras and an inverse tangent.',
    figure: { type: 'figure', shapes: [{ kind: 'arrow', from: [0, 0], to: [4, 3], label: 'A = 5.0 m' }, { kind: 'segment', from: [0, 0], to: [4, 0], dash: true, label: 'Aₓ = 4.0' }, { kind: 'segment', from: [4, 0], to: [4, 3], dash: true, label: 'A_y = 3.0' }, { kind: 'angle', at: [0, 0], from: [4, 0], to: [4, 3], label: '37°' }], caption: 'Aₓ = A cos θ and A_y = A sin θ, with θ measured from the +x axis.' },
    check: [
      ['A 10 N force points 30° above the +x axis. What are its components?', '$F_x = 10\\cos30^\\circ = 8.7$ N, $F_y = 10\\sin30^\\circ = 5.0$ N.'],
      ['A vector has components (−3, 4). What is its magnitude?', '$\\sqrt{9 + 16} = 5$.'],
      ['Is speed a vector?', 'No: speed is the size of the velocity vector, a scalar.']
    ]
  },
  kin1d: {
    plain: 'Motion in a line is described by position, velocity and acceleration, each the rate of change of the one before. On a graph of position against time, the slope is velocity. On a graph of velocity against time, the slope is acceleration and the area underneath is the displacement. When acceleration is constant, four equations connect them.',
    figure: { type: 'graph', x: [0, 13], y: [0, 24], fns: [{ f: '2.5x', domain: [0, 8], label: 'speeding up: slope 2.5 m/s²' }, { f: '20-5(x-8)', domain: [8, 12], label: 'braking: slope −5 m/s²' }], shade: { f: '2.5x', g: '0', from: 0, to: 8 }, xlabel: 't (s)', ylabel: 'v (m/s)', caption: 'Slope is acceleration; area is distance: the shaded triangle is 80 m, the braking triangle another 40 m.' },
    check: [
      ['What does the slope of an $x$–$t$ graph tell you?', 'The velocity.'],
      ['A car goes from 0 to 20 m/s in 8 s. What is its average acceleration?', '$\\frac{20}{8} = 2.5$ m/s².'],
      ['Which constant-acceleration equation has no time in it?', '$v^2 = v_0^2 + 2a\\Delta x$.']
    ]
  },
  freefall: {
    plain: 'Drop anything near the ground and, ignoring air, it speeds up downward by 9.8 m/s every second, whatever its mass. Pick up as positive and use $a = -9.8$ m/s² for the whole flight: on the way up, at the top and on the way down. At the very top the velocity is zero, but the acceleration is not.',
    figure: { type: 'graph', x: [0, 4.3], y: [0, 34], fns: [{ f: '20+15x-4.9x^2', domain: [0, 4.07], label: 'height y(t)' }], points: [{ x: 1.53, y: 31.5, label: 'top: v = 0, a = −9.8' }, { x: 4.07, y: 0, label: 'lands at 4.07 s' }], xlabel: 't (s)', ylabel: 'y (m)', caption: 'A ball thrown up at 15 m/s from a 20 m roof: a parabola in time.' },
    check: [
      ['What is the acceleration of a ball at the top of its flight?', '9.8 m/s² downward. Only the velocity is zero there.'],
      ['A rock falls from rest for 2.0 s. How fast is it going?', '$9.8 \\times 2 = 19.6$ m/s downward.'],
      ['Does a heavier ball fall faster (no air resistance)?', 'No: every object falls with the same acceleration.']
    ]
  },
  kin2d: {
    plain: 'In two dimensions, position, velocity and acceleration are arrows. The trick is that sideways motion and up-down motion do not affect each other: solve each direction as its own one-dimensional problem, and connect them only through time. The velocity always points along the path; the acceleration points toward the inside of any curve.',
    figure: { type: 'figure', shapes: [{ kind: 'curve', points: [[0, 0], [0.5, 0.703], [1, 1.312], [1.5, 1.828], [2, 2.25], [2.5, 2.578], [3, 2.812], [3.5, 2.953], [4, 3], [4.5, 2.953], [5, 2.812], [5.5, 2.578], [6, 2.25], [6.5, 1.828], [7, 1.312], [7.5, 0.703], [8, 0]] }, { kind: 'point', at: [2, 2.25] }, { kind: 'arrow', from: [2, 2.25], to: [4, 3.75], label: 'v (along the path)' }, { kind: 'arrow', from: [2, 2.25], to: [2, 0.75], label: 'a' }], caption: 'Velocity is tangent to the path; acceleration bends it.' },
    check: [
      ['A drone moves from (2, 5) m to (14, 0) m in 4.0 s. Find its average velocity.', '$(12, -5)/4 = (3.0, -1.25)$ m/s.'],
      ['If $\\vec v$ and $\\vec a$ are perpendicular, what changes: speed or direction?', 'Only the direction: the speed stays the same at that instant.'],
      ['What links the $x$ and $y$ equations?', 'The time $t$: it is the same in both.']
    ]
  },
  projectile: {
    plain: 'A thrown ball does two things at once: it drifts sideways at a constant speed, and it falls exactly like a dropped ball. So split the launch velocity into $v_0\\cos\\theta$ sideways and $v_0\\sin\\theta$ upward, use the vertical motion to find how long it flies, then multiply that time by the sideways speed to get how far it goes.',
    figure: { type: 'graph', x: [0, 40], y: [0, 9], fns: [{ x: '16.38t', y: '11.47t-4.9t^2', t: [0, 2.34], label: 'path' }], points: [{ x: 19.2, y: 6.71, label: 'top: v_y = 0' }, { x: 38.3, y: 0, label: 'range 38 m' }], xlabel: 'x (m)', ylabel: 'y (m)', caption: 'Kicked at 20 m/s at 35°: 2.34 s in the air, 38 m away, 6.7 m high.' },
    check: [
      ['At the top of a projectile\'s path, what is its speed?', 'Just the horizontal part, $v_0\\cos\\theta$: only $v_y$ is zero.'],
      ['Which launch angle gives the longest range on level ground?', '45°.'],
      ['A ball rolls off a 1.25 m table at 3 m/s. How long until it lands?', '$t = \\sqrt{2(1.25)/9.8} = 0.51$ s: the sideways speed does not matter.']
    ]
  },
  circkin: {
    plain: 'Going around a circle at a steady speed still counts as accelerating, because the direction keeps changing. That acceleration always points to the center, with size $v^2/r$. Relative motion is the other half of this topic: a velocity is always measured from somewhere, and you add velocities like arrows to switch viewpoints.',
    figure: { type: 'figure', shapes: [{ kind: 'circle', at: [0, 0], r: 3 }, { kind: 'point', at: [3, 0] }, { kind: 'arrow', from: [3, 0], to: [3, 2.5], label: 'v' }, { kind: 'arrow', from: [3, 0], to: [1, 0], label: 'a = v²/r' }, { kind: 'point', at: [0, 0], label: 'center' }], caption: 'Velocity is tangent to the circle; acceleration points to the center.' },
    check: [
      ['A car takes a 50 m radius curve at 10 m/s. What is its acceleration?', '$\\frac{10^2}{50} = 2$ m/s² toward the center.'],
      ['Double the speed on the same circle. What happens to $a_c$?', 'It becomes four times as big.'],
      ['A boat aims straight across at 4 m/s in a 3 m/s current. What is its speed over the ground?', '$\\sqrt{4^2 + 3^2} = 5$ m/s.']
    ]
  },
  newton: {
    plain: 'Newton\'s laws say: with no net force, things keep doing what they were doing; a net force makes them accelerate, $\\sum \\vec F = m\\vec a$; and forces always come in equal and opposite pairs acting on two different objects. Most problems are the second law, written once for the $x$ direction and once for $y$.',
    figure: { type: 'figure', shapes: [{ kind: 'rect', at: [-0.6, -0.6], w: 1.2, h: 1.2, text: '3 kg' }, { kind: 'arrow', from: [0.6, 0], to: [4.6, 0], label: '12 N' }, { kind: 'arrow', from: [0, 0.6], to: [0, 3.6], label: '9 N' }, { kind: 'arrow', from: [0.6, 0.45], to: [4.6, 3.45], label: 'net 15 N' }], caption: 'Two pushes add like arrows: 15 N, so a = 15/3 = 5 m/s².' },
    check: [
      ['An object moves at constant velocity. What is the net force on it?', 'Zero.'],
      ['A 2 kg cart has a net force of 6 N. What is its acceleration?', '3 m/s².'],
      ['You push a wall with 50 N. What does the wall do?', 'It pushes back on you with 50 N (the third law).']
    ]
  },
  forces: {
    plain: 'Before writing any equation, draw a free-body diagram: the object as a dot or box, with an arrow for every force on it and nothing else. Weight $mg$ points down. The normal force pushes out of the surface and is only as big as it needs to be. Tension pulls along a rope. Friction runs along the surface against sliding.',
    figure: { type: 'figure', shapes: [{ kind: 'rect', at: [-1, -0.7], w: 2, h: 1.4, text: 'box' }, { kind: 'arrow', from: [0, -0.7], to: [0, -3.2], label: 'mg' }, { kind: 'arrow', from: [0, 0.7], to: [0, 3.2], label: 'N' }, { kind: 'arrow', from: [1, 0.3], to: [3.4, 1.7], label: 'T' }, { kind: 'arrow', from: [-1, 0], to: [-2.8, 0], label: 'f' }], caption: 'A box pulled by a rope: four forces, four arrows.' },
    check: [
      ['Is the normal force always equal to $mg$?', 'No: it changes on slopes, in elevators and when something pushes down or pulls up.'],
      ['On a 30° frictionless slope, what is $N$ for a 2 kg block?', '$mg\\cos30^\\circ = 2(9.8)(0.866) = 17$ N.'],
      ['Should "ma" be drawn as a force on a free-body diagram?', 'No: $m\\vec a$ is the result of the forces, not a force.']
    ]
  },
  applynewton: {
    plain: 'For a system of objects tied together (blocks on ropes, pulleys), draw one free-body diagram per object. Objects joined by a taut rope share the same size of acceleration. Write the second law for each one along its direction of motion, then add the equations: the tension cancels and you can solve for the acceleration.',
    figure: { type: 'figure', shapes: [{ kind: 'circle', at: [0, 5], r: 1 }, { kind: 'segment', from: [-1, 5], to: [-1, 2.2] }, { kind: 'segment', from: [1, 5], to: [1, 1.2] }, { kind: 'rect', at: [-1.6, 1.2], w: 1.2, h: 1, text: '3 kg' }, { kind: 'rect', at: [0.4, 0.2], w: 1.2, h: 1, text: '5 kg' }, { kind: 'arrow', from: [2.2, 1.2], to: [2.2, -0.3], label: 'a' }, { kind: 'arrow', from: [-2.2, 1.7], to: [-2.2, 3.2], label: 'a' }], caption: 'An Atwood machine: a = (5 − 3)g / 8 = 2.45 m/s².' },
    check: [
      ['Why do the two Atwood masses share the same acceleration size?', 'The rope does not stretch, so they move together.'],
      ['On a frictionless incline at angle θ, what is the acceleration down the slope?', '$g\\sin\\theta$, independent of mass.'],
      ['In the 3 kg / 5 kg Atwood machine, find the tension.', '$T = 3(9.8 + 2.45) = 36.8$ N.']
    ]
  },
  friction: {
    plain: 'Friction comes in two kinds. Static friction holds an object still and grows to match your push, up to a limit $\\mu_s N$. Once the object slides, kinetic friction takes over with a fixed size $\\mu_k N$, usually smaller. That is why it is harder to get a heavy box moving than to keep it moving.',
    figure: { type: 'graph', x: [0, 80], y: [0, 60], fns: [{ f: 'x', domain: [0, 49], label: 'static: matches the push' }, { f: '29.4', domain: [49, 80], label: 'kinetic: 29.4 N' }], points: [{ x: 49, y: 49, open: true, label: 'limit μₛN = 49 N' }], xlabel: 'push (N)', ylabel: 'friction (N)', caption: 'A 10 kg crate with μₛ = 0.5 and μₖ = 0.3.' },
    check: [
      ['A 10 kg crate (μₛ = 0.5) is pushed with 30 N and does not move. What is the friction force?', '30 N: static friction matches the push, it is not $\\mu_s N$.'],
      ['Does friction depend on the contact area?', 'No (in this model): only on the normal force and the surfaces.'],
      ['Which way does kinetic friction point?', 'Opposite the sliding.']
    ]
  },
  circdyn: {
    plain: 'Centripetal force is not an extra force to draw. It is the name for the total of the real forces (friction, tension, normal force, gravity) that point toward the center, and that total must equal $mv^2/r$. On a flat road, friction does the turning; on a banked road, the tilted normal force helps.',
    figure: { type: 'figure', shapes: [{ kind: 'circle', at: [0, 0], r: 3 }, { kind: 'rect', at: [2.6, -0.4], w: 0.8, h: 0.8, text: 'car' }, { kind: 'arrow', from: [3, 0.4], to: [3, 2.6], label: 'v' }, { kind: 'arrow', from: [2.6, 0], to: [0.8, 0], label: 'friction' }], caption: 'On a flat curve, friction points to the center: f = mv²/r.' },
    check: [
      ['A 1200 kg car rounds a 50 m curve at 15 m/s. How much friction is needed?', '$1200 \\times 15^2 / 50 = 5400$ N.'],
      ['At the top of a loop, which way does the net force point?', 'Down, toward the center.'],
      ['Should you draw an arrow labelled "centripetal force"?', 'No: draw the real forces; their inward total is the centripetal force.']
    ]
  },
  statics: {
    plain: 'Something that is not moving and not turning needs two balances: the forces add to zero, and the torques add to zero. Torque is a force\'s turning power: force times the perpendicular distance from the pivot. Choose the pivot at an unknown force and that force drops out of the torque equation.',
    figure: { type: 'figure', shapes: [{ kind: 'rect', at: [0, 0], w: 6, h: 0.3 }, { kind: 'arrow', from: [0, 0], to: [0, 2.5], label: 'F_L' }, { kind: 'arrow', from: [6, 0], to: [6, 2.5], label: 'F_R' }, { kind: 'arrow', from: [3, 0.3], to: [3, -1.5], label: '196 N' }, { kind: 'arrow', from: [2, 0.3], to: [2, -2.5], label: '588 N' }], caption: 'A 6 m plank with a person 2 m from the left: torques about the left end give F_R.' },
    check: [
      ['A 20 N force acts 0.5 m from a pivot, at right angles. What is the torque?', '10 N·m.'],
      ['Why put the pivot at an unknown force?', 'Its lever arm is zero, so it drops out of the torque equation.'],
      ['Where does the weight of a uniform plank act?', 'At its middle (the center of mass).']
    ]
  },
  fluids: {
    plain: 'In a still fluid, pressure only depends on how deep you are: every meter of water adds about 9.8 kPa. The water pushes harder on the bottom of a submerged object than on its top, and that difference is the buoyant force: the weight of the fluid the object pushes aside.',
    figure: { type: 'graph', x: [0, 10], y: [90, 205], fns: [{ f: '101.3+9.8x', label: 'P = P₀ + ρgh' }], points: [{ x: 0, y: 101.3, label: 'surface: 1 atm' }], xlabel: 'depth h (m)', ylabel: 'P (kPa)', caption: 'Pressure grows in a straight line with depth: 10 m of water adds about one atmosphere.' },
    check: [
      ['What is the gauge pressure 5 m under water?', '$\\rho g h = 1000(9.8)(5) = 49$ kPa.'],
      ['A block with density 800 kg/m³ floats in water. What fraction is under water?', '0.80.'],
      ['Two tanks of different shapes have water 3 m deep. Which has more pressure at the bottom?', 'Neither: pressure depends only on depth.']
    ]
  },
  rotkin: {
    plain: 'Spinning has its own versions of position, velocity and acceleration: angle $\\theta$ (in radians), angular velocity $\\omega$ and angular acceleration $\\alpha$. With constant $\\alpha$ the same four kinematics equations work, just with letters swapped. A point at radius $r$ moves at $v = r\\omega$.',
    figure: { type: 'table', head: ['moving in a line', 'spinning', 'link'], rows: [['x (m)', 'θ (rad)', 's = rθ'], ['v (m/s)', 'ω (rad/s)', 'v = rω'], ['a (m/s²)', 'α (rad/s²)', 'a_t = rα'], ['v = v₀ + at', 'ω = ω₀ + αt', '']], caption: 'Every straight-line equation has a spinning twin.' },
    check: [
      ['Convert 60 rpm to rad/s.', '$60 \\times 2\\pi / 60 = 2\\pi \\approx 6.28$ rad/s.'],
      ['A wheel of radius 0.3 m spins at 10 rad/s. How fast is a point on the rim moving?', '3 m/s.'],
      ['Do all points on a spinning wheel have the same $\\omega$?', 'Yes, but the same $v$ only at the same radius.']
    ]
  },
  work: {
    plain: 'Work is how much a force speeds something up or slows it down along the way: force times distance, counting only the part of the force along the motion. Forces sideways to the motion do no work. The work–energy theorem says the total work equals the change in kinetic energy $\\frac12mv^2$. Power is how fast work is done.',
    figure: { type: 'graph', x: [0, 0.12], y: [0, 25], fns: [{ f: '200x', domain: [0, 0.1], label: 'F = kx' }], shade: { f: '200x', g: '0', from: 0, to: 0.1 }, xlabel: 'x (m)', ylabel: 'F (N)', caption: 'Work is the area under F–x: ½(0.1)(20) = 1 J to stretch this spring 10 cm.' },
    check: [
      ['How much work does the normal force do on a box sliding across a floor?', 'Zero: it is perpendicular to the motion.'],
      ['A 2 kg ball speeds up from 0 to 3 m/s. How much net work was done on it?', '$\\frac12(2)(9) = 9$ J.'],
      ['A motor does 600 J in 2 s. What is its power?', '300 W.']
    ]
  },
  energy: {
    plain: 'Energy moves between kinds but the total stays put. A ball rolling down a hill trades height energy ($mgy$) for motion energy ($\\frac12mv^2$). Springs store $\\frac12kx^2$. If friction acts, some energy turns into heat, and you subtract that. Energy problems skip the forces entirely: compare a before and an after.',
    figure: { type: 'graph', x: [0, 5], y: [0, 55], fns: [{ f: '10x', label: 'U = mgy' }, { f: '50-10x', label: 'K' }, { f: '50', dash: true, label: 'total E' }], xlabel: 'height y (m)', ylabel: 'energy (J)', caption: 'As height drops, U turns into K; the total stays at 50 J.' },
    check: [
      ['A ball falls from 5 m from rest. How fast is it at the ground (no air)?', '$v = \\sqrt{2gh} = \\sqrt{98} \\approx 9.9$ m/s.'],
      ['Where is the zero of gravitational potential energy?', 'Anywhere you choose: only changes in $U$ matter.'],
      ['Friction does −40 J on a sliding block. What happened to that energy?', 'It became heat (thermal energy).']
    ]
  },
  momentum: {
    plain: 'Momentum is mass times velocity, and it has a direction. A force acting for a time changes it: the impulse $F\\,\\Delta t$ equals the change in momentum. That is why airbags and bending your knees help: stretching the stop over a longer time means a smaller force for the same change.',
    figure: { type: 'graph', x: [0, 10], y: [0, 1000], fns: [{ f: '942sin(pi*x/10)', label: 'F(t)' }], shade: { f: '942sin(pi*x/10)', g: '0', from: 0, to: 10 }, hlines: [{ y: 600, label: 'average 600 N' }], xlabel: 't (ms)', ylabel: 'F (N)', caption: 'The area under F–t is the impulse: 6.0 N·s for a 0.15 kg ball bouncing back at 20 m/s.' },
    check: [
      ['A 0.15 kg ball hits a wall at 20 m/s and bounces back at 20 m/s. What is the size of its momentum change?', '$0.15 \\times 40 = 6.0$ kg·m/s.'],
      ['Why does catching an egg gently keep it from breaking?', 'A longer stopping time means a smaller force for the same impulse.'],
      ['What are the units of impulse?', 'N·s, the same as kg·m/s.']
    ]
  },
  collisions: {
    plain: 'In any collision where outside forces are small, the total momentum before equals the total after. Kinetic energy is a different story: elastic collisions keep it, most real collisions lose some, and objects that stick together lose the most. The center of mass of the system keeps moving as if nothing happened.',
    figure: { type: 'table', head: ['', 'before', 'after (stuck)'], rows: [['2 kg cart', '3.0 m/s', '2.0 m/s'], ['1 kg cart', '0 m/s', '2.0 m/s'], ['total momentum', '6 kg·m/s', '6 kg·m/s'], ['total KE', '9 J', '6 J']], caption: 'Momentum is conserved; 3 J of kinetic energy is lost.' },
    check: [
      ['Two carts stick together. Which is conserved: momentum, KE or both?', 'Only momentum.'],
      ['A 1 kg ball at 4 m/s hits an identical ball at rest, elastically and head-on. What happens?', 'They swap: the first stops and the second moves at 4 m/s.'],
      ['Why can you ignore gravity and friction during a short collision?', 'The collision forces are far larger over that brief time.']
    ]
  },
  rotdyn: {
    plain: 'Torque does for spinning what force does for moving: $\\tau = I\\alpha$. The moment of inertia $I$ is spinning mass, and it depends on where the mass sits: mass far from the axis is harder to spin up. That is why a hoop is harder to spin than a solid disk of the same mass and radius.',
    figure: { type: 'bars', bars: [['hoop', 1], ['disk', 0.5], ['sphere', 0.4], ['rod (end)', 0.333], ['rod (center)', 0.083]], caption: 'I as a multiple of M·R² (or M·L² for rods): the farther the mass from the axis, the bigger I.' },
    check: [
      ['A 4 kg solid disk of radius 0.2 m: what is $I$?', '$\\frac12(4)(0.2)^2 = 0.08$ kg·m².'],
      ['A 2 N·m torque acts on it. What is $\\alpha$?', '$\\frac{2}{0.08} = 25$ rad/s².'],
      ['Why is it easier to spin a rod about its center than its end?', 'Its mass sits closer to the axis, so $I$ is smaller.']
    ]
  },
  angmom: {
    plain: 'A rolling ball both moves and spins, so its energy has two parts. Spinning objects also carry angular momentum $L = I\\omega$, and with no outside torque it stays the same. A skater pulling in their arms makes $I$ smaller, so $\\omega$ goes up to keep $L$ constant.',
    figure: { type: 'bars', bars: [['sphere', 3.74], ['disk', 3.61], ['hoop', 3.13]], caption: 'Speed in m/s after rolling down 1 m: the sphere wins and the hoop loses, whatever their mass.' },
    check: [
      ['A skater at 2 rev/s pulls in their arms, cutting $I$ from 4.0 to 1.6 kg·m². New spin rate?', '$2 \\times 4/1.6 = 5$ rev/s.'],
      ['For rolling without slipping, how are $v$ and $\\omega$ related?', '$v = R\\omega$.'],
      ['Does a heavier ball roll down a ramp faster than a lighter one of the same shape?', 'No: only the shape ($I/mR^2$) matters.']
    ]
  },
  gravity: {
    plain: 'Every two masses pull on each other with a force that drops off with the square of the distance between their centers: $F = Gm_1m_2/r^2$. Double the distance and the pull is a quarter as strong. An orbit is falling around the planet: gravity supplies exactly the centripetal force needed to keep curving.',
    figure: { type: 'graph', x: [1, 5], y: [0, 10.5], fns: [{ f: '9.8/x^2', label: 'g = 9.8/r²' }], points: [{ x: 1, y: 9.8, label: 'surface 9.8' }, { x: 2, y: 2.45, label: '2 radii: 2.45' }], xlabel: 'distance (Earth radii)', ylabel: 'g (m/s²)', caption: 'Twice as far from the center, a quarter of the pull.' },
    check: [
      ['If the distance between two masses triples, what happens to the force?', 'It becomes $\\frac19$ as big.'],
      ['For a circular orbit, what equation do you set up?', '$\\frac{GMm}{r^2} = \\frac{mv^2}{r}$, so $v = \\sqrt{GM/r}$.'],
      ['Is $r$ measured from the surface or the center?', 'From the center.']
    ]
  },
  shm: {
    plain: 'When the force pulling something back is proportional to how far it has moved (like a spring), it swings back and forth in a smooth wave called simple harmonic motion. Its period $T = 2\\pi\\sqrt{m/k}$ does not depend on how far you pulled it. It moves fastest through the middle and stops for an instant at each end.',
    figure: { type: 'graph', x: [0, 12.6], y: [-1.3, 1.3], fns: [{ f: 'cos(x)', label: 'position x(t)' }, { f: '-sin(x)', label: 'velocity v(t)', dash: true }], xlabel: 't', caption: 'Where position is at its extreme, velocity is zero, and the other way round.' },
    check: [
      ['A 0.5 kg mass on a 200 N/m spring: what is ω?', '$\\sqrt{200/0.5} = 20$ rad/s.'],
      ['Where is the speed largest?', 'At the middle (equilibrium).'],
      ['If you double the amplitude, what happens to the period?', 'Nothing: the period does not depend on amplitude.']
    ]
  },
  pendulum: {
    plain: 'A pendulum swinging through small angles is simple harmonic motion with period $T = 2\\pi\\sqrt{L/g}$: only the length and gravity matter, not the mass. Real swings slowly die out (damping). Pushing at the system\'s natural rhythm makes the swings grow huge: resonance.',
    figure: { type: 'graph', x: [0, 12], y: [-1.1, 1.1], fns: [{ f: 'exp(-0.2x)cos(3x)', label: 'damped swing' }, { f: 'exp(-0.2x)', dash: true, label: 'envelope' }], xlabel: 't (s)', caption: 'Damping shrinks the swings while the rhythm stays almost the same.' },
    check: [
      ['What length pendulum has a 2.0 s period on Earth?', '$L = gT^2/4\\pi^2 \\approx 0.99$ m.'],
      ['On the Moon, is a pendulum\'s period longer or shorter?', 'Longer: $g$ is smaller.'],
      ['What is resonance?', 'Large swings when you drive a system at its natural frequency.']
    ]
  },
  waves: {
    plain: 'A wave carries energy along without carrying the material: each bit of a string only bobs up and down. The wavelength is the length of one repeat; the frequency is how many repeats pass each second; their product is the wave speed. The medium sets the speed, the source sets the frequency.',
    figure: { type: 'graph', x: [0, 12.6], y: [-1.5, 1.6], fns: [{ f: 'sin(x)', label: 'y(x) at one instant' }], segments: [{ from: [1.571, 1.3], to: [7.854, 1.3], label: 'one wavelength λ' }], hlines: [{ y: 0 }], xlabel: 'x', caption: 'v = λf: a 2 m wave at 50 Hz moves at 100 m/s.' },
    check: [
      ['A wave has λ = 2 m and f = 50 Hz. How fast does it travel?', '100 m/s.'],
      ['A wave moves from a light string to a heavy one. What stays the same?', 'The frequency (set by the source); speed and wavelength change.'],
      ['What is the wave speed on a string under tension $T$ with mass per length $\\mu$?', '$v = \\sqrt{T/\\mu}$.']
    ]
  },
  sound: {
    plain: 'Sound is a pressure wave pushing through the air at about 343 m/s. Loudness in decibels is a log scale: every 10 dB is ten times the intensity. When a source moves toward you the wave crests bunch up and you hear a higher pitch; moving away, a lower one. That is the Doppler effect.',
    figure: { type: 'figure', shapes: [{ kind: 'circle', at: [0, 0], r: 4 }, { kind: 'circle', at: [0.6, 0], r: 3 }, { kind: 'circle', at: [1.2, 0], r: 2 }, { kind: 'circle', at: [1.8, 0], r: 1 }, { kind: 'point', at: [2.4, 0], label: 'source →' }, { kind: 'text', at: [6.4, 1.4], text: 'bunched: higher pitch' }, { kind: 'text', at: [-6.4, 1.4], text: 'spread: lower pitch' }], caption: 'A moving source squeezes the waves ahead of it.' },
    check: [
      ['How much more intense is 80 dB than 60 dB?', '100 times (20 dB is two factors of ten).'],
      ['An ambulance at 700 Hz drives toward you. Is the pitch you hear higher or lower?', 'Higher (about 767 Hz at 30 m/s).'],
      ['What is the wavelength of a 343 Hz sound in air?', '$343/343 = 1$ m.']
    ]
  }
};
