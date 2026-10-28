/* BIOB 160 Principles of Living Systems: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).biob = {
  life: {
    plain: 'Biology studies things that are alive, and living things share a short list of traits: they are organized, use energy, grow, respond, keep their insides steady, reproduce and evolve. Life is built in levels, from molecules up to the whole biosphere, and new properties appear at each level. Science tests ideas with controlled experiments that change one thing at a time.',
    figure: { type: 'flow', steps: ['Observation: beans grow unevenly', 'Hypothesis: fertilizer increases height', 'Experiment: 20 with, 20 without (the control)', 'Measure height (the dependent variable)', 'Conclusion: support or reject'], caption: 'Change one variable, keep everything else the same.' },
    check: [
      ['In the bean experiment, what is the independent variable?', 'Whether the plant gets fertilizer.'],
      ['Why include plants without fertilizer?', 'They are the control, to compare against.'],
      ['Can a hypothesis be proven true?', 'No: it can be supported or rejected by evidence.']
    ]
  },
  chemistry: {
    plain: 'Life is chemistry, built mostly from carbon, hydrogen, oxygen and nitrogen. Atoms bond by sharing electrons (covalent bonds) or by one atom taking electrons from another (ionic bonds). When the sharing is uneven, the molecule is polar, and weak attractions like hydrogen bonds form between molecules. Those weak bonds shape everything from water to DNA.',
    figure: { type: 'table', head: ['bond', 'how', 'strength'], rows: [['nonpolar covalent', 'electrons shared equally', 'strong'], ['polar covalent', 'shared unequally', 'strong'], ['ionic', 'electrons transferred', 'strong when dry'], ['hydrogen bond', 'H+ attracted to a negative atom', 'weak']], caption: 'Strong bonds hold molecules together; weak ones hold them near each other.' },
    check: [
      ['Oxygen-18 (atomic number 8): how many protons and neutrons?', '8 protons, 10 neutrons.'],
      ['What is an isotope?', 'The same element with a different number of neutrons.'],
      ['Why is the O–H bond polar?', 'Oxygen is more electronegative and pulls the shared electrons closer.']
    ]
  },
  water: {
    plain: 'Water is a bent, polar molecule, so neighbouring water molecules stick together with hydrogen bonds. That one fact explains why water climbs up plants, resists temperature change, floats as ice and dissolves so much. The pH scale counts hydrogen ions on a log scale: each step down is ten times more acidic.',
    figure: { type: 'table', head: ['pH', '[H⁺] (mol/L)', 'example'], rows: [['2', '10⁻²', 'lemon juice'], ['3', '10⁻³', 'solution A'], ['6', '10⁻⁶', 'solution B'], ['7', '10⁻⁷', 'pure water'], ['12', '10⁻¹²', 'soapy water']], caption: 'pH 3 has 1000 times the H⁺ of pH 6: three steps of ten.' },
    check: [
      ['Solution A is pH 3, B is pH 6. How many times more H⁺ does A have?', '$10^3 = 1000$ times.'],
      ['Why does ice float?', 'Hydrogen bonds lock it into a spread-out lattice, less dense than liquid water.'],
      ['What does a buffer do?', 'Soaks up or releases H⁺ to keep pH steady.']
    ]
  },
  carbon: {
    plain: 'Carbon makes four bonds, so it can build long chains, branches and rings: the skeletons of every biological molecule. What a molecule does depends largely on the small functional groups attached to that skeleton, like hydroxyl (–OH), carboxyl (–COOH) and amino (–NH₂) groups. Same atoms, different arrangement (isomers) can mean very different behaviour.',
    figure: { type: 'table', head: ['group', 'formula', 'behaves as'], rows: [['hydroxyl', '–OH', 'polar (alcohols)'], ['carboxyl', '–COOH', 'acid'], ['amino', '–NH₂', 'base'], ['phosphate', '–OPO₃²⁻', 'energy, DNA backbone'], ['methyl', '–CH₃', 'nonpolar']], caption: 'An amino group and a carboxyl group on one carbon: an amino acid.' },
    check: [
      ['Why can carbon build so many different molecules?', 'It forms four covalent bonds.'],
      ['Which functional group makes a molecule acidic?', 'Carboxyl (–COOH).'],
      ['What are isomers?', 'Molecules with the same formula but different structures.']
    ]
  },
  'carbs-lipids': {
    plain: 'Big molecules are built from small units: each new link releases a water molecule (dehydration), and breaking a link uses one (hydrolysis). Sugars link into starch for storage, glycogen in animals and cellulose for plant walls. Fats store energy, phospholipids build membranes, and steroids like cholesterol act as signals.',
    figure: { type: 'flow', dir: 'right', steps: ['glucose + glucose', '− H₂O (dehydration)', 'maltose'], caption: 'Each link releases one water; hydrolysis adds one back to break it.' },
    check: [
      ['How many waters are released joining 6 glucose into a chain?', '5: one per link.'],
      ['Why can humans digest starch but not cellulose?', 'Our enzymes fit starch\'s α linkages but not cellulose\'s β linkages.'],
      ['What makes a fat saturated?', 'No C=C double bonds: the chains are straight and pack tightly, solid at room temperature.']
    ]
  },
  proteins: {
    plain: 'Proteins do most of the work in a cell. They are chains of amino acids folded into a precise shape, and the shape is the function. The order of amino acids (primary structure) decides how the chain coils and folds; heat, pH or one wrong amino acid can unfold it and wreck the job it does.',
    figure: { type: 'flow', steps: ['Primary: the amino acid order', 'Secondary: α helices and β sheets (backbone H-bonds)', 'Tertiary: the whole chain folds (R-group interactions)', 'Quaternary: several chains together'], caption: 'Each level depends on the one before.' },
    check: [
      ['What kind of bond links amino acids?', 'A peptide bond.'],
      ['Which level holds α helices and β sheets?', 'Secondary structure.'],
      ['A buried hydrophobic amino acid becomes charged. Which level is disrupted first?', 'Tertiary: the fold that hides hydrophobic groups inside.']
    ]
  },
  nucleic: {
    plain: 'DNA stores the genetic instructions and RNA carries them out. Both are chains of nucleotides: a sugar, a phosphate and a base. DNA is two strands twisted together, held by base pairs (A with T, G with C), running in opposite directions. Because each strand fixes the other, one strand is enough to rebuild the whole molecule.',
    figure: { type: 'table', head: ['5′', 'A', 'T', 'G', 'C', '3′'], rows: [['3′', 'T', 'A', 'C', 'G', '5′']], caption: 'Pairs A–T and G–C; the strands run in opposite directions.' },
    check: [
      ['Write the partner of 5′-ATGGCTAC-3′, 5′ to 3′.', '5′-GTAGCCAT-3′.'],
      ['Name two differences between DNA and RNA.', 'RNA uses ribose and uracil (not deoxyribose and thymine) and is usually single-stranded.'],
      ['Which pair has three hydrogen bonds?', 'G–C.']
    ]
  },
  energy: {
    plain: 'Cells constantly build and break molecules. Breaking down releases energy; building up costs it. Free energy change, ΔG, tells you which way a reaction runs on its own: negative ΔG goes by itself and releases energy, positive ΔG needs a push. Cells pay for uphill reactions by coupling them to downhill ones.',
    figure: { type: 'bars', bars: [['X', 5], ['Y', -12], ['X + Y', -7]], caption: 'ΔG in kcal/mol: coupling an uphill X with a downhill Y makes the pair go (−7).' },
    check: [
      ['ΔG = +5 kcal/mol. Does the reaction go on its own?', 'No: it needs energy.'],
      ['What is the first law of thermodynamics?', 'Energy is not created or destroyed, only changed in form.'],
      ['Is cellular respiration catabolic or anabolic?', 'Catabolic: it breaks glucose down.']
    ]
  },
  enzymes: {
    plain: 'Enzymes speed reactions up by lowering the energy hill (activation energy) a reaction has to climb. They do not change ΔG. Each enzyme fits its substrate at an active site, so anything that changes its shape (temperature, pH, inhibitors) changes its speed. ATP is the cell\'s spending money, made in respiration and spent everywhere else.',
    figure: { type: 'graph', x: [0, 10], y: [0, 10], fns: [{ f: '2+6exp(-(x-5)^2/1.5)', label: 'no enzyme' }, { f: '2+3exp(-(x-5)^2/1.5)', label: 'with enzyme', dash: true }], xlabel: 'reaction progress', ylabel: 'energy', caption: 'An enzyme lowers the hill (activation energy); the start and end energies stay the same.' },
    check: [
      ['Does an enzyme change ΔG?', 'No: it only lowers the activation energy.'],
      ['Extra substrate overcomes inhibitor A but not B. What kinds are they?', 'A is competitive; B is noncompetitive.'],
      ['Why does a fever-high temperature slow some enzymes?', 'Heat denatures them: the active site loses its shape.']
    ]
  },
  respiration: {
    plain: 'Cellular respiration slowly burns glucose and saves the energy as ATP. Glycolysis splits glucose in the cytosol. The citric acid cycle in the mitochondria strips off the remaining electrons onto NADH and FADH₂. Those electrons then run down the electron transport chain to oxygen, pumping protons that drive ATP synthase, which makes most of the ATP.',
    figure: { type: 'flow', steps: ['Glycolysis (cytosol): 2 ATP, 2 NADH', 'Pyruvate oxidation (matrix): 2 NADH, 2 CO₂', 'Citric acid cycle (matrix): 2 ATP, 6 NADH, 2 FADH₂', 'Electron transport + ATP synthase (inner membrane): about 26–28 ATP'], caption: 'Per glucose, about 30–32 ATP in total; oxygen is the final electron acceptor.' },
    check: [
      ['Where does glycolysis happen?', 'In the cytosol.'],
      ['How many NADH per glucose from glycolysis, pyruvate oxidation and the cycle?', '2 + 2 + 6 = 10.'],
      ['What happens without oxygen?', 'Fermentation: only glycolysis\'s 2 ATP, recycling NAD⁺.']
    ]
  },
  cells: {
    plain: 'All cells have a membrane, cytosol, DNA and ribosomes. Prokaryotes (bacteria and archaea) stop there; eukaryotic cells add a nucleus and membrane-bound organelles, each with a job. A protein meant for export follows an assembly line: nucleus, rough ER, Golgi, vesicle, out of the cell.',
    figure: { type: 'flow', steps: ['Gene → mRNA in the nucleus', 'Ribosome on the rough ER makes the protein', 'Golgi modifies and packages it', 'Vesicle fuses with the membrane: protein leaves'], caption: 'The path of a secreted protein like insulin.' },
    check: [
      ['What do prokaryotes lack?', 'A nucleus and membrane-bound organelles.'],
      ['Where is ATP made in eukaryotes?', 'Mostly in the mitochondria.'],
      ['Why are cells small?', 'A high surface-to-volume ratio lets enough material cross the membrane.']
    ]
  },
  membranes: {
    plain: 'A cell membrane is a fluid double layer of phospholipids studded with proteins. Small nonpolar molecules slip through; ions and big polar molecules need protein doors. Water moves by osmosis toward the side with more dissolved stuff. Moving things against their gradient costs energy (active transport).',
    figure: { type: 'table', head: ['outside solution', 'water moves', 'red blood cell'], rows: [['hypotonic (less solute)', 'into the cell', 'swells, may burst'], ['isotonic', 'no net flow', 'normal'], ['hypertonic (more solute)', 'out of the cell', 'shrivels']], caption: 'Water follows the solute.' },
    check: [
      ['A red blood cell (0.9% solute) goes into 3% salt water. What happens?', 'Water leaves; the cell shrivels.'],
      ['Does facilitated diffusion use ATP?', 'No: it is passive, down the gradient through a protein.'],
      ['Which can cross the bilayer easily: O₂ or Na⁺?', 'O₂ (small and nonpolar).']
    ]
  },
  mitosis: {
    plain: 'Mitosis copies a cell: one cell becomes two identical ones with the same chromosome number. First the DNA is copied in S phase, so each chromosome has two sister chromatids. Then prophase, metaphase (line up), anaphase (pull apart) and telophase split the copies evenly. Checkpoints stop the cycle if something is wrong; cancer is what happens when they fail.',
    figure: { type: 'flow', steps: ['Interphase: G₁ grow, S copy DNA, G₂ prepare', 'Prophase: chromosomes condense', 'Metaphase: line up in the middle', 'Anaphase: sister chromatids pulled apart', 'Telophase + cytokinesis: two cells'], cycle: true, caption: 'The cell cycle repeats.' },
    check: [
      ['A cell with 2n = 8 is in metaphase. How many chromatids?', '16 (8 chromosomes, 2 chromatids each).'],
      ['How many chromosomes in each daughter cell?', '8: the same as the parent.'],
      ['In which phase is DNA copied?', 'S phase of interphase.']
    ]
  },
  meiosis: {
    plain: 'Meiosis makes sex cells with half the chromosomes. Meiosis I separates the matching pairs (homologs), halving the number; meiosis II separates sister chromatids, like mitosis. Crossing over and the random way pairs line up reshuffle the genes, so every gamete is unique. Fertilisation restores the full number.',
    figure: { type: 'table', head: ['', 'mitosis', 'meiosis'], rows: [['divisions', '1', '2'], ['cells made', '2', '4'], ['chromosomes', 'same (2n)', 'half (n)'], ['genetically', 'identical', 'all different'], ['purpose', 'growth, repair', 'gametes']], caption: 'Mitosis copies; meiosis halves and shuffles.' },
    check: [
      ['2n = 6: how many chromosome combinations from independent assortment?', '$2^3 = 8$.'],
      ['Which division separates homologous chromosomes?', 'Meiosis I.'],
      ['When does crossing over happen?', 'Prophase I.']
    ]
  },
  mendel: {
    plain: 'Each gene comes in versions (alleles), and you carry two: one from each parent. A dominant allele shows whenever it is present; a recessive one only shows when you have two copies. A Punnett square lists every combination of parents\' gametes. Genes on different chromosomes sort independently, so you can multiply their probabilities.',
    figure: { type: 'table', head: ['', 'A', 'a'], rows: [['A', 'AA', 'Aa'], ['a', 'Aa', 'aa']], caption: 'Aa × Aa: 1 AA : 2 Aa : 1 aa, so 3 dominant to 1 recessive.' },
    check: [
      ['Aa × Aa: what fraction of offspring are aa?', '$\\frac14$.'],
      ['AaBbCc × AaBbCc: fraction aabbcc?', '$(\\frac14)^3 = \\frac{1}{64}$.'],
      ['What cross tells whether a dominant-looking plant is AA or Aa?', 'A testcross with aa.']
    ]
  },
  linkage: {
    plain: 'Genes on the same chromosome tend to be inherited together: they are linked. Crossing over in meiosis sometimes separates them, and the farther apart two genes are, the more often that happens. So the percentage of recombinant offspring works as a ruler: 1% recombination is one map unit.',
    figure: { type: 'bars', bars: [['parental 1', 420], ['parental 2', 400], ['recomb. 1', 90], ['recomb. 2', 90]], caption: 'Recombinants: 180 of 1000 = 18%, so the genes are 18 map units apart.' },
    check: [
      ['420 + 400 parental and 90 + 90 recombinant offspring: how far apart are the genes?', '18 map units.'],
      ['Why are X-linked recessive traits more common in males?', 'Males have one X, so one recessive allele shows.'],
      ['What is the largest possible recombination frequency?', '50%: the same as unlinked genes.']
    ]
  },
  popgen: {
    plain: 'Evolution, at its smallest scale, is a change in how common each allele is in a population. The Hardy–Weinberg equation, $p^2 + 2pq + q^2 = 1$, describes a population that is not evolving. Start from what you can see: the fraction showing the recessive trait is $q^2$.',
    figure: { type: 'bars', bars: [['AA (p²)', 36], ['Aa (2pq)', 48], ['aa (q²)', 16]], caption: '16% show the recessive trait: q = 0.4, p = 0.6, so 48% are carriers.' },
    check: [
      ['16% are aa. What is $q$?', '$\\sqrt{0.16} = 0.4$.'],
      ['What fraction are heterozygous then?', '$2(0.6)(0.4) = 0.48$.'],
      ['Name two things that make a population evolve.', 'Selection, mutation, gene flow, genetic drift, non-random mating (any two).']
    ]
  },
  dna: {
    plain: 'Experiments in the 1900s proved genes are DNA, not protein: Griffith\'s transforming bacteria, Avery\'s purification and Hershey–Chase\'s viruses. Watson and Crick, using Franklin\'s X-ray images, showed DNA is a double helix with A paired to T and G to C. That pairing explains Chargaff\'s rule: A = T and G = C.',
    figure: { type: 'pie', slices: [['A', 22], ['T', 22], ['G', 28], ['C', 28]], caption: 'If A is 22%, then T is 22% and G and C share the remaining 56%.' },
    check: [
      ['A DNA sample is 22% A. What are T, G and C?', 'T 22%, G 28%, C 28%.'],
      ['In Hershey–Chase, which label entered the bacteria?', '³²P, in the DNA.'],
      ['Why does a purine always pair with a pyrimidine?', 'It keeps the helix the same width all along.']
    ]
  },
  replication: {
    plain: 'Before a cell divides, it copies its DNA. The helix is unzipped and each old strand becomes a template for a new one, so every new molecule is half old and half new (semiconservative). DNA polymerase can only build in one direction, 5′ to 3′, so one strand is made smoothly and the other in short pieces that ligase stitches together.',
    figure: { type: 'table', head: ['enzyme', 'job'], rows: [['helicase', 'unzips the helix'], ['primase', 'lays an RNA primer'], ['DNA polymerase III', 'adds nucleotides 5′ → 3′'], ['DNA polymerase I', 'replaces primers with DNA'], ['ligase', 'joins Okazaki fragments']], caption: 'The replication crew.' },
    check: [
      ['Bacteria in ¹⁵N move to ¹⁴N. After one round, what DNA density?', 'All hybrid (one heavy, one light strand).'],
      ['Why is the lagging strand made in pieces?', 'Polymerase only builds 5′ → 3′, away from the fork on that strand.'],
      ['Which enzyme seals the gaps?', 'DNA ligase.']
    ]
  },
  transcription: {
    plain: 'Transcription copies a gene from DNA into messenger RNA. RNA polymerase reads the template strand and builds RNA with U in place of T. In eukaryotes the new RNA is edited before it leaves the nucleus: a cap and a tail are added and the introns are cut out, leaving the exons spliced together.',
    figure: { type: 'table', head: ['template 3′', 'T', 'A', 'C', 'G', 'G'], rows: [['mRNA 5′', 'A', 'U', 'G', 'C', 'C']], caption: 'Template 3′-TACGG… becomes mRNA 5′-AUGCC…: A→U, T→A, G→C, C→G.' },
    check: [
      ['Template 3′-TACGGATTC-5′: what is the mRNA?', '5′-AUGCCUAAG-3′.'],
      ['Which parts of the RNA are kept: introns or exons?', 'Exons.'],
      ['Where does transcription happen in a eukaryote?', 'In the nucleus.']
    ]
  },
  translation: {
    plain: 'Translation reads the mRNA three bases at a time. Each codon matches a tRNA carrying a specific amino acid, and the ribosome links those amino acids into a chain. AUG starts it; UAA, UAG or UGA stops it. A mutation that changes one base can change one amino acid, end the protein early, or (if it adds or removes a base) scramble everything after it.',
    figure: { type: 'table', head: ['codon', 'AUG', 'GCU', 'UGG', 'UAA'], rows: [['amino acid', 'Met (start)', 'Ala', 'Trp', 'stop'], ['if UGG → UGA', 'Met', 'Ala', 'stop', '–']], caption: 'One base change turns Trp into a stop: a nonsense mutation.' },
    check: [
      ['Translate 5′-AUG GCU UGG UAA-3′.', 'Met–Ala–Trp, then stop.'],
      ['What is a frameshift mutation?', 'Adding or deleting bases (not a multiple of 3), which shifts every codon after it.'],
      ['Why can a change in the third base often do nothing?', 'The code is redundant: several codons code for the same amino acid.']
    ]
  },
  biotech: {
    plain: 'DNA technology lets us cut, copy, read and edit genes. Restriction enzymes cut DNA at set sequences; ligase pastes pieces into plasmids that bacteria copy for us. PCR doubles a chosen stretch of DNA every cycle. Gel electrophoresis sorts pieces by size: small ones travel farther. CRISPR edits a chosen spot in a genome.',
    figure: { type: 'graph', x: [0, 20], y: [0, 11000000], fns: [{ f: '10*2^x', label: 'copies = 10 × 2ⁿ' }], xlabel: 'PCR cycles', ylabel: 'copies', caption: 'Ten copies doubled 20 times: about 10 million.' },
    check: [
      ['10 copies, 20 PCR cycles of perfect doubling: how many copies?', '$10 \\times 2^{20} \\approx 10.5$ million.'],
      ['In a gel, which DNA pieces travel farthest?', 'The smallest.'],
      ['What do sticky ends let you do?', 'Join DNA pieces cut by the same enzyme.']
    ]
  }
};
