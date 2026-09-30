/* ============================================================
   Mathub — KIN 322 question bank
   Multiple-choice banks for every topic, plus generators for the parts
   that are worked out or looked up by rule: planes and axes, lever
   classes, torque and muscle force, mechanical advantage, stress and
   strain, contraction type, the convex–concave rule, spinal cord levels,
   scapulohumeral rhythm, carpals, normal ROM, knee ligament tests, leg
   compartments, hip angles, Trendelenburg, and gait timing. Written for
   Mathub from standard kinesiology content; lecture and lab decide what
   the exams actually ask.
   ============================================================ */
(function (global) {
  'use strict';
  const TOPICS = {
    terms: { unit: 1, sec: 'terms', label: 'Planes, axes & terms' },
    joints: { unit: 1, sec: 'joints', label: 'Joints & arthrokinematics' },
    tissue: { unit: 1, sec: 'tissue', label: 'Tissue & muscle mechanics' },
    levers: { unit: 1, sec: 'levers', label: 'Levers & torque' },
    spine: { unit: 1, sec: 'spine', label: 'Vertebral column' },
    trunk: { unit: 1, sec: 'trunk', label: 'Trunk muscles & SCI' },
    shoulder: { unit: 2, sec: 'shoulder', label: 'Shoulder complex' },
    elbow: { unit: 2, sec: 'elbow', label: 'Elbow & forearm' },
    'wrist-hand': { unit: 2, sec: 'wrist-hand', label: 'Wrist & hand' },
    hip: { unit: 3, sec: 'hip', label: 'Pelvis & hip' },
    knee: { unit: 3, sec: 'knee', label: 'Knee' },
    ankle: { unit: 3, sec: 'ankle', label: 'Leg & ankle' },
    foot: { unit: 4, sec: 'foot', label: 'Foot' },
    gait: { unit: 4, sec: 'gait', label: 'Gait' }
  };
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = x => String(Math.round(x * 1000) / 1000);
  function mc(topic, prompt, correct, distractors, explanation, hint) { const opts = [String(correct)]; for (const d of distractors) { const s = String(d); if (!opts.includes(s)) opts.push(s); } const options = shuffle(opts.slice(0, 5)); return { topic, type: 'mc', prompt, options, answer: options.indexOf(String(correct)), explanation, hint }; }
  function num(topic, prompt, answer, explanation, hint, tol) { return { topic, type: 'num', prompt, answer, answerTex: fmt(answer), explanation, hint, tol: tol || 0.01 }; }
  /* a bank item is [prompt, correct, [distractors], explanation, hint] */
  const bank = (topic, items) => { const g = () => { const it = pick(items); return mc(topic, it[0], it[1], it[2], it[3], it[4] || 'Eliminate options that belong to a different joint, muscle group or plane first.'); }; g.bankSize = items.length; return g; };
  /* a table item is [prompt, correct, [distractors], explanation]; like a bank, but for rule lookups */
  const table = (topic, items, hint) => { const g = () => { const it = pick(items); return mc(topic, it[0], it[1], shuffle(it[2]), it[3], hint); }; return g; };

  /* ---------- Unit 1: foundations and the axial skeleton ---------- */
  const qTerms = bank('terms', [
    ['In anatomical position, the palms face', 'forward (anteriorly)', ['backward', 'toward the body', 'downward', 'upward'], 'Anatomical position: upright, facing forward, arms at the sides, palms forward.'],
    ['The elbow is ___ to the wrist.', 'proximal', ['distal', 'superficial', 'lateral', 'inferior'], 'Along a limb, proximal means closer to the trunk.'],
    ['The study of the forces that cause motion is', 'kinetics', ['kinematics', 'osteokinematics', 'anthropometry', 'arthrokinematics'], 'Kinematics describes motion without its causes.'],
    ['A squat, where the feet stay fixed on the floor, is an example of', 'a closed kinetic chain', ['an open kinetic chain', 'a first-class lever', 'passive insufficiency', 'arthrokinematics'], 'In a closed chain the distal segment is fixed and the proximal segments move over it.'],
    ['Bringing the thumb pad to touch the little finger pad is', 'opposition', ['circumduction', 'abduction', 'protraction', 'supination'], 'Opposition happens mainly at the saddle-shaped thumb CMC joint.'],
    ['Moving the scapula away from the spine, as in a forward punch, is', 'protraction', ['retraction', 'elevation', 'depression', 'downward rotation'], 'Retraction pulls it toward the spine.'],
    ['A movement combining flexion, abduction, extension and adduction in a cone is', 'circumduction', ['rotation', 'opposition', 'horizontal abduction', 'pronation'], 'Circumduction occurs at biaxial and triaxial joints.'],
    ['How many degrees of freedom does a ball-and-socket joint have?', '3', ['1', '2', '4', '6'], 'It moves in all three planes.'],
    ['The motion of joint surfaces relative to each other (roll, glide, spin) is called', 'arthrokinematics', ['osteokinematics', 'kinetics', 'biomechanics of levers', 'posture'], 'Osteokinematics describes bone motion through planes.']
  ]);
  const MOVES = [
    ['shoulder flexion', 0], ['shoulder extension', 0], ['elbow flexion', 0], ['knee extension', 0], ['hip flexion', 0], ['ankle dorsiflexion', 0], ['ankle plantarflexion', 0], ['trunk flexion', 0], ['wrist extension', 0],
    ['shoulder abduction', 1], ['hip adduction', 1], ['hip abduction', 1], ['trunk lateral flexion', 1], ['wrist radial deviation', 1], ['wrist ulnar deviation', 1], ['neck lateral flexion', 1],
    ['shoulder medial rotation', 2], ['hip lateral rotation', 2], ['forearm pronation', 2], ['forearm supination', 2], ['trunk rotation', 2], ['neck rotation', 2], ['shoulder horizontal adduction', 2], ['hip medial rotation', 2]
  ];
  const PLANES = ['Sagittal plane', 'Frontal (coronal) plane', 'Transverse (horizontal) plane'];
  const AXES = ['Mediolateral (frontal) axis', 'Anteroposterior (sagittal) axis', 'Longitudinal (vertical) axis'];
  function qPlaneAxis() {
    const [mv, k] = pick(MOVES); const form = ri(0, 2);
    const ex = `${mv[0].toUpperCase() + mv.slice(1)} happens in the ${PLANES[k].toLowerCase()} about the ${AXES[k].toLowerCase()}. The axis is always perpendicular to the plane.`;
    if (form === 0) return mc('terms', `In which plane does ${mv} occur?`, PLANES[k], PLANES.filter(p => p !== PLANES[k]).concat(['An oblique plane only']), ex, 'Ask: does the segment move forward–back, side to side, or twist?');
    if (form === 1) return mc('terms', `About which axis does ${mv} occur?`, AXES[k], AXES.filter(a => a !== AXES[k]).concat(['No axis: it is a translation']), ex, 'Find the plane first; the axis pierces it at a right angle.');
    const others = [0, 1, 2].filter(j => j !== k).map(j => pick(MOVES.filter(m => m[1] === j))[0]);
    return mc('terms', `Which movement occurs in the ${PLANES[k].toLowerCase()}?`, mv[0].toUpperCase() + mv.slice(1), others.map(o => o[0].toUpperCase() + o.slice(1)).concat(['None of these; that plane has no movements']), ex, 'Picture each movement and ask which way the segment travels.');
  }
  const qJoints = bank('joints', [
    ['The pubic symphysis is a', 'cartilaginous joint', ['fibrous joint', 'synovial hinge joint', 'synovial plane joint', 'suture'], 'Symphyses join bones with fibrocartilage.'],
    ['The distal tibiofibular joint is a', 'syndesmosis (fibrous)', ['synovial pivot joint', 'symphysis', 'synchondrosis', 'saddle joint'], 'Bones joined by a ligament or membrane; injured in “high ankle sprains.”'],
    ['The proximal radioulnar joint is a synovial', 'pivot joint', ['hinge joint', 'saddle joint', 'condyloid joint', 'plane joint'], 'The radial head spins within the annular ligament.'],
    ['The radiocarpal (wrist) joint is a synovial', 'condyloid (ellipsoid) joint', ['hinge joint', 'pivot joint', 'saddle joint', 'ball-and-socket joint'], 'It moves in two planes: flexion–extension and radial–ulnar deviation.'],
    ['A joint in its close-packed position is', 'most congruent and stable, with taut ligaments', ['most loose, with the most joint play', 'at the middle of its range', 'dislocated', 'always flexed'], 'The loose-packed (resting) position has the most play.'],
    ['What lines the inside of a synovial joint capsule and makes synovial fluid?', 'The synovial membrane', ['Articular cartilage', 'The fibrous layer', 'The meniscus', 'The periosteum'], 'Hyaline articular cartilage covers the bone ends.'],
    ['Which is an example of a saddle joint?', 'Thumb carpometacarpal joint', ['Knee', 'Hip', 'Intercarpal joints', 'Atlantoaxial joint'], 'The sternoclavicular joint is also usually described as saddle-shaped.'],
    ['“Joint play” refers to', 'small accessory motions that cannot be done voluntarily', ['the full active range of motion', 'a joint being dislocated', 'muscle strength around a joint', 'the close-packed position'], 'Clinicians test it with passive glides.']
  ]);
  const qConvex = table('joints', [
    ['During shoulder abduction, which way does the humeral head glide on the glenoid?', 'Inferiorly', ['Superiorly', 'Anteriorly', 'Posteriorly'], 'The convex humeral head moves on the concave glenoid: it rolls superiorly and glides <b>inferiorly</b> (opposite).'],
    ['During shoulder lateral (external) rotation, which way does the humeral head glide on the glenoid?', 'Anteriorly', ['Posteriorly', 'Superiorly', 'Inferiorly'], 'Convex on concave: the head rolls posteriorly and glides <b>anteriorly</b>.'],
    ['During shoulder medial (internal) rotation, which way does the humeral head glide on the glenoid?', 'Posteriorly', ['Anteriorly', 'Superiorly', 'Inferiorly'], 'Convex on concave: the head rolls anteriorly and glides <b>posteriorly</b>.'],
    ['During seated (open-chain) knee extension, which way does the tibia glide on the femur?', 'Anteriorly', ['Posteriorly', 'Medially', 'Laterally'], 'The concave tibia moves on the convex femur, so it rolls and glides the <b>same</b> way: anteriorly.'],
    ['During open-chain knee flexion, which way does the tibia glide on the femur?', 'Posteriorly', ['Anteriorly', 'Medially', 'Laterally'], 'Concave on convex: roll and glide both go posteriorly.'],
    ['Rising from a squat (closed chain), which way do the femoral condyles glide on the tibia?', 'Posteriorly', ['Anteriorly', 'Medially', 'Laterally'], 'The convex femur moves on the concave tibia: it rolls anteriorly and glides <b>posteriorly</b>.'],
    ['During open-chain ankle dorsiflexion, which way does the talus glide in the mortise?', 'Posteriorly', ['Anteriorly', 'Medially', 'Laterally'], 'The convex talus moves on the concave mortise: it rolls anteriorly and glides <b>posteriorly</b>.'],
    ['During open-chain ankle plantarflexion, which way does the talus glide in the mortise?', 'Anteriorly', ['Posteriorly', 'Medially', 'Laterally'], 'Convex on concave: roll posteriorly, glide <b>anteriorly</b>.'],
    ['During hip abduction, which way does the femoral head glide in the acetabulum?', 'Inferiorly', ['Superiorly', 'Anteriorly', 'Posteriorly'], 'The convex femoral head moves on the concave acetabulum: roll superiorly, glide <b>inferiorly</b>.'],
    ['During MCP flexion, which way does the base of the proximal phalanx glide on the metacarpal head?', 'Palmarly (toward the palm)', ['Dorsally', 'Radially', 'Ulnarly'], 'The concave phalanx base moves on the convex metacarpal head: same direction as the motion.'],
    ['During wrist flexion, which way do the proximal carpals glide on the radius?', 'Dorsally', ['Palmarly (toward the palm)', 'Radially', 'Ulnarly'], 'The convex carpals move on the concave radius: roll palmarly, glide <b>dorsally</b>.'],
    ['During wrist extension, which way do the proximal carpals glide on the radius?', 'Palmarly (toward the palm)', ['Dorsally', 'Radially', 'Ulnarly'], 'Convex on concave: roll dorsally, glide <b>palmarly</b>.']
  ], 'Decide which surface moves and whether it is convex or concave. Convex moving: opposite. Concave moving: same.');
  const qTissue = bank('tissue', [
    ['Lengthening of a tendon under a constant load over time is', 'creep', ['stress relaxation', 'hysteresis', 'plastic failure', 'active insufficiency'], 'Stress relaxation is falling stress at a constant length.'],
    ['Wolff’s law states that bone', 'adapts its structure to the loads placed on it', ['never changes after puberty', 'is strongest in tension', 'is weakened by exercise', 'is viscoelastic only in children'], 'Loading builds bone; disuse and bed rest weaken it.'],
    ['A multipennate muscle such as the deltoid is built for', 'high force, because many fibers fit in (large PCSA)', ['speed and long range', 'endurance only', 'no force production', 'passive stretch only'], 'Parallel (fusiform) muscles favor range and speed.'],
    ['A muscle produces its greatest active force', 'near its resting length', ['when fully shortened', 'when fully stretched', 'at high concentric speed', 'only when isometric at any length'], 'That is where actin and myosin overlap best (length–tension).'],
    ['Which contraction can produce the most force?', 'Eccentric', ['Concentric', 'Isometric', 'All produce the same', 'Fast concentric'], 'Force–velocity: eccentric force can exceed maximal isometric force.'],
    ['Making a tight fist is hard when the wrist is fully flexed because of', 'active insufficiency of the finger flexors', ['passive insufficiency of the finger flexors', 'creep in the wrist ligaments', 'a stress fracture', 'the convex–concave rule'], 'The two-joint finger flexors are already shortened across the wrist.'],
    ['Tight hamstrings limit hip flexion more when the knee is straight. This is', 'passive insufficiency', ['active insufficiency', 'eccentric contraction', 'Wolff’s law', 'reciprocal inhibition'], 'A two-joint muscle cannot be stretched across both joints at once.'],
    ['The muscle that relaxes or lengthens opposite the prime mover is the', 'antagonist', ['agonist', 'synergist', 'stabilizer', 'neutralizer'], 'The biceps is the antagonist to the triceps during elbow extension.'],
    ['On a stress–strain curve, permanent deformation begins in the', 'plastic region', ['toe region', 'elastic region', 'origin', 'failure point only'], 'Loads beyond the elastic region cause lasting damage, such as a sprain.']
  ]);
  const CONTR = [
    ['standing up from a squat', 'Quadriceps', 'Hamstrings', 'concentric', 'The knees extend against gravity, so the knee extensors shorten.'],
    ['slowly lowering into a squat', 'Quadriceps', 'Hamstrings', 'eccentric', 'Gravity flexes the knees; the knee extensors lengthen to control it.'],
    ['lifting a dumbbell in a biceps curl', 'Elbow flexors', 'Elbow extensors', 'concentric', 'The elbow flexes against the load.'],
    ['lowering a dumbbell slowly in a biceps curl', 'Elbow flexors', 'Elbow extensors', 'eccentric', 'Gravity extends the elbow; the flexors control it by lengthening.'],
    ['lowering the body in a push-up', 'Elbow extensors (triceps)', 'Elbow flexors', 'eccentric', 'Gravity flexes the elbows; the triceps lengthen to control the descent.'],
    ['pushing up in a push-up', 'Elbow extensors (triceps)', 'Elbow flexors', 'concentric', 'The elbows extend against body weight.'],
    ['rising onto the toes', 'Ankle plantarflexors', 'Ankle dorsiflexors', 'concentric', 'The calf shortens to lift the body.'],
    ['slowly lowering the heels after a toe raise', 'Ankle plantarflexors', 'Ankle dorsiflexors', 'eccentric', 'Gravity dorsiflexes the ankle; the calf controls it.'],
    ['raising the arm out to the side', 'Shoulder abductors', 'Shoulder adductors', 'concentric', 'The arm abducts against gravity.'],
    ['slowly lowering the arm from shoulder height to the side', 'Shoulder abductors', 'Shoulder adductors', 'eccentric', 'Gravity adducts the arm; the abductors (deltoid, supraspinatus) control it.'],
    ['holding a cup still with the elbow bent at 90°', 'Elbow flexors', 'Elbow extensors', 'isometric', 'No joint motion while resisting the load.'],
    ['holding a front plank', 'Trunk flexors (abdominals)', 'Trunk extensors (erector spinae)', 'isometric', 'Gravity pulls the trunk into extension; the abdominals hold without moving.'],
    ['bending forward from standing to touch the toes', 'Trunk extensors (erector spinae)', 'Trunk flexors (abdominals)', 'eccentric', 'Gravity flexes the trunk; the back extensors control it (until they relax near full flexion).'],
    ['lowering the foot to the floor just after heel contact', 'Ankle dorsiflexors', 'Ankle plantarflexors', 'eccentric', 'Gravity plantarflexes the ankle; tibialis anterior controls it.'],
    ['pulling the body up in a chin-up', 'Elbow flexors', 'Elbow extensors', 'concentric', 'The elbows flex against body weight.'],
    ['lowering from a chin-up', 'Elbow flexors', 'Elbow extensors', 'eccentric', 'Gravity extends the elbows; the flexors control it.']
  ];
  function qContraction() {
    const [act, grp, anti, typ, why] = pick(CONTR); const types = ['concentric', 'eccentric', 'isometric'];
    const opt = (g, t) => `${g}, ${t}`;
    const ds = types.filter(t => t !== typ).map(t => opt(grp, t)).concat([opt(anti, typ), opt(anti, pick(types.filter(t => t !== typ)))]);
    return mc('tissue', `Which muscle group is working, and how, when ${act}?`, opt(grp, typ), ds, why, 'Ask whether gravity helps or resists the motion; the muscle opposing gravity does the work.');
  }
  function qStressStrain() {
    if (Math.random() < 0.5) { const F = pick([500, 800, 1200, 1500, 2000, 3000, 4500]), A = pick([20, 25, 40, 50, 60, 75]); return num('tissue', `A tendon with a cross-sectional area of ${A} mm² carries ${F.toLocaleString('en-US')} N. What is the stress, in MPa (N/mm²)?`, F / A, `Stress = F ÷ A = ${F} ÷ ${A} = ${fmt(F / A)} N/mm² (MPa).`, 'Stress is force per unit area.'); }
    const L0 = pick([20, 25, 30, 40, 50]), dL = pick([0.5, 1, 1.5, 2, 2.5, 3]); return num('tissue', `A ${L0} mm ligament is stretched by ${dL} mm. What is the strain, in percent?`, dL / L0 * 100, `Strain = ΔL ÷ L₀ = ${dL} ÷ ${L0} = ${fmt(dL / L0)}, or ${fmt(dL / L0 * 100)}%.`, 'Divide the change in length by the original length.');
  }
  const qLevers = bank('levers', [
    ['Torque depends on the force and the', 'perpendicular distance from the axis to the line of force', ['mass of the bone', 'length of the muscle', 'speed of movement', 'joint angle only'], 'τ = F × d⊥ (the moment arm).'],
    ['Most muscles of the limbs act as', 'third-class levers', ['first-class levers', 'second-class levers', 'pulleys only', 'fourth-class levers'], 'The effort lies between the joint and the load.'],
    ['A mechanical advantage below 1 means the lever favors', 'speed and range of motion', ['force', 'stability', 'neither force nor speed', 'isometric holding only'], 'Third-class levers trade force for speed.'],
    ['A segment is in rotational equilibrium when', 'the sum of torques about the axis is zero', ['the forces are all equal', 'the muscle is relaxed', 'the segment is vertical', 'the load is zero'], 'Clockwise torques equal counterclockwise torques.'],
    ['A muscle produces the most torque when its line of pull is', 'perpendicular to the bone', ['parallel to the bone', 'at 10° to the bone', 'along the axis', 'through the joint center'], 'Then the whole force is rotary and the moment arm is largest.'],
    ['The component of muscle force parallel to the bone', 'stabilizes (compresses) or dislocates the joint rather than rotating it', ['produces all the torque', 'is always zero', 'is the rotary component', 'lifts the load'], 'Only the perpendicular (rotary) component makes torque.'],
    ['The patella improves the quadriceps’ function by', 'increasing its moment arm at the knee', ['shortening the muscle', 'adding a second joint', 'reducing its force', 'making it a first-class lever'], 'A longer moment arm means more torque for the same force.'],
    ['Stability is greatest when the center of gravity is', 'low and over a wide base of support', ['high and over a narrow base', 'outside the base of support', 'moving quickly', 'directly over one foot'], 'Athletes widen their stance and lower their hips to resist being pushed.']
  ]);
  const qLeverClass = table('levers', [
    ['A person lifts a cup with the biceps flexing the elbow. Which lever class is this?', 'Third class', ['First class', 'Second class', 'Not a lever'], 'The effort (biceps insertion) lies between the axis (elbow) and the load (cup).'],
    ['The triceps pulls on the olecranon to extend the elbow. Which lever class is this?', 'First class', ['Second class', 'Third class', 'Not a lever'], 'The axis (elbow) lies between the effort (olecranon) and the load (forearm and hand).'],
    ['The neck extensors hold the head up, balancing it on the atlanto-occipital joint. Which lever class?', 'First class', ['Second class', 'Third class', 'Not a lever'], 'The axis lies between the extensors behind and the weight of the face in front.'],
    ['Rising onto the toes, as usually taught: axis at the ball of the foot, body weight through the ankle, calf pulling at the heel. Which lever class?', 'Second class', ['First class', 'Third class', 'Not a lever'], 'The resistance (body weight) lies between the axis and the effort.'],
    ['The hamstrings flex the knee. Which lever class?', 'Third class', ['First class', 'Second class', 'Not a lever'], 'The insertion is close to the knee, between the axis and the weight of the leg.'],
    ['The deltoid abducts the arm. Which lever class?', 'Third class', ['First class', 'Second class', 'Not a lever'], 'The deltoid inserts between the shoulder axis and the arm’s center of mass.'],
    ['A seesaw is which lever class?', 'First class', ['Second class', 'Third class', 'Not a lever'], 'The pivot is in the middle.'],
    ['A wheelbarrow is which lever class?', 'Second class', ['First class', 'Third class', 'Not a lever'], 'The load sits between the wheel (axis) and your hands (effort).'],
    ['A nutcracker is which lever class?', 'Second class', ['First class', 'Third class', 'Not a lever'], 'The nut (resistance) sits between the hinge and your hand.'],
    ['Tweezers are which lever class?', 'Third class', ['First class', 'Second class', 'Not a lever'], 'Your fingers (effort) press between the hinge and the tips (resistance).'],
    ['Scissors are which lever class?', 'First class', ['Second class', 'Third class', 'Not a lever'], 'The pivot sits between the handles (effort) and the blades (resistance).'],
    ['The quadriceps extend the knee during a seated leg extension. Which lever class?', 'Third class', ['First class', 'Second class', 'Not a lever'], 'The patellar tendon inserts near the knee, between the axis and the weight of the leg.']
  ], 'ARE 1-2-3: what is in the middle? Axis → first, Resistance → second, Effort → third.');
  function qTorque() {
    if (Math.random() < 0.6) { const F = pick([20, 30, 40, 50, 60, 80, 100, 150]), dd = pick([0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]); return num('levers', `A ${F} N force acts perpendicular to a limb segment, ${dd} m from the joint axis. What torque does it make, in N·m?`, F * dd, `τ = F × d⊥ = ${F} × ${dd} = ${fmt(F * dd)} N·m.`, 'Torque = force × perpendicular distance.'); }
    const F = pick([40, 50, 60, 80, 100]), dd = pick([0.2, 0.3, 0.4, 0.5]), th = pick([30, 90, 150]); const tau = F * dd * Math.sin(th * Math.PI / 180);
    return num('levers', `A ${F} N force pulls on a segment ${dd} m from the axis, at ${th}° to the segment. What torque does it make, in N·m?`, tau, `Only the perpendicular component turns the segment: τ = F × d × sin θ = ${F} × ${dd} × sin ${th}° = ${fmt(tau)} N·m.`, 'Use F × d × sin θ, where θ is the angle between the force and the segment.');
  }
  function qMuscleForce() {
    const W = pick([10, 20, 30, 40, 50, 60]), dW = pick([0.25, 0.3, 0.35, 0.4]), dm = pick([0.03, 0.04, 0.05]); const arm = Math.random() < 0.4; const Fa = 15, da = 0.15;
    const F = (W * dW + (arm ? Fa * da : 0)) / dm;
    return num('levers', `The forearm is horizontal and holds a ${W} N weight ${dW} m from the elbow.${arm ? ` The forearm and hand weigh ${Fa} N, acting ${da} m from the elbow.` : ' Ignore the forearm’s weight.'} The elbow flexors pull straight up ${dm} m from the elbow. What muscle force holds the arm still, in N?`, F, `Balance torques about the elbow: F × ${dm} = ${W} × ${dW}${arm ? ` + ${Fa} × ${da}` : ''} = ${fmt(W * dW + (arm ? Fa * da : 0))} N·m, so F = ${fmt(F)} N.`, 'Set the muscle’s torque equal to the sum of the load torques.', 0.01);
  }
  function qMA() {
    const de = pick([0.02, 0.03, 0.04, 0.05, 0.6, 0.8, 1.2]), dr = pick([0.1, 0.2, 0.3, 0.35, 0.4]); const ma = de / dr;
    if (Math.random() < 0.5) return num('levers', `A lever’s effort arm is ${de} m and its resistance arm is ${dr} m. What is its mechanical advantage?`, ma, `MA = effort arm ÷ resistance arm = ${de} ÷ ${dr} = ${fmt(ma)}. ${ma > 1 ? 'Above 1: a force advantage.' : 'Below 1: a speed and range-of-motion advantage.'}`, 'MA = effort arm ÷ resistance arm.', 0.02);
    const ans = ma > 1 ? 'Force: MA is greater than 1' : 'Speed and range of motion: MA is less than 1';
    return mc('levers', `A lever’s effort arm is ${de} m and its resistance arm is ${dr} m. What does it favor?`, ans, ['Force: MA is greater than 1', 'Speed and range of motion: MA is less than 1', 'Neither: MA equals 1', 'Stability: MA does not apply'].filter(x => x !== ans), `MA = ${de} ÷ ${dr} = ${fmt(ma)}.`, 'Compare the two arms: a longer effort arm favors force.');
  }
  const qSpine = bank('spine', [
    ['How many thoracic vertebrae are there?', '12', ['7', '5', '10', '4'], '7 cervical, 12 thoracic, 5 lumbar.'],
    ['Which vertebra has no body?', 'The atlas (C1)', ['The axis (C2)', 'C7', 'T1', 'L5'], 'The atlas is a ring that pivots around the dens of C2.'],
    ['Rotation of the head (“no”) happens mostly at the', 'atlantoaxial joint (C1–C2)', ['atlanto-occipital joint', 'C7–T1', 'lumbosacral joint', 'thoracic facets'], 'About half of cervical rotation happens there.'],
    ['Transverse foramina are found only in', 'cervical vertebrae', ['thoracic vertebrae', 'lumbar vertebrae', 'the sacrum', 'the coccyx'], 'They carry the vertebral arteries.'],
    ['Costal facets for rib articulation mark', 'thoracic vertebrae', ['cervical vertebrae', 'lumbar vertebrae', 'the sacrum', 'the atlas only'], 'Ribs attach to the thoracic bodies and transverse processes.'],
    ['Lumbar facet joints lie near the sagittal plane, so they favor', 'flexion and extension, limiting rotation', ['rotation above all', 'lateral flexion only', 'no motion', 'translation'], 'Thoracic facets allow more rotation.'],
    ['The anterior longitudinal ligament limits', 'extension', ['flexion', 'rotation', 'lateral flexion only', 'compression'], 'Flexion is limited by the posterior ligaments.'],
    ['The gel center of an intervertebral disc is the', 'nucleus pulposus', ['annulus fibrosus', 'ligamentum flavum', 'vertebral end plate', 'spinous process'], 'Flexion pushes it posteriorly, toward the nerve roots.'],
    ['The spinal curves present at birth are the', 'thoracic and sacral kyphoses', ['cervical and lumbar lordoses', 'cervical and thoracic curves', 'lumbar lordosis only', 'none; all curves develop later'], 'The lordoses develop with head control and walking.'],
    ['The elastic ligament connecting adjacent laminae is the', 'ligamentum flavum', ['anterior longitudinal ligament', 'nuchal ligament', 'supraspinous ligament', 'iliolumbar ligament'], 'Its elasticity helps return the spine from flexion.']
  ]);
  const qTrunk = bank('trunk', [
    ['The right external oblique rotates the trunk to the', 'left (opposite side)', ['right (same side)', 'neither side', 'right only when standing', 'left only in flexion'], 'The internal oblique rotates to the same side.'],
    ['The left sternocleidomastoid, acting alone, turns the face to the', 'right', ['left', 'ceiling only', 'floor only', 'neither side'], 'It laterally flexes to the same side and rotates to the opposite side.'],
    ['Which muscle compresses the abdomen without moving the trunk?', 'Transversus abdominis', ['Rectus abdominis', 'External oblique', 'Erector spinae', 'Quadratus lumborum'], 'It stiffens the lumbar spine as part of the deep core.'],
    ['“Hiking” the hip on one side is done mainly by the', 'quadratus lumborum', ['rectus abdominis', 'iliopsoas', 'gluteus maximus', 'multifidus'], 'It elevates the pelvis on the same side.'],
    ['The spinal cord usually ends near', 'L1–L2', ['C7', 'T6', 'S2', 'the coccyx'], 'Below that level is the cauda equina.'],
    ['How many pairs of spinal nerves are there?', '31', ['33', '24', '12', '8'], '8 cervical, 12 thoracic, 5 lumbar, 5 sacral, 1 coccygeal.'],
    ['An injury at C3–C5 is especially dangerous because', 'it can paralyze the diaphragm (phrenic nerve)', ['it stops the heart directly', 'it blocks vision', 'it only affects the legs', 'it paralyzes the face'], '“C3, 4, 5 keeps the diaphragm alive.”'],
    ['A lateral curvature of the spine with vertebral rotation is', 'scoliosis', ['kyphosis', 'lordosis', 'spondylolisthesis', 'flat back'], 'Kyphosis and lordosis are curves in the sagittal plane.'],
    ['Paralysis of all four limbs after a cervical cord injury is', 'tetraplegia (quadriplegia)', ['paraplegia', 'hemiplegia', 'monoplegia', 'diplegia'], 'Paraplegia follows thoracic or lower injuries.']
  ]);
  const KEY = [['C5', 'elbow flexors', 'flex the elbows'], ['C6', 'wrist extensors', 'extend the wrists'], ['C7', 'elbow extensors', 'extend the elbows'], ['C8', 'finger flexors', 'flex the fingertips'], ['T1', 'little-finger abductors', 'spread the little fingers'], ['L2', 'hip flexors', 'flex the hips'], ['L3', 'knee extensors', 'extend the knees'], ['L4', 'ankle dorsiflexors', 'dorsiflex the ankles'], ['L5', 'long toe extensors', 'extend the big toes'], ['S1', 'ankle plantarflexors', 'plantarflex the ankles']];
  function qSciLevel() {
    if (Math.random() < 0.4) { const [lv, grp] = pick(KEY); return mc('trunk', `Which key muscle group is tested for the ${lv} myotome?`, grp[0].toUpperCase() + grp.slice(1), shuffle(KEY.filter(k => k[0] !== lv)).slice(0, 4).map(k => k[1][0].toUpperCase() + k[1].slice(1)), `Key muscles: ${KEY.map(k => `${k[0]} ${k[1]}`).join(', ')}.`, 'Upper limb: C5 elbow flexors up to T1 finger abductors; lower limb: L2 hip flexors to S1 plantarflexors.'); }
    const upper = Math.random() < 0.6; const list = upper ? KEY.slice(0, 5) : KEY.slice(5); const i = ri(0, list.length - 2); const j = Math.min(list.length - 1, Math.max(0, i + pick([-1, 0, 1, 1, 2])));
    const yes = j <= i; const ans = yes ? 'Yes: that segment is at or above the injury' : 'No: that segment is below the injury';
    const lvl = upper ? list[i][0] : list[i][0];
    return mc('trunk', `After a complete spinal cord injury, ${lvl} is the lowest level with normal function. Can the person ${list[j][2]} (key muscles for ${list[j][0]})?`, ans, ['Yes: that segment is at or above the injury', 'No: that segment is below the injury', 'Only with the other side’s help: complete injuries affect one side'].filter(x => x !== ans), `${list[j][0]} (${list[j][1]}) is ${yes ? 'at or above' : 'below'} the ${lvl} level. Segments at or above the neurological level work; after a complete injury, those below do not.`, 'Put both levels on the C5–T1 or L2–S1 ladder and compare.');
  }

  /* ---------- Unit 2: the upper extremity ---------- */
  const qShoulder = bank('shoulder', [
    ['Which muscle is <b>not</b> part of the rotator cuff?', 'Teres major', ['Supraspinatus', 'Infraspinatus', 'Teres minor', 'Subscapularis'], 'SITS: supraspinatus, infraspinatus, teres minor, subscapularis.'],
    ['The rotator cuff muscle that medially rotates the humerus is', 'subscapularis', ['infraspinatus', 'teres minor', 'supraspinatus', 'deltoid (posterior)'], 'Infraspinatus and teres minor rotate laterally.'],
    ['The only bony joint connecting the upper limb to the axial skeleton is the', 'sternoclavicular joint', ['acromioclavicular joint', 'glenohumeral joint', 'scapulothoracic joint', 'costovertebral joint'], 'The scapula is otherwise held on by muscles.'],
    ['Scapular winging with a long thoracic nerve injury comes from weakness of the', 'serratus anterior', ['rhomboids', 'upper trapezius', 'levator scapulae', 'latissimus dorsi'], 'Serratus holds the scapula against the ribs.'],
    ['The upward-rotation force couple of the scapula is', 'upper and lower trapezius with serratus anterior', ['rhomboids and levator scapulae', 'pectoralis minor and rhomboids', 'latissimus and teres major', 'deltoid and supraspinatus'], 'Rhomboids, levator and pectoralis minor are downward rotators.'],
    ['The most common direction of glenohumeral dislocation is', 'anterior (anterior-inferior)', ['posterior', 'superior', 'medial', 'lateral'], 'The anterior-inferior capsule is weakest in abduction with lateral rotation.'],
    ['The labrum of the shoulder', 'deepens the shallow glenoid fossa', ['attaches the clavicle', 'is a muscle', 'forms the rotator cuff', 'covers the acromion'], 'SLAP tears involve the superior labrum.'],
    ['Latissimus dorsi performs', 'shoulder extension, adduction and medial rotation', ['flexion and lateral rotation', 'abduction only', 'scapular elevation', 'elbow flexion'], 'It is innervated by the thoracodorsal nerve.'],
    ['The middle deltoid mainly', 'abducts the shoulder', ['flexes the elbow', 'medially rotates the shoulder', 'extends the shoulder', 'elevates the scapula'], 'Anterior fibers flex; posterior fibers extend.'],
    ['Subacromial impingement most often pinches the', 'supraspinatus tendon and subacromial bursa', ['biceps long head only', 'deltoid muscle belly', 'glenoid labrum', 'axillary nerve'], 'They lie between the humeral head and the acromion.']
  ]);
  function qRhythm() {
    if (Math.random() < 0.5) { const T = pick([60, 90, 120, 150, 180]); const askSt = Math.random() < 0.5; return num('shoulder', `With a 2:1 scapulohumeral rhythm, how many degrees of ${askSt ? 'scapular upward rotation' : 'glenohumeral motion'} go with ${T}° of total arm elevation?`, askSt ? T / 3 : 2 * T / 3, `2:1 means the glenohumeral joint provides 2/3 and the scapula 1/3: glenohumeral ${fmt(2 * T / 3)}°, scapular ${fmt(T / 3)}°.`, 'Split the total into three parts: two for the glenohumeral joint, one for the scapula.'); }
    const G = pick([40, 60, 80, 100, 120]); return num('shoulder', `During elevation, the glenohumeral joint has moved ${G}°. With a 2:1 rhythm, what is the total arm elevation, in degrees?`, 1.5 * G, `The scapula adds half as much: ${G / 2}°, so the total is ${G} + ${G / 2} = ${1.5 * G}°.`, 'Scapular motion is half the glenohumeral motion.');
  }
  const qElbow = bank('elbow', [
    ['Which elbow flexor inserts on the ulna and works equally in any forearm position?', 'Brachialis', ['Biceps brachii', 'Brachioradialis', 'Pronator teres', 'Anconeus'], 'Forearm rotation does not change its line of pull.'],
    ['The strongest supinator, especially with the elbow at 90°, is', 'biceps brachii', ['supinator', 'brachioradialis', 'pronator teres', 'triceps'], 'Its tendon wraps around the radius in pronation and unwinds it.'],
    ['Pronation and supination happen at the', 'proximal and distal radioulnar joints', ['humeroulnar joint', 'radiocarpal joint', 'glenohumeral joint', 'midcarpal joint'], 'The radius rotates around the ulna.'],
    ['The ligament that holds the radial head against the ulna is the', 'annular ligament', ['ulnar collateral ligament', 'radial collateral ligament', 'interosseous membrane', 'transverse carpal ligament'], 'A pull on a toddler’s arm can slip the radial head out of it.'],
    ['Repeated valgus stress in throwing most often injures the', 'ulnar (medial) collateral ligament', ['radial collateral ligament', 'annular ligament', 'triceps tendon', 'interosseous membrane'], 'UCL reconstruction is known as Tommy John surgery.'],
    ['The normal carrying angle of the elbow is about', '10–15° of valgus', ['0°', '30–40° of valgus', '10° of varus', '45°'], 'It is often slightly larger in females.'],
    ['“Tennis elbow” involves the', 'common extensor origin on the lateral epicondyle', ['common flexor origin on the medial epicondyle', 'biceps tendon', 'olecranon bursa', 'ulnar nerve'], '“Golfer’s elbow” is the medial, flexor–pronator side.'],
    ['Brachioradialis is strongest as an elbow flexor with the forearm', 'in midposition (thumb up)', ['fully supinated', 'fully pronated', 'extended', 'it does not flex the elbow'], 'It is innervated by the radial nerve.'],
    ['The biceps and brachialis are both innervated by the', 'musculocutaneous nerve', ['radial nerve', 'median nerve', 'ulnar nerve', 'axillary nerve'], 'The radial nerve supplies the elbow extensors.'],
    ['The main (primary) pronator of the forearm is', 'pronator quadratus', ['supinator', 'biceps brachii', 'brachialis', 'anconeus'], 'Pronator teres joins it for fast or resisted pronation.']
  ]);
  const qWristHand = bank('wrist-hand', [
    ['The only muscle that flexes the DIP joints of the fingers is', 'flexor digitorum profundus', ['flexor digitorum superficialis', 'lumbricals', 'palmar interossei', 'flexor carpi ulnaris'], 'FDS flexes the PIP joints.'],
    ['The carpal tunnel contains the median nerve and', 'nine flexor tendons (4 FDS, 4 FDP, FPL)', ['the ulnar nerve and artery', 'the wrist extensor tendons', 'the radial artery', 'the thenar muscles'], 'Compression of the median nerve causes carpal tunnel syndrome.'],
    ['“PAD and DAB” describes the', 'interossei: palmar adduct, dorsal abduct', ['lumbricals', 'thenar muscles', 'wrist flexors', 'extensor tendons'], 'They are supplied by the ulnar nerve.'],
    ['Wrist drop results from injury to the', 'radial nerve', ['median nerve', 'ulnar nerve', 'musculocutaneous nerve', 'axillary nerve'], 'The radial nerve supplies the wrist and finger extensors.'],
    ['Claw hand results from injury to the', 'ulnar nerve', ['radial nerve', 'median nerve', 'axillary nerve', 'musculocutaneous nerve'], 'The intrinsic muscles it supplies can no longer balance the long tendons.'],
    ['The thumb carpometacarpal joint is a', 'saddle joint', ['hinge joint', 'pivot joint', 'ball-and-socket joint', 'plane joint'], 'Its shape allows opposition.'],
    ['Ulnar deviation of the wrist is produced by', 'flexor carpi ulnaris and extensor carpi ulnaris together', ['flexor carpi radialis and extensor carpi radialis longus', 'palmaris longus alone', 'the lumbricals', 'pronator teres'], 'A flexor and an extensor on the same side cancel flexion–extension.'],
    ['The wrist flexors originate mainly on the', 'medial epicondyle of the humerus', ['lateral epicondyle', 'olecranon', 'radial tuberosity', 'coracoid process'], 'The extensors start on the lateral epicondyle.'],
    ['The lumbricals', 'flex the MCP joints and extend the IP joints', ['flex all finger joints', 'abduct the fingers', 'extend the wrist', 'oppose the thumb'], 'That is the “tabletop” position.'],
    ['Which is a precision grip?', 'Tip-to-tip pinch', ['Cylindrical grip', 'Spherical grip', 'Hook grip', 'Fist'], 'Power grips use the whole hand.']
  ]);
  const PROX = ['scaphoid', 'lunate', 'triquetrum', 'pisiform'], DIST = ['trapezium', 'trapezoid', 'capitate', 'hamate'];
  function qCarpal() {
    const ALL = PROX.concat(DIST); const cap = s => s[0].toUpperCase() + s.slice(1);
    const form = ri(0, 2);
    if (form === 0) { const row = pick([0, 1]); const k = ri(0, 3); const R = row ? DIST : PROX; const ans = cap(R[k]); const ord = ['first', 'second', 'third', 'fourth'][k]; return mc('wrist-hand', `Counting from the thumb side (lateral), which is the ${ord} bone of the ${row ? 'distal' : 'proximal'} carpal row?`, ans, shuffle(ALL.map(cap).filter(x => x !== ans)), `Proximal row (lateral → medial): scaphoid, lunate, triquetrum, pisiform. Distal row: trapezium, trapezoid, capitate, hamate.`, '“Some Lovers Try Positions That They Can’t Handle.”'); }
    const FACT = [['articulates with the first (thumb) metacarpal', 'trapezium'], ['has a hook you can palpate at the base of the hypothenar eminence', 'hamate'], ['is the largest carpal', 'capitate'], ['sits in the tendon of flexor carpi ulnaris (a sesamoid)', 'pisiform'], ['is most often fractured', 'scaphoid'], ['is most often dislocated', 'lunate'], ['lies in the floor of the anatomical snuffbox', 'scaphoid']];
    const [txt, b] = pick(FACT); const ans = cap(b);
    return mc('wrist-hand', `Which carpal bone ${txt}?`, ans, shuffle(ALL.map(cap).filter(x => x !== ans)), `The ${b} ${txt}.`, 'Picture the two rows on your own wrist.');
  }
  function romGen(topic, rows) {
    const POOL = [10, 15, 20, 25, 30, 35, 45, 50, 60, 70, 80, 90, 100, 120, 135, 150, 180];
    return function () {
      const [mv, v] = pick(rows); const ds = POOL.filter(p => p !== v).sort((a, b) => Math.abs(a - v) - Math.abs(b - v)).slice(0, 4);
      return mc(topic, `What is the normal (AAOS) range of motion for ${mv}?`, `${v}°`, shuffle(ds).map(x => `${x}°`), `The AAOS reference value for ${mv} is about ${v}°. Sources vary by a few degrees, so check the values your lab uses.`, 'Use the ROM table on the formulas sheet.');
    };
  }
  const qRomShoulder = romGen('shoulder', [['shoulder flexion', 180], ['shoulder extension', 60], ['shoulder abduction', 180], ['shoulder medial rotation', 70], ['shoulder lateral rotation', 90]]);
  const qRomElbow = romGen('elbow', [['elbow flexion', 150], ['forearm pronation', 80], ['forearm supination', 80]]);
  const qRomWrist = romGen('wrist-hand', [['wrist flexion', 80], ['wrist extension', 70], ['wrist radial deviation', 20], ['wrist ulnar deviation', 30]]);
  const qRomHip = romGen('hip', [['hip flexion', 120], ['hip extension', 30], ['hip abduction', 45], ['hip adduction', 30], ['hip medial rotation', 45], ['hip lateral rotation', 45]]);
  const qRomKnee = romGen('knee', [['knee flexion', 135]]);
  const qRomAnkle = romGen('ankle', [['ankle dorsiflexion', 20], ['ankle plantarflexion', 50], ['subtalar inversion', 35], ['subtalar eversion', 15]]);
  const qNerveUE = table('elbow', [
    ['Which nerve supplies the biceps brachii and brachialis?', 'Musculocutaneous', ['Radial', 'Median', 'Ulnar', 'Axillary'], 'The musculocutaneous nerve supplies the anterior arm (elbow flexors).'],
    ['Which nerve supplies the triceps brachii?', 'Radial', ['Musculocutaneous', 'Median', 'Ulnar', 'Axillary'], 'The radial nerve supplies the extensors of the elbow, wrist and fingers.'],
    ['Which nerve supplies the deltoid and teres minor?', 'Axillary', ['Radial', 'Suprascapular', 'Musculocutaneous', 'Long thoracic'], 'It wraps around the surgical neck of the humerus.'],
    ['Which nerve supplies pronator teres and most of the forearm flexors?', 'Median', ['Ulnar', 'Radial', 'Musculocutaneous', 'Axillary'], 'The ulnar nerve supplies only FCU and the medial half of FDP in the forearm.'],
    ['Which nerve supplies flexor carpi ulnaris and most intrinsic hand muscles?', 'Ulnar', ['Median', 'Radial', 'Musculocutaneous', 'Axillary'], 'It is the “funny bone” nerve behind the medial epicondyle.'],
    ['Which nerve supplies the supinator and brachioradialis?', 'Radial', ['Median', 'Ulnar', 'Musculocutaneous', 'Axillary'], 'The radial nerve serves the posterior compartments and brachioradialis.'],
    ['Which nerve supplies supraspinatus and infraspinatus?', 'Suprascapular', ['Axillary', 'Radial', 'Long thoracic', 'Thoracodorsal'], 'It passes through the suprascapular notch.'],
    ['Which nerve supplies latissimus dorsi?', 'Thoracodorsal', ['Long thoracic', 'Axillary', 'Suprascapular', 'Radial'], 'The long thoracic nerve supplies serratus anterior.']
  ], 'Think of the compartments: anterior arm (musculocutaneous), posterior (radial), anterior forearm (median, plus ulnar medially).');

  /* ---------- Unit 3: pelvis, hip, knee and ankle ---------- */
  const qHip = bank('hip', [
    ['The strongest ligament of the hip, which limits extension, is the', 'iliofemoral (Y) ligament', ['pubofemoral ligament', 'ischiofemoral ligament', 'ligamentum teres', 'sacrotuberous ligament'], 'It lets people “hang” on it in standing.'],
    ['The primary hip flexor is', 'iliopsoas', ['gluteus maximus', 'gluteus medius', 'adductor magnus', 'biceps femoris'], 'Rectus femoris, sartorius and TFL help.'],
    ['Rising from a deep squat or climbing stairs relies most on the', 'gluteus maximus', ['gluteus minimus', 'iliopsoas', 'sartorius', 'piriformis'], 'It is a powerful hip extensor and lateral rotator.'],
    ['The gluteus medius is innervated by the', 'superior gluteal nerve', ['inferior gluteal nerve', 'femoral nerve', 'obturator nerve', 'sciatic nerve'], 'The inferior gluteal nerve supplies gluteus maximus.'],
    ['The hip adductors are mostly innervated by the', 'obturator nerve', ['femoral nerve', 'superior gluteal nerve', 'tibial nerve', 'common fibular nerve'], 'Part of adductor magnus also gets sciatic (tibial) fibers.'],
    ['Anterior pelvic tilt tends to', 'increase lumbar lordosis', ['flatten the lumbar spine', 'cause scoliosis', 'extend the hips', 'raise the pubic symphysis'], 'Posterior tilt flattens the lumbar curve.'],
    ['Nutation of the sacrum means', 'the sacral base tips forward (anteriorly)', ['the sacrum rotates backward', 'the ilia spread apart only', 'the coccyx moves forward', 'the pubic symphysis separates'], 'Counternutation is the opposite.'],
    ['An angle of inclination smaller than normal is called', 'coxa vara', ['coxa valga', 'anteversion', 'retroversion', 'genu valgum'], 'Coxa valga is a larger angle.'],
    ['The hip is close-packed in', 'extension with medial rotation and abduction', ['flexion with lateral rotation', '30° flexion', 'full adduction', 'neutral'], 'The capsule and ligaments wind tight in extension.'],
    ['The deep lateral rotator often blamed for sciatic nerve irritation is', 'piriformis', ['obturator internus', 'quadratus femoris', 'gemellus superior', 'gluteus minimus'], 'The sciatic nerve passes below (sometimes through) it.']
  ]);
  function qTrendelenburg() {
    const S = pick(['left', 'right']); const O = S === 'left' ? 'right' : 'left'; const form = ri(0, 2);
    if (form === 0) { const ans = `The ${S} gluteus medius`; return mc('hip', `A person stands on the ${S} leg and the ${O} side of the pelvis drops. Which muscle is weak?`, ans, [`The ${O} gluteus medius`, `The ${S} gluteus maximus`, `The ${O} hip adductors`, `The ${S} iliopsoas`], `The stance-side (${S}) gluteus medius should hold the pelvis level. When it is weak, the unsupported ${O} side drops: a positive Trendelenburg sign on the ${S}.`, 'The weak muscle is on the leg you are standing on.'); }
    if (form === 1) { const ans = `The ${O} side`; return mc('hip', `The ${S} gluteus medius is weak. When the person stands on the ${S} leg, which side of the pelvis drops?`, ans, [`The ${S} side`, 'Neither; the pelvis rises on both sides', 'Both sides drop equally'], `The weak ${S} gluteus medius cannot hold the pelvis, so the ${O} (swing) side drops.`, 'The drop happens on the side that is not supported.'); }
    const ans = `The ${O} hand`; return mc('hip', `A person has a painful ${S} hip. In which hand should they hold a cane?`, ans, [`The ${S} hand`, 'Either hand works equally', 'Both hands, with two canes only'], `A cane in the ${O} hand creates a long moment arm that helps hold the pelvis level, so the ${S} hip abductors, and the joint, work less.`, 'The cane goes opposite the painful hip.');
  }
  function qHipAngles() {
    const [a, cls] = pick([[105, 'vara'], [110, 'vara'], [115, 'vara'], [123, 'normal'], [125, 'normal'], [128, 'normal'], [140, 'valga'], [145, 'valga'], [150, 'valga']]);
    const O = { vara: 'Coxa vara (smaller than normal)', normal: 'Within the normal range (about 125°)', valga: 'Coxa valga (larger than normal)' };
    return mc('hip', `An adult’s femoral neck–shaft (inclination) angle measures ${a}°. How is it classified?`, O[cls], [O.vara, O.normal, O.valga, 'Excess anteversion'].filter(x => x !== O[cls]), `The normal adult angle is about 125°. Clearly smaller is coxa vara; clearly larger is coxa valga. ${a}° is ${cls === 'normal' ? 'normal' : `coxa ${cls}`}.`, 'Compare with 125°: vara is less, valga is more.');
  }
  const qKnee = bank('knee', [
    ['Which knee structure is attached to the MCL and is more often torn?', 'The medial meniscus', ['The lateral meniscus', 'The ACL', 'The patellar tendon', 'The popliteus'], 'Its attachment makes it less mobile.'],
    ['The muscle that “unlocks” the fully extended knee is the', 'popliteus', ['vastus medialis', 'rectus femoris', 'sartorius', 'gastrocnemius'], 'It medially rotates the tibia (or laterally rotates the femur).'],
    ['In the screw-home mechanism, as the knee reaches full extension in open chain, the tibia rotates', 'laterally', ['medially', 'not at all', 'into valgus', 'into varus'], 'In closed chain the femur rotates medially on the tibia instead.'],
    ['The pes anserinus is made of', 'sartorius, gracilis and semitendinosus', ['the three vasti', 'biceps femoris and popliteus', 'gastrocnemius heads and plantaris', 'the ACL and PCL'], '“Say Grace before Tea.”'],
    ['Which quadriceps muscle also flexes the hip?', 'Rectus femoris', ['Vastus lateralis', 'Vastus medialis', 'Vastus intermedius', 'Sartorius'], 'It is the only two-joint quadriceps muscle.'],
    ['The patella increases knee-extension torque by', 'lengthening the quadriceps’ moment arm', ['adding muscle fibers', 'shortening the tendon', 'reducing friction only', 'changing the lever class to second'], 'It holds the tendon farther from the axis.'],
    ['A larger-than-normal Q-angle tends to', 'pull the patella laterally', ['pull the patella medially', 'lock the knee', 'strengthen the ACL', 'shorten the hamstrings'], 'The normal Q-angle is about 10–15°.'],
    ['The “unhappy triad” involves the', 'ACL, MCL and medial meniscus', ['PCL, LCL and lateral meniscus', 'ACL, PCL and patella', 'MCL, LCL and popliteus', 'quadriceps, hamstrings and ACL'], 'It follows a blow to the outside of the knee.'],
    ['The hamstrings are innervated by the', 'sciatic nerve (tibial division, plus the common fibular division for the short head of biceps femoris)', ['femoral nerve', 'obturator nerve', 'superior gluteal nerve', 'deep fibular nerve'], 'The femoral nerve supplies the quadriceps.']
  ]);
  const qKneeTest = table('knee', [
    ['In the Lachman test, the tibia slides forward on the femur with the knee flexed about 20–30°. What is injured?', 'ACL', ['PCL', 'MCL', 'LCL', 'A meniscus'], 'The ACL resists anterior translation of the tibia on the femur.'],
    ['An anterior drawer test at 90° of flexion shows excess forward tibial movement. What is injured?', 'ACL', ['PCL', 'MCL', 'LCL', 'A meniscus'], 'Anterior translation means the ACL.'],
    ['With both knees bent to 90°, one tibia sags backward (posterior sag sign). What is injured?', 'PCL', ['ACL', 'MCL', 'LCL', 'A meniscus'], 'The PCL resists posterior translation of the tibia.'],
    ['A valgus stress test opens a gap on the medial side of the knee. What is injured?', 'MCL', ['LCL', 'ACL', 'PCL', 'A meniscus'], 'The MCL resists valgus.'],
    ['A varus stress test opens a gap on the lateral side of the knee. What is injured?', 'LCL', ['MCL', 'ACL', 'PCL', 'A meniscus'], 'The LCL resists varus.'],
    ['A car crash drives the dashboard into a passenger’s flexed knee, pushing the tibia backward. What is most likely injured?', 'PCL', ['ACL', 'MCL', 'LCL', 'A meniscus'], 'A posterior force on the tibia stresses the PCL.'],
    ['A tackle strikes the outside of a planted knee. Which ligament is stressed first?', 'MCL', ['LCL', 'PCL', 'ACL only', 'A meniscus only'], 'A blow from the outside forces the knee into valgus, stretching the medial side.'],
    ['An athlete lands from a jump with the knee near extension and collapsing inward, and feels a pop, with no contact. What is most likely torn?', 'ACL', ['PCL', 'LCL', 'Patellar tendon', 'A meniscus only'], 'Noncontact landing and cutting injuries classically tear the ACL.'],
    ['The McMurray test causes a painful click as the flexed knee is rotated and extended. What is suspected?', 'A meniscus', ['ACL', 'PCL', 'MCL', 'LCL'], 'Rotation under load traps a torn meniscus.']
  ], 'Name the ligament by the force or translation it stops.');
  const qAnkle = bank('ankle', [
    ['The most commonly sprained ankle ligament is the', 'anterior talofibular ligament', ['deltoid ligament', 'calcaneofibular ligament', 'posterior talofibular ligament', 'spring ligament'], 'It is stretched first in plantarflexion with inversion.'],
    ['Inversion and eversion happen mainly at the', 'subtalar joint', ['talocrural joint', 'knee', 'metatarsophalangeal joints', 'distal tibiofibular joint'], 'The talocrural joint is a hinge for dorsiflexion and plantarflexion.'],
    ['The ankle (talocrural joint) is most stable in', 'dorsiflexion', ['plantarflexion', 'inversion', 'eversion', 'neutral with the foot relaxed'], 'The wider front of the talus wedges into the mortise.'],
    ['Open-chain pronation of the foot combines', 'dorsiflexion, eversion and abduction', ['plantarflexion, inversion and adduction', 'dorsiflexion, inversion and adduction', 'plantarflexion, eversion and abduction', 'eversion only'], 'Supination is the opposite set.'],
    ['Which muscle crosses both the knee and the ankle?', 'Gastrocnemius', ['Soleus', 'Tibialis anterior', 'Fibularis longus', 'Tibialis posterior'], 'That is why stretching it needs a straight knee.'],
    ['“Tom, Dick and Harry” behind the medial malleolus are', 'tibialis posterior, flexor digitorum longus and flexor hallucis longus', ['the three fibularis muscles', 'the gastrocnemius heads and soleus', 'tibialis anterior, EHL and EDL', 'the three cuneiforms'], 'The tibial nerve and posterior tibial artery run between them.'],
    ['A “high ankle sprain” injures the', 'distal tibiofibular syndesmosis', ['anterior talofibular ligament', 'deltoid ligament', 'Achilles tendon', 'plantar fascia'], 'It often takes longer to heal than a lateral sprain.'],
    ['Foot drop after a blow to the side of the knee suggests injury to the', 'common fibular nerve at the fibular head', ['tibial nerve', 'femoral nerve', 'sciatic nerve at the hip', 'obturator nerve'], 'It is exposed where it wraps around the fibular neck.'],
    ['The medial (deltoid) ligament of the ankle resists', 'eversion', ['inversion', 'dorsiflexion', 'knee flexion', 'toe extension'], 'It is so strong that eversion injuries often fracture bone instead.']
  ]);
  const LEG = [
    ['tibialis anterior', 'Anterior', 'dorsiflexion and inversion', 'Deep fibular'], ['extensor hallucis longus', 'Anterior', 'big-toe extension and dorsiflexion', 'Deep fibular'], ['extensor digitorum longus', 'Anterior', 'toe extension and dorsiflexion', 'Deep fibular'],
    ['fibularis longus', 'Lateral', 'eversion and plantarflexion', 'Superficial fibular'], ['fibularis brevis', 'Lateral', 'eversion and plantarflexion', 'Superficial fibular'],
    ['gastrocnemius', 'Superficial posterior', 'plantarflexion and knee flexion', 'Tibial'], ['soleus', 'Superficial posterior', 'plantarflexion', 'Tibial'],
    ['tibialis posterior', 'Deep posterior', 'inversion and plantarflexion', 'Tibial'], ['flexor digitorum longus', 'Deep posterior', 'toe flexion', 'Tibial'], ['flexor hallucis longus', 'Deep posterior', 'big-toe flexion', 'Tibial']
  ];
  function qCompartment() {
    const [m, comp, act, nv] = pick(LEG);
    if (Math.random() < 0.5) return mc('ankle', `In which compartment of the leg is ${m}?`, `${comp} compartment`, ['Anterior', 'Lateral', 'Superficial posterior', 'Deep posterior'].filter(c => c !== comp).map(c => `${c} compartment`), `${m[0].toUpperCase() + m.slice(1)} is in the ${comp.toLowerCase()} compartment (${act}; ${nv.toLowerCase()} nerve).`, 'Anterior dorsiflexes, lateral everts, posterior plantarflexes.');
    return mc('ankle', `Which nerve supplies ${m}?`, `${nv} nerve`, ['Deep fibular', 'Superficial fibular', 'Tibial', 'Femoral', 'Obturator'].filter(c => c !== nv).map(c => `${c} nerve`), `${m[0].toUpperCase() + m.slice(1)} is in the ${comp.toLowerCase()} compartment, supplied by the ${nv.toLowerCase()} nerve.`, 'Anterior: deep fibular. Lateral: superficial fibular. Posterior: tibial.');
  }

  /* ---------- Unit 4: the foot and gait ---------- */
  const qFoot = bank('foot', [
    ['How many tarsal bones are there?', '7', ['5', '8', '12', '14'], 'Talus, calcaneus, navicular, cuboid and three cuneiforms.'],
    ['The windlass mechanism raises the arch when', 'the toes extend and tighten the plantar fascia', ['the ankle plantarflexes with the toes flexed', 'the calf relaxes', 'the foot pronates', 'the heel strikes the ground'], 'It stiffens the foot for push-off.'],
    ['The transverse tarsal (midtarsal) joint is made of the', 'talonavicular and calcaneocuboid joints', ['talocrural and subtalar joints', 'tarsometatarsal joints', 'metatarsophalangeal joints', 'intercuneiform joints'], 'It unlocks in pronation and locks in supination.'],
    ['The spring ligament is the', 'plantar calcaneonavicular ligament, supporting the head of the talus', ['anterior talofibular ligament', 'deltoid ligament', 'long plantar ligament', 'plantar fascia'], 'It supports the medial longitudinal arch.'],
    ['Heel pain worst with the first steps in the morning suggests', 'plantar fasciitis', ['Achilles rupture', 'Morton’s neuroma', 'a high ankle sprain', 'hallux valgus'], 'The fascia tightens overnight and is stretched with the first steps.'],
    ['At push-off, the foot should be', 'supinated and rigid, acting as a lever', ['pronated and flexible', 'fully dorsiflexed', 'everted and loose', 'off the ground'], 'At contact it is pronated and flexible to absorb shock.'],
    ['Morton’s neuroma usually occurs between the', 'third and fourth metatarsal heads', ['first and second metatarsals', 'talus and navicular', 'calcaneus and cuboid', 'fourth and fifth toes'], 'It is a thickened digital nerve.'],
    ['A high, rigid arch is called', 'pes cavus', ['pes planus', 'hallux valgus', 'hammer toe', 'metatarsus adductus'], 'Pes planus is a flat foot.'],
    ['The highest arch of the foot is the', 'medial longitudinal arch', ['lateral longitudinal arch', 'transverse arch', 'plantar arch of the toes', 'calcaneal arch'], 'Tibialis posterior and the plantar fascia help support it.']
  ]);
  const qGait = bank('gait', [
    ['At normal walking speed, stance takes about what share of the gait cycle?', '60%', ['40%', '50%', '75%', '90%'], 'Swing is about 40%.'],
    ['A stride is', 'from one foot’s contact to the same foot’s next contact (one full cycle)', ['from one foot’s contact to the other foot’s contact', 'the time in single support', 'the swing phase only', 'the distance between the feet sideways'], 'One stride contains two steps.'],
    ['Which is the first phase of stance?', 'Initial contact', ['Loading response', 'Midstance', 'Preswing', 'Terminal swing'], 'Then loading response, midstance, terminal stance and preswing.'],
    ['Running differs from walking because it has', 'a flight phase and no double support', ['two double-support phases', 'a longer stance phase', 'no swing phase', 'no hip extension'], 'Stance falls below half the cycle.'],
    ['In loading response, the quadriceps work', 'eccentrically to control knee flexion', ['concentrically to straighten the knee', 'isometrically to lock the knee', 'not at all', 'to flex the hip'], 'The knee flexes about 15–20° to absorb the load.'],
    ['In terminal swing, the hamstrings', 'decelerate the swinging leg', ['push the body forward', 'flex the hip', 'extend the knee', 'lift the toes'], 'They work eccentrically to slow knee extension and hip flexion.'],
    ['Foot clearance in midswing depends mainly on', 'the hip flexors, knee flexion and ankle dorsiflexors', ['the calf muscles', 'gluteus medius only', 'the quadriceps contracting eccentrically', 'the hamstrings extending the hip'], 'Weak dorsiflexors cause toe drag or a steppage gait.'],
    ['About how much does the knee flex during the swing phase of walking?', '60°', ['15°', '30°', '90°', '120°'], 'About 15–20° in loading response and 60° in swing.'],
    ['Double support in walking occurs', 'twice per cycle, at the start and end of stance', ['once per cycle in midstance', 'only when running', 'during midswing', 'never'], 'Each lasts about 10% of the cycle.']
  ]);
  const qGaitDeviation = table('gait', [
    ['During stance on the right leg, the left side of the pelvis drops. Which gait deviation is this, and what is weak?', 'Trendelenburg gait: weak right gluteus medius', ['Antalgic gait: pain on the left', 'Steppage gait: weak left dorsiflexors', 'Backward trunk lean: weak right gluteus maximus'], 'The stance-side abductor fails to hold the pelvis level.'],
    ['The foot slaps down just after heel contact. What is weak?', 'The dorsiflexors (tibialis anterior)', ['The plantarflexors', 'The quadriceps', 'The gluteus medius', 'The hip flexors'], 'Tibialis anterior normally lowers the foot eccentrically.'],
    ['A person lifts the knee high in swing to keep the toes from dragging (steppage gait). What is weak?', 'The dorsiflexors', ['The hip extensors', 'The hamstrings', 'The hip abductors', 'The plantarflexors'], 'Extra hip and knee flexion make up for foot drop.'],
    ['The trunk lurches backward just after heel contact. What is weak?', 'Gluteus maximus', ['Gluteus medius', 'Iliopsoas', 'Tibialis anterior', 'Quadriceps'], 'Leaning back keeps the body’s weight behind the hip so the weak extensor is not needed.'],
    ['A person spends as little time as possible on one leg, with a short, quick step. Which gait is this?', 'Antalgic gait (pain in that leg)', ['Trendelenburg gait', 'Steppage gait', 'Circumduction', 'Ataxic gait'], 'Shortening stance limits painful loading.'],
    ['The leg swings out in an arc to clear the ground. What is this, and a common cause?', 'Circumduction: a functionally long leg, such as a stiff knee or weak dorsiflexors', ['Trendelenburg gait: weak gluteus medius', 'Antalgic gait: pain', 'Backward trunk lean: weak gluteus maximus'], 'Swinging the leg outward clears a limb that is too long in swing.']
  ], 'Link the deviation to the phase, then ask which muscle normally works in that phase.');
  function qGaitTiming() {
    const form = ri(0, 3);
    if (form === 0) { const T = pick([1.0, 1.05, 1.1, 1.15, 1.2]); const sw = Math.random() < 0.5; return num('gait', `A person’s gait cycle lasts ${T} s. Assuming stance is 60% of the cycle, how long is ${sw ? 'the swing phase' : 'the stance phase'}, in seconds?`, (sw ? 0.4 : 0.6) * T, `${sw ? 'Swing' : 'Stance'} = ${sw ? '0.40' : '0.60'} × ${T} = ${fmt((sw ? 0.4 : 0.6) * T)} s.`, 'Stance 60%, swing 40%.'); }
    if (form === 1) { const L = pick([0.6, 0.65, 0.7, 0.75, 0.8]), c = pick([96, 100, 104, 108, 110, 114, 120]); return num('gait', `Step length is ${L} m and cadence is ${c} steps/min. What is the walking speed, in m/s?`, L * c / 60, `v = ${L} m × ${c} steps/min = ${fmt(L * c)} m/min, and ÷ 60 = ${fmt(L * c / 60)} m/s.`, 'Speed = step length × cadence; convert minutes to seconds.', 0.02); }
    if (form === 2) { const c = pick([96, 100, 105, 110, 120]); return num('gait', `A person walks at ${c} steps/min. How long is one gait cycle (stride), in seconds?`, 120 / c, `One stride is two steps. ${c} steps/min is ${fmt(c / 60)} steps/s, so a stride takes 2 ÷ ${fmt(c / 60)} = ${fmt(120 / c)} s.`, 'A stride = 2 steps.', 0.02); }
    const n = pick([18, 20, 22, 24, 25, 30]), t = pick([10, 12, 15]); return num('gait', `A person takes ${n} steps in ${t} seconds. What is the cadence, in steps per minute?`, n * 60 / t, `${n} ÷ ${t} s × 60 = ${fmt(n * 60 / t)} steps/min.`, 'Scale the count up to 60 seconds.');
  }

  const GENERATORS = [qTerms, qPlaneAxis, qJoints, qConvex, qTissue, qContraction, qStressStrain, qLevers, qLeverClass, qTorque, qMuscleForce, qMA, qSpine, qTrunk, qSciLevel, qShoulder, qRhythm, qRomShoulder, qElbow, qRomElbow, qNerveUE, qWristHand, qCarpal, qRomWrist, qHip, qTrendelenburg, qHipAngles, qRomHip, qKnee, qKneeTest, qRomKnee, qAnkle, qCompartment, qRomAnkle, qFoot, qGait, qGaitDeviation, qGaitTiming];
  const BY_TOPIC = {};
  for (const g of GENERATORS) { const t = g().topic; (BY_TOPIC[t] = BY_TOPIC[t] || []).push(g); }
  function topicsForUnits(units) { return Object.keys(TOPICS).filter(t => units.includes(TOPICS[t].unit)); }
  function generateSet(topics, n) {
    const pool = topics.filter(t => BY_TOPIC[t]); if (!pool.length) return []; const out = []; const order = shuffle(pool); let guard = 0;
    while (out.length < n && guard++ < n * 25) { const t = order[out.length % order.length]; let q; try { q = pick(BY_TOPIC[t])(); } catch (e) { continue; } if (!q || (q.type === 'mc' && q.options.length < 2)) continue; if (out.some(o => o.prompt === q.prompt)) continue; q.id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); out.push(q); }
    return out;
  }
  global.Courses = global.Courses || {}; global.Courses.kin = global.Courses.kin || {};
  global.Courses.kin.quiz = { TOPICS, GENERATORS, BY_TOPIC, generateSet, topicsForUnits, helpers: { fmt, shuffle } };

  /* hint ladders: a way to think about it, the procedure, the nearly-there nudge */
  global.MathubLadders = global.MathubLadders || {};
  global.MathubLadders.kin = {
    terms: ['Start from anatomical position.', 'Ask which way the segment travels: forward–back (sagittal), side to side (frontal) or twisting (transverse).', 'The axis pierces the plane at a right angle.'],
    joints: ['Name the joint’s structural class and synovial type.', 'For glides, decide which surface moves and whether it is convex or concave.', 'Convex moving: roll and glide opposite. Concave moving: the same way.'],
    tissue: ['What joint motion happens, and is it with or against gravity?', 'The muscle resisting gravity works: concentric if it wins, eccentric if it controls a lowering, isometric if nothing moves.', 'For two-joint muscles, check whether they are shortened (active) or stretched (passive) across both joints.'],
    levers: ['Find the axis, the effort and the resistance.', 'Torque = force × perpendicular distance; in equilibrium the torques balance.', 'Solve for the unknown force by dividing by its moment arm.'],
    spine: ['Place the structure in its region: cervical, thoracic or lumbar.', 'Use facet orientation to predict motion.', 'Ligaments limit the motion that stretches them.'],
    trunk: ['For rotation, the external oblique turns the trunk to the opposite side; the SCM turns the face to the opposite side.', 'For spinal cord injury, put the level on the key-muscle ladder.', 'At or above the level: works. Below (complete injury): lost.'],
    shoulder: ['Sort the muscle: scapula mover, arm mover or rotator cuff.', 'Scapulohumeral rhythm: 2 parts glenohumeral, 1 part scapular.', 'Remember the nerves: axillary (deltoid), suprascapular, long thoracic (serratus), thoracodorsal (latissimus).'],
    elbow: ['Name the joint: humeroulnar and humeroradial (flexion–extension) or radioulnar (rotation).', 'Match the flexor to the forearm position.', 'Anterior arm: musculocutaneous; posterior: radial.'],
    'wrist-hand': ['List the carpals in order.', 'Extrinsic vs intrinsic: where does the muscle start?', 'Nerves: radial (extensors), median (thenar, most flexors), ulnar (most intrinsics).'],
    hip: ['Name the plane of the action, then the muscle group.', 'For Trendelenburg, the weak abductor is on the stance side.', 'Angles: inclination about 125°, anteversion about 15°.'],
    knee: ['Name the ligament by the translation or force it resists.', 'Screw-home: the tibia rotates laterally at the end of extension; popliteus unlocks.', 'Two-joint muscles act at both hip and knee, or knee and ankle.'],
    ankle: ['Talocrural: dorsiflexion and plantarflexion. Subtalar: inversion and eversion.', 'Compartment → action → nerve.', 'Lateral sprains happen in plantarflexion and inversion (ATFL first).'],
    foot: ['Rearfoot, midfoot or forefoot?', 'Contact: pronated and flexible. Push-off: supinated and rigid.', 'Toe extension tightens the plantar fascia (windlass).'],
    gait: ['Identify the phase first.', 'Ask what gravity and momentum are doing at each joint in that phase.', 'The muscle resisting that motion is working, usually eccentrically; its weakness produces the deviation.']
  };
})(window);
