/* ============================================================
   Mathub — BIOB 160 question bank
   Multiple-choice banks for every topic, plus generators for the parts
   of the course that are worked step by step: isotopes and half-lives,
   pH, molarity, polymers, complementary strands, Chargaff's rules,
   Meselson–Stahl, transcription and translation with the full codon
   table, mutations, chromosome counts in mitosis and meiosis, Punnett
   squares, the product rule, sex linkage, recombination and map order,
   Hardy–Weinberg, respiration bookkeeping, tonicity, surface-to-volume,
   coupled ΔG, PCR and restriction fragments. Written for Mathub from
   standard introductory biology content (Campbell Biology, OpenStax
   Biology 2e); the instructors' lectures decide what the exams ask.
   ============================================================ */
(function (global) {
  'use strict';
  const TOPICS = {
    life: { unit: 1, sec: 'life', label: 'The study of life' },
    chemistry: { unit: 1, sec: 'chemistry', label: 'Atoms & bonds' },
    water: { unit: 1, sec: 'water', label: 'Water & pH' },
    carbon: { unit: 1, sec: 'carbon', label: 'Carbon & functional groups' },
    'carbs-lipids': { unit: 1, sec: 'carbs-lipids', label: 'Carbohydrates & lipids' },
    proteins: { unit: 1, sec: 'proteins', label: 'Proteins' },
    nucleic: { unit: 1, sec: 'nucleic', label: 'Nucleic acids' },
    energy: { unit: 2, sec: 'energy', label: 'Energy & ΔG' },
    enzymes: { unit: 2, sec: 'enzymes', label: 'ATP & enzymes' },
    respiration: { unit: 2, sec: 'respiration', label: 'Cellular respiration' },
    cells: { unit: 2, sec: 'cells', label: 'Cell structure' },
    membranes: { unit: 2, sec: 'membranes', label: 'Membranes & transport' },
    mitosis: { unit: 3, sec: 'mitosis', label: 'Cell cycle & mitosis' },
    meiosis: { unit: 3, sec: 'meiosis', label: 'Meiosis' },
    mendel: { unit: 3, sec: 'mendel', label: 'Mendelian genetics' },
    linkage: { unit: 3, sec: 'linkage', label: 'Linkage & sex linkage' },
    popgen: { unit: 3, sec: 'popgen', label: 'Population genetics' },
    dna: { unit: 4, sec: 'dna', label: 'DNA structure' },
    replication: { unit: 4, sec: 'replication', label: 'DNA replication' },
    transcription: { unit: 4, sec: 'transcription', label: 'Transcription' },
    translation: { unit: 4, sec: 'translation', label: 'Translation & mutations' },
    biotech: { unit: 4, sec: 'biotech', label: 'DNA technology' }
  };
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fmt = x => { const r = Math.round(x * 10000) / 10000; return Math.abs(r) >= 10000 ? r.toLocaleString('en-US') : String(r); };
  const gcd = (a, b) => b ? gcd(b, a % b) : Math.abs(a);
  const F = (n, d) => { if (!n) return '0'; const g = gcd(n, d); n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };
  const sup = k => String(k).split('').map(c => c === '-' ? '⁻' : '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)]).join('');
  const FRACS = ['0', '1/4', '1/2', '3/4', '1'];
  function mc(topic, prompt, correct, distractors, explanation, hint) { const opts = [String(correct)]; for (const d of distractors) { const s = String(d); if (!opts.includes(s)) opts.push(s); } const options = shuffle(opts.slice(0, 5)); return { topic, type: 'mc', prompt, options, answer: options.indexOf(String(correct)), explanation, hint }; }
  function num(topic, prompt, answer, explanation, hint, tol) { return { topic, type: 'num', prompt, answer, answerTex: fmt(answer), explanation, hint, tol: tol || 0.001 }; }
  /* a bank item is [prompt, correct, [distractors], explanation, hint] */
  const bank = (topic, items) => { const g = () => { const it = pick(items); return mc(topic, it[0], it[1], it[2], it[3], it[4] || 'Eliminate the options that describe a different structure, process or stage first.'); }; g.bankSize = items.length; return g; };

  /* ---------- DNA and RNA helpers ---------- */
  const DNA_PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' };
  const RNA_PAIR = { A: 'U', U: 'A', G: 'C', C: 'G' };
  const randSeq = (n, alpha = 'ATGC') => Array.from({ length: n }, () => pick(alpha.split(''))).join('');
  const comp = s => s.split('').map(b => DNA_PAIR[b]).join('');
  const rev = s => s.split('').reverse().join('');
  const toRna = s => s.replace(/T/g, 'U');
  const end5 = s => `5′-${s}-3′`, end3 = s => `3′-${s}-5′`;
  /* the standard genetic code, first base slowest, in the order U C A G */
  const BASES = 'UCAG';
  const AA1 = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const AA3 = { F: 'Phe', L: 'Leu', S: 'Ser', Y: 'Tyr', '*': 'Stop', C: 'Cys', W: 'Trp', P: 'Pro', H: 'His', Q: 'Gln', R: 'Arg', I: 'Ile', M: 'Met', T: 'Thr', N: 'Asn', K: 'Lys', V: 'Val', A: 'Ala', D: 'Asp', E: 'Glu', G: 'Gly' };
  const aaOf = c => AA3[AA1[16 * BASES.indexOf(c[0]) + 4 * BASES.indexOf(c[1]) + BASES.indexOf(c[2])]];
  const CODONS = []; for (const a of BASES) for (const b of BASES) for (const c of BASES) CODONS.push(a + b + c);
  const SENSE = CODONS.filter(c => aaOf(c) !== 'Stop');
  const STOPS = ['UAA', 'UAG', 'UGA'];
  function translate(rna, start) { const out = []; for (let i = start; i + 3 <= rna.length; i += 3) { const a = aaOf(rna.slice(i, i + 3)); if (a === 'Stop') break; out.push(a); } return out; }

  /* ---------- Unit 1: the chemistry of life ---------- */
  const qLife = bank('life', [
    ['Beak shapes in a finch population change over many generations as drought favors larger beaks. Which property of life does this show?', 'Evolutionary adaptation', ['Homeostasis', 'Energy processing', 'Growth and development', 'Order'], 'Heritable change in a population over generations that fits it to its environment is evolutionary adaptation.'],
    ['Which level of biological organization comes directly above tissues?', 'Organs', ['Cells', 'Organ systems', 'Organisms', 'Populations'], 'Molecules → organelles → cells → tissues → organs → organ systems → organisms → populations → communities → ecosystems → biosphere.'],
    ['The three domains of life are', 'Bacteria, Archaea and Eukarya', ['Plants, Animals and Fungi', 'Prokaryotes, Protists and Eukaryotes', 'Monera, Fungi and Eukarya', 'Bacteria, Protista and Animalia'], 'Bacteria and Archaea are prokaryotic; Eukarya includes protists, plants, fungi and animals.'],
    ['A testable, falsifiable explanation for a set of observations is a', 'hypothesis', ['theory', 'law', 'control', 'variable'], 'A hypothesis is tested by experiments. A theory is broader and supported by a large body of evidence.'],
    ['In a controlled experiment, the factor the researcher deliberately changes is the', 'independent variable', ['dependent variable', 'control group', 'constant', 'prediction'], 'The dependent variable is what is measured in response.'],
    ['Emergent properties arise from', 'the arrangement and interactions of parts as complexity increases', ['a single molecule acting alone', 'random mutations in DNA', 'the smallest level of organization only', 'natural selection within one lifetime'], 'A cell can do things none of its molecules can do alone.'],
    ['Natural selection acts on', 'heritable variation among individuals in a population', ['traits an individual acquires during its life', 'the needs of the species', 'mutations produced on purpose in response to the environment', 'only very large populations'], 'Individuals with heritable traits suited to the environment leave more offspring.'],
    ['In negative feedback, the output of a process', 'reduces the process, keeping conditions stable', ['amplifies the process', 'has no effect on the process', 'always stops all reactions', 'is found only in plants'], 'Negative feedback underlies homeostasis, such as blood glucose regulation by insulin.'],
    ['Eukaryotic cells differ from prokaryotic cells because they have', 'a nucleus and membrane-enclosed organelles', ['DNA', 'ribosomes', 'a plasma membrane', 'cytoplasm'], 'All cells have DNA, ribosomes, a plasma membrane and cytoplasm.'],
    ['Genes are made of', 'DNA', ['proteins', 'carbohydrates', 'phospholipids', 'amino acids'], 'Genes are DNA sequences; most encode proteins through mRNA.']
  ]);
  const qChemistry = bank('chemistry', [
    ['The atomic number of an element equals its number of', 'protons', ['neutrons', 'protons plus neutrons', 'valence electrons', 'isotopes'], 'The mass number is protons plus neutrons.'],
    ['Carbon-12 and carbon-14 are', 'isotopes: the same number of protons, different numbers of neutrons', ['different elements', 'ions with different charges', 'isomers', 'compounds'], 'Both have 6 protons; carbon-14 has 8 neutrons instead of 6.'],
    ['How many covalent bonds does a nitrogen atom usually form?', '3', ['1', '2', '4', '5'], 'H forms 1, O forms 2, N forms 3 and C forms 4, matching the electrons needed to fill the valence shell.'],
    ['A covalent bond in which electrons are shared unequally is', 'a polar covalent bond', ['a nonpolar covalent bond', 'an ionic bond', 'a hydrogen bond', 'a van der Waals interaction'], 'The more electronegative atom (such as O in water) pulls the shared electrons closer.'],
    ['Sodium gives an electron to chlorine. The attraction between the resulting Na⁺ and Cl⁻ is', 'an ionic bond', ['a nonpolar covalent bond', 'a polar covalent bond', 'a hydrogen bond', 'a peptide bond'], 'Transfer of an electron creates ions; opposite charges attract.'],
    ['The four elements that make up about 96% of living matter are', 'carbon, hydrogen, oxygen and nitrogen', ['carbon, calcium, oxygen and sodium', 'hydrogen, helium, oxygen and nitrogen', 'carbon, phosphorus, sulfur and iron', 'iron, carbon, oxygen and hydrogen'], 'CHON; phosphorus, sulfur, calcium and potassium make up most of the rest.'],
    ['Valence electrons are the electrons', 'in the outermost electron shell', ['in the innermost shell', 'in the nucleus', 'that were lost to form an ion', 'shared only in ionic bonds'], 'Valence electrons determine how an atom bonds.'],
    ['A hydrogen bond forms when', 'a partially positive hydrogen is attracted to a nearby electronegative atom such as O or N', ['two hydrogens share electrons equally', 'hydrogen gives away its electron', 'two nonpolar molecules touch', 'a proton moves into another nucleus'], 'Hydrogen bonds are weak individually but powerful in large numbers, as in water and DNA.'],
    ['Morphine binds the same receptors as endorphins. This shows that', 'molecular shape determines biological function', ['ionic bonds are strong in water', 'isotopes behave differently', 'all drugs are proteins', 'hydrogen bonds are covalent'], 'Morphine mimics the shape of the endorphins.'],
    ['An iodine deficiency causes goiter. Iodine is an example of', 'a trace element, needed only in tiny amounts', ['a major element', 'a radioactive isotope', 'an element that forms no bonds', 'a buffer'], 'Trace elements such as iodine and iron are required in minute quantities.']
  ]);
  function qIsotope() {
    const E = [['carbon-12', 6, 12], ['carbon-14', 6, 14], ['nitrogen-15', 7, 15], ['oxygen-18', 8, 18], ['phosphorus-32', 15, 32], ['sulfur-35', 16, 35], ['hydrogen-3 (tritium)', 1, 3], ['sodium-23', 11, 23], ['chlorine-37', 17, 37], ['potassium-40', 19, 40], ['calcium-40', 20, 40], ['iodine-131', 53, 131]];
    const [name, Z, A] = pick(E); const form = ri(0, 2);
    if (form === 0) return num('chemistry', `How many neutrons does an atom of ${name} have? (Its atomic number is ${Z}.)`, A - Z, `Neutrons = mass number − atomic number = ${A} − ${Z} = ${A - Z}.`, 'The number in the name is the mass number (protons + neutrons).');
    if (form === 1) return num('chemistry', `An atom has ${Z} protons and ${A - Z} neutrons. What is its mass number?`, A, `Mass number = protons + neutrons = ${Z} + ${A - Z} = ${A}. This is ${name}.`, 'Add protons and neutrons; electrons are too light to count.');
    return num('chemistry', `How many electrons does a neutral atom of ${name} have? (Its atomic number is ${Z}.)`, Z, `A neutral atom has as many electrons as protons: ${Z}.`, 'Neutral means the charges balance.');
  }
  function qHalfLife() {
    const n = ri(1, 5); const HL = 5730;
    if (Math.random() < 0.5) return num('chemistry', `Carbon-14 has a half-life of about ${HL.toLocaleString('en-US')} years. What percent of the original carbon-14 remains after ${(n * HL).toLocaleString('en-US')} years?`, 100 / 2 ** n, `${(n * HL).toLocaleString('en-US')} ÷ ${HL.toLocaleString('en-US')} = ${n} half-lives, so 100% × (1/2)${sup(n)} = ${fmt(100 / 2 ** n)}%.`, 'Count the half-lives, then halve 100% that many times.', 0.01);
    return num('chemistry', `A fossil has 1/${2 ** n} of the carbon-14 found in living organisms. Carbon-14 has a half-life of about ${HL.toLocaleString('en-US')} years. About how old is the fossil, in years?`, n * HL, `1/${2 ** n} = (1/2)${sup(n)}, so ${n} half-lives have passed: ${n} × ${HL.toLocaleString('en-US')} = ${(n * HL).toLocaleString('en-US')} years.`, 'Write the fraction as a power of 1/2 to count half-lives.', 0.01);
  }
  const qWater = bank('water', [
    ['Water molecules are polar because', 'oxygen is more electronegative than hydrogen and pulls the shared electrons toward itself', ['the hydrogens carry full positive charges', 'water forms ionic bonds', 'the molecule is linear', 'oxygen gives its electrons to hydrogen'], 'The bent shape plus unequal sharing gives O a partial negative charge and the Hs partial positive charges.'],
    ['Water moving up through a tree’s xylem depends mainly on', 'cohesion and adhesion from hydrogen bonds', ['ionic bonds', 'high pH', 'covalent bonds between molecules', 'hydrophobic interactions'], 'Cohesion holds the water column together; adhesion to cell walls resists gravity.'],
    ['Ice floats because', 'hydrogen bonds hold the molecules farther apart, so ice is less dense than liquid water', ['ice contains trapped air', 'ice has no hydrogen bonds', 'ice molecules weigh less', 'cold water is less dense than ice'], 'Floating ice insulates the water below, letting aquatic life survive winter.'],
    ['Sweating cools the body because water has a high', 'heat of vaporization', ['density', 'pH', 'surface tension', 'molecular mass'], 'The fastest molecules evaporate and carry heat away: evaporative cooling.'],
    ['Coastal climates are milder than inland ones mainly because water has a high', 'specific heat', ['heat of vaporization only', 'density', 'surface tension', 'freezing point'], 'Water absorbs or releases a lot of heat with little temperature change.'],
    ['A substance that dissolves readily in water is', 'hydrophilic', ['hydrophobic', 'nonpolar', 'a buffer', 'an isotope'], 'Ionic and polar substances are hydrophilic; nonpolar ones such as oils are hydrophobic.'],
    ['A buffer', 'minimizes pH changes by accepting or donating H⁺ ions', ['makes any solution neutral', 'only raises pH', 'is always a strong acid', 'stops water from ionizing'], 'In blood, the carbonic acid–bicarbonate system keeps pH near 7.4.'],
    ['Ocean acidification happens because', 'CO₂ dissolves in seawater and forms carbonic acid, lowering pH', ['oxygen levels rise', 'salt concentrations fall', 'warm water raises pH', 'CO₂ acts as a base'], 'Lower pH also reduces the carbonate that corals and shellfish need.'],
    ['An acid is a substance that', 'increases the H⁺ concentration of a solution', ['increases the OH⁻ concentration', 'raises pH', 'removes H⁺ from solution', 'is always hydrophobic'], 'Acids donate H⁺, lowering pH; bases accept H⁺ or add OH⁻.']
  ]);
  function qPh() {
    const form = ri(0, 2);
    if (form === 0) { const k = ri(2, 12); return num('water', `A solution has [H⁺] = 10${sup(-k)} M. What is its pH?`, k, `pH = −log[H⁺] = −log(10${sup(-k)}) = ${k}. It is ${k < 7 ? 'acidic' : k > 7 ? 'basic' : 'neutral'}.`, 'pH is the negative of the exponent when [H⁺] is a power of ten.'); }
    if (form === 1) { const a = ri(2, 9), b = a + ri(1, 4); return num('water', `Solution A has pH ${a}; solution B has pH ${b}. How many times more H⁺ does A have than B?`, 10 ** (b - a), `Each pH unit is a tenfold change: 10${sup(b - a)} = ${(10 ** (b - a)).toLocaleString('en-US')} times more H⁺ in A (the lower pH).`, 'Take 10 to the power of the pH difference.'); }
    let p = ri(2, 12); if (p === 7) p = 9;
    const opt = n => `10${sup(-n)} M`; const ans = 14 - p;
    return mc('water', `A solution has pH ${p}. What is its [OH⁻]?`, opt(ans), [opt(p), opt(ans + 1), opt(ans - 1), opt(14 + p)], `[H⁺] = 10${sup(-p)} M and [H⁺][OH⁻] = 10${sup(-14)}, so [OH⁻] = 10${sup(-(14 - p))} M.`, 'The two exponents always add to −14.');
  }
  function qMolarity() {
    const [name, mw] = pick([['glucose (C₆H₁₂O₆)', 180], ['sucrose (C₁₂H₂₂O₁₁)', 342]]); const V = pick([0.25, 0.5, 1, 2]), C = pick([0.1, 0.2, 0.5, 1, 2]);
    const mol = C * V, g = mw * mol;
    return num('water', `How many grams of ${name}, molecular mass ${mw} g/mol, are needed to make ${V} L of a ${C} M solution?`, g, `Moles = ${C} mol/L × ${V} L = ${fmt(mol)} mol. Grams = ${fmt(mol)} mol × ${mw} g/mol = ${fmt(g)} g.`, 'Molarity × liters gives moles; moles × molecular mass gives grams.', 0.01);
  }
  const qCarbon = bank('carbon', [
    ['Carbon can form four covalent bonds because it has', 'four valence electrons', ['four protons', 'a full outer shell', 'eight valence electrons', 'a positive charge'], 'Four bonds let carbon form chains, rings and branches.'],
    ['Molecules with the same molecular formula but different structures are', 'isomers', ['isotopes', 'ions', 'polymers', 'buffers'], 'Structural isomers, cis-trans isomers and enantiomers.'],
    ['Enantiomers matter in medicine because', 'they are mirror images, and often only one form is biologically active', ['they have different formulas', 'they are radioactive', 'they cannot bind receptors', 'they are always toxic'], 'Ibuprofen and albuterol are examples where one enantiomer is the effective one.'],
    ['The –OH functional group is called', 'hydroxyl, found in alcohols', ['carbonyl', 'carboxyl', 'amino', 'sulfhydryl'], 'Hydroxyl groups are polar and make molecules more water-soluble.'],
    ['Which functional group acts as an acid by releasing H⁺?', 'Carboxyl (–COOH)', ['Amino (–NH₂)', 'Methyl (–CH₃)', 'Hydroxyl (–OH)', 'Sulfhydryl (–SH)'], 'A carboxyl group ionizes to –COO⁻ in cells.'],
    ['The amino group (–NH₂) acts as', 'a base, picking up H⁺', ['an acid', 'a nonpolar group', 'a disulfide bridge', 'an energy carrier'], 'It becomes –NH₃⁺ at cellular pH.'],
    ['Two sulfhydryl groups (–SH) can react to form', 'a disulfide bridge that stabilizes protein structure', ['a peptide bond', 'a phosphodiester bond', 'a glycosidic linkage', 'an ester bond in fats'], 'Disulfide bridges help hold a protein’s tertiary structure.'],
    ['ATP stores energy that is released when', 'its phosphate groups are removed by hydrolysis', ['its methyl groups are oxidized', 'its carboxyl group ionizes', 'its amino group picks up H⁺', 'its hydroxyl group forms a hydrogen bond'], 'ATP → ADP + phosphate releases energy that cells use for work.'],
    ['Hydrocarbons such as fats’ tails are hydrophobic because', 'their C–H bonds are nonpolar', ['they are ionic', 'they contain many oxygens', 'they hydrogen-bond with water', 'they are charged'], 'Nonpolar molecules do not interact well with water.'],
    ['Stanley Miller’s experiments showed that', 'organic molecules such as amino acids can form from inorganic ones under early-Earth conditions', ['life can arise from rocks', 'DNA forms spontaneously in water', 'carbon is made inside cells', 'organic compounds need a vital force'], 'Abiotic synthesis of organic molecules was a key step toward the origin of life.']
  ]);
  const qCarbsLipids = bank('carbs-lipids', [
    ['Monomers are joined into polymers by', 'dehydration reactions, which remove a water molecule', ['hydrolysis', 'ionization', 'denaturation', 'phosphorylation of water'], 'Hydrolysis is the reverse: water is added to break the bond.'],
    ['Starch and glycogen are digestible by humans but cellulose is not because', 'cellulose uses β glucose linkages that our enzymes cannot break', ['cellulose contains fructose', 'cellulose is a lipid', 'cellulose is made of amino acids', 'starch is made of galactose'], 'Starch and glycogen use α linkages.'],
    ['Animals store glucose as', 'glycogen, mainly in liver and muscle cells', ['starch', 'cellulose', 'chitin', 'sucrose'], 'Plants store starch; glycogen is more highly branched.'],
    ['Chitin is found in', 'arthropod exoskeletons and fungal cell walls', ['plant cell walls', 'the liver', 'cell membranes', 'DNA'], 'Chitin is a structural polysaccharide with nitrogen-containing glucose units.'],
    ['Sucrose, table sugar, is a disaccharide made of', 'glucose + fructose', ['glucose + glucose', 'glucose + galactose', 'fructose + fructose', 'ribose + glucose'], 'Maltose is glucose + glucose; lactose is glucose + galactose.'],
    ['A fat molecule (triacylglycerol) is made of', 'glycerol and three fatty acids', ['three glycerols and one fatty acid', 'glucose and fatty acids', 'a phosphate and two fatty acids', 'amino acids and glycerol'], 'Three ester linkages form, releasing three water molecules.'],
    ['Unsaturated fatty acids', 'have one or more C=C double bonds that kink the chain, so they are usually liquid at room temperature', ['have the maximum number of hydrogens', 'are solid at room temperature', 'have no double bonds', 'are a kind of protein'], 'Saturated fats, with no double bonds, pack tightly and are solid.'],
    ['Phospholipids form bilayers in water because they are', 'amphipathic: hydrophilic heads and hydrophobic tails', ['fully hydrophobic', 'fully hydrophilic', 'ionic crystals', 'polymers of glucose'], 'The tails face inward, away from water.'],
    ['Cholesterol and the sex hormones are steroids, lipids built from', 'four fused carbon rings', ['glycerol and three fatty acids', 'chains of amino acids', 'nucleotides', 'glucose rings'], 'Cholesterol is also a component of animal cell membranes.'],
    ['Lipids are not considered true polymers because', 'they are not built from repeating monomer units', ['they contain no carbon', 'they dissolve in water', 'they are made by hydrolysis', 'they are too small to matter'], 'Lipids are grouped by being hydrophobic, not by structure.']
  ]);
  function qPolymer() {
    const form = ri(0, 2);
    if (form === 0) { const n = pick([3, 4, 5, 6, 8, 10, 12, 50, 100, 500]); return num('carbs-lipids', `How many water molecules are released when ${n} glucose monomers are joined into one unbranched chain?`, n - 1, `Each dehydration reaction joins two units and releases one water; a chain of ${n} has ${n - 1} linkages, so ${n - 1} waters.`, 'Count the bonds between units, not the units.'); }
    if (form === 1) { const n = pick([4, 6, 10, 20, 100]); return num('carbs-lipids', `How many water molecules are used to completely hydrolyze an unbranched polysaccharide of ${n} glucose units into free glucose?`, n - 1, `Each of the ${n - 1} glycosidic linkages needs one water to break.`, 'Hydrolysis adds one water per bond broken.'); }
    const x = ri(1, 5); return num('carbs-lipids', `How many water molecules are released when ${x === 1 ? 'one fat molecule forms' : `${x} fat molecules form`} from glycerol and fatty acids?`, 3 * x, `Each triacylglycerol has three ester linkages, each releasing one water: 3 × ${x} = ${3 * x}.`, 'One glycerol joins three fatty acids.');
  }
  const qProteins = bank('proteins', [
    ['Amino acids differ from one another in their', 'R groups (side chains)', ['amino groups', 'carboxyl groups', 'alpha carbons', 'peptide bonds'], 'The R group determines an amino acid’s chemical properties.'],
    ['A peptide bond links', 'the carboxyl group of one amino acid to the amino group of the next', ['two R groups', 'two amino groups', 'a sugar and a phosphate', 'glycerol and a fatty acid'], 'It forms by dehydration.'],
    ['An α helix or β pleated sheet is', 'secondary structure, held by hydrogen bonds between backbone atoms', ['primary structure', 'tertiary structure', 'quaternary structure', 'a disulfide bridge'], 'R groups do not form secondary structure; the backbone does.'],
    ['Hemoglobin, with four polypeptide chains, has', 'quaternary structure', ['only primary structure', 'no tertiary structure', 'only secondary structure', 'no hydrogen bonds'], 'Quaternary structure exists only when two or more polypeptides combine.'],
    ['Sickle-cell disease results from', 'a single amino acid substitution in hemoglobin', ['a missing chromosome', 'a defect in a lipid', 'a change in a carbohydrate', 'too much iron in the diet'], 'Valine replaces glutamic acid, and the proteins clump into fibers.'],
    ['Denaturation', 'unravels a protein’s shape, for example from heat, pH or salt changes', ['breaks every peptide bond', 'adds amino acids to the chain', 'changes the gene', 'always reverses itself'], 'The primary structure stays; the shape and function are lost.'],
    ['Chaperonins', 'help proteins fold properly', ['cut proteins into amino acids', 'carry amino acids to ribosomes', 'store proteins', 'add sugars to proteins'], 'They shelter the polypeptide from the crowded cytoplasm while it folds.'],
    ['Which is <b>not</b> a typical function of proteins?', 'Storing hereditary information', ['Speeding up reactions (enzymes)', 'Transport (hemoglobin)', 'Defense (antibodies)', 'Structural support (collagen)'], 'Hereditary information is stored in nucleic acids.'],
    ['Tertiary structure results from', 'interactions among R groups, such as hydrophobic interactions, ionic bonds and disulfide bridges', ['hydrogen bonds between backbone atoms only', 'the amino acid sequence alone', 'joining two polypeptides', 'peptide bonds'], 'It is the overall three-dimensional shape of one polypeptide.']
  ]);
  function qPeptide() {
    if (Math.random() < 0.6) { const n = pick([3, 5, 10, 25, 51, 100, 141, 300]); return num('proteins', `How many peptide bonds are in a single polypeptide of ${n} amino acids?`, n - 1, `A chain of ${n} amino acids has ${n - 1} peptide bonds, and forming them released ${n - 1} water molecules.`, 'Bonds sit between neighbors, so there is one fewer than the units.'); }
    const k = ri(2, 4); return num('proteins', `Using the 20 common amino acids, how many different sequences are possible for a peptide ${k} amino acids long?`, 20 ** k, `Each position can be any of 20: 20${sup(k)} = ${(20 ** k).toLocaleString('en-US')}.`, 'Multiply the choices for each position.');
  }
  const qNucleic = bank('nucleic', [
    ['The sugar in DNA is', 'deoxyribose', ['ribose', 'glucose', 'fructose', 'galactose'], 'RNA uses ribose, which has one more –OH.'],
    ['Which base is found in RNA but not in DNA?', 'Uracil', ['Thymine', 'Adenine', 'Guanine', 'Cytosine'], 'RNA uses U in place of T.'],
    ['Adenine and guanine are', 'purines, with two rings', ['pyrimidines, with one ring', 'pyrimidines, with two rings', 'sugars', 'amino acids'], 'C, T and U are pyrimidines.'],
    ['Nucleotides in one strand are linked by', 'phosphodiester linkages between sugar and phosphate', ['peptide bonds', 'hydrogen bonds', 'glycosidic linkages between bases', 'ionic bonds'], 'This builds the sugar-phosphate backbone.'],
    ['The two strands of a DNA double helix are held together by', 'hydrogen bonds between complementary bases', ['covalent bonds between bases', 'peptide bonds', 'phosphodiester linkages', 'disulfide bridges'], 'A–T pairs form 2 hydrogen bonds and G–C pairs form 3.'],
    ['The usual flow of genetic information is', 'DNA → RNA → protein', ['protein → RNA → DNA', 'RNA → DNA → protein', 'DNA → protein → RNA', 'protein → DNA → RNA'], 'Transcription makes RNA from DNA; translation makes protein from mRNA.'],
    ['The 5′ end of a nucleic acid strand has a free', 'phosphate group', ['hydroxyl group', 'base', 'amino group', 'methyl group'], 'The 3′ end has a free hydroxyl.'],
    ['Comparing DNA sequences between species lets biologists', 'estimate how closely related the species are', ['change the species’ phenotypes', 'measure their body size', 'find their age', 'stop mutations'], 'More closely related species share more of their sequences.']
  ]);
  function qComplement() {
    let s, rc, cm, rs;
    for (let t = 0; t < 50; t++) { s = randSeq(8); cm = comp(s); rc = rev(cm); rs = rev(s); if (new Set([rc, cm, rs, s]).size === 4) break; }
    return mc('nucleic', `One DNA strand reads ${end5(s)}. Which is its complementary strand, written 5′ → 3′?`, end5(rc), [end5(cm), end5(rs), end5(toRna(rc)), end5(s)], `Pair A–T and G–C: under the original the complement reads ${end3(cm)}. Written from its 5′ end it is ${end5(rc)}.`, 'Complement each base, then flip the order so the 5′ end comes first.');
  }
  function qHbonds() {
    const s = randSeq(ri(8, 14)); const at = (s.match(/[AT]/g) || []).length, gc = s.length - at;
    return num('nucleic', `One strand of a DNA segment reads ${end5(s)}. How many hydrogen bonds hold this segment to its complementary strand?`, 2 * at + 3 * gc, `${at} A–T pairs × 2 + ${gc} G–C pairs × 3 = ${2 * at + 3 * gc}.`, 'A–T pairs have 2 hydrogen bonds; G–C pairs have 3.');
  }

  /* ---------- Unit 2: energy and the cell ---------- */
  const qEnergy = bank('energy', [
    ['Cellular respiration is an example of', 'a catabolic pathway', ['an anabolic pathway', 'an endergonic process', 'a reaction at equilibrium', 'a closed system'], 'Catabolic pathways break molecules down and release energy.'],
    ['The first law of thermodynamics says that', 'energy can be transferred or transformed but not created or destroyed', ['entropy always decreases', 'cells create energy', 'heat is never produced', 'all reactions are spontaneous'], 'Cells convert chemical energy into other forms.'],
    ['According to the second law of thermodynamics, every energy transfer', 'increases the entropy of the universe, with some energy lost as heat', ['decreases entropy everywhere', 'is 100% efficient', 'creates new energy', 'removes heat from the universe'], 'Order in a cell is paid for by greater disorder in the surroundings.'],
    ['An exergonic reaction', 'releases free energy (ΔG &lt; 0) and occurs spontaneously', ['absorbs free energy (ΔG &gt; 0)', 'has ΔG = 0', 'never needs activation energy', 'only happens with enzymes'], 'Spontaneous means energetically favorable, not necessarily fast.'],
    ['A cell that has reached metabolic equilibrium', 'is dead, because it can no longer do work', ['works most efficiently', 'has maximum free energy', 'is growing quickly', 'is dividing'], 'Living cells stay away from equilibrium by constantly supplying reactants and removing products.'],
    ['Chemical energy is a form of', 'potential energy stored in molecular structure', ['kinetic energy of motion', 'heat', 'light energy', 'entropy'], 'Breaking and rearranging bonds releases it.'],
    ['Spontaneous, in the sense of ΔG, means that a reaction', 'can proceed without an energy input, though it may be slow', ['happens instantly', 'needs no enzyme ever', 'absorbs heat', 'only happens outside cells'], 'Rust forms spontaneously but slowly.'],
    ['Energy coupling in cells means', 'using an exergonic process to drive an endergonic one', ['using two endergonic reactions together', 'creating energy from nothing', 'storing heat for later', 'reaching equilibrium quickly'], 'ATP hydrolysis is the usual exergonic partner.']
  ]);
  function qDeltaG() {
    if (Math.random() < 0.6) {
      const x = pick([3.4, 2.5, 4.2, 5.1, 6.0, 9.2, 11.4, 13.0]); const k = x < 7.3 ? 1 : pick([1, 2, 2]); const net = Math.round((x - 7.3 * k) * 10) / 10;
      return num('energy', `A reaction has ΔG = +${x} kcal/mol. It is coupled to the hydrolysis of ${k} ATP (ΔG = −7.3 kcal/mol each). What is the overall ΔG, in kcal/mol?`, net, `+${x} + ${k} × (−7.3) = ${fmt(net)} kcal/mol. ${net < 0 ? 'Negative, so the coupled process is exergonic and spontaneous.' : 'Still positive, so the coupled process is not spontaneous; it would need more ATP.'}`, 'ΔG values of coupled reactions add.', 0.02);
    }
    const v = pick(['−686', '+686', '−7.3', '+3.4', '0', '−2.8', '+7.3']); const neg = v[0] === '−', zero = v === '0';
    const ans = zero ? 'At equilibrium: no net change and no work can be done' : neg ? 'Exergonic and spontaneous' : 'Endergonic and not spontaneous';
    return mc('energy', `A reaction has ΔG = ${v} kcal/mol. It is`, ans, ['Exergonic and spontaneous', 'Endergonic and not spontaneous', 'At equilibrium: no net change and no work can be done', 'Exergonic but not spontaneous', 'Endergonic and spontaneous'].filter(o => o !== ans), `Negative ΔG releases free energy (exergonic, spontaneous); positive ΔG requires energy (endergonic); ΔG = 0 means equilibrium.`, 'Look only at the sign of ΔG.');
  }
  const qEnzymes = bank('enzymes', [
    ['Enzymes speed up reactions by', 'lowering the activation energy', ['making ΔG more negative', 'adding energy to the reactants', 'raising the temperature', 'shifting the equilibrium'], 'Enzymes do not change ΔG; they change how fast equilibrium is reached.'],
    ['An enzyme’s substrate binds at the', 'active site', ['allosteric site only', 'cofactor', 'ribosome', 'promoter'], 'The active site’s shape and chemistry fit the substrate.'],
    ['“Induced fit” means that', 'the active site changes shape slightly to grip the substrate more tightly', ['the substrate changes into the enzyme', 'every enzyme fits every substrate', 'the enzyme is used up', 'the product binds first'], 'Binding brings chemical groups into position to catalyze the reaction.'],
    ['A competitive inhibitor', 'binds the active site, and its effect can be overcome by adding more substrate', ['binds elsewhere and changes the enzyme’s shape', 'is always irreversible', 'is a cofactor', 'raises the enzyme’s optimum temperature'], 'It competes directly with the substrate.'],
    ['A noncompetitive inhibitor', 'binds away from the active site and changes the enzyme’s shape', ['mimics the substrate', 'is overcome by more substrate', 'lowers activation energy', 'is the enzyme’s product only'], 'Adding more substrate does not restore the rate.'],
    ['Adding more substrate restores an inhibited enzyme’s rate. The inhibitor is most likely', 'competitive', ['noncompetitive', 'a denaturing agent', 'an irreversible poison', 'a cofactor'], 'Only a competitive inhibitor can be outcompeted by the substrate.'],
    ['Most human enzymes work best near', '37 °C and a pH of about 6–8', ['0 °C and pH 2', '70 °C and pH 7', '100 °C', 'any temperature above 50 °C'], 'Pepsin in the stomach, with an optimum near pH 2, is an exception.'],
    ['ATP powers most cellular work by', 'phosphorylation: transferring a phosphate group to another molecule', ['releasing heat directly', 'breaking into glucose', 'donating electrons to oxygen', 'binding DNA'], 'The phosphorylated molecule becomes more reactive.'],
    ['In feedback inhibition,', 'the end product of a pathway inhibits an enzyme early in the pathway', ['the substrate activates the last enzyme', 'the first product speeds up the pathway', 'enzymes are destroyed', 'heat stops the pathway'], 'It keeps the cell from making more product than it needs.'],
    ['Nonprotein helpers of enzymes, such as zinc or iron, are called', 'cofactors (organic ones are coenzymes)', ['substrates', 'inhibitors', 'products', 'allosteric sites'], 'Many vitamins act as coenzymes or their precursors.']
  ]);
  const qRespiration = bank('respiration', [
    ['Glycolysis takes place in the', 'cytosol', ['mitochondrial matrix', 'inner mitochondrial membrane', 'nucleus', 'chloroplast'], 'Glycolysis does not need oxygen or mitochondria.'],
    ['The citric acid cycle takes place in the', 'mitochondrial matrix', ['cytosol', 'intermembrane space', 'outer membrane', 'nucleus'], 'Pyruvate oxidation also happens in the matrix.'],
    ['The final electron acceptor of the electron transport chain is', 'oxygen, which forms water', ['NAD⁺', 'pyruvate', 'glucose', 'carbon dioxide'], 'Without O₂ the chain backs up and stops.'],
    ['In cellular respiration, glucose is ___ and oxygen is ___.', 'oxidized; reduced', ['reduced; oxidized', 'oxidized; oxidized', 'reduced; reduced', 'hydrolyzed; phosphorylated'], 'Glucose loses electrons (with H) and O₂ gains them to form water.'],
    ['During chemiosmosis, ATP is made as', 'H⁺ flows back across the inner membrane through ATP synthase', ['electrons flow through ATP synthase', 'glucose enters the mitochondrion', 'CO₂ leaves the cell', 'NAD⁺ is reduced in glycolysis'], 'The electron transport chain builds the H⁺ gradient; ATP synthase uses it.'],
    ['Fermentation lets glycolysis continue without oxygen by', 'regenerating NAD⁺', ['making extra ATP from pyruvate', 'using oxygen as an electron acceptor', 'producing FADH₂', 'making glucose'], 'Fermentation yields only the 2 ATP of glycolysis.'],
    ['Most of the ATP made from a glucose molecule comes from', 'oxidative phosphorylation', ['glycolysis', 'the citric acid cycle', 'fermentation', 'pyruvate oxidation'], 'About 26–28 of the roughly 30–32 ATP.'],
    ['Cyanide blocks the last step of the electron transport chain. The result is that', 'the H⁺ gradient is not maintained and most ATP production stops', ['glycolysis stops at once', 'more ATP is produced', 'CO₂ is converted to O₂', 'fermentation becomes impossible'], 'ATP synthase depends on the gradient the chain builds.'],
    ['Yeast growing without oxygen produce', 'ethanol and CO₂', ['lactate only', 'water and O₂', 'glucose', 'acetyl CoA only'], 'That is alcohol fermentation; human muscle makes lactate.'],
    ['Substrate-level phosphorylation means', 'an enzyme transfers a phosphate from a substrate directly to ADP', ['ATP synthase uses an H⁺ gradient', 'light energy makes ATP', 'NADH is made', 'oxygen is reduced'], 'It happens in glycolysis and the citric acid cycle.']
  ]);
  function qRespCount() {
    const ST = { 'glycolysis': { 'net ATP': 2, NADH: 2 }, 'pyruvate oxidation': { NADH: 2, 'CO₂': 2 }, 'the citric acid cycle': { ATP: 2, NADH: 6, 'FADH₂': 2, 'CO₂': 4 } };
    const n = ri(1, 5); const form = ri(0, 2);
    const g = n === 1 ? 'one glucose molecule' : `${n} glucose molecules`;
    if (form === 0) { const st = pick(Object.keys(ST)); const pr = pick(Object.keys(ST[st])); const per = ST[st][pr]; return num('respiration', `How many ${pr} are produced by ${st} from ${g}?`, per * n, `Per glucose, ${st} gives ${Object.entries(ST[st]).map(([k, v]) => `${v} ${k}`).join(', ')}. For ${n}: ${per} × ${n} = ${per * n}.`, 'Remember each glucose makes two pyruvates, so later stages run twice per glucose.'); }
    if (form === 1) { const [pr, per, why] = pick([['CO₂ molecules', 6, '2 from pyruvate oxidation + 4 from the citric acid cycle'], ['NADH', 10, '2 (glycolysis) + 2 (pyruvate oxidation) + 6 (citric acid cycle)'], ['FADH₂', 2, 'all from the citric acid cycle'], ['O₂ molecules consumed', 6, 'C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O']]); return num('respiration', `In total, how many ${pr} does complete aerobic respiration of ${g} involve?`, per * n, `Per glucose: ${per} (${why}). For ${n}: ${per * n}.`, 'Add up the stages, then multiply by the number of glucose molecules.'); }
    if (Math.random() < 0.5) { const t = ri(1, 6); const [pr, per] = pick([['NADH', 3], ['FADH₂', 1], ['ATP', 1], ['CO₂', 2]]); return num('respiration', `How many ${pr} are produced by ${t} turn${t > 1 ? 's' : ''} of the citric acid cycle?`, per * t, `Each turn makes 3 NADH, 1 FADH₂, 1 ATP and 2 CO₂. ${per} × ${t} = ${per * t}.`, 'One glucose gives two turns; here count per turn.'); }
    return num('respiration', `Muscle cells without oxygen ferment ${g} to lactate. How many net ATP do they gain?`, 2 * n, `Fermentation only gets the 2 net ATP of glycolysis per glucose: 2 × ${n} = ${2 * n}.`, 'Fermentation adds no ATP beyond glycolysis.');
  }
  const qCells = bank('cells', [
    ['Ribosomes are made of', 'rRNA and protein', ['DNA and protein', 'lipids and carbohydrates', 'mRNA only', 'phospholipids'], 'They are not membrane-bound, so prokaryotes have them too.'],
    ['Proteins made on the rough ER are usually', 'secreted, placed in membranes or sent to lysosomes', ['used only in the cytosol', 'stored in the nucleus', 'turned into lipids', 'broken down immediately'], 'Free ribosomes make proteins that work in the cytosol.'],
    ['The smooth ER', 'makes lipids, metabolizes carbohydrates and detoxifies drugs', ['makes proteins for secretion', 'digests old organelles', 'makes ATP', 'stores DNA'], 'Liver cells have a lot of smooth ER.'],
    ['The Golgi apparatus', 'modifies, sorts and ships products from the ER', ['makes ribosomes', 'produces ATP', 'digests bacteria', 'replicates DNA'], 'Its cis face receives vesicles; its trans face ships them.'],
    ['Lysosomes', 'digest macromolecules and old organelles with hydrolytic enzymes', ['make ATP', 'photosynthesize', 'make lipids', 'transcribe DNA'], 'Their enzymes work best at the acidic pH inside the lysosome.'],
    ['The endosymbiont theory proposes that mitochondria and chloroplasts', 'descend from prokaryotes engulfed by an ancestral cell', ['formed from the Golgi apparatus', 'came from viruses', 'evolved from the nucleus', 'appeared only in animals'], 'Evidence: double membranes, their own circular DNA and bacteria-like ribosomes.'],
    ['Which structure is found in plant cells but not in animal cells?', 'Chloroplast', ['Mitochondrion', 'Ribosome', 'Golgi apparatus', 'Plasma membrane'], 'Plant cells also have a cell wall and a central vacuole.'],
    ['Microtubules', 'form the mitotic spindle, cilia and flagella and act as tracks for vesicles', ['are the thinnest cytoskeleton fibers, made of actin', 'store DNA', 'make ATP', 'digest proteins'], 'Actin microfilaments are the thinnest; intermediate filaments are in between.'],
    ['Nuclear pores', 'regulate traffic between the nucleus and the cytoplasm', ['make ribosomes', 'replicate DNA', 'digest RNA', 'produce ATP'], 'mRNA and ribosomal subunits leave through them.'],
    ['Which structure do both prokaryotic and eukaryotic cells have?', 'Ribosomes', ['A nucleus', 'Mitochondria', 'Endoplasmic reticulum', 'Golgi apparatus'], 'All cells also share a plasma membrane, cytoplasm and DNA.'],
    ['Cells are small mainly because', 'a small cell has a high surface-to-volume ratio for exchanging materials', ['DNA cannot fit in large cells', 'large cells cannot have membranes', 'microscopes require it', 'ribosomes limit their size'], 'Volume grows faster than surface area as a cell gets bigger.']
  ]);
  function qSurfaceVolume() {
    const s = pick([1, 2, 3, 4, 5, 6, 10]); const form = ri(0, 2);
    if (form === 0) return num('cells', `A cube-shaped cell is ${s} µm on each side. What is its surface area, in µm²?`, 6 * s * s, `Surface area = 6 × side² = 6 × ${s * s} = ${6 * s * s} µm².`, 'A cube has six square faces.');
    if (form === 1) return num('cells', `A cube-shaped cell is ${s} µm on each side. What is its volume, in µm³?`, s ** 3, `Volume = side³ = ${s}³ = ${s ** 3} µm³.`, 'Multiply length × width × height.');
    return num('cells', `A cube-shaped cell is ${s} µm on each side. What is its surface-to-volume ratio (per µm)?`, 6 / s, `Surface area ${6 * s * s} µm² ÷ volume ${s ** 3} µm³ = ${fmt(6 / s)} per µm. For a cube the ratio is 6 ÷ side, so it shrinks as the cell grows.`, 'Divide surface area (6s²) by volume (s³).', 0.01);
  }
  const qMembranes = bank('membranes', [
    ['The fluid mosaic model describes a membrane as', 'a fluid phospholipid bilayer with proteins embedded in or attached to it', ['a rigid protein sheet', 'a single layer of lipids', 'a layer of carbohydrates', 'a double layer of proteins with lipids between'], 'Lipids and many proteins can drift laterally.'],
    ['Cholesterol in animal cell membranes', 'buffers fluidity, restraining movement when warm and preventing tight packing when cold', ['makes membranes rigid at all temperatures', 'carries glucose across', 'is a transport protein', 'only occurs in plants'], 'It acts as a fluidity buffer.'],
    ['Which crosses a phospholipid bilayer most easily without help?', 'O₂', ['Glucose', 'Na⁺', 'A protein', 'H⁺'], 'Small nonpolar molecules dissolve in the bilayer; ions and large polar molecules need transport proteins.'],
    ['Aquaporins are', 'channel proteins that let water cross membranes quickly', ['sugar pumps', 'lipid rafts', 'receptors for hormones', 'enzymes that split water'], 'They greatly speed osmosis in kidney and plant cells.'],
    ['Facilitated diffusion', 'moves substances down their concentration gradient through transport proteins without using ATP', ['moves substances against their gradient using ATP', 'uses vesicles', 'only moves water', 'requires a cotransporter'], 'It is passive transport.'],
    ['The sodium-potassium pump moves', '3 Na⁺ out and 2 K⁺ in for each ATP', ['2 Na⁺ out and 3 K⁺ in', '3 Na⁺ in and 2 K⁺ out', 'Na⁺ and K⁺ down their gradients', 'glucose into the cell'], 'This active transport builds a membrane potential.'],
    ['In cotransport, such as the sucrose–H⁺ cotransporter,', 'the downhill flow of one solute drives the uphill movement of another', ['both solutes move down their gradients', 'ATP binds the sugar directly', 'water moves against its gradient', 'vesicles carry the solutes'], 'A pump first builds the H⁺ gradient that powers it.'],
    ['A white blood cell engulfing a bacterium is performing', 'phagocytosis', ['pinocytosis', 'exocytosis', 'receptor-mediated endocytosis', 'osmosis'], 'Phagocytosis is “cellular eating.”'],
    ['Cells take in cholesterol-carrying LDL particles by', 'receptor-mediated endocytosis', ['phagocytosis', 'simple diffusion', 'exocytosis', 'active transport pumps'], 'In familial hypercholesterolemia the LDL receptors are defective.'],
    ['Exocytosis', 'releases materials when vesicles fuse with the plasma membrane', ['brings materials into the cell', 'moves ions through channels', 'is a kind of diffusion', 'only happens in plants'], 'Nerve cells release neurotransmitters this way.']
  ]);
  function qTonicity() {
    const form = ri(0, 2);
    if (form === 0) {
      const out = pick([0, 0.2, 0.45, 0.9, 2, 3, 5]); const type = out < 0.9 ? 'hypo' : out > 0.9 ? 'hyper' : 'iso';
      const O = { hypo: 'Hypotonic: water enters, and the cell swells and may burst (lyse)', iso: 'Isotonic: no net water movement, so the cell stays normal', hyper: 'Hypertonic: water leaves, and the cell shrivels (crenates)' };
      const wrong = 'Hypertonic: water enters, and the cell swells and may burst';
      return mc('membranes', `A red blood cell (about 0.9% salt inside) is placed in ${out === 0 ? 'distilled water' : `a ${out}% salt solution`}. Which describes the solution and what happens?`, O[type], [O.hypo, O.iso, O.hyper, wrong].filter(x => x !== O[type]), `Water moves by osmosis toward the higher solute concentration. The solution is ${type}tonic to the cell. Animal cells have no wall, so they ${type === 'hypo' ? 'can burst' : type === 'hyper' ? 'shrivel' : 'stay the same'}.`, 'Compare solute inside and outside; water follows the solute.');
    }
    if (form === 1) {
      const out = pick([0, 0.1, 0.3, 0.6, 1.0]); const type = out < 0.3 ? 'hypo' : out > 0.3 ? 'hyper' : 'iso';
      const O = { hypo: 'Turgid (firm), the healthy state for most plant cells', iso: 'Flaccid (limp)', hyper: 'Plasmolyzed: the membrane pulls away from the cell wall' };
      return mc('membranes', `A plant cell whose contents are about 0.3 M solute is placed in ${out === 0 ? 'pure water' : `a ${out} M sucrose solution`}. What happens to the cell?`, O[type], [O.hypo, O.iso, O.hyper, 'It bursts (lyses)'].filter(x => x !== O[type]), `The solution is ${type}tonic to the cell. ${type === 'hypo' ? 'Water enters, but the cell wall pushes back, so the cell becomes turgid rather than bursting.' : type === 'hyper' ? 'Water leaves and the membrane pulls away from the wall.' : 'With no net water movement the cell is flaccid.'}`, 'Plant cells have walls, so they do not burst.');
    }
    const a = pick([0.1, 0.2, 0.5, 1.0]); let b = pick([0.1, 0.2, 0.5, 1.0]); if (Math.random() < 0.8) while (b === a) b = pick([0.1, 0.2, 0.5, 1.0]);
    const ans = a > b ? 'Water moves from side B to side A' : a < b ? 'Water moves from side A to side B' : 'No net water movement';
    return mc('membranes', `A U-tube is divided by a membrane that water can cross but sucrose cannot. Side A holds ${a} M sucrose and side B holds ${b} M sucrose. What happens?`, ans, ['Water moves from side A to side B', 'Water moves from side B to side A', 'No net water movement', 'Sucrose moves until both sides are equal'].filter(x => x !== ans), `Water moves toward the side with more solute (${a === b ? 'here they are equal' : `side ${a > b ? 'A' : 'B'}`}). Sucrose cannot cross this membrane.`, 'Water follows solute.');
  }

  /* ---------- Unit 3: cell division and inheritance ---------- */
  const ORGS = [['human', 46], ['fruit fly', 8], ['pea', 14], ['corn', 20], ['dog', 78], ['house cat', 38], ['chimpanzee', 48], ['onion', 16], ['mouse', 40]];
  const qMitosis = bank('mitosis', [
    ['DNA is replicated during', 'the S phase of interphase', ['G1', 'G2', 'prophase', 'metaphase'], 'After S, each chromosome has two sister chromatids.'],
    ['Sister chromatids separate during', 'anaphase', ['prophase', 'metaphase', 'telophase', 'prometaphase'], 'Each chromatid then counts as its own chromosome.'],
    ['Chromosomes line up at the middle of the cell during', 'metaphase', ['prophase', 'anaphase', 'telophase', 'G2'], 'The metaphase plate is an imaginary plane, not a structure.'],
    ['In animal cells, cytokinesis happens by', 'a cleavage furrow pinched in by a ring of actin microfilaments', ['a cell plate', 'the Golgi forming a wall', 'binary fission', 'spindle fibers cutting the cell'], 'Plant cells build a cell plate instead.'],
    ['Kinetochores are', 'protein structures at the centromere where spindle microtubules attach', ['the ends of chromosomes', 'organelles that make ATP', 'pieces of the nuclear envelope', 'RNA molecules'], 'Each sister chromatid has its own kinetochore.'],
    ['The G1 checkpoint', 'decides whether the cell divides or exits into G0', ['separates sister chromatids', 'replicates DNA', 'forms the cleavage furrow', 'happens after cytokinesis'], 'Many mature nerve and muscle cells stay in G0.'],
    ['Cyclins and cyclin-dependent kinases (Cdks)', 'form complexes such as MPF that drive the cell past checkpoints', ['cut DNA', 'make ATP', 'build microtubules only', 'are found only in cancer cells'], 'Cyclin levels rise and fall through the cycle.'],
    ['Cancer cells differ from normal cells because they', 'ignore controls such as density-dependent inhibition and anchorage dependence', ['never divide', 'have no DNA', 'always stop at G1', 'cannot make proteins'], 'Mutations in genes that regulate the cycle let them divide unchecked.'],
    ['Bacteria divide by', 'binary fission', ['mitosis', 'meiosis', 'forming a cell plate', 'crossing over'], 'The single circular chromosome is copied and the copies move apart.'],
    ['Mitosis followed by cytokinesis produces', 'two genetically identical daughter cells', ['four genetically different cells', 'two haploid gametes', 'one larger cell', 'four identical cells'], 'Mitosis is for growth, repair and asexual reproduction.']
  ]);
  function qMitosisCount() {
    const [org, d] = pick(ORGS);
    const Q = [[`chromosomes are in one of its cells in G1`, d, `Before replication, a body cell has 2n = ${d} chromosomes, each a single DNA molecule.`], [`chromatids are in one of its cells in G2, after the S phase`, 2 * d, `Each of the ${d} chromosomes now has two sister chromatids: ${2 * d}.`], [`chromosomes are in one of its cells at metaphase of mitosis`, d, `Count centromeres: still ${d} chromosomes, each with two chromatids.`], [`chromatids are in one of its cells at metaphase of mitosis`, 2 * d, `${d} chromosomes × 2 chromatids = ${2 * d}.`], [`chromosomes are in one of its cells during anaphase of mitosis, counting each separated chromatid as a chromosome`, 2 * d, `The sisters have separated, so there are ${2 * d} chromosomes until cytokinesis.`], [`chromosomes are in each daughter cell after mitosis`, d, `Mitosis keeps the number: each daughter has 2n = ${d}.`]];
    const [txt, ans, ex] = pick(Q);
    return num('mitosis', `A ${org} body cell has 2n = ${d}. How many ${txt}?`, ans, ex, 'Count centromeres for chromosomes; after S phase each chromosome carries two chromatids.');
  }
  const qMeiosis = bank('meiosis', [
    ['Homologous chromosomes separate during', 'anaphase I', ['anaphase II', 'metaphase I', 'anaphase of mitosis', 'prophase II'], 'Sister chromatids separate later, in anaphase II.'],
    ['Crossing over occurs during', 'prophase I', ['metaphase II', 'anaphase I', 'telophase II', 'interphase'], 'Non-sister chromatids of homologs exchange segments at chiasmata.'],
    ['Meiosis produces', 'four genetically different haploid cells', ['two identical diploid cells', 'four identical diploid cells', 'two haploid cells', 'one egg and no other cells'], 'In females, only one of the four becomes an egg; the rest are polar bodies.'],
    ['Synapsis is', 'the pairing of homologous chromosomes in prophase I', ['the separation of sister chromatids', 'the joining of sperm and egg', 'DNA replication', 'the division of the cytoplasm'], 'Paired homologs form a tetrad (bivalent).'],
    ['The three main sources of genetic variation from sexual reproduction are', 'crossing over, independent assortment and random fertilization', ['mitosis, cytokinesis and interphase', 'transcription, translation and replication', 'mutation, binary fission and budding', 'only crossing over'], 'Mutation is the original source of new alleles.'],
    ['Which event happens in meiosis but not in mitosis?', 'Homologous chromosomes pair and exchange segments', ['Sister chromatids separate', 'The nuclear envelope breaks down', 'A spindle forms', 'DNA is replicated beforehand'], 'Synapsis and crossing over are unique to meiosis I.'],
    ['In the human life cycle, meiosis produces ___ and mitosis produces ___.', 'gametes; body cells for growth and repair', ['body cells; gametes', 'zygotes; gametes', 'diploid gametes; haploid body cells', 'spores; zygotes'], 'Fertilization restores the diploid number in the zygote.'],
    ['Nondisjunction is', 'the failure of homologs or sister chromatids to separate, producing gametes with extra or missing chromosomes', ['crossing over between sisters', 'normal separation in anaphase', 'the fusion of two eggs', 'replication of a single gene'], 'It causes aneuploidy such as trisomy 21.'],
    ['After meiosis I, each cell is', 'haploid, though each chromosome still has two chromatids', ['diploid with single chromatids', 'diploid with two chromatids per chromosome', 'haploid with single chromatids', 'tetraploid'], 'Meiosis II then separates the sister chromatids.']
  ]);
  function qMeiosisCount() {
    const [org, d] = pick(ORGS); const n = d / 2;
    const Q = [[`chromosomes are in one of its gametes`, n, `Gametes are haploid: n = ${d} ÷ 2 = ${n}.`], [`tetrads (pairs of homologs) form in prophase I`, n, `Each homologous pair forms one tetrad: ${n}.`], [`chromatids are in a cell at metaphase I`, 2 * d, `${d} chromosomes × 2 chromatids = ${2 * d}.`], [`chromosomes are in each cell right after meiosis I`, n, `Homologs separated, so each cell has n = ${n} chromosomes (each still with two chromatids).`], [`chromatids are in each cell at metaphase II`, d, `${n} chromosomes × 2 chromatids = ${d}.`]];
    if (n <= 23) Q.push([`combinations of maternal and paternal chromosomes are possible in its gametes from independent assortment alone`, 2 ** n, `Each of the n = ${n} pairs lines up independently: 2${sup(n)} = ${(2 ** n).toLocaleString('en-US')}.`]);
    const [txt, ans, ex] = pick(Q);
    return num('meiosis', `A ${org} has 2n = ${d}. How many ${txt}?`, ans, ex, 'Meiosis I separates homologs (halving the number); meiosis II separates sister chromatids.');
  }
  const qMendel = bank('mendel', [
    ['Mendel’s law of segregation states that', 'the two alleles for a gene separate during gamete formation', ['genes on different chromosomes are inherited together', 'dominant alleles are always more common', 'alleles blend in the offspring', 'each gamete gets both alleles'], 'Each gamete gets one allele of each gene.'],
    ['The law of independent assortment applies to genes that', 'are on different chromosomes or far apart on the same one', ['are close together on one chromosome', 'are on the X chromosome only', 'have only one allele', 'are always dominant'], 'Linked genes do not assort independently.'],
    ['A testcross crosses an individual showing the dominant phenotype with', 'a homozygous recessive individual', ['a homozygous dominant individual', 'a heterozygote', 'itself', 'an individual from another species'], 'Any recessive offspring reveal that the parent was heterozygous.'],
    ['Red × white snapdragons give all pink offspring. This is', 'incomplete dominance', ['codominance', 'pleiotropy', 'epistasis', 'polygenic inheritance'], 'The heterozygote is intermediate.'],
    ['Type AB blood, with both A and B antigens on red cells, shows', 'codominance', ['incomplete dominance', 'epistasis', 'polygenic inheritance', 'sex linkage'], 'Both alleles are fully expressed.'],
    ['One gene affecting many traits, as in sickle-cell disease, is', 'pleiotropy', ['epistasis', 'codominance', 'polygenic inheritance', 'linkage'], 'The sickle allele affects blood, organs, pain and malaria resistance.'],
    ['One gene masking the expression of another, as with Labrador coat color, is', 'epistasis', ['pleiotropy', 'codominance', 'incomplete dominance', 'multiple alleles'], 'In Labs, ee dogs are yellow no matter which alleles they have at the B gene.'],
    ['Human height, controlled by many genes plus the environment, is', 'polygenic inheritance', ['codominance', 'pleiotropy', 'sex linkage', 'incomplete dominance'], 'Polygenic traits show continuous variation.'],
    ['The typical F₂ phenotype ratio from Mendel’s monohybrid crosses was', '3:1', ['1:2:1', '9:3:3:1', '1:1', 'all dominant'], '1:2:1 is the genotype ratio; 9:3:3:1 is for a dihybrid cross.'],
    ['An organism’s observable traits are its', 'phenotype', ['genotype', 'alleles', 'karyotype', 'genome'], 'The genotype is its genetic makeup.']
  ]);
  const TRAITS = [['purple flowers', 'white flowers', 'P'], ['round seeds', 'wrinkled seeds', 'R'], ['yellow seeds', 'green seeds', 'Y'], ['tall stems', 'dwarf stems', 'T']];
  function qMonohybrid() {
    const [dom, rec, L] = pick(TRAITS); const l = L.toLowerCase(); const g = () => pick([L + L, L + l, l + l]);
    let p1 = g(), p2 = g(); if (p1 === p2 && p1 !== L + l && Math.random() < 0.7) p2 = L + l;
    const kids = []; for (const a of p1) for (const b of p2) kids.push(a === L ? a + b : b + a);
    const cnt = x => kids.filter(x).length; const AA = cnt(k => k === L + L), Aa = cnt(k => k === L + l), aa = cnt(k => k === l + l);
    const ask = pick(['rec', 'dom', 'het', 'homdom']);
    const T = { rec: [`have ${rec}`, aa], dom: [`have ${dom}`, AA + Aa], het: [`be heterozygous (${L}${l})`, Aa], homdom: [`be homozygous dominant (${L}${L})`, AA] }[ask];
    const ans = F(T[1], 4);
    return mc('mendel', `In peas, the allele for ${dom} (${L}) is dominant to the allele for ${rec} (${l}). A ${p1} plant is crossed with a ${p2} plant. What fraction of the offspring are expected to ${T[0]}?`, ans, FRACS.filter(x => x !== ans), `The Punnett square gives ${[[AA, L + L], [Aa, L + l], [aa, l + l]].filter(x => x[0]).map(x => `${x[0]} ${x[1]}`).join(' : ')} out of 4. ${T[1]} of 4 boxes = ${ans}.`, 'Write each parent’s two gametes on the sides of a 2 × 2 square.');
  }
  function qProduct() {
    const k = ri(2, 4); const L = 'ABCD'.slice(0, k).split('');
    const pg = X => { const x = X.toLowerCase(); return Math.random() < 0.6 ? X + x : pick([X + X, x + x]); };
    const P1 = L.map(pg), P2 = L.map(pg);
    const dist = (a, b) => { const c = { hom: 0, het: 0, rec: 0 }; for (const u of a) for (const v of b) { const up = u === u.toUpperCase(), vp = v === v.toUpperCase(); if (up && vp) c.hom++; else if (up || vp) c.het++; else c.rec++; } return c; };
    const D = L.map((X, i) => dist(P1[i], P2[i]));
    const pheno = Math.random() < 0.4; let parts, label;
    if (pheno) { const want = L.map((X, i) => { const dm = D[i].hom + D[i].het; return dm && D[i].rec ? pick(['dom', 'rec']) : dm ? 'dom' : 'rec'; }); parts = want.map((w, i) => w === 'dom' ? D[i].hom + D[i].het : D[i].rec); label = `show the phenotype ${want.map((w, i) => w === 'dom' ? `dominant ${L[i]}` : `recessive ${L[i].toLowerCase()}`).join(', ')}`; }
    else { const tg = L.map((X, i) => { const x = X.toLowerCase(); const opts = []; if (D[i].hom) opts.push(['hom', X + X]); if (D[i].het) opts.push(['het', X + x]); if (D[i].rec) opts.push(['rec', x + x]); return pick(opts); }); parts = tg.map((t, i) => D[i][t[0]]); label = `have the genotype ${tg.map(t => t[1]).join('')}`; }
    const n = parts.reduce((a, b) => a * b, 1), d = 4 ** k; const ans = F(n, d);
    const alt = [F(n * 2 > d ? n : n * 2, d), F(n, d * 2), F(1, d), F(d - n, d), F(Math.min(parts.reduce((a, b) => a + b, 0), d), d), F(n, 2 ** k * 4)].filter(x => x !== ans);
    return mc('mendel', `In the cross ${P1.join('')} × ${P2.join('')}, with all genes assorting independently, what fraction of the offspring will ${label}?`, ans, shuffle(alt), `Treat each gene separately: ${L.map((X, i) => `${P1[i]} × ${P2[i]} → ${F(parts[i], 4)}`).join('; ')}. Multiply: ${parts.map(p => F(p, 4)).join(' × ')} = ${ans}.`, 'Do a small 2 × 2 square for each gene, then multiply the fractions.');
  }
  function qGametes() {
    if (Math.random() < 0.5) {
      const k = ri(3, 5); const L = 'ABCDE'.slice(0, k).split(''); const gt = L.map(X => pick([X + X.toLowerCase(), X + X.toLowerCase(), X + X, X.toLowerCase() + X.toLowerCase()])); const h = gt.filter(g => g[0] !== g[1]).length;
      return num('mendel', `How many genetically different gametes can an individual with genotype ${gt.join('')} make, if the genes assort independently?`, 2 ** h, `Only heterozygous genes give a choice. There ${h === 1 ? 'is 1 heterozygous gene' : `are ${h} heterozygous genes`}, so 2${sup(h)} = ${2 ** h} kinds of gametes.`, 'Homozygous genes contribute the same allele every time.');
    }
    const N = pick([160, 320, 480, 800, 1600]); const [cls, f] = pick([['yellow, round', 9], ['yellow, wrinkled', 3], ['green, round', 3], ['green, wrinkled', 1]]);
    return num('mendel', `In peas, yellow (Y) is dominant to green (y) and round (R) to wrinkled (r). Two YyRr plants are crossed and produce ${N} seeds. About how many are expected to be ${cls}?`, N * f / 16, `A dihybrid cross gives 9 : 3 : 3 : 1. ${cls} is ${f}/16 of the offspring: ${N} × ${f}/16 = ${N * f / 16}.`, 'Use 9:3:3:1 for both-dominant : one-dominant : other-dominant : both-recessive.');
  }
  const qLinkage = bank('linkage', [
    ['Thomas Hunt Morgan’s white-eyed fruit flies showed that', 'a specific gene is carried on a specific chromosome, the X', ['genes blend in offspring', 'all genes assort independently', 'DNA is the genetic material', 'eye color is polygenic'], 'It was the first solid support for the chromosome theory of inheritance.'],
    ['X-linked recessive disorders are more common in males because', 'males have one X, so a single recessive allele produces the trait', ['males have two X chromosomes', 'the Y chromosome carries the allele', 'females cannot inherit X-linked genes', 'males inherit their X from their father'], 'Females need two copies of the recessive allele.'],
    ['A Barr body is', 'an inactivated X chromosome in the cells of female mammals', ['a Y chromosome', 'an extra autosome', 'a cell organelle', 'a spindle fiber'], 'X inactivation makes females mosaics, as in calico cats.'],
    ['Recombination frequency between two genes can never exceed', '50%', ['25%', '75%', '100%', '10%'], 'At 50%, recombinants and parentals are equal, which looks like independent assortment.'],
    ['Genes that are very close together on one chromosome', 'tend to be inherited together and rarely recombine', ['always assort independently', 'recombine 50% of the time', 'cannot be mapped', 'are on different chromosomes'], 'The closer they are, the less often a crossover falls between them.'],
    ['Down syndrome usually results from', 'trisomy 21 caused by nondisjunction', ['a deletion on chromosome 5', 'an X-linked allele', 'a translocation between X and Y', 'polyploidy'], 'Its frequency rises with maternal age.'],
    ['Klinefelter syndrome is caused by the sex chromosomes', 'XXY', ['XO', 'XYY', 'XXX', 'YO'], 'Turner syndrome is XO.'],
    ['A chromosome segment that is reversed in orientation is', 'an inversion', ['a deletion', 'a duplication', 'a translocation', 'nondisjunction'], 'A translocation moves a segment to a nonhomologous chromosome.'],
    ['In recombination data, the recombinant offspring are', 'the two smallest classes, with new combinations of the parents’ traits', ['the two largest classes', 'always half the offspring', 'the same as the parents', 'impossible for linked genes'], 'Parental types are the two largest classes.'],
    ['Genomic imprinting means that', 'an allele’s expression depends on which parent passed it on', ['alleles blend', 'genes move between chromosomes', 'every allele is dominant', 'mitochondrial genes come from the father'], 'Methylation silences one parent’s copy of certain genes.']
  ]);
  function qXlinked() {
    const moms = [['HH', 'a woman who is not a carrier'], ['Hh', 'a woman who is a carrier'], ['hh', 'a woman who has the condition']];
    const dads = [['H', 'a man without the condition'], ['h', 'a man who has the condition']];
    let m, f; do { m = pick(moms); f = pick(dads); } while (m[0] === 'HH' && f[0] === 'H');
    const dis = m[0] === 'Hh' && f[0] === 'H' ? pick(['hemophilia', 'red-green color blindness']) : 'red-green color blindness';
    const hm = m[0].split('').filter(a => a === 'h').length;
    const sons = F(hm, 2), dAff = F(f[0] === 'h' ? hm : 0, 2), dCar = F(f[0] === 'H' ? hm : 2 - hm, 2), kids = F(hm + (f[0] === 'h' ? hm : 0), 4);
    const [txt, ans] = pick([['of their sons are expected to have the condition', sons], ['of their daughters are expected to have the condition', dAff], ['of their daughters are expected to be carriers', dCar], ['of all their children are expected to have the condition', kids]]);
    const xs = a => `X<sup>${a === 'H' ? 'N' : 'n'}</sup>`;
    return mc('linkage', `${dis[0].toUpperCase() + dis.slice(1)} is X-linked recessive. ${m[1][0].toUpperCase() + m[1].slice(1)} (${xs(m[0][0])}${xs(m[0][1])}) has children with ${f[1]} (${xs(f[0])}Y). What fraction ${txt}?`, ans, FRACS.filter(x => x !== ans), `Sons get an X from their mother and the Y from their father; daughters get an X from each parent. Sons affected: ${sons}. Daughters affected: ${dAff}. Daughters who are carriers: ${dCar}. Over all children (half sons, half daughters): ${kids} affected.`, 'Draw the Punnett square with X and Y alleles; a son’s X always comes from his mother.');
  }
  function qRecomb() {
    const rf = ri(5, 38), total = pick([400, 500, 800, 1000, 1200, 2000]); const rec = Math.round(total * rf / 100); const r1 = Math.round(rec * (0.4 + 0.2 * Math.random())), r2 = rec - r1; const par = total - rec; const p1 = Math.round(par * (0.45 + 0.1 * Math.random())), p2 = par - p1;
    const coup = Math.random() < 0.7;
    const rows = coup ? [['tall, purple', p1], ['dwarf, white', p2], ['tall, white', r1], ['dwarf, purple', r2]] : [['tall, white', p1], ['dwarf, purple', p2], ['tall, purple', r1], ['dwarf, white', r2]];
    const table = shuffle(rows).map(r => `${r[0]}: ${r[1]}`).join(' · ');
    const ans = rec / total * 100; const cm = Math.random() < 0.5;
    return num('linkage', `In a plant, tall (T) is dominant to dwarf (t) and purple flowers (P) to white (p). A TtPp plant is testcrossed with a ttpp plant, giving ${total} offspring: ${table}. What is the ${cm ? 'map distance between the genes, in map units (cM)' : 'recombination frequency, in percent'}?`, ans, `The two largest classes are the parental types (${rows[0][0]} and ${rows[1][0]}); the two smallest are recombinants. RF = (${r1} + ${r2}) ÷ ${total} × 100 = ${fmt(ans)}%${cm ? `, so the genes are about ${fmt(ans)} map units apart` : ''}.`, 'Find the two smallest classes: those are the recombinants.', 0.01);
  }
  function qMapOrder() {
    const G = shuffle('DEFGHJK'.split('')).slice(0, 3); const d1 = ri(3, 20), d2 = ri(3, 20);
    const pairs = shuffle([[G[0], G[1], d1], [G[1], G[2], d2], [G[0], G[2], d1 + d2]]).map(p => `${p[0]}–${p[1]}: ${p[2]}%`).join(', ');
    if (Math.random() < 0.6) return mc('linkage', `Three linked genes have these recombination frequencies: ${pairs}. Which gene lies in the middle?`, G[1], [G[0], G[2], 'It cannot be determined from these data'], `The two genes farthest apart (${G[0]} and ${G[2]}, ${d1 + d2}%) are at the ends. ${d1} + ${d2} = ${d1 + d2}, so ${G[1]} is between them.`, 'The largest distance tells you which two genes are on the ends.');
    return num('linkage', `Gene ${G[1]} lies between genes ${G[0]} and ${G[2]}. The ${G[0]}–${G[1]} distance is ${d1} map units and the ${G[1]}–${G[2]} distance is ${d2} map units. About how many map units apart are ${G[0]} and ${G[2]}?`, d1 + d2, `Map distances add along the chromosome: ${d1} + ${d2} = ${d1 + d2} map units (a little less may be observed because of double crossovers).`, 'Draw a line and place the middle gene first.');
  }
  const qPopgen = bank('popgen', [
    ['Hardy–Weinberg equilibrium requires all of these <b>except</b>', 'natural selection', ['no mutations', 'random mating', 'a very large population', 'no gene flow'], 'Equilibrium assumes no selection; selection is a cause of evolution.'],
    ['The smallest unit that can evolve is', 'a population', ['an individual', 'a single gene', 'a cell', 'an organ'], 'Individuals are selected, but populations evolve.'],
    ['A few birds colonize an island and their gene pool differs by chance from the mainland. This is', 'the founder effect', ['the bottleneck effect', 'gene flow', 'sexual selection', 'Hardy–Weinberg equilibrium'], 'It is a form of genetic drift.'],
    ['A disaster kills most of a population, leaving survivors whose allele frequencies differ by chance. This is', 'the bottleneck effect', ['the founder effect', 'gene flow', 'directional selection', 'mutation'], 'Northern elephant seals went through one.'],
    ['Gene flow between populations tends to', 'reduce genetic differences between them', ['increase differences between them', 'create new species', 'stop mutation', 'cause bottlenecks'], 'Migration moves alleles and makes gene pools more alike.'],
    ['The original source of new alleles is', 'mutation', ['natural selection', 'genetic drift', 'gene flow', 'independent assortment'], 'Sexual reproduction shuffles existing alleles; mutation creates new ones.'],
    ['In the Hardy–Weinberg equation, 2pq is', 'the frequency of heterozygotes', ['the frequency of the dominant allele', 'the frequency of homozygous recessives', 'the frequency of the recessive allele', 'the mutation rate'], 'p² is homozygous dominant and q² is homozygous recessive.'],
    ['Genetic drift has its largest effect in', 'small populations', ['large populations', 'populations with gene flow', 'populations under strong selection only', 'populations at equilibrium'], 'Chance changes in small samples can be big.']
  ]);
  function qHW() {
    const form = ri(0, 2);
    if (form === 0) {
      const q = pick([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.05, 0.02, 0.01]); const q2 = q * q, p = 1 - q;
      const shown = q <= 0.05 ? `1 in ${Math.round(1 / q2).toLocaleString('en-US')} people` : `${fmt(q2 * 100)}% of the population`;
      const [txt, ans, tol] = pick([['the frequency of the recessive allele (q)', q, 0.001], ['the frequency of the dominant allele (p)', p, 0.001], ['the percent of the population that are heterozygous carriers (2pq × 100)', 200 * p * q, 0.01], ['the percent that are homozygous dominant (p² × 100)', 100 * p * p, 0.01]]);
      return num('popgen', `An autosomal recessive condition affects ${shown}. Assuming Hardy–Weinberg equilibrium, what is ${txt}?`, ans, `q² = ${fmt(q2)}, so q = √${fmt(q2)} = ${fmt(q)} and p = 1 − q = ${fmt(p)}. Carriers 2pq = ${fmt(2 * p * q)} (${fmt(200 * p * q)}%); p² = ${fmt(p * p)} (${fmt(100 * p * p)}%).`, 'Start from the affected (homozygous recessive) fraction: that is q².', tol);
    }
    if (form === 1) {
      const N = pick([100, 200, 500, 1000]); const AA = ri(Math.round(N * 0.1), Math.round(N * 0.5)), Aa = ri(Math.round(N * 0.1), N - AA - Math.round(N * 0.05)), aa = N - AA - Aa;
      const p = (2 * AA + Aa) / (2 * N); const askP = Math.random() < 0.5;
      return num('popgen', `A sample of ${N} individuals has ${AA} AA, ${Aa} Aa and ${aa} aa. What is the frequency of the ${askP ? 'A allele (p)' : 'a allele (q)'}?`, askP ? p : 1 - p, `There are 2 × ${N} = ${2 * N} alleles. A alleles = 2 × ${AA} + ${Aa} = ${2 * AA + Aa}, so p = ${fmt(p)} and q = ${fmt(1 - p)}.`, 'Count alleles, not individuals: homozygotes carry two copies.', 0.005);
    }
    const p = pick([0.6, 0.7, 0.8, 0.9, 0.5]), N = pick([1000, 2000, 5000, 10000]); const q = Math.round((1 - p) * 10) / 10;
    return num('popgen', `In a population of ${N.toLocaleString('en-US')} at Hardy–Weinberg equilibrium, the dominant allele frequency is p = ${p}. How many individuals are expected to be heterozygous?`, Math.round(2 * p * q * N), `q = 1 − ${p} = ${q}. 2pq = 2 × ${p} × ${q} = ${fmt(2 * p * q)}, and ${fmt(2 * p * q)} × ${N.toLocaleString('en-US')} = ${Math.round(2 * p * q * N).toLocaleString('en-US')}.`, 'Find q, compute 2pq, then multiply by the population size.', 0.005);
  }

  /* ---------- Unit 4: molecular genetics ---------- */
  const qDna = bank('dna', [
    ['Griffith’s experiment with pneumonia bacteria showed', 'transformation: something from dead disease-causing bacteria changed harmless bacteria', ['that DNA is a double helix', 'that proteins are the genetic material', 'semiconservative replication', 'the genetic code'], 'The transforming substance was later shown to be DNA.'],
    ['Hershey and Chase showed that the genetic material of phage T2 is', 'DNA, because ³²P-labeled DNA entered the bacteria', ['protein, because ³⁵S-labeled protein entered the bacteria', 'RNA', 'lipid', 'carbohydrate'], 'The labeled protein coats stayed outside.'],
    ['Chargaff’s rules state that', 'in DNA, A = T and G = C, and base composition varies between species', ['all four bases are equal in every species', 'A = G and T = C', 'DNA contains uracil', 'bases pair randomly'], 'These equalities came to be explained by base pairing.'],
    ['Rosalind Franklin’s X-ray diffraction images showed that DNA', 'is a helix of uniform width', ['is single-stranded', 'contains protein', 'is made of uracil', 'is triple-stranded'], 'Watson and Crick used her data to build their model.'],
    ['The DNA double helix has a uniform width because', 'a purine always pairs with a pyrimidine', ['purines pair with purines', 'every base is the same size', 'phosphates pair with each other', 'the sugars are inside'], 'Two-ring bases pair with one-ring bases.'],
    ['In the Watson–Crick model, the sugar-phosphate backbones are', 'on the outside, with the bases paired inside', ['in the center', 'absent', 'held together by base pairs on the outside', 'made of amino acids'], 'The two strands are antiparallel.'],
    ['In eukaryotes, DNA wraps around histone proteins to form', 'nucleosomes', ['ribosomes', 'plasmids', 'centrioles', 'spliceosomes'], 'Nucleosomes look like “beads on a string.”'],
    ['Heterochromatin is', 'highly condensed chromatin that is mostly not transcribed', ['loosely packed, active chromatin', 'a kind of RNA', 'found only in bacteria', 'the nuclear envelope'], 'Euchromatin is less condensed and accessible for transcription.']
  ]);
  function qChargaff() {
    const B = ['A', 'T', 'G', 'C']; const known = pick(B); const k = ri(12, 38); let ask = pick(B.filter(b => b !== known));
    const pair = { A: 'T', T: 'A', G: 'C', C: 'G' }; const ans = ask === pair[known] ? k : 50 - k;
    return num('dna', `A double-stranded DNA sample is ${k}% ${known}. What percent of its bases are ${ask}?`, ans, `${known} = ${pair[known]} = ${k}%, so together they make ${2 * k}%. The other pair shares ${100 - 2 * k}%, so each is ${50 - k}%. ${ask} is ${ans}%.`, 'A = T and G = C, and all four add to 100%.');
  }
  const qReplication = bank('replication', [
    ['DNA replication is semiconservative, meaning', 'each new double helix has one old strand and one new strand', ['both strands are new', 'the old helix stays intact', 'the strands mix randomly', 'only one helix is made'], 'Meselson and Stahl confirmed it.'],
    ['Meselson and Stahl told old and new DNA apart using', 'heavy ¹⁵N and light ¹⁴N nitrogen', ['radioactive sulfur', 'X-ray diffraction', 'bacteriophages', 'fluorescent proteins'], 'After one round in ¹⁴N all DNA was hybrid density.'],
    ['DNA polymerase can add nucleotides only to', 'the 3′ end of a growing strand', ['the 5′ end', 'either end', 'the middle of a strand', 'an RNA template'], 'So new DNA is always made 5′ → 3′.'],
    ['The lagging strand is made', 'discontinuously, as Okazaki fragments', ['continuously toward the fork', 'without primers', 'by RNA polymerase', 'only in bacteria'], 'It is synthesized away from the fork in pieces.'],
    ['Helicase', 'unwinds the double helix at the replication fork', ['joins Okazaki fragments', 'makes RNA primers', 'proofreads new DNA', 'shortens telomeres'], 'Single-strand binding proteins then keep the strands apart.'],
    ['Primase', 'makes a short RNA primer for DNA polymerase to extend', ['unwinds DNA', 'joins fragments', 'relieves twisting', 'adds telomeres'], 'DNA polymerase cannot start a strand from scratch.'],
    ['DNA ligase', 'joins Okazaki fragments into a continuous strand', ['unwinds DNA', 'makes RNA primers', 'removes introns', 'adds a poly-A tail'], 'It seals the sugar-phosphate backbone.'],
    ['Topoisomerase', 'relieves strain ahead of the fork by breaking, swiveling and rejoining DNA', ['makes primers', 'joins Okazaki fragments', 'reads mRNA', 'adds nucleotides'], 'Without it the DNA would overwind.'],
    ['Telomerase', 'lengthens chromosome ends, especially in germ cells and many cancer cells', ['removes RNA primers', 'unwinds the helix', 'joins Okazaki fragments', 'makes histones'], 'Telomeres shorten a little with each round in most body cells.'],
    ['Nucleotide excision repair', 'cuts out and replaces damaged DNA such as thymine dimers', ['makes RNA primers', 'adds telomeres', 'transcribes genes', 'splices introns'], 'Defects cause xeroderma pigmentosum.']
  ]);
  function qMeselson() {
    const g = ri(1, 4); const hyb = g === 1 ? [1, 1] : [1, 2 ** (g - 1)]; const hs = F(hyb[0], hyb[1]); const ls = F(hyb[1] - hyb[0], hyb[1]);
    const form = ri(0, 2); const pool = ['0', '1/16', '1/8', '1/4', '1/2', '3/4', '7/8', '1'];
    if (form === 0) return mc('replication', `E. coli grown for many generations in heavy ¹⁵N is moved to light ¹⁴N. After ${g} round${g > 1 ? 's' : ''} of replication, what fraction of the DNA molecules are hybrid (one ¹⁵N strand, one ¹⁴N strand)?`, hs, shuffle(pool.filter(x => x !== hs)), `The two original heavy strands stay in two molecules forever. After ${g} round${g > 1 ? 's' : ''} there are 2${sup(g)} = ${2 ** g} molecules, so ${2}/${2 ** g} = ${hs} are hybrid.`, 'Count molecules (2 to the rounds) and remember only two contain an old strand.');
    if (form === 1) return mc('replication', `E. coli grown in heavy ¹⁵N is moved to light ¹⁴N. After ${g} round${g > 1 ? 's' : ''} of replication, what fraction of the DNA molecules are fully light (both strands ¹⁴N)?`, ls, shuffle(pool.filter(x => x !== ls)), `There are ${2 ** g} molecules; 2 are hybrid, so ${2 ** g - 2} are light: ${ls}.`, 'Light molecules = all molecules minus the two hybrids.');
    const r = ri(2, 6); return num('replication', `Starting with one DNA molecule, how many DNA molecules are there after ${r} rounds of replication?`, 2 ** r, `Each round doubles the number: 2${sup(r)} = ${2 ** r}.`, 'Doubling each round means powers of two.');
  }
  const qTranscription = bank('transcription', [
    ['RNA polymerase', 'unwinds DNA and builds RNA 5′ → 3′ without needing a primer', ['needs an RNA primer', 'builds RNA 3′ → 5′', 'copies both DNA strands at once', 'is found only in the cytoplasm of eukaryotes'], 'It reads the template strand 3′ → 5′.'],
    ['In eukaryotes, RNA polymerase II binds a promoter with the help of', 'transcription factors, often at a TATA box', ['ribosomes', 'tRNAs', 'spliceosomes', 'release factors'], 'Together they form the transcription initiation complex.'],
    ['An mRNA’s sequence matches the', 'nontemplate (coding) strand, with U in place of T', ['template strand', 'both DNA strands', 'neither DNA strand', 'template strand with T in place of U'], 'The mRNA is complementary to the template strand.'],
    ['Eukaryotic pre-mRNA processing includes', 'adding a 5′ cap and poly-A tail and splicing out introns', ['adding amino acids', 'removing exons only', 'making the RNA double-stranded', 'adding thymine'], 'The cap and tail protect the mRNA and help ribosomes attach.'],
    ['Introns are', 'noncoding sequences removed from pre-mRNA', ['the coding parts kept in mRNA', 'start codons', 'sections of tRNA', 'proteins that help splicing'], 'Exons are joined and expressed.'],
    ['Spliceosomes are made of', 'proteins and small RNAs', ['DNA only', 'lipids', 'mRNA and ribosomes', 'carbohydrates'], 'In some cases the RNA itself catalyzes splicing (ribozymes).'],
    ['Alternative splicing allows', 'one gene to code for more than one polypeptide', ['DNA to be copied twice', 'mRNA to skip translation', 'introns to be translated', 'bacteria to splice'], 'Different exons are kept in different mRNAs.'],
    ['In bacteria, transcription and translation can happen at the same time because', 'there is no nucleus separating them', ['bacteria have no ribosomes', 'bacterial mRNA is spliced', 'bacteria use DNA as mRNA', 'translation happens first'], 'Ribosomes attach to mRNA as it is being made.'],
    ['Beadle and Tatum’s bread mold experiments led to the idea of', 'one gene–one enzyme (now one gene–one polypeptide)', ['semiconservative replication', 'the double helix', 'transformation', 'the operon'], 'Each mutant lacked one enzyme in a pathway.']
  ]);
  function qTranscribe() {
    let code, tpl, m, opts; for (let t = 0; t < 40; t++) { code = randSeq(12); tpl = comp(code); m = toRna(code); opts = [end5(m), end5(toRna(tpl)), end5(code), end5(rev(m)), end5(rev(toRna(tpl)))]; if (new Set(opts).size === 5) break; }
    if (Math.random() < 0.5) return mc('transcription', `The template strand of a DNA segment reads ${end3(tpl)}. What mRNA is transcribed from it?`, end5(m), [end5(toRna(tpl)), end5(code), end5(rev(m)), end5(rev(toRna(tpl)))], `The mRNA is complementary to the template and antiparallel to it. Pair each base (A→U, T→A, G→C, C→G): ${end5(m)}. It matches the coding strand with U for T.`, 'Pair each template base, and use U instead of T.');
    return mc('transcription', `The nontemplate (coding) strand of a gene reads ${end5(code)}. What is the sequence of the mRNA?`, end5(m), [end5(toRna(tpl)), end5(code), end5(rev(toRna(tpl))), end5(rev(m))], `The mRNA has the same sequence as the coding strand, with U in place of T: ${end5(m)}.`, 'The coding strand is the one the mRNA looks like.');
  }
  const qTranslation = bank('translation', [
    ['A codon is', 'three mRNA nucleotides that specify an amino acid or a stop signal', ['one amino acid', 'three amino acids', 'a tRNA', 'a segment of an intron'], '64 codons: 61 for amino acids, 3 stops.'],
    ['The start codon is', 'AUG, which codes for methionine', ['UAA', 'UGA', 'UAG', 'GGG'], 'UAA, UAG and UGA are stop codons.'],
    ['Anticodons are found on', 'tRNA', ['mRNA', 'rRNA', 'DNA', 'ribosomal proteins'], 'The anticodon pairs with the mRNA codon.'],
    ['Which ribosomal site holds the tRNA carrying the growing polypeptide?', 'The P site', ['The A site', 'The E site', 'The promoter', 'The 5′ cap'], 'A: new aminoacyl-tRNA arrives; P: polypeptide; E: exit.'],
    ['Translation ends when', 'a stop codon reaches the A site and a release factor binds', ['the ribosome reaches the poly-A tail', 'tRNA runs out', 'the 5′ cap is removed', 'an intron is reached'], 'The release factor frees the polypeptide.'],
    ['The genetic code is redundant, meaning', 'several codons can specify the same amino acid', ['each codon codes for several amino acids', 'the code differs in every species', 'codons overlap', 'there are no stop codons'], 'It is not ambiguous: each codon means only one thing.'],
    ['Aminoacyl-tRNA synthetases', 'attach the correct amino acid to each tRNA', ['join amino acids together', 'transcribe genes', 'splice introns', 'read mRNA'], 'Their accuracy is essential for correct translation.'],
    ['A frameshift mutation is caused by', 'inserting or deleting nucleotides in a number that is not a multiple of three', ['swapping one base for another', 'any silent change', 'deleting exactly three nucleotides', 'changing an intron'], 'Every codon downstream is read wrongly.'],
    ['Polypeptides headed for the ER begin with', 'a signal peptide recognized by a signal-recognition particle', ['a poly-A tail', 'a stop codon', 'an intron', 'a TATA box'], 'The SRP brings the ribosome to the ER membrane.'],
    ['Peptide bond formation in the ribosome is catalyzed by', 'rRNA in the large subunit (the ribosome is a ribozyme)', ['tRNA', 'mRNA', 'DNA polymerase', 'a release factor'], 'The catalytic site is RNA, not protein.']
  ]);
  function qTranslate() {
    let lead; do { lead = randSeq(pick([0, 1, 2, 4, 5]), 'UCAG'); } while ((lead + 'AUG').indexOf('AUG') !== lead.length);
    const k = ri(3, 5); const orf = 'AUG' + Array.from({ length: k }, () => pick(SENSE)).join('') + pick(STOPS); const tail = randSeq(ri(0, 2), 'UCAG');
    const mrna = lead + orf + tail; const s = lead.length; const J = a => a.join('–');
    const ans = J(translate(mrna, s));
    const anti = []; for (let i = s; i + 3 <= s + orf.length - 3; i += 3) { const c = mrna.slice(i, i + 3).split('').map(b => RNA_PAIR[b]).join(''); const a = aaOf(c); if (a === 'Stop') break; anti.push(a); }
    const res = translate(mrna, s); const swapped = res.slice(); const idx = ri(1, swapped.length - 1); let other; do { other = aaOf(pick(SENSE)); } while (other === swapped[idx]); swapped[idx] = other;
    const ds = [J(translate(mrna, 0)), J(anti), J(translate(mrna, s + 1)), J(res.slice().reverse()), J(swapped), J(res.concat('Stop'))].filter(x => x && x !== ans);
    return mc('translation', `An mRNA reads ${end5(mrna)}. What polypeptide does it encode? (Use a codon table.)`, ans, ds, `Find the first AUG (the start codon, at position ${s + 1}) and read codons from there: ${orf.match(/.{3}/g).join(' ')} → ${ans}, then stop. Stop codons add no amino acid.`, 'Scan from the 5′ end for AUG, then read in threes until a stop codon.');
  }
  function qMutation() {
    if (Math.random() < 0.3) {
      const n = pick([1, 2, 3, 4, 6]); const ans = n % 3 ? 'A frameshift that changes every codon after the mutation' : `Loss of ${n / 3} amino acid${n / 3 > 1 ? 's' : ''} with the reading frame kept`;
      return mc('translation', `${n} nucleotide${n > 1 ? 's are' : ' is'} deleted from the middle of a gene’s coding sequence. What is the most likely effect on the protein?`, ans, ['A frameshift that changes every codon after the mutation', `Loss of ${Math.max(1, Math.round(n / 3))} amino acid${Math.round(n / 3) > 1 ? 's' : ''} with the reading frame kept`, 'No change, because the code is redundant', 'A single amino acid substitution only'].filter(x => x !== ans), `${n} ${n % 3 ? 'is not' : 'is'} a multiple of three. ${n % 3 ? 'The reading frame shifts, so every downstream codon is misread, usually with an early stop.' : 'Whole codons are removed, so the frame is kept and only those amino acids are lost.'}`, 'Ask whether the number of nucleotides is a multiple of 3.');
    }
    const target = pick(['Silent', 'Missense', 'Nonsense']); let c, m, cls;
    for (let t = 0; t < 2000; t++) { c = pick(SENSE); const pos = ri(0, 2); const nb = pick(BASES.split('').filter(b => b !== c[pos])); m = c.slice(0, pos) + nb + c.slice(pos + 1); cls = aaOf(m) === 'Stop' ? 'Nonsense' : aaOf(m) === aaOf(c) ? 'Silent' : 'Missense'; if (cls === target) break; }
    const O = { Silent: 'Silent: the same amino acid', Missense: 'Missense: a different amino acid', Nonsense: 'Nonsense: an early stop codon' };
    return mc('translation', `A point mutation changes an mRNA codon from <b>${c}</b> to <b>${m}</b>. What type of mutation is it? (Use a codon table.)`, O[cls], [O.Silent, O.Missense, O.Nonsense, 'Frameshift: the reading frame shifts'].filter(x => x !== O[cls]), `${c} codes for ${aaOf(c)} and ${m} ${aaOf(m) === 'Stop' ? 'is a stop codon' : `codes for ${aaOf(m)}`}, so it is a ${cls.toLowerCase()} mutation. A single base substitution never shifts the frame.`, 'Look up both codons and compare.');
  }
  function qCodonCount() {
    if (Math.random() < 0.5) { const k = pick([51, 100, 146, 250, 330, 574]); return num('translation', `A polypeptide has ${k} amino acids. How many nucleotides of mRNA code for it, counting from the start codon through the stop codon?`, 3 * (k + 1), `${k} codons for amino acids plus 1 stop codon = ${k + 1} codons × 3 = ${3 * (k + 1)} nucleotides.`, 'Three nucleotides per codon, and remember the stop codon.'); }
    const k = pick([30, 99, 120, 200, 400]); const N = 3 * (k + 1); return num('translation', `The coding region of an mRNA, from the start codon through the stop codon, is ${N} nucleotides long. How many amino acids are in the polypeptide?`, k, `${N} ÷ 3 = ${k + 1} codons, and the last is a stop codon: ${k} amino acids.`, 'Divide by 3, then subtract the stop codon.');
  }
  const qBiotech = bank('biotech', [
    ['Restriction enzymes', 'cut DNA at specific recognition sequences', ['join DNA fragments', 'copy DNA', 'make RNA primers', 'separate DNA by size'], 'Many leave single-stranded sticky ends.'],
    ['In making recombinant DNA, DNA ligase', 'seals the sugar-phosphate backbones to join fragments', ['cuts DNA at specific sites', 'unwinds DNA', 'makes copies by PCR', 'reads the sequence'], 'Sticky ends pair first; ligase makes the bonds permanent.'],
    ['In gel electrophoresis, DNA moves toward the positive electrode because', 'its phosphate groups are negatively charged', ['its bases are positively charged', 'it is hydrophobic', 'the gel pushes it', 'it is attracted to water'], 'The gel acts as a sieve.'],
    ['In a gel, the band that traveled farthest contains', 'the smallest fragments', ['the largest fragments', 'uncut DNA', 'proteins', 'RNA only'], 'Small fragments slip through the gel fastest.'],
    ['PCR needs a heat-stable DNA polymerase (Taq) because', 'each cycle heats the DNA to about 95 °C to separate the strands', ['the primers are made of protein', 'it must work in the cold', 'it cuts the DNA', 'it makes RNA'], 'Taq comes from a hot-spring bacterium.'],
    ['In each PCR cycle, primers bind to the template strands during', 'annealing, at about 50–65 °C', ['denaturation, at about 95 °C', 'extension, at about 72 °C', 'electrophoresis', 'ligation'], 'Then Taq extends them at about 72 °C.'],
    ['CRISPR-Cas9 finds the DNA it cuts by using', 'a guide RNA complementary to the target sequence', ['a restriction site only', 'a protein antibody', 'a plasmid origin', 'a stop codon'], 'The cut is then repaired, disrupting or editing the gene.'],
    ['A plasmid used as a cloning vector usually carries', 'an origin of replication and an antibiotic-resistance gene for selection', ['a nucleus', 'introns only', 'histones', 'a centromere and telomeres'], 'Only bacteria that took up the plasmid survive on the antibiotic.'],
    ['Sanger sequencing works because dideoxynucleotides', 'lack a 3′ –OH, so synthesis stops where one is added', ['glow without a label', 'pair with any base', 'cut the template', 'bind only to primers'], 'The fragments’ lengths reveal the sequence.'],
    ['Reverse transcriptase is used in the lab to', 'make cDNA from mRNA, giving a gene copy without introns', ['cut DNA', 'join fragments', 'sequence proteins', 'make RNA from DNA'], 'Bacteria cannot remove introns, so cDNA is used to express eukaryotic genes.']
  ]);
  function qPcr() {
    if (Math.random() < 0.6) { const N0 = pick([1, 1, 2, 5, 10]), n = ri(3, 20); return num('biotech', `Starting from ${N0} cop${N0 === 1 ? 'y' : 'ies'} of a target sequence, about how many copies are there after ${n} PCR cycles, assuming perfect doubling?`, N0 * 2 ** n, `Each cycle doubles the copies: ${N0} × 2${sup(n)} = ${(N0 * 2 ** n).toLocaleString('en-US')}.`, 'Copies = starting copies × 2 to the number of cycles.'); }
    const n = ri(5, 20); return num('biotech', `How many PCR cycles, with perfect doubling, turn one copy of a target sequence into ${(2 ** n).toLocaleString('en-US')} copies?`, n, `${(2 ** n).toLocaleString('en-US')} = 2${sup(n)}, so ${n} cycles.`, 'Find the power of 2.');
  }
  function qFragments() {
    const form = ri(0, 2);
    if (form === 0) { const k = ri(1, 5); const lin = Math.random() < 0.5; return num('biotech', `A ${lin ? 'linear DNA molecule' : 'circular plasmid'} has ${k} site${k > 1 ? 's' : ''} for a restriction enzyme. How many fragments does a complete digest give?`, lin ? k + 1 : k, lin ? `Cutting a line in ${k} place${k > 1 ? 's' : ''} gives ${k + 1} pieces.` : `Cutting a circle in ${k} place${k > 1 ? 's' : ''} gives ${k} piece${k > 1 ? 's' : ''}.`, 'Picture a string versus a rubber band.'); }
    if (form === 1) {
      let L, cuts, sizes; for (let t = 0; t < 60; t++) { L = pick([8, 10, 12, 15]); cuts = shuffle(Array.from({ length: L - 1 }, (_, i) => i + 1)).slice(0, ri(2, 3)).sort((a, b) => a - b); const pts = [0].concat(cuts, [L]); sizes = pts.slice(1).map((x, i) => x - pts[i]); if (new Set(sizes).size === sizes.length) break; }
      const small = Math.min(...sizes); const opts = sizes.map(s => `${s} kb`).concat([`${L} kb (uncut)`]);
      return mc('biotech', `A ${L} kb linear DNA molecule is cut at ${cuts.slice(0, -1).join(', ')} and ${cuts[cuts.length - 1]} kb from one end, then run on a gel. Which fragment travels farthest?`, `${small} kb`, opts.filter(o => o !== `${small} kb`), `The fragments are ${sizes.map(s => `${s} kb`).join(', ')}. Smaller fragments move farther, so the ${small} kb piece runs farthest.`, 'Work out each fragment’s length first.');
    }
    const k = ri(1, 3); let seq; for (let t = 0; t < 200; t++) { const parts = []; for (let i = 0; i <= k; i++) parts.push(randSeq(ri(3, 6))); seq = parts.join('GAATTC'); if ((seq.match(/GAATTC/g) || []).length === k) break; }
    return num('biotech', `EcoRI cuts DNA at the sequence GAATTC. How many fragments does EcoRI produce from this linear double-stranded DNA? ${end5(seq)}`, k + 1, `GAATTC appears ${k} time${k > 1 ? 's' : ''} (it is palindromic, so both strands share the sites). A linear molecule cut ${k} time${k > 1 ? 's' : ''} gives ${k + 1} fragments.`, 'Count the recognition sites, then add one for a linear molecule.');
  }

  const GENERATORS = [qLife, qChemistry, qIsotope, qHalfLife, qWater, qPh, qMolarity, qCarbon, qCarbsLipids, qPolymer, qProteins, qPeptide, qNucleic, qComplement, qHbonds, qEnergy, qDeltaG, qEnzymes, qRespiration, qRespCount, qCells, qSurfaceVolume, qMembranes, qTonicity, qMitosis, qMitosisCount, qMeiosis, qMeiosisCount, qMendel, qMonohybrid, qProduct, qGametes, qLinkage, qXlinked, qRecomb, qMapOrder, qPopgen, qHW, qDna, qChargaff, qReplication, qMeselson, qTranscription, qTranscribe, qTranslation, qTranslate, qMutation, qCodonCount, qBiotech, qPcr, qFragments];
  const BY_TOPIC = {};
  for (const g of GENERATORS) { const t = g().topic; (BY_TOPIC[t] = BY_TOPIC[t] || []).push(g); }
  function topicsForUnits(units) { return Object.keys(TOPICS).filter(t => units.includes(TOPICS[t].unit)); }
  function generateSet(topics, n) {
    const pool = topics.filter(t => BY_TOPIC[t]); if (!pool.length) return []; const out = []; const order = shuffle(pool); let guard = 0;
    while (out.length < n && guard++ < n * 25) { const t = order[out.length % order.length]; let q; try { q = pick(BY_TOPIC[t])(); } catch (e) { continue; } if (!q || (q.type === 'mc' && q.options.length < 2)) continue; if (out.some(o => o.prompt === q.prompt)) continue; q.id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); out.push(q); }
    return out;
  }
  global.Courses = global.Courses || {}; global.Courses.biob = global.Courses.biob || {};
  global.Courses.biob.quiz = { TOPICS, GENERATORS, BY_TOPIC, generateSet, topicsForUnits, helpers: { fmt, shuffle, aaOf, translate } };

  /* hint ladders: a way to think about it, the procedure, the nearly-there nudge */
  global.MathubLadders = global.MathubLadders || {};
  global.MathubLadders.biob = {
    life: ['Name the level or property the question is about.', 'Walk up the hierarchy: molecule, organelle, cell, tissue, organ, organ system, organism, population.', 'For experiments: what was changed (independent) and what was measured (dependent)?'],
    chemistry: ['Separate protons (identity), neutrons (isotope) and electrons (bonding).', 'Mass number = protons + neutrons; neutral atoms have as many electrons as protons.', 'For half-lives, count how many times the amount was halved.'],
    water: ['Every water property traces back to polarity and hydrogen bonds.', 'pH is the negative exponent of [H⁺]; each unit is a factor of ten.', 'The exponents of [H⁺] and [OH⁻] add to −14.'],
    carbon: ['Carbon makes four bonds; everything else follows from that.', 'Name the functional group and ask whether it is polar, acidic or basic.', 'Isomers share a formula; isotopes share a proton count.'],
    'carbs-lipids': ['Decide whether the molecule is a sugar, a polysaccharide or a lipid.', 'Dehydration builds (water out); hydrolysis breaks (water in), one water per bond.', 'For fats: one glycerol + three fatty acids, three waters.'],
    proteins: ['Primary = sequence; secondary = backbone H bonds; tertiary = R groups; quaternary = several chains.', 'Peptide bonds are one fewer than amino acids.', 'Denaturation changes shape, not sequence.'],
    nucleic: ['Pair A with T (or U in RNA) and G with C.', 'Keep strands antiparallel: label the 5′ and 3′ ends.', 'To write the complement 5′ → 3′, complement and then reverse.'],
    energy: ['Negative ΔG releases energy; positive ΔG requires it.', 'Coupled reactions: add the ΔG values.', 'Spontaneous says nothing about speed.'],
    enzymes: ['Enzymes lower activation energy and leave ΔG alone.', 'More substrate beats a competitive inhibitor but not a noncompetitive one.', 'Temperature and pH beyond the optimum denature the enzyme.'],
    respiration: ['List the stages: glycolysis, pyruvate oxidation, citric acid cycle, oxidative phosphorylation.', 'Per glucose: glycolysis 2 ATP + 2 NADH; pyruvate oxidation 2 NADH + 2 CO₂; citric acid cycle 2 ATP, 6 NADH, 2 FADH₂, 4 CO₂.', 'Multiply by the number of glucose molecules (or turns).'],
    cells: ['Follow the path: ribosome → ER → Golgi → vesicle → destination.', 'Match each organelle to its job and which cells have it.', 'For size questions, compare surface area (grows as s²) to volume (grows as s³).'],
    membranes: ['Is the movement down the gradient (passive) or up (active, needs energy)?', 'For osmosis, water moves toward the side with more solute.', 'Walls change the outcome: plant cells become turgid, not lysed.'],
    mitosis: ['Put the stages in order: interphase (G1, S, G2), prophase, prometaphase, metaphase, anaphase, telophase, cytokinesis.', 'Chromosomes = centromeres; chromatids double after S phase.', 'Anaphase counts the separated chromatids as chromosomes.'],
    meiosis: ['Meiosis I separates homologs; meiosis II separates sisters.', 'Gametes have n; tetrads = n.', 'Independent assortment gives 2ⁿ combinations.'],
    mendel: ['Write each parent’s gametes.', 'Use a 2 × 2 Punnett square for one gene; for several genes, multiply each gene’s fraction.', 'Check whether the question asks for a genotype or a phenotype.'],
    linkage: ['X-linked: sons get their X from mom; daughters get one X from each parent.', 'For recombination, the two smallest classes are recombinants: RF = recombinants ÷ total × 100.', 'For map order, the largest distance marks the two outer genes.'],
    popgen: ['Start with the recessive phenotype frequency: that is q².', 'q = √q², p = 1 − q.', 'Carriers are 2pq; multiply by the population size for a count.'],
    dna: ['Match each experiment to its conclusion: Griffith (transformation), Hershey–Chase (DNA is genetic), Chargaff (A = T, G = C), Franklin (helix).', 'For Chargaff problems, A = T and G = C, and all four add to 100%.', 'A + G = 50% in double-stranded DNA.'],
    replication: ['Name the enzyme by its job: unwind, prime, extend, join, relieve strain.', 'New DNA is built 5′ → 3′ only, so the lagging strand is made in pieces.', 'For Meselson–Stahl, only two molecules ever carry an original strand.'],
    transcription: ['Identify which strand you are given: template or coding.', 'mRNA is complementary to the template and matches the coding strand (U for T).', 'Keep 5′ and 3′ labels on every answer.'],
    translation: ['Find the first AUG.', 'Read codons in threes with a codon table until a stop codon.', 'For mutations: same amino acid (silent), different (missense), stop (nonsense), frame shift (indel not a multiple of 3).'],
    biotech: ['Name the tool: cut (restriction enzyme), join (ligase), copy (PCR), sort by size (gel), edit (CRISPR).', 'PCR doubles each cycle: copies = start × 2ⁿ.', 'Smaller fragments run farther; a linear molecule with k cuts gives k + 1 pieces.']
  };
})(window);
