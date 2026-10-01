/* PSCI 230D: topic notes, key terms, flashcards, practice sets and checklists.
   Written for Mathub from standard introductory IR material and the readings on the syllabus.
   The instructor's lectures and Mingst decide what the exams ask. */
const EIR = 'https://www.e-ir.info/publication/beginners-textbook-international-relations/';
const EIRT = 'https://www.e-ir.info/publication/international-relations-theory/';
const CANVAS = 'https://montana.instructure.com/';

const SECTIONS = [
  /* ---------- Unit 1: Introduction ---------- */
  { id: 'basics', label: '1.1', title: 'Basic concepts and issues in IR', unit: 1, link: CANVAS, linkLabel: 'Reading: Mingst ch. 1 (Canvas)',
    ideas: [
      '<b>International relations (IR)</b> studies political interactions across borders: how cooperation and conflict arise, why some states are more powerful than others, and how history shaped today\'s institutions.',
      '<b>States</b> are the main actors, but not the only ones. <b>Intergovernmental organizations</b> (IGOs: the UN, NATO, the WTO) have states as members. <b>Nongovernmental organizations</b> (NGOs: Amnesty International, Doctors Without Borders) are private. Multinational corporations, transnational activist networks, terrorist groups and individual leaders matter too.',
      'A <b>state</b> has territory, a population, a government and <b>sovereignty</b>: supreme authority inside its borders and independence from outside control. A <b>nation</b> is a people with a shared identity (language, history, culture). A <b>nation-state</b> is where the two coincide; stateless nations (the Kurds, Palestinians) and multinational states (Russia, India) are common.',
      'The <b>levels of analysis</b> sort explanations, following Kenneth Waltz\'s three "images" in <i>Man, the State, and War</i> (1959). At the <b>individual</b> level: leaders\' beliefs, personalities and misperceptions. At the <b>state</b> level: regime type, domestic politics, interest groups, bureaucracies and public opinion. At the <b>international system</b> level: anarchy and the distribution of power among states.',
      '<b>Theories</b> are simplifications that say which factors matter most and why. Political scientists test them against <b>evidence</b> (cases and data), and must separate correlation from causation.'
    ],
    formulas: [],
    example: { p: 'Explain the US invasion of Iraq in 2003 at each level of analysis.', s: '<b>Individual:</b> President George W. Bush\'s beliefs after 9/11 and Saddam Hussein\'s miscalculation about US resolve. <b>State:</b> post-9/11 threat perceptions in US domestic politics, Congress\'s authorization and the intelligence bureaucracy\'s claims about weapons of mass destruction. <b>System:</b> US unipolarity after the Cold War meant no great power could balance against the US or stop it.' },
    pitfalls: ['Using "nation" and "state" interchangeably. The state is the political-legal unit; the nation is the people and their identity.', 'Assuming only states matter. IGOs, NGOs, firms and individuals all shape outcomes.', 'Mixing levels: "the US is a democracy" is a state-level fact, not an individual-level one.'],
    tip: 'For any event on the exam, ask who acted, which level explains it best, and what a second level would add.' },

  { id: 'history', label: '1.2', title: 'Historical overview', unit: 1, link: EIR, linkLabel: 'Reading: Mingst ch. 2 (free second explanation: E-IR)',
    ideas: [
      'The <b>Peace of Westphalia (1648)</b> ended the Thirty Years\' War and is the usual starting point of the modern state system. Sovereign territorial states are the main units, and they do not interfere in each other\'s internal affairs.',
      'After Napoleon, the <b>Congress of Vienna (1815)</b> created the <b>Concert of Europe</b>: the great powers consulted to keep a balance of power. Europe avoided a general war for about a century, while nationalism, industrialization and imperialism grew.',
      '<b>World War I (1914–1918)</b> grew from rigid alliances, nationalism and the assassination of Archduke Franz Ferdinand. The <b>Treaty of Versailles (1919)</b> punished Germany. The <b>League of Nations</b> tried collective security but failed: the US never joined, and it could not stop aggression in the 1930s. The Great Depression and <b>appeasement</b> (Munich, 1938) followed.',
      '<b>World War II (1939–1945)</b> brought the Holocaust and the atomic bombings of Hiroshima and Nagasaki (August 1945). The victors built new institutions: the <b>United Nations (1945)</b> and the <b>Bretton Woods</b> institutions (1944), the IMF and the World Bank.',
      'The <b>Cold War (about 1947–1991)</b> was a bipolar US–Soviet rivalry. Key events: <b>containment</b> (the Truman Doctrine and Marshall Plan, 1947), <b>NATO</b> (1949) against the <b>Warsaw Pact</b> (1955), the nuclear arms race, proxy wars (Korea, Vietnam, Afghanistan), the <b>Cuban Missile Crisis</b> (1962) and détente. It ended with the fall of the <b>Berlin Wall (1989)</b> and the <b>Soviet Union\'s dissolution (December 1991)</b>.',
      'After the Cold War came <b>US unipolarity</b> and globalization, ethnic wars and genocide (Yugoslavia, Rwanda 1994), then the <b>9/11 attacks (2001)</b> and the wars in Afghanistan and Iraq.'
    ],
    formulas: [],
    example: { p: 'Why is the Peace of Westphalia called the birth of the modern state system?', s: 'It established the principle that rulers are <b>sovereign within their own territory</b> and that outside powers should not interfere in their internal affairs, including religion. Sovereign, territorially defined states, legally equal and recognizing each other, became the basic units of international politics.' },
    pitfalls: ['Confusing the League of Nations (1919/1920, failed) with the United Nations (1945).', 'Thinking the Cold War was a direct US–Soviet war. It was fought through arms races, alliances and proxy wars.', 'Treating the Cold War\'s end as a single date. The Berlin Wall fell in 1989; the USSR dissolved in December 1991.'],
    tip: 'Build a timeline and say each date aloud: 1648, 1815, 1914–18, 1919, 1939–45, 1944–45, 1947, 1949, 1962, 1989, 1991, 2001.' },

  { id: 'challenges', label: '1.3', title: 'The international system and current challenges', unit: 1, link: CANVAS, linkLabel: 'Reading: Mingst ch. 4 (Canvas)',
    ideas: [
      'The <b>international system</b> has two defining features: <b>anarchy</b> (no world government above states) and a <b>distribution of capabilities</b> among them.',
      '<b>Polarity</b> counts the great powers. <b>Unipolar:</b> one dominant power (the US after 1991). <b>Bipolar:</b> two (the US and USSR in the Cold War). <b>Multipolar:</b> several (Europe before 1914). Realists disagree about which is most stable; Waltz argued bipolarity is.',
      '<b>Power transition</b>: a rising power can clash with the established one. Graham Allison calls this the "Thucydides trap", after Athens and Sparta. Today it is applied to China and the United States.',
      'Russia\'s <b>full-scale invasion of Ukraine (February 2022)</b> challenged the norm against conquering territory. NATO enlarged in response: <b>Finland</b> joined in 2023 and <b>Sweden</b> in 2024.',
      'Some <b>transnational challenges</b> no state can solve alone: climate change, pandemics (COVID-19), refugees and migration, terrorism and cyberattacks.',
      '<b>Globalization and its backlash</b>: nationalism and populism, the <b>Brexit</b> vote (2016; the UK left the EU in January 2020) and the US–China tariff war that began in 2018.'
    ],
    formulas: [],
    example: { p: 'Is today\'s international system unipolar, bipolar or multipolar? How would you argue it?', s: 'It is debated, so argue from <b>capabilities</b>. The US still leads in military power, alliances and finance (an argument for unipolarity or its remnants). China is a peer in economic size and is building military power (an argument for emerging bipolarity). Russia, India and the EU add weight to a multipolar reading. A strong answer names the evidence and the criterion: how many states have great-power capabilities.' },
    pitfalls: ['Polarity counts great powers, not all states or alliances.', '"Multipolar" does not mean "lots of conflicts".', 'Anarchy does not mean chaos (see the next topic).'],
    tip: 'Exam questions on current events usually want the concept behind them: polarity, sovereignty, collective action or the security dilemma.' },

  /* ---------- Unit 2: Contending perspectives ---------- */
  { id: 'anarchy', label: '2.1', title: 'International anarchy', unit: 2, link: EIRT, linkLabel: 'Reading: Mingst pp. 69–74; Thucydides; Hobbes (Canvas). Free theory primer: E-IR',
    ideas: [
      '<b>Anarchy</b> means there is no central authority above states, no world government to enforce rules. It does not mean chaos. States must rely on <b>self-help</b> for their security.',
      '<b>Sovereignty</b>: supreme authority within a territory. Externally it means legal equality and non-interference.',
      '<b>Thucydides</b>, <i>History of the Peloponnesian War</i>, the <b>Melian Dialogue</b> (416 BCE). Athens demands that neutral Melos submit. The Melians appeal to justice, the gods and help from Sparta. Athens replies that justice exists only between equals in power: "<b>the strong do what they can and the weak suffer what they must</b>." Melos refuses and is destroyed. Thucydides also explains the war itself: "the growth of the power of Athens, and the alarm which this inspired in Sparta, made war inevitable."',
      '<b>Thomas Hobbes</b>, <i>Leviathan</i> (1651), ch. 13. Without a common power to keep people in awe, the <b>state of nature</b> is a "war of every man against every man", and life is "<b>solitary, poor, nasty, brutish, and short</b>." The three causes of quarrel are <b>competition</b> (gain), <b>diffidence</b> (fear and insecurity) and <b>glory</b> (reputation). Domestically, a sovereign (the Leviathan) solves this. Internationally there is no Leviathan.',
      'The <b>security dilemma</b> (Herz, Jervis): what one state does to feel secure (arms, alliances) makes others less secure. They respond, and a spiral follows, even if nobody wants war.',
      '<b>Power</b> is the ability to get others to do what they otherwise would not. <b>Hard power</b> is military and economic coercion. <b>Soft power</b> (Joseph Nye) is attraction through culture, values and policies.'
    ],
    formulas: [],
    example: { p: 'In the Melian Dialogue, why will Athens not accept Melos as a neutral friend?', s: 'Athens says Melos\'s friendship would look like <b>weakness</b> to its other subjects, while Melos\'s hatred shows Athenian power. For Athens, the <b>reputation for power</b> in an anarchic world outweighs justice. That is the core realist lesson of the dialogue.' },
    pitfalls: ['Defining anarchy as disorder or constant war. It is the absence of a world government.', 'Thinking the security dilemma needs aggressive states. Defensive moves alone can produce it.', 'Mixing up the quotes. "Strong do what they can" is Thucydides; "nasty, brutish, and short" is Hobbes.'],
    tip: 'Quote-to-author matching shows up on multiple-choice exams. Learn the three quotes and who wrote them.' },

  { id: 'realism', label: '2.2', title: 'Realist theories', unit: 2, link: EIRT, linkLabel: 'Reading: Mingst ch. 3 pp. 75–81; Mearsheimer 2001 (Canvas)',
    ideas: [
      'Realism\'s core assumptions: <b>states</b> are the main actors, unitary and rational. The system is <b>anarchic</b>. States seek <b>survival</b> and security, and <b>power</b> is the key currency. States care about <b>relative gains</b>: how well they do compared with others.',
      '<b>Classical realism</b> (Hans Morgenthau, <i>Politics Among Nations</i>, 1948) roots conflict in human nature\'s drive for power: "interest defined in terms of power."',
      '<b>Structural realism (neorealism)</b> (Kenneth Waltz, <i>Theory of International Politics</i>, 1979) explains behavior by the system\'s <b>structure</b>: anarchy plus the distribution of capabilities. In <b>defensive realism</b>, states seek enough power to be secure and <b>balance</b> against threats. Waltz saw bipolarity as the most stable structure.',
      '<b>Offensive realism</b> (John Mearsheimer, "Anarchy and the Struggle for Power", in <i>The Tragedy of Great Power Politics</i>, 2001) rests on <b>five bedrock assumptions</b>: (1) the system is anarchic; (2) great powers have some offensive military capability; (3) states can never be certain of others\' intentions; (4) survival is their primary goal; (5) they are rational actors.',
      'From those five assumptions, Mearsheimer argues great powers fear each other, rely on self-help, and <b>maximize relative power</b>. The best way to survive is to become the <b>hegemon</b>. Global hegemony is nearly impossible because of the "stopping power of water", so states aim for <b>regional hegemony</b> and try to stop rivals from achieving it.',
      'Under the <b>balance of power</b>, states counter a rising power by <b>internal balancing</b> (arming) or <b>external balancing</b> (alliances), or they <b>bandwagon</b> with it. Concern for relative gains makes lasting cooperation hard.'
    ],
    formulas: [],
    example: { p: 'China says its rise is peaceful. Why would an offensive realist still expect conflict with the United States?', s: 'Intentions can never be known for certain, and they can change. A stronger China would try to become the <b>regional hegemon</b> in Asia, as the US did in the Western Hemisphere. The US, wanting no peer competitor, would <b>balance</b> through alliances with Japan, Australia and others. Structure, not either side\'s character, drives the rivalry.' },
    pitfalls: ['Mixing up the sources of conflict. Classical realism points to human nature; structural realism points to the anarchic system.', 'Assuming realists favour war. Many counsel restraint; Mearsheimer and Waltz opposed the 2003 Iraq war.', 'Mixing up defensive realism (enough power for security) and offensive realism (as much relative power as possible).'],
    tip: 'Keywords for realism: anarchy, survival, self-help, relative gains, balance of power. Practise listing Mearsheimer\'s five assumptions from memory.' },

  { id: 'liberalism', label: '2.3', title: 'Liberalism and international cooperation', unit: 2, link: EIRT, linkLabel: 'Reading: Mingst ch. 3 pp. 82–86; Kant, Perpetual Peace (Canvas)',
    ideas: [
      'Liberals hold that people and states can <b>cooperate and progress</b>. Many actors matter: IGOs, NGOs, firms and individuals. States are not unitary, since <b>domestic institutions and preferences</b> shape foreign policy. Cooperation is possible because states care about <b>absolute gains</b>.',
      'In <b>Immanuel Kant</b>\'s <i>Perpetual Peace</i> (1795), three definitive articles set out the conditions for peace: (1) every state\'s civil constitution should be <b>republican</b>; (2) the law of nations should rest on a <b>federation of free states</b>; (3) cosmopolitan right should be limited to <b>universal hospitality</b>. His preliminary articles include abolishing standing armies over time and no forcible interference in another state\'s constitution.',
      'The <b>democratic peace</b>: democracies rarely if ever fight each other, though they do fight non-democracies. Explanations include <b>shared norms</b> of peaceful dispute resolution, <b>institutional constraints</b> (leaders answer to voters and legislatures) and <b>transparency</b>.',
      '<b>Neoliberal institutionalism</b> (Robert Keohane) accepts anarchy but says <b>institutions</b> make cooperation possible. They provide information, monitor compliance, lower transaction costs, link issues and lengthen the <b>"shadow of the future"</b>. <b>Complex interdependence</b> (Keohane and Nye) means many channels of contact and less usable military force.',
      '<b>Commercial liberalism</b>: trade and economic interdependence raise the cost of war.',
      'The <b>prisoner\'s dilemma</b> models cooperation under anarchy. Both sides gain from mutual cooperation, but each is tempted to defect, so one-shot play ends in mutual defection. <b>Repeated play</b> (Axelrod\'s tit-for-tat) and institutions make cooperation rational. Rousseau\'s <b>stag hunt</b> is a game of trust: cooperation is best for both if each believes the other will cooperate.'
    ],
    formulas: [],
    example: { p: 'A trade deal gives the US $50 billion in gains and China $80 billion. How would a liberal and a realist evaluate it?', s: 'A <b>liberal</b> looks at <b>absolute gains</b>: the US is $50 billion better off, so take the deal. A <b>realist</b> looks at <b>relative gains</b>: China gains $30 billion more and grows stronger relative to the US, which could threaten US security later, so the US may refuse even a deal that makes it richer.' },
    pitfalls: ['Reading the democratic peace as "democracies are peaceful". The claim is about wars between democracies.', 'Thinking liberals deny anarchy. Neoliberals accept it and argue its effects can be softened.', 'Mixing up the games. In the prisoner\'s dilemma, defecting is always tempting; in the stag hunt, cooperation is best if you trust the other player.'],
    tip: 'Keywords for liberalism: cooperation, institutions, interdependence, absolute gains, democracy, trade.' },

  { id: 'constructivism', label: '2.4', title: 'Constructivism and other frameworks', unit: 2, link: EIRT, linkLabel: 'Reading: Mingst ch. 3 pp. 87–112 (Canvas). Free primer: E-IR theory',
    ideas: [
      '<b>Constructivism</b>: international reality is <b>socially constructed</b>. Shared <b>ideas, identities and norms</b> shape what states want and how they see each other. Alexander Wendt (1992): "<b>anarchy is what states make of it</b>." Anarchy has no fixed logic; it can be hostile or friendly depending on shared understandings.',
      'Wendt\'s example: 500 British nuclear weapons are less threatening to the US than 5 North Korean ones, because Britain is a friend and North Korea is not. Material power matters through the meanings attached to it.',
      '<b>Norms</b> are shared expectations of appropriate behavior (a "logic of appropriateness"). <b>Norm entrepreneurs</b> promote them. In the <b>norm life cycle</b> (Finnemore and Sikkink), a norm emerges, then cascades, then is internalized. Examples include the bans on landmines and chemical weapons, the nuclear taboo, and sovereignty itself.',
      '<b>Feminist IR</b> asks "<b>where are the women?</b>" (Cynthia Enloe, <i>Bananas, Beaches and Bases</i>). It shows how ideas of masculinity shape concepts like power and security (J. Ann Tickner), and widens security to include <b>human security</b>: the people affected by war, trafficking and poverty.',
      '<b>Radical / Marxist</b> approaches see economic class and capitalism as the drivers. Lenin argued imperialism is a stage of capitalism. <b>Dependency theory</b> holds that the periphery\'s underdevelopment results from its ties to the core. <b>World-systems theory</b> (Immanuel Wallerstein) divides the world into a core, semi-periphery and periphery.',
      'Theories are <b>lenses</b>: each highlights different actors and causes. A strong answer applies two or three to the same event and compares what each explains.'
    ],
    formulas: [],
    example: { p: 'Why doesn\'t the United States fear Britain\'s nuclear arsenal but fears North Korea\'s much smaller one?', s: 'Realism focuses on capabilities, and Britain\'s are far larger, so realism struggles here. <b>Constructivism</b> explains it through <b>identity</b>: the US and UK share a "special relationship", democratic values and alliance norms, so British weapons are not read as a threat. North Korea is defined as an adversary.' },
    pitfalls: ['Treating constructivism as idealism. It does not say states are kind, only that their interests come from ideas and identities.', 'Reducing feminist IR to counting women in office. It asks how gender shapes the concepts themselves.', 'Mixing up dependency theory (the periphery is held back by the core) and modernization theory (all states pass through the same stages).'],
    tip: 'Keywords: identity, norms and ideas point to constructivism; gender and human security to feminism; class, core and periphery to Marxist or radical theory.' },

  /* ---------- Unit 3: International security ---------- */
  { id: 'interstate-war', label: '3.1', title: 'Causes of war I: interstate wars', unit: 3, link: CANVAS, linkLabel: 'Reading: Mingst ch. 6; Fearon 1995 (Canvas)',
    ideas: [
      '<b>War</b> is organized, sustained violence between political groups. Researchers often count a war at 1,000 or more battle deaths in a year (the Correlates of War threshold). <b>Interstate</b> wars are between states; <b>intrastate</b> (civil) wars are within one. Since 1945, wars between states have become rare and civil wars more common.',
      'Explanations come at each level. <b>Individual:</b> leaders\' misperceptions, overconfidence, psychology. <b>State:</b> nationalism, regime type, and <b>diversionary war</b> (starting a conflict to rally support at home). <b>System:</b> anarchy, shifts in power, polarity.',
      '<b>Fearon\'s puzzle</b> ("Rationalist Explanations for War", 1995): war is costly, so there should always be a negotiated deal that both sides prefer to fighting, the <b>bargaining range</b>. Why do rational states fight anyway?',
      'Fearon\'s <b>three rationalist explanations</b>: (1) <b>private information</b> about capabilities and resolve, combined with <b>incentives to misrepresent</b> it (bluffing), so the sides disagree about who would win; (2) <b>commitment problems</b>: one side cannot credibly promise not to exploit a future advantage, as when power is shifting (preventive war) or striking first pays (preemptive war); (3) <b>issue indivisibility</b>: the stake cannot be divided. Fearon thinks indivisibility is rarely the real reason, because side payments and linking issues usually make deals divisible.',
      'With a bargaining range, if A would win the war with probability <i>p</i>, and fighting costs A and B shares <i>c</i><sub>A</sub> and <i>c</i><sub>B</sub> of the prize, then any split giving A between <i>p</i> − <i>c</i><sub>A</sub> and <i>p</i> + <i>c</i><sub>B</sub> beats war for both sides.',
      '<b>Preventive war</b>: strike now because the rival is getting stronger and will be more dangerous later (a power shift). <b>Preemptive war</b>: strike first because an enemy attack is imminent (Israel in June 1967).'
    ],
    formulas: [{ n: 'Bargaining range', t: 'p - c_A \\le x \\le p + c_B' }],
    example: { p: 'A would win a war over a territory with probability 0.6. War costs A 0.1 and B 0.15 of the territory\'s value. Which settlements do both sides prefer to war?', s: 'A expects 0.6 − 0.1 = <b>0.5</b> from fighting, so it accepts any deal giving it at least half. B expects to keep 0.4 − 0.15 = 0.25, so it accepts any deal giving A at most 1 − 0.25 = <b>0.75</b>. Every split between 0.5 and 0.75 beats war for both. Fearon asks why states fail to find one: misrepresented private information, commitment problems or (rarely) indivisibility.' },
    pitfalls: ['Saying Fearon thinks leaders are irrational. His explanations assume rational states.', 'Mixing up preventive war (a rival growing stronger over time) and preemptive war (an imminent attack).', 'Forgetting that the bargaining range exists because war is costly: the costs create the room for a deal.'],
    tip: 'For any war on the exam, ask which Fearon mechanism fits: information, commitment or indivisibility.' },

  { id: 'civil-war', label: '3.2', title: 'Causes of war II: civil wars', unit: 3, link: CANVAS, linkLabel: 'Reading: Levy & Thompson, Causes of War, ch. 7 (Canvas)',
    ideas: [
      'A <b>civil war</b> is armed conflict inside a state between the government and organized armed groups, fought for control of the government or for territory (<b>secession</b>). Since 1945 most wars have been civil wars, and they tend to last longer than wars between states.',
      'In the <b>greed vs grievance</b> debate, Collier and Hoeffler argue that <b>opportunity</b> explains rebellion better than grievance. Opportunity means lootable resources such as diamonds or drugs, diaspora funding, and poverty that makes recruits cheap. Grievances are inequality and ethnic or political exclusion.',
      '<b>Fearon and Laitin (2003)</b>: once income is controlled for, ethnic or religious diversity does not predict civil war. What matters is the conditions that favour <b>insurgency</b>: a <b>weak state</b> (poverty, low capacity), <b>rough terrain</b> (mountains), a large population, political instability and newly independent states.',
      'The <b>ethnic security dilemma</b> (Barry Posen): when central authority collapses, groups face anarchy among themselves. Each arms for protection, the others read that as a threat, and fear spirals into violence.',
      'Civil wars are <b>hard to end</b> because of a commitment problem. Rebels must disarm and trust the government not to punish them afterward. Third-party guarantees such as peacekeepers and power-sharing help (Barbara Walter). Many civil wars <b>recur</b>.',
      'Consequences reach beyond borders: refugees and internally displaced people, spillover into neighbours, and outside intervention that turns a civil war into an <b>internationalized</b> one (Syria after 2011).'
    ],
    formulas: [],
    example: { p: 'Country A is poor, mountainous and has alluvial diamonds in rebel-held areas. Country B is ethnically diverse but rich, flat and has a capable state. Which is at greater risk of civil war, and why?', s: '<b>Country A.</b> Fearon and Laitin point to state weakness and rough terrain, and Collier and Hoeffler to lootable resources and cheap recruits. Ethnic diversity alone (Country B) does not predict civil war once income and state capacity are accounted for.' },
    pitfalls: ['Claiming ethnic diversity by itself causes civil war. The evidence points to state weakness and opportunity.', 'Treating greed and grievance as mutually exclusive. Most wars mix both.', 'Forgetting why peace deals fail: the commitment problem of disarming.'],
    tip: 'Match names to arguments: Collier–Hoeffler (opportunity, greed), Fearon–Laitin (insurgency conditions, weak states), Posen (ethnic security dilemma), Walter (third-party guarantees).' },

  { id: 'wmd', label: '3.3', title: 'Weapons of mass destruction and other threats', unit: 3, link: 'https://www.youtube.com/watch?v=zVhQOhxb1Mc', linkLabel: 'Assigned video: how nuclear weapons work',
    ideas: [
      '<b>Weapons of mass destruction</b> (WMD) are nuclear, chemical and biological weapons, and sometimes radiological ones. <b>Fission</b> (atomic) bombs split heavy nuclei of uranium-235 or plutonium-239. <b>Thermonuclear</b> (hydrogen) bombs add the <b>fusion</b> of light hydrogen isotopes for far larger yields. Hiroshima (uranium, 6 August 1945) and Nagasaki (plutonium, 9 August 1945) are the only wartime uses.',
      '<b>Deterrence</b> prevents an attack by threatening unacceptable retaliation. It needs capability, <b>credibility</b> and communication. <b>Mutually assured destruction (MAD)</b> rests on each side having a secure <b>second-strike</b> capability, such as missiles on submarines, so that striking first is suicidal.',
      'The <b>Non-Proliferation Treaty (NPT)</b> was signed in 1968 and took effect in 1970. Five recognized nuclear-weapon states (the US, Russia, the UK, France and China) pledge to negotiate disarmament. Non-nuclear states give up weapons, and all may use peaceful nuclear energy under <b>IAEA</b> inspections. Outside it: India and Pakistan (both tested in 1998), Israel (undeclared), and North Korea (announced its withdrawal in 2003).',
      'In <b>Nina Tannenwald\'s nuclear taboo</b> ("The Nuclear Taboo", 1999), a <b>normative prohibition</b>, not just deterrence, explains why the US has not used nuclear weapons since 1945, even against non-nuclear enemies in Korea, Vietnam and the 1991 Gulf War. Nuclear use came to be seen as unacceptable. This is a <b>constructivist</b> argument.',
      'In <b>Kenneth Waltz\'s "Why Iran Should Get the Bomb"</b> (2012), nuclear weapons make states cautious, so balancing would mean stability. Israel\'s regional nuclear monopoly is what destabilizes the Middle East; a nuclear Iran would restore balance. This is a <b>structural realist</b> argument, consistent with his earlier view that the spread of nuclear weapons may be better than feared.',
      'Other threats: <b>chemical weapons</b> (the Chemical Weapons Convention, 1993, in force 1997; used by Syria\'s government), <b>biological weapons</b> (the Biological Weapons Convention, 1972), <b>terrorism</b> by nonstate actors who may be undeterrable, and <b>cyberattacks</b>.'
    ],
    formulas: [],
    example: { p: 'Why did the US not use nuclear weapons in the Korean War, when only it had a large arsenal? Compare a deterrence answer with Tannenwald\'s.', s: '<b>Deterrence</b> struggles here: the Soviet Union had only a small arsenal and could not yet retaliate effectively against the US, and North Korea and China had none. <b>Tannenwald</b> argues a growing <b>normative taboo</b> made US leaders see nuclear use as illegitimate and politically costly at home and abroad, so they ruled it out even when it might have been militarily useful.' },
    pitfalls: ['Mixing up the arguments. Tannenwald\'s is a norm (constructivist); Waltz\'s is balance and stability (realist).', 'Calling the NPT\'s five nuclear states "all nuclear states". India, Pakistan, Israel and North Korea are outside it.', 'Mixing up fission (splitting) and fusion (joining).'],
    tip: 'Pair each reading with its theory and one sentence: Tannenwald — taboo; Waltz — nuclear balancing brings stability.' },

  /* ---------- Unit 4: International organizations and law ---------- */
  { id: 'igos', label: '4.1', title: 'International organizations', unit: 4, link: 'https://www.un.org/en/about-us/un-charter/full-text', linkLabel: 'Assigned: the UN Charter (plus Mingst ch. 7 pp. 235–47, ch. 9)',
    ideas: [
      '<b>IGOs</b> have states as members and are created by treaty (the UN, NATO, the WTO, the EU). <b>NGOs</b> are private: Amnesty International, Greenpeace, Doctors Without Borders and the International Committee of the Red Cross.',
      'Do IOs matter? <b>Realists:</b> they reflect the interests of powerful states and matter little on their own. <b>Liberals:</b> they solve collective-action problems by providing information, lowering costs and monitoring compliance. <b>Constructivists:</b> they spread norms and have authority of their own as bureaucracies.',
      'The <b>United Nations</b> Charter was signed on 26 June 1945 in San Francisco and took effect on 24 October 1945. The UN has 193 members and six principal organs. The <b>General Assembly</b> has every member with one vote and makes non-binding recommendations. The <b>Security Council</b> has 15 members: five permanent with a <b>veto</b> (the US, UK, France, Russia, China) and ten elected for two-year terms. The others are the <b>Secretariat</b> (led by the Secretary-General), the <b>International Court of Justice</b> in The Hague, the Economic and Social Council, and the Trusteeship Council (inactive since 1994).',
      'Key Charter articles: <b>Article 2(4)</b> bans the threat or use of force against any state\'s territorial integrity or political independence. <b>Article 2(7)</b> bars intervention in domestic matters. <b>Article 51</b> preserves the inherent right of individual or collective <b>self-defense</b> against armed attack. <b>Chapter VII</b> lets the Security Council name threats to the peace and order binding sanctions or force. <b>Chapter VI</b> covers peaceful settlement. Under Article 27, a substantive Security Council decision needs <b>9 of 15 votes</b> and no <b>veto</b>; by long practice, a permanent member that abstains has not vetoed.',
      '<b>Collective security</b> (the League, the UN) means all against any aggressor in the system. <b>Collective defense</b> means an alliance against outside threats, as in NATO\'s <b>Article 5</b>: an attack on one is an attack on all. Article 5 has been invoked once, after 9/11. <b>Peacekeeping</b> is not in the Charter ("Chapter six and a half") and rests on consent, impartiality and minimal force.',
      'The <b>European Union</b> grew from the European Coal and Steel Community (1951) to the European Economic Community (Treaty of Rome, 1957) to the EU (<b>Maastricht</b>, 1992). It has a single market and the <b>euro</b> (1999; notes and coins in 2002). Sovereignty is pooled in <b>supranational</b> bodies (Commission, Parliament, Court of Justice) alongside intergovernmental ones (the Council). The UK left in 2020 (Brexit).'
    ],
    formulas: [],
    example: { p: 'Why could the UN not authorize force against Russia after its 2022 invasion of Ukraine, and what did it do instead?', s: 'Russia is a <b>permanent member</b> of the Security Council and <b>vetoed</b> the draft resolution, so there could be no Chapter VII action. The issue went to the <b>General Assembly</b>, which on 2 March 2022 voted 141 to 5 (with 35 abstentions) to demand Russia\'s withdrawal. GA resolutions are <b>not binding</b>, which shows both the veto\'s power and the GA\'s limits.' },
    pitfalls: ['Mixing up the General Assembly (all members, recommendations) and the Security Council (15 members, binding decisions, P5 veto).', 'Mixing up collective security (all against any aggressor) and collective defense (an alliance like NATO).', 'Thinking every Security Council member has a veto. Only the five permanent members do.'],
    tip: 'Memorize the P5 and three provisions: Article 2(4), Article 51 and Chapter VII. Then practise one example of each.' },

  { id: 'law-rights', label: '4.2', title: 'International law and human rights', unit: 4, link: 'https://www.un.org/en/about-us/universal-declaration-of-human-rights', linkLabel: 'Assigned: the UDHR (plus Mingst ch. 7 pp. 248–274, ch. 10; Power 2001)',
    ideas: [
      'The <b>sources of international law</b> are listed in Article 38 of the ICJ Statute: <b>treaties</b> (conventions); <b>customary international law</b>, which requires both state practice and <i>opinio juris</i> (a sense of legal obligation); general principles of law; and, as secondary sources, judicial decisions and the writings of leading scholars.',
      'International law has <b>no world police</b>. States comply because of reciprocity, reputation, domestic incorporation of the law, and sanctions. Louis Henkin: "almost all nations observe almost all principles of international law and almost all of their obligations almost all of the time."',
      'There are two different courts. The <b>International Court of Justice</b> (ICJ) is the UN\'s court and hears disputes between <b>states</b>, with their consent. The <b>International Criminal Court</b> (ICC) was created by the Rome Statute (1998, in force 2002) and prosecutes <b>individuals</b> for genocide, crimes against humanity, war crimes and aggression. The US, Russia and China are not members.',
      'The <b>Universal Declaration of Human Rights</b> (UDHR) was adopted by the UN General Assembly on <b>10 December 1948</b>; Eleanor Roosevelt chaired the drafting commission. It has 30 articles and is <b>not a binding treaty</b>, though much of it is now considered custom. The binding covenants (1966) are the <b>ICCPR</b> (civil and political rights) and the <b>ICESCR</b> (economic, social and cultural rights). Debates continue over universalism and cultural relativism.',
      'The <b>Genocide Convention</b> (1948) defines genocide as acts committed with <b>intent to destroy</b>, in whole or in part, a national, ethnic, racial or religious group.',
      'In <b>Rwanda (1994)</b>, about 800,000 people, mostly Tutsi along with moderate Hutu, were killed in about 100 days. <b>Samantha Power, "Bystanders to Genocide"</b> (2001), shows the US knew. Officials avoided the word "genocide" to dodge pressure to act, led the push to cut the UN peacekeeping force (UNAMIR), and refused to jam the hate radio station (RTLM). Inaction was a <b>choice</b>, made easier by the absence of domestic political pressure. The <b>Responsibility to Protect</b> (R2P, 2005) answered this: sovereignty carries a duty to protect, and if a state fails, the international community should act.'
    ],
    formulas: [],
    example: { p: 'Is the Universal Declaration of Human Rights legally binding?', s: 'Not as a document. It is a <b>General Assembly resolution</b>, not a treaty. Its rights became binding on ratifying states through the <b>ICCPR and ICESCR</b> (1966), and many of its core provisions, such as the bans on torture and slavery, are now treated as <b>customary international law</b>.' },
    pitfalls: ['Mixing up the ICJ (states, UN court) and the ICC (individuals, Rome Statute).', 'Saying the UDHR is a treaty.', 'Defining genocide as any mass killing. The legal definition needs intent to destroy a protected group.'],
    tip: 'For Power\'s article, know three facts: the US avoided the word "genocide", pushed to withdraw UNAMIR, and would not jam RTLM.' },

  /* ---------- Unit 5: International political economy ---------- */
  { id: 'trade', label: '5.1', title: 'International trade and globalization', unit: 5, link: CANVAS, linkLabel: 'Reading: Mingst ch. 8 (Canvas)',
    ideas: [
      'There are three classic perspectives in international political economy (IPE). <b>Economic liberalism</b> (Adam Smith, David Ricardo) favours markets and free trade for mutual gain. <b>Mercantilism / economic nationalism</b> (Alexander Hamilton, Friedrich List) holds that the economy should serve state power: protect strategic industries and run trade surpluses. <b>Radical / Marxist</b> approaches stress exploitation and dependency between core and periphery.',
      'In <b>comparative advantage</b> (Ricardo, 1817), countries gain by specializing in what they make at the <b>lowest opportunity cost</b>, even if one country is better at everything (<b>absolute advantage</b>).',
      'Trade raises total income but creates <b>winners and losers</b>. Exporters and consumers gain; import-competing workers and firms lose, which is why protectionism is political. The tools are <b>tariffs</b> (taxes on imports), <b>quotas</b>, <b>subsidies</b> and non-tariff barriers.',
      'In the postwar order, <b>Bretton Woods (1944)</b> created the <b>IMF</b> and <b>World Bank</b>. The <b>GATT</b> (1947) lowered tariffs through negotiating rounds. The <b>WTO</b> (1995) added services, intellectual property and binding <b>dispute settlement</b>. Its principles are <b>most-favoured-nation</b> treatment (no discrimination among members) and <b>national treatment</b> (imports treated like domestic goods). The Doha Round (2001) stalled, and the WTO\'s Appellate Body stopped working in 2019 when the US blocked new judges.',
      'Regional agreements include NAFTA (1994), replaced by the <b>USMCA</b> (2020), the EU single market, and the CPTPP.',
      '<b>Globalization</b> is the growing flow of goods, capital, people and ideas across borders, driven by technology and policy. Critics point to inequality, lost jobs in some regions and lost sovereignty; the backlash includes tariffs and populism.'
    ],
    formulas: [{ n: 'Opportunity cost of good X', t: '\\text{OC}_X = \\frac{\\text{units of Y given up}}{\\text{units of X gained}}' }],
    example: { p: 'In one hour, Country A can make 10 shirts or 5 phones; Country B can make 4 shirts or 4 phones. Who should make what?', s: 'A\'s opportunity cost of a phone is 10/5 = 2 shirts; B\'s is 4/4 = 1 shirt. B gives up less, so <b>B has the comparative advantage in phones</b>. For shirts, A gives up 0.5 phone per shirt and B gives up 1, so <b>A has the comparative advantage in shirts</b>. A has an absolute advantage in both, yet both gain if A makes shirts and B makes phones and they trade.' },
    pitfalls: ['Mixing up absolute advantage (more output) and comparative advantage (lower opportunity cost).', 'Mixing up the GATT (1947, an agreement) and the WTO (1995, an organization with binding dispute settlement).', 'Saying mercantilists want consumer welfare. Their goal is state power and wealth.'],
    tip: 'Opportunity cost is what you give up. Divide the other good by this good.' },

  { id: 'money', label: '5.2', title: 'International monetary relations and financial crises', unit: 5, link: CANVAS, linkLabel: 'Reading: Frieden, Currency Politics (2015), ch. 1 (Canvas)',
    ideas: [
      'An <b>exchange rate</b> is the price of one currency in another. A <b>fixed</b> (pegged) regime ties a currency to gold or another currency, as under the gold standard and Bretton Woods (the dollar at $35 an ounce of gold), or a currency board. Under <b>floating</b>, markets set the rate. A <b>managed float</b> sits in between.',
      '<b>Jeffry Frieden</b> (<i>Currency Politics</i>, ch. 1) sees currency choice as a political decision on two dimensions. The <b>regime</b> is a trade-off: fixed rates give stability and credibility, floating rates keep national <b>monetary autonomy</b>. The <b>level</b> is a choice between a strong (appreciated) and a weak (depreciated) currency.',
      'Frieden says these choices have <b>distributional</b> effects. People in international trade and investment value <b>stable, fixed</b> rates. Groups focused on the domestic economy value the flexibility of <b>floating</b>. Producers of tradable goods (exporters and import-competing industries) want a <b>weaker</b> currency. Consumers, importers and people with foreign-currency debts gain from a <b>stronger</b> one.',
      'The <b>trilemma</b> (the "impossible trinity", from Mundell–Fleming): no country can have all three of a fixed exchange rate, free capital mobility and an independent monetary policy. It must <b>give up one</b>.',
      '<b>Depreciation</b> makes exports cheaper abroad and imports dearer at home; <b>appreciation</b> does the reverse. Bretton Woods ended when Nixon closed the gold window (August 1971); major currencies floated by 1973.',
      '<b>Financial crises</b>: the Latin American debt crisis (1982), Mexico\'s peso crisis (1994), the <b>Asian financial crisis</b> (1997–98, starting with Thailand\'s baht), the <b>Global Financial Crisis</b> (2008: US subprime mortgages, Lehman Brothers) and the <b>eurozone debt crisis</b> (2010 on, Greece). The <b>IMF</b> lends in crises with <b>conditionality</b> (policy reforms), which critics call austerity.'
    ],
    formulas: [{ n: 'Percent change in a currency\'s value', t: '\\%\\Delta = \\frac{\\text{new rate} - \\text{old rate}}{\\text{old rate}} \\times 100' }],
    example: { p: 'The dollar moves from 0.90 euros to 0.99 euros. Did it appreciate or depreciate, by how much, and who in the US likes it?', s: 'Each dollar now buys more euros, so the dollar <b>appreciated</b> by (0.99 − 0.90) / 0.90 = <b>10%</b>. American consumers, importers and tourists going to Europe gain. US exporters and import-competing manufacturers lose, because their goods got relatively dearer. Frieden would expect those producers to lobby for a weaker dollar.' },
    pitfalls: ['Getting the direction wrong. If it takes more of the foreign currency to buy one dollar, the dollar appreciated.', 'Assuming a strong currency is always good. It hurts exporters.', 'Trying to keep all three corners of the trilemma. You pick two.'],
    tip: 'Write the rate as "foreign currency per dollar" before deciding which way it moved.' },

  { id: 'environment', label: '5.3', title: 'Environment and population', unit: 5, link: CANVAS, linkLabel: 'Reading: Mingst ch. 11 & 12 (Canvas)',
    ideas: [
      'In the <b>tragedy of the commons</b> (Garrett Hardin, 1968), shared resources nobody owns (the atmosphere, open oceans, fisheries) are overused. Each user keeps the full benefit of using more but shares the cost with everyone. The result is a <b>collective-action problem</b> with <b>free riders</b>.',
      'Climate cooperation: the <b>UN Framework Convention on Climate Change</b> (1992, Rio Earth Summit). The <b>Kyoto Protocol</b> (1997) set binding emission targets for developed countries only; the US never ratified it. The <b>Paris Agreement</b> (2015) has every country set its own <b>nationally determined contributions</b> (NDCs), aims to hold warming well below 2°C and pursue 1.5°C, and relies on review and ratcheting up. The US left under Trump, rejoined in 2021, and gave notice to leave again in 2025.',
      'The <b>Montreal Protocol</b> (1987) on ozone-depleting CFCs is the success story. It succeeded because there were few producers, substitutes were available, the science was clear and poorer states got help.',
      'Under <b>common but differentiated responsibilities</b>, rich countries caused most historical emissions, while developing countries claim a right to develop. China is the largest emitter today; the US has the largest cumulative emissions.',
      'World population passed <b>8 billion</b> in November 2022 (UN). In the <b>demographic transition</b>, high birth and death rates give way to falling death rates (rapid growth), then falling birth rates, then low rates of both. <b>Aging societies</b> (Japan, Europe, China) contrast with <b>youth bulges</b> (much of sub-Saharan Africa). <b>Malthus</b> (1798) warned that population outruns food; optimists point to technology and the Green Revolution.',
      'The <b>1951 Refugee Convention</b> defines a refugee as someone outside their country with a well-founded fear of persecution for race, religion, nationality, membership of a particular social group or political opinion. Its core principle is <b>non-refoulement</b>: no return to danger. People fleeing climate change are not covered.'
    ],
    formulas: [{ n: 'Doubling time (rule of 70)', t: 't_{double} \\approx \\frac{70}{\\text{growth rate in \\%}}' }],
    example: { p: 'Why did the Montreal Protocol succeed when the Kyoto Protocol struggled?', s: 'For ozone, a <b>few firms</b> made CFCs, <b>cheap substitutes</b> existed, the science and the harm were clear, and a fund helped developing countries, so cooperation was cheap and easy to verify. Climate change involves every economy\'s energy use, high costs, long time horizons and big <b>free-rider</b> incentives. Kyoto also left out developing countries, including China, and lacked US ratification.' },
    pitfalls: ['Mixing up Kyoto (binding targets, developed countries only) and Paris (national pledges from all countries).', 'Thinking the refugee definition covers economic or climate migrants.', 'Reading the demographic transition backwards. Death rates fall first.'],
    tip: 'Use the tragedy of the commons as your frame for any environmental short-answer question: who benefits, who pays, and what institution changes the incentives.' }
];

/* key terms sheet: d = definition */
const FORMULAS = [
  { group: 'Core concepts', items: [
    { n: 'Anarchy', d: 'No central authority above states; not chaos. States rely on self-help.' },
    { n: 'Sovereignty', d: 'Supreme authority within a territory; legal equality and non-interference abroad (Westphalia, 1648).' },
    { n: 'State vs nation', d: 'State: territory, population, government, sovereignty. Nation: a people with a shared identity.' },
    { n: 'Levels of analysis', d: 'Individual, state and international system (Waltz\'s three images, 1959).' },
    { n: 'Power (hard / soft)', d: 'Getting others to do what they otherwise would not. Hard: coercion and payment. Soft (Nye): attraction.' },
    { n: 'Polarity', d: 'Number of great powers: unipolar, bipolar, multipolar.' },
    { n: 'Security dilemma', d: 'One state\'s steps to be secure make others insecure, producing a spiral (Herz, Jervis).' },
    { n: 'Balance of power', d: 'States counter a rising power by arming (internal) or allying (external) instead of bandwagoning.' },
    { n: 'IGO vs NGO', d: 'IGO: states as members, created by treaty (UN). NGO: private group (Amnesty International).' }
  ] },
  { group: 'Theories', items: [
    { n: 'Classical realism', d: 'Morgenthau: conflict from human nature; "interest defined in terms of power".' },
    { n: 'Structural realism', d: 'Waltz: anarchy + distribution of capabilities shape behavior; balancing; bipolarity most stable.' },
    { n: 'Offensive realism', d: 'Mearsheimer: great powers maximize relative power and seek regional hegemony.' },
    { n: 'Liberalism', d: 'Cooperation and progress are possible; many actors; domestic politics matter; absolute gains.' },
    { n: 'Neoliberal institutionalism', d: 'Keohane: institutions enable cooperation under anarchy (information, monitoring, shadow of the future).' },
    { n: 'Democratic peace', d: 'Democracies rarely if ever fight each other (norms, institutions, transparency).' },
    { n: 'Constructivism', d: 'Ideas, identities and norms shape interests. Wendt: "anarchy is what states make of it".' },
    { n: 'Feminist IR', d: '"Where are the women?" (Enloe). Gender shapes power and security; human security (Tickner).' },
    { n: 'Marxist / dependency / world-systems', d: 'Class and capitalism drive IR. Periphery underdeveloped by the core; core, semi-periphery, periphery (Wallerstein).' },
    { n: 'Relative vs absolute gains', d: 'Realists ask "who gains more?"; liberals ask "do we gain?"' },
    { n: 'Prisoner\'s dilemma', d: 'Mutual cooperation beats mutual defection, but each is tempted to defect; repetition helps.' },
    { n: 'Stag hunt', d: 'Rousseau: cooperating is best for both if each trusts the other to cooperate.' }
  ] },
  { group: 'War and security', items: [
    { n: 'Bargaining range', d: 'Deals both sides prefer to war: A\'s share between p − c_A and p + c_B (Fearon).' },
    { n: 'Fearon\'s three explanations', d: '(1) Private information + incentives to misrepresent; (2) commitment problems; (3) issue indivisibility.' },
    { n: 'Preventive war', d: 'Fight now because the rival is getting stronger (power shift).' },
    { n: 'Preemptive war', d: 'Strike first because an enemy attack is imminent (Israel, 1967).' },
    { n: 'Diversionary war', d: 'Starting a conflict abroad to rally support at home.' },
    { n: 'Greed vs grievance', d: 'Collier & Hoeffler: opportunity (lootable resources, cheap recruits) explains rebellion better than grievance.' },
    { n: 'Insurgency conditions', d: 'Fearon & Laitin: weak/poor state, rough terrain, large population, instability. Not ethnic diversity itself.' },
    { n: 'Deterrence / MAD', d: 'Preventing attack by threat of retaliation; MAD rests on secure second-strike forces.' },
    { n: 'NPT (1968/1970)', d: 'Five nuclear states pledge disarmament talks; others forgo weapons; IAEA inspections; peaceful energy.' },
    { n: 'Nuclear taboo', d: 'Tannenwald (1999): a norm against nuclear use explains US non-use since 1945.' },
    { n: 'Nuclear balancing', d: 'Waltz (2012): a nuclear Iran would balance Israel and bring stability.' }
  ] },
  { group: 'Organizations, law and rights', items: [
    { n: 'UN Security Council', d: '15 members; P5 (US, UK, France, Russia, China) with veto; binding decisions under Chapter VII.' },
    { n: 'UN General Assembly', d: 'All 193 members, one vote each; non-binding recommendations.' },
    { n: 'Article 2(4)', d: 'Bans the threat or use of force against the territorial integrity or political independence of any state.' },
    { n: 'Article 51', d: 'Inherent right of individual or collective self-defense against armed attack.' },
    { n: 'Collective security vs defense', d: 'All against any aggressor (UN) vs an alliance against outside threats (NATO Article 5).' },
    { n: 'Sources of international law', d: 'Treaties; custom (state practice + opinio juris); general principles; courts and scholars (ICJ Statute Art. 38).' },
    { n: 'ICJ vs ICC', d: 'ICJ: UN court for disputes between states. ICC (Rome Statute 1998/2002): tries individuals.' },
    { n: 'UDHR', d: 'UN General Assembly, 10 Dec 1948; 30 articles; not a binding treaty. Binding: ICCPR and ICESCR (1966).' },
    { n: 'Genocide', d: 'Acts with intent to destroy, in whole or part, a national, ethnic, racial or religious group (1948 Convention).' },
    { n: 'Responsibility to Protect', d: 'R2P (2005): states must protect their people; if they fail, the international community should act.' }
  ] },
  { group: 'Political economy and global issues', items: [
    { n: 'Comparative advantage', d: 'Ricardo: specialize where your opportunity cost is lowest; both sides gain from trade.' },
    { n: 'Mercantilism', d: 'Economics serves state power: protection, trade surpluses, strategic industries.' },
    { n: 'Bretton Woods (1944)', d: 'Created the IMF and the World Bank; fixed exchange rates tied to the dollar and gold, until 1971.' },
    { n: 'GATT / WTO', d: 'GATT (1947) cut tariffs in rounds; WTO (1995) added services, IP and binding dispute settlement.' },
    { n: 'Most-favored-nation', d: 'A trade concession to one WTO member must be extended to all.' },
    { n: 'Trilemma', d: 'Fixed exchange rate, free capital mobility, independent monetary policy: pick two.' },
    { n: 'Depreciation', d: 'A currency loses value: exports cheaper abroad, imports dearer at home.' },
    { n: 'IMF conditionality', d: 'Crisis loans come with required policy reforms (often austerity).' },
    { n: 'Tragedy of the commons', d: 'Hardin (1968): shared, unowned resources are overused; free riding.' },
    { n: 'Kyoto vs Paris', d: 'Kyoto (1997): binding targets for developed countries. Paris (2015): national pledges (NDCs) from all.' },
    { n: 'Demographic transition', d: 'Death rates fall, then birth rates fall; growth surges in between.' },
    { n: 'Refugee (1951 Convention)', d: 'Outside their country, well-founded fear of persecution for race, religion, nationality, social group or political opinion.' }
  ] },
  { group: 'Thinkers and readings', items: [
    { n: 'Thucydides, Melian Dialogue', d: '"The strong do what they can and the weak suffer what they must."' },
    { n: 'Hobbes, Leviathan (1651)', d: 'State of nature: war of all against all; life "solitary, poor, nasty, brutish, and short".' },
    { n: 'Kant, Perpetual Peace (1795)', d: 'Republican constitutions, a federation of free states, universal hospitality.' },
    { n: 'Mearsheimer (2001)', d: 'Offensive realism; five assumptions; great powers seek regional hegemony.' },
    { n: 'Fearon (1995)', d: '"Rationalist Explanations for War": information, commitment, indivisibility.' },
    { n: 'Tannenwald (1999)', d: '"The Nuclear Taboo": norms explain US nuclear non-use.' },
    { n: 'Waltz (2012)', d: '"Why Iran Should Get the Bomb": nuclear balancing would mean stability.' },
    { n: 'Power (2001)', d: '"Bystanders to Genocide": the US chose not to act in Rwanda.' },
    { n: 'Frieden (2015)', d: 'Currency Politics: exchange-rate regime and level are distributional political choices.' },
    { n: 'Wendt (1992)', d: '"Anarchy is what states make of it."' }
  ] }
];

const card = (id, unit, sec, f, b) => ({ id, unit, sec, f, b });
const FLASHCARDS = [
  card('p-ir', 1, 'basics', 'What does international relations study?', 'Political interactions across borders: how cooperation and conflict arise, why some states are more powerful, how history shaped institutions.'),
  card('p-state', 1, 'basics', 'Four features of a state', 'Territory, population, government, sovereignty.'),
  card('p-nation', 1, 'basics', 'Nation vs state', 'Nation: a people with shared identity. State: the political-legal unit with sovereignty.'),
  card('p-levels', 1, 'basics', 'The three levels of analysis', 'Individual, state (domestic), international system (Waltz\'s three images).'),
  card('p-igo', 1, 'basics', 'IGO vs NGO, with an example of each', 'IGO: states as members (UN, NATO). NGO: private (Amnesty International, Doctors Without Borders).'),
  card('p-westphalia', 1, 'history', 'Peace of Westphalia: year and significance', '1648; ended the Thirty Years\' War; the sovereign state system and non-interference.'),
  card('p-vienna', 1, 'history', 'Congress of Vienna and the Concert of Europe', '1815; great-power consultation and balance of power kept a general peace in Europe for about a century.'),
  card('p-league', 1, 'history', 'Why did the League of Nations fail?', 'The US never joined; it could not enforce collective security against aggression in the 1930s.'),
  card('p-coldwar', 1, 'history', 'Cold War: dates and structure', 'About 1947–1991; bipolar US–Soviet rivalry fought through arms races, alliances (NATO vs Warsaw Pact) and proxy wars.'),
  card('p-cuba', 1, 'history', 'Cuban Missile Crisis', '1962; Soviet missiles in Cuba; the closest the Cold War came to nuclear war.'),
  card('p-endcw', 1, 'history', 'How did the Cold War end?', 'Berlin Wall fell in 1989; the Soviet Union dissolved in December 1991.'),
  card('p-polarity', 1, 'challenges', 'Unipolar, bipolar, multipolar', 'One, two, or several great powers (US after 1991; US–USSR; Europe before 1914).'),
  card('p-trap', 1, 'challenges', 'The "Thucydides trap"', 'Allison\'s idea that a rising power and a ruling power are prone to war (applied to China and the US).'),
  card('p-nato-enl', 1, 'challenges', 'Which states joined NATO after Russia\'s 2022 invasion of Ukraine?', 'Finland (2023) and Sweden (2024).'),
  card('p-anarchy', 2, 'anarchy', 'What does anarchy mean in IR?', 'No central authority above states. Not chaos. States rely on self-help.'),
  card('p-melian', 2, 'anarchy', 'Melian Dialogue: key line', '"The strong do what they can and the weak suffer what they must" (Thucydides).'),
  card('p-hobbes', 2, 'anarchy', 'Hobbes: life in the state of nature', '"Solitary, poor, nasty, brutish, and short"; a war of every man against every man.'),
  card('p-hobbes3', 2, 'anarchy', 'Hobbes\'s three causes of quarrel', 'Competition, diffidence (fear), glory.'),
  card('p-secdil', 2, 'anarchy', 'Security dilemma', 'Steps one state takes to be secure make others less secure, producing a spiral even without aggressive intent.'),
  card('p-soft', 2, 'anarchy', 'Soft power', 'Joseph Nye: getting what you want through attraction (culture, values, policies) rather than coercion.'),
  card('p-realist4', 2, 'realism', 'Realism\'s core assumptions', 'State-centric, unitary and rational; anarchy; survival; power; relative gains.'),
  card('p-morgenthau', 2, 'realism', 'Classical realism: who and what?', 'Morgenthau (1948): conflict rooted in human nature; interest defined as power.'),
  card('p-waltz', 2, 'realism', 'Structural realism: who and what?', 'Waltz (1979): the system\'s structure (anarchy + distribution of capabilities) shapes behavior; balancing.'),
  card('p-mear5', 2, 'realism', 'Mearsheimer\'s five bedrock assumptions', 'Anarchy; offensive capability; uncertain intentions; survival first; rational actors.'),
  card('p-offensive', 2, 'realism', 'What do great powers want, according to offensive realism?', 'To maximize relative power; ideally regional hegemony (global hegemony is blocked by the stopping power of water).'),
  card('p-balance', 2, 'realism', 'Internal vs external balancing', 'Internal: building your own power (arms). External: forming alliances.'),
  card('p-liberal', 2, 'liberalism', 'Liberalism\'s core claims', 'Cooperation and progress possible; many actors; domestic politics matter; absolute gains.'),
  card('p-kant', 2, 'liberalism', 'Kant\'s three definitive articles', 'Republican constitutions; a federation of free states; universal hospitality.'),
  card('p-dempeace', 2, 'liberalism', 'Democratic peace', 'Democracies rarely if ever fight each other (not that democracies are peaceful in general).'),
  card('p-neolib', 2, 'liberalism', 'How do institutions help cooperation (Keohane)?', 'Information, monitoring, lower transaction costs, issue linkage, a longer shadow of the future.'),
  card('p-pd', 2, 'liberalism', 'Prisoner\'s dilemma in IR', 'Both gain from cooperating but each is tempted to defect; repeated play and institutions make cooperation possible.'),
  card('p-gains', 2, 'liberalism', 'Absolute vs relative gains', 'Absolute: am I better off? (liberals). Relative: am I better off than you? (realists).'),
  card('p-wendt', 2, 'constructivism', 'Wendt\'s famous phrase', '"Anarchy is what states make of it."'),
  card('p-construct', 2, 'constructivism', 'Constructivism in one sentence', 'Shared ideas, identities and norms construct state interests and how states see each other.'),
  card('p-normlc', 2, 'constructivism', 'Norm life cycle (Finnemore & Sikkink)', 'Emergence (norm entrepreneurs), cascade, internalization.'),
  card('p-feminist', 2, 'constructivism', 'Feminist IR: the key question and two names', '"Where are the women?" Cynthia Enloe; J. Ann Tickner.'),
  card('p-dependency', 2, 'constructivism', 'Dependency theory', 'The periphery\'s underdevelopment results from its ties to the core.'),
  card('p-wallerstein', 2, 'constructivism', 'World-systems theory', 'Wallerstein: the world economy has a core, a semi-periphery and a periphery.'),
  card('p-war', 3, 'interstate-war', 'Common threshold for counting a war', '1,000 battle deaths in a year (Correlates of War).'),
  card('p-fearon', 3, 'interstate-war', 'Fearon\'s puzzle', 'War is costly, so a bargain both prefer should exist. Why do rational states fight?'),
  card('p-fearon3', 3, 'interstate-war', 'Fearon\'s three rationalist explanations', 'Private information + incentives to misrepresent; commitment problems; issue indivisibility.'),
  card('p-range', 3, 'interstate-war', 'Bargaining range formula', 'A\'s share x with p − c_A ≤ x ≤ p + c_B.'),
  card('p-prevent', 3, 'interstate-war', 'Preventive vs preemptive war', 'Preventive: the rival is rising over time. Preemptive: an attack is imminent.'),
  card('p-diversion', 3, 'interstate-war', 'Diversionary war', 'A leader starts a conflict abroad to rally support at home.'),
  card('p-civil', 3, 'civil-war', 'Civil war: definition', 'Armed conflict inside a state between the government and organized groups, for control of the government or territory.'),
  card('p-greed', 3, 'civil-war', 'Greed vs grievance', 'Collier & Hoeffler: opportunity (lootable resources, cheap recruits) predicts rebellion better than grievance.'),
  card('p-fl', 3, 'civil-war', 'Fearon & Laitin\'s risk factors', 'Poverty/weak state, rough terrain, large population, political instability, new states. Not ethnic diversity itself.'),
  card('p-ethsd', 3, 'civil-war', 'Ethnic security dilemma', 'Posen: when central authority collapses, groups arm for protection and fear spirals.'),
  card('p-endcivil', 3, 'civil-war', 'Why are civil wars hard to end?', 'Commitment problem: rebels must disarm and trust the government; third-party guarantees help (Walter).'),
  card('p-fission', 3, 'wmd', 'Fission vs fusion weapons', 'Fission (atomic) splits uranium-235 or plutonium-239; thermonuclear weapons add fusion for far larger yields.'),
  card('p-mad', 3, 'wmd', 'What does MAD rely on?', 'Secure second-strike capability on both sides, so striking first is suicidal.'),
  card('p-npt', 3, 'wmd', 'NPT: the bargain', 'Five nuclear states pledge disarmament talks; others forgo weapons; all get peaceful energy under IAEA inspections. 1968, in force 1970.'),
  card('p-outnpt', 3, 'wmd', 'Nuclear states outside the NPT', 'India, Pakistan, Israel (undeclared) and North Korea (withdrew 2003).'),
  card('p-taboo', 3, 'wmd', 'Tannenwald\'s argument', 'A normative taboo, not just deterrence, explains US non-use of nuclear weapons since 1945.'),
  card('p-waltziran', 3, 'wmd', 'Waltz (2012) on Iran', 'A nuclear Iran would balance Israel\'s monopoly and bring stability.'),
  card('p-un', 4, 'igos', 'UN Charter: signed and in force', 'Signed 26 June 1945 in San Francisco; in force 24 October 1945.'),
  card('p-p5', 4, 'igos', 'The P5', 'United States, United Kingdom, France, Russia, China: permanent Security Council members with a veto.'),
  card('p-unsc', 4, 'igos', 'Security Council size', '15: five permanent, ten elected for two-year terms.'),
  card('p-24', 4, 'igos', 'Article 2(4)', 'Bans the threat or use of force against any state\'s territorial integrity or political independence.'),
  card('p-51', 4, 'igos', 'Article 51', 'Inherent right of individual or collective self-defense against armed attack.'),
  card('p-ch7', 4, 'igos', 'Chapter VII', 'Security Council determines threats to peace; binding sanctions and use of force.'),
  card('p-art5', 4, 'igos', 'NATO Article 5', 'An attack on one is an attack on all; invoked once, after 9/11.'),
  card('p-eu', 4, 'igos', 'EU milestones', 'ECSC 1951; Treaty of Rome (EEC) 1957; Maastricht (EU) 1992; euro 1999/2002; Brexit 2020.'),
  card('p-sources', 4, 'law-rights', 'Sources of international law', 'Treaties, custom (practice + opinio juris), general principles; courts and scholars as subsidiary means.'),
  card('p-opinio', 4, 'law-rights', 'Opinio juris', 'States act as they do because they believe the law requires it; needed for customary law.'),
  card('p-icjicc', 4, 'law-rights', 'ICJ vs ICC', 'ICJ: UN court, disputes between states. ICC: tries individuals for genocide, crimes against humanity, war crimes, aggression.'),
  card('p-udhr', 4, 'law-rights', 'UDHR: when, who, binding?', 'UN General Assembly, 10 Dec 1948; drafting chaired by Eleanor Roosevelt; not a binding treaty.'),
  card('p-covenants', 4, 'law-rights', 'The two 1966 covenants', 'ICCPR (civil and political) and ICESCR (economic, social and cultural).'),
  card('p-genocide', 4, 'law-rights', 'Legal definition of genocide', 'Acts with intent to destroy, in whole or part, a national, ethnic, racial or religious group.'),
  card('p-rwanda', 4, 'law-rights', 'Rwanda 1994', 'About 800,000 killed in about 100 days, mostly Tutsi and moderate Hutu.'),
  card('p-power', 4, 'law-rights', 'Power, "Bystanders to Genocide": three US choices', 'Avoided the word "genocide"; pushed to withdraw UNAMIR; refused to jam RTLM hate radio.'),
  card('p-r2p', 4, 'law-rights', 'Responsibility to Protect', '2005: sovereignty as responsibility; the international community acts if a state fails to protect its people.'),
  card('p-ipe3', 5, 'trade', 'Three IPE perspectives', 'Economic liberalism, mercantilism (economic nationalism), radical/Marxist.'),
  card('p-compadv', 5, 'trade', 'Comparative vs absolute advantage', 'Comparative: lower opportunity cost. Absolute: more output with the same resources.'),
  card('p-bw', 5, 'trade', 'Bretton Woods (1944) created', 'The IMF and the World Bank (IBRD).'),
  card('p-wto', 5, 'trade', 'GATT vs WTO', 'GATT (1947) cut tariffs in rounds; WTO (1995) added services, IP and binding dispute settlement.'),
  card('p-mfn', 5, 'trade', 'Most-favored-nation principle', 'A trade concession to one WTO member must be extended to all members.'),
  card('p-tariff', 5, 'trade', 'Tariff vs quota', 'Tariff: a tax on imports. Quota: a limit on the quantity of imports.'),
  card('p-regimes', 5, 'money', 'Fixed vs floating exchange rates', 'Fixed: stability and credibility. Floating: monetary autonomy and flexibility.'),
  card('p-trilemma', 5, 'money', 'The trilemma', 'Fixed exchange rate, free capital mobility, independent monetary policy: you can only have two.'),
  card('p-depr', 5, 'money', 'Who likes a weaker currency?', 'Exporters and import-competing producers of tradable goods (Frieden).'),
  card('p-frieden', 5, 'money', 'Frieden\'s two dimensions of currency choice', 'The regime (fixed vs floating) and the level (strong vs weak).'),
  card('p-nixon', 5, 'money', 'End of Bretton Woods', 'Nixon closed the gold window in August 1971; major currencies floated by 1973.'),
  card('p-crises', 5, 'money', 'Four financial crises', 'Latin American debt 1982; Asian 1997–98; Global 2008; eurozone 2010 on.'),
  card('p-commons', 5, 'environment', 'Tragedy of the commons', 'Hardin (1968): shared unowned resources are overused because users capture benefits and share costs.'),
  card('p-kyoto', 5, 'environment', 'Kyoto vs Paris', 'Kyoto (1997): binding targets for developed countries. Paris (2015): national pledges (NDCs) from all.'),
  card('p-montreal', 5, 'environment', 'Why did the Montreal Protocol work?', 'Few producers, available substitutes, clear science, help for developing countries.'),
  card('p-demtrans', 5, 'environment', 'Demographic transition order', 'High birth and death → death rates fall (rapid growth) → birth rates fall → both low.'),
  card('p-refugee', 5, 'environment', 'Refugee: legal definition', 'Outside their country with a well-founded fear of persecution for race, religion, nationality, social group or political opinion.'),
  card('p-r70', 5, 'environment', 'Rule of 70', 'Doubling time ≈ 70 ÷ growth rate in percent.')
];

const PRACTICE = {
  exam1: { title: 'Midterm 1 practice', subtitle: 'Parts I and II. Answer in two or three sentences out loud, then reveal.', problems: [
    { n: 1, sec: 'basics', tags: ['levels'], q: 'Explain Russia\'s 2022 invasion of Ukraine at the individual, state and system levels of analysis.', s: '<b>Individual:</b> Putin\'s beliefs about Ukraine and his misjudgment of Ukrainian resistance. <b>State:</b> an authoritarian regime with few domestic checks and nationalist narratives. <b>System:</b> NATO enlargement and the distribution of power in Europe, as realists like Mearsheimer emphasize.' },
    { n: 2, sec: 'history', tags: ['history'], q: 'Why is 1648 a starting point for modern international relations?', s: 'The Peace of Westphalia established sovereign territorial states that do not interfere in each other\'s internal affairs as the basic units of the system.' },
    { n: 3, sec: 'anarchy', tags: ['Thucydides'], q: 'What does the Melian Dialogue teach about power and justice?', s: 'Athens argues justice applies only between equals in power; "the strong do what they can and the weak suffer what they must." Melos appeals to justice and is destroyed: an early realist lesson.' },
    { n: 4, sec: 'anarchy', tags: ['security dilemma'], q: 'Give an example of a security dilemma.', s: 'One state builds missile defenses to feel safe; its rival sees a threat to its deterrent and builds more missiles; the first state feels less safe. Neither wanted an arms race.' },
    { n: 5, sec: 'realism', tags: ['Mearsheimer'], q: 'List Mearsheimer\'s five assumptions and the behavior they produce.', s: 'Anarchy; offensive capability; uncertain intentions; survival as the goal; rationality. Together they produce fear, self-help and power maximization, aimed at regional hegemony.' },
    { n: 6, sec: 'liberalism', tags: ['democratic peace'], q: 'State the democratic peace and give two explanations.', s: 'Democracies rarely if ever fight each other. Explanations: shared norms of peaceful compromise; institutional constraints and accountability to voters; transparency that reduces misperception.' },
    { n: 7, sec: 'constructivism', tags: ['Wendt'], q: 'What does Wendt mean by "anarchy is what states make of it"?', s: 'Anarchy has no single logic: whether it produces rivalry or friendship depends on the shared identities and ideas states hold, e.g., the US–UK relationship vs US–North Korea.' }
  ] },
  exam2: { title: 'Midterm 2 practice', subtitle: 'Part III: war and weapons of mass destruction.', problems: [
    { n: 1, sec: 'interstate-war', tags: ['Fearon'], q: 'Why should a bargaining range always exist, according to Fearon?', s: 'Because war is costly. Both sides would rather agree on the expected outcome of the war without paying its costs, so any deal between p − c_A and p + c_B beats fighting.' },
    { n: 2, sec: 'interstate-war', tags: ['Fearon'], q: 'Explain the commitment problem with a power shift example.', s: 'A declining state fears a rising one cannot promise to stay moderate once it is stronger, so it may fight a preventive war now rather than accept worse terms later.' },
    { n: 3, sec: 'interstate-war', tags: ['bargaining'], q: 'A wins with probability 0.7; costs are 0.2 for A and 0.1 for B. What is the bargaining range for A\'s share?', s: 'From 0.7 − 0.2 = <b>0.5</b> to 0.7 + 0.1 = <b>0.8</b>.' },
    { n: 4, sec: 'civil-war', tags: ['greed', 'grievance'], q: 'Compare greed and grievance explanations of civil war.', s: 'Grievance: inequality and political or ethnic exclusion motivate rebellion. Greed/opportunity (Collier & Hoeffler): lootable resources, outside funding and cheap recruits make rebellion feasible, and better predict it.' },
    { n: 5, sec: 'civil-war', tags: ['Fearon & Laitin'], q: 'What do Fearon and Laitin find about ethnic diversity?', s: 'Controlling for income, more ethnically or religiously diverse countries are not more likely to have civil wars; weak states, rough terrain and instability matter.' },
    { n: 6, sec: 'wmd', tags: ['Tannenwald'], q: 'Summarize Tannenwald\'s nuclear taboo argument and the theory behind it.', s: 'A norm against using nuclear weapons, not just deterrence, explains US non-use since 1945 (e.g., Korea, Vietnam, Gulf War). It is constructivist: norms shape what leaders see as acceptable.' },
    { n: 7, sec: 'wmd', tags: ['Waltz'], q: 'Why does Waltz say a nuclear Iran would make the Middle East more stable?', s: 'Nuclear weapons make states cautious, and Israel\'s monopoly is the source of imbalance; balancing power restores stability, as in other nuclear dyads.' }
  ] },
  exam3: { title: 'Midterm 3 practice', subtitle: 'International organizations, law and human rights.', problems: [
    { n: 1, sec: 'igos', tags: ['UN'], q: 'Contrast the UN General Assembly and the Security Council.', s: 'GA: all 193 members, one vote each, non-binding recommendations. SC: 15 members, five permanent with a veto, can make binding decisions and authorize force under Chapter VII.' },
    { n: 2, sec: 'igos', tags: ['Charter'], q: 'Which Charter provisions ban force and allow self-defense?', s: 'Article 2(4) bans the threat or use of force against other states; Article 51 preserves self-defense against armed attack; Chapter VII lets the Security Council authorize force.' },
    { n: 3, sec: 'igos', tags: ['theories'], q: 'How would a realist and a liberal explain why the UN often fails to stop wars?', s: 'Realist: the UN reflects great-power interests; the P5 veto blocks action against them or their allies. Liberal: the institution still provides information and forums, but cooperation fails when the shadow of the future is short or enforcement is weak.' },
    { n: 4, sec: 'law-rights', tags: ['custom'], q: 'What two elements make a rule customary international law?', s: 'General and consistent state practice, plus opinio juris: states following the practice because they believe it is legally required.' },
    { n: 5, sec: 'law-rights', tags: ['courts'], q: 'Who can be tried at the ICC, and how is that different from the ICJ?', s: 'The ICC tries individuals for genocide, war crimes, crimes against humanity and aggression; the ICJ settles legal disputes between states.' },
    { n: 6, sec: 'law-rights', tags: ['Power'], q: 'According to Power, why did the US not act in Rwanda?', s: 'Officials avoided the word "genocide", pushed to withdraw UNAMIR and refused to jam RTLM; with no domestic political pressure and fresh memories of Somalia, inaction was a deliberate choice, not ignorance.' }
  ] },
  final: { title: 'Final exam practice', subtitle: 'Cumulative, with the new political economy and global topics. Practise short answers.', problems: [
    { n: 1, sec: 'trade', tags: ['comparative advantage'], q: 'In one day, Country A makes 6 tons of wheat or 2 cars; Country B makes 3 tons of wheat or 3 cars. Who has the comparative advantage in cars?', s: 'A gives up 3 tons of wheat per car; B gives up 1 ton per car. <b>B</b> has the comparative advantage in cars (and A in wheat).' },
    { n: 2, sec: 'trade', tags: ['IPE'], q: 'How would a mercantilist and an economic liberal view a tariff on imported steel?', s: 'Mercantilist: protects a strategic industry and state power, worth the cost. Liberal: raises prices for consumers and steel users, invites retaliation and loses the gains from trade.' },
    { n: 3, sec: 'money', tags: ['trilemma'], q: 'Explain the trilemma with the euro as the example.', s: 'Eurozone members have a fixed rate with each other (a shared currency) and free capital mobility, so they gave up independent national monetary policy to the European Central Bank.' },
    { n: 4, sec: 'money', tags: ['Frieden'], q: 'Which groups want a weaker dollar, and why?', s: 'US exporters and import-competing manufacturers: a weaker dollar makes their goods cheaper relative to foreign ones (Frieden\'s distributional politics).' },
    { n: 5, sec: 'environment', tags: ['commons'], q: 'Use the tragedy of the commons to explain why climate cooperation is hard.', s: 'Each country captures the benefits of its own emissions while the costs of warming are shared, so all have an incentive to free ride; Paris relies on national pledges and peer pressure rather than enforcement.' },
    { n: 6, sec: 'realism', tags: ['theories'], q: 'Apply realism, liberalism and constructivism to the rise of China in one sentence each.', s: 'Realism: power transition makes US–China rivalry likely. Liberalism: economic interdependence and institutions raise the cost of conflict. Constructivism: it depends on how each side defines the other: rival or partner.' }
  ] }
};

const CHECKLISTS = {
  exam1: ['Name the three levels of analysis and explain an event at each', 'Distinguish state, nation and nation-state; IGO and NGO', 'Put 1648, 1815, 1919, 1945, 1947, 1949, 1962, 1989, 1991 in order and say what happened', 'Define anarchy, sovereignty, power and the security dilemma', 'Match the Melian Dialogue and Leviathan quotes to their authors', 'List Mearsheimer\'s five assumptions and the behavior they produce', 'Contrast classical, structural (defensive) and offensive realism', 'State Kant\'s three definitive articles and the democratic peace', 'Explain absolute vs relative gains and the prisoner\'s dilemma', 'Explain constructivism, feminist IR and dependency theory with one example each'],
  exam2: ['Define war and the 1,000-death threshold', 'State Fearon\'s puzzle and his three explanations, with an example of each', 'Compute a bargaining range from p, c_A and c_B', 'Distinguish preventive, preemptive and diversionary war', 'Explain greed vs grievance and Fearon & Laitin\'s risk factors', 'Explain the ethnic security dilemma and why civil wars are hard to end', 'Explain deterrence, MAD and second-strike capability', 'Describe the NPT bargain and which states are outside it', 'Summarize Tannenwald (taboo) and Waltz (balancing) and their theories'],
  exam3: ['Name the UN\'s principal organs and the P5', 'Contrast the General Assembly and the Security Council', 'Explain Article 2(4), Article 51 and Chapter VII', 'Distinguish collective security from collective defense (NATO Article 5)', 'Trace the EU from the ECSC to Maastricht and the euro', 'List the sources of international law and define opinio juris', 'Distinguish the ICJ from the ICC', 'Explain the UDHR\'s status and the two 1966 covenants', 'Define genocide and summarize Power\'s argument on Rwanda', 'Explain the Responsibility to Protect'],
  final: ['Revisit every midterm checklist above', 'Compare economic liberalism, mercantilism and radical approaches to trade', 'Work a comparative-advantage problem', 'Explain Bretton Woods, the GATT, the WTO and most-favored-nation', 'Explain fixed vs floating exchange rates and the trilemma', 'Use Frieden to say who wants a strong or weak currency', 'Name four financial crises and the IMF\'s role', 'Apply the tragedy of the commons to climate change; compare Kyoto, Paris and Montreal', 'Describe the demographic transition and the refugee definition', 'Write a short answer applying two theories to one current event']
};

module.exports = { SECTIONS, FORMULAS, FLASHCARDS, PRACTICE, CHECKLISTS };
