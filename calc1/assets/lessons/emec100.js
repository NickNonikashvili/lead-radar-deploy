/* EMEC 100 Introduction to Mechanical Engineering: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).emec100 = {
  profession: {
    plain: 'Mechanical engineers work on anything that moves or uses energy: engines, bikes, robots, heating systems, medical devices. The job is less about knowing every answer than about turning a fuzzy need into something that works, is safe and can be built for a sensible cost. Many roles share the title: design, analysis, testing, manufacturing, research and sales.',
    figure: { type: 'table', head: ['role', 'on an e-bike project'], rows: [['design engineer', 'frame and motor mount in CAD'], ['analysis engineer', 'frame stress and fatigue checks'], ['test engineer', 'ride and drop tests'], ['manufacturing engineer', 'how to weld and assemble it at scale'], ['thermal engineer', 'keeping the battery cool']], caption: 'One product, many mechanical engineers.' },
    check: [
      ['Name three tasks an ME could own on an electric mountain bike.', 'Frame design, motor/battery cooling, suspension, testing, manufacturing (any three).'],
      ['What two broad things do MEs work with?', 'Motion (machines) and energy (thermal and fluid systems).'],
      ['Is ME mostly about building things by hand?', 'No: it is mostly designing, analysing, testing and communicating.']
    ]
  },
  program: {
    plain: 'The ME degree is a long chain of prerequisites: calculus and physics unlock statics, which unlocks dynamics and mechanics of materials, and so on. Falling behind in one early class can push several later ones back a year, because many are offered only once a year. Plan your semesters with the flowchart, and talk to your advisor early.',
    figure: { type: 'flow', steps: ['Calculus I + Physics I', 'Statics', 'Dynamics + Mechanics of Materials', 'Machine Design', 'Senior Capstone'], caption: 'A prerequisite chain: each box waits for the one before.' },
    check: [
      ['Why can a semester behind in calculus delay you by more than a semester?', 'Later classes need it as a prerequisite and many are offered only once a year.'],
      ['What does ABET accreditation tell employers?', 'The program meets national standards.'],
      ['How many credits does the degree need?', 'At least 128.']
    ]
  },
  careers: {
    plain: 'Experience gets you hired. Internships (usually a summer) and co-ops (alternating semesters of work and school) build skills, references and often job offers, so start looking early. The Professional Engineer licence lets you sign off on public work; the path runs through an accredited degree, the FE exam, supervised experience and the PE exam.',
    figure: { type: 'flow', steps: ['ABET-accredited degree', 'Pass the FE exam (Engineer in Training)', 'About 4 years of supervised experience', 'Pass the PE exam', 'Licensed Professional Engineer'], caption: 'The path to a PE licence.' },
    check: [
      ['Put in order: PE exam, degree, FE exam, experience.', 'Degree → FE exam → experience → PE exam.'],
      ['What is the difference between an internship and a co-op?', 'A co-op alternates full semesters of work and school, often several times with one employer.'],
      ['When should you start looking for internships?', 'Early: many deadlines are in the fall for the next summer.']
    ]
  },
  'problem-solving': {
    plain: 'Engineers solve problems with a fixed layout so anyone can check the work: Given, Find, Diagram, Assumptions, Equations, Solution, and a final Check. Carry units through every line: they catch mistakes. Before trusting a calculator, estimate the answer to the nearest power of ten so a wildly wrong result jumps out.',
    figure: { type: 'flow', steps: ['Given (with units)', 'Find', 'Diagram', 'Assumptions', 'Governing equations', 'Solve, carrying units', 'Check: units, size, sign'], caption: 'The engineering problem-solving format.' },
    check: [
      ['A 75 kg student stands on a scale. What is their weight in newtons?', '$75 \\times 9.81 \\approx 736$ N.'],
      ['And in pounds-force?', '$736 / 4.448 \\approx 165$ lbf.'],
      ['Why write assumptions down?', 'So readers know what was neglected and when the answer stops being valid.']
    ]
  },
  'core-areas': {
    plain: 'Four subjects form the analytical core. Statics: forces on things that are not accelerating. Dynamics: forces that make things move. Mechanics of materials: how much a part stretches and when it breaks (stress is force per area). Thermo-fluids: how energy and fluids flow. A factor of safety compares how strong a part is with how hard it is loaded.',
    figure: { type: 'table', head: ['area', 'big question', 'key idea'], rows: [['statics', 'Will it stay put?', 'ΣF = 0, ΣM = 0'], ['dynamics', 'How will it move?', 'ΣF = ma'], ['mechanics of materials', 'Will it bend or break?', 'σ = F / A'], ['thermo-fluids', 'Where does the energy go?', 'conservation of energy']], caption: 'The analytical core of mechanical engineering.' },
    check: [
      ['A rod with a 100 mm² cross-section carries 12 kN. What is the stress?', '$12000 / 100 = 120$ MPa.'],
      ['The steel yields at 250 MPa. What is the factor of safety?', '$250 / 120 \\approx 2.1$.'],
      ['What is a moment?', 'Force times perpendicular distance: its turning effect.']
    ]
  },
  modeling: {
    plain: 'A model is a simplified stand-in used to predict how something will behave: a scale prototype, a set of equations, or a computer simulation. Every model rests on assumptions, so its answers are only as good as its inputs. Always check software results with a quick hand calculation: if they disagree by a factor of ten, something is wrong.',
    figure: { type: 'table', head: ['model', 'example', 'strength'], rows: [['physical', 'wind-tunnel scale car', 'real behaviour'], ['mathematical', 'beam bending equations', 'fast, insightful'], ['computational', 'finite element analysis', 'complex shapes']], caption: 'Three kinds of model.' },
    check: [
      ['FEA says 15 MPa, a hand calculation says 150 MPa. What do you do?', 'Investigate before trusting either: check units, loads, mesh and boundary conditions.'],
      ['What does "garbage in, garbage out" mean for simulations?', 'Wrong inputs or assumptions give confident but wrong answers.'],
      ['Why build a physical prototype if you have a simulation?', 'To validate the model against reality.']
    ]
  },
  design: {
    plain: 'Design is a loop, not a line: define the problem, research, set requirements, brainstorm many concepts, pick one, detail it, build a prototype, test it, and go round again. A weighted decision matrix turns "which concept is best?" into numbers: score each concept on each criterion, multiply by how much that criterion matters, and add.',
    figure: { type: 'table', head: ['criterion (weight)', 'concept A', 'concept B'], rows: [['cost (0.5)', '4', '3'], ['weight (0.3)', '2', '5'], ['ease of manufacture (0.2)', '5', '3'], ['weighted total', '3.6', '3.6']], caption: '0.5·4 + 0.3·2 + 0.2·5 = 3.6 and 0.5·3 + 0.3·5 + 0.2·3 = 3.6: a tie, so look closer.' },
    check: [
      ['What is the first step of the design process?', 'Define the problem (the need and the requirements).'],
      ['Why brainstorm many concepts before choosing?', 'The first idea is rarely the best; more options lead to better choices.'],
      ['Two concepts tie in the matrix. What next?', 'Check the weights, add criteria or prototype both.']
    ]
  },
  manufacturing: {
    plain: 'How a part is made depends on how many you need, the material and the shape. Machining and 3D printing suit a few parts fast with no tooling cost. Casting, injection moulding and stamping need expensive moulds or dies but make each part cheaply once you make thousands. Design for manufacture means shaping a part so it is easy to make.',
    figure: { type: 'graph', x: [0, 10000], y: [0, 60], fns: [{ f: '40', label: 'machining: 40 each' }, { f: '2+50000/(x+1)', domain: [800, 10000], label: 'moulding: 2 each + 50k tooling' }], xlabel: 'parts made', ylabel: 'cost per part', caption: 'Tooling-heavy processes win once the volume is high.' },
    check: [
      ['5 brackets next week: which process?', 'Machining or 3D printing: no tooling needed.'],
      ['50,000 a year: which process?', 'Stamping, casting or moulding: high tooling cost, low cost per part.'],
      ['What is design for manufacture?', 'Shaping a design so it is easy and cheap to make.']
    ]
  },
  communication: {
    plain: 'A correct design that nobody understands never gets built. Engineers write reports, emails, drawings and presentations all day, for readers who are busy. Put the main point first, make it easy to scan, label every figure and number with units, and match the format to the reader.',
    figure: { type: 'table', head: ['report section', 'answers'], rows: [['abstract / summary', 'What did you find, in one paragraph?'], ['introduction', 'What problem, and why does it matter?'], ['method', 'How did you do it?'], ['results', 'What happened (figures, tables)?'], ['conclusions', 'What does it mean, and what next?']], caption: 'A technical report, section by section.' },
    check: [
      ['Rewrite the email subject "question" for this class.', '"EMEC 100-2: Question about the design matrix due Friday" (course, section, topic).'],
      ['Where does the main finding go in a report?', 'Up front, in the abstract or summary.'],
      ['What must every number in a report carry?', 'Units.']
    ]
  },
  teamwork: {
    plain: 'Engineering is a team sport, and teams go through predictable stages: forming (polite), storming (conflict), norming (agreeing on how to work) and performing. Conflict is normal; what matters is handling it. Write a team charter early: roles, meeting times, how decisions are made and what happens when someone does not pull their weight.',
    figure: { type: 'flow', dir: 'right', steps: ['forming', 'storming', 'norming'], caption: 'Tuckman\'s stages, then performing (and adjourning).' },
    check: [
      ['Two weeks in, the team argues and one member stopped coming. Which stage, and what helps?', 'Storming: talk directly, revisit the team charter, agree on decisions and roles, and involve the instructor if needed.'],
      ['What goes in a team charter?', 'Roles, expectations, meeting plans, decision rules and how to handle problems.'],
      ['Is team conflict always bad?', 'No: handled well, it improves decisions.']
    ]
  },
  ethics: {
    plain: 'Engineers\' work can hurt people, so the profession has a code of ethics. The first canon is the one that overrides the others: hold the public\'s safety, health and welfare paramount. In practice that means never signing off on something you believe is unsafe, staying within your competence and being honest even when a schedule or a boss pushes the other way.',
    figure: { type: 'flow', steps: ['Spot the issue: a part failed a fatigue test', 'Who could be harmed?', 'What does the code say? Safety comes first', 'Raise it: document it and tell your manager', 'Escalate if it is ignored'], caption: 'Working through an ethical problem.' },
    check: [
      ['Your manager asks you to sign off on a part that failed one fatigue test. What do you do?', 'Refuse to sign; document the failure, explain the risk and escalate if needed.'],
      ['Which NSPE canon comes first?', 'Hold paramount the safety, health and welfare of the public.'],
      ['Can you sign off on work outside your expertise?', 'No: engineers practise only in their areas of competence.']
    ]
  }
};
