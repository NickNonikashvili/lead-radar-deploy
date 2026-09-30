/* ============================================================
   Mathub — KIN 322 Kinesiology (Fall 2026)
   Instructor: Jim Becker, PhD. Built from the course syllabus and its
   tentative schedule. Everyone shares the Tue/Thu lectures, but labs
   run in six sections, so lab rows carry a lab-section id in the fifth
   calendar field (see VARIANTS and App.applyVariant). Exams have two
   parts on Tuesday and Thursday of the same week, and the syllabus lets
   later exams replace earlier ones (GRADING.options).
   Anatomy and normal values follow standard kinesiology sources (Trail
   Guide to the Body, Neumann, AAOS range-of-motion norms), summarized in
   our own words; lectures and labs decide what is on the exams.
   The question bank lives in kin-quiz.js.
   ============================================================ */
(function (global) {
  'use strict';
  const CANVAS = 'https://montana.instructure.com/';
  const AP = 'https://openstax.org/books/anatomy-and-physiology-2e/pages/';
  const COURSE = {
    code: 'KIN 322', name: 'Kinesiology', term: 'Fall 2026', school: 'Montana State University', credits: 4, section: '',
    instructor: 'Jim Becker, PhD', instructorRoom: 'Student Wellness Center 0225 (office hours in Harrison 101A)', instructorEmail: 'james.becker4@montana.edu',
    officeHours: 'Fri 10:00 am–noon in Harrison 101A (open lab); other times by appointment',
    lectures: 'Tue · Thu 9:25–10:40 am, Lewis 304. Labs in Harrison 101A (Mon, Tue, Wed or Thu by section)',
    classDays: 'Tue · Thu lecture, plus one lab',
    weeklyHours: 12,
    site: CANVAS, canvas: CANVAS,
    textbook: { title: 'Biel, Trail Guide to the Body (any of the 5th–7th editions), suggested; copies are available in lab', url: CANVAS },
    links: [
      { eyebrow: 'Course site', title: 'Canvas', url: CANVAS, desc: 'Homework and lab folders by unit, exam breakdown documents, quizzes and announcements. Schedule changes are posted here.' },
      { eyebrow: 'Free reading', title: 'OpenStax Anatomy & Physiology 2e: joints', url: AP + '9-6-anatomy-of-selected-synovial-joints', desc: 'A free walkthrough of the shoulder, elbow, hip, knee and ankle joints. Good for a second explanation; the course follows lecture and the Trail Guide.' },
      { eyebrow: 'Free reading', title: 'OpenStax A&P 2e: upper limb muscles', url: AP + '11-5-muscles-of-the-pectoral-girdle-and-upper-limbs', desc: 'Origins, insertions and actions of the shoulder, arm, forearm and hand muscles.' },
      { eyebrow: 'Free reading', title: 'OpenStax A&P 2e: lower limb muscles', url: AP + '11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs', desc: 'Hip, thigh, leg and foot muscles, with tables of actions.' },
      { eyebrow: 'Support', title: 'Office of Disability, Re-Entry & Veterans Services', url: 'http://www.montana.edu/drv/', desc: 'Contact them and the instructor if you will request accommodations.' }
    ],
    helpCenter: { name: 'Open lab / office hours', where: 'Harrison 101A', hours: 'Jim: Fri 10–noon · GTA times TBA on Canvas' },
    deadlines: [
      { name: 'Homework', rule: 'Due at the end of class on the listed day (usually Tuesday). Keep every completed assignment in a 3-ring binder: you may use it on the open-note part of each exam, and it is checked in week 14 or 15 before the final.' },
      { name: 'Review quizzes', rule: 'Five quizzes. Each opens Friday at 8:00 am and closes the following Monday at 5:00 pm. Timed at 10 minutes, closed book and closed note.' },
      { name: 'Exams', rule: 'Closed-note part on Tuesday, open-note part on Thursday, in class. All exams are cumulative and cannot be rescheduled.' },
      { name: 'Labs', rule: 'Pre-labs before lab, lab questions at the end of lab, and post-labs (posture and movement analyses) before the next lab practical.' },
      { name: 'Late work', rule: 'No late work, extensions or revisions without prior approval or a documented illness, injury or hardship. Tell the instructor as early as you can.' }
    ]
  };
  const SEMESTER = { start: '2026-08-24', end: '2026-12-18' };
  const LABS = [
    { id: 'mon', dow: 1, label: 'Monday 12:10–2:00 pm' }, { id: 'tue', dow: 2, label: 'Tuesday 11:00 am–12:50 pm' },
    { id: 'wed8', dow: 3, label: 'Wednesday 8:00–9:50 am' }, { id: 'wed10', dow: 3, label: 'Wednesday 10:00–11:50 am' },
    { id: 'wed12', dow: 3, label: 'Wednesday 12:00–1:50 pm' }, { id: 'thu', dow: 4, label: 'Thursday 11:00 am–12:50 pm' }
  ];
  const VARIANTS = { label: 'Your lab section', default: 'all', hint: 'Puts your labs and lab practicals on the right day of your calendar.', saved: 'Lab section saved. Your calendar now shows your lab day.',
    options: [{ id: 'all', label: 'Not set: show each lab as a weekly item' }].concat(LABS.map(l => ({ id: l.id, label: `${l.label}, Harrison 101A` }))) };

  /* ---------- topics ---------- */
  const SECTIONS = [
    { id: 'terms', label: '1.1', title: 'Anatomical terms, planes and axes', unit: 1, link: AP + '1-6-anatomical-terminology', linkLabel: 'Free reading: OpenStax A&P 1.6',
      ideas: ['Every description starts from <b>anatomical position</b>: standing upright, facing forward, arms at the sides with palms forward. Directions: <b>superior/inferior</b>, <b>anterior/posterior</b>, <b>medial/lateral</b>, <b>proximal/distal</b> (along a limb) and <b>superficial/deep</b>.',
        'Each <b>cardinal plane</b> pairs with the <b>axis</b> that pierces it at a right angle. <b>Sagittal plane</b> + mediolateral axis: flexion and extension, dorsiflexion and plantarflexion. <b>Frontal (coronal) plane</b> + anteroposterior axis: abduction and adduction, lateral flexion, radial and ulnar deviation. <b>Transverse plane</b> + longitudinal (vertical) axis: medial and lateral rotation, pronation and supination, horizontal abduction and adduction.',
        'Special movements: <b>circumduction</b> (a cone combining several planes), <b>protraction/retraction</b> and <b>elevation/depression</b> (scapula, mandible), <b>upward/downward rotation</b> (scapula), <b>opposition</b> (thumb), <b>inversion/eversion</b> and the triplanar <b>pronation/supination</b> of the foot.',
        '<b>Kinematics</b> describes motion (angles, velocity) without its causes; <b>kinetics</b> studies the forces and torques that cause it. <b>Osteokinematics</b> is the motion of bones through planes; <b>arthrokinematics</b> is motion between joint surfaces (roll, glide, spin).',
        '<b>Degrees of freedom</b> are the planes a joint can move in: hinge 1, condyloid and saddle 2, ball-and-socket 3. In an <b>open kinetic chain</b> the distal segment moves freely (a seated leg extension); in a <b>closed chain</b> it is fixed and the proximal segment moves over it (a squat).'],
      formulas: [],
      example: { p: 'A person raises an arm straight out to the side to shoulder height, then swings it forward to point straight ahead at the same height. Name each movement with its plane and axis.', s: 'Raising it to the side is shoulder <b>abduction</b> in the <b>frontal plane</b> about an <b>anteroposterior axis</b>. Swinging it forward at shoulder height is <b>horizontal adduction</b> in the <b>transverse plane</b> about a <b>vertical (longitudinal) axis</b>.' },
      pitfalls: ['Pairing a plane with an axis that lies inside it. The axis is always perpendicular to the plane.', 'Describing a person lying down with “up” and “down”. Terms always refer to anatomical position.', 'Using superior/inferior along a limb where proximal/distal is the standard.', 'Calling forearm pronation “internal rotation”. It is pronation, at the radioulnar joints.'],
      tip: 'Practice on yourself: make a movement, then say the plane and axis aloud. Picture the axis as a pin through a door hinge, at a right angle to the swing.' },
    { id: 'joints', label: '1.2', title: 'Joint structure and arthrokinematics', unit: 1, link: AP + '9-4-synovial-joints', linkLabel: 'Free reading: OpenStax A&P 9.4',
      ideas: ['Structural classes: <b>fibrous</b> (sutures, the distal tibiofibular syndesmosis, gomphoses), <b>cartilaginous</b> (symphyses such as the pubic symphysis and intervertebral discs; synchondroses such as growth plates) and <b>synovial</b> (with a joint cavity). Functional classes: synarthrosis (immovable), amphiarthrosis (slightly movable), diarthrosis (freely movable).',
        'A synovial joint has hyaline <b>articular cartilage</b>, a <b>capsule</b> (fibrous outer layer, synovial membrane inside), <b>synovial fluid</b> and ligaments; many add menisci or discs, a labrum, bursae or fat pads.',
        'Six synovial types: <b>plane</b> (intercarpal, AC), <b>hinge</b> (humeroulnar, interphalangeal), <b>pivot</b> (proximal radioulnar, atlantoaxial), <b>condyloid</b> (radiocarpal, MCP), <b>saddle</b> (thumb CMC) and <b>ball-and-socket</b> (glenohumeral, hip).',
        '<b>Arthrokinematics</b>: surfaces <b>roll</b>, <b>glide</b> (slide) and <b>spin</b>. The <b>convex–concave rule</b>: when a convex surface moves on a fixed concave one, it rolls and glides in <b>opposite</b> directions; when a concave surface moves on a fixed convex one, they go the <b>same</b> direction.',
        'The <b>close-packed position</b> has maximal congruence and taut ligaments: most stable, least joint play (knee in full extension, glenohumeral in abduction with lateral rotation, humeroulnar in extension). The <b>loose-packed (resting) position</b> has the most play. Mobility and stability trade off: the shallow shoulder moves more than the deep hip.'],
      formulas: [],
      example: { p: 'During shoulder abduction, which way does the humeral head glide on the glenoid, and why does it matter?', s: 'The humeral head is <b>convex</b> moving on the fixed <b>concave</b> glenoid, so it rolls superiorly and glides <b>inferiorly</b>, in opposite directions. Without that inferior glide the head would roll up into the acromion and pinch the tissues beneath it (impingement).' },
      pitfalls: ['Calling the pubic symphysis fibrous. It is cartilaginous.', 'Mixing roll (a tire rolling) with glide (a tire skidding).', 'Applying the convex–concave rule without first asking which surface moves.', 'Confusing close-packed (locked and stable) with the resting position.'],
      tip: 'Start a table of every joint in the course: structural type, degrees of freedom, close-packed position and main ligaments. You will reuse it in every region.' },
    { id: 'tissue', label: '1.3', title: 'Connective tissue and muscle mechanics', unit: 1, link: AP + '11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems', linkLabel: 'Free reading: OpenStax A&P 11.1',
      ideas: ['Tissues are loaded in <b>tension</b>, <b>compression</b>, <b>shear</b>, <b>bending</b> and <b>torsion</b>. <b>Stress</b> = force ÷ area and <b>strain</b> = change in length ÷ original length. A stress–strain curve has a toe region (crimp straightening), an elastic region, a plastic region (permanent deformation) and failure; the slope is <b>stiffness</b>.',
        'Connective tissues are <b>viscoelastic</b>: <b>creep</b> (lengthening under a constant load), <b>stress relaxation</b> (falling stress at a constant length) and rate dependence. Ligaments join bone to bone and tendons muscle to bone (dense, parallel collagen); cartilage resists compression; bone remodels to the loads it carries (<b>Wolff’s law</b>), and disuse weakens every tissue.',
        'Muscle architecture: <b>parallel (fusiform)</b> fibers, as in sartorius and biceps, favor range and speed; <b>pennate</b> fibers (unipennate, bipennate such as rectus femoris, multipennate such as deltoid) pack in more fibers, raising the <b>physiological cross-sectional area</b> and therefore force.',
        '<b>Length–tension</b>: active force peaks near resting length, where actin and myosin overlap best; passive tension rises with stretch. <b>Force–velocity</b>: concentric force drops as speed rises, and eccentric force can exceed maximal isometric force. <b>Active insufficiency</b>: a two-joint muscle shortened across both joints produces little force (a weak fist with the wrist flexed). <b>Passive insufficiency</b>: a two-joint muscle cannot stretch across both joints at once (hamstrings limit hip flexion with the knee straight).',
        'Contraction types: <b>concentric</b> (shortening), <b>eccentric</b> (lengthening under load, controlling a lowering) and <b>isometric</b> (no length change). Roles: <b>agonist</b> (prime mover), <b>antagonist</b>, <b>synergist</b>, <b>stabilizer</b> and <b>neutralizer</b>. When gravity drives a motion, the muscle on the opposite side controls it eccentrically.'],
      formulas: [{ n: 'Stress', t: String.raw`\sigma = \dfrac{F}{A}` }, { n: 'Strain', t: String.raw`\varepsilon = \dfrac{\Delta L}{L_0}` }],
      example: { p: 'When you slowly sit down into a chair, which muscle group controls the knees, and what type of contraction is it?', s: 'The knees flex under gravity, so the <b>quadriceps</b> (knee extensors) contract <b>eccentrically</b> to control the lowering. Gravity does the flexing; the muscle on the other side of the joint brakes it.' },
      pitfalls: ['Naming the hamstrings for lowering into a squat because the knee is flexing. With gravity driving the motion, the knee extensors work eccentrically.', 'Thinking pennate muscles are weaker because their fibers are angled. More fibers fit, so force is higher.', 'Mixing creep (constant load) with stress relaxation (constant length).', 'Swapping active and passive insufficiency.'],
      tip: 'For every movement question ask three things: which joint motion happens, whether it is with or against gravity (or a load), and therefore which muscle group works and how.' },
    { id: 'levers', label: '1.4', title: 'Levers, torque and biomechanics', unit: 1, link: AP + '11-1-interactions-of-skeletal-muscles-their-fascicle-arrangement-and-their-lever-systems', linkLabel: 'Free reading: OpenStax A&P 11.1',
      ideas: ['<b>Torque</b> (moment of force) = force × the <b>perpendicular</b> distance from the axis to the force’s line of action (the <b>moment arm</b>). Units: N·m. A muscle or load makes the most torque when it acts at right angles to the segment.',
        'Levers are named by what sits in the middle. <b>First class</b>: axis in the middle (nodding the head at the atlanto-occipital joint; triceps pulling on the olecranon). <b>Second class</b>: resistance in the middle (a wheelbarrow; rising onto the toes is the usual body example). <b>Third class</b>: effort in the middle (biceps at the elbow and most limb muscles).',
        '<b>Mechanical advantage</b> = effort arm ÷ resistance arm. Above 1 (second class) favors force; below 1 (third class) favors speed and range of motion. Muscles attach close to joints, so they must pull with forces many times the load but move the hand or foot fast and far.',
        '<b>Static equilibrium</b>: the forces and torques on a segment each sum to zero. To hold a load still, muscle force × muscle moment arm = load × load moment arm (plus the segment’s own weight × its moment arm).',
        'Newton’s laws: inertia, <b>F = ma</b>, and action–reaction (the <b>ground reaction force</b>). A muscle’s pull splits into a <b>rotary</b> component (perpendicular, making torque) and a <b>stabilizing or dislocating</b> component (along the bone), and the split changes with joint angle. A low center of gravity over a wide base of support is more stable.'],
      formulas: [{ n: 'Torque', t: String.raw`\tau = F \cdot d_{\perp}` }, { n: 'Rotational equilibrium', t: String.raw`\sum \tau = 0` }, { n: 'Mechanical advantage', t: String.raw`\text{MA} = \dfrac{d_{\text{effort}}}{d_{\text{resistance}}}` }],
      example: { p: 'A 20 N dumbbell is held 0.30 m from the elbow with the forearm horizontal. The biceps inserts 0.04 m from the elbow and pulls straight up. Ignoring the forearm’s weight, what biceps force holds it still?', s: 'Torques balance about the elbow: F × 0.04 = 20 × 0.30, so F = 6 ÷ 0.04 = <b>150 N</b>. The muscle pulls 7.5 times the load because its moment arm is 7.5 times shorter (MA = 0.04 ÷ 0.30 ≈ 0.13).' },
      pitfalls: ['Using the distance along a slanted bone instead of the perpendicular distance to the line of force.', 'Classifying a lever by where the muscle is. Ask what is in the middle: axis, resistance or effort.', 'Thinking a mechanical advantage below 1 is a design flaw. Third-class levers trade force for speed and range.'],
      tip: 'Remember “ARE 1-2-3”: the item in the middle is the Axis for first class, the Resistance for second and the Effort for third.' },
    { id: 'spine', label: '1.5', title: 'The axial skeleton: vertebral column', unit: 1, link: AP + '7-3-the-vertebral-column', linkLabel: 'Free reading: OpenStax A&P 7.3',
      ideas: ['The column has <b>7 cervical, 12 thoracic and 5 lumbar</b> vertebrae, the <b>sacrum</b> (5 fused) and the <b>coccyx</b> (about 4 fused). Curves: cervical and lumbar <b>lordosis</b> (secondary curves, developing with head control and walking) and thoracic and sacral <b>kyphosis</b> (primary curves, present at birth).',
        'A typical vertebra: a <b>body</b> for weight bearing; a vertebral <b>arch</b> (pedicles and laminae) around the vertebral foramen; spinous and transverse processes; and superior and inferior articular processes that form the <b>facet (zygapophyseal) joints</b>. Cervical: transverse foramina, bifid spinous processes. Thoracic: costal facets for ribs, long downward spines. Lumbar: large bodies, short square spines.',
        'The <b>atlas (C1)</b> has no body: the atlanto-occipital joint nods “yes” (flexion and extension). The <b>axis (C2)</b> has the dens: the atlantoaxial joint turns “no” and provides about half of cervical rotation.',
        'The <b>intervertebral disc</b> has a gel <b>nucleus pulposus</b> inside a ring of collagen layers, the <b>annulus fibrosus</b>. Flexion pushes the nucleus posteriorly, which is why disc herniations are usually posterolateral, toward the nerve roots.',
        '<b>Facet orientation</b> sets each region’s motion: cervical facets allow all motions, especially rotation; thoracic facets allow rotation and lateral flexion but the ribs limit them; lumbar facets lie near the sagittal plane, favoring flexion and extension and blocking rotation. Ligaments: anterior longitudinal (limits extension), posterior longitudinal and ligamentum flavum (limit flexion; the flavum is elastic), interspinous, supraspinous and the nuchal ligament.'],
      formulas: [],
      example: { p: 'Why is rotation limited in the lumbar spine but free at C1–C2?', s: 'Lumbar facets face mostly medially and laterally, close to the sagittal plane, so they block rotation while allowing flexion and extension. At C1–C2 the atlas pivots around the dens, a joint built for rotation, which provides about half of all cervical rotation.' },
      pitfalls: ['Saying the posterior longitudinal ligament limits extension. Flexion stretches it.', 'Mixing primary curves (kyphotic, at birth) with secondary curves (lordotic, later).', 'Counting the adult sacrum as five separate vertebrae.'],
      tip: 'In lab, find C7 (the vertebra prominens) and count down. The inferior angle of the scapula sits near T7 and the tops of the iliac crests near L4–L5.' },
    { id: 'trunk', label: '1.6', title: 'Trunk muscles, posture and spinal cord injury', unit: 1, link: AP + '11-4-axial-muscles-of-the-abdominal-wall-and-thorax', linkLabel: 'Free reading: OpenStax A&P 11.4',
      ideas: ['Abdominals: <b>rectus abdominis</b> (trunk flexion, posterior pelvic tilt), <b>external oblique</b> (rotation to the opposite side), <b>internal oblique</b> (rotation to the same side) and <b>transversus abdominis</b> (compresses the abdomen and stiffens the spine without moving it).',
        'Back and neck: <b>erector spinae</b> (iliocostalis, longissimus, spinalis: extension and lateral flexion), <b>transversospinalis</b> (multifidus for segmental stability, rotatores, semispinalis), <b>quadratus lumborum</b> (lateral flexion, hip hiking), <b>sternocleidomastoid</b> (both sides: neck flexion; one side: lateral flexion toward and rotation away), <b>scalenes</b> and <b>splenius</b> muscles.',
        'Deep “core” muscles (transversus abdominis, multifidus, diaphragm, pelvic floor) stiffen the spine; superficial muscles move it. Posture deviations: excess <b>kyphosis</b>, excess <b>lordosis</b> (often with anterior pelvic tilt), flat back, forward head and <b>scoliosis</b> (a lateral curve with vertebral rotation).',
        'The spinal cord ends near <b>L1–L2</b> (conus medullaris); below it is the <b>cauda equina</b>. There are 31 pairs of spinal nerves: 8 cervical, 12 thoracic, 5 lumbar, 5 sacral and 1 coccygeal. C1–C7 exit above their vertebra, C8 below C7, and the rest below theirs.',
        '<b>Spinal cord injury</b>: the level and completeness (ASIA A–E) set what function remains. Injuries at C3–C5 threaten breathing (“C3, 4, 5 keeps the diaphragm alive”). Cervical injuries cause <b>tetraplegia</b>; thoracic or lower, <b>paraplegia</b>. Key muscles: C5 elbow flexors, C6 wrist extensors, C7 elbow extensors, C8 finger flexors, T1 little-finger abductors; L2 hip flexors, L3 knee extensors, L4 ankle dorsiflexors, L5 long toe extensors, S1 ankle plantarflexors.'],
      formulas: [],
      example: { p: 'After a complete spinal cord injury with C6 as the lowest normal level, can the person flex the elbows, extend the wrists and extend the elbows?', s: 'C5 (elbow flexors) and C6 (wrist extensors) work, so <b>yes</b> to elbow flexion and wrist extension. C7 (triceps, elbow extension) is below the injury, so elbow extension is <b>lost</b>. People with this level often use a tenodesis grip: extending the wrist pulls the fingers closed passively.' },
      pitfalls: ['Getting sternocleidomastoid rotation backwards: the right SCM turns the face to the left.', 'Crediting transversus abdominis with trunk flexion. It compresses and stabilizes.', 'Assuming the spinal cord runs the whole length of the canal. It ends near L1–L2.'],
      tip: 'Learn the key muscles as a ladder from C5 to S1. Many spinal cord injury questions are “what can this person still do?”' },
    { id: 'shoulder', label: '2.1', title: 'The shoulder complex', unit: 2, link: AP + '9-6-anatomy-of-selected-synovial-joints', linkLabel: 'Free reading: OpenStax A&P 9.6',
      ideas: ['Four joints: <b>sternoclavicular</b> (saddle; the only bony link between the arm and the trunk), <b>acromioclavicular</b> (plane), <b>glenohumeral</b> (ball-and-socket) and the <b>scapulothoracic</b> articulation (a functional joint, not a true one).',
        'The glenohumeral joint trades stability for mobility: a shallow glenoid deepened by the <b>labrum</b>, a loose capsule with superior, middle and inferior glenohumeral ligaments, and the <b>rotator cuff</b>, <b>SITS</b>: supraspinatus (starts abduction), infraspinatus and teres minor (lateral rotation) and subscapularis (medial rotation), which press the head into the socket. Most dislocations are anterior-inferior.',
        '<b>Scapulohumeral rhythm</b>: about 2° of glenohumeral motion for every 1° of scapular upward rotation, so 180° of elevation is about 120° glenohumeral + 60° scapulothoracic. The upper and lower trapezius and serratus anterior form the <b>upward-rotation force couple</b>; the clavicle elevates and rotates posteriorly, and the humerus must rotate laterally to clear the greater tubercle.',
        'Scapular muscles: <b>trapezius</b> (upper: elevation, upward rotation; middle: retraction; lower: depression, upward rotation), <b>rhomboids</b> (retraction, downward rotation), <b>levator scapulae</b> (elevation, downward rotation), <b>serratus anterior</b> (protraction, upward rotation; long thoracic nerve, or the scapula “wings”) and <b>pectoralis minor</b>.',
        'Arm movers: <b>deltoid</b> (anterior: flexion and medial rotation; middle: abduction; posterior: extension and lateral rotation; axillary nerve), <b>pectoralis major</b> (adduction, medial rotation, flexion), <b>latissimus dorsi</b> (extension, adduction, medial rotation; thoracodorsal nerve), teres major and coracobrachialis. <b>Subacromial impingement</b> pinches the supraspinatus tendon and bursa under the acromion.'],
      formulas: [{ n: 'Scapulohumeral rhythm', t: String.raw`\text{GH} : \text{ST} \approx 2 : 1` }],
      example: { p: 'A patient can lift the arm only to about 120°, and the scapula does not move. Explain using scapulohumeral rhythm.', s: 'Full elevation of 180° takes about <b>120° at the glenohumeral joint</b> plus <b>60° of scapular upward rotation</b>. With the scapula fixed, only the glenohumeral share is available. Check the upward rotators: trapezius and serratus anterior (and the long thoracic nerve).' },
      pitfalls: ['Putting teres major in the rotator cuff. The cuff has teres minor.', 'Calling the scapulothoracic articulation a synovial joint.', 'Thinking the deltoid can abduct alone. Without the cuff holding the head down, it would jam the head upward.', 'Mixing the rotators: infraspinatus and teres minor rotate laterally, subscapularis medially.'],
      tip: 'Group shoulder muscles by what they move: the scapula (trapezius, rhomboids, levator, serratus, pectoralis minor), the arm (deltoid, pectoralis major, latissimus, teres major, coracobrachialis) and the cuff (SITS).' },
    { id: 'elbow', label: '2.2', title: 'Elbow and forearm', unit: 2, link: AP + '9-6-anatomy-of-selected-synovial-joints', linkLabel: 'Free reading: OpenStax A&P 9.6',
      ideas: ['The elbow complex: <b>humeroulnar</b> (hinge; trochlea in the trochlear notch; the main flexion–extension joint), <b>humeroradial</b> (capitulum with the radial head; flexion–extension plus spin) and <b>proximal radioulnar</b> (pivot; the radial head turns in the <b>annular ligament</b>). The distal radioulnar joint completes pronation and supination, and the <b>interosseous membrane</b> passes force from radius to ulna.',
        'The <b>carrying angle</b> is a normal valgus of about 10–15° (often a bit more in females). The <b>ulnar (medial) collateral ligament</b> resists valgus stress and is injured in throwing; the <b>radial (lateral) collateral</b> resists varus; the annular ligament holds the radial head (a pulled “nursemaid’s elbow” in young children).',
        'Flexors: <b>brachialis</b> (a pure flexor on the ulna, working in any forearm position), <b>biceps brachii</b> (flexion and the strongest supination, best with the elbow at 90°) and <b>brachioradialis</b> (strongest in the thumb-up midposition). Extensors: <b>triceps brachii</b> (the long head also extends the shoulder) and anconeus.',
        'Pronators: <b>pronator quadratus</b> (the main one) and <b>pronator teres</b>. Supinators: <b>supinator</b> and biceps. Normal range: about 0–150° flexion, 80° pronation, 80° supination; the humeroulnar joint is close-packed in extension.',
        'Nerves: <b>musculocutaneous</b> (biceps, brachialis, coracobrachialis), <b>radial</b> (triceps, brachioradialis, supinator, wrist and finger extensors), <b>median</b> (pronators, most wrist and finger flexors), <b>ulnar</b> (flexor carpi ulnaris, part of FDP, most hand intrinsics). <b>Lateral epicondylitis</b> (“tennis elbow”) involves the common extensor origin; <b>medial epicondylitis</b> (“golfer’s elbow”) the flexor–pronator origin.'],
      formulas: [],
      example: { p: 'Why is a chin-up (palms toward you) usually easier than a pull-up (palms away)?', s: 'With the forearm <b>supinated</b>, the biceps has a good line of pull and adds strongly to elbow flexion. When the forearm is <b>pronated</b>, the biceps tendon wraps around the radius and it is a weaker elbow flexor, leaving more of the work to brachialis and brachioradialis.' },
      pitfalls: ['Calling biceps the strongest elbow flexor in every position. Brachialis is the workhorse.', 'Placing pronation and supination at the humeroulnar joint. They happen at the radioulnar joints.', 'Mixing tennis elbow (lateral, extensors) with golfer’s elbow (medial, flexors).'],
      tip: 'Quiz yourself on each forearm position: which elbow flexor is strongest in supination, in midposition and in pronation?' },
    { id: 'wrist-hand', label: '2.3', title: 'Wrist and hand', unit: 2, link: AP + '11-5-muscles-of-the-pectoral-girdle-and-upper-limbs', linkLabel: 'Free reading: OpenStax A&P 11.5',
      ideas: ['Carpals, lateral to medial. Proximal row: <b>scaphoid, lunate, triquetrum, pisiform</b>. Distal row: <b>trapezium, trapezoid, capitate, hamate</b>. The scaphoid is the most often fractured (a fall on an outstretched hand, with snuffbox tenderness and a risk of avascular necrosis); the lunate is the most often dislocated.',
        'The wrist is the <b>radiocarpal</b> joint (condyloid: radius with scaphoid and lunate; the ulna is separated by the triangular fibrocartilage complex) plus the <b>midcarpal</b> joints. Normal range: about 80° flexion, 70° extension, 20° radial and 30° ulnar deviation.',
        'Wrist flexors start on the <b>medial epicondyle</b> (flexor carpi radialis, flexor carpi ulnaris, palmaris longus); extensors on the <b>lateral epicondyle</b> (extensor carpi radialis longus and brevis, extensor carpi ulnaris). Radial deviation pairs a radial flexor and extensor; ulnar deviation pairs FCU and ECU. Wrist extensors stabilize the wrist for a strong grip.',
        'Extrinsic finger muscles: <b>flexor digitorum superficialis</b> (flexes the PIP), <b>flexor digitorum profundus</b> (the only DIP flexor) and extensor digitorum; the thumb has FPL, EPL, EPB and APL (the snuffbox borders). Intrinsics: thenar muscles (median nerve), hypothenar muscles, lumbricals (flex the MCPs and extend the IPs) and interossei (<b>PAD</b>: palmar adduct; <b>DAB</b>: dorsal abduct; ulnar nerve).',
        'The thumb CMC is a <b>saddle</b> joint that allows opposition. The <b>carpal tunnel</b> holds nine tendons (4 FDS, 4 FDP, FPL) and the <b>median nerve</b>; compression numbs the thumb to the radial ring finger and weakens the thenar muscles. Grips: power (cylindrical, spherical, hook) and precision (pad-to-pad, tip-to-tip, lateral pinch). Nerve injuries: radial, wrist drop; ulnar, claw hand; median, “ape hand.”'],
      formulas: [],
      example: { p: 'A student falls on an outstretched hand and has pain in the anatomical snuffbox. Which bone is suspected, and why does it matter?', s: 'The <b>scaphoid</b>, the most often fractured carpal. Its blood supply enters distally, so a fracture through its waist can cut off the proximal part and lead to <b>avascular necrosis</b>. It is often splinted even when the first X-ray looks normal.' },
      pitfalls: ['Saying the ulna articulates directly with the carpals. The TFCC sits between them.', 'Mixing FDS (PIP) with FDP (DIP).', 'Forgetting that the interossei and most intrinsics are ulnar-nerve muscles while the thenar group is median.'],
      tip: 'Palpate while you study: find the snuffbox tendons, the pisiform and the hook of the hamate on your own hand.' },
    { id: 'hip', label: '3.1', title: 'Pelvis, sacroiliac joint and hip', unit: 3, link: AP + '9-6-anatomy-of-selected-synovial-joints', linkLabel: 'Free reading: OpenStax A&P 9.6',
      ideas: ['The pelvis: two hip bones (ilium, ischium and pubis, fused at the acetabulum), the sacrum and the coccyx. The <b>sacroiliac joint</b> is very stable with small motions, <b>nutation</b> (the sacral base tips forward) and <b>counternutation</b>, held by strong sacroiliac, sacrotuberous and sacrospinous ligaments.',
        '<b>Pelvic tilt</b>: anterior tilt (ASIS forward and down) increases lumbar lordosis and flexes the hip; posterior tilt flattens the lumbar spine. <b>Lumbopelvic rhythm</b> pairs trunk flexion with hip flexion when you bend forward.',
        'The <b>hip</b> is a deep ball-and-socket with a labrum. The femoral <b>angle of inclination</b> is about 125° in adults (smaller: coxa vara; larger: coxa valga) and <b>anteversion</b> about 15° (excess causes in-toeing). Ligaments: <b>iliofemoral</b> (the Y ligament, strongest, limits extension), pubofemoral and ischiofemoral. Close-packed: extension with medial rotation and abduction.',
        'Muscles. Flexors: <b>iliopsoas</b>, rectus femoris, sartorius, TFL, pectineus. Extensors: <b>gluteus maximus</b> (climbing, rising) and the <b>hamstrings</b>. Abductors: <b>gluteus medius and minimus</b>, TFL. Adductors: adductor longus, brevis and magnus, gracilis, pectineus. Lateral rotators: piriformis, gemelli, obturators, quadratus femoris and gluteus maximus.',
        'In single-leg stance the stance-side <b>gluteus medius</b> keeps the pelvis level; if it is weak, the opposite side drops: a <b>Trendelenburg sign</b>. A cane goes in the hand opposite the painful hip. Nerves: femoral (quadriceps, iliacus), obturator (adductors), superior gluteal (gluteus medius and minimus, TFL), inferior gluteal (gluteus maximus), sciatic (hamstrings).'],
      formulas: [],
      example: { p: 'Standing on the left leg, a person’s right side of the pelvis drops. Which muscle is weak, on which side?', s: 'The <b>left gluteus medius</b>, on the stance side. It should hold the pelvis level by pulling it toward the stance femur; when it is weak, the unsupported right side drops. This is a positive Trendelenburg sign on the left.' },
      pitfalls: ['Blaming the side that drops. The weakness is on the stance side.', 'Saying the iliofemoral ligament limits flexion. It limits extension.', 'Swapping coxa vara (a smaller angle) and coxa valga (a larger one).'],
      tip: 'Write each hip muscle’s action in all three planes. Several, such as gluteus maximus, the adductors and TFL, act in more than one.' },
    { id: 'knee', label: '3.2', title: 'The knee', unit: 3, link: AP + '9-6-anatomy-of-selected-synovial-joints', linkLabel: 'Free reading: OpenStax A&P 9.6',
      ideas: ['The <b>tibiofemoral</b> joint is a modified hinge: about 135° of flexion, plus rotation when the knee is bent. The <b>menisci</b> deepen the surface and absorb load: the medial one is C-shaped and attached to the MCL (less mobile, more often torn); the lateral one is more circular and mobile. At the <b>patellofemoral</b> joint, the patella (a sesamoid bone) lengthens the quadriceps’ moment arm.',
        'Ligaments: <b>ACL</b> (stops the tibia sliding forward on the femur; injured in noncontact cutting and landing), <b>PCL</b> (stops posterior sliding; “dashboard” injuries), <b>MCL</b> (resists valgus) and <b>LCL</b> (resists varus). A blow to the outside of the knee can cause the “unhappy triad”: ACL, MCL and medial meniscus.',
        'The <b>screw-home mechanism</b>: in the last 20–30° of extension the tibia rotates laterally on the femur (or, standing, the femur rotates medially on the tibia), locking the knee in its close-packed position. The <b>popliteus</b> unlocks it.',
        'Convex–concave at the knee: in open-chain extension the concave tibia rolls and glides <b>anteriorly</b> (same direction). Rising from a squat, the convex femur rolls anteriorly and glides <b>posteriorly</b>.',
        'Muscles: <b>quadriceps</b> (rectus femoris, which also flexes the hip, and the three vasti; femoral nerve), <b>hamstrings</b> (knee flexion and hip extension; sciatic nerve), gastrocnemius, popliteus, and the <b>pes anserinus</b> (sartorius, gracilis, semitendinosus). The <b>Q-angle</b> (ASIS to mid-patella to tibial tuberosity) is about 10–15°, and larger angles pull the patella laterally.'],
      formulas: [],
      example: { p: 'A soccer player plants, cuts and hears a pop. In the Lachman test the tibia slides forward on the femur. Which ligament is injured, and what else is often hurt?', s: 'The <b>ACL</b>, which resists anterior tibial translation. If a valgus force was involved, the <b>MCL</b> and <b>medial meniscus</b> may also be torn (the unhappy triad).' },
      pitfalls: ['Mixing the ACL (stops the tibia sliding forward) with the PCL (stops it sliding back).', 'Attaching the lateral meniscus to the MCL. The medial one is attached.', 'Forgetting that rectus femoris, the hamstrings and gastrocnemius each cross two joints.'],
      tip: 'Name each knee ligament by the force or translation it stops. That is how the special tests are described.' },
    { id: 'ankle', label: '3.3', title: 'Leg and ankle', unit: 3, link: AP + '11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs', linkLabel: 'Free reading: OpenStax A&P 11.6',
      ideas: ['The <b>talocrural (ankle) joint</b> is a hinge between the talus and the mortise formed by the tibia and fibula: about 20° dorsiflexion and 50° plantarflexion. The talus is wider in front, so the joint is close-packed and most stable in dorsiflexion; sprains happen in plantarflexion with inversion.',
        'The <b>subtalar joint</b> (talus on calcaneus) provides most <b>inversion</b> (about 35°) and <b>eversion</b> (about 15°). Open-chain <b>pronation</b> = dorsiflexion + eversion + abduction; <b>supination</b> = plantarflexion + inversion + adduction.',
        'Lateral ligaments: <b>anterior talofibular</b> (the most often sprained), calcaneofibular and posterior talofibular. The medial <b>deltoid ligament</b> is so strong that eversion injuries often break bone instead. A “high ankle sprain” injures the distal tibiofibular syndesmosis.',
        'Compartments. <b>Anterior</b> (tibialis anterior, extensor hallucis longus, extensor digitorum longus): dorsiflexion, deep fibular nerve. <b>Lateral</b> (fibularis longus and brevis): eversion, superficial fibular nerve. <b>Superficial posterior</b> (gastrocnemius, soleus, plantaris, joining in the Achilles tendon): plantarflexion, tibial nerve. <b>Deep posterior</b> (tibialis posterior, FDL, FHL, “Tom, Dick and Harry” behind the medial malleolus): inversion and plantarflexion.',
        'The gastrocnemius crosses the knee, so it is strongest with the knee straight; the soleus crosses only the ankle and dominates with the knee bent. Tibialis anterior lowers the foot eccentrically after heel contact; if it is weak (common fibular nerve injury at the fibular head), the foot slaps or drops. Other problems: Achilles tendinopathy or rupture, medial tibial stress syndrome and compartment syndrome.'],
      formulas: [],
      example: { p: 'A basketball player lands on another player’s foot and rolls the ankle so the sole turns inward. Which ligament is most likely sprained, and why that one?', s: 'The <b>anterior talofibular ligament</b>. Landing in plantarflexion and inversion puts the narrow back of the talus in the mortise, where the joint is least stable, and stretches the ATFL first; it is the weakest lateral ligament.' },
      pitfalls: ['Stretching the soleus with the knee straight. Bend the knee to slacken the gastrocnemius.', 'Placing inversion and eversion at the talocrural joint. They happen mainly at the subtalar joint.', 'Mixing the nerves: deep fibular (dorsiflexors), superficial fibular (evertors), tibial (plantarflexors and invertors).'],
      tip: 'Tie each compartment to one action and one nerve: anterior, dorsiflex, deep fibular; lateral, evert, superficial fibular; posterior, plantarflex and invert, tibial.' },
    { id: 'foot', label: '4.1', title: 'The foot', unit: 4, link: AP + '8-4-bones-of-the-lower-limb', linkLabel: 'Free reading: OpenStax A&P 8.4',
      ideas: ['26 bones: 7 <b>tarsals</b> (talus, calcaneus, navicular, cuboid and three cuneiforms), 5 metatarsals and 14 phalanges. Regions: rearfoot (talus, calcaneus), midfoot (navicular, cuboid, cuneiforms) and forefoot (metatarsals, phalanges).',
        'The <b>transverse tarsal (midtarsal) joint</b>, talonavicular plus calcaneocuboid, works with the subtalar joint: pronated and unlocked, the foot is a <b>flexible adapter</b> at contact; supinated and locked, it is a <b>rigid lever</b> for push-off.',
        'Three arches: <b>medial longitudinal</b> (the highest), <b>lateral longitudinal</b> and <b>transverse</b>. They are held by bone shape, the <b>plantar fascia</b>, the <b>spring ligament</b> (plantar calcaneonavicular), the long and short plantar ligaments, and muscles (tibialis posterior, fibularis longus, the intrinsics).',
        'The <b>windlass mechanism</b>: extending the toes at push-off winds the plantar fascia around the metatarsal heads, raising the arch and stiffening the foot. <b>Plantar fasciitis</b> causes heel pain at the fascia’s origin, worst with the first steps of the morning.',
        'Foot types: <b>pes planus</b> (flat, often overpronated) and <b>pes cavus</b> (high, rigid, poor shock absorption). Other problems: hallux valgus (bunion), hammer toes, metatarsal stress fractures and Morton’s neuroma (usually between the third and fourth metatarsal heads). The intrinsic muscles lie in four plantar layers and support the arch.'],
      formulas: [],
      example: { p: 'Why does your arch rise when you stand on your toes, even though no muscle lifts it directly?', s: 'Rising onto the toes extends the MTP joints, which winds the <b>plantar fascia</b> around the metatarsal heads like a rope on a windlass. The tightened fascia pulls the heel toward the toes, raising the medial arch and turning the foot into a rigid lever.' },
      pitfalls: ['Treating pronation as always bad. Normal pronation after contact absorbs shock; trouble comes from too much or badly timed pronation.', 'Leaving the navicular and cuboid out of the tarsal count.', 'Calling the plantar fascia a muscle.'],
      tip: 'Follow the foot through one step: pronated and flexible when it lands, supinated and rigid when it pushes off.' },
    { id: 'gait', label: '4.2', title: 'Gait', unit: 4, link: AP + '11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs', linkLabel: 'Free reading: OpenStax A&P 11.6',
      ideas: ['A <b>gait cycle</b> (one <b>stride</b>) runs from one foot’s initial contact to that same foot’s next contact; a <b>step</b> is from one foot’s contact to the other’s. At normal walking speed, <b>stance ≈ 60%</b> and <b>swing ≈ 40%</b> of the cycle, with two <b>double-support</b> periods of about 10% each.',
        'Stance phases (Rancho Los Amigos): <b>initial contact</b>, <b>loading response</b>, <b>midstance</b>, <b>terminal stance</b> and <b>preswing</b>. Swing: <b>initial swing</b>, <b>midswing</b> and <b>terminal swing</b>. Older terms: heel strike, foot flat, midstance, heel off and toe off.',
        'Muscles: in loading response, <b>tibialis anterior</b> lowers the foot and the <b>quadriceps</b> control knee flexion (both eccentric), gluteus maximus and the hamstrings extend the hip and <b>gluteus medius</b> steadies the pelvis. From midstance, the <b>calf</b> controls the tibia moving forward, then pushes off. In swing, the hip flexors advance the leg, the dorsiflexors clear the toes and the hamstrings slow the leg in terminal swing.',
        'Typical walking ranges: the knee flexes about 15–20° in loading response and about 60° in swing; the ankle reaches about 10° dorsiflexion in stance and 15–20° plantarflexion at toe-off; the hip moves from about 30° flexion at contact to about 10° extension in terminal stance.',
        'Walking speed = step length × cadence. Running adds a <b>flight phase</b> and loses double support, and stance falls below half the cycle. Deviations: Trendelenburg gait (weak gluteus medius), foot slap or steppage gait (weak dorsiflexors), antalgic gait (short stance on a painful leg), backward trunk lean (weak gluteus maximus) and circumduction or vaulting (a functionally long leg).'],
      formulas: [{ n: 'Walking speed', t: String.raw`v = \text{step length} \times \text{cadence}` }],
      example: { p: 'A person walks at a cadence of 110 steps/min with a step length of 0.7 m. What is the walking speed in m/s?', s: 'v = 0.7 m × 110 steps/min = 77 m/min, and 77 ÷ 60 ≈ <b>1.28 m/s</b>, a typical adult walking speed.' },
      pitfalls: ['Mixing a step (one foot to the other) with a stride (the same foot twice, one full cycle).', 'Giving running a double-support phase. It has a flight phase instead.', 'Saying tibialis anterior works concentrically at heel contact. It lowers the foot eccentrically.'],
      tip: 'For each gait phase, ask what gravity or momentum is doing to each joint. The muscle that resists it is the one working, usually eccentrically.' }
  ];

  const UNITS = [
    { n: 1, title: 'Foundations and the axial skeleton', sections: ['terms', 'joints', 'tissue', 'levers', 'spine', 'trunk'], exam: 'exam1' },
    { n: 2, title: 'The upper extremity', sections: ['shoulder', 'elbow', 'wrist-hand'], exam: 'exam2' },
    { n: 3, title: 'Pelvis, hip, knee and ankle', sections: ['hip', 'knee', 'ankle'], exam: 'exam3' },
    { n: 4, title: 'The foot and gait', sections: ['foot', 'gait'], exam: 'final' }
  ];

  /* ---------- calendar from the tentative schedule ---------- */
  const addDays = (iso, n) => { const [y, m, dd] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); };
  /* [Monday of the week, type, title]; each lab section gets the row on its own day, and "all" gets a weekly reminder on Monday */
  const LAB_WEEKS = [
    ['2026-09-07', 'lab', 'Lab 1 · Axial skeleton anatomy review (pre-lab due; post-lab questions after)'],
    ['2026-09-14', 'lab', 'Lab 2 · Axial skeleton palpations and ROM (pre-lab due)'],
    ['2026-09-21', 'lab', 'Lab 3 · Axial skeleton functional'],
    ['2026-09-28', 'exam', 'Lab Practical 1 · Axial skeleton (Lab 3 write-up due)'],
    ['2026-10-05', 'lab', 'Lab 4 · Upper extremity anatomy review (pre-lab due; post-lab questions after)'],
    ['2026-10-12', 'lab', 'Lab 5 · Upper extremity palpations and ROM (pre-lab due)'],
    ['2026-10-19', 'lab', 'Lab 6 · Upper extremity functional'],
    ['2026-10-26', 'exam', 'Lab Practical 2 · Upper extremity (Lab 6 write-up due)'],
    ['2026-11-02', 'lab', 'Lab 7 · Lower extremity anatomy review (pre-lab due; post-lab questions after)'],
    ['2026-11-09', 'lab', 'Open lab week: all labs are open lab'],
    ['2026-11-16', 'lab', 'Lab 8 · Lower extremity palpations and ROM (pre-lab due)'],
    ['2026-11-30', 'lab', 'Lab 9 · Lower extremity functional'],
    ['2026-12-07', 'exam', 'Lab Practical 3 · Lower extremity (Lab 9 write-up due)']
  ];
  const SKIP = { '2026-09-07': 'Labor Day: no Monday lab (ask your GTA about making up Lab 1)', '2026-11-11': 'Veterans Day: no Wednesday labs' };
  const labRows = [];
  LAB_WEEKS.forEach(([mon, type, title]) => {
    labRows.push([mon, type, `${title}, this week at your lab time`, '', 'all']);
    LABS.forEach(l => { const day = addDays(mon, l.dow - 1); if (SKIP[day]) labRows.push([day, 'holiday', SKIP[day], '', l.id]); else labRows.push([day, type, title, '', l.id]); });
  });
  const CALENDAR = [
    ['2026-08-25', 'lecture', 'Intro to KIN 322', 'terms'], ['2026-08-27', 'lecture', 'Intro to KIN 322', 'levers'],
    ['2026-09-01', 'lecture', 'Joints and skeletal muscle review', 'joints'], ['2026-09-01', 'admin', 'Homework due: Chapter 1 review (end of class)'], ['2026-09-01', 'admin', 'Last day to add with MyInfo'],
    ['2026-09-03', 'lecture', 'Joints and skeletal muscle review', 'tissue'], ['2026-09-04', 'admin', 'Review Quiz 1 opens 8:00 am (10 min, closed book)'],
    ['2026-09-07', 'holiday', 'Labor Day, no classes'],
    ['2026-09-08', 'lecture', 'Axial skeleton', 'spine'], ['2026-09-08', 'admin', 'Homework due: Chapter 2, Axial part 1'], ['2026-09-08', 'admin', 'Review Quiz 1 due 5:00 pm'],
    ['2026-09-09', 'admin', 'Last day to add or drop online (MyInfo or Add/Drop form)'], ['2026-09-10', 'lecture', 'Axial skeleton', 'spine'],
    ['2026-09-15', 'lecture', 'Axial skeleton and spinal cord injury', 'trunk'], ['2026-09-15', 'admin', 'Homework due: Chapter 2, Axial part 2'], ['2026-09-16', 'admin', 'Last day to drop without a W'],
    ['2026-09-17', 'lecture', 'Axial skeleton and spinal cord injury', 'trunk'], ['2026-09-18', 'admin', 'Review Quiz 2 opens 8:00 am'], ['2026-09-21', 'admin', 'Review Quiz 2 due 5:00 pm'],
    ['2026-09-22', 'exam', 'Exam 1, part 1 (closed note) · in class'], ['2026-09-24', 'exam', 'Exam 1, part 2 (open note) · in class'], ['2026-09-24', 'lecture', 'Shoulder', 'shoulder'],
    ['2026-09-29', 'lecture', 'Shoulder', 'shoulder'], ['2026-09-29', 'admin', 'Homework due: Chapter 3, UE part 1'], ['2026-10-01', 'lecture', 'Shoulder', 'shoulder'],
    ['2026-10-06', 'lecture', 'Elbow', 'elbow'], ['2026-10-06', 'admin', 'Homework due: Chapter 3, UE part 2'], ['2026-10-08', 'lecture', 'Wrist', 'wrist-hand'],
    ['2026-10-13', 'lecture', 'Hand', 'wrist-hand'], ['2026-10-13', 'admin', 'Homework due: Chapter 3, UE part 3'], ['2026-10-15', 'lecture', 'Hand', 'wrist-hand'], ['2026-10-16', 'admin', 'Review Quiz 3 opens 8:00 am'], ['2026-10-19', 'admin', 'Review Quiz 3 due 5:00 pm'],
    ['2026-10-20', 'exam', 'Exam 2, part 1 (closed note) · in class'], ['2026-10-22', 'exam', 'Exam 2, part 2 (open note) · in class'], ['2026-10-22', 'lecture', 'Sacroiliac joint and hip', 'hip'],
    ['2026-10-27', 'lecture', 'Hip', 'hip'], ['2026-10-27', 'admin', 'Homework due: Chapter 4, LE part 1'], ['2026-10-29', 'lecture', 'Hip', 'hip'],
    ['2026-11-03', 'lecture', 'Knee', 'knee'], ['2026-11-03', 'admin', 'Homework due: Chapter 4, LE part 2'], ['2026-11-05', 'lecture', 'Knee', 'knee'],
    ['2026-11-10', 'lecture', 'Leg and ankle', 'ankle'], ['2026-11-11', 'holiday', 'Veterans Day, no classes'], ['2026-11-12', 'lecture', 'Leg and ankle', 'ankle'], ['2026-11-12', 'admin', 'Homework due: Chapter 4, LE part 3'], ['2026-11-13', 'admin', 'Review Quiz 4 opens 8:00 am'], ['2026-11-16', 'admin', 'Review Quiz 4 due 5:00 pm'],
    ['2026-11-17', 'exam', 'Exam 3, part 1 (closed note) · in class'], ['2026-11-18', 'admin', 'Last day to withdraw with a W'], ['2026-11-19', 'exam', 'Exam 3, part 2 (open note) · in class'], ['2026-11-19', 'lecture', 'Ankle and foot', 'ankle'],
    ['2026-11-24', 'holiday', 'Thanksgiving break, no class'], ['2026-11-26', 'holiday', 'Thanksgiving, no class'],
    ['2026-12-01', 'lecture', 'Foot', 'foot'], ['2026-12-01', 'admin', 'Homework due: Chapter 4, LE part 4'], ['2026-12-01', 'admin', 'Homework binder check this week or next (needed to use it on the final)'], ['2026-12-03', 'lecture', 'Foot', 'foot'],
    ['2026-12-08', 'lecture', 'Gait', 'gait'], ['2026-12-10', 'review', 'Review for the final'], ['2026-12-11', 'admin', 'Review Quiz 5 opens 8:00 am'], ['2026-12-14', 'admin', 'Review Quiz 5 due 5:00 pm'],
    ['2026-12-15', 'exam', 'Final exam · 8:00–9:50 am (cumulative; closed- and open-note parts)']
  ].concat(labRows).sort((a, b) => a[0].localeCompare(b[0]));
  const CALENDAR_NOTE = 'Lectures are Tue/Thu in Lewis 304; labs meet in Harrison 101A. Pick your lab section in Settings to put labs and lab practicals on your day. The schedule is tentative: changes are announced in class and on Canvas.';
  const RECURRING = [{ dows: [2, 4], time: 'in class', title: 'i>clicker review questions', from: '2026-08-25', skipHolidays: true, quiet: true }];
  const FORMAT = 'Two parts in class: a closed-note part on Tuesday (multiple choice, true/false, matching and structure identification) and an open-note part on Thursday (short answer; your completed homework is allowed). Cumulative, and it cannot be rescheduled.';
  const EXAMS = [
    { id: 'exam1', n: 1, name: 'Exam 1', date: '2026-09-22', endDate: '2026-09-24', dateLabel: 'Tue Sept 22 (closed note) and Thu Sept 24 (open note), in class', covers: 'terms, planes and axes, joints, tissue and muscle mechanics, levers, the vertebral column, trunk muscles and spinal cord injury', sections: ['terms', 'joints', 'tissue', 'levers', 'spine', 'trunk'], units: [1], weight: 10, format: FORMAT },
    { id: 'exam2', n: 2, name: 'Exam 2', date: '2026-10-20', endDate: '2026-10-22', dateLabel: 'Tue Oct 20 (closed note) and Thu Oct 22 (open note), in class', covers: 'everything so far, with emphasis on the shoulder complex, elbow and forearm, wrist and hand', sections: ['terms', 'joints', 'tissue', 'levers', 'spine', 'trunk', 'shoulder', 'elbow', 'wrist-hand'], units: [1, 2], weight: 10, cumulative: true, format: FORMAT },
    { id: 'exam3', n: 3, name: 'Exam 3', date: '2026-11-17', endDate: '2026-11-19', dateLabel: 'Tue Nov 17 (closed note) and Thu Nov 19 (open note), in class', covers: 'everything so far, with emphasis on the pelvis, sacroiliac joint, hip, knee, leg and ankle', sections: ['terms', 'joints', 'tissue', 'levers', 'spine', 'trunk', 'shoulder', 'elbow', 'wrist-hand', 'hip', 'knee', 'ankle'], units: [1, 2, 3], weight: 10, cumulative: true, format: FORMAT },
    { id: 'final', n: 4, name: 'Final exam', date: '2026-12-15', dateLabel: 'Tue Dec 15 · 8:00–9:50 am', covers: 'the whole course, including the foot and gait', sections: ['terms', 'joints', 'tissue', 'levers', 'spine', 'trunk', 'shoulder', 'elbow', 'wrist-hand', 'hip', 'knee', 'ankle', 'foot', 'gait'], units: [1, 2, 3, 4], weight: 15, cumulative: true, format: 'Closed-note and open-note parts, like Exams 1–3, in one sitting at the university’s scheduled time. Your homework binder must be signed off in week 14 or 15 to use it.' }
  ];
  const CHECKLISTS = {
    exam1: ['Name the plane and axis for any movement, on yourself', 'Classify joints structurally and functionally, with an example of each synovial type', 'Apply the convex–concave rule to a joint you choose', 'Sketch a stress–strain curve and label its regions', 'Explain length–tension, force–velocity and active vs passive insufficiency', 'Decide concentric or eccentric, and which muscle, for a movement with gravity', 'Classify levers and solve a torque-balance problem', 'Compare cervical, thoracic and lumbar vertebrae and their facet orientation', 'List the trunk muscles with actions, and the key muscles from C5 to S1', 'Bring your homework to the open-note part'],
    exam2: ['Everything on the Exam 1 list (the exam is cumulative)', 'Name the four joints of the shoulder complex and the SITS muscles', 'Explain scapulohumeral rhythm and the upward-rotation force couple', 'Give the actions of trapezius (3 parts), rhomboids, levator scapulae, serratus anterior', 'Rank elbow flexors by forearm position', 'List carpals in order and the contents of the carpal tunnel', 'Match nerve injuries to wrist drop, claw hand and ape hand', 'Review Lab 4–6 palpation landmarks and ROM norms'],
    exam3: ['Everything on the first two lists (the exam is cumulative)', 'Describe nutation, pelvic tilt and lumbopelvic rhythm', 'State the angle of inclination and anteversion, and what vara/valga mean', 'Explain the Trendelenburg sign (which side is weak)', 'Name each knee ligament by the translation it stops', 'Explain the screw-home mechanism and the popliteus', 'Match leg compartments to muscles, actions and nerves', 'Explain why the ATFL is the most sprained ligament'],
    final: ['Retake one quizzer set per unit', 'Name the tarsals and the three arches and what supports them', 'Explain the windlass mechanism', 'Label the eight gait phases with the main muscle action in each', 'Compute walking speed from step length and cadence', 'Match gait deviations to the weak muscle', 'Get your homework binder signed off before the final']
  };
  const GRADING = {
    categories: [
      { id: 'hw', name: 'Homework', weight: 20 },
      { id: 'quizzes', name: 'Review quizzes (5)', weight: 10 },
      { id: 'exam1', name: 'Exam 1', weight: 10 },
      { id: 'exam2', name: 'Exam 2', weight: 10 },
      { id: 'exam3', name: 'Exam 3', weight: 10 },
      { id: 'final', name: 'Final exam', weight: 15 },
      { id: 'labs', name: 'Lab activities (pre-labs, labs, post-labs)', weight: 15 },
      { id: 'labexams', name: 'Lab practical exams (3)', weight: 10 }
    ],
    finalId: 'final',
    options: [
      { label: 'Option 1 (normal grading): 10 / 10 / 10 / 15', weights: { exam1: 10, exam2: 10, exam3: 10, final: 15 } },
      { label: 'Option 2: 0 / 10 / 15 / 20', weights: { exam1: 0, exam2: 10, exam3: 15, final: 20 } },
      { label: 'Option 3: 10 / 0 / 15 / 20', weights: { exam1: 10, exam2: 0, exam3: 15, final: 20 } },
      { label: 'Option 4: 10 / 10 / 0 / 25', weights: { exam1: 10, exam2: 10, exam3: 0, final: 25 } },
      { label: 'Option 5: 0 / 0 / 20 / 25', weights: { exam1: 0, exam2: 0, exam3: 20, final: 25 } },
      { label: 'Option 6: 0 / 0 / 0 / 45', weights: { exam1: 0, exam2: 0, exam3: 0, final: 45 } }
    ],
    note: 'Exams are cumulative, so the syllabus lets later exams count for more (six options for Exam 1 / Exam 2 / Exam 3 / Final). The calculator tries all six and uses the one that gives you the highest grade. Lecture work is 75% of the course and lab work 25%.',
    scale: [{ letter: 'A', min: 93 }, { letter: 'A-', min: 90 }, { letter: 'B+', min: 87 }, { letter: 'B', min: 83 }, { letter: 'B-', min: 80 }, { letter: 'C+', min: 77 }, { letter: 'C', min: 73 }, { letter: 'C-', min: 70 }, { letter: 'D+', min: 67 }, { letter: 'D', min: 63 }, { letter: 'D-', min: 60 }, { letter: 'F', min: 0 }]
  };

  /* ---------- formula and key-term sheet ---------- */
  const R = String.raw; const d = (n, def) => ({ n, d: def }); const t = (n, tex) => ({ n, t: tex });
  const FORMULAS = [
    { group: 'Planes and axes', items: [d('Sagittal plane', 'Mediolateral axis: flexion/extension, dorsiflexion/plantarflexion'), d('Frontal plane', 'Anteroposterior axis: abduction/adduction, lateral flexion, radial/ulnar deviation'), d('Transverse plane', 'Longitudinal axis: medial/lateral rotation, pronation/supination, horizontal abduction/adduction'), d('Degrees of freedom', 'Hinge and pivot 1 · condyloid and saddle 2 · ball-and-socket 3')] },
    { group: 'Biomechanics', items: [t('Torque', R`\tau = F \cdot d_{\perp}`), t('Rotational equilibrium', R`\sum \tau = 0`), t('Mechanical advantage', R`\text{MA} = d_{\text{effort}} / d_{\text{resistance}}`), d('Lever classes (ARE 1-2-3)', 'Middle item: Axis (1st), Resistance (2nd), Effort (3rd). Most muscles are 3rd class (MA < 1)'), t('Stress and strain', R`\sigma = F/A,\quad \varepsilon = \Delta L / L_0`), d('Contraction types', 'Concentric (shortens) · eccentric (lengthens, controls lowering) · isometric (no length change)')] },
    { group: 'Joint mechanics', items: [d('Convex–concave rule', 'Convex on concave: roll and glide opposite. Concave on convex: same direction'), d('Close-packed positions', 'Glenohumeral: abduction + lateral rotation · humeroulnar: extension · wrist: extension · hip: extension + medial rotation + abduction · knee: full extension · ankle: dorsiflexion'), t('Scapulohumeral rhythm', R`\text{GH} : \text{ST} \approx 2 : 1\ (120^\circ + 60^\circ)`), d('Hip angles', 'Inclination about 125° (coxa vara smaller, valga larger) · anteversion about 15°'), d('Knee', 'Q-angle about 10–15° · screw-home: tibia rotates laterally in the last 20–30° of extension; popliteus unlocks')] },
    { group: 'Normal ROM (AAOS values; sources vary)', items: [d('Shoulder', 'Flexion 180 · extension 60 · abduction 180 · medial rotation 70 · lateral rotation 90'), d('Elbow and forearm', 'Flexion 150 · pronation 80 · supination 80'), d('Wrist', 'Flexion 80 · extension 70 · radial deviation 20 · ulnar deviation 30'), d('Hip', 'Flexion 120 · extension 30 · abduction 45 · adduction 30 · medial and lateral rotation 45'), d('Knee and ankle', 'Knee flexion 135 · dorsiflexion 20 · plantarflexion 50 · inversion 35 · eversion 15')] },
    { group: 'Nerves', items: [d('Brachial plexus', 'Musculocutaneous: elbow flexors · axillary: deltoid, teres minor · radial: elbow, wrist and finger extensors · median: pronators, most forearm flexors, thenar · ulnar: FCU, most hand intrinsics'), d('Lumbosacral plexus', 'Femoral: quadriceps · obturator: adductors · superior gluteal: gluteus medius and minimus, TFL · inferior gluteal: gluteus maximus · sciatic → tibial (plantarflexors, invertors) and common fibular (deep: dorsiflexors; superficial: evertors)'), d('Key muscles (SCI)', 'C5 elbow flexors · C6 wrist extensors · C7 elbow extensors · C8 finger flexors · T1 finger abductors · L2 hip flexors · L3 knee extensors · L4 dorsiflexors · L5 toe extensors · S1 plantarflexors')] },
    { group: 'Gait', items: [d('Timing', 'Stance about 60% · swing about 40% · two double-support periods of about 10%'), d('Phases', 'Initial contact, loading response, midstance, terminal stance, preswing | initial swing, midswing, terminal swing'), t('Walking speed', R`v = \text{step length} \times \text{cadence}`), d('Stride vs step', 'Stride = same foot to same foot (one cycle) = two steps')] }
  ];

  /* ---------- flashcards ---------- */
  const fc = (id, unit, sec, f, b) => ({ id, unit, sec, f, b });
  const FLASHCARDS = [
    fc('k-anatpos', 1, 'terms', 'Describe anatomical position.', 'Standing upright, facing forward, arms at the sides with palms forward, feet parallel.'),
    fc('k-sag', 1, 'terms', 'Which plane and axis go with flexion and extension?', 'Sagittal plane, mediolateral (frontal) axis.'),
    fc('k-front', 1, 'terms', 'Which plane and axis go with abduction and adduction?', 'Frontal plane, anteroposterior (sagittal) axis.'),
    fc('k-trans', 1, 'terms', 'Which plane and axis go with rotation?', 'Transverse plane, longitudinal (vertical) axis.'),
    fc('k-kinematics', 1, 'terms', 'Kinematics vs kinetics?', 'Kinematics describes motion; kinetics studies the forces and torques that cause it.'),
    fc('k-chain', 1, 'terms', 'Open vs closed kinetic chain?', 'Open: the distal segment moves freely (leg extension). Closed: the distal segment is fixed (squat).'),
    fc('k-osteo', 1, 'terms', 'Osteokinematics vs arthrokinematics?', 'Osteokinematics: bone motion through planes. Arthrokinematics: roll, glide and spin between joint surfaces.'),
    fc('k-structclass', 1, 'joints', 'Three structural joint classes, with an example each?', 'Fibrous (sutures), cartilaginous (pubic symphysis, discs), synovial (knee).'),
    fc('k-sixtypes', 1, 'joints', 'Six synovial joint types?', 'Plane, hinge, pivot, condyloid, saddle, ball-and-socket.'),
    fc('k-saddle', 1, 'joints', 'Example of a saddle joint?', 'Thumb carpometacarpal (and the sternoclavicular joint).'),
    fc('k-convex', 1, 'joints', 'Convex–concave rule?', 'Convex on concave: roll and glide in opposite directions. Concave on convex: same direction.'),
    fc('k-closepack', 1, 'joints', 'What is the close-packed position?', 'Maximal congruence and taut ligaments: most stable, least joint play.'),
    fc('k-stress', 1, 'tissue', 'Stress and strain?', 'Stress = force ÷ area. Strain = change in length ÷ original length.'),
    fc('k-creep', 1, 'tissue', 'Creep vs stress relaxation?', 'Creep: lengthening under a constant load. Stress relaxation: falling stress at a constant length.'),
    fc('k-wolff', 1, 'tissue', 'Wolff’s law?', 'Bone remodels to the loads placed on it: more load, stronger bone; disuse weakens it.'),
    fc('k-pennate', 1, 'tissue', 'Why can pennate muscles make more force?', 'Angled fibers pack more fibers in, raising the physiological cross-sectional area.'),
    fc('k-activeins', 1, 'tissue', 'Active insufficiency?', 'A two-joint muscle shortened across both joints cannot make much force (weak fist with the wrist flexed).'),
    fc('k-passiveins', 1, 'tissue', 'Passive insufficiency?', 'A two-joint muscle cannot stretch across both joints at once (hamstrings limit hip flexion with the knee straight).'),
    fc('k-eccentric', 1, 'tissue', 'Which muscle controls lowering into a squat, and how?', 'The quadriceps, eccentrically.'),
    fc('k-torque', 1, 'levers', 'Torque formula?', 'τ = F × perpendicular distance from the axis (moment arm).'),
    fc('k-levers', 1, 'levers', 'Lever classes (ARE 1-2-3)?', 'Middle item: Axis for 1st class, Resistance for 2nd, Effort for 3rd.'),
    fc('k-biceps-lever', 1, 'levers', 'Lever class of the biceps at the elbow?', 'Third class: the effort (insertion) lies between the axis (elbow) and the load (hand).'),
    fc('k-ma', 1, 'levers', 'Mechanical advantage of a third-class lever?', 'Less than 1: it favors speed and range of motion over force.'),
    fc('k-vert-count', 1, 'spine', 'How many cervical, thoracic and lumbar vertebrae?', '7, 12 and 5.'),
    fc('k-atlas', 1, 'spine', 'Motions at the atlanto-occipital and atlantoaxial joints?', 'Atlanto-occipital: flexion/extension (“yes”). Atlantoaxial: rotation (“no”).'),
    fc('k-disc', 1, 'spine', 'Parts of the intervertebral disc?', 'Nucleus pulposus (gel center) and annulus fibrosus (collagen rings).'),
    fc('k-lumbar-facets', 1, 'spine', 'Why do lumbar facets limit rotation?', 'They lie near the sagittal plane, allowing flexion/extension but blocking rotation.'),
    fc('k-all', 1, 'spine', 'Which ligament limits spinal extension?', 'The anterior longitudinal ligament.'),
    fc('k-curves', 1, 'spine', 'Primary vs secondary spinal curves?', 'Primary (at birth): thoracic and sacral kyphosis. Secondary: cervical and lumbar lordosis.'),
    fc('k-obliques', 1, 'trunk', 'Rotation by the obliques?', 'External oblique: rotation to the opposite side. Internal oblique: to the same side.'),
    fc('k-scm', 1, 'trunk', 'Right sternocleidomastoid acting alone?', 'Lateral flexion to the right and rotation of the face to the left.'),
    fc('k-ta', 1, 'trunk', 'What does transversus abdominis do?', 'Compresses the abdomen and stiffens the spine; it does not move the trunk.'),
    fc('k-cordend', 1, 'trunk', 'Where does the spinal cord end?', 'Near L1–L2 (conus medullaris); the cauda equina continues below.'),
    fc('k-phrenic', 1, 'trunk', 'Which cord levels supply the diaphragm?', 'C3, C4 and C5 (the phrenic nerve).'),
    fc('k-keymuscles', 1, 'trunk', 'Key muscles C5, C6, C7?', 'C5 elbow flexors, C6 wrist extensors, C7 elbow extensors.'),
    fc('k-sits', 2, 'shoulder', 'Rotator cuff muscles and actions?', 'Supraspinatus (starts abduction), infraspinatus and teres minor (lateral rotation), subscapularis (medial rotation).'),
    fc('k-rhythm', 2, 'shoulder', 'Scapulohumeral rhythm?', 'About 2° glenohumeral to 1° scapular: 120° + 60° = 180° of elevation.'),
    fc('k-upward', 2, 'shoulder', 'Upward-rotation force couple of the scapula?', 'Upper and lower trapezius with serratus anterior.'),
    fc('k-winging', 2, 'shoulder', 'Scapular winging suggests which injury?', 'Serratus anterior weakness, often from long thoracic nerve injury.'),
    fc('k-shjoints', 2, 'shoulder', 'The four joints of the shoulder complex?', 'Sternoclavicular, acromioclavicular, glenohumeral and scapulothoracic.'),
    fc('k-deltoid', 2, 'shoulder', 'Actions of the three parts of the deltoid?', 'Anterior: flexion, medial rotation. Middle: abduction. Posterior: extension, lateral rotation.'),
    fc('k-lats', 2, 'shoulder', 'Latissimus dorsi actions?', 'Shoulder extension, adduction and medial rotation.'),
    fc('k-brachialis', 2, 'elbow', 'Which elbow flexor works in every forearm position?', 'Brachialis: it inserts on the ulna, so forearm rotation does not affect it.'),
    fc('k-supinator', 2, 'elbow', 'Strongest supinator?', 'Biceps brachii, especially with the elbow at 90°.'),
    fc('k-carrying', 2, 'elbow', 'Normal carrying angle?', 'About 10–15° of valgus.'),
    fc('k-ucl', 2, 'elbow', 'Which elbow ligament resists valgus stress?', 'The ulnar (medial) collateral ligament.'),
    fc('k-annular', 2, 'elbow', 'Role of the annular ligament?', 'Holds the radial head against the ulna at the proximal radioulnar joint.'),
    fc('k-tennis', 2, 'elbow', 'Tennis vs golfer’s elbow?', 'Tennis: lateral epicondyle, wrist extensors. Golfer’s: medial epicondyle, flexor–pronators.'),
    fc('k-carpals', 2, 'wrist-hand', 'Carpals, proximal then distal row (lateral to medial)?', 'Scaphoid, lunate, triquetrum, pisiform; trapezium, trapezoid, capitate, hamate.'),
    fc('k-scaphoid', 2, 'wrist-hand', 'Most often fractured carpal?', 'Scaphoid (snuffbox pain; risk of avascular necrosis).'),
    fc('k-tunnel', 2, 'wrist-hand', 'Contents of the carpal tunnel?', 'Median nerve plus 9 tendons: 4 FDS, 4 FDP and FPL.'),
    fc('k-fdp', 2, 'wrist-hand', 'FDS vs FDP?', 'FDS flexes the PIP joints; FDP is the only muscle that flexes the DIP joints.'),
    fc('k-padab', 2, 'wrist-hand', 'PAD and DAB?', 'Palmar interossei adduct; dorsal interossei abduct the fingers (ulnar nerve).'),
    fc('k-wristdrop', 2, 'wrist-hand', 'Wrist drop comes from which nerve?', 'Radial nerve.'),
    fc('k-si', 3, 'hip', 'Nutation?', 'The sacral base tips forward (anteriorly) relative to the ilia.'),
    fc('k-inclination', 3, 'hip', 'Normal adult angle of inclination?', 'About 125°. Smaller: coxa vara. Larger: coxa valga.'),
    fc('k-yligament', 3, 'hip', 'What does the iliofemoral ligament limit?', 'Hip extension (it is the strongest hip ligament).'),
    fc('k-trendelenburg', 3, 'hip', 'Trendelenburg sign?', 'The pelvis drops on the swing side because the stance-side gluteus medius is weak.'),
    fc('k-glutenerves', 3, 'hip', 'Nerves to gluteus maximus and gluteus medius?', 'Inferior gluteal (maximus); superior gluteal (medius and minimus).'),
    fc('k-hipflex', 3, 'hip', 'Primary hip flexor?', 'Iliopsoas.'),
    fc('k-acl', 3, 'knee', 'What does the ACL prevent?', 'Anterior translation of the tibia on the femur (and it limits hyperextension and rotation).'),
    fc('k-pcl', 3, 'knee', 'What does the PCL prevent?', 'Posterior translation of the tibia on the femur.'),
    fc('k-triad', 3, 'knee', 'The “unhappy triad”?', 'ACL, MCL and medial meniscus.'),
    fc('k-screwhome', 3, 'knee', 'Screw-home mechanism?', 'The tibia rotates laterally in the last 20–30° of extension, locking the knee; popliteus unlocks it.'),
    fc('k-pes', 3, 'knee', 'Pes anserinus muscles?', 'Sartorius, gracilis, semitendinosus (“Say Grace before Tea”).'),
    fc('k-qangle', 3, 'knee', 'Normal Q-angle?', 'About 10–15°.'),
    fc('k-atfl', 3, 'ankle', 'Most often sprained ankle ligament?', 'Anterior talofibular ligament (plantarflexion + inversion).'),
    fc('k-subtalar', 3, 'ankle', 'Where do inversion and eversion mainly happen?', 'The subtalar joint.'),
    fc('k-pronation', 3, 'ankle', 'Open-chain pronation of the foot?', 'Dorsiflexion + eversion + abduction.'),
    fc('k-tomdick', 3, 'ankle', 'Tendons behind the medial malleolus?', 'Tibialis posterior, flexor digitorum longus, flexor hallucis longus (“Tom, Dick and Harry”).'),
    fc('k-soleus', 3, 'ankle', 'How do you stretch the soleus rather than the gastrocnemius?', 'Dorsiflex with the knee bent, which slackens the gastrocnemius.'),
    fc('k-footdrop', 3, 'ankle', 'Foot drop comes from which nerve?', 'Common (deep) fibular nerve, often injured at the fibular head.'),
    fc('k-tarsals', 4, 'foot', 'The seven tarsals?', 'Talus, calcaneus, navicular, cuboid and three cuneiforms.'),
    fc('k-windlass', 4, 'foot', 'Windlass mechanism?', 'Toe extension tightens the plantar fascia, raising the arch and stiffening the foot for push-off.'),
    fc('k-midtarsal', 4, 'foot', 'Transverse tarsal joint?', 'Talonavicular + calcaneocuboid joints: flexible when pronated, locked when supinated.'),
    fc('k-arches', 4, 'foot', 'The three arches of the foot?', 'Medial longitudinal, lateral longitudinal and transverse.'),
    fc('k-stance', 4, 'gait', 'Stance and swing percentages in walking?', 'About 60% stance and 40% swing.'),
    fc('k-phases', 4, 'gait', 'The five stance phases?', 'Initial contact, loading response, midstance, terminal stance, preswing.'),
    fc('k-stride', 4, 'gait', 'Step vs stride?', 'Step: one foot to the other. Stride: the same foot to the same foot (one cycle, two steps).'),
    fc('k-running', 4, 'gait', 'How does running differ from walking?', 'It has a flight phase and no double support; stance is under half the cycle.'),
    fc('k-tibant-gait', 4, 'gait', 'What does tibialis anterior do at loading response?', 'Lowers the foot to the ground eccentrically.')
  ];

  /* ---------- exam practice ---------- */
  const P = (n, sec, q, s) => ({ n, sec, tags: [sec], q, s });
  const PRACTICE = {
    exam1: { title: 'Exam 1 practice', subtitle: 'Foundations and the axial skeleton. Answer aloud, then reveal.', problems: [
      P(1, 'terms', 'Name the plane and axis for: (a) nodding “yes”, (b) turning the head “no”, (c) a jumping jack at the shoulders.', '(a) Sagittal plane, mediolateral axis. (b) Transverse plane, longitudinal axis. (c) Frontal plane, anteroposterior axis.'),
      P(2, 'joints', 'Classify these joints by structure and synovial type: humeroulnar, pubic symphysis, thumb CMC, proximal radioulnar, intercarpal.', 'Humeroulnar: synovial hinge. Pubic symphysis: cartilaginous (symphysis). Thumb CMC: synovial saddle. Proximal radioulnar: synovial pivot. Intercarpal: synovial plane.'),
      P(3, 'joints', 'In open-chain knee extension, which way does the tibia glide on the femur? Justify with the convex–concave rule.', 'The concave tibia moves on the convex femur, so it rolls and glides in the <b>same direction: anteriorly</b>.'),
      P(4, 'tissue', 'During the lowering phase of a push-up, which muscle group controls the elbows and how?', 'The elbows flex under gravity, so the <b>triceps</b> (elbow extensors) contract <b>eccentrically</b>.'),
      P(5, 'tissue', 'Why is it hard to make a tight fist with the wrist fully flexed?', '<b>Active insufficiency</b>: the finger flexors are already shortened across the wrist, so they cannot shorten enough to make much force at the fingers. (The finger extensors may also be passively stretched.)'),
      P(6, 'levers', 'A 40 N load is held 0.35 m from the elbow with the forearm horizontal. The biceps inserts 0.05 m from the elbow. Find the biceps force (ignore the forearm) and the mechanical advantage.', 'F × 0.05 = 40 × 0.35 → F = <b>280 N</b>. MA = 0.05 ÷ 0.35 ≈ <b>0.14</b> (a third-class lever).'),
      P(7, 'spine', 'Give one feature that identifies a cervical, a thoracic and a lumbar vertebra.', 'Cervical: transverse foramina (and bifid spines). Thoracic: costal facets for the ribs. Lumbar: large bodies with short, square spinous processes.'),
      P(8, 'trunk', 'After a complete injury with C7 as the lowest intact level, which of these can the person do: flex the elbows, extend the elbows, flex the fingers?', 'C5 and C7 are intact, so elbow flexion and extension <b>work</b>. C8 (finger flexors) is below the level, so finger flexion is <b>lost</b>.')
    ] },
    exam2: { title: 'Exam 2 practice', subtitle: 'Cumulative, with emphasis on the upper extremity.', problems: [
      P(1, 'shoulder', 'Name the rotator cuff muscles, their actions and why the cuff matters during abduction.', 'Supraspinatus (starts abduction), infraspinatus and teres minor (lateral rotation), subscapularis (medial rotation). The cuff presses and depresses the humeral head so the deltoid can abduct without jamming the head into the acromion.'),
      P(2, 'shoulder', 'How many degrees of scapular upward rotation go with 150° of shoulder elevation, using a 2:1 rhythm?', 'One third of the total: 150 ÷ 3 = <b>50°</b> scapular, with 100° glenohumeral.'),
      P(3, 'shoulder', 'A patient’s scapula wings when pushing against a wall. Which muscle and nerve are suspected?', 'Serratus anterior, supplied by the <b>long thoracic nerve</b>.'),
      P(4, 'elbow', 'Rank biceps, brachialis and brachioradialis as elbow flexors with the forearm pronated, and explain.', 'Brachialis works regardless of forearm position; brachioradialis is strong near midposition; biceps is weakest when pronated because its tendon wraps around the radius.'),
      P(5, 'wrist-hand', 'List the proximal-row carpals lateral to medial and name the one most often fractured.', 'Scaphoid, lunate, triquetrum, pisiform. The <b>scaphoid</b> is most often fractured.'),
      P(6, 'wrist-hand', 'A person cannot extend the wrist after a fracture of the humeral shaft. Which nerve, and what is this called?', 'The <b>radial nerve</b> (it spirals along the humeral shaft). The result is <b>wrist drop</b>.'),
      P(7, 'levers', 'Cumulative: a physical therapist applies 60 N resistance 0.25 m from the knee. What knee-extensor torque must the patient produce to hold still?', '60 × 0.25 = <b>15 N·m</b>.')
    ] },
    exam3: { title: 'Exam 3 practice', subtitle: 'Cumulative, with emphasis on the pelvis, hip, knee and ankle.', problems: [
      P(1, 'hip', 'During right single-leg stance the left side of the pelvis drops. Which muscle is weak?', 'The <b>right gluteus medius</b> (stance side).'),
      P(2, 'hip', 'What are coxa vara and coxa valga, and what is the normal angle of inclination?', 'Normal is about <b>125°</b>. Coxa vara: a smaller angle. Coxa valga: a larger angle.'),
      P(3, 'knee', 'Which ligament is tested when the tibia is pushed backward on the femur, and what injury classically tears it?', 'The <b>PCL</b>; a dashboard injury (the tibia is driven backward with the knee flexed).'),
      P(4, 'knee', 'Explain the screw-home mechanism in open and closed chain.', 'In the last 20–30° of extension the tibia rotates <b>laterally</b> on the femur (open chain) or the femur rotates <b>medially</b> on the tibia (closed chain), locking the knee. The popliteus unlocks it.'),
      P(5, 'ankle', 'Match each compartment to an action and a nerve: anterior, lateral, posterior.', 'Anterior: dorsiflexion, deep fibular. Lateral: eversion, superficial fibular. Posterior: plantarflexion and inversion, tibial.'),
      P(6, 'ankle', 'Why are lateral ankle sprains much more common than medial ones?', 'The lateral ligaments (especially the ATFL) are weaker than the deltoid ligament, and the lateral malleolus extends farther down so inversion has more room; injuries happen in plantarflexion, when the talus sits loosely in the mortise.'),
      P(7, 'shoulder', 'Cumulative: which three muscles form the upward-rotation force couple of the scapula?', 'Upper trapezius, lower trapezius and serratus anterior.')
    ] },
    final: { title: 'Final exam practice', subtitle: 'The whole course, including the foot and gait.', problems: [
      P(1, 'foot', 'Name the seven tarsals.', 'Talus, calcaneus, navicular, cuboid, and the medial, intermediate and lateral cuneiforms.'),
      P(2, 'foot', 'Explain the windlass mechanism and when it happens in gait.', 'At terminal stance and preswing the toes extend, tightening the plantar fascia around the metatarsal heads; the arch rises and the foot becomes a rigid lever for push-off.'),
      P(3, 'gait', 'What percentage of the gait cycle is stance at normal walking speed, and how many double-support periods are there?', 'About <b>60%</b>, with <b>two</b> double-support periods of about 10% each.'),
      P(4, 'gait', 'Step length 0.75 m, cadence 104 steps/min. Walking speed in m/s?', '0.75 × 104 = 78 m/min = <b>1.3 m/s</b>.'),
      P(5, 'gait', 'A patient’s foot slaps down right after heel contact. Which muscle and nerve?', 'Weak <b>tibialis anterior</b> (and other dorsiflexors), deep fibular nerve (often a common fibular nerve injury).'),
      P(6, 'terms', 'Cumulative: name the plane and axis of forearm pronation and of hip abduction.', 'Pronation: transverse plane, longitudinal axis. Hip abduction: frontal plane, anteroposterior axis.'),
      P(7, 'trunk', 'Cumulative: why can an injury at C4 be life-threatening?', 'C3–C5 supply the diaphragm through the phrenic nerve, so breathing may be impaired.')
    ] }
  };

  const INFO = [
    { icon: 'info', title: 'Course facts', html: `<ul class="list-plain small">
        <li><b>Lectures:</b> Tue · Thu 9:25–10:40 am, Lewis 304. <b>Labs:</b> Harrison 101A (Mon 12:10; Tue 11:00; Wed 8:00, 10:00 or 12:00; Thu 11:00).</li>
        <li><b>Instructor:</b> Jim Becker, PhD, <a href="mailto:james.becker4@montana.edu">james.becker4@montana.edu</a>, Student Wellness Center 0225. Office hours Fri 10–noon in Harrison 101A, or by appointment.</li>
        <li><b>GTAs:</b> Morgan Koskela (<a href="mailto:morgan.koskela@montana.edu">morgan.koskela@montana.edu</a>), Mae Whitcomb (<a href="mailto:charlotte.whitcomb@montana.edu">charlotte.whitcomb@montana.edu</a>), Nico Paletti (<a href="mailto:nicola.paletti@montana.edu">nicola.paletti@montana.edu</a>). Their open-lab times are TBA.</li>
        <li><b>Prerequisite:</b> BIOH 201 or KIN 221, and M core (or instructor permission).</li>
        <li><b>Required:</b> an i&gt;clicker for daily review questions and a 3-ring binder for homework. <b>Suggested:</b> Biel’s <i>Trail Guide to the Body</i> (5th–7th ed.) and <i>Trail Guide to Movement</i>, and the Thieme <i>Atlas of Anatomy</i>; copies are in lab. Colored pencils and a clipboard help in lab.</li>
        <li>4 credits (3 lecture, 1 lab).</li></ul>` },
    { icon: 'flask', title: 'Labs', html: `<ul class="list-plain small"><li><b>Pre-labs</b> are due before lab, <b>lab questions</b> at the end of lab (hard copy or Canvas), and <b>post-labs</b> after the functional labs, before the next practical.</li><li>Three <b>lab practicals</b> (axial, upper extremity, lower extremity): in pairs, you palpate listed structures and measure range of motion for the instructor or a GTA.</li><li>Missing a lab for a documented reason? Contact the instructor and your GTA to set up a make-up.</li></ul>` },
    { icon: 'calc', title: 'Grading', html: `<div class="table-wrap"><table class="table compact"><thead><tr><th>Item</th><th class="num">Weight</th></tr></thead><tbody><tr><td>Homework</td><td class="num">20%</td></tr><tr><td>Review quizzes (5)</td><td class="num">10%</td></tr><tr><td>Exams 1–3 and final</td><td class="num">45%</td></tr><tr><td>Lab activities</td><td class="num">15%</td></tr><tr><td>Lab practicals (3)</td><td class="num">10%</td></tr></tbody></table></div><p class="small mt-1">A 93+, A− 90, B+ 87, B 83, B− 80, C+ 77, C 73, C− 70, D+ 67, D 63, D− 60.</p>` },
    { icon: 'flag', title: 'Exams and grading options', html: `<p class="small">Each exam has a closed-note part (multiple choice, true/false, matching, structure ID) and an open-note short-answer part where your completed homework is allowed. All exams are cumulative, so you may count later exams more:</p><div class="table-wrap"><table class="table compact"><thead><tr><th>Option</th><th class="num">E1</th><th class="num">E2</th><th class="num">E3</th><th class="num">Final</th></tr></thead><tbody><tr><td>1 (normal)</td><td class="num">10</td><td class="num">10</td><td class="num">10</td><td class="num">15</td></tr><tr><td>2</td><td class="num">0</td><td class="num">10</td><td class="num">15</td><td class="num">20</td></tr><tr><td>3</td><td class="num">10</td><td class="num">0</td><td class="num">15</td><td class="num">20</td></tr><tr><td>4</td><td class="num">10</td><td class="num">10</td><td class="num">0</td><td class="num">25</td></tr><tr><td>5</td><td class="num">0</td><td class="num">0</td><td class="num">20</td><td class="num">25</td></tr><tr><td>6</td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="num">45</td></tr></tbody></table></div><p class="small mt-1">Exams are taken in class and cannot be rescheduled. See the exam breakdowns on Canvas for the content and question counts.</p>` },
    { icon: 'list', title: 'Homework and quizzes', html: `<ul class="list-plain small"><li>Homework prepares you for each week’s lecture. Hand-write or type it, and turn it in on Canvas by the end of class on the due day.</li><li>Keep it all in a 3-ring binder. It is checked in week 14 or 15, and you need that sign-off to use it on the final.</li><li>Review quizzes open Friday 8:00 am and close Monday 5:00 pm: 10 minutes, closed book and closed note.</li></ul>` },
    { icon: 'shield', title: 'Integrity', html: `<p class="small">Collaboration is <b>not allowed</b> on any assignment or quiz in this course, and all work must be your own with proper citations. A first small offense loses credit for the assignment; serious or repeated offenses cost a letter grade or the course and are reported to the Board of Conduct.</p>` },
    { icon: 'calendar', title: 'Dates and policies', html: `<ul class="list-plain small"><li>Last day to add with MyInfo: Tue Sept 1. Add/drop online: Wed Sept 9. Drop without a W: Wed Sept 16. Withdraw with a W: Wed Nov 18.</li><li>No extensions, late work or revisions without prior approval or a documented illness, injury or hardship.</li><li>Accommodations: contact the Office of Disability, Re-Entry and Veterans Services and the instructor.</li></ul>` },
    { icon: 'bulb', title: 'How to use Mathub for this class', span2: true, html: `<p class="small">Use Mathub to <b>study</b>, not to complete graded work: the syllabus bans collaboration on homework and quizzes, so do those on your own. After each lecture, read the topic note, then practice movements on yourself for the plane-and-axis and muscle-action questions. Before each exam, drill the quizzer’s torque, lever, ROM and gait questions and review the Formulas & key terms sheet; before each lab practical, pair it with palpation in open lab.</p>` }
  ];
  const NAV = [
    { label: 'Today', items: [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar']] },
    { label: 'Learn', items: [['notes', 'Topic notes', 'book'], ['formulas', 'Formulas & key terms', 'sigma'], ['flashcards', 'Flashcards', 'cards'], ['textbook', 'Textbook & links', 'link']] },
    { label: 'Practice', items: [['practice', 'Quizzer', 'list'], ['exam', 'Exam prep', 'flag'], ['planner', 'Study planner', 'calendar']] },
    { label: 'Tools', items: [['grades', 'Grade calculator', 'calc'], ['scratchpad', 'Scratchpad', 'pen']] },
    { label: 'Community', items: [['forum', 'Discussions', 'chat']] },
    { label: 'Course', items: [['course', 'Syllabus & policies', 'info'], ['settings', 'Settings', 'sliders']] }
  ];

  global.Courses = global.Courses || {};
  global.Courses.kin = Object.assign(global.Courses.kin || {}, {
    id: 'kin', code: 'KIN 322', name: 'Kinesiology', short: 'KIN 322', term: 'Fall 2026', kind: 'science', tagline: 'How joints and muscles move the spine and limbs, and the biomechanics behind it',
    formulasNote: 'Everything on one page. The closed-note part of each exam is from memory; the open-note part allows your homework, not this sheet.', filterExample: 'torque, ACL',
    quizNote: 'Torque, lever, range-of-motion and gait questions are generated with computed answers; anatomy questions come from a bank written for Mathub. Check anything surprising against lecture, lab and your Trail Guide.',
    COURSE, GRADING, EXAMS, CALENDAR, CALENDAR_NOTE, RECURRING, SEMESTER, VARIANTS, UNITS, SECTIONS, FORMULAS, FLASHCARDS, PRACTICE, CHECKLISTS, INFO, NAV
  });
})(window);
