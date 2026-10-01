/* EMEC 100 question bank: [prompt, correct, [wrong answers], explanation, hint?]. Written for Mathub from the
   course objectives and standard intro-engineering material; not from the instructor. */
const bank = (topic, items, extra = {}) => Object.assign({ type: 'bank', topic, items, options: 4 }, extra);

const topics = {
  profession: { unit: 1, sec: 'profession', label: 'The ME profession' },
  program: { unit: 1, sec: 'program', label: 'The ME program' },
  careers: { unit: 1, sec: 'careers', label: 'Careers & licensure' },
  'problem-solving': { unit: 2, sec: 'problem-solving', label: 'Units & problem solving' },
  'core-areas': { unit: 2, sec: 'core-areas', label: 'Analytical core' },
  modeling: { unit: 2, sec: 'modeling', label: 'Modeling & simulation' },
  design: { unit: 3, sec: 'design', label: 'Design process' },
  manufacturing: { unit: 3, sec: 'manufacturing', label: 'Manufacturing' },
  communication: { unit: 4, sec: 'communication', label: 'Communication' },
  teamwork: { unit: 4, sec: 'teamwork', label: 'Teamwork' },
  ethics: { unit: 4, sec: 'ethics', label: 'Ethics' }
};

const ladders = {
  profession: ['Mechanical engineers work with things that move and with energy.', 'Engineering means designing under constraints; science means discovering.', 'Think of one product and the decisions behind it.'],
  program: ['ABET accreditation, 128 credits, a math and science foundation, then the engineering core.', 'Courses build in a chain: statics before dynamics and mechanics of materials.', 'The capstone is a team project with a working prototype.'],
  careers: ['Internship: a summer. Co-op: alternating terms.', 'FE near graduation, then EIT, about 4 years of experience, then the PE exam.', 'A PE can sign and seal designs for the public.'],
  'problem-solving': ['Write the units with every number.', 'Multiply by a conversion factor equal to 1 (e.g. 25.4 mm / 1 in).', 'Check: are the units right, and is the size of the answer sensible?'],
  'core-areas': ['Name the area: forces at rest (statics), motion (dynamics), deformation (materials), energy (thermo), flow (fluids).', 'Pick the one equation that links the given and the asked quantities.', 'Watch the units: N/mm² = MPa.'],
  modeling: ['Every model has assumptions; name them.', 'Verification checks the math; validation checks against reality.', 'Compare with a quick hand calculation.'],
  design: ['Start from the need, not the solution.', 'Requirements must be measurable; constraints bound the design.', 'Decision matrix: multiply each score by its weight and add.'],
  manufacturing: ['Name the family: casting, forming, machining, joining or additive.', 'Volume drives the choice: few parts means printing or machining; many means moulding, casting or stamping.', 'DFM: fewer parts, standard parts, sensible tolerances.'],
  communication: ['Who is the audience and what do they need first?', 'Graphs: axes labelled with units; independent variable on x.', 'Drawings: orthographic views, dimensions, tolerances.'],
  teamwork: ['Forming, storming, norming, performing.', 'A charter sets roles and how decisions are made.', 'End meetings with action items: who, what, when.'],
  ethics: ['Canon 1: the public’s safety, health and welfare come first.', 'Match the case to its failure: O-rings, a hanger rod, wind flutter.', 'Owning a mistake (Citicorp) is the model to follow.']
};

const questions = [
  /* ===================== Unit 1 ===================== */
  bank('profession', [
    ["Which best describes mechanical engineering?", "Designing, analyzing and building things that move or that use or convert energy", ["Designing only buildings and bridges", "Writing software for websites", "Studying living cells", "Managing financial investments"], "ME is one of the broadest fields: machines, engines, vehicles, HVAC, robots, devices."],
    ["The main difference between engineering and science is that engineering", "applies science to design solutions under constraints", ["never uses mathematics", "only discovers new laws of nature", "does not involve testing", "is only done by one person"], "Science seeks knowledge; engineering designs useful things under cost, safety and other limits."],
    ["Which project is MOST clearly mechanical engineering?", "Designing the cooling system for an electric vehicle battery", ["Writing a mobile banking app", "Designing a power grid’s billing system", "Drafting a city’s tax policy", "Sequencing a genome"], "Heat transfer and thermal management are core ME."],
    ["The two big families of knowledge in ME are mechanics and", "thermal-fluid science", ["accounting", "organic chemistry", "computer graphics only", "genetics"], "Forces, motion and materials, plus energy, heat and flow."],
    ["Compared with mechanical engineering, Mechanical Engineering Technology focuses more on", "applying established methods and hands-on implementation", ["advanced theoretical research only", "medicine", "law", "nothing; they are identical"], "MSU offers both degrees; they lead to different roles and licensure paths."],
    ["Which constraint is an engineer most likely to face in every design?", "Cost", ["The weather on launch day", "The engineer’s favourite colour", "The stock price", "The number of patents filed last year"], "Cost, safety, time and manufacturability constrain nearly every design."],
    ["Mechanical engineers usually design products", "in teams with other engineers, technicians and business specialists", ["entirely alone", "without any communication", "only after they are manufactured", "without customer input"], "Cross-disciplinary teamwork is normal."],
    ["Which industry is a major employer of mechanical engineers?", "Machinery and transportation-equipment manufacturing", ["Retail clothing sales", "Restaurants", "Real estate agencies", "Social media marketing"], "Engineering services and manufacturing are among the largest employers."]
  ]),
  bank('program', [
    ["What does ABET accreditation of an engineering program indicate?", "It meets national standards for engineering education", ["It is the cheapest program in the state", "Students do not need math", "Graduates are automatically licensed PEs", "It is a two-year degree"], "Accreditation is the first step on the usual path to licensure."],
    ["What is the minimum number of credits for MSU’s B.S. in Mechanical Engineering?", "128", ["64", "90", "150", "200"], "With at least 42 credits at the 300 level or above."],
    ["Which course is usually taken BEFORE dynamics and mechanics of materials?", "Statics", ["Capstone design", "Heat transfer", "Machine design", "Senior lab"], "Statics (forces in balance) is the foundation of the mechanics sequence."],
    ["The ME capstone design experience asks a team to", "solve a real-world design problem and build a working prototype", ["write a history paper", "take one final exam", "intern abroad", "teach a class"], "It ties the whole curriculum together."],
    ["What is the co-requisite for EMEC 100?", "M 151Q (precalculus)", ["M 273 (multivariable calculus)", "PHSX 220", "EMEC 342", "None"], "The calculus sequence that follows gates most engineering science courses."],
    ["Why can falling behind in math delay graduation by more than one semester?", "Engineering courses are built in a prerequisite chain", ["Math is only offered every four years", "MSU does not allow repeats", "Engineering courses do not use math", "Advisers forbid it"], "One missing link pushes the whole chain back."],
    ["Which subject is part of the thermal-fluids side of the ME curriculum?", "Heat transfer", ["Statics", "Engineering graphics", "Mechanics of materials", "Statistics"], "Thermodynamics, fluid mechanics and heat transfer."],
    ["Where should you check your exact degree requirements?", "The MSU catalog for your year, with your adviser", ["A friend’s old syllabus", "Social media", "Any website about engineering", "Nowhere; they never change"], "Requirements can change by catalog year."]
  ]),
  bank('careers', [
    ["What is a co-op?", "Alternating terms of full-time engineering work with semesters of school", ["A one-day job shadow", "A student club", "A type of exam", "An online course"], "An internship is usually a single summer."],
    ["What is usually the first exam on the path to a PE license?", "The Fundamentals of Engineering (FE) exam", ["The PE exam", "The GRE", "The SAT", "A driving test"], "Most students take the FE near graduation."],
    ["Which order leads to a Professional Engineer license?", "ABET degree → FE exam → EIT → about 4 years of experience → PE exam", ["PE exam → FE exam → degree", "Degree → PE exam → FE exam", "Internship → PE → degree", "FE → degree → PE immediately"], "Requirements vary somewhat by state."],
    ["What can a licensed PE do that an unlicensed engineer cannot?", "Sign and seal engineering designs offered to the public", ["Use CAD software", "Work in a team", "Attend engineering conferences", "Join ASME"], "Many industry roles don’t require a PE, but it opens doors."],
    ["The FE exam is", "a computer-based NCEES exam of about 110 questions", ["an essay written for a professor", "an oral interview", "a take-home project", "a high-school test"], "About 6 hours, with an electronic reference."],
    ["ASME is", "the American Society of Mechanical Engineers", ["a federal regulator", "an engineering exam", "a CAD program", "a type of steel"], "Student sections, codes and standards, networking."],
    ["What belongs on a strong first engineering résumé?", "Projects, tools (CAD, Excel), teams and measurable results, on one page", ["A full life story over five pages", "Only high-school grades", "Hobbies unrelated to anything, with no projects", "Photos of your car"], "Class and club projects count."],
    ["When should students start looking for internships?", "Early, including first and second year", ["Only after graduation", "Only in senior year", "Never; jobs find you", "Only if a professor assigns it"], "Early experience compounds."]
  ]),

  /* ===================== Unit 2 ===================== */
  bank('problem-solving', [
    ["Which is an SI base unit?", "kilogram (kg)", ["newton (N)", "pascal (Pa)", "joule (J)", "watt (W)"], "The others are derived units."],
    ["One newton equals", "1 kg·m/s²", ["1 kg·m/s", "1 kg/m²", "1 J/s", "1 lbf"], "From F = ma."],
    ["One megapascal equals", "1 N/mm²", ["1 N/m²", "1 kN/m²", "1 N/cm", "1 J/m³ × 10⁻⁶"], "1 MPa = 10⁶ N/m² = 1 N/mm²."],
    ["Mass and weight differ because", "weight is a force (W = mg), while mass measures matter", ["they are the same quantity", "mass changes on the Moon but weight does not", "weight is measured in kilograms", "mass is a force"], "Weight changes with gravity; mass does not."],
    ["An equation is dimensionally homogeneous when", "every term has the same units", ["it has no units at all", "it uses only SI units", "it has one term", "it gives the right answer"], "Checking units catches algebra mistakes."],
    ["NASA’s Mars Climate Orbiter was lost in 1999 because", "one team used pound-force-seconds and another expected newton-seconds", ["the rocket ran out of fuel", "it collided with a moon", "a solar flare destroyed it", "the launch was cancelled"], "A unit mismatch in navigation data."],
    ["Which step should come LAST in the problem-solving method?", "Check the answer’s units and whether its size makes sense", ["List what is given", "Draw a diagram", "State assumptions", "Write governing equations"], "Given, Find, Diagram, Assumptions, Equations, Solve, Check."],
    ["A calculator shows 12.345678 for a result from inputs with three significant figures. Report", "12.3", ["12.345678", "12", "12.35", "10"], "Match the precision of the least precise input."],
    ["Which conversion is exact by definition?", "1 in = 25.4 mm", ["1 lbf = 4.448 N", "1 hp = 745.7 W", "1 psi = 6.895 kPa", "1 kg = 2.205 lbm"], "The inch is defined as exactly 25.4 mm."],
    ["On Earth, an object with a mass of 1 lbm weighs about", "1 lbf", ["9.81 lbf", "32.2 lbf", "4.448 lbf", "0.454 lbf"], "That coincidence is why lbm and lbf get confused."],
    ["A quick order-of-magnitude estimate is useful because it", "shows whether a detailed answer is plausible", ["replaces all detailed analysis", "is always exact", "avoids units", "is required by law"], "Fermi estimates catch gross errors."],
    ["Standard gravity is about", "9.81 m/s²", ["9.81 ft/s²", "32.2 m/s²", "1 m/s²", "98.1 m/s²"], "Also about 32.2 ft/s²."]
  ]),
  { type: 'calc', topic: 'problem-solving',
    vars: { c: [
      { what: 'force', a: 'lbf', b: 'N', k: 4.448 }, { what: 'length', a: 'in', b: 'mm', k: 25.4 }, { what: 'length', a: 'ft', b: 'm', k: 0.3048 },
      { what: 'pressure', a: 'psi', b: 'kPa', k: 6.895 }, { what: 'power', a: 'hp', b: 'kW', k: 0.7457 }, { what: 'mass', a: 'kg', b: 'lbm', k: 2.205 },
      { what: 'speed', a: 'mph', b: 'm/s', k: 0.44704 }
    ], x: { min: 2, max: 60, step: 2 } },
    prompt: 'Convert {{x}} {{a}} of {{what}} to {{b}}.',
    answer: 'round(x * k, 3)', tol: 0.01,
    explain: '{{x}} {{a}} × {{k}} {{b}}/{{a}} = {{= sig(x * k, 4)}} {{b}}.' },
  { type: 'calc', topic: 'problem-solving', vars: { f: { min: -20, max: 110, step: 5 } },
    prompt: 'Convert {{f}} °F to °C.', answer: 'round((f - 32) * 5 / 9, 2)', tol: 0.01,
    explain: '°C = (°F − 32) × 5/9 = ({{f}} − 32) × 5/9 = {{= round((f - 32) * 5 / 9, 1)}} °C.' },
  { type: 'calc', topic: 'problem-solving', vars: { m: { min: 5, max: 120, step: 5 } },
    prompt: 'What is the weight, in newtons, of a {{m}} kg object on Earth? (g = 9.81 m/s²)', answer: 'm * 9.81', tol: 0.005,
    explain: 'W = mg = {{m}} × 9.81 = {{= round(m * 9.81, 1)}} N.' },
  bank('core-areas', [
    ["A body is in static equilibrium when", "the sum of forces and the sum of moments are both zero", ["it moves at increasing speed", "only the sum of forces is zero", "it has no mass", "its temperature is constant"], "ΣF = 0 and ΣM = 0."],
    ["Normal stress is defined as", "force divided by cross-sectional area", ["force times distance", "mass times acceleration", "change in length divided by length", "energy per unit time"], "σ = F/A."],
    ["Strain has units of", "none (it is a ratio of lengths)", ["N", "Pa", "m", "J"], "ε = ΔL/L."],
    ["In the elastic range, Hooke’s law relates stress and strain through", "Young’s modulus, E", ["the factor of safety", "density", "the coefficient of friction", "thermal conductivity"], "σ = Eε."],
    ["Which material is stiffer (higher Young’s modulus)?", "Steel (about 200 GPa)", ["Aluminum (about 70 GPa)", "Rubber", "Polyethylene", "Wood across the grain"], "Steel is about three times stiffer than aluminum."],
    ["The first law of thermodynamics states that", "energy is conserved", ["entropy always decreases", "heat flows from cold to hot", "every engine is 100% efficient", "pressure equals force over area"], "Energy changes form but is not created or destroyed."],
    ["According to the second law of thermodynamics,", "no heat engine can convert all heat into work", ["energy is not conserved", "machines can exceed 100% efficiency", "heat cannot move", "entropy is always zero"], "Some heat is always rejected."],
    ["Heat moving through a solid metal rod from the hot end to the cold end is", "conduction", ["convection", "radiation", "advection only", "insulation"], "Convection involves a moving fluid; radiation is electromagnetic."],
    ["Which branch of ME studies motion and the forces that cause it?", "Dynamics", ["Statics", "Heat transfer", "Materials science", "Engineering graphics"], "F = ma, kinematics, energy and momentum."],
    ["Hydrostatic pressure in a liquid increases with", "depth", ["the container’s colour", "the container’s width only", "altitude above the liquid", "nothing; it is constant"], "p = ρgh."],
    ["A moment (torque) is", "a force times its perpendicular distance from a point", ["a force divided by area", "mass times velocity", "energy per unit time", "a change in temperature"], "M = F·d."],
    ["A material that deforms a lot before breaking is", "ductile", ["brittle", "stiff", "hard", "dense"], "Brittle materials break with little deformation."]
  ]),
  { type: 'calc', topic: 'core-areas', vars: { F: { min: 2, max: 40, step: 2 }, A: [20, 25, 40, 50, 80, 100, 125, 200, 250] },
    prompt: 'A rod with a cross-sectional area of {{A}} mm² carries a tensile load of {{F}} kN. What is the normal stress in MPa?',
    answer: 'F * 1000 / A', tol: 0.005,
    explain: 'σ = F/A = {{F}},000 N ÷ {{A}} mm² = {{= round(F * 1000 / A, 2)}} N/mm² = {{= round(F * 1000 / A, 2)}} MPa.' },
  { type: 'calc', topic: 'core-areas', vars: { F: { min: 20, max: 300, step: 10 }, d: [0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5] },
    prompt: 'You push on a wrench with {{F}} N, applied perpendicular to the handle {{d}} m from the bolt. What torque do you apply, in N·m?',
    answer: 'F * d', tol: 0.005, explain: 'M = F·d = {{F}} × {{d}} = {{= round(F * d, 2)}} N·m.' },
  { type: 'calc', topic: 'core-areas', vars: { h: { min: 1, max: 30 } },
    prompt: 'What is the gauge pressure, in kPa, at a depth of {{h}} m in fresh water? (ρ = 1000 kg/m³, g = 9.81 m/s²)',
    answer: '1000 * 9.81 * h / 1000', tol: 0.005, explain: 'p = ρgh = 1000 × 9.81 × {{h}} = {{= round(9810 * h, 0)}} Pa = {{= round(9.81 * h, 2)}} kPa.' },
  { type: 'calc', topic: 'core-areas', vars: { pin: { min: 200, max: 2000, step: 100 }, eta: [0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95] },
    prompt: 'A motor draws {{pin}} W of electrical power and is {{= round(eta * 100, 0)}}% efficient. How much mechanical power, in W, does it deliver?',
    answer: 'pin * eta', tol: 0.005, explain: 'Output = η × input = {{eta}} × {{pin}} = {{= round(pin * eta, 1)}} W. The rest becomes heat.' },
  bank('modeling', [
    ["Which is a computational model?", "A finite element analysis of a bracket", ["A clay scale model of a car", "A wind-tunnel test model", "A cardboard prototype", "A hand sketch"], "Computational models solve equations numerically."],
    ["FEA stands for", "finite element analysis", ["fast energy approximation", "fluid equation algorithm", "final engineering assessment", "force estimation app"], "It divides a part into a mesh of elements."],
    ["CFD is used mainly to simulate", "fluid flow and heat transfer", ["stock prices", "electrical circuits only", "chemical bonding", "manufacturing schedules"], "Computational fluid dynamics."],
    ["Verification asks", "whether the equations are being solved correctly", ["whether the model matches physical tests", "whether the customer likes the design", "whether the part is cheap", "whether the mesh is coloured"], "Validation asks whether they are the right equations."],
    ["Validation of a simulation means", "comparing its predictions with physical test data", ["checking the spelling in the report", "running the same model twice", "using a finer colour scale", "increasing the number of decimal places"], "Solving the right equations."],
    ["In a mesh convergence study, you", "refine the mesh until the results stop changing significantly", ["use the coarsest mesh possible", "delete elements with high stress", "change the material until it passes", "skip boundary conditions"], "Coarse meshes can under-predict peak stress."],
    ["“Garbage in, garbage out” in simulation means", "wrong inputs (loads, units, supports) give wrong results, however polished", ["simulations always fail", "only free software works", "outputs must be deleted", "physical tests are useless"], "Check inputs and assumptions."],
    ["Which is an assumption, not a fact, in a model?", "Friction is negligible", ["The part is made of steel", "The load is 500 N as measured", "The test lasted 10 minutes", "The bolt diameter is 10 mm"], "Assumptions simplify reality; state and check them."],
    ["An FEA result disagrees with a quick hand calculation by a factor of 10. The best first step is to", "check units, loads and boundary conditions", ["trust the FEA because computers are exact", "trust the hand calculation without checking", "publish both and move on", "make the mesh coarser"], "Large gaps usually mean an input or units error."],
    ["A digital twin is", "a model kept updated with live sensor data from a real machine", ["a second copy of a CAD file", "a backup engineer", "a twin-cylinder engine", "a mirrored drawing"], "Used for monitoring and predicting maintenance."]
  ]),

  /* ===================== Unit 3 ===================== */
  bank('design', [
    ["The first step of the engineering design process is to", "define the problem and the customer’s needs", ["build a prototype", "pick your favourite solution", "order materials", "write the final report"], "Start from the need, not a solution."],
    ["Which requirement is written well?", "The lift must raise 50 kg to 1.2 m in under 10 seconds", ["The lift should be good", "The lift must be strong and fast", "The lift should look modern", "The lift must be the best on the market"], "Good requirements are measurable and testable."],
    ["The engineering design process is best described as", "iterative: test results feed back into earlier steps", ["a single straight line with no returns", "random", "finished after the first sketch", "only about manufacturing"], "Designs improve through cycles."],
    ["In a weighted decision matrix, each concept’s total score is", "the sum of each criterion’s weight times the concept’s score", ["the highest single score", "the number of criteria", "the cheapest option’s price", "the average weight"], "S = Σ wᵢsᵢ."],
    ["During brainstorming, the team should", "generate many ideas before judging any", ["criticize each idea immediately", "pick the first idea", "let only the leader speak", "avoid sketches"], "Quantity first, evaluation later."],
    ["A factor of safety of 2 means", "the part can withstand twice the expected working load or stress", ["the part will fail at half the load", "two engineers checked it", "the part costs twice as much", "the design was tested twice"], "FS = strength ÷ working stress."],
    ["Which is a design constraint?", "The product must cost less than $40 to manufacture", ["Brainstorm ten ideas", "The team meets on Tuesdays", "Use a decision matrix", "Write a report"], "Constraints bound the acceptable designs."],
    ["A Pugh matrix compares concepts", "against a baseline concept using +, 0 and −", ["by price only", "by weight only", "by random draw", "with no criteria"], "A quick, qualitative screening tool."],
    ["Why might engineers choose a higher factor of safety?", "Loads or material properties are uncertain, or failure would be catastrophic", ["To make the part lighter", "To reduce cost", "Because testing is impossible", "Because customers ask for colourful parts"], "More uncertainty or higher stakes call for more margin."],
    ["Which is NOT usually part of the design process?", "Skipping testing to save time", ["Prototyping", "Concept selection", "Writing requirements", "Iteration"], "Testing reveals what analysis misses."]
  ]),
  { type: 'calc', topic: 'design', vars: { S: [150, 200, 250, 300, 350, 400, 500], s: { min: 50, max: 250, step: 10 } }, where: 'S > s',
    prompt: 'A part made of a material with a yield strength of {{S}} MPa sees a maximum working stress of {{s}} MPa. What is the factor of safety against yielding?',
    answer: 'round(S / s, 2)', tol: 0.01, explain: 'FS = strength ÷ stress = {{S}} ÷ {{s}} = {{answer}}.' },
  { type: 'calc-mc', topic: 'design', options: 3, vars: { w1: [0.2, 0.3, 0.4, 0.5, 0.6], w2: [0.1, 0.2, 0.3], a1: { min: 1, max: 5 }, a2: { min: 1, max: 5 }, a3: { min: 1, max: 5 }, b1: { min: 1, max: 5 }, b2: { min: 1, max: 5 }, b3: { min: 1, max: 5 } },
    let: { w3: 'round(1 - w1 - w2, 2)', A: 'round(w1 * a1 + w2 * a2 + w3 * a3, 2)', B: 'round(w1 * b1 + w2 * b2 + w3 * b3, 2)' }, where: 'w3 > 0 && A != B',
    prompt: 'A decision matrix uses weights cost {{w1}}, weight {{w2}} and reliability {{w3}}. Concept A scores {{a1}}, {{a2}}, {{a3}} and Concept B scores {{b1}}, {{b2}}, {{b3}} (1–5, higher is better). Which concept wins?',
    answer: 'A > B ? "Concept A" : "Concept B"', distractors: ['"Concept A"', '"Concept B"', '"It is a tie"'],
    explain: 'A = {{w1}}·{{a1}} + {{w2}}·{{a2}} + {{w3}}·{{a3}} = {{A}}. B = {{w1}}·{{b1}} + {{w2}}·{{b2}} + {{w3}}·{{b3}} = {{B}}. {{answer}} has the higher total.' },
  bank('manufacturing', [
    ["Pouring molten metal into a mould is", "casting", ["machining", "forging", "welding", "3D printing"], "Engine blocks are commonly cast."],
    ["Removing material with a lathe or mill is", "machining (subtractive manufacturing)", ["casting", "additive manufacturing", "injection moulding", "stamping"], "Accurate, but it wastes material."],
    ["Building a part layer by layer from a digital model is", "additive manufacturing", ["forging", "turning", "extrusion", "brazing"], "3D printing: FDM, SLA, SLS, metal powder bed."],
    ["Which process is best for 100,000 identical plastic housings?", "Injection moulding", ["Hand carving", "FDM 3D printing one at a time", "CNC machining each from a block", "Sand casting"], "High tooling cost, but very cheap parts at volume."],
    ["Which process is usually best for five quick prototypes?", "3D printing or CNC machining", ["Building an injection mould", "Making a forging die", "Setting up a stamping line", "Investment casting"], "No expensive tooling."],
    ["Shaping hot metal by hammering or pressing it in dies is", "forging", ["casting", "milling", "soldering", "sintering"], "Wrenches and crankshafts are often forged."],
    ["Welding belongs to which family of processes?", "Joining", ["Casting", "Forming", "Additive", "Machining"], "So do fasteners, brazing and adhesives."],
    ["Which is a design-for-manufacturing principle?", "Reduce the number of parts and use standard fasteners", ["Specify the tightest possible tolerance everywhere", "Use a unique fastener for every joint", "Add features that are hard to machine", "Ignore the production volume"], "Fewer, simpler, standard parts cost less."],
    ["SLA 3D printing uses", "a laser to cure liquid resin", ["melted plastic filament", "a lathe", "sand moulds", "a forging hammer"], "FDM extrudes filament; SLS sinters powder."],
    ["Why do tight tolerances raise cost?", "They need slower processes, more inspection and more rejected parts", ["They use cheaper materials", "They speed up production", "They are required by law for all parts", "They reduce the need for drawings"], "Specify only what the function needs."]
  ]),
  { type: 'table', topic: 'manufacturing', options: 4, columns: ['Process', 'Family', 'Typical example'], rows: [
    ['Sand casting', 'casting', 'an engine block'],
    ['Die casting', 'casting', 'an aluminum gearbox housing'],
    ['Forging', 'forming', 'a wrench or a crankshaft'],
    ['Sheet-metal stamping', 'forming', 'a car door panel'],
    ['Extrusion', 'forming', 'an aluminum window-frame profile'],
    ['Turning on a lathe', 'machining', 'a shaft'],
    ['Milling', 'machining', 'a pocketed bracket'],
    ['Welding', 'joining', 'a bicycle frame'],
    ['FDM 3D printing', 'additive', 'a quick plastic prototype'],
    ['Injection moulding', 'moulding', 'a plastic phone case']
  ], asks: [
    { prompt: 'Which process is most typical for making {{Typical example}}?', answer: 'Process', explain: '{{Process}} ({{Family}}).' },
    { prompt: 'Which family of processes does {{Process}} belong to?', answer: 'Family', explain: '{{Process}} is {{Family}}, e.g. {{Typical example}}.' }
  ] },

  /* ===================== Unit 4 ===================== */
  bank('communication', [
    ["Which section of a technical report states the main findings briefly at the start?", "The abstract or executive summary", ["The appendix", "The references", "The methods", "The title block"], "Busy readers read it first, and sometimes only it."],
    ["On an engineering graph, the independent variable usually goes on", "the x-axis", ["the y-axis", "the title", "the legend only", "a separate table"], "Label both axes with quantity and units."],
    ["Orthographic projection shows", "front, top and side views at right angles", ["a single 3D perspective view", "only the interior", "the part’s cost", "a photograph"], "The basis of engineering drawings."],
    ["An isometric drawing is", "a 3D pictorial view with the axes 120° apart", ["a set of flat views", "a cross-section", "a circuit diagram", "a flowchart"], "Good for showing overall shape."],
    ["What must an EMEC 100 email subject line start with?", "“EMEC 100-x:” with your section number", ["“URGENT”", "Your student ID", "Nothing; leave it blank", "The professor’s name"], "Emails without it are disregarded."],
    ["A good slide in a technical presentation has", "one main idea and a readable graph", ["every result in tiny text", "full paragraphs to read aloud", "no labels", "animations on every bullet"], "Know your audience and practise."],
    ["A section view on a drawing shows", "the interior of a part as if cut along a plane", ["the part’s price", "the assembly schedule", "the colour", "the shipping address"], "Hidden internal features become visible."],
    ["Which is the biggest problem with this graph: axes labelled “x” and “y” with no units?", "Readers cannot tell what was measured or its scale", ["It uses too many colours", "It is too small", "It has a title", "It shows data"], "Every axis needs a quantity and units."],
    ["When should you email a professor about an assignment?", "Well before the deadline, with a clear subject and question", ["One minute before it is due", "Only after the grade is posted", "Never; just guess", "By text message at midnight"], "Professional and timely."],
    ["Citing sources in engineering reports is required because", "it credits others’ work and lets readers check your information", ["it makes reports longer", "only English classes need it", "it is optional for numbers", "the software adds it automatically"], "Uncited copying is plagiarism."]
  ]),
  bank('teamwork', [
    ["In Tuckman’s model, the stage marked by conflict over roles and ideas is", "storming", ["forming", "norming", "performing", "adjourning"], "Forming → storming → norming → performing."],
    ["What should a team charter include?", "Goals, roles, meeting plan, decision method and expectations", ["Only the final grade", "Each member’s GPA", "The project’s colour scheme", "Nothing; charters are optional and useless"], "Agree on it at the start."],
    ["Consensus decision-making is", "slow but builds strong buy-in", ["the fastest method", "decided by one person", "random", "majority rule by one vote"], "Everyone can live with the decision."],
    ["Which stage comes right after storming?", "Norming", ["Forming", "Performing", "Adjourning", "Brainstorming"], "The team agrees on how to work."],
    ["Action items at the end of a meeting record", "who does what by when", ["who arrived late", "the meeting’s length", "lunch orders", "nothing important"], "They keep the team accountable."],
    ["Healthy team conflict focuses on", "ideas and the shared goal, not on people", ["personal attacks", "avoiding all disagreement", "who is smartest", "ignoring problems until the deadline"], "Address problems early and directly."],
    ["Why can diverse teams produce better designs?", "They consider more perspectives and catch more errors", ["They always agree immediately", "They need no communication", "They skip testing", "They avoid all conflict"], "Different backgrounds widen the options."],
    ["A teammate stops contributing. The best first step is to", "talk with them directly and respectfully, referring to the charter", ["do all their work silently", "complain only on the final peer review", "remove their name without telling them", "ignore it"], "Early, direct communication."]
  ]),
  bank('ethics', [
    ["NSPE Fundamental Canon 1 says engineers shall", "hold paramount the safety, health, and welfare of the public", ["maximize profit for their employer", "finish every project on schedule", "never admit mistakes", "work only in teams"], "Safety comes first."],
    ["Which is an NSPE Fundamental Canon?", "Perform services only in areas of their competence", ["Always choose the cheapest design", "Never speak to the public", "Keep all test results secret", "Follow the manager’s orders above all"], "The others cover truthfulness, faithful agency, no deception and honorable conduct."],
    ["The Challenger disaster (1986) is linked to", "O-ring seals failing in cold weather after engineers’ warnings were overruled", ["a bridge collapsing in wind", "a hotel walkway connection", "a software unit mismatch on Mars", "a dam overflow"], "Seven astronauts died."],
    ["The 1981 Hyatt Regency walkway collapse was caused by", "a design change in the hanger-rod connection that doubled the load on it", ["an earthquake", "wind flutter", "a fire", "corrosion over 50 years"], "114 people died."],
    ["The Tacoma Narrows Bridge collapsed in 1940 because of", "wind-induced aeroelastic flutter", ["an overloaded truck", "an earthquake", "a ship collision", "a fire"], "Engineers learned to account for aerodynamics."],
    ["Why is the Citicorp Center (1978) taught as a positive ethics case?", "The engineer found a flaw in his own design, reported it and had it fixed", ["The building was the tallest in the world", "It was finished early", "It cost less than planned", "No one ever found the flaw"], "William LeMessurier owned his mistake."],
    ["Your manager asks you to approve a part that failed a safety test. According to the NSPE Code you should", "not approve it, document the failure and explain the risk", ["approve it to meet the schedule", "approve it if nobody will find out", "change the test data", "quit without saying why"], "Canon 1 and the duty of truthfulness."],
    ["A conflict of interest arises when", "a personal interest could influence your professional judgment", ["two engineers disagree about a design", "a project is late", "a client changes requirements", "you work on two projects"], "Disclose it or avoid it."],
    ["Plagiarism is an engineering ethics issue because", "it misrepresents others’ work as your own (a deceptive act)", ["it is only a grammar problem", "engineers never write", "it is legal in industry", "it saves time"], "Canon 5: avoid deceptive acts."],
    ["The Boeing 737 MAX crashes raised questions about", "an automated flight-control system relying on one sensor, and disclosure to pilots", ["O-ring seals in cold weather", "a hotel walkway", "bridge flutter", "units on a Mars probe"], "Two crashes, 346 deaths."]
  ]),
  { type: 'table', topic: 'ethics', options: 4, columns: ['Case', 'Year', 'What went wrong or right'], rows: [
    ['Tacoma Narrows Bridge', '1940', 'wind-induced flutter destroyed a new suspension bridge'],
    ['Citicorp Center', '1978', 'an engineer reported and fixed a hidden flaw in his own design'],
    ['Hyatt Regency walkways', '1981', 'a connection design change doubled the load and the walkways fell'],
    ['Space Shuttle Challenger', '1986', 'O-ring seals failed in cold weather after warnings were overruled'],
    ['Mars Climate Orbiter', '1999', 'imperial and metric units were mixed in navigation data'],
    ['Boeing 737 MAX', '2018–19', 'an automated control system relied on a single sensor']
  ], asks: [
    { prompt: 'Which case is this: {{What went wrong or right}}?', answer: 'Case', explain: '{{Case}} ({{Year}}).' },
    { prompt: 'When did the {{Case}} case happen?', answer: 'Year', explain: '{{Case}}, {{Year}}: {{What went wrong or right}}.' }
  ] }
];

module.exports = { hint: 'Name the topic first, then rule out options that belong to a different stage, process or case.', topics, ladders, questions };
