/* ============================================================
   Study Hub — Physics I (w/ Calculus) course data
   Source: course syllabus (Craig Ogilvie, Fall 2026) and OpenStax
   University Physics Volume 1. Week-by-week topics are estimated from the
   syllabus topic order and exam weeks; Canvas modules are authoritative.
   ============================================================ */
(function (global) {
  'use strict';
  const R = String.raw;
  const OS = 'https://openstax.org/books/university-physics-volume-1/pages/';

  const COURSE = {
    code: 'PHSX 220', name: 'Physics I (w/ Calculus)', term: 'Fall 2026', school: 'Montana State University',
    instructor: 'Craig Ogilvie', instructorRoom: 'Barnard 240', instructorEmail: 'craig.ogilvie@montana.edu',
    officeHours: 'Mon, Wed, Fri 2–3 pm (or by arrangement)',
    lectures: 'Mon · Wed · Fri in Barnard 103 · 11:00 am (Sect 1) or 1:10 pm (Sect 2)',
    classDays: 'Mon · Wed · Fri lecture, plus a weekly lab section',
    textbook: { title: 'University Physics, Volume 1 (OpenStax)', url: OS + '1-introduction' },
    textbookBase: OS,
    links: [
      { eyebrow: 'Textbook', title: 'University Physics Vol. 1 online', url: OS + '1-introduction', desc: 'Free OpenStax textbook. Reading online is recommended by the instructor.' },
      { eyebrow: 'Textbook PDF', title: 'Download the PDF', url: 'https://d3bxy9euw4e147.cloudfront.net/oscms-prodcms/media/documents/UniversityPhysicsVolume1-OP.pdf', desc: 'Full book as a single PDF for offline study.' },
      { eyebrow: 'Homework', title: 'Expert TA (via Canvas)', url: 'https://montana.instructure.com/courses/35718', desc: 'Weekly problem sets, due Tuesday 11:59 pm. Open from the week’s Canvas module.' },
      { eyebrow: 'Lectures', title: 'iClicker sign-up', url: 'https://ato.montana.edu/iclicker/', desc: 'Register with your student.montana.edu email so grades sync to Canvas.' },
      { eyebrow: 'Course site', title: 'Canvas modules', url: 'https://montana.instructure.com/courses/35718', desc: 'Each week’s lectures, pre-reading, problem set and lab live in a module.' },
      { eyebrow: 'Simulations', title: 'PhET interactive sims', url: 'https://phet.colorado.edu/en/simulations/filter?subjects=physics', desc: 'Used in Lab 2; great for projectiles, forces and energy intuition.' }
    ],
    helpCenter: { name: 'Instructor office hours', where: 'Barnard 240', hours: 'Mon · Wed · Fri 2–3 pm' },
    deadlines: [
      { name: 'Problem set (Expert TA)', rule: 'Due every Tuesday at 11:59 pm, covering the previous week’s lectures. Lowest problem set dropped.' },
      { name: 'Lab post-lab', rule: 'Submit to Canvas by 11:59 pm the Tuesday after your lab. Pre-lab 5 pts, lab 10 pts, post-lab 5 pts. Late up to a week: post-lab scores 0. Lowest lab dropped; at least 6 labs required to pass.' },
      { name: 'Clicker pre-reading', rule: 'The first clicker question each class is on the pre-reading listed in that week’s Canvas module. Second-round answers count; ~20% of sessions are excused.' },
      { name: 'Extra credit reflections', rule: 'Five 0.4-point reflections on ~10-minute study-skills videos, due Tuesdays in the first five weeks.' }
    ]
  };

  const GRADING = {
    categories: [
      { id: 'exam1', name: 'Exam 1 (week of Sep 14, at lab time)', weight: 58 / 3, group: 'exams' },
      { id: 'exam2', name: 'Exam 2 (week of Oct 12, at lab time)', weight: 58 / 3, group: 'exams' },
      { id: 'exam3', name: 'Exam 3 (week of Nov 2, at lab time)', weight: 58 / 3, group: 'exams' },
      { id: 'exam4', name: 'Exam 4 (finals week)', weight: 58 / 3, group: 'exams' },
      { id: 'labs', name: 'Labs (pre-lab, lab, post-lab; lowest dropped)', weight: 20 },
      { id: 'psets', name: 'Problem sets (Expert TA; lowest dropped)', weight: 10 },
      { id: 'clicker', name: 'Clicker second-round answers (~20% excused)', weight: 10 },
      { id: 'ec', name: 'Extra credit reflections (five × 0.4 pts)', weight: 2 }
    ],
    groups: { exams: { keepBest: 3, weight: 58, note: 'Best three of four exams count (the lowest is dropped).' } },
    finalId: 'exam4',
    note: 'Scores are rounded up by one decimal point (88.5% becomes 89%). The instructor may lower these borders at the end of the semester, never raise them.',
    scale: [
      { letter: 'A', min: 89 }, { letter: 'A-', min: 85 }, { letter: 'B+', min: 80 }, { letter: 'B', min: 76 }, { letter: 'B-', min: 72 },
      { letter: 'C+', min: 68 }, { letter: 'C', min: 64 }, { letter: 'C-', min: 60 }, { letter: 'D', min: 55 }, { letter: 'F', min: 0 }
    ],
    rubric: [
      { score: 5, name: 'Pre-lab', desc: 'Completed before your lab section; shows you read the procedure and predicted results.' },
      { score: 10, name: 'Lab work', desc: 'In-lab group activity. Being late affects your group and can cost points.' },
      { score: 5, name: 'Post-lab', desc: 'Analysis and writeup submitted to Canvas by 11:59 pm the following Tuesday. Zero if submitted late.' }
    ]
  };

  const EXAMS = [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-09-14', endDate: '2026-09-18', dateLabel: 'Week of Sep 14, during your lab section', covers: 'kinematics, vectors, projectiles and Newton’s laws (everything since the start)', sections: ['units', 'vectors', 'kin1d', 'freefall', 'kin2d', 'projectile', 'circkin', 'newton', 'forces'], units: [1], weight: 19.3 },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-10-12', endDate: '2026-10-16', dateLabel: 'Week of Oct 12, during your lab section', covers: 'applying Newton’s laws, friction, circular motion, statics, fluids, rotational kinematics, work and energy', sections: ['applynewton', 'friction', 'circdyn', 'statics', 'fluids', 'rotkin', 'work', 'energy'], units: [2], weight: 19.3 },
    { id: 'exam3', n: 3, name: 'Exam 3', date: '2026-11-02', endDate: '2026-11-06', dateLabel: 'Week of Nov 2, during your lab section', covers: 'momentum and collisions, rotational dynamics, angular momentum, gravitation', sections: ['momentum', 'collisions', 'rotdyn', 'angmom', 'gravity'], units: [3], weight: 19.3 },
    { id: 'exam4', n: 4, name: 'Final (Exam 4)', date: '2026-12-14', endDate: '2026-12-18', dateLabel: 'Finals week (Dec 14 – 18), time TBD', covers: 'oscillations, waves and sound (material since Exam 3; not cumulative)', sections: ['shm', 'pendulum', 'waves', 'sound'], units: [4], weight: 19.3 }
  ];

  const SEMESTER = { start: '2026-08-24', end: '2026-12-18' };

  /* type: lecture | lab | exam | holiday | admin | review ; 4th item = section id */
  const CALENDAR = [
    ['2026-08-24', 'lecture', 'Intro · units, measurement, estimation (Ch 1)', 'units'],
    ['2026-08-26', 'lecture', 'Vectors: components and algebra (Ch 2)', 'vectors'],
    ['2026-08-28', 'lecture', '1D motion: position, velocity, acceleration (3.1–3.3)', 'kin1d'],
    ['2026-08-31', 'lecture', 'Constant acceleration equations (3.4)', 'kin1d'],
    ['2026-09-01', 'admin', 'Due 11:59 pm: PSet 1 · Intro to Expert TA · EC: Growth mindset'],
    ['2026-09-02', 'lecture', 'Free fall; motion from a(t) (3.5–3.6)', 'freefall'],
    ['2026-09-04', 'lecture', '2D motion and projectiles (4.1–4.3)', 'projectile'],
    ['2026-09-07', 'holiday', 'Labor Day · no class'],
    ['2026-09-08', 'admin', 'Due 11:59 pm: PSet 2 · Lab 1 post-lab · EC 1: Cognitive science and learning'],
    ['2026-09-09', 'lecture', 'Uniform circular motion; relative motion (4.4–4.5)', 'circkin'],
    ['2026-09-11', 'lecture', 'Newton’s laws of motion (5.1–5.5)', 'newton'],
    ['2026-09-14', 'lecture', 'Common forces and free-body diagrams (5.6–5.7)', 'forces'],
    ['2026-09-14', 'exam', 'Exam 1 week · at your lab time · kinematics & Newton’s laws'],
    ['2026-09-15', 'admin', 'Due 11:59 pm: PSet 3 · Lab 2 post-lab (PhET + regular) · EC 2: How people learn'],
    ['2026-09-16', 'lecture', 'Applying Newton’s laws I: inclines, connected masses (6.1)', 'applynewton'],
    ['2026-09-16', 'admin', 'Last day to drop without a W'],
    ['2026-09-18', 'lecture', 'Applying Newton’s laws II: elevators, pulleys (6.1)', 'applynewton'],
    ['2026-09-21', 'lecture', 'Friction (6.2)', 'friction'],
    ['2026-09-22', 'admin', 'Due 11:59 pm: PSet 4 · post-lab · EC 3: Optimizing learning'],
    ['2026-09-23', 'lecture', 'Centripetal force; banked curves (6.3)', 'circdyn'],
    ['2026-09-25', 'lecture', 'Drag and terminal speed (6.4)', 'circdyn'],
    ['2026-09-28', 'lecture', 'Static equilibrium and torque (12.1–12.2)', 'statics'],
    ['2026-09-29', 'admin', 'Due 11:59 pm: PSet 5 · post-lab · EC 4'],
    ['2026-09-30', 'lecture', 'Static fluids: density, pressure, Pascal (14.1–14.3)', 'fluids'],
    ['2026-10-02', 'lecture', 'Buoyancy and Archimedes’ principle (14.4)', 'fluids'],
    ['2026-10-05', 'lecture', 'Rotational kinematics (10.1–10.3)', 'rotkin'],
    ['2026-10-06', 'admin', 'Due 11:59 pm: PSet 6 · post-lab · EC 5'],
    ['2026-10-07', 'lecture', 'Work, kinetic energy, work-energy theorem (7.1–7.3)', 'work'],
    ['2026-10-09', 'lecture', 'Power; potential energy; conservation of energy (7.4, 8.1–8.3)', 'energy'],
    ['2026-10-12', 'lecture', 'Energy problem solving; energy diagrams (8.4)', 'energy'],
    ['2026-10-12', 'exam', 'Exam 2 week · at your lab time · Newton applications through energy'],
    ['2026-10-13', 'admin', 'Due 11:59 pm: PSet 7 · post-lab'],
    ['2026-10-14', 'lecture', 'Momentum and impulse (9.1–9.2)', 'momentum'],
    ['2026-10-16', 'lecture', 'Conservation of momentum (9.3)', 'momentum'],
    ['2026-10-19', 'lecture', 'Collisions in one and two dimensions (9.4–9.5)', 'collisions'],
    ['2026-10-20', 'admin', 'Due 11:59 pm: PSet 8 · post-lab'],
    ['2026-10-21', 'lecture', 'Center of mass (9.6)', 'collisions'],
    ['2026-10-23', 'lecture', 'Moment of inertia and rotational kinetic energy (10.4–10.5)', 'rotdyn'],
    ['2026-10-26', 'lecture', 'Torque and Newton’s second law for rotation (10.6–10.8)', 'rotdyn'],
    ['2026-10-27', 'admin', 'Due 11:59 pm: PSet 9 · post-lab'],
    ['2026-10-28', 'lecture', 'Rolling motion; angular momentum and its conservation (11.1–11.3)', 'angmom'],
    ['2026-10-30', 'lecture', 'Gravitation: universal law, g near Earth (13.1–13.2)', 'gravity'],
    ['2026-11-02', 'lecture', 'Orbits, gravitational energy, Kepler’s laws (13.3–13.5)', 'gravity'],
    ['2026-11-02', 'exam', 'Exam 3 week · at your lab time · momentum, rotation, gravitation'],
    ['2026-11-03', 'admin', 'Due 11:59 pm: PSet 10 · post-lab'],
    ['2026-11-04', 'lecture', 'Catch-up and review', 'gravity'],
    ['2026-11-06', 'lecture', 'Simple harmonic motion (15.1)', 'shm'],
    ['2026-11-09', 'lecture', 'Energy in SHM; SHM and circular motion (15.2–15.3)', 'shm'],
    ['2026-11-10', 'admin', 'Due 11:59 pm: PSet 11 · post-lab'],
    ['2026-11-11', 'holiday', 'Veterans Day · no class'],
    ['2026-11-13', 'lecture', 'Pendulums (15.4)', 'pendulum'],
    ['2026-11-16', 'lecture', 'Damped and forced oscillations; resonance (15.5–15.6)', 'pendulum'],
    ['2026-11-17', 'admin', 'Due 11:59 pm: PSet 12 · post-lab'],
    ['2026-11-18', 'lecture', 'Traveling waves and the wave function (16.1–16.2)', 'waves'],
    ['2026-11-18', 'admin', 'Last day to drop with a W'],
    ['2026-11-20', 'lecture', 'Wave speed on a string; wave energy (16.3–16.4)', 'waves'],
    ['2026-11-23', 'holiday', 'Fall recess · no class'],
    ['2026-11-24', 'holiday', 'Fall recess · no class'],
    ['2026-11-25', 'holiday', 'Fall recess · no class'],
    ['2026-11-26', 'holiday', 'Fall recess · no class'],
    ['2026-11-27', 'holiday', 'Fall recess · no class'],
    ['2026-11-30', 'lecture', 'Superposition, interference, standing waves (16.5–16.6)', 'waves'],
    ['2026-12-01', 'admin', 'Due 11:59 pm: PSet 13 · post-lab'],
    ['2026-12-02', 'lecture', 'Sound waves and the speed of sound (17.1–17.2)', 'sound'],
    ['2026-12-04', 'lecture', 'Sound intensity; standing sound waves (17.3–17.4)', 'sound'],
    ['2026-12-07', 'lecture', 'Beats and the Doppler effect (17.6–17.7)', 'sound'],
    ['2026-12-08', 'admin', 'Due 11:59 pm: PSet 14 · post-lab'],
    ['2026-12-09', 'review', 'Review'],
    ['2026-12-11', 'review', 'Review'],
    ['2026-12-14', 'exam', 'Finals week · Exam 4 (oscillations, waves, sound) · time TBD'],
    ['2026-12-15', 'exam', 'Finals week'],
    ['2026-12-16', 'exam', 'Finals week'],
    ['2026-12-17', 'exam', 'Finals week'],
    ['2026-12-18', 'exam', 'Finals week']
  ];
  const CALENDAR_NOTE = 'Lecture topics are estimated from the syllabus topic order and exam weeks. Your week’s Canvas module is the authority for what is due.';

  /* recurring deadlines shown on the dashboard */
  const RECURRING = [
    { dows: [2], time: '11:59 pm', title: 'Problem set due (Expert TA)', from: '2026-09-01', skipHolidays: true, skipIfAdmin: true },
    { dows: [2], time: '11:59 pm', title: 'Lab post-lab due (Canvas)', from: '2026-09-08', skipHolidays: true, skipIfAdmin: true },
    { dows: [1, 3, 5], time: 'in class', title: 'Clicker: pre-reading question', from: '2026-08-24', skipHolidays: true, quiet: true }
  ];

  const UNITS = [
    { n: 1, title: 'Kinematics & Newton’s laws', sections: ['units', 'vectors', 'kin1d', 'freefall', 'kin2d', 'projectile', 'circkin', 'newton', 'forces'], exam: 'exam1' },
    { n: 2, title: 'Applying Newton, statics, fluids, energy', sections: ['applynewton', 'friction', 'circdyn', 'statics', 'fluids', 'rotkin', 'work', 'energy'], exam: 'exam2' },
    { n: 3, title: 'Momentum, rotation, gravitation', sections: ['momentum', 'collisions', 'rotdyn', 'angmom', 'gravity'], exam: 'exam3' },
    { n: 4, title: 'Oscillations, waves, sound', sections: ['shm', 'pendulum', 'waves', 'sound'], exam: 'exam4' }
  ];

  /* ---------- Section notes ---------- */
  const SECTIONS = [
    {
      id: 'units', label: 'Ch 1', title: 'Units, dimensions, and estimation', unit: 1, link: OS + '1-3-unit-conversion',
      ideas: [
        R`SI base units for mechanics: meter (m), kilogram (kg), second (s). Everything else is built from them: newton $\text{N} = \text{kg·m/s}^2$, joule $\text{J} = \text{N·m}$, watt $\text{W} = \text{J/s}$, pascal $\text{Pa} = \text{N/m}^2$.`,
        R`<b>Convert units by multiplying by 1</b> written as a ratio: $72\ \text{km/h} \times \frac{1000\ \text{m}}{1\ \text{km}} \times \frac{1\ \text{h}}{3600\ \text{s}} = 20\ \text{m/s}$. Squared or cubed units convert twice or three times: $1\ \text{cm}^3 = (10^{-2}\ \text{m})^3 = 10^{-6}\ \text{m}^3$.`,
        R`<b>Dimensional analysis</b> catches wrong equations: both sides must have the same dimensions, and you can only add quantities with the same units. Arguments of $\sin$, $\exp$, $\ln$ must be dimensionless.`,
        R`Report answers to about three significant figures (the precision of the data), with units, and a sign or direction when the quantity is a vector.`,
        R`Fermi estimates: round to powers of ten, multiply, and sanity-check the order of magnitude. Clicker questions love these.`
      ],
      formulas: [
        { n: 'Key conversions', t: R`1\ \text{km/h} = \tfrac{1}{3.6}\ \text{m/s},\quad 1\ \text{mi} = 1.609\ \text{km},\quad 1\ \text{in} = 2.54\ \text{cm},\quad 1\ \text{g/cm}^3 = 1000\ \text{kg/m}^3` },
        { n: 'Derived units', t: R`\text{N} = \text{kg·m/s}^2,\quad \text{J} = \text{N·m} = \text{kg·m}^2\text{/s}^2,\quad \text{W} = \text{J/s},\quad \text{Pa} = \text{N/m}^2` }
      ],
      example: { p: R`Check whether $x = v t^2$ could describe a position.`, s: R`Dimensions of the right side: $[v][t]^2 = \frac{\text{L}}{\text{T}}\cdot\text{T}^2 = \text{L·T}$. Position has dimension $\text{L}$, so the equation is wrong. ($x = \tfrac12 a t^2$ works: $\frac{\text{L}}{\text{T}^2}\cdot\text{T}^2 = \text{L}$.)` },
      pitfalls: ['Forgetting to square the conversion factor for areas (cm² → m² is ×10⁻⁴, not ×10⁻²).', 'Mixing km/h with seconds in a kinematics equation.', 'Dropping units on the final answer: the graders and Expert TA both check them.'],
      tip: 'Before submitting any Expert TA answer, run the units through in your head. A velocity answer in m/s² is an instant flag that a formula was misapplied.'
    },
    {
      id: 'vectors', label: 'Ch 2', title: 'Vectors: components and algebra', unit: 1, link: OS + '2-2-coordinate-systems-and-components-of-a-vector',
      ideas: [
        R`A vector has magnitude and direction; a scalar has only size. Displacement, velocity, acceleration, force and momentum are vectors. Distance, speed, mass, energy and time are scalars.`,
        R`<b>Components</b> turn vector problems into two ordinary problems: $A_x = A\cos\theta$, $A_y = A\sin\theta$ with $\theta$ measured counterclockwise from the $+x$ axis. Going back: $A = \sqrt{A_x^2 + A_y^2}$, $\tan\theta = A_y/A_x$ (check the quadrant from the signs of the components).`,
        R`Add vectors by adding components: $\vec R = \vec A + \vec B \Rightarrow R_x = A_x + B_x,\ R_y = A_y + B_y$. Subtracting $\vec B$ means adding $-\vec B$ (flip both components).`,
        R`Unit vectors $\hat i, \hat j, \hat k$ point along $x, y, z$: $\vec A = A_x\hat i + A_y\hat j$. Multiplying by a scalar scales the magnitude (negative scalar reverses direction).`,
        R`<b>Dot product</b> $\vec A\cdot\vec B = AB\cos\theta = A_xB_x + A_yB_y$ (a scalar; used for work). <b>Cross product</b> $|\vec A\times\vec B| = AB\sin\theta$ (a vector perpendicular to both; used for torque and angular momentum; right-hand rule).`
      ],
      formulas: [
        { n: 'Components', t: R`A_x = A\cos\theta,\quad A_y = A\sin\theta,\quad A = \sqrt{A_x^2+A_y^2},\quad \theta = \tan^{-1}\!\frac{A_y}{A_x}` },
        { n: 'Dot and cross', t: R`\vec A\cdot\vec B = AB\cos\theta = A_xB_x + A_yB_y,\qquad |\vec A\times\vec B| = AB\sin\theta` }
      ],
      example: { p: R`$\vec A$ has magnitude 5.0 m at $37^\circ$ above the $+x$ axis; $\vec B$ is 8.0 m along $-y$. Find $\vec A + \vec B$.`, s: R`$A_x = 5\cos37^\circ = 3.99$, $A_y = 5\sin37^\circ = 3.01$; $B_x = 0$, $B_y = -8$. $R_x = 3.99$, $R_y = -4.99$. $R = \sqrt{3.99^2 + 4.99^2} = 6.39$ m at $\tan^{-1}(-4.99/3.99) = -51.3^\circ$, i.e. $51.3^\circ$ below the $+x$ axis.` },
      pitfalls: [R`Using $\cos$ for the $y$ component. Only true if the angle is measured from the $y$ axis: draw the triangle every time.`, 'Reporting the calculator’s arctan without checking the quadrant (it never returns angles in quadrants II or III).', 'Adding magnitudes instead of components.'],
      tip: 'Every 2D force or motion problem starts the same way: draw axes, resolve every vector into components, then work each axis separately.'
    },
    {
      id: 'kin1d', label: 'Ch 3.1–3.4', title: 'Motion in one dimension', unit: 1, link: OS + '3-4-motion-with-constant-acceleration',
      ideas: [
        R`Position $x(t)$, displacement $\Delta x = x_f - x_i$ (can be negative; distance cannot). Average velocity $\bar v = \Delta x/\Delta t$; instantaneous velocity $v = dx/dt$ (slope of the $x$–$t$ graph). Acceleration $a = dv/dt$ (slope of the $v$–$t$ graph).`,
        R`<b>Graphs:</b> slope of $x$–$t$ is velocity; slope of $v$–$t$ is acceleration; area under $v$–$t$ is displacement; area under $a$–$t$ is change in velocity.`,
        R`<b>Constant acceleration</b> gives four equations. Each one is missing one variable ($x$, $v$, $a$ or $t$); pick the equation that omits the quantity you neither know nor want.`,
        R`Speeding up means $v$ and $a$ have the same sign; slowing down means opposite signs. Negative acceleration is not the same as slowing down.`,
        R`With calculus: $v(t) = v_0 + \int_0^t a\,dt$, $x(t) = x_0 + \int_0^t v\,dt$.`
      ],
      formulas: [
        { n: 'Definitions', t: R`\bar v = \frac{\Delta x}{\Delta t},\quad v = \frac{dx}{dt},\quad \bar a = \frac{\Delta v}{\Delta t},\quad a = \frac{dv}{dt}` },
        { n: 'Constant acceleration', t: R`v = v_0 + at,\quad x = x_0 + v_0t + \tfrac12 at^2,\quad v^2 = v_0^2 + 2a\,\Delta x,\quad \Delta x = \tfrac12(v_0 + v)\,t` }
      ],
      example: { p: R`A car accelerates from rest at $2.5\ \text{m/s}^2$ for 8.0 s, then brakes uniformly to a stop in 40 m. Find the braking deceleration and the total time.`, s: R`Phase 1: $v = 0 + 2.5(8) = 20$ m/s, $\Delta x = \tfrac12(2.5)(64) = 80$ m. Phase 2: $0 = 20^2 + 2a(40) \Rightarrow a = -5.0\ \text{m/s}^2$; time $t = \frac{0-20}{-5} = 4.0$ s. Total time $12.0$ s, total distance $120$ m.` },
      pitfalls: [R`Using $x = vt$ when the acceleration is not zero.`, R`Plugging speed for $v_0$ with the wrong sign after choosing a positive direction.`, 'Treating average velocity as the average of speeds when acceleration is not constant.'],
      tip: 'Write the knowns as a list (x₀, v₀, v, a, t) with signs, mark the unknown, then choose the one equation without the quantity you do not care about.'
    },
    {
      id: 'freefall', label: 'Ch 3.5–3.6', title: 'Free fall', unit: 1, link: OS + '3-5-free-fall',
      ideas: [
        R`Near Earth's surface, ignoring air resistance, every object accelerates downward at $g = 9.8\ \text{m/s}^2$ regardless of mass. Choose up as positive and use $a = -g$ throughout the flight, including at the top.`,
        R`At the highest point the velocity is zero but the acceleration is still $-g$. The time up equals the time down for a launch-and-return to the same height, and the return speed equals the launch speed.`,
        R`A dropped object: $v = -gt$, $y = y_0 - \tfrac12 gt^2$, impact speed $\sqrt{2gh}$. Thrown up at $v_0$: max height $v_0^2/(2g)$, time to top $v_0/g$.`,
        R`When the landing height differs from the launch height, use $y = y_0 + v_0 t - \tfrac12 g t^2$ and solve the quadratic; keep the positive root.`
      ],
      formulas: [
        { n: 'Free fall (up positive)', t: R`v = v_0 - gt,\quad y = y_0 + v_0t - \tfrac12 gt^2,\quad v^2 = v_0^2 - 2g\,\Delta y` },
        { n: 'Handy results', t: R`t_{\text{drop}} = \sqrt{2h/g},\quad v_{\text{impact}} = \sqrt{2gh},\quad h_{\max} = \frac{v_0^2}{2g},\quad t_{\text{top}} = \frac{v_0}{g}` }
      ],
      example: { p: R`A ball is thrown straight up at 15 m/s from the edge of a 20 m building. Find the maximum height above the ground, the time to hit the ground, and the impact speed.`, s: R`Max height: $20 + \frac{15^2}{2(9.8)} = 20 + 11.5 = 31.5$ m. Landing: $-20 = 15t - 4.9t^2 \Rightarrow 4.9t^2 - 15t - 20 = 0 \Rightarrow t = \frac{15 + \sqrt{225 + 392}}{9.8} = 4.07$ s. Impact speed: $v^2 = 15^2 + 2(9.8)(20) = 617 \Rightarrow v = 24.8$ m/s.` },
      pitfalls: ['Setting a = 0 at the top of the flight.', 'Forgetting that a downward displacement is negative when up is positive.', 'Using g = 10 on a problem set that specifies 9.8 (Expert TA tolerance is tight).'],
      tip: 'Sketch the trajectory with y = 0 at the ground and label y₀, v₀ and the final y. Half the free-fall mistakes are sign mistakes.'
    },
    {
      id: 'kin2d', label: 'Ch 4.1–4.2', title: 'Motion in two dimensions', unit: 1, link: OS + '4-1-displacement-and-velocity-vectors',
      ideas: [
        R`Position, velocity and acceleration are vectors: $\vec r = x\hat i + y\hat j$, $\vec v = d\vec r/dt$, $\vec a = d\vec v/dt$. The $x$ and $y$ motions are <b>independent</b>: solve each with the 1D equations, linked only by time.`,
        R`The velocity vector is tangent to the path. The acceleration vector points toward the inside of a curve; it has a component along the velocity (changing speed) and one perpendicular (changing direction).`,
        R`Average velocity is displacement over time (a vector); average speed is distance over time (a scalar). On a round trip the average velocity is zero.`
      ],
      formulas: [
        { n: 'Vector kinematics', t: R`\vec v_{\text{avg}} = \frac{\Delta\vec r}{\Delta t},\quad \vec a_{\text{avg}} = \frac{\Delta\vec v}{\Delta t},\quad \vec v = \frac{d\vec r}{dt},\quad \vec a = \frac{d\vec v}{dt}` },
        { n: 'Constant acceleration, each axis', t: R`x = x_0 + v_{0x}t + \tfrac12 a_xt^2,\qquad y = y_0 + v_{0y}t + \tfrac12 a_yt^2` }
      ],
      example: { p: R`A drone moves from $(2, 5)$ m to $(14, 0)$ m in 4.0 s. Find its average velocity.`, s: R`$\Delta\vec r = (12, -5)$ m, so $\vec v_{\text{avg}} = (3.0, -1.25)$ m/s; magnitude $\sqrt{9 + 1.5625} = 3.25$ m/s, direction $\tan^{-1}(-1.25/3) = -22.6^\circ$ (below the $+x$ axis).` },
      pitfalls: ['Mixing an x-equation with a y-quantity. Keep two columns.', 'Assuming acceleration is along the velocity; in curved motion it is not.'],
      tip: 'Time is the only quantity shared by the x and y columns. If you find t from one axis, carry it to the other.'
    },
    {
      id: 'projectile', label: 'Ch 4.3', title: 'Projectile motion', unit: 1, link: OS + '4-3-projectile-motion',
      ideas: [
        R`A projectile has $a_x = 0$ (constant horizontal velocity) and $a_y = -g$ (free fall vertically). Launch components: $v_{0x} = v_0\cos\theta$, $v_{0y} = v_0\sin\theta$.`,
        R`Time of flight comes from the <em>vertical</em> equation; horizontal range is then $x = v_{0x}t$. At the top $v_y = 0$ but $v_x$ is unchanged, so the speed at the top is $v_0\cos\theta$, not zero.`,
        R`Level ground shortcuts: $T = 2v_0\sin\theta/g$, $R = v_0^2\sin(2\theta)/g$ (max at $45^\circ$; complementary angles give equal ranges), $H = v_0^2\sin^2\theta/(2g)$.`,
        R`Horizontal launch from height $h$: $t = \sqrt{2h/g}$, $x = v_0 t$; impact speed $\sqrt{v_0^2 + 2gh}$ (energy works too).`,
        R`The trajectory is a parabola: $y = x\tan\theta - \dfrac{g x^2}{2v_0^2\cos^2\theta}$.`
      ],
      formulas: [
        { n: 'Components of motion', t: R`x = v_0\cos\theta\; t,\qquad y = y_0 + v_0\sin\theta\; t - \tfrac12 gt^2,\qquad v_y = v_0\sin\theta - gt` },
        { n: 'Level ground', t: R`T = \frac{2v_0\sin\theta}{g},\quad R = \frac{v_0^2\sin 2\theta}{g},\quad H = \frac{v_0^2\sin^2\theta}{2g}` }
      ],
      example: { p: R`A ball is kicked at 20 m/s at $35^\circ$ above horizontal on level ground. Find the flight time, range and maximum height.`, s: R`$v_{0x} = 16.4$, $v_{0y} = 11.5$ m/s. $T = 2(11.5)/9.8 = 2.34$ s. $R = 16.4(2.34) = 38.4$ m (or $400\sin70^\circ/9.8$). $H = 11.5^2/(19.6) = 6.71$ m.` },
      pitfalls: ['Using the range formula when the landing height differs from the launch height.', 'Saying the velocity is zero at the top (only v_y is).', 'Forgetting that the horizontal speed never changes.'],
      tip: 'Use the simulator on this site: set the launch angle to 30° and 60° and confirm the ranges match. Then try the same thing from a cliff and see why the shortcut fails.'
    },
    {
      id: 'circkin', label: 'Ch 4.4–4.5', title: 'Uniform circular motion and relative motion', unit: 1, link: OS + '4-4-uniform-circular-motion',
      ideas: [
        R`Moving in a circle at constant speed still means accelerating, because the velocity's direction changes. The <b>centripetal acceleration</b> points toward the center with magnitude $a_c = v^2/r$.`,
        R`Period $T$ is the time for one revolution: $v = 2\pi r/T$, so $a_c = 4\pi^2 r/T^2$. Angular speed $\omega = 2\pi/T$ and $v = r\omega$, $a_c = \omega^2 r$.`,
        R`If the speed also changes there is a tangential acceleration $a_t = dv/dt$; the total acceleration is the vector sum of $a_c$ (radial) and $a_t$ (tangential).`,
        R`<b>Relative velocity:</b> $\vec v_{A/C} = \vec v_{A/B} + \vec v_{B/C}$ (subscripts chain like fractions). A boat heading straight across a river is carried downstream; its ground velocity is the vector sum.`
      ],
      formulas: [
        { n: 'Circular motion', t: R`a_c = \frac{v^2}{r} = \omega^2 r = \frac{4\pi^2 r}{T^2},\qquad v = \frac{2\pi r}{T} = r\omega` },
        { n: 'Relative motion', t: R`\vec v_{\text{boat/ground}} = \vec v_{\text{boat/water}} + \vec v_{\text{water/ground}}` }
      ],
      example: { p: R`A boat can move at 4.0 m/s in still water and aims straight across a river flowing at 3.0 m/s. The river is 120 m wide. How long does the crossing take, and how far downstream does the boat land?`, s: R`Crossing uses only the boat's across-river velocity: $t = 120/4 = 30$ s. Downstream drift $= 3(30) = 90$ m. Ground speed $\sqrt{16+9} = 5$ m/s at $36.9^\circ$ downstream of straight across.` },
      pitfalls: ['Drawing the centripetal acceleration tangent to the circle; it points to the center.', 'Confusing period (seconds) with frequency (revolutions per second).', 'Adding relative speeds as scalars when the velocities are not parallel.'],
      tip: R`In clicker questions about a car on a curve: constant speed does <em>not</em> mean zero acceleration. The net force must point toward the center.`
    },
    {
      id: 'newton', label: 'Ch 5.1–5.5', title: 'Newton’s laws of motion', unit: 1, link: OS + '5-3-newtons-second-law',
      ideas: [
        R`<b>First law:</b> with zero net force an object keeps a constant velocity (including staying at rest). "At rest" and "moving at constant speed in a straight line" are the same situation dynamically.`,
        R`<b>Second law:</b> $\sum\vec F = m\vec a$. Net force and acceleration point the same way. Apply it separately in $x$ and $y$: $\sum F_x = ma_x$, $\sum F_y = ma_y$.`,
        R`<b>Third law:</b> forces come in pairs acting on <em>different</em> objects, equal in magnitude and opposite in direction. The pair of "Earth pulls on ball" is "ball pulls on Earth", never the normal force.`,
        R`Mass measures inertia (kg) and is the same everywhere; weight $w = mg$ is a force (N) and depends on $g$.`,
        R`Forces are interactions: every force on your object comes from something touching it (contact forces: normal, tension, friction, push) or from gravity (long range). Name the agent for each.`
      ],
      formulas: [
        { n: 'Second law', t: R`\sum\vec F = m\vec a\qquad \sum F_x = ma_x,\quad \sum F_y = ma_y` },
        { n: 'Weight', t: R`\vec w = m\vec g,\qquad g = 9.8\ \text{m/s}^2` }
      ],
      example: { p: R`A 3.0 kg box on frictionless ice is pushed by 12 N eastward and 9 N northward. Find its acceleration.`, s: R`$F_{\text{net}} = \sqrt{12^2 + 9^2} = 15$ N at $\tan^{-1}(9/12) = 36.9^\circ$ north of east. $a = 15/3 = 5.0\ \text{m/s}^2$ in that direction.` },
      pitfalls: ['Including a "force of motion" or "force of the throw" on a ball already in flight. Only gravity (and drag) act on it.', 'Pairing weight with the normal force as a third-law pair. Both act on the same object, so they cannot be a pair.', 'Assuming a larger mass exerts a larger force on a smaller one in a collision. The forces are equal; the accelerations differ.'],
      tip: 'Clicker questions test the third law constantly: a truck and a bug hitting each other feel equal forces. Say it out loud until it is automatic.'
    },
    {
      id: 'forces', label: 'Ch 5.6–5.7', title: 'Common forces and free-body diagrams', unit: 1, link: OS + '5-7-drawing-free-body-diagrams',
      ideas: [
        R`<b>Normal force</b> $N$: perpendicular to the surface, as large as needed to prevent the object from sinking in. It is <em>not</em> always $mg$: on an incline $N = mg\cos\theta$; in an accelerating elevator $N = m(g + a)$; with an extra downward push it grows.`,
        R`<b>Tension</b> $T$: along the rope, same magnitude at both ends of a massless rope, pulls (never pushes). An ideal pulley changes direction, not magnitude.`,
        R`<b>Weight</b> $mg$ down; <b>friction</b> parallel to the surface, opposing sliding (or the tendency to slide); <b>spring</b> force $F = -kx$.`,
        R`<b>Free-body diagram recipe:</b> isolate one object as a dot; draw every force on it with a label and agent; choose axes (along the acceleration is smartest, tilted for inclines); resolve; write $\sum F_x = ma_x$ and $\sum F_y = ma_y$.`,
        R`Equilibrium means $\vec a = 0$: every component sum is zero. This is how you solve for tensions in hanging signs and cables.`
      ],
      formulas: [
        { n: 'Incline (tilted axes)', t: R`N = mg\cos\theta,\qquad \text{along the slope: } mg\sin\theta` },
        { n: 'Elevator / apparent weight', t: R`N - mg = ma_y \Rightarrow N = m(g + a_y)` },
        { n: 'Hooke’s law', t: R`F_{\text{spring}} = -kx` }
      ],
      example: { p: R`A 20 kg traffic light hangs from two cables that each make $30^\circ$ with the horizontal. Find the tension.`, s: R`Vertical equilibrium: $2T\sin30^\circ = mg = 196$ N, so $T = 196$ N. (The horizontal components cancel by symmetry.)` },
      pitfalls: ['Drawing the normal force vertical on an incline. It is perpendicular to the surface.', 'Putting forces on the diagram that the object exerts on other things.', 'Choosing horizontal axes on an incline, which drags trig into every equation.'],
      tip: 'A correct free-body diagram is worth most of the credit on an exam problem and makes the algebra almost automatic. Never skip it.'
    },
    {
      id: 'applynewton', label: 'Ch 6.1', title: 'Applying Newton’s laws', unit: 2, link: OS + '6-1-solving-problems-with-newtons-laws',
      ideas: [
        R`Multi-object systems (Atwood machines, blocks connected by ropes, stacked blocks): draw one free-body diagram <em>per object</em>, use the same $a$ magnitude for objects tied together, and add the equations to eliminate the tension.`,
        R`Frictionless incline: $a = g\sin\theta$ down the slope, independent of mass. Add friction later as an extra term.`,
        R`Elevator problems: the scale reads the normal force, $N = m(g + a)$ with $a$ positive upward. In free fall $N = 0$ ("weightless").`,
        R`Blocks pushed together: treat the whole system to get $a = F/(m_1+m_2)$, then isolate one block to get the contact force $m_2 a$.`,
        R`Sanity checks: heavier side of an Atwood machine accelerates down; $a$ must be less than $g$; tension must lie between the two weights.`
      ],
      formulas: [
        { n: 'Atwood machine', t: R`a = \frac{(m_2 - m_1)g}{m_1 + m_2},\qquad T = \frac{2m_1m_2}{m_1+m_2}\,g` },
        { n: 'Block on table pulled by hanging mass', t: R`a = \frac{m_2 g}{m_1 + m_2},\qquad T = m_1 a\ \text{(frictionless)}` },
        { n: 'Frictionless incline', t: R`a = g\sin\theta,\qquad N = mg\cos\theta` }
      ],
      example: { p: R`Masses 3.0 kg and 5.0 kg hang from an ideal pulley. Find the acceleration and the tension.`, s: R`$a = \frac{(5-3)(9.8)}{8} = 2.45\ \text{m/s}^2$ (5 kg side down). From the 3 kg block: $T - 3g = 3a \Rightarrow T = 3(9.8 + 2.45) = 36.8$ N. Check: between $29.4$ N and $49$ N.` },
      pitfalls: ['Using a different acceleration for two blocks joined by a taut rope.', 'Assuming the tension equals the hanging weight when the system is accelerating.', 'Forgetting that a pulley with two rope segments pulling up on it exerts 2T.'],
      tip: 'For connected objects, write one Newton equation per object in the direction of motion, then add them: the internal tensions cancel and a pops out.'
    },
    {
      id: 'friction', label: 'Ch 6.2', title: 'Friction', unit: 2, link: OS + '6-2-friction',
      ideas: [
        R`<b>Static friction</b> adjusts itself to prevent sliding, up to a maximum $f_s \le \mu_s N$. It is an inequality; only at the verge of slipping is $f_s = \mu_s N$.`,
        R`<b>Kinetic friction</b> has a fixed magnitude $f_k = \mu_k N$ while sliding, directed opposite the relative motion. Usually $\mu_k < \mu_s$.`,
        R`Friction depends on the normal force, not on the weight directly and not on contact area. Increase $N$ (push down) and friction rises.`,
        R`Incline: an object stays put if $\tan\theta \le \mu_s$; once sliding, $a = g(\sin\theta - \mu_k\cos\theta)$.`,
        R`Friction can point in the direction of motion (it is what accelerates a car forward, and what keeps a box from sliding off an accelerating truck bed).`
      ],
      formulas: [
        { n: 'Static / kinetic', t: R`f_s \le \mu_s N,\qquad f_k = \mu_k N` },
        { n: 'Sliding on an incline', t: R`a = g(\sin\theta - \mu_k\cos\theta),\qquad \text{holds if } \tan\theta \le \mu_s` },
        { n: 'Stopping on a flat surface', t: R`a = \mu_k g,\qquad d = \frac{v^2}{2\mu_k g}` }
      ],
      example: { p: R`A 10 kg crate on a floor with $\mu_s = 0.5$, $\mu_k = 0.3$ is pushed horizontally with 60 N. Does it move, and if so with what acceleration?`, s: R`$N = 98$ N, so $f_{s,\max} = 49$ N $< 60$ N: it moves. Sliding: $f_k = 0.3(98) = 29.4$ N, $a = (60 - 29.4)/10 = 3.06\ \text{m/s}^2$.` },
      pitfalls: ['Setting static friction equal to μₛN when the object is not about to slip.', 'Using N = mg on an incline or when there is a vertical applied force.', 'Giving friction the wrong direction for a box on an accelerating truck (it points forward).'],
      tip: 'Ask: is it sliding? If yes, use μₖN. If not, friction is whatever equilibrium requires, and you check it against μₛN afterward.'
    },
    {
      id: 'circdyn', label: 'Ch 6.3–6.4', title: 'Centripetal force, banked curves, and drag', unit: 2, link: OS + '6-3-centripetal-force',
      ideas: [
        R`"Centripetal force" is not a new force. It is the name for the <em>net</em> force component toward the center, $\sum F_{\text{radial}} = mv^2/r$, supplied by whatever real forces are present: tension, friction, normal force, gravity.`,
        R`Flat curve: friction supplies it, so $v_{\max} = \sqrt{\mu_s g r}$. Banked curve with no friction: $\tan\theta = v^2/(rg)$.`,
        R`Vertical circles: at the bottom $T - mg = mv^2/r$ (tension largest); at the top $T + mg = mv^2/r$, so the minimum speed to keep a taut string or stay on a loop is $v = \sqrt{gr}$.`,
        R`Drag grows with speed ($F_D = \tfrac12 C\rho A v^2$ for air). <b>Terminal speed</b> is reached when drag equals weight: net force zero, constant velocity, $v_t = \sqrt{2mg/(C\rho A)}$.`
      ],
      formulas: [
        { n: 'Radial second law', t: R`\sum F_{\text{radial}} = \frac{mv^2}{r}` },
        { n: 'Curves', t: R`v_{\max} = \sqrt{\mu_s g r}\ \text{(flat)},\qquad \tan\theta = \frac{v^2}{rg}\ \text{(banked, no friction)}` },
        { n: 'Vertical circle', t: R`T_{\text{bottom}} = m\!\left(g + \frac{v^2}{r}\right),\quad T_{\text{top}} = m\!\left(\frac{v^2}{r} - g\right),\quad v_{\min,\text{top}} = \sqrt{gr}` },
        { n: 'Terminal speed', t: R`v_t = \sqrt{\frac{2mg}{C\rho A}}` }
      ],
      example: { p: R`A 1200 kg car rounds a flat curve of radius 50 m at 15 m/s. Find the required friction force and the minimum $\mu_s$.`, s: R`$F = mv^2/r = 1200(225)/50 = 5400$ N toward the center. $\mu_s \ge F/(mg) = 5400/11760 = 0.46$.` },
      pitfalls: ['Adding a "centrifugal force" pointing outward on the free-body diagram.', 'Forgetting gravity in a vertical circle.', 'Taking the top-of-loop minimum speed as zero.'],
      tip: 'On the radial axis, take "toward the center" as positive and set the sum equal to mv²/r. Everything else is bookkeeping.'
    },
    {
      id: 'statics', label: 'Ch 12.1–12.2', title: 'Static equilibrium and torque', unit: 2, link: OS + '12-1-conditions-for-static-equilibrium',
      ideas: [
        R`<b>Torque</b> measures a force's ability to rotate an object about a pivot: $\tau = rF\sin\theta = F\,d_\perp$ (lever arm $d_\perp$ is the perpendicular distance from the pivot to the line of the force). Counterclockwise is usually taken positive.`,
        R`<b>Static equilibrium</b> needs both $\sum\vec F = 0$ and $\sum\tau = 0$ about <em>any</em> point. Choose the pivot where an unknown force acts so that it drops out of the torque equation.`,
        R`Weight acts at the center of gravity. A uniform beam's weight acts at its midpoint.`,
        R`Classic set-ups: seesaw/balance ($m_1d_1 = m_2d_2$), beam on two supports, ladder against a wall (friction at the floor, normal at the wall), hanging sign with a strut.`
      ],
      formulas: [
        { n: 'Torque', t: R`\tau = rF\sin\theta = F\,d_\perp,\qquad \vec\tau = \vec r\times\vec F` },
        { n: 'Equilibrium', t: R`\sum F_x = 0,\quad \sum F_y = 0,\quad \sum\tau = 0\ \text{(any pivot)}` },
        { n: 'Balance', t: R`m_1 d_1 = m_2 d_2` }
      ],
      example: { p: R`A 6.0 m uniform plank (20 kg) rests on supports at its ends. A 60 kg person stands 2.0 m from the left end. Find the support forces.`, s: R`Torques about the left end: $F_R(6) = 20(9.8)(3) + 60(9.8)(2) = 588 + 1176 = 1764 \Rightarrow F_R = 294$ N. Forces: $F_L = (80)(9.8) - 294 = 490$ N.` },
      pitfalls: ['Using the full distance instead of the perpendicular lever arm for an angled force.', 'Forgetting the beam’s own weight at its center.', 'Assigning the same sign to clockwise and counterclockwise torques.'],
      tip: 'Pick the pivot at the point with the most unknown forces. One clean torque equation usually solves the whole problem.'
    },
    {
      id: 'fluids', label: 'Ch 14.1–14.4', title: 'Static fluids', unit: 2, link: OS + '14-4-archimedes-principle-and-buoyancy',
      ideas: [
        R`Density $\rho = m/V$ (water: $1000\ \text{kg/m}^3$). Pressure $P = F/A$ (Pa); atmospheric pressure $P_0 = 1.013\times10^5$ Pa.`,
        R`Pressure increases with depth: $P = P_0 + \rho g h$. Gauge pressure is $\rho g h$ (what a tire gauge reads); absolute pressure adds $P_0$. Pressure depends only on depth, not on the container's shape.`,
        R`<b>Pascal's principle:</b> a pressure change is transmitted undiminished through an enclosed fluid, so a hydraulic lift multiplies force: $F_2 = F_1 A_2/A_1$ (but the small piston moves farther: work is conserved).`,
        R`<b>Archimedes:</b> the buoyant force equals the weight of the displaced fluid, $F_B = \rho_{\text{fluid}} V_{\text{sub}}\, g$. A floating object has $F_B = mg$, so the submerged fraction is $\rho_{\text{obj}}/\rho_{\text{fluid}}$. A fully submerged object sinks if $\rho_{\text{obj}} > \rho_{\text{fluid}}$.`
      ],
      formulas: [
        { n: 'Pressure with depth', t: R`P = P_0 + \rho g h,\qquad P_{\text{gauge}} = \rho g h` },
        { n: 'Pascal', t: R`\frac{F_1}{A_1} = \frac{F_2}{A_2}` },
        { n: 'Buoyancy', t: R`F_B = \rho_{\text{fluid}}\, V_{\text{sub}}\, g,\qquad \frac{V_{\text{sub}}}{V} = \frac{\rho_{\text{obj}}}{\rho_{\text{fluid}}}\ \text{(floating)}` }
      ],
      example: { p: R`A 2.0 kg block of density $800\ \text{kg/m}^3$ floats in water. What fraction is submerged, and what is the buoyant force?`, s: R`Fraction $= 800/1000 = 0.80$. Floating means $F_B = mg = 19.6$ N. (Check: $V = 2/800 = 2.5\times10^{-3}\ \text{m}^3$; $0.8V\rho_w g = 2.0\times10^{-3}(1000)(9.8) = 19.6$ N.)` },
      pitfalls: ['Using the object’s density instead of the fluid’s in the buoyant force.', 'Forgetting that gauge and absolute pressure differ by one atmosphere.', 'Thinking a wider tank means more pressure at the bottom.'],
      tip: 'Apparent weight under water = true weight − buoyant force. That one line solves most "scale reading in water" problems.'
    },
    {
      id: 'rotkin', label: 'Ch 10.1–10.3', title: 'Rotational kinematics', unit: 2, link: OS + '10-2-rotation-with-constant-angular-acceleration',
      ideas: [
        R`Angle $\theta$ in <b>radians</b>, angular velocity $\omega = d\theta/dt$ (rad/s), angular acceleration $\alpha = d\omega/dt$ (rad/s²). One revolution is $2\pi$ rad; rpm converts by $\omega = \text{rpm}\times 2\pi/60$.`,
        R`Constant $\alpha$ obeys the same four equations as 1D kinematics with $x\to\theta$, $v\to\omega$, $a\to\alpha$.`,
        R`Link to a point at radius $r$: arc length $s = r\theta$, tangential speed $v = r\omega$, tangential acceleration $a_t = r\alpha$, centripetal acceleration $a_c = r\omega^2$. Total acceleration magnitude $\sqrt{a_t^2 + a_c^2}$.`,
        R`Every point on a rigid body shares the same $\omega$ and $\alpha$; points farther out move faster.`
      ],
      formulas: [
        { n: 'Constant angular acceleration', t: R`\omega = \omega_0 + \alpha t,\quad \theta = \theta_0 + \omega_0 t + \tfrac12\alpha t^2,\quad \omega^2 = \omega_0^2 + 2\alpha\,\Delta\theta` },
        { n: 'Linear ↔ angular', t: R`s = r\theta,\quad v = r\omega,\quad a_t = r\alpha,\quad a_c = r\omega^2 = \frac{v^2}{r}` }
      ],
      example: { p: R`A wheel spins up from rest to 1200 rpm in 5.0 s. Find $\alpha$ and the number of revolutions.`, s: R`$\omega = 1200(2\pi)/60 = 125.7$ rad/s; $\alpha = 125.7/5 = 25.1\ \text{rad/s}^2$. $\theta = \tfrac12(25.1)(25) = 314$ rad $= 50$ revolutions.` },
      pitfalls: ['Leaving angles in degrees or revolutions inside v = rω.', 'Mixing tangential and centripetal acceleration; they are perpendicular.'],
      tip: 'Translate the whole problem into radians first, solve with the "same" kinematics equations, and convert back to revolutions at the end.'
    },
    {
      id: 'work', label: 'Ch 7', title: 'Work, kinetic energy, and power', unit: 2, link: OS + '7-3-work-energy-theorem',
      ideas: [
        R`Work by a constant force: $W = \vec F\cdot\vec d = Fd\cos\theta$, where $\theta$ is between the force and the displacement. Forces perpendicular to motion (normal force, centripetal tension) do zero work; friction on a sliding object does negative work.`,
        R`Variable force: $W = \int F_x\,dx$ = area under the $F$–$x$ graph. A spring stretched from 0 to $x$ stores $\tfrac12 kx^2$.`,
        R`<b>Work–energy theorem:</b> $W_{\text{net}} = \Delta K = \tfrac12 mv_f^2 - \tfrac12 mv_i^2$. It replaces kinematics when you know forces and distances but do not care about time.`,
        R`<b>Power</b> is the rate of doing work: $P = W/t = \vec F\cdot\vec v$. Units: watt; $1\ \text{hp} = 746$ W. Lifting at constant speed: $P = mgv$.`
      ],
      formulas: [
        { n: 'Work', t: R`W = Fd\cos\theta = \vec F\cdot\vec d,\qquad W = \int F_x\,dx` },
        { n: 'Kinetic energy and W–E theorem', t: R`K = \tfrac12 mv^2,\qquad W_{\text{net}} = \Delta K` },
        { n: 'Power', t: R`P = \frac{W}{t} = Fv\cos\theta` }
      ],
      example: { p: R`A 50 kg sled at 4.0 m/s slides to rest on snow with $\mu_k = 0.10$. How far does it go? Use energy.`, s: R`Only friction does work: $W = -\mu_k mg\,d = \Delta K = 0 - \tfrac12(50)(16) = -400$ J. So $d = 400/(0.10\cdot50\cdot9.8) = 8.16$ m.` },
      pitfalls: ['Using the angle between the force and the vertical instead of the displacement.', 'Counting the normal force as doing work on a block sliding on a surface.', 'Forgetting that KE depends on speed squared: doubling speed quadruples KE and stopping distance.'],
      tip: 'If a problem gives forces and distances and asks for speed (or vice versa) with no mention of time, use the work-energy theorem.'
    },
    {
      id: 'energy', label: 'Ch 8', title: 'Potential energy and conservation of energy', unit: 2, link: OS + '8-3-conservation-of-energy',
      ideas: [
        R`Conservative forces (gravity, springs) have potential energy: $U_g = mgy$ (any zero level you like), $U_s = \tfrac12 kx^2$. Their work is path-independent and $W_c = -\Delta U$.`,
        R`<b>Conservation of mechanical energy</b> when only conservative forces do work: $K_i + U_i = K_f + U_f$. With friction or other non-conservative forces: $K_i + U_i + W_{nc} = K_f + U_f$, where $W_{nc} = -f_k d$ for kinetic friction.`,
        R`Speed at the bottom of a frictionless track depends only on the height drop, not on the path: $v = \sqrt{2gh}$.`,
        R`Energy diagrams: the object moves where $E \ge U(x)$; turning points are where $E = U$; equilibrium where $dU/dx = 0$ (stable at a minimum of $U$).`,
        R`Energy is a scalar: no components, no directions. That is why it is often the easiest tool.`
      ],
      formulas: [
        { n: 'Potential energies', t: R`U_g = mgy,\qquad U_s = \tfrac12 kx^2,\qquad F_x = -\frac{dU}{dx}` },
        { n: 'Conservation with friction', t: R`\tfrac12 mv_i^2 + U_i - f_k d = \tfrac12 mv_f^2 + U_f` }
      ],
      example: { p: R`A 0.50 kg block compresses a spring ($k = 800$ N/m) by 0.10 m and is released on a frictionless surface, then slides up a frictionless ramp. Find the launch speed and the height reached.`, s: R`$\tfrac12 kx^2 = \tfrac12 mv^2 \Rightarrow v = x\sqrt{k/m} = 0.1\sqrt{1600} = 4.0$ m/s. Height: $mgh = \tfrac12 kx^2 = 4.0$ J $\Rightarrow h = 4/(0.5\cdot9.8) = 0.82$ m.` },
      pitfalls: ['Using energy conservation when friction acts and forgetting the −fₖd term.', 'Mixing the zero level for U mid-problem.', 'Using x for the spring stretch measured from the wrong point (it is from the natural length).'],
      tip: 'Write the energy bar chart: K and U at the start, K and U at the end, plus any friction loss. Then the equation writes itself.'
    },
    {
      id: 'momentum', label: 'Ch 9.1–9.3', title: 'Momentum and impulse', unit: 3, link: OS + '9-2-impulse-and-collisions',
      ideas: [
        R`Momentum $\vec p = m\vec v$ is a vector. Newton's second law in its general form: $\sum\vec F = d\vec p/dt$.`,
        R`<b>Impulse–momentum theorem:</b> $\vec J = \int\vec F\,dt = \vec F_{\text{avg}}\Delta t = \Delta\vec p$. A longer collision time means a smaller average force for the same momentum change (airbags, bending your knees).`,
        R`<b>Conservation of momentum:</b> if the net external force on a system is zero (or the collision is so brief that external impulses are negligible), total momentum is conserved: $\sum\vec p_i = \sum\vec p_f$, component by component.`,
        R`Recoil: a gun and bullet start at rest, so $m_g v_g = -m_b v_b$. Explosions and rockets work the same way.`
      ],
      formulas: [
        { n: 'Momentum and impulse', t: R`\vec p = m\vec v,\qquad \vec J = \vec F_{\text{avg}}\Delta t = \Delta\vec p` },
        { n: 'Conservation', t: R`m_1\vec v_{1i} + m_2\vec v_{2i} = m_1\vec v_{1f} + m_2\vec v_{2f}` }
      ],
      example: { p: R`A 0.15 kg ball moving at 20 m/s hits a wall and rebounds at 20 m/s. Contact lasts 0.010 s. Find the impulse and average force.`, s: R`Take the rebound direction positive: $\Delta p = 0.15(20) - 0.15(-20) = 6.0\ \text{kg·m/s}$. $F_{\text{avg}} = 6.0/0.010 = 600$ N, directed away from the wall.` },
      pitfalls: ['Computing Δp = m(v_f − v_i) without signs; a reversal doubles the change.', 'Applying momentum conservation while a large external force acts over the interval (e.g. gravity over a long time).'],
      tip: 'Momentum conservation is about the system. Draw a box around the objects and ask whether anything outside the box pushes on it during the event.'
    },
    {
      id: 'collisions', label: 'Ch 9.4–9.6', title: 'Collisions and center of mass', unit: 3, link: OS + '9-4-types-of-collisions',
      ideas: [
        R`All collisions in an isolated system conserve momentum. <b>Elastic</b> collisions also conserve kinetic energy; <b>inelastic</b> ones lose some KE (to heat, sound, deformation); <b>perfectly inelastic</b> ones stick together and lose the most KE possible.`,
        R`Perfectly inelastic: $v_f = \dfrac{m_1v_1 + m_2v_2}{m_1+m_2}$. Elastic with target at rest: $v_{1f} = \dfrac{m_1 - m_2}{m_1+m_2}v_{1i}$, $v_{2f} = \dfrac{2m_1}{m_1+m_2}v_{1i}$. Equal masses swap velocities.`,
        R`2D collisions: conserve $p_x$ and $p_y$ separately. Draw before and after pictures with angles.`,
        R`<b>Center of mass</b> $x_{cm} = \dfrac{\sum m_ix_i}{\sum m_i}$ moves as if all mass were there and all external forces acted on it. Internal forces (explosions, collisions) never change the center-of-mass motion.`
      ],
      formulas: [
        { n: 'Perfectly inelastic', t: R`v_f = \frac{m_1v_{1i} + m_2v_{2i}}{m_1+m_2}` },
        { n: 'Elastic, target at rest', t: R`v_{1f} = \frac{m_1-m_2}{m_1+m_2}v_{1i},\qquad v_{2f} = \frac{2m_1}{m_1+m_2}v_{1i}` },
        { n: 'Center of mass', t: R`\vec r_{cm} = \frac{\sum m_i\vec r_i}{\sum m_i},\qquad \vec v_{cm} = \frac{\vec p_{\text{total}}}{M}` }
      ],
      example: { p: R`A 2.0 kg cart at 3.0 m/s hits a 1.0 kg cart at rest and they stick. Find the final speed and the KE lost.`, s: R`$v_f = 2(3)/3 = 2.0$ m/s. $K_i = \tfrac12(2)(9) = 9$ J; $K_f = \tfrac12(3)(4) = 6$ J; lost $3$ J (33%).` },
      pitfalls: ['Assuming kinetic energy is conserved in every collision.', 'Forgetting momentum is a vector in 2D problems.', 'Using speeds without signs for head-on collisions.'],
      tip: 'Ballistic pendulum problems chain two tools: momentum conservation for the (inelastic) impact, then energy conservation for the swing. Never energy across the impact.'
    },
    {
      id: 'rotdyn', label: 'Ch 10.4–10.8', title: 'Rotational dynamics', unit: 3, link: OS + '10-7-newtons-second-law-for-rotation',
      ideas: [
        R`<b>Moment of inertia</b> $I = \sum m_ir_i^2$ (or $\int r^2\,dm$) is rotational mass: it depends on how far the mass sits from the axis. Point mass $mr^2$; hoop $MR^2$; solid disk/cylinder $\tfrac12 MR^2$; solid sphere $\tfrac25 MR^2$; thin rod about center $\tfrac1{12}ML^2$, about end $\tfrac13 ML^2$.`,
        R`<b>Newton's second law for rotation:</b> $\sum\tau = I\alpha$ about a fixed axis. Torque from a force at radius $r$: $\tau = rF\sin\theta$.`,
        R`Rotational kinetic energy $K = \tfrac12 I\omega^2$. Work by a torque $W = \tau\theta$; power $P = \tau\omega$. The work–energy theorem holds with these.`,
        R`Parallel-axis theorem: $I = I_{cm} + Md^2$.`,
        R`Pulley with mass: the two rope tensions differ, and $(T_1 - T_2)R = I\alpha$ with $a = R\alpha$.`
      ],
      formulas: [
        { n: 'Moment of inertia', t: R`I = \sum m_i r_i^2;\quad I_{\text{disk}} = \tfrac12 MR^2,\ I_{\text{sphere}} = \tfrac25 MR^2,\ I_{\text{hoop}} = MR^2,\ I_{\text{rod,center}} = \tfrac1{12}ML^2` },
        { n: 'Dynamics and energy', t: R`\sum\tau = I\alpha,\qquad K_{\text{rot}} = \tfrac12 I\omega^2,\qquad W = \tau\theta,\qquad P = \tau\omega` }
      ],
      example: { p: R`A 4.0 kg solid disk of radius 0.20 m is spun up by a 10 N tangential force at its rim. Find $\alpha$.`, s: R`$I = \tfrac12(4)(0.04) = 0.08\ \text{kg·m}^2$; $\tau = 10(0.20) = 2.0$ N·m; $\alpha = 2.0/0.08 = 25\ \text{rad/s}^2$.` },
      pitfalls: ['Using the wrong moment of inertia (disk vs hoop) or the wrong axis.', 'Using the diameter instead of the radius in I.', 'Assuming the rope tension equals the hanging weight when a massive pulley accelerates.'],
      tip: 'The rotational world is a dictionary: m→I, F→τ, a→α, v→ω, x→θ, p→L. Every linear formula you know has a twin.'
    },
    {
      id: 'angmom', label: 'Ch 11', title: 'Rolling motion and angular momentum', unit: 3, link: OS + '11-3-conservation-of-angular-momentum',
      ideas: [
        R`<b>Rolling without slipping:</b> $v_{cm} = R\omega$, $a_{cm} = R\alpha$. Total KE $= \tfrac12 mv_{cm}^2 + \tfrac12 I\omega^2$. Rolling down a ramp: $v = \sqrt{\dfrac{2gh}{1 + I/(mR^2)}}$, so a sphere ($\tfrac25$) beats a disk ($\tfrac12$) beats a hoop ($1$), independent of mass and radius.`,
        R`<b>Angular momentum</b> of a rigid body $L = I\omega$; of a particle $L = mvr\sin\theta$ ($= mvr$ for circular motion). Newton for rotation: $\sum\vec\tau = d\vec L/dt$.`,
        R`<b>Conservation:</b> with zero net external torque, $L$ is conserved. Ice skater pulling in arms: $I$ drops so $\omega$ rises ($I_i\omega_i = I_f\omega_f$); kinetic energy increases (the skater does work).`,
        R`Direction by the right-hand rule: curl fingers with the rotation, thumb gives $\vec\omega$ and $\vec L$.`
      ],
      formulas: [
        { n: 'Rolling', t: R`v_{cm} = R\omega,\qquad K = \tfrac12 mv_{cm}^2 + \tfrac12 I\omega^2,\qquad v_{\text{bottom}} = \sqrt{\frac{2gh}{1 + I/(mR^2)}}` },
        { n: 'Angular momentum', t: R`L = I\omega,\qquad L = mvr\sin\theta,\qquad \sum\tau = \frac{dL}{dt},\qquad I_i\omega_i = I_f\omega_f` }
      ],
      example: { p: R`A skater spins at 2.0 rev/s with arms out ($I = 4.0\ \text{kg·m}^2$) and pulls them in ($I = 1.6\ \text{kg·m}^2$). Find the new spin rate and the change in KE.`, s: R`$\omega_f = 4.0(2.0)/1.6 = 5.0$ rev/s. In rad/s: $\omega_i = 12.6$, $\omega_f = 31.4$. $K_i = \tfrac12(4)(12.6^2) = 316$ J, $K_f = \tfrac12(1.6)(31.4^2) = 790$ J: KE rises by 474 J, supplied by the skater's muscles.` },
      pitfalls: ['Forgetting the translational KE of a rolling object (or the rotational part).', 'Expecting kinetic energy to be conserved when angular momentum is.', 'Using v = Rω for a slipping wheel.'],
      tip: R`For "which rolls down fastest" questions, only the shape factor $I/(mR^2)$ matters: smaller factor wins. Mass and radius cancel.`
    },
    {
      id: 'gravity', label: 'Ch 13', title: 'Gravitation', unit: 3, link: OS + '13-1-newtons-law-of-universal-gravitation',
      ideas: [
        R`<b>Newton's law of gravitation:</b> $F = \dfrac{Gm_1m_2}{r^2}$, attractive, along the line joining the centers, with $G = 6.67\times10^{-11}\ \text{N·m}^2/\text{kg}^2$. $r$ is measured from center to center.`,
        R`Surface gravity $g = GM/R^2$ (Earth: $M = 5.97\times10^{24}$ kg, $R = 6.37\times10^6$ m gives 9.8). At altitude $h$: $g = g_0\left(\dfrac{R}{R+h}\right)^2$.`,
        R`Circular orbits: gravity supplies the centripetal force, $\dfrac{GMm}{r^2} = \dfrac{mv^2}{r}$, so $v = \sqrt{GM/r}$ and $T = 2\pi\sqrt{r^3/GM}$ (Kepler's third law). Faster orbits are lower.`,
        R`Gravitational potential energy with the zero at infinity: $U = -\dfrac{GMm}{r}$. Orbital energy $E = -\dfrac{GMm}{2r}$ (negative: bound). Escape speed from a surface: $v_{esc} = \sqrt{2GM/R}$ (11.2 km/s for Earth).`,
        R`Kepler: orbits are ellipses with the Sun at a focus; equal areas in equal times (angular momentum conservation); $T^2 \propto a^3$.`
      ],
      formulas: [
        { n: 'Force and field', t: R`F = \frac{Gm_1m_2}{r^2},\qquad g = \frac{GM}{R^2}` },
        { n: 'Orbits', t: R`v = \sqrt{\frac{GM}{r}},\qquad T^2 = \frac{4\pi^2}{GM}r^3,\qquad E = -\frac{GMm}{2r}` },
        { n: 'Energy', t: R`U = -\frac{GMm}{r},\qquad v_{esc} = \sqrt{\frac{2GM}{R}}` }
      ],
      example: { p: R`Find the speed and period of a satellite 400 km above Earth's surface.`, s: R`$r = 6.37\times10^6 + 4.0\times10^5 = 6.77\times10^6$ m. $v = \sqrt{6.67\times10^{-11}(5.97\times10^{24})/6.77\times10^6} = 7.67\times10^3$ m/s. $T = 2\pi r/v = 5550$ s $\approx 92$ min.` },
      pitfalls: ['Using altitude instead of distance from Earth’s center.', 'Using U = mgh far from the surface.', 'Forgetting that G and g are different things.'],
      tip: 'Almost every orbit problem is "gravity = centripetal force". Write that one line and solve for whatever is asked.'
    },
    {
      id: 'shm', label: 'Ch 15.1–15.3', title: 'Simple harmonic motion', unit: 4, link: OS + '15-1-simple-harmonic-motion',
      ideas: [
        R`SHM happens whenever the restoring force is proportional to displacement: $F = -kx$ gives $a = -\dfrac{k}{m}x$. Solution $x(t) = A\cos(\omega t + \phi)$ with $\omega = \sqrt{k/m}$, period $T = 2\pi\sqrt{m/k}$, frequency $f = 1/T$.`,
        R`Velocity $v(t) = -A\omega\sin(\omega t + \phi)$, acceleration $a(t) = -A\omega^2\cos(\omega t+\phi) = -\omega^2 x$. Max speed $A\omega$ at the center; max acceleration $A\omega^2$ at the extremes (where $v = 0$).`,
        R`The period does <em>not</em> depend on amplitude (for an ideal spring) or on $g$ (a vertical spring just shifts the equilibrium point).`,
        R`<b>Energy:</b> $E = \tfrac12 kA^2 = \tfrac12 mv^2 + \tfrac12 kx^2$, sloshing between kinetic and potential. Speed at position $x$: $v = \omega\sqrt{A^2 - x^2}$.`,
        R`SHM is the shadow of uniform circular motion: the projection of a point moving on a circle of radius $A$ at angular speed $\omega$.`
      ],
      formulas: [
        { n: 'Motion', t: R`x = A\cos(\omega t+\phi),\quad \omega = \sqrt{\frac km},\quad T = 2\pi\sqrt{\frac mk},\quad v_{\max} = A\omega,\quad a_{\max} = A\omega^2` },
        { n: 'Energy', t: R`E = \tfrac12 kA^2 = \tfrac12 mv^2 + \tfrac12 kx^2,\qquad v = \omega\sqrt{A^2 - x^2}` }
      ],
      example: { p: R`A 0.50 kg mass on a 200 N/m spring oscillates with amplitude 0.10 m. Find $T$, $v_{\max}$, and the speed at $x = 0.06$ m.`, s: R`$\omega = \sqrt{400} = 20$ rad/s, $T = 2\pi/20 = 0.314$ s. $v_{\max} = 0.1(20) = 2.0$ m/s. $v = 20\sqrt{0.01 - 0.0036} = 1.6$ m/s.` },
      pitfalls: ['Confusing ω (rad/s) with f (Hz); ω = 2πf.', 'Thinking a larger amplitude changes the period.', 'Using degrees in cos(ωt).'],
      tip: 'Two anchors: v is biggest at the center, a is biggest at the ends. Most conceptual questions reduce to that.'
    },
    {
      id: 'pendulum', label: 'Ch 15.4–15.6', title: 'Pendulums, damping, and resonance', unit: 4, link: OS + '15-4-pendulums',
      ideas: [
        R`<b>Simple pendulum</b> (small angles): $T = 2\pi\sqrt{L/g}$, independent of mass and (for small swings) amplitude. Physical pendulum: $T = 2\pi\sqrt{I/(mgd)}$ with $d$ from pivot to center of mass.`,
        R`Measuring $g$: time many swings, $g = 4\pi^2L/T^2$. Longer pendulum, longer period; on the Moon the period grows.`,
        R`<b>Damping:</b> friction or drag makes the amplitude decay exponentially; the frequency drops slightly. Underdamped oscillates, critically damped returns fastest without oscillating, overdamped creeps back.`,
        R`<b>Forced oscillations and resonance:</b> driving at the natural frequency $\omega_0$ produces the largest amplitude (pushing a swing, shattering glass, Tacoma Narrows). Less damping makes the resonance peak sharper and taller.`
      ],
      formulas: [
        { n: 'Pendulums', t: R`T = 2\pi\sqrt{\frac Lg}\ \text{(simple)},\qquad T = 2\pi\sqrt{\frac{I}{mgd}}\ \text{(physical)}` },
        { n: 'Damped amplitude', t: R`x(t) = A_0 e^{-bt/2m}\cos(\omega' t + \phi)` }
      ],
      example: { p: R`What length pendulum has a period of 2.0 s on Earth?`, s: R`$L = gT^2/(4\pi^2) = 9.8(4)/39.5 = 0.993$ m: the classic "seconds pendulum".` },
      pitfalls: ['Using the pendulum formula for a large-angle swing (it is a small-angle approximation).', 'Assuming a heavier bob swings slower.'],
      tip: 'For pendulum questions, ask what changes L or g. Nothing else matters (at small angles).'
    },
    {
      id: 'waves', label: 'Ch 16', title: 'Mechanical waves', unit: 4, link: OS + '16-6-standing-waves-and-resonance',
      ideas: [
        R`A wave carries energy, not matter. Transverse (string) vs longitudinal (sound). Wavelength $\lambda$, period $T$, frequency $f = 1/T$, speed $v = \lambda f = \lambda/T$. The speed is set by the medium; the frequency by the source.`,
        R`Wave function $y(x,t) = A\sin(kx - \omega t + \phi)$ with wave number $k = 2\pi/\lambda$ and $\omega = 2\pi f$; speed $v = \omega/k$. The minus sign means motion in $+x$.`,
        R`String: $v = \sqrt{F_T/\mu}$ ($\mu$ = mass per length). Tighter or lighter strings carry faster waves. Wave power $\propto A^2 f^2$.`,
        R`<b>Superposition:</b> waves add. In phase → constructive; half a wavelength out of phase → destructive. Reflection from a fixed end inverts the pulse.`,
        R`<b>Standing waves</b> on a string fixed at both ends: $\lambda_n = 2L/n$, $f_n = n\dfrac{v}{2L}$ ($n = 1,2,3,\dots$). Nodes are $\lambda/2$ apart; the fundamental has one antinode.`
      ],
      formulas: [
        { n: 'Wave relations', t: R`v = \lambda f = \frac{\omega}{k},\quad k = \frac{2\pi}{\lambda},\quad \omega = 2\pi f,\quad v_{\text{string}} = \sqrt{\frac{F_T}{\mu}}` },
        { n: 'Standing waves (fixed–fixed)', t: R`\lambda_n = \frac{2L}{n},\qquad f_n = n\frac{v}{2L} = nf_1` }
      ],
      example: { p: R`A 0.60 m guitar string (mass 2.4 g) is under 80 N of tension. Find the wave speed and the fundamental frequency.`, s: R`$\mu = 0.0024/0.6 = 0.004$ kg/m; $v = \sqrt{80/0.004} = 141$ m/s; $f_1 = v/(2L) = 141/1.2 = 118$ Hz.` },
      pitfalls: ['Thinking a louder source makes a faster wave. Speed is a property of the medium.', 'Using the string length as the wavelength of the fundamental (it is half a wavelength).'],
      tip: 'Draw the standing wave pattern: count the loops. n loops means λ = 2L/n and f = n f₁.'
    },
    {
      id: 'sound', label: 'Ch 17', title: 'Sound', unit: 4, link: OS + '17-7-the-doppler-effect',
      ideas: [
        R`Sound is a longitudinal pressure wave. Speed in air about 343 m/s at 20 °C (rises with temperature); much faster in water and solids. $v = f\lambda$ still.`,
        R`<b>Intensity</b> $I = P/A$ (W/m²) falls off as $1/r^2$ from a point source. Sound level in decibels: $\beta = 10\log_{10}(I/I_0)$ with $I_0 = 10^{-12}\ \text{W/m}^2$. Every $+10$ dB is $\times10$ intensity; $+3$ dB is about $\times2$.`,
        R`Pipes: open–open resonates at $f_n = n\dfrac{v}{2L}$ (all harmonics); closed–open at $f_n = n\dfrac{v}{4L}$ with odd $n$ only.`,
        R`<b>Beats:</b> two close frequencies produce a loudness wobble at $f_{\text{beat}} = |f_1 - f_2|$.`,
        R`<b>Doppler effect:</b> $f' = f\dfrac{v \pm v_o}{v \mp v_s}$. Top signs for approach (observer toward source: $+v_o$; source toward observer: $-v_s$). Approaching raises pitch.`
      ],
      formulas: [
        { n: 'Intensity and decibels', t: R`I = \frac{P}{4\pi r^2},\qquad \beta = 10\log_{10}\frac{I}{I_0},\qquad I_0 = 10^{-12}\ \text{W/m}^2` },
        { n: 'Pipes and beats', t: R`f_n = n\frac{v}{2L}\ \text{(open)},\quad f_n = n\frac{v}{4L},\ n\ \text{odd (closed)},\quad f_{\text{beat}} = |f_1 - f_2|` },
        { n: 'Doppler', t: R`f' = f\,\frac{v \pm v_o}{v \mp v_s}` }
      ],
      example: { p: R`An ambulance siren at 700 Hz approaches a stationary listener at 30 m/s (air: 343 m/s). What frequency is heard? What after it passes?`, s: R`Approaching: $f' = 700\cdot\frac{343}{343-30} = 767$ Hz. Receding: $700\cdot\frac{343}{343+30} = 644$ Hz.` },
      pitfalls: ['Mixing up which speed goes in the numerator (observer) and denominator (source).', 'Doubling intensity and expecting 10 dB more (it is 3 dB).', 'Using even harmonics for a closed pipe.'],
      tip: 'For Doppler, decide physically first: approaching means higher pitch. Then pick the signs that make the fraction move that way.'
    }
  ];

  /* ---------- Formula sheet ---------- */
  const FORMULAS = [
    { group: 'Constants and units', items: [
      { n: 'Gravity and G', t: R`g = 9.8\ \text{m/s}^2,\qquad G = 6.67\times10^{-11}\ \text{N·m}^2/\text{kg}^2` },
      { n: 'Earth', t: R`M_E = 5.97\times10^{24}\ \text{kg},\quad R_E = 6.37\times10^{6}\ \text{m},\quad r_{\text{Moon orbit}} = 3.84\times10^8\ \text{m}` },
      { n: 'Air and water', t: R`v_{\text{sound}} \approx 343\ \text{m/s},\quad \rho_{\text{water}} = 1000\ \text{kg/m}^3,\quad \rho_{\text{air}} = 1.2\ \text{kg/m}^3,\quad P_0 = 1.013\times10^5\ \text{Pa}` },
      { n: 'Conversions', t: R`1\ \text{km/h} = 0.278\ \text{m/s},\quad 1\ \text{mph} = 0.447\ \text{m/s},\quad 1\ \text{rev} = 2\pi\ \text{rad},\quad 1\ \text{hp} = 746\ \text{W}` }
    ]},
    { group: 'Vectors', items: [
      { n: 'Components', t: R`A_x = A\cos\theta,\quad A_y = A\sin\theta,\quad A = \sqrt{A_x^2+A_y^2},\quad \tan\theta = A_y/A_x` },
      { n: 'Products', t: R`\vec A\cdot\vec B = AB\cos\theta = A_xB_x+A_yB_y,\qquad |\vec A\times\vec B| = AB\sin\theta` }
    ]},
    { group: 'Kinematics', items: [
      { n: 'Definitions', t: R`v = \frac{dx}{dt},\quad a = \frac{dv}{dt},\quad \bar v = \frac{\Delta x}{\Delta t}` },
      { n: 'Constant acceleration', t: R`v = v_0+at,\quad x = x_0+v_0t+\tfrac12at^2,\quad v^2 = v_0^2+2a\Delta x,\quad \Delta x = \tfrac12(v_0+v)t` },
      { n: 'Free fall', t: R`a_y = -g,\quad h_{\max} = \frac{v_0^2}{2g},\quad t_{\text{drop}} = \sqrt{\frac{2h}{g}},\quad v_{\text{impact}} = \sqrt{2gh}` },
      { n: 'Projectiles', t: R`v_{0x} = v_0\cos\theta,\ v_{0y} = v_0\sin\theta;\quad T = \frac{2v_0\sin\theta}{g},\ R = \frac{v_0^2\sin2\theta}{g},\ H = \frac{v_0^2\sin^2\theta}{2g}` },
      { n: 'Circular motion', t: R`a_c = \frac{v^2}{r} = \omega^2 r,\quad v = \frac{2\pi r}{T} = r\omega,\quad \omega = 2\pi f` },
      { n: 'Relative velocity', t: R`\vec v_{A/C} = \vec v_{A/B} + \vec v_{B/C}` }
    ]},
    { group: 'Forces', items: [
      { n: 'Newton’s laws', t: R`\sum\vec F = m\vec a,\qquad \vec F_{AB} = -\vec F_{BA},\qquad w = mg` },
      { n: 'Friction', t: R`f_s \le \mu_sN,\qquad f_k = \mu_kN` },
      { n: 'Incline', t: R`N = mg\cos\theta,\quad a = g(\sin\theta - \mu_k\cos\theta),\quad \text{sticks if } \tan\theta\le\mu_s` },
      { n: 'Systems', t: R`\text{Atwood: } a = \frac{(m_2-m_1)g}{m_1+m_2};\quad \text{elevator: } N = m(g+a)` },
      { n: 'Centripetal', t: R`\sum F_{\text{rad}} = \frac{mv^2}{r},\quad v_{\max,\text{flat}} = \sqrt{\mu_sgr},\quad \tan\theta_{\text{bank}} = \frac{v^2}{rg},\quad v_{\min,\text{top}} = \sqrt{gr}` },
      { n: 'Drag / spring', t: R`F_D = \tfrac12C\rho Av^2,\quad v_t = \sqrt{\frac{2mg}{C\rho A}},\quad F_s = -kx` }
    ]},
    { group: 'Statics and fluids', items: [
      { n: 'Torque and equilibrium', t: R`\tau = rF\sin\theta,\qquad \sum\vec F = 0,\ \sum\tau = 0` },
      { n: 'Pressure', t: R`P = \frac FA,\quad P = P_0+\rho gh,\quad \frac{F_1}{A_1} = \frac{F_2}{A_2}` },
      { n: 'Buoyancy', t: R`F_B = \rho_fV_{\text{sub}}g,\qquad \frac{V_{\text{sub}}}{V} = \frac{\rho_{\text{obj}}}{\rho_f}` }
    ]},
    { group: 'Work, energy, power', items: [
      { n: 'Work and KE', t: R`W = Fd\cos\theta = \int F\,dx,\quad K = \tfrac12mv^2,\quad W_{\text{net}} = \Delta K` },
      { n: 'Potential energy', t: R`U_g = mgy,\quad U_s = \tfrac12kx^2,\quad U_G = -\frac{GMm}{r},\quad F = -\frac{dU}{dx}` },
      { n: 'Conservation', t: R`K_i+U_i+W_{nc} = K_f+U_f,\qquad W_{nc} = -f_kd` },
      { n: 'Power', t: R`P = \frac Wt = Fv\cos\theta = \tau\omega` }
    ]},
    { group: 'Momentum', items: [
      { n: 'Momentum and impulse', t: R`\vec p = m\vec v,\quad \vec J = \vec F_{\text{avg}}\Delta t = \Delta\vec p,\quad \sum\vec F = \frac{d\vec p}{dt}` },
      { n: 'Collisions', t: R`\sum\vec p_i = \sum\vec p_f;\quad v_f = \frac{m_1v_1+m_2v_2}{m_1+m_2}\ \text{(stick)};\quad v_{1f} = \frac{m_1-m_2}{m_1+m_2}v_{1i},\ v_{2f} = \frac{2m_1}{m_1+m_2}v_{1i}\ \text{(elastic)}` },
      { n: 'Center of mass', t: R`\vec r_{cm} = \frac{\sum m_i\vec r_i}{\sum m_i}` }
    ]},
    { group: 'Rotation', items: [
      { n: 'Kinematics', t: R`\omega = \omega_0+\alpha t,\quad \theta = \omega_0t+\tfrac12\alpha t^2,\quad \omega^2 = \omega_0^2+2\alpha\Delta\theta,\quad v = r\omega,\ a_t = r\alpha` },
      { n: 'Moments of inertia', t: R`I_{\text{pt}} = mr^2,\ I_{\text{hoop}} = MR^2,\ I_{\text{disk}} = \tfrac12MR^2,\ I_{\text{sphere}} = \tfrac25MR^2,\ I_{\text{shell}} = \tfrac23MR^2,\ I_{\text{rod,ctr}} = \tfrac1{12}ML^2,\ I_{\text{rod,end}} = \tfrac13ML^2` },
      { n: 'Dynamics', t: R`\sum\tau = I\alpha,\quad K_{\text{rot}} = \tfrac12I\omega^2,\quad W = \tau\theta,\quad I = I_{cm}+Md^2` },
      { n: 'Rolling', t: R`v_{cm} = R\omega,\quad K = \tfrac12mv^2+\tfrac12I\omega^2,\quad v_{\text{bottom}} = \sqrt{\frac{2gh}{1+I/mR^2}}` },
      { n: 'Angular momentum', t: R`L = I\omega = mvr\sin\theta,\quad \sum\tau = \frac{dL}{dt},\quad I_i\omega_i = I_f\omega_f` }
    ]},
    { group: 'Gravitation', items: [
      { n: 'Law and field', t: R`F = \frac{Gm_1m_2}{r^2},\qquad g = \frac{GM}{R^2}` },
      { n: 'Orbits and energy', t: R`v = \sqrt{\frac{GM}{r}},\quad T^2 = \frac{4\pi^2r^3}{GM},\quad E = -\frac{GMm}{2r},\quad v_{esc} = \sqrt{\frac{2GM}{R}}` }
    ]},
    { group: 'Oscillations', items: [
      { n: 'SHM', t: R`x = A\cos(\omega t+\phi),\quad \omega = \sqrt{\frac km} = 2\pi f = \frac{2\pi}{T},\quad v_{\max} = A\omega,\quad a_{\max} = A\omega^2` },
      { n: 'Energy', t: R`E = \tfrac12kA^2,\qquad v = \omega\sqrt{A^2-x^2}` },
      { n: 'Pendulums', t: R`T = 2\pi\sqrt{\frac Lg},\qquad T = 2\pi\sqrt{\frac{I}{mgd}}` }
    ]},
    { group: 'Waves and sound', items: [
      { n: 'Waves', t: R`v = \lambda f = \frac{\omega}{k},\quad k = \frac{2\pi}{\lambda},\quad y = A\sin(kx-\omega t),\quad v_{\text{string}} = \sqrt{\frac{F_T}{\mu}}` },
      { n: 'Standing waves', t: R`\text{string / open pipe: } f_n = n\frac{v}{2L};\qquad \text{closed pipe: } f_n = n\frac{v}{4L},\ n\ \text{odd}` },
      { n: 'Sound', t: R`\beta = 10\log_{10}\frac{I}{I_0},\quad I = \frac{P}{4\pi r^2},\quad f_{\text{beat}} = |f_1-f_2|,\quad f' = f\frac{v\pm v_o}{v\mp v_s}` }
    ]},
    { group: 'Problem-solving protocol', items: [
      { n: '1. Picture', t: R`\text{Sketch. Label knowns with units. Choose axes (along } \vec a\text{).}` },
      { n: '2. Model', t: R`\text{Which tool? Kinematics (time) · Newton (forces) · Energy (no time) · Momentum (collision)}` },
      { n: '3. Equations', t: R`\text{Free-body diagram → } \sum F_x = ma_x,\ \sum F_y = ma_y;\ \text{or } K_i + U_i + W_{nc} = K_f + U_f` },
      { n: '4. Solve, then check', t: R`\text{Algebra first, numbers last. Units? Sign? Order of magnitude? Limiting cases?}` }
    ]}
  ];

  /* ---------- Flashcards ---------- */
  const FLASHCARDS = [
    { id: 'p-units', unit: 1, sec: 'units', f: 'SI units of force, energy, power, pressure', b: R`N = kg·m/s², J = N·m, W = J/s, Pa = N/m².` },
    { id: 'p-kmh', unit: 1, sec: 'units', f: 'Convert km/h to m/s', b: 'Divide by 3.6 (1 km/h = 1000 m / 3600 s). 72 km/h = 20 m/s.' },
    { id: 'p-comp', unit: 1, sec: 'vectors', f: 'Components of a vector of magnitude A at angle θ from +x', b: R`$A_x = A\cos\theta$, $A_y = A\sin\theta$. Magnitude back: $\sqrt{A_x^2+A_y^2}$; direction $\tan^{-1}(A_y/A_x)$, then fix the quadrant.` },
    { id: 'p-dot', unit: 1, sec: 'vectors', f: 'Dot product, two ways', b: R`$\vec A\cdot\vec B = AB\cos\theta = A_xB_x + A_yB_y$. A scalar. Zero when perpendicular.` },
    { id: 'p-graphs', unit: 1, sec: 'kin1d', f: 'Slope and area on motion graphs', b: 'Slope of x–t = velocity. Slope of v–t = acceleration. Area under v–t = displacement. Area under a–t = Δv.' },
    { id: 'p-4eq', unit: 1, sec: 'kin1d', f: 'The four constant-acceleration equations', b: R`$v = v_0+at$ · $x = x_0+v_0t+\tfrac12at^2$ · $v^2 = v_0^2+2a\Delta x$ · $\Delta x = \tfrac12(v_0+v)t$. Each omits one variable.` },
    { id: 'p-slow', unit: 1, sec: 'kin1d', f: 'When is an object slowing down?', b: 'When velocity and acceleration have opposite signs. Negative acceleration alone does not mean slowing.' },
    { id: 'p-top', unit: 1, sec: 'freefall', f: 'Velocity and acceleration at the top of a vertical throw', b: R`$v = 0$, but $a = -g = -9.8$ m/s² the whole time.` },
    { id: 'p-drop', unit: 1, sec: 'freefall', f: 'Drop time and impact speed from height h', b: R`$t = \sqrt{2h/g}$, $v = \sqrt{2gh}$.` },
    { id: 'p-proj', unit: 1, sec: 'projectile', f: 'What is constant in projectile motion?', b: R`$v_x$ (no horizontal force) and $a_y = -g$. Time links the two axes.` },
    { id: 'p-range', unit: 1, sec: 'projectile', f: 'Range, time of flight, max height on level ground', b: R`$R = \dfrac{v_0^2\sin2\theta}{g}$, $T = \dfrac{2v_0\sin\theta}{g}$, $H = \dfrac{v_0^2\sin^2\theta}{2g}$. Max range at 45°.` },
    { id: 'p-ac', unit: 1, sec: 'circkin', f: 'Centripetal acceleration: magnitude and direction', b: R`$a_c = v^2/r = \omega^2 r$, directed toward the center, even at constant speed.` },
    { id: 'p-rel', unit: 1, sec: 'circkin', f: 'Relative velocity rule', b: R`$\vec v_{A/C} = \vec v_{A/B} + \vec v_{B/C}$: inner subscripts cancel like fractions. Add as vectors.` },
    { id: 'p-n1', unit: 1, sec: 'newton', f: 'Newton’s first law in one sentence', b: 'Zero net force ⇔ constant velocity (which includes staying at rest). No force is needed to keep something moving.' },
    { id: 'p-n3', unit: 1, sec: 'newton', f: 'Third-law pair of "Earth pulls the ball down"', b: 'The ball pulls Earth up with equal magnitude. Pairs act on different objects and are the same type of force. Weight and normal force are NOT a pair.' },
    { id: 'p-mass', unit: 1, sec: 'newton', f: 'Mass vs weight', b: 'Mass (kg) measures inertia and is the same everywhere. Weight w = mg is a force (N) and depends on g.' },
    { id: 'p-normal', unit: 1, sec: 'forces', f: 'Is the normal force always mg?', b: R`No. Incline: $mg\cos\theta$. Accelerating elevator: $m(g+a)$. Extra push down: larger. It is whatever prevents sinking into the surface.` },
    { id: 'p-fbd', unit: 1, sec: 'forces', f: 'Free-body diagram recipe', b: 'Isolate one object; draw every force ON it with its agent; choose axes along the acceleration; resolve; write ΣFx = max and ΣFy = may.' },
    { id: 'p-tension', unit: 1, sec: 'forces', f: 'Tension facts for a massless rope over an ideal pulley', b: 'Same magnitude everywhere along the rope; always pulls; the pulley changes direction only.' },
    { id: 'p-atwood', unit: 2, sec: 'applynewton', f: 'Atwood machine acceleration', b: R`$a = \dfrac{(m_2-m_1)g}{m_1+m_2}$, tension $T = \dfrac{2m_1m_2}{m_1+m_2}g$. Tension lies between the two weights.` },
    { id: 'p-incline', unit: 2, sec: 'applynewton', f: 'Frictionless incline acceleration', b: R`$a = g\sin\theta$ down the slope, independent of mass. $N = mg\cos\theta$.` },
    { id: 'p-fs', unit: 2, sec: 'friction', f: 'Static vs kinetic friction', b: R`Static: $f_s \le \mu_sN$ (adjusts, inequality). Kinetic: $f_k = \mu_kN$ (fixed, opposes sliding). Usually $\mu_k < \mu_s$.` },
    { id: 'p-tan', unit: 2, sec: 'friction', f: 'Steepest incline an object stays on', b: R`$\tan\theta_{\max} = \mu_s$.` },
    { id: 'p-cent', unit: 2, sec: 'circdyn', f: 'What "centripetal force" really is', b: R`The net inward force, $\sum F_{\text{rad}} = mv^2/r$, provided by real forces (tension, friction, normal, gravity). Never draw it as an extra arrow.` },
    { id: 'p-loop', unit: 2, sec: 'circdyn', f: 'Minimum speed at the top of a loop', b: R`$v = \sqrt{gr}$ (normal force just reaches zero; gravity alone supplies $mv^2/r$).` },
    { id: 'p-term', unit: 2, sec: 'circdyn', f: 'Terminal velocity condition', b: 'Drag equals weight, so net force and acceleration are zero and the speed is constant.' },
    { id: 'p-torque', unit: 2, sec: 'statics', f: 'Torque and the two equilibrium conditions', b: R`$\tau = rF\sin\theta$ (force × lever arm). Equilibrium: $\sum\vec F = 0$ and $\sum\tau = 0$ about any pivot.` },
    { id: 'p-press', unit: 2, sec: 'fluids', f: 'Pressure at depth h', b: R`$P = P_0 + \rho gh$; gauge pressure is $\rho gh$. Depends on depth only, not container shape.` },
    { id: 'p-arch', unit: 2, sec: 'fluids', f: 'Archimedes’ principle', b: R`$F_B = \rho_{\text{fluid}}V_{\text{sub}}g$ = weight of displaced fluid. Floating: submerged fraction = $\rho_{\text{obj}}/\rho_{\text{fluid}}$.` },
    { id: 'p-rpm', unit: 2, sec: 'rotkin', f: 'rpm to rad/s; v and a of a point at radius r', b: R`$\omega = \text{rpm}\times2\pi/60$. $v = r\omega$, $a_t = r\alpha$, $a_c = r\omega^2$.` },
    { id: 'p-work', unit: 2, sec: 'work', f: 'Work by a constant force', b: R`$W = Fd\cos\theta$, θ between force and displacement. Perpendicular forces do no work; friction on a slider does negative work.` },
    { id: 'p-wet', unit: 2, sec: 'work', f: 'Work–energy theorem', b: R`$W_{\text{net}} = \Delta K = \tfrac12mv_f^2 - \tfrac12mv_i^2$. Use when forces and distances are known and time is not asked.` },
    { id: 'p-power', unit: 2, sec: 'work', f: 'Power, three ways', b: R`$P = W/t = Fv\cos\theta = \tau\omega$. 1 hp = 746 W.` },
    { id: 'p-cons', unit: 2, sec: 'energy', f: 'Energy conservation with friction', b: R`$K_i + U_i - f_kd = K_f + U_f$. Without friction, drop the $f_kd$ term.` },
    { id: 'p-spring', unit: 2, sec: 'energy', f: 'Spring potential energy and Hooke’s law', b: R`$U_s = \tfrac12kx^2$, $F = -kx$, x measured from the natural length.` },
    { id: 'p-imp', unit: 3, sec: 'momentum', f: 'Impulse–momentum theorem', b: R`$\vec J = \vec F_{\text{avg}}\Delta t = \Delta\vec p$. Longer contact time → smaller force for the same Δp.` },
    { id: 'p-pcons', unit: 3, sec: 'momentum', f: 'When is momentum conserved?', b: 'When the net external force on the system is zero (or negligible during a brief collision). Component by component.' },
    { id: 'p-coll', unit: 3, sec: 'collisions', f: 'Elastic vs inelastic vs perfectly inelastic', b: 'All conserve momentum. Elastic also conserves KE. Inelastic loses KE. Perfectly inelastic: objects stick, maximum KE loss.' },
    { id: 'p-elastic', unit: 3, sec: 'collisions', f: 'Elastic collision, target at rest', b: R`$v_{1f} = \dfrac{m_1-m_2}{m_1+m_2}v_{1i}$, $v_{2f} = \dfrac{2m_1}{m_1+m_2}v_{1i}$. Equal masses swap velocities.` },
    { id: 'p-cm', unit: 3, sec: 'collisions', f: 'Center of mass', b: R`$x_{cm} = \dfrac{\sum m_ix_i}{\sum m_i}$; it moves as if all external forces acted on the total mass there. Internal forces cannot change its motion.` },
    { id: 'p-I', unit: 3, sec: 'rotdyn', f: 'Moments of inertia: hoop, disk, solid sphere, rod (center)', b: R`$MR^2$, $\tfrac12MR^2$, $\tfrac25MR^2$, $\tfrac1{12}ML^2$ (rod about end: $\tfrac13ML^2$).` },
    { id: 'p-tau', unit: 3, sec: 'rotdyn', f: 'Newton’s second law for rotation', b: R`$\sum\tau = I\alpha$. Rotational KE $\tfrac12I\omega^2$. Work $W = \tau\theta$.` },
    { id: 'p-roll', unit: 3, sec: 'angmom', f: 'Which rolls down a ramp fastest: sphere, disk, hoop?', b: R`Sphere ($\tfrac25$), then disk ($\tfrac12$), then hoop (1): smaller $I/mR^2$ wins. Mass and radius do not matter.` },
    { id: 'p-L', unit: 3, sec: 'angmom', f: 'Angular momentum and its conservation', b: R`$L = I\omega$ (rigid body) or $mvr\sin\theta$ (particle). Zero net external torque ⇒ $I_i\omega_i = I_f\omega_f$. KE need not be conserved.` },
    { id: 'p-grav', unit: 3, sec: 'gravity', f: 'Newton’s law of gravitation and g', b: R`$F = Gm_1m_2/r^2$ (center to center), $g = GM/R^2$.` },
    { id: 'p-orbit', unit: 3, sec: 'gravity', f: 'Circular orbit speed and period', b: R`Set gravity = centripetal: $v = \sqrt{GM/r}$, $T = 2\pi\sqrt{r^3/GM}$. Lower orbit is faster.` },
    { id: 'p-esc', unit: 3, sec: 'gravity', f: 'Escape speed and gravitational PE', b: R`$U = -GMm/r$ (zero at infinity), $v_{esc} = \sqrt{2GM/R}$ (11.2 km/s for Earth).` },
    { id: 'p-shm', unit: 4, sec: 'shm', f: 'SHM: ω, T, v_max, a_max for a mass on a spring', b: R`$\omega = \sqrt{k/m}$, $T = 2\pi\sqrt{m/k}$, $v_{\max} = A\omega$, $a_{\max} = A\omega^2$. Period independent of amplitude.` },
    { id: 'p-shmE', unit: 4, sec: 'shm', f: 'Energy in SHM', b: R`$E = \tfrac12kA^2 = \tfrac12mv^2 + \tfrac12kx^2$; speed at $x$: $\omega\sqrt{A^2-x^2}$.` },
    { id: 'p-pend', unit: 4, sec: 'pendulum', f: 'Simple pendulum period', b: R`$T = 2\pi\sqrt{L/g}$: depends on length and g only (small angles), not mass or amplitude.` },
    { id: 'p-res', unit: 4, sec: 'pendulum', f: 'Resonance', b: 'Driving at the natural frequency gives maximum amplitude; less damping makes the peak taller and sharper.' },
    { id: 'p-wave', unit: 4, sec: 'waves', f: 'Wave speed relations', b: R`$v = \lambda f = \omega/k$; $k = 2\pi/\lambda$, $\omega = 2\pi f$. Speed set by the medium (string: $\sqrt{F_T/\mu}$), frequency by the source.` },
    { id: 'p-stand', unit: 4, sec: 'waves', f: 'Standing waves on a string fixed at both ends', b: R`$\lambda_n = 2L/n$, $f_n = n\,v/(2L)$. n loops ⇒ nth harmonic.` },
    { id: 'p-db', unit: 4, sec: 'sound', f: 'Decibels', b: R`$\beta = 10\log_{10}(I/I_0)$, $I_0 = 10^{-12}$ W/m². +10 dB = ×10 intensity; +3 dB ≈ ×2.` },
    { id: 'p-dop', unit: 4, sec: 'sound', f: 'Doppler effect', b: R`$f' = f\dfrac{v\pm v_o}{v\mp v_s}$; approaching raises pitch (top signs), receding lowers it.` },
    { id: 'p-pipes', unit: 4, sec: 'sound', f: 'Open vs closed pipe harmonics', b: R`Open–open: $f_n = nv/2L$, all n. Closed–open: $f_n = nv/4L$, odd n only.` }
  ];

  /* ---------- Exam 1 practice set (written for this course from the Exam 1 topics) ---------- */
  const PRACTICE = {
    exam1: {
      title: 'Exam 1 practice problems',
      subtitle: 'Sixteen exam-style problems on kinematics, vectors, projectiles and Newton’s laws, with full solutions. Use g = 9.8 m/s². The real exam draws from Expert TA and clicker questions, so also redo PSets 1–3.',
      problems: [
        { n: 1, sec: 'units', tags: ['units-conv'], q: R`A car travels at 72 km/h. Express this in m/s, then find how far it goes in 4.5 s.`, s: R`$72\ \text{km/h}\times\frac{1000}{3600} = 20$ m/s. Distance $= 20(4.5) = 90$ m.` },
        { n: 2, sec: 'vectors', tags: ['vectors-comp'], q: R`$\vec A$ has magnitude 5.0 m at $37^\circ$ above the $+x$ axis. $\vec B$ has magnitude 8.0 m and points along $-y$. Find the magnitude and direction of $\vec A + \vec B$.`, s: R`$A_x = 5\cos37^\circ = 3.99$ m, $A_y = 5\sin37^\circ = 3.01$ m; $B_x = 0$, $B_y = -8$ m. $R_x = 3.99$, $R_y = -4.99$. $|\vec R| = \sqrt{3.99^2+4.99^2} = 6.39$ m; $\theta = \tan^{-1}(-4.99/3.99) = -51.3^\circ$ (51.3° below $+x$, quadrant IV).` },
        { n: 3, sec: 'kin1d', tags: ['kin1d'], q: R`A car starts from rest and accelerates at $2.5\ \text{m/s}^2$ for 8.0 s, then brakes uniformly and stops in 40 m. Find (a) the speed after 8.0 s, (b) the distance covered while accelerating, (c) the braking acceleration, (d) the total time.`, s: R`(a) $v = 2.5(8) = 20$ m/s. (b) $\Delta x = \tfrac12(2.5)(8^2) = 80$ m. (c) $0 = 20^2 + 2a(40) \Rightarrow a = -5.0\ \text{m/s}^2$. (d) braking time $= 20/5 = 4.0$ s; total $12.0$ s.` },
        { n: 4, sec: 'kin1d', tags: ['kin1d'], q: R`A velocity–time graph shows $v$ rising linearly from 0 to 10 m/s over 5 s, staying at 10 m/s for the next 5 s, then dropping linearly to 0 in 2 s. Find the acceleration in each phase and the total displacement.`, s: R`Accelerations: $2.0$, $0$, $-5.0\ \text{m/s}^2$. Displacement = area: triangle $\tfrac12(5)(10) = 25$ m, rectangle $50$ m, triangle $\tfrac12(2)(10) = 10$ m; total $85$ m.` },
        { n: 5, sec: 'freefall', tags: ['freefall'], q: R`A ball is thrown straight up at 15 m/s from the edge of a 20 m tall building and lands on the ground. Find (a) the maximum height above the ground, (b) the time in the air, (c) the impact speed.`, s: R`(a) $20 + \frac{15^2}{2(9.8)} = 31.5$ m. (b) $-20 = 15t - 4.9t^2 \Rightarrow t = \frac{15+\sqrt{225+392}}{9.8} = 4.07$ s. (c) $v^2 = 15^2 + 2(9.8)(20) = 617 \Rightarrow v = 24.8$ m/s.` },
        { n: 6, sec: 'freefall', tags: ['freefall'], q: R`A rock is dropped into a well and the splash is heard 3.0 s later. Ignoring the sound travel time, how deep is the well? Then estimate the correction from the sound's travel time (343 m/s).`, s: R`$h = \tfrac12(9.8)(3^2) = 44.1$ m. Sound would take $44.1/343 = 0.13$ s, so the fall actually lasts about 2.87 s and $h \approx \tfrac12(9.8)(2.87^2) = 40.4$ m: roughly a 10% correction.` },
        { n: 7, sec: 'projectile', tags: ['projectile'], q: R`A soccer ball is kicked at 20 m/s at $35^\circ$ above the horizontal on level ground. Find the time of flight, the range, the maximum height, and the speed at the top.`, s: R`$v_{0x} = 16.4$, $v_{0y} = 11.5$ m/s. $T = 2(11.5)/9.8 = 2.34$ s. $R = 16.4(2.34) = 38.4$ m. $H = 11.5^2/19.6 = 6.71$ m. Speed at the top $= v_x = 16.4$ m/s.` },
        { n: 8, sec: 'projectile', tags: ['projectile'], q: R`A stone is thrown horizontally at 12 m/s from a 45 m cliff. Find the time to land, the horizontal distance, and the impact velocity (magnitude and angle).`, s: R`$t = \sqrt{2(45)/9.8} = 3.03$ s. $x = 12(3.03) = 36.4$ m. $v_y = 9.8(3.03) = 29.7$ m/s; $v = \sqrt{12^2+29.7^2} = 32.0$ m/s at $\tan^{-1}(29.7/12) = 68^\circ$ below horizontal.` },
        { n: 9, sec: 'circkin', tags: ['circkin'], q: R`A car goes around a curve of radius 50 m at a constant 15 m/s. (a) Find its acceleration. (b) The car has mass 1200 kg: what net force acts on it and in what direction?`, s: R`(a) $a_c = 15^2/50 = 4.5\ \text{m/s}^2$ toward the center. (b) $F = ma_c = 5400$ N toward the center of the curve (supplied by friction).` },
        { n: 10, sec: 'circkin', tags: ['circkin'], q: R`A boat moves at 4.0 m/s relative to the water and heads straight across a river flowing at 3.0 m/s. The river is 120 m wide. Find the crossing time, the downstream landing point, and the boat's velocity relative to the ground.`, s: R`$t = 120/4 = 30$ s. Drift $= 3(30) = 90$ m downstream. Ground velocity $= 5.0$ m/s at $\tan^{-1}(3/4) = 36.9^\circ$ downstream from straight across.` },
        { n: 11, sec: 'newton', tags: ['newton-laws'], q: R`A 3.0 kg box on frictionless ice is pushed by two people: 12 N east and 9.0 N north. Find the acceleration (magnitude and direction).`, s: R`$F_{\text{net}} = \sqrt{144+81} = 15$ N at $\tan^{-1}(9/12) = 36.9^\circ$ north of east. $a = 15/3 = 5.0\ \text{m/s}^2$ in that direction.` },
        { n: 12, sec: 'newton', tags: ['newton-laws'], q: R`Conceptual. A large truck collides head-on with a small car. (a) Compare the forces each exerts on the other. (b) Compare their accelerations. (c) A book rests on a table: identify the third-law partner of the table's normal force on the book.`, s: R`(a) Equal magnitude, opposite direction (third law). (b) The car has the larger acceleration because $a = F/m$ and its mass is smaller. (c) The book's push down on the table. (Not the book's weight: that is Earth's pull on the book, whose partner is the book's pull on Earth.)` },
        { n: 13, sec: 'forces', tags: ['forces-fbd'], q: R`A 70 kg person stands on a scale in an elevator. What does the scale read (in N) when the elevator (a) accelerates upward at $2.0\ \text{m/s}^2$, (b) moves up at constant speed, (c) accelerates downward at $2.0\ \text{m/s}^2$, (d) is in free fall?`, s: R`Scale reads $N = m(g+a)$ with up positive. (a) $70(11.8) = 826$ N. (b) $686$ N. (c) $70(7.8) = 546$ N. (d) $0$.` },
        { n: 14, sec: 'forces', tags: ['forces-fbd'], q: R`A 20 kg traffic light hangs from two cables, each making $30^\circ$ above the horizontal. Find the tension in each cable.`, s: R`Vertical: $2T\sin30^\circ = mg = 196$ N $\Rightarrow T = 196$ N. Horizontal components cancel. (If the angles were $10^\circ$, $T = 564$ N: shallow cables carry huge tension.)` },
        { n: 15, sec: 'forces', tags: ['forces-fbd'], q: R`A 5.0 kg block sits on a frictionless $30^\circ$ incline. Draw the free-body diagram and find the normal force and the block's acceleration.`, s: R`Tilted axes. Perpendicular: $N = mg\cos30^\circ = 49(0.866) = 42.4$ N. Along the slope: $mg\sin30^\circ = ma \Rightarrow a = 9.8(0.5) = 4.9\ \text{m/s}^2$ down the incline.` },
        { n: 16, sec: 'forces', tags: ['forces-fbd'], q: R`Two blocks, 4.0 kg and 2.0 kg, sit touching on a frictionless floor. A 24 N horizontal force pushes the 4.0 kg block. Find the acceleration and the force the blocks exert on each other.`, s: R`System: $a = 24/6 = 4.0\ \text{m/s}^2$. Isolate the 2.0 kg block: the only horizontal force is the contact force, $F_c = 2(4) = 8.0$ N. (Check on the 4 kg block: $24 - 8 = 4(4)$ ✓.)` }
      ]
    }
  };

  const CHECKLISTS = {
    exam1: ['Notes: Ch 1–5 topics on this site', 'Redo PSet 1, 2, 3 in Expert TA without looking at old answers', 'Re-answer the clicker questions from Weeks 1–3 (Canvas modules)', 'Work all 16 practice problems on the Exam prep page', 'Flashcards: Unit 1 mastered', 'Quizzer: 20 Unit 1 questions at ≥ 80%', 'Draw ten free-body diagrams from memory (incline, elevator, hanging sign, pulley)', 'Memorize the four kinematics equations and the projectile shortcuts'],
    exam2: ['Notes: applying Newton through energy', 'Redo PSets 4–7', 'Re-answer clicker questions from Weeks 4–7', 'Flashcards: Unit 2 mastered', 'Quizzer: 20 Unit 2 questions at ≥ 80%', 'Energy bar charts for five problems with and without friction'],
    exam3: ['Notes: momentum, rotation, gravitation', 'Redo PSets 8–10', 'Re-answer clicker questions from Weeks 8–10', 'Flashcards: Unit 3 mastered', 'Quizzer: 20 Unit 3 questions at ≥ 80%', 'Moment-of-inertia table from memory'],
    exam4: ['Notes: oscillations, waves, sound', 'Redo PSets 11–14', 'Flashcards: Unit 4 mastered', 'Quizzer: 20 Unit 4 questions at ≥ 80%', 'One timed 50-minute mixed set per day in finals week']
  };

  /* ---------- Course info page ---------- */
  const INFO = [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
        <li><b>Instructor:</b> ${COURSE.instructor} · ${COURSE.instructorRoom} · <a href="mailto:${COURSE.instructorEmail}">${COURSE.instructorEmail}</a></li>
        <li><b>Office hours:</b> ${COURSE.officeHours}</li>
        <li><b>Lectures:</b> ${COURSE.lectures}</li>
        <li><b>Textbook:</b> <a href="${COURSE.textbook.url}" target="_blank" rel="noopener">${COURSE.textbook.title}</a> (free; reading online recommended)</li>
        <li><b>Homework:</b> Expert TA ($35, linked from each week's Canvas module; register with your student.montana.edu email).</li>
        <li><b>Clickers:</b> iClicker in every lecture; register with your student.montana.edu email.</li>
        <li><b>Exams:</b> four written exams, 1 h 50 min each, closed book, all devices away. The first three happen in your lab section during exam weeks; the fourth is in finals week. Each covers only the material since the previous exam. Lowest exam dropped.</li>
      </ul>` },
    { icon: 'clock', title: 'Deadlines', html: `<ul class="list-plain small">${COURSE.deadlines.map(d => `<li><b>${d.name}.</b> ${d.rule}</li>`).join('')}</ul>` },
    { icon: 'bulb', title: 'How the course is graded', html: `<ul class="list-plain small">
        <li><b>Exams 58%</b> — best three of four.</li>
        <li><b>Labs 20%</b> — pre-lab 5 + lab 10 + post-lab 5 per week; lowest dropped; at least 6 labs required to pass.</li>
        <li><b>Problem sets 10%</b> — weekly in Expert TA; lowest dropped.</li>
        <li><b>Clickers 10%</b> — second-round answers; about 20% of sessions excused.</li>
        <li><b>Extra credit 2%</b> — five 0.4-point reflections in the first five weeks.</li>
        <li>Scores round up by one decimal (88.5 → 89). Borders may be lowered at the end, never raised.</li>
      </ul>` },
    { icon: 'flag', title: 'Exam weeks', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Exam</th><th>When</th><th>Covers</th></tr></thead><tbody>${EXAMS.map(e => `<tr><td><b>${e.name}</b></td><td>${e.dateLabel}</td><td class="small">${e.covers}</td></tr>`).join('')}</tbody></table></div><p class="small muted mt-1">"Most of the exam questions will be taken directly from Expert TA and in-class clicker questions, so if you have done the homework, you will do well."</p>` },
    { icon: 'list', title: 'AI guidance and honesty', span2: true, html: `<p class="small">AI tools may be used to <em>check</em> your work, for example reviewing problem-set answers before you submit. The instructor discourages using them to generate answers or step-by-step guidance before you have worked a problem yourself ("AI as a partner"). Two reasons: dependence hinders learning and your ability to judge AI output in your career, and the exams are closed-book with devices away, so leaning on AI during the semester leaves you unprepared. Homework you submit must be your own work; cooperation is encouraged, copying is not. Departmental policy: <a href="https://physics.montana.edu/ugrad/cheatingpolicy.html" target="_blank" rel="noopener">physics.montana.edu/ugrad/cheatingpolicy.html</a>.</p>
      <div class="divider"></div><div class="eyebrow mb-1">Support</div><p class="small">Disability accommodations: discuss with the instructor in office hours with your Accommodation Notification (Office of Disability Services, 137 Romney Hall). Counseling &amp; Psychological Services, Health Advancement, Let's Talk drop-in and the WellTrack app are all available through <a href="https://www.montana.edu/counseling/" target="_blank" rel="noopener">montana.edu/counseling</a>.</p>` }
  ];

  const NAV = [
    { label: 'Today', items: [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar']] },
    { label: 'Learn', items: [['notes', 'Topic notes', 'book'], ['formulas', 'Formula sheet', 'sigma'], ['flashcards', 'Flashcards', 'cards'], ['textbook', 'Textbook & links', 'link']] },
    { label: 'Practice', items: [['practice', 'Quizzer', 'list'], ['exam', 'Exam prep', 'flag']] },
    { label: 'Tools', items: [['motion', 'Projectile & motion', 'chart'], ['solvers', 'Solvers', 'flask'], ['grades', 'Grade calculator', 'calc'], ['scratchpad', 'Scratchpad', 'pen']] },
    { label: 'Course', items: [['course', 'Syllabus & policies', 'info'], ['settings', 'Settings', 'sliders']] }
  ];

  global.Courses = global.Courses || {};
  global.Courses.physics = {
    id: 'physics', code: COURSE.code, name: COURSE.name, short: 'Physics I', term: COURSE.term, tagline: 'Mechanics, waves and sound with OpenStax University Physics',
    quizNote: 'Use g = 9.8 m/s², G = 6.67×10⁻¹¹ N·m²/kg², speed of sound 343 m/s, ρ_water = 1000 kg/m³. Answers within 2% count. You can type 3/8, 2pi, 6.67e-11 or 1.5*10^3.',
    COURSE, GRADING, EXAMS, CALENDAR, CALENDAR_NOTE, RECURRING, SEMESTER, UNITS, SECTIONS, FORMULAS, FLASHCARDS, PRACTICE, CHECKLISTS, INFO, NAV
  };
})(window);
