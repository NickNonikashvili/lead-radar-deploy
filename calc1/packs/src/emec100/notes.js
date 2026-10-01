/* EMEC 100: topic notes, formulas and terms, flashcards. Written for Mathub from the course objectives
   and standard introductory engineering material; lectures and Canvas decide each week's content. */
const CATALOG = 'https://catalog.montana.edu/undergraduate/engineering/mechanical-industrial-engineering/mechanical-engineering/';
const MIE = 'https://www.montana.edu/mie/';
const NSPE = 'https://www.nspe.org/categories/code-ethics/i-fundamental-canons';
const FE = 'https://ncees.org/exams/fe-exam/';
const BLS = 'https://www.bls.gov/ooh/architecture-and-engineering/mechanical-engineers.htm';
const FESPEC = 'https://ncees.org/wp-content/uploads/FE-Mechanical-CBT-specs.pdf';

const SECTIONS = [
  /* ---------- Unit 1 ---------- */
  { id: 'profession', label: '1.1', title: 'What mechanical engineers do', unit: 1, link: BLS, linkLabel: 'BLS: what mechanical engineers do',
    ideas: [
      'Mechanical engineering is one of the broadest engineering fields. Mechanical engineers <b>design, analyze, build and test</b> anything that moves or that uses or converts energy: engines and turbines, vehicles and aircraft, robots, HVAC and refrigeration, power plants, manufacturing equipment, medical devices and consumer products.',
      'Two families of skills run through the work. <b>Mechanics</b> covers forces, motion, stress and materials. <b>Thermal-fluid science</b> covers energy, heat and fluid flow. <b>Design and manufacturing</b> tie the two together into real products.',
      'An <b>engineer</b> applies science and math to design solutions under real <b>constraints</b> (cost, safety, time, manufacturability, regulations). A <b>scientist</b> mainly seeks new knowledge. An <b>engineering technologist</b> (MSU also offers Mechanical Engineering Technology) focuses more on applying established methods, operations and hands-on implementation.',
      'Mechanical engineers work in design and product development, testing, manufacturing and production, research, sales and technical consulting, project management, and energy and the environment. Large employers include engineering services, machinery and transportation-equipment manufacturing.',
      'Most products are designed by <b>teams</b> that include electrical, software, industrial and materials engineers, technicians, and business and safety specialists. Communicating across those groups is part of the job.'
    ],
    formulas: [],
    example: { p: 'A company is developing an electric mountain bike. Name three tasks a mechanical engineer could own.', s: 'Sizing the <b>frame</b> and checking its stresses and fatigue life (mechanics of materials); designing the <b>drivetrain</b> (motor mount, gears and bearings, machine design); and managing <b>battery and motor heat</b> (heat transfer). Others are choosing the materials and manufacturing process for the frame, and planning the durability tests.' },
    pitfalls: ['Thinking ME is only about cars and engines. It spans energy, robotics, biomedical devices, aerospace and manufacturing.', 'Confusing engineering (designing under constraints) with pure science (discovering knowledge).'],
    tip: 'Pick one product you use daily and list the mechanical engineering decisions behind it. It makes every later topic concrete.' },

  { id: 'program', label: '1.2', title: 'The ME program at MSU', unit: 1, link: CATALOG, linkLabel: 'MSU catalog: B.S. in Mechanical Engineering',
    ideas: [
      'MSU\'s <b>B.S. in Mechanical Engineering</b> is <b>ABET-accredited</b>. ABET accreditation is how employers and licensing boards know a program meets national standards.',
      'The degree needs at least <b>128 credits</b>, with <b>42 at the 300 level or above</b>. It combines mathematics, basic sciences (physics, chemistry), engineering science, engineering design, and the arts, humanities and social sciences.',
      'The engineering core includes engineering graphics, statistics, computer applications, <b>solid mechanics</b> (statics, dynamics, mechanics of materials), <b>materials science</b>, <b>manufacturing processes</b>, <b>thermodynamics</b>, <b>heat transfer</b>, <b>fluid mechanics</b>, electronics, and the design of structural, mechanical and energy systems.',
      'Courses build in a chain. Calculus and physics come first. Then <b>statics</b> (forces in balance), which leads to <b>dynamics</b> (motion) and <b>mechanics of materials</b> (stress and deformation). Thermodynamics leads to fluid mechanics and heat transfer. Everything comes together in <b>design</b> courses and a team <b>capstone</b>, where you solve a real-world design problem and build a working prototype.',
      'Early math matters. EMEC 100\'s co-requisite is M 151Q (precalculus), and the calculus sequence gates most engineering science courses, so staying on track in math keeps the four-year plan on schedule.',
      'Check the catalog and your adviser for the exact course sequence, prerequisites and options. Requirements can change by catalog year.'
    ],
    formulas: [],
    example: { p: 'Why does a semester behind in calculus delay a mechanical engineering student by more than a semester?', s: 'Statics, dynamics and mechanics of materials have <b>calculus and physics prerequisites</b>, and later courses (thermodynamics, fluids, design) depend on those. One missing link pushes the <b>whole chain</b> back, often by a year if courses are offered only in certain semesters.' },
    pitfalls: ['Treating the core courses as separate boxes. Each one builds on the previous ones.', 'Planning from memory instead of the catalog for your year.'],
    tip: 'Sketch the prerequisite chain on one page and check where you are each semester with your adviser.' },

  { id: 'careers', label: '1.3', title: 'Internships, careers and licensure', unit: 1, link: FE, linkLabel: 'NCEES: the FE exam',
    ideas: [
      'An <b>internship</b> is usually a summer of paid engineering work. A <b>co-op</b> alternates semesters of full-time work with school, often with the same employer several times. Both build experience, references and often job offers. Start looking early: career fairs, the department, and professional societies.',
      'A strong engineering <b>résumé</b> is one page and lists projects, tools (CAD, Excel, MATLAB, machining), teams and measurable results. Club work counts: design competitions, robotics, Formula SAE and ASME student sections.',
      'Licensure path. (1) Graduate from an ABET-accredited program. (2) Pass the <b>Fundamentals of Engineering (FE)</b> exam (NCEES): computer-based, 110 questions in about 6 hours, usually taken near graduation. (3) Earn <b>Engineer-in-Training (EIT/EI)</b> status. (4) Gain about four years of supervised experience. (5) Pass the <b>Principles and Practice of Engineering (PE)</b> exam to become a licensed <b>Professional Engineer</b>.',
      'A PE license is required to sign and seal designs offered to the public, such as buildings\' mechanical systems, and to offer engineering services directly. Many industry roles do not require it, but it opens doors.',
      'The FE Mechanical exam covers mathematics, probability and statistics, ethics, engineering economics, electricity, statics, dynamics, mechanics of materials, materials, fluid mechanics, thermodynamics, heat transfer, controls, and mechanical design. It is a handy map of the whole curriculum.',
      '<b>Professional societies</b> such as ASME, SAE, ASHRAE and SWE offer student chapters, competitions, codes and standards, and networking. Engineers keep learning for their whole careers.'
    ],
    formulas: [],
    example: { p: 'Put the steps to becoming a licensed Professional Engineer in order.', s: 'ABET-accredited degree → pass the <b>FE</b> exam → <b>EIT</b> status → about four years of qualifying experience → pass the <b>PE</b> exam → licensed <b>PE</b> (requirements vary somewhat by state).' },
    pitfalls: ['Mixing up the FE (fundamentals, near graduation) and the PE (after years of experience).', 'Waiting until senior year to look for internships.'],
    tip: 'Make a one-page résumé this semester, even if it only has class projects and clubs, and update it every term.' },

  /* ---------- Unit 2 ---------- */
  { id: 'problem-solving', label: '2.1', title: 'Problem solving, units and estimation', unit: 2, link: 'https://www.nist.gov/pml/owm/metric-si/si-units', linkLabel: 'NIST: SI units',
    ideas: [
      'A structured method keeps engineering problems organized and checkable. <b>Given</b> (what you know, with units). <b>Find</b> (what is asked). <b>Diagram</b> (a sketch or free-body diagram). <b>Assumptions</b> (what you neglect and why). <b>Governing equations</b> (the physics). <b>Solve</b> (algebra first, numbers last). <b>Check</b> (units, size and sign of the answer).',
      'The <b>SI base units</b> include the metre (m), kilogram (kg), second (s), ampere (A), kelvin (K), mole (mol) and candela (cd). <b>Derived units</b> are built from them: newton N = kg·m/s², pascal Pa = N/m², joule J = N·m, watt W = J/s.',
      '<b>US customary units</b> are common in industry: inch, foot, pound-force (lbf), pound-mass (lbm), slug, psi, Btu and horsepower. Key conversions: 1 in = 25.4 mm (exact); 1 ft = 0.3048 m (exact); 1 lbf ≈ 4.448 N; 1 psi ≈ 6.895 kPa; 1 hp ≈ 745.7 W; 1 kg ≈ 2.205 lbm.',
      '<b>Mass is not weight.</b> Mass (kg, lbm, slug) measures matter. Weight is a force: <i>W</i> = <i>mg</i>, with <i>g</i> ≈ 9.81 m/s² ≈ 32.2 ft/s². On Earth a 1 lbm object weighs 1 lbf, which is why the two get confused.',
      '<b>Dimensional homogeneity</b>: every term in a valid equation has the same units, so checking units catches algebra errors. Carry units through every step. NASA\'s <b>Mars Climate Orbiter</b> was lost in 1999 when one team\'s software reported impulse in pound-force-seconds and another expected newton-seconds.',
      '<b>Significant figures</b> show how precise a value is: report answers to about the precision of your least precise input (often three significant figures in engineering). <b>Estimation</b> (Fermi problems) gives a quick order-of-magnitude answer that tells you whether a detailed result is plausible.'
    ],
    formulas: [{ n: 'Weight', t: 'W = m g' }, { n: 'Newton', t: '1\\ \\text{N} = 1\\ \\text{kg·m/s}^2' }],
    example: { p: 'A 75 kg student stands on a scale. What is their weight in newtons and in pounds-force?', s: '<i>W</i> = <i>mg</i> = 75 × 9.81 = <b>736 N</b>. Converting: 736 N ÷ 4.448 N/lbf ≈ <b>165 lbf</b>. Check: 75 kg ≈ 165 lbm, and on Earth 1 lbm weighs 1 lbf, so it matches.' },
    pitfalls: ['Dropping units mid-calculation, then guessing them at the end.', 'Treating lbm and lbf as the same quantity in equations (F = ma needs consistent units: slugs with lbf, or kg with N).', 'Reporting 10 digits from a calculator when the inputs have three.'],
    tip: 'Write the unit next to every number, and cancel units like algebra. If the units don\'t come out right, the equation is wrong.' },

  { id: 'core-areas', label: '2.2', title: 'The analytical core of ME', unit: 2, link: FESPEC, linkLabel: 'FE Mechanical topics (NCEES)',
    ideas: [
      '<b>Statics</b>: bodies at rest or constant velocity, with ΣF = 0 and ΣM = 0. You find support reactions and internal forces with <b>free-body diagrams</b>. A <b>moment</b> (torque) is force times perpendicular distance: <i>M</i> = <i>F</i>·<i>d</i>.',
      '<b>Dynamics</b>: bodies in motion. Newton\'s second law <i>F</i> = <i>ma</i>, with kinematics (position, velocity, acceleration), work and energy, momentum, and vibrations.',
      '<b>Mechanics of materials</b>: how parts deform and fail. <b>Stress</b> σ = <i>F</i>/<i>A</i> (Pa; N/mm² = MPa). <b>Strain</b> ε = Δ<i>L</i>/<i>L</i> (no units). In the elastic range, <b>Hooke\'s law</b> gives σ = <i>E</i>ε, with Young\'s modulus <i>E</i> (about 200 GPa for steel, 70 GPa for aluminum).',
      '<b>Materials science</b>: why materials behave as they do. Key properties are strength (yield and ultimate), stiffness (<i>E</i>), ductility versus brittleness, hardness, toughness and density. Families include metals, polymers, ceramics and composites.',
      '<b>Thermodynamics</b>: energy and its conversion. The <b>first law</b> says energy is conserved. The <b>second law</b> says no heat engine is 100% efficient and entropy increases. Efficiency is η = useful output ÷ input. <b>Fluid mechanics</b> covers pressure <i>p</i> = <i>F</i>/<i>A</i>, hydrostatics (<i>p</i> = ρ<i>gh</i>) and flow (Bernoulli). <b>Heat transfer</b> happens by <b>conduction</b>, <b>convection</b> and <b>radiation</b>.',
      'The areas connect. Designing a bracket uses statics (loads), mechanics of materials (stresses), materials (strength), manufacturing (how it is made) and sometimes heat transfer (temperature limits). That is why the curriculum builds them in sequence.'
    ],
    formulas: [{ n: 'Normal stress', t: '\\sigma = \\frac{F}{A}' }, { n: 'Strain', t: '\\varepsilon = \\frac{\\Delta L}{L}' }, { n: 'Hooke\'s law', t: '\\sigma = E\\,\\varepsilon' }, { n: 'Newton\'s second law', t: '\\sum F = m a' }, { n: 'Moment (torque)', t: 'M = F\\,d' }, { n: 'Hydrostatic pressure', t: 'p = \\rho g h' }, { n: 'Mechanical power', t: 'P = F v' }],
    example: { p: 'A steel rod with a 100 mm² cross-section carries a 12 kN tensile load. What is the stress, and is it safe if the steel yields at 250 MPa?', s: 'σ = <i>F</i>/<i>A</i> = 12,000 N ÷ 100 mm² = <b>120 N/mm² = 120 MPa</b>. The factor of safety against yield is 250 ÷ 120 ≈ <b>2.1</b>, so it is safe for this static load if 2 is acceptable for the application.' },
    pitfalls: ['Mixing stress units: N/mm² equals MPa, but N/m² is only Pa (a million times smaller).', 'Forgetting that strain has no units.', 'Assuming a 100% efficient machine. The second law rules it out.'],
    tip: 'For each area, memorize one equation and one everyday example: a door hinge (moment), a car braking (F = ma), a hanging sign (stress).' },

  { id: 'modeling', label: '2.3', title: 'Modeling and simulation', unit: 2, link: MIE, linkLabel: 'MSU Mechanical & Industrial Engineering',
    ideas: [
      'A <b>model</b> is a simplified representation used to predict behavior. It can be <b>physical</b> (a scale prototype or wind-tunnel model), <b>mathematical</b> (equations from physics), or <b>computational</b> (software that solves the equations numerically).',
      'Every model rests on <b>assumptions</b>: rigid bodies, no friction, steady state, uniform material, small deflections. A model is only as good as its assumptions match reality, so state them and check them.',
      '<b>CAD</b> (computer-aided design: SolidWorks, Fusion, Creo, NX) builds the geometry. <b>FEA</b> (finite element analysis) breaks a part into a <b>mesh</b> of small elements to predict stresses, deflections, vibrations or temperatures. <b>CFD</b> (computational fluid dynamics) does the same for fluid flow and heat transfer.',
      'FEA results depend on <b>boundary conditions</b> (supports and loads), material properties and mesh quality. A <b>mesh convergence</b> study refines the mesh until the answer stops changing much.',
      '<b>Verification</b> asks: did we solve the equations right? It checks the code and the math against hand calculations or known solutions. <b>Validation</b> asks: did we solve the right equations? It compares predictions with physical test data. "<b>Garbage in, garbage out</b>": a colourful plot is not proof.',
      'Simulation saves time and money by testing many designs virtually before building any, but engineers still build prototypes and test them. <b>Digital twins</b> keep a model updated with live sensor data from a real machine.'
    ],
    formulas: [],
    example: { p: 'An FEA run says a bracket\'s peak stress is 15 MPa. A quick hand calculation of F/A gives 150 MPa. What should you do?', s: 'Do not trust either yet. A factor-of-10 gap usually means a <b>units error</b> (mm vs m, N vs kN), a wrong <b>boundary condition</b> or load, or a mistake in the hand calculation\'s assumptions. Check units and inputs, then the mesh. This is <b>verification</b>.' },
    pitfalls: ['Treating simulation output as truth without verification and validation.', 'Forgetting that a too-coarse mesh can badly under-predict peak stress.', 'Hiding the assumptions behind a model.'],
    tip: 'Always pair a simulation with a quick hand estimate. If they disagree by more than about 20%, find out why before you trust either.' },

  /* ---------- Unit 3 ---------- */
  { id: 'design', label: '3.1', title: 'The engineering design process', unit: 3, link: MIE, linkLabel: 'MSU Mechanical & Industrial Engineering',
    ideas: [
      'The design process is <b>iterative</b>, not a straight line: define the problem, research, set requirements, generate concepts, select a concept, develop the detailed design, prototype, test, then iterate, and finally communicate and launch.',
      '<b>Define the problem</b> from the customer\'s needs, not from a solution you already like. Then write <b>requirements</b> (specifications) that are <b>measurable</b>: "lifts 50 kg to 1.2 m in under 10 s" rather than "lifts heavy things fast".',
      '<b>Constraints</b> bound the design: cost, safety, weight, size, time, manufacturability, maintenance, codes and standards, environmental impact and sustainability, and ethics.',
      '<b>Concept generation</b>: brainstorm many ideas before judging any (quantity first). Use sketches, research existing products and patents, and break the function into sub-functions.',
      '<b>Concept selection</b> with a <b>weighted decision matrix</b>: list the criteria, give each a weight (often summing to 1 or 100%), score each concept against each criterion, multiply and add. The highest total wins. A Pugh matrix compares each concept with a baseline (+, 0, −).',
      'The <b>factor of safety</b> is FS = failure load ÷ working load (or strength ÷ stress). It covers uncertainty in loads, materials and models. Typical values run from about 1.25 to 4, depending on how well everything is known and what failure would cost.'
    ],
    formulas: [{ n: 'Factor of safety', t: 'FS = \\frac{\\text{strength}}{\\text{working stress}}' }, { n: 'Weighted score', t: 'S = \\sum_i w_i\\, s_i' }],
    example: { p: 'Two concepts are scored 1–5 on cost (weight 0.5), weight (0.3) and ease of manufacture (0.2). Concept A scores 4, 2, 5; Concept B scores 3, 5, 3. Which wins?', s: 'A: 0.5·4 + 0.3·2 + 0.2·5 = 2.0 + 0.6 + 1.0 = <b>3.6</b>. B: 0.5·3 + 0.3·5 + 0.2·3 = 1.5 + 1.5 + 0.6 = <b>3.6</b>. A <b>tie</b>: the matrix doesn\'t decide alone. Revisit the weights, add a criterion, or prototype both.' },
    pitfalls: ['Jumping to a favourite solution before defining the problem.', 'Writing requirements that cannot be measured.', 'Treating the decision matrix as objective truth. The weights are judgments.'],
    tip: 'For every design question, ask "how would we test that?" If you can\'t, the requirement isn\'t specific enough.' },

  { id: 'manufacturing', label: '3.2', title: 'Manufacturing', unit: 3, link: CATALOG, linkLabel: 'MSU ME curriculum (manufacturing processes)',
    ideas: [
      'Processes fall into families. <b>Casting</b>: pour molten metal into a mould (engine blocks). <b>Forming</b>: plastically shape solid metal by forging, rolling, extrusion or sheet-metal stamping. <b>Machining</b>: remove material by turning on a lathe, milling, drilling or grinding. <b>Joining</b>: welding, brazing, fasteners, adhesives. <b>Additive manufacturing</b> (3D printing): build parts layer by layer.',
      '<b>Subtractive</b> (machining) starts with more material and cuts it away. It is accurate, with good finishes, but wastes material. <b>Additive</b> builds only what is needed and allows complex internal shapes and fast prototypes, but it is slower per part and its properties can vary with build direction. <b>Formative</b> (casting, forming, moulding) has high tooling cost and very low cost per part at volume.',
      'Additive processes include <b>FDM/FFF</b> (extruded plastic filament), <b>SLA</b> (laser-cured resin), <b>SLS</b> (laser-sintered powder) and metal powder-bed fusion.',
      '<b>Injection moulding</b> makes most plastic parts: expensive moulds, cheap and fast parts. Volume drives process choice: prototypes by printing or machining, and thousands to millions by moulding, casting or stamping.',
      'In <b>design for manufacturing and assembly</b> (DFM/DFA), the designer reduces part count, uses standard parts and fasteners, avoids features that are hard to machine, and specifies tolerances no tighter than needed. Tight tolerances cost money.',
      '<b>Quality and production</b>: tolerances and inspection, statistical process control, lean manufacturing (eliminating waste) and automation and robotics. Manufacturing engineers and mechanical designers work together from the first sketch.'
    ],
    formulas: [],
    example: { p: 'You need 5 custom brackets next week, and later 50,000 a year. Which processes fit each stage?', s: 'For <b>5 prototypes</b>: 3D printing or CNC machining, with no tooling cost and fast turnaround. For <b>50,000 a year</b>: sheet-metal stamping (or casting or moulding, depending on material), where tooling cost is spread over many parts and cost per part is low.' },
    pitfalls: ['Choosing a process without considering production volume.', 'Specifying tolerances tighter than the function needs.', 'Assuming a 3D-printed prototype is as strong as the final production part.'],
    tip: 'Learn the five families with one everyday example each: cast engine block, forged wrench, machined shaft, welded frame, 3D-printed prototype.' },

  /* ---------- Unit 4 ---------- */
  { id: 'communication', label: '4.1', title: 'Written, oral and graphical communication', unit: 4, link: 'https://www.montana.edu/writingcenter/', linkLabel: 'MSU Writing Center',
    ideas: [
      'Engineers spend a large share of their time communicating: reports, emails, drawings, presentations and meetings. A correct design that nobody understands does not get built.',
      'A <b>technical report</b> usually has a title, an abstract or executive summary, introduction, methods, results, discussion, conclusions and recommendations, references, and appendices. Lead with the answer, use numbers with units, and cite every source.',
      '<b>Professional email</b>: a clear subject line (in EMEC 100 it must start with "EMEC 100-x:"), a greeting, the request in the first lines, the needed details, a polite close and your name. Proofread. Send it well before a deadline.',
      '<b>Oral presentations</b>: know your audience, one main idea per slide, readable graphs (large fonts, labelled axes), practice aloud and keep to time.',
      '<b>Engineering drawings</b> are the language of manufacturing. <b>Orthographic projection</b> shows the front, top and right-side views at right angles. An <b>isometric</b> view is a 3D pictorial. Drawings also use <b>section views</b> for interiors, plus <b>dimensions and tolerances</b> and a title block. Today most are made in CAD.',
      '<b>Graphs</b>: put the independent variable on the x-axis; label both axes with the quantity and its <b>units</b>; give the figure a number and a caption; use symbols for data and lines for models.'
    ],
    formulas: [],
    example: { p: 'Rewrite this email subject for EMEC 100: "question".', s: '"<b>EMEC 100-2: Question about the design matrix assignment due Friday</b>": it has the required course and section tag, and the topic is clear from the subject alone.' },
    pitfalls: ['Graphs without axis labels or units.', 'Burying the main result at the end of a report.', 'Emails with no subject or context. In this class, emails without the "EMEC 100-x:" tag are disregarded.'],
    tip: 'Before you send or submit, ask: could a busy reader get the main point in 10 seconds?' },

  { id: 'teamwork', label: '4.2', title: 'Teamwork and decision making', unit: 4, link: MIE, linkLabel: 'MSU Mechanical & Industrial Engineering',
    ideas: [
      'Most engineering is done in <b>teams</b>, from class projects to the capstone and industry product teams. Employers rank teamwork and communication among the most important skills of new graduates.',
      'Bruce Tuckman described the <b>stages of team development</b>: <b>forming</b> (polite, unclear roles), <b>storming</b> (conflict over ideas and roles), <b>norming</b> (agreed ways of working), <b>performing</b> (productive), and later <b>adjourning</b>.',
      'A <b>team charter</b> sets goals, roles (leader, scheduler, note-taker), meeting times, how decisions are made, and what happens when someone misses work. Agree on it at the start, not after the first problem.',
      'Ways to decide: <b>consensus</b> (everyone can live with it; slow, but strong buy-in), <b>majority vote</b> (fast, but can leave a frustrated minority), a <b>leader decides after consultation</b>, or a <b>decision matrix</b> for comparing options on stated criteria.',
      'Healthy <b>conflict</b> is about ideas, not people. Address problems early and directly, focus on the shared goal, and document agreements. <b>Diverse</b> teams, with different backgrounds and ways of thinking, consider more options and catch more errors.',
      'Run good meetings: an agenda shared in advance, a time limit, notes with <b>action items</b> (who does what by when), and follow-up.'
    ],
    formulas: [],
    example: { p: 'Two weeks into a project, your team argues about which concept to build and one member stopped coming to meetings. What stage is this, and what helps?', s: 'This is <b>storming</b>. Revisit or write the <b>team charter</b> (roles, expectations, how you decide), use a <b>decision matrix</b> to make the concept choice on agreed criteria, and talk directly and respectfully with the absent member about commitments.' },
    pitfalls: ['Skipping the charter and letting roles stay vague.', 'Avoiding conflict until it explodes near the deadline.', 'One person doing all the work. That person, and the rest of the team, both lose the learning.'],
    tip: 'End every meeting with written action items: owner, task, due date.' },

  { id: 'ethics', label: '4.3', title: 'Ethics, professionalism and society', unit: 4, link: NSPE, linkLabel: 'NSPE: the Fundamental Canons',
    ideas: [
      'The <b>NSPE Code of Ethics</b> has six <b>Fundamental Canons</b>. Engineers shall: (1) hold <b>paramount the safety, health, and welfare of the public</b>; (2) perform services only in areas of their <b>competence</b>; (3) issue public statements only in an <b>objective and truthful</b> manner; (4) act for each employer or client as <b>faithful agents or trustees</b>; (5) avoid <b>deceptive acts</b>; (6) conduct themselves honorably, responsibly, ethically and lawfully to enhance the profession.',
      '<b>Challenger (28 January 1986)</b>: an O-ring seal in a solid rocket booster failed in unusually cold weather. Engineers had warned about cold-temperature launches, but managers overrode the recommendation not to launch. Seven astronauts died.',
      '<b>Hyatt Regency walkway collapse (Kansas City, 17 July 1981)</b>: a design change from one continuous rod to two offset rods doubled the load on a connection that was already weak. The walkways fell and 114 people died. The responsible engineers lost their licenses.',
      '<b>Tacoma Narrows Bridge (7 November 1940)</b>: wind-induced aeroelastic flutter destroyed the new bridge. Engineers learned to account for aerodynamics. The <b>Citicorp Center (1978)</b>: structural engineer William LeMessurier found a dangerous weakness in his own design for wind loads, reported it, and had it fixed. He is the classic example of owning a mistake.',
      'The <b>Boeing 737 MAX</b> crashes (October 2018 and March 2019, 346 deaths) involved an automated flight-control system (MCAS) that relied on a single sensor and was not fully explained to pilots. They raised questions about safety culture, disclosure and oversight.',
      'Engineering shapes society. Products bring <b>benefits and unintended consequences</b> (safety, environmental impact, privacy, jobs). Engineers face <b>conflicts of interest</b>, <b>whistleblowing</b> decisions, and duties to <b>sustainability</b>. <b>Intellectual property</b> matters too: cite sources and respect patents and copyrights, which is why plagiarism is an ethical issue, not only an academic one.'
    ],
    formulas: [],
    example: { p: 'Your manager asks you to sign off on a part that failed one of three fatigue tests because the schedule is tight. What does the NSPE Code say?', s: 'Canon 1: the public\'s <b>safety is paramount</b>, so you should not approve it. Canons 3 and 5: do not misrepresent the results. Document the failure, explain the risk, propose options (more testing, a design change), and escalate if needed. Schedule pressure does not override safety.' },
    pitfalls: ['Treating ethics as just following the law. Codes ask more than legal minimums.', 'Thinking ethics is only for senior engineers. Students face it through plagiarism, data honesty and teamwork.', 'Mixing up the cases. Challenger: O-rings in the cold. Hyatt: the hanger-rod connection. Tacoma: wind flutter.'],
    tip: 'Memorize Canon 1 word for word: "Hold paramount the safety, health, and welfare of the public." It settles most dilemmas.' }
];

const FORMULAS = [
  { group: 'SI units', items: [
    { n: 'Base units', d: 'metre (m), kilogram (kg), second (s), ampere (A), kelvin (K), mole (mol), candela (cd).' },
    { n: 'Newton', t: '1\\ \\text{N} = 1\\ \\text{kg·m/s}^2' },
    { n: 'Pascal', t: '1\\ \\text{Pa} = 1\\ \\text{N/m}^2,\\quad 1\\ \\text{MPa} = 1\\ \\text{N/mm}^2' },
    { n: 'Joule and watt', t: '1\\ \\text{J} = 1\\ \\text{N·m},\\quad 1\\ \\text{W} = 1\\ \\text{J/s}' },
    { n: 'Prefixes', d: 'k = 10³, M = 10⁶, G = 10⁹; m = 10⁻³, μ = 10⁻⁶, n = 10⁻⁹.' }
  ] },
  { group: 'Conversions', items: [
    { n: 'Length', t: '1\\ \\text{in} = 25.4\\ \\text{mm},\\quad 1\\ \\text{ft} = 0.3048\\ \\text{m}' },
    { n: 'Force', t: '1\\ \\text{lbf} \\approx 4.448\\ \\text{N}' },
    { n: 'Mass', t: '1\\ \\text{kg} \\approx 2.205\\ \\text{lbm},\\quad 1\\ \\text{slug} \\approx 14.59\\ \\text{kg}' },
    { n: 'Pressure', t: '1\\ \\text{psi} \\approx 6.895\\ \\text{kPa}' },
    { n: 'Power', t: '1\\ \\text{hp} \\approx 745.7\\ \\text{W}' },
    { n: 'Temperature', t: 'T_{°C} = \\tfrac{5}{9}(T_{°F} - 32),\\quad T_K = T_{°C} + 273.15' },
    { n: 'Gravity', t: 'g \\approx 9.81\\ \\text{m/s}^2 \\approx 32.2\\ \\text{ft/s}^2' }
  ] },
  { group: 'First formulas', items: [
    { n: 'Weight', t: 'W = m g' },
    { n: 'Newton\'s second law', t: '\\sum F = m a' },
    { n: 'Equilibrium (statics)', t: '\\sum F = 0,\\quad \\sum M = 0' },
    { n: 'Moment (torque)', t: 'M = F\\,d' },
    { n: 'Normal stress', t: '\\sigma = F / A' },
    { n: 'Strain', t: '\\varepsilon = \\Delta L / L' },
    { n: 'Hooke\'s law', t: '\\sigma = E\\,\\varepsilon' },
    { n: 'Pressure', t: 'p = F / A' },
    { n: 'Hydrostatic pressure', t: 'p = \\rho g h' },
    { n: 'Work and power', t: 'W = F\\,d,\\quad P = F\\,v' },
    { n: 'Efficiency', t: '\\eta = \\frac{\\text{output}}{\\text{input}}' },
    { n: 'Factor of safety', t: 'FS = \\frac{\\text{strength}}{\\text{stress}}' }
  ] },
  { group: 'Terms', items: [
    { n: 'ABET', d: 'The accreditor of engineering programs; graduating from an accredited program is the first step to licensure.' },
    { n: 'FE / EIT / PE', d: 'Fundamentals of Engineering exam → Engineer-in-Training → (experience) → Professional Engineer license.' },
    { n: 'Internship vs co-op', d: 'Internship: usually a summer job. Co-op: alternating full-time work terms and school.' },
    { n: 'CAD / FEA / CFD', d: 'Computer-aided design; finite element analysis (stress, heat); computational fluid dynamics (flow).' },
    { n: 'Verification vs validation', d: 'Solving the equations right (code, math) vs solving the right equations (matches tests).' },
    { n: 'Requirement', d: 'A measurable statement of what the design must do.' },
    { n: 'Constraint', d: 'A limit on the design: cost, size, safety, time, codes, manufacturability.' },
    { n: 'Decision matrix', d: 'Score concepts on weighted criteria; the highest total wins (a tool, not a verdict).' },
    { n: 'DFM / DFA', d: 'Design for manufacturing and assembly: fewer parts, standard parts, sensible tolerances.' },
    { n: 'Additive vs subtractive', d: 'Building layer by layer (3D printing) vs cutting material away (machining).' },
    { n: 'Orthographic projection', d: 'Front, top and side views at right angles on an engineering drawing.' },
    { n: 'Tuckman stages', d: 'Forming, storming, norming, performing (and adjourning).' },
    { n: 'NSPE Canon 1', d: 'Hold paramount the safety, health, and welfare of the public.' }
  ] }
];

const card = (id, unit, sec, f, b) => ({ id, unit, sec, f, b });
const FLASHCARDS = [
  card('e-me', 1, 'profession', 'What do mechanical engineers do?', 'Design, analyze, build and test things that move or that use or convert energy: machines, engines, vehicles, HVAC, robots, devices.'),
  card('e-eng-sci', 1, 'profession', 'Engineer vs scientist', 'Engineers apply science to design under constraints; scientists mainly seek new knowledge.'),
  card('e-met', 1, 'profession', 'ME vs Mechanical Engineering Technology', 'ME: engineering science, analysis and design. MET: applying established methods, with more hands-on implementation.'),
  card('e-two', 1, 'profession', 'Two big skill families in ME', 'Mechanics (forces, motion, materials) and thermal-fluid science (energy, heat, flow).'),
  card('e-abet', 1, 'program', 'What does ABET accreditation mean?', 'The program meets national engineering education standards; needed for the usual path to licensure.'),
  card('e-128', 1, 'program', 'Minimum credits for MSU’s B.S. in ME', '128, with 42 at the 300 level or above.'),
  card('e-chain', 1, 'program', 'The mechanics course chain', 'Calculus and physics → statics → dynamics and mechanics of materials → design.'),
  card('e-capstone', 1, 'program', 'What is the capstone?', 'A senior team design project solving a real-world problem and building a working prototype.'),
  card('e-coreq', 1, 'program', 'EMEC 100’s co-requisite', 'M 151Q (precalculus).'),
  card('e-intern', 1, 'careers', 'Internship vs co-op', 'Internship: usually a summer. Co-op: alternating full-time work terms with school.'),
  card('e-lic', 1, 'careers', 'Path to a PE license', 'ABET degree → FE exam → EIT → about 4 years’ experience → PE exam → PE.'),
  card('e-fe', 1, 'careers', 'FE exam format', 'NCEES computer-based exam, 110 questions, about 6 hours; usually taken near graduation.'),
  card('e-pe-why', 1, 'careers', 'Why get a PE license?', 'To sign and seal designs for the public and to offer engineering services directly.'),
  card('e-asme', 1, 'careers', 'ASME', 'The American Society of Mechanical Engineers: student sections, codes and standards, networking.'),
  card('e-method', 2, 'problem-solving', 'Steps of the engineering problem-solving method', 'Given, Find, Diagram, Assumptions, Governing equations, Solve, Check.'),
  card('e-base', 2, 'problem-solving', 'SI base units (7)', 'm, kg, s, A, K, mol, cd.'),
  card('e-newton', 2, 'problem-solving', 'Newton in base units', '1 N = 1 kg·m/s².'),
  card('e-pa', 2, 'problem-solving', 'Pascal; MPa in N/mm²', '1 Pa = 1 N/m²; 1 MPa = 1 N/mm².'),
  card('e-in', 2, 'problem-solving', '1 inch in mm', '25.4 mm (exact).'),
  card('e-lbf', 2, 'problem-solving', '1 lbf in newtons', 'About 4.448 N.'),
  card('e-psi', 2, 'problem-solving', '1 psi in kPa', 'About 6.895 kPa.'),
  card('e-hp', 2, 'problem-solving', '1 hp in watts', 'About 745.7 W.'),
  card('e-mass', 2, 'problem-solving', 'Mass vs weight', 'Mass measures matter (kg); weight is a force, W = mg (N).'),
  card('e-g', 2, 'problem-solving', 'Standard gravity', '9.81 m/s² ≈ 32.2 ft/s².'),
  card('e-homog', 2, 'problem-solving', 'Dimensional homogeneity', 'Every term in a valid equation has the same units.'),
  card('e-mco', 2, 'problem-solving', 'Mars Climate Orbiter (1999)', 'Lost because one team used pound-force-seconds and another expected newton-seconds: a units error.'),
  card('e-sigfig', 2, 'problem-solving', 'How many significant figures to report?', 'About as many as your least precise input; often three in engineering.'),
  card('e-statics', 2, 'core-areas', 'Conditions for static equilibrium', 'ΣF = 0 and ΣM = 0.'),
  card('e-moment', 2, 'core-areas', 'Moment (torque)', 'Force × perpendicular distance: M = F·d.'),
  card('e-stress', 2, 'core-areas', 'Normal stress', 'σ = F/A (Pa; N/mm² = MPa).'),
  card('e-strain', 2, 'core-areas', 'Strain', 'ε = ΔL/L, dimensionless.'),
  card('e-hooke', 2, 'core-areas', 'Hooke’s law', 'σ = Eε in the elastic range; E is Young’s modulus.'),
  card('e-esteel', 2, 'core-areas', 'Young’s modulus of steel vs aluminum', 'About 200 GPa vs 70 GPa.'),
  card('e-law1', 2, 'core-areas', 'First law of thermodynamics', 'Energy is conserved.'),
  card('e-law2', 2, 'core-areas', 'Second law, in design terms', 'No heat engine is 100% efficient; entropy increases.'),
  card('e-heat3', 2, 'core-areas', 'Three modes of heat transfer', 'Conduction, convection, radiation.'),
  card('e-hydro', 2, 'core-areas', 'Hydrostatic pressure', 'p = ρgh.'),
  card('e-model', 2, 'modeling', 'Three kinds of models', 'Physical, mathematical, computational.'),
  card('e-fea', 2, 'modeling', 'FEA', 'Finite element analysis: divides a part into a mesh of elements to predict stress, deflection or temperature.'),
  card('e-cfd', 2, 'modeling', 'CFD', 'Computational fluid dynamics: simulates fluid flow and heat transfer.'),
  card('e-vv', 2, 'modeling', 'Verification vs validation', 'Verification: solving the equations right. Validation: solving the right equations (matches tests).'),
  card('e-conv', 2, 'modeling', 'Mesh convergence', 'Refine the mesh until the result stops changing significantly.'),
  card('e-bc', 2, 'modeling', 'Boundary conditions', 'The supports, loads and other conditions applied to a model; wrong ones make results wrong.'),
  card('e-dp', 3, 'design', 'Engineering design process', 'Define, research, requirements, concepts, select, detail, prototype, test, iterate, communicate.'),
  card('e-req', 3, 'design', 'A good requirement is…', 'Specific and measurable (testable).'),
  card('e-constraint', 3, 'design', 'Examples of design constraints', 'Cost, safety, size, weight, time, manufacturability, codes and standards, sustainability.'),
  card('e-matrix', 3, 'design', 'Weighted decision matrix', 'Score each concept on each weighted criterion; multiply and add; highest total wins.'),
  card('e-pugh', 3, 'design', 'Pugh matrix', 'Compare concepts with a baseline: better (+), same (0), worse (−).'),
  card('e-fs', 3, 'design', 'Factor of safety', 'FS = strength (or failure load) ÷ working stress (or load).'),
  card('e-mfg5', 3, 'manufacturing', 'Five families of manufacturing processes', 'Casting, forming, machining, joining, additive.'),
  card('e-sub', 3, 'manufacturing', 'Subtractive vs additive', 'Machining cuts material away; 3D printing builds layer by layer.'),
  card('e-fdm', 3, 'manufacturing', 'FDM / SLA / SLS', 'Extruded filament / laser-cured resin / laser-sintered powder.'),
  card('e-inj', 3, 'manufacturing', 'Why injection moulding for mass production?', 'Expensive moulds but very cheap, fast parts at high volume.'),
  card('e-dfm', 3, 'manufacturing', 'DFM/DFA principles', 'Fewer parts, standard parts and fasteners, easy-to-make features, no tighter tolerances than needed.'),
  card('e-report', 4, 'communication', 'Parts of a technical report', 'Abstract/summary, introduction, methods, results, discussion, conclusions, references, appendices.'),
  card('e-ortho', 4, 'communication', 'Orthographic projection', 'Front, top and right-side views at right angles.'),
  card('e-iso', 4, 'communication', 'Isometric view', 'A 3D pictorial drawing with the three axes 120° apart.'),
  card('e-graph', 4, 'communication', 'Rules for an engineering graph', 'Independent variable on x, both axes labelled with units, figure number and caption.'),
  card('e-email', 4, 'communication', 'EMEC 100 email rule', 'Subject must start with “EMEC 100-x:” (your section) or the email is disregarded.'),
  card('e-tuckman', 4, 'teamwork', 'Tuckman’s stages', 'Forming, storming, norming, performing, adjourning.'),
  card('e-charter', 4, 'teamwork', 'Team charter', 'Agreed goals, roles, meeting plan, decision method and consequences, set at the start.'),
  card('e-decide', 4, 'teamwork', 'Consensus vs majority vote', 'Consensus: slow but strong buy-in. Majority: fast but can leave a frustrated minority.'),
  card('e-action', 4, 'teamwork', 'Action items', 'Who does what by when, written at the end of every meeting.'),
  card('e-canon1', 4, 'ethics', 'NSPE Canon 1', 'Hold paramount the safety, health, and welfare of the public.'),
  card('e-canons', 4, 'ethics', 'The other five NSPE canons', 'Competence; objective and truthful statements; faithful agents or trustees; avoid deceptive acts; act honorably and lawfully.'),
  card('e-challenger', 4, 'ethics', 'Challenger (1986)', 'O-ring failure in cold weather; engineers’ warnings were overruled; seven astronauts died.'),
  card('e-hyatt', 4, 'ethics', 'Hyatt Regency walkways (1981)', 'A rod-connection design change doubled the load on a weak connection; 114 died.'),
  card('e-tacoma', 4, 'ethics', 'Tacoma Narrows Bridge (1940)', 'Destroyed by wind-induced aeroelastic flutter.'),
  card('e-citicorp', 4, 'ethics', 'Citicorp Center (1978)', 'LeMessurier found and fixed a wind-load weakness in his own design: owning a mistake.'),
  card('e-737', 4, 'ethics', 'Boeing 737 MAX', 'Two crashes (2018, 2019; 346 deaths) linked to the MCAS system and its single sensor; questions of disclosure and oversight.')
];

module.exports = { SECTIONS, FORMULAS, FLASHCARDS };
