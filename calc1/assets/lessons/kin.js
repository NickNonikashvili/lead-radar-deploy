/* KIN 322 Kinesiology: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).kin = {
  terms: {
    plain: 'Anatomy has its own map words so everyone describes the body the same way. Everything starts from anatomical position: standing, facing forward, palms forward. Each movement happens in a plane and turns about an axis at right angles to that plane: flexion and extension in the sagittal plane, abduction and adduction in the frontal plane, rotation in the transverse plane.',
    figure: { type: 'table', head: ['plane', 'axis', 'movements'], rows: [['sagittal (splits left/right)', 'mediolateral', 'flexion, extension'], ['frontal (splits front/back)', 'anteroposterior', 'abduction, adduction'], ['transverse (splits top/bottom)', 'longitudinal', 'rotation, pronation/supination']], caption: 'The movement plane and its axis are always perpendicular.' },
    check: [
      ['Raising the arm out to the side is which movement, in which plane?', 'Abduction, in the frontal plane.'],
      ['Is the elbow proximal or distal to the wrist?', 'Proximal: closer to the trunk.'],
      ['Which axis does a squat\'s knee flexion turn about?', 'The mediolateral axis.']
    ]
  },
  joints: {
    plain: 'Joints are grouped by what holds the bones together: fibrous, cartilaginous or synovial. Synovial joints move the most, and their surfaces do more than swing: they roll and glide. The convex-concave rule tells you which way: a convex surface moving on a concave one glides the opposite way to the motion; a concave surface on a convex one glides the same way.',
    figure: { type: 'table', head: ['moving surface', 'glides', 'example'], rows: [['convex on concave', 'opposite to the motion', 'humeral head on glenoid'], ['concave on convex', 'same way as the motion', 'tibia on femur (open chain)']], caption: 'The convex–concave rule for joint gliding.' },
    check: [
      ['During shoulder abduction, which way does the humeral head glide?', 'Inferiorly (down): convex on concave, opposite to the arm moving up.'],
      ['What is the close-packed position?', 'Most surface contact, ligaments tight: the most stable position.'],
      ['Name a cartilaginous joint.', 'The pubic symphysis, intervertebral discs, or a growth plate.']
    ]
  },
  tissue: {
    plain: 'Tissues get pulled, squashed, sheared, bent and twisted. Stress is load per area; strain is how much the tissue stretches relative to its length. Muscles contract three ways: shortening (concentric), lengthening under control (eccentric) and holding still (isometric). A muscle makes the most force at a middle length, where its filaments overlap best.',
    figure: { type: 'graph', x: [0, 10], y: [0, 10], fns: [{ f: '0.15x^2', domain: [0, 2], label: 'toe' }, { f: '0.6+2(x-2)', domain: [2, 5], label: 'elastic' }, { f: '6.6+1.2(x-5)-0.12(x-5)^2', domain: [5, 9], label: 'plastic' }], points: [{ x: 9, y: 9.5, label: 'failure' }], xlabel: 'strain', ylabel: 'stress', caption: 'A ligament stress–strain curve: crimp straightens, then springs back, then permanent damage.' },
    check: [
      ['Sitting slowly into a chair: which knee muscles work, and how?', 'The quadriceps, eccentrically.'],
      ['What is the difference between the elastic and plastic regions?', 'Elastic stretch springs back; plastic stretch is permanent.'],
      ['At what length does a muscle make the most force?', 'Around its resting (middle) length.']
    ]
  },
  levers: {
    plain: 'Bones are levers, joints are pivots and muscles pull. Torque is force times its perpendicular distance from the pivot (the moment arm). Most muscles attach close to the joint, so they have short moment arms and must pull hard: the body trades force for speed and range of motion.',
    figure: { type: 'figure', shapes: [{ kind: 'rect', at: [0, 0], w: 6, h: 0.3, text: 'forearm' }, { kind: 'point', at: [0, 0.15], label: 'elbow (axis)' }, { kind: 'arrow', from: [0.8, 0.3], to: [0.8, 3.3], label: 'biceps F' }, { kind: 'arrow', from: [6, 0], to: [6, -2], label: '20 N' }, { kind: 'text', at: [0.4, -0.6], text: '0.04 m' }, { kind: 'text', at: [3.4, -0.6], text: '0.30 m' }], caption: 'A third-class lever: F × 0.04 = 20 × 0.30, so the biceps pulls 150 N.' },
    check: [
      ['Find the biceps force in the picture.', '$F = 20 \\times 0.30 / 0.04 = 150$ N.'],
      ['What class of lever has the effort between the axis and the load?', 'Third class (most limbs).'],
      ['When does a muscle make the most torque for a given force?', 'When it pulls at 90° to the bone.']
    ]
  },
  spine: {
    plain: 'The spine is a stack of 33 vertebrae in regions: 7 cervical, 12 thoracic, 5 lumbar, then the fused sacrum and coccyx. Its S-shaped curves act like a spring. The direction the small facet joints face decides each region\'s motion: the neck turns freely, the thoracic spine rotates but ribs limit it, the lumbar spine bends forward and back but barely rotates.',
    figure: { type: 'bars', bars: [['cervical', 7], ['thoracic', 12], ['lumbar', 5], ['sacrum', 5], ['coccyx', 4]], caption: 'Vertebrae per region (sacrum and coccyx are fused).' },
    check: [
      ['Why is rotation limited in the lumbar spine?', 'Its facets face mostly medially and laterally, blocking rotation.'],
      ['Which joint gives about half of neck rotation?', 'C1–C2 (atlantoaxial).'],
      ['Which curves are lordotic?', 'Cervical and lumbar.']
    ]
  },
  trunk: {
    plain: 'Trunk muscles move the spine and, just as often, hold it still. The rectus abdominis curls you forward; the obliques rotate you (external to the opposite side, internal to the same side); the transversus abdominis squeezes like a corset. A spinal cord injury cuts off everything below its level, so knowing which nerves serve which muscles predicts what a person can do.',
    figure: { type: 'table', head: ['level', 'key muscles', 'what works'], rows: [['C5', 'biceps, deltoid', 'elbow flexion'], ['C6', 'wrist extensors', 'wrist extension (tenodesis grip)'], ['C7', 'triceps', 'elbow extension'], ['C8–T1', 'finger flexors, hand', 'grip and fine finger movement']], caption: 'With C6 the lowest normal level, triceps (C7) does not work.' },
    check: [
      ['C6 is the lowest working level. Can the person extend the elbow?', 'No: triceps needs C7.'],
      ['Which oblique rotates the trunk to the same side?', 'The internal oblique.'],
      ['What does the transversus abdominis do?', 'Compresses the abdomen and stiffens the spine.']
    ]
  },
  shoulder: {
    plain: 'The shoulder is four joints working together, and the shoulder blade has to move for the arm to go overhead. For every 3 degrees of arm elevation, roughly 2 come from the glenohumeral joint and 1 from the scapula rotating upward (the 2:1 scapulohumeral rhythm). The rotator cuff keeps the ball centered on its shallow socket.',
    figure: { type: 'pie', slices: [['glenohumeral', 120], ['scapula', 60]], caption: '180° of arm elevation: about 120° at the glenohumeral joint and 60° from the scapula.' },
    check: [
      ['The arm stops at 120° and the scapula does not move. Why?', 'The glenohumeral joint gives about 120°; the last 60° need scapular upward rotation.'],
      ['Name the four rotator cuff muscles.', 'Supraspinatus, infraspinatus, teres minor, subscapularis (SITS).'],
      ['Which is the only bony link between arm and trunk?', 'The sternoclavicular joint.']
    ]
  },
  elbow: {
    plain: 'The elbow is a hinge for bending and straightening, plus a pivot where the radius spins to turn the palm up (supination) or down (pronation). Three main flexors share the work: brachialis (always), biceps (strongest with the palm up) and brachioradialis (strongest with the thumb up).',
    figure: { type: 'table', head: ['muscle', 'flexes the elbow', 'also'], rows: [['brachialis', 'in any forearm position', '–'], ['biceps brachii', 'best with palm up', 'supinates'], ['brachioradialis', 'best with thumb up', '–'], ['pronator teres', 'weakly', 'pronates']], caption: 'Forearm position changes which flexor works hardest.' },
    check: [
      ['Why is a chin-up (palms toward you) easier than a pull-up?', 'With the forearm supinated, the biceps can pull at full strength.'],
      ['Which joint lets you turn a key?', 'The radioulnar joints (pronation and supination).'],
      ['Which elbow flexor works no matter how the forearm is turned?', 'Brachialis.']
    ]
  },
  'wrist-hand': {
    plain: 'The wrist is eight small carpal bones in two rows, and the hand balances strong grip with fine control. Long muscles from the forearm power the grip; small muscles in the hand fine-tune it. Grip is strongest with the wrist slightly extended, because bent wrists leave the finger flexors too short to pull hard.',
    figure: { type: 'table', head: ['proximal row', 'distal row'], rows: [['scaphoid', 'trapezium'], ['lunate', 'trapezoid'], ['triquetrum', 'capitate'], ['pisiform', 'hamate']], caption: 'The carpals, thumb side (lateral) to pinky side.' },
    check: [
      ['A fall on an outstretched hand with snuffbox pain: which bone?', 'The scaphoid.'],
      ['Why is that fracture risky?', 'Its blood supply enters distally, so the proximal piece can die (avascular necrosis).'],
      ['In which wrist position is grip strongest?', 'Slight extension.']
    ]
  },
  hip: {
    plain: 'The hip is a deep ball-and-socket joint built for stability under body weight. The pelvis links the spine to the legs. In single-leg standing, the hip abductors on the standing side (mainly gluteus medius) keep the pelvis level; if they are weak, the opposite side drops (a Trendelenburg sign).',
    figure: { type: 'table', head: ['hip action', 'main muscles'], rows: [['flexion', 'iliopsoas, rectus femoris'], ['extension', 'gluteus maximus, hamstrings'], ['abduction', 'gluteus medius and minimus'], ['adduction', 'adductor group'], ['external rotation', 'deep six rotators']], caption: 'In single-leg stance, the stance-side gluteus medius keeps the pelvis level.' },
    check: [
      ['Standing on the left leg, the right pelvis drops. Which muscle is weak?', 'The left gluteus medius.'],
      ['Which ligament is the strongest in the body?', 'The iliofemoral ligament.'],
      ['Which hip position is close-packed?', 'Extension with internal rotation and abduction.']
    ]
  },
  knee: {
    plain: 'The knee is mostly a hinge with a little rotation when bent. Four main ligaments keep the femur and tibia lined up: the ACL stops the tibia sliding forward, the PCL stops it sliding back, and the MCL and LCL stop sideways gapping. The menisci cushion and deepen the joint. The kneecap lengthens the quadriceps\' moment arm.',
    figure: { type: 'table', head: ['structure', 'resists', 'test'], rows: [['ACL', 'tibia sliding forward', 'Lachman, anterior drawer'], ['PCL', 'tibia sliding back', 'posterior drawer'], ['MCL', 'valgus (knee pushed in)', 'valgus stress'], ['LCL', 'varus (knee pushed out)', 'varus stress']], caption: 'Each ligament stops one direction of slip.' },
    check: [
      ['A cutting athlete hears a pop; in the Lachman test the tibia slides forward. Which ligament?', 'The ACL.'],
      ['Which meniscus tears more often, and why?', 'The medial one: it is attached to the MCL and moves less.'],
      ['What does the patella do for the quadriceps?', 'Increases its moment arm, so it makes more torque.']
    ]
  },
  ankle: {
    plain: 'The ankle joint is a hinge for pointing the foot up (dorsiflexion) and down (plantarflexion). It is most stable pointed up, because the talus is wider in front. Most sprains happen with the foot pointed down and rolled in (inversion), which stretches the outside ligaments, the ATFL first.',
    figure: { type: 'table', head: ['ligament', 'side', 'injured by'], rows: [['ATFL', 'lateral', 'inversion + plantarflexion (most common)'], ['CFL', 'lateral', 'inversion'], ['PTFL', 'lateral', 'severe sprains'], ['deltoid', 'medial', 'eversion (rare, strong)']], caption: 'Rolling the sole inward stretches the lateral ligaments.' },
    check: [
      ['A player rolls the ankle so the sole turns in. Which ligament first?', 'The anterior talofibular ligament (ATFL).'],
      ['In which position is the ankle most stable?', 'Dorsiflexion.'],
      ['Which muscles plantarflex the ankle most?', 'Gastrocnemius and soleus.']
    ]
  },
  foot: {
    plain: 'The foot has 26 bones and three arches that both absorb shock and stiffen for push-off. When you rise onto your toes, the toes bend back and wind up the plantar fascia like a rope around a drum, pulling the arch higher (the windlass mechanism). Pronation unlocks the foot to adapt to the ground; supination locks it to push off.',
    figure: { type: 'flow', steps: ['Rise onto the toes', 'Toes extend at the MTP joints', 'Plantar fascia winds around the metatarsal heads', 'Fascia tightens and the arch rises', 'Rigid lever for push-off'], caption: 'The windlass mechanism.' },
    check: [
      ['Why does the arch rise on tiptoe without a muscle lifting it?', 'The windlass: toe extension tightens the plantar fascia.'],
      ['Does pronation make the foot rigid or flexible?', 'Flexible: it unlocks the midfoot.'],
      ['Name the three foot regions.', 'Rearfoot, midfoot, forefoot.']
    ]
  },
  gait: {
    plain: 'Walking repeats a cycle: from one heel strike to the same heel\'s next strike. About 60% of it is stance (the foot on the ground) and 40% swing. Speed is step length times step rate. Muscles mostly work in short bursts to absorb impact and push off, letting momentum and gravity do the rest.',
    figure: { type: 'bars', bars: [['stance', 60], ['swing', 40]], caption: 'Percent of the gait cycle at normal walking speed; running shrinks stance and drops double support.' },
    check: [
      ['110 steps/min with 0.7 m steps: walking speed?', '$0.7 \\times 110 / 60 \\approx 1.28$ m/s.'],
      ['What is the difference between a step and a stride?', 'A step is one foot to the other; a stride is one foot back to the same foot (two steps).'],
      ['What disappears when walking turns into running?', 'Double support: running has a flight phase instead.']
    ]
  }
};
