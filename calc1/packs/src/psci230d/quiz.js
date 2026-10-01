/* PSCI 230D question bank. Bank items are [prompt, correct, [wrong answers], explanation, hint?].
   Written for Mathub from standard IR material and the syllabus readings; not from the instructor. */
const bank = (topic, items, extra = {}) => Object.assign({ type: 'bank', topic, items, options: 4 }, extra);   // four choices, like the midterms' bubble sheets

const topics = {
  basics: { unit: 1, sec: 'basics', label: 'Basic concepts & levels' },
  history: { unit: 1, sec: 'history', label: 'Historical overview' },
  challenges: { unit: 1, sec: 'challenges', label: 'System & current challenges' },
  anarchy: { unit: 2, sec: 'anarchy', label: 'Anarchy, Thucydides, Hobbes' },
  realism: { unit: 2, sec: 'realism', label: 'Realism' },
  liberalism: { unit: 2, sec: 'liberalism', label: 'Liberalism & cooperation' },
  constructivism: { unit: 2, sec: 'constructivism', label: 'Constructivism & other lenses' },
  'interstate-war': { unit: 3, sec: 'interstate-war', label: 'Interstate war & Fearon' },
  'civil-war': { unit: 3, sec: 'civil-war', label: 'Civil wars' },
  wmd: { unit: 3, sec: 'wmd', label: 'WMD, deterrence, NPT' },
  igos: { unit: 4, sec: 'igos', label: 'International organizations & UN' },
  'law-rights': { unit: 4, sec: 'law-rights', label: 'International law & human rights' },
  trade: { unit: 5, sec: 'trade', label: 'Trade & globalization' },
  money: { unit: 5, sec: 'money', label: 'Money & financial crises' },
  environment: { unit: 5, sec: 'environment', label: 'Environment & population' }
};

const ladders = {
  basics: ['Ask who is acting: a state, an IGO, an NGO, a firm or a person?', 'Sort the explanation by level: a leader’s mind (individual), domestic politics (state), or power and anarchy (system).', 'Check the definitions: a state has sovereignty; a nation is an identity.'],
  history: ['Place the event on the timeline: 1648, 1815, 1914–18, 1919, 1939–45, 1945, 1947–91, 2001.', 'Ask what the event created or ended: a principle, an institution or a structure of power.', 'Watch for look-alikes: League (1919) vs UN (1945); Berlin Wall (1989) vs USSR’s end (1991).'],
  challenges: ['Count the great powers to name the polarity.', 'Link the current event to a concept: power transition, sovereignty, collective action.', 'Polarity is about great-power capabilities, not how many conflicts there are.'],
  anarchy: ['Anarchy means no authority above states, not chaos.', 'Match the quote: Thucydides (strong and weak), Hobbes (nasty, brutish, short).', 'Security dilemma: defensive moves read as threats, so both end up less safe.'],
  realism: ['Realists: states, anarchy, survival, power, relative gains.', 'Locate the cause: human nature (classical), system structure (Waltz), power maximization (Mearsheimer).', 'Mearsheimer’s five: anarchy, offensive capability, uncertain intentions, survival, rationality.'],
  liberalism: ['Liberals: cooperation, institutions, interdependence, domestic politics, absolute gains.', 'Democratic peace is about democracies versus each other.', 'Institutions help by giving information, monitoring and a long shadow of the future.'],
  constructivism: ['Identity, norms and ideas: constructivism. Gender: feminism. Class and core–periphery: Marxist.', 'Ask what the theory says drives the outcome.', 'Wendt: anarchy is what states make of it.'],
  'interstate-war': ['War is costly, so a deal both prefer should exist. Why didn’t they find it?', 'Fearon’s three: private information and bluffing, commitment problems, indivisibility.', 'Bargaining range: from p − c_A up to p + c_B.'],
  'civil-war': ['Civil wars are fought inside a state over government or territory.', 'Opportunity (greed) vs motive (grievance); Fearon & Laitin stress weak states and terrain.', 'Peace is hard because disarming rebels must trust the government.'],
  wmd: ['Name the weapon type and the treaty that covers it.', 'Deterrence needs a credible, survivable second strike.', 'Tannenwald: norm (constructivist). Waltz: balance (realist).'],
  igos: ['IGOs have states as members; NGOs are private.', 'GA: everyone, recommendations. SC: 15 members, binding, P5 veto.', 'Force: banned by Art. 2(4), allowed in self-defense (Art. 51) or by the SC under Chapter VII.'],
  'law-rights': ['Sources: treaties, custom (practice + opinio juris), general principles.', 'ICJ judges states; ICC tries individuals.', 'UDHR (1948) is a declaration; the 1966 covenants are binding treaties.'],
  trade: ['Find the opportunity cost: units of the other good given up per unit of this good.', 'The lower opportunity cost has the comparative advantage.', 'Liberal: free trade gains. Mercantilist: state power. Radical: exploitation.'],
  money: ['Write the rate as foreign currency per dollar.', 'More foreign currency per dollar means the dollar appreciated.', 'Trilemma: fixed rate, capital mobility, monetary autonomy; pick two.'],
  environment: ['Who benefits from using the resource, and who pays?', 'Free riders undermine cooperation unless rules change incentives.', 'Kyoto: binding targets for rich countries. Paris: everyone’s own pledges.']
};

const questions = [
  /* ===================== Unit 1 ===================== */
  bank('basics', [
    ["Which of these is an intergovernmental organization (IGO)?", "NATO", ["Amnesty International", "Doctors Without Borders", "Greenpeace", "ExxonMobil"], "IGOs have states as members and are created by treaty. The others are NGOs or a firm."],
    ["Which of these is a nongovernmental organization (NGO)?", "Amnesty International", ["The United Nations", "The World Trade Organization", "NATO", "The International Monetary Fund"], "NGOs are private groups, not organizations of states."],
    ["A state is best defined by territory, population, government and", "sovereignty", ["a shared language", "a single ethnic identity", "a democratic constitution", "membership in the UN"], "Sovereignty, supreme authority within the territory, is what makes a political unit a state."],
    ["A people with a shared identity, language or history, whether or not it has its own state, is a", "nation", ["state", "government", "regime", "polity"], "Nations are identities. The Kurds are a nation without a state."],
    ["Which explanation is at the individual level of analysis?", "A leader’s overconfidence led her to misjudge the enemy’s strength", ["Anarchy forces states to rely on self-help", "Democracies rarely fight each other", "Interest groups lobbied Congress for war", "A shift in the balance of power made war likely"], "Individual-level explanations focus on leaders’ beliefs, personalities and perceptions."],
    ["“Two democracies settle their dispute peacefully because their legislatures and voters constrain leaders.” Which level of analysis is this?", "State (domestic) level", ["Individual level", "International system level", "Global level", "None: it is not an explanation"], "Regime type and domestic institutions are state-level factors."],
    ["“The war began because a rising power threatened the dominant power’s position.” Which level?", "International system level", ["Individual level", "State level", "Organizational level", "Societal level"], "Shifts in the distribution of power among states are system-level causes."],
    ["Who introduced the three “images” (individual, state, international system) in Man, the State, and War (1959)?", "Kenneth Waltz", ["Hans Morgenthau", "John Mearsheimer", "Alexander Wendt", "Robert Keohane"], "Waltz’s three images became the levels of analysis."],
    ["The Kurds, spread across Turkey, Iraq, Iran and Syria, are an example of", "a nation without a state", ["a nation-state", "an intergovernmental organization", "a failed state", "a supranational organization"], "They share an identity but do not have a sovereign state of their own."],
    ["A theory in international relations is best described as", "a simplification that identifies which factors matter most and why", ["a proven law that predicts every event", "a description of a single historical event", "an opinion that cannot be tested", "a list of facts about states"], "Theories simplify reality so their claims can be tested against evidence."],
    ["Finding that two things happen together does not prove one causes the other. This is the difference between", "correlation and causation", ["theory and practice", "states and nations", "power and authority", "realism and liberalism"], "Evidence must rule out other explanations before claiming causation."],
    ["Which actor is NOT a state?", "The European Commission", ["Japan", "Brazil", "Nigeria", "Canada"], "The European Commission is an institution of the EU, a supranational organization."]
  ]),
  bank('history', [
    ["The Peace of Westphalia (1648) is usually seen as the start of", "the modern system of sovereign states", ["the Cold War", "the League of Nations", "European colonialism", "the United Nations"], "It ended the Thirty Years’ War and set out territorial sovereignty and non-interference."],
    ["The Concert of Europe grew out of", "the Congress of Vienna (1815)", ["the Peace of Westphalia (1648)", "the Treaty of Versailles (1919)", "the Yalta Conference (1945)", "the Treaty of Rome (1957)"], "After Napoleon, the great powers consulted to keep a balance of power."],
    ["Which event triggered the outbreak of World War I in 1914?", "The assassination of Archduke Franz Ferdinand", ["Germany’s invasion of Poland", "The Russian Revolution", "The sinking of the Lusitania", "The Munich Agreement"], "The assassination in Sarajevo set the alliance system in motion."],
    ["Why is the League of Nations considered a failure?", "It could not stop aggression in the 1930s, and the US never joined", ["It started World War II", "It was dissolved before World War I", "It only allowed democracies as members", "It had too much enforcement power"], "Collective security failed against Japan, Italy and Germany."],
    ["Appeasement is most associated with", "the Munich Agreement (1938)", ["the Marshall Plan (1947)", "the Truman Doctrine (1947)", "the Cuban Missile Crisis (1962)", "détente in the 1970s"], "Britain and France let Germany take the Sudetenland, hoping to avoid war."],
    ["The Bretton Woods conference (1944) created", "the IMF and the World Bank", ["the United Nations", "NATO", "the European Union", "the World Trade Organization"], "The WTO came much later, in 1995."],
    ["The US policy of containing Soviet influence was announced in", "the Truman Doctrine (1947)", ["the Monroe Doctrine (1823)", "the Treaty of Versailles (1919)", "the Helsinki Accords (1975)", "the Maastricht Treaty (1992)"], "Containment shaped US Cold War strategy."],
    ["NATO was founded in", "1949", ["1919", "1945", "1955", "1991"], "The Warsaw Pact followed in 1955."],
    ["The Cuban Missile Crisis (1962) is significant because", "it brought the US and USSR closer to nuclear war than at any other point", ["it ended the Cold War", "it created NATO", "it started the Korean War", "it led to the dissolution of the USSR"], "The 13-day standoff over Soviet missiles in Cuba ended with a negotiated withdrawal."],
    ["Which pair of events marks the end of the Cold War?", "The fall of the Berlin Wall (1989) and the dissolution of the USSR (1991)", ["The Cuban Missile Crisis (1962) and détente (1970s)", "The Korean War (1950) and the Vietnam War (1975)", "The Marshall Plan (1947) and NATO (1949)", "9/11 (2001) and the Iraq War (2003)"], "The Wall fell in November 1989; the Soviet Union dissolved in December 1991."],
    ["The Cold War is described as bipolar because", "two superpowers, the US and the USSR, dominated the system", ["it was fought on two continents", "two alliances fought a direct war", "the UN had two permanent members", "two ideologies were equally popular everywhere"], "Polarity counts the great powers."],
    ["Proxy wars during the Cold War were", "conflicts where the superpowers backed opposing sides instead of fighting each other directly", ["wars fought only with nuclear weapons", "wars between the US and the USSR on their own territory", "UN peacekeeping missions", "trade wars over tariffs"], "Korea, Vietnam and Afghanistan are examples."],
    ["Which institution was created right after World War II to maintain international peace and security?", "The United Nations", ["The League of Nations", "The Concert of Europe", "The European Union", "The WTO"], "The UN Charter took effect in October 1945."],
    ["The Treaty of Versailles (1919)", "imposed harsh terms on Germany after World War I", ["ended the Thirty Years’ War", "created NATO", "ended the Cold War", "created the euro"], "Its reparations and war-guilt clause fed German resentment."]
  ]),
  { type: 'table', topic: 'history', columns: ['Event', 'Year', 'Significance'], rows: [
    ['Peace of Westphalia', '1648', 'birth of the sovereign state system'],
    ['Congress of Vienna', '1815', 'the great powers organize the Concert of Europe'],
    ['Outbreak of World War I', '1914', 'alliances turn a regional crisis into a world war'],
    ['Treaty of Versailles', '1919', 'harsh peace terms imposed on Germany'],
    ['Munich Agreement', '1938', 'appeasement of Hitler over the Sudetenland'],
    ['Bretton Woods conference', '1944', 'creation of the IMF and the World Bank'],
    ['Founding of the United Nations', '1945', 'a new collective security organization after World War II'],
    ['Truman Doctrine', '1947', 'the US commits to containing Soviet influence'],
    ['Founding of NATO', '1949', 'a Western collective defense alliance'],
    ['Cuban Missile Crisis', '1962', 'the closest the Cold War came to nuclear war'],
    ['Fall of the Berlin Wall', '1989', 'the collapse of communist rule in Eastern Europe'],
    ['Dissolution of the Soviet Union', '1991', 'the end of the Cold War and the start of US unipolarity'],
    ['9/11 attacks', '2001', 'the start of the US “war on terror”'],
    ['Russia’s full-scale invasion of Ukraine', '2022', 'a challenge to the norm against conquering territory']
  ], asks: [
    { prompt: 'In what year did this happen: {{Event}}?', answer: 'Year', options: 4, explain: '{{Event}}: {{Year}}, {{Significance}}.' },
    { prompt: 'Which event is best described as {{Significance}}?', answer: 'Event', explain: '{{Event}} ({{Year}}) marked {{Significance}}.' }
  ] },
  bank('challenges', [
    ["Which describes the international system right after the Cold War ended in 1991?", "Unipolar, with the US as the sole superpower", ["Bipolar, with the US and China", "Multipolar, with five equal powers", "Anarchic only in Europe", "Governed by a world government"], "US dominance after 1991 is the standard example of unipolarity."],
    ["Europe before 1914, with Britain, France, Germany, Russia and Austria-Hungary as great powers, was", "multipolar", ["unipolar", "bipolar", "hegemonic", "non-polar"], "Several great powers make a system multipolar."],
    ["Graham Allison’s “Thucydides trap” refers to", "the risk of war when a rising power threatens a ruling power", ["the danger of nuclear proliferation", "the failure of the League of Nations", "the tragedy of the commons", "the security dilemma within civil wars"], "Named after Thucydides’ account of Athens’ rise and Sparta’s fear."],
    ["Which countries joined NATO after Russia’s 2022 full-scale invasion of Ukraine?", "Finland and Sweden", ["Ukraine and Georgia", "Austria and Switzerland", "Poland and Hungary", "Serbia and Belarus"], "Finland joined in 2023 and Sweden in 2024."],
    ["Which is a transnational challenge that no single state can solve alone?", "Climate change", ["A border dispute between two neighbours", "A national election", "A domestic tax reform", "A local zoning law"], "Climate, pandemics, migration and cyber threats cross borders."],
    ["Polarity refers to", "the number of great powers in the system", ["the number of alliances", "how many wars are happening", "the ideological split between left and right", "the number of UN members"], "Unipolar, bipolar and multipolar count great powers."],
    ["Which realist argued that bipolar systems are the most stable?", "Kenneth Waltz", ["Hans Morgenthau", "Immanuel Kant", "Robert Keohane", "Cynthia Enloe"], "Waltz said two superpowers watch each other closely, so miscalculation is less likely."],
    ["The 2016 Brexit vote is often cited as an example of", "a backlash against globalization and supranational integration", ["the democratic peace", "nuclear proliferation", "collective security", "a power transition"], "The UK left the European Union in January 2020."],
    ["The COVID-19 pandemic illustrated", "how health threats cross borders and require international cooperation", ["that states no longer matter", "the end of anarchy", "that the WTO controls public health", "the success of collective security"], "Pandemics are a classic transnational challenge."],
    ["Which statement about anarchy and polarity is correct?", "A system can be anarchic whether it is unipolar, bipolar or multipolar", ["Unipolar systems are not anarchic", "Only multipolar systems are anarchic", "Bipolarity ends anarchy", "Polarity and anarchy mean the same thing"], "Anarchy (no world government) is constant; polarity varies."]
  ]),
  { type: 'calc-mc', options: 4, topic: 'challenges', vars: { n: [1, 2, 3, 4, 5] }, prompt: 'A system has {{n}} great power{{= n == 1 ? "" : "s"}} with far more capability than any other state. What is its polarity?', answer: 'n == 1 ? "Unipolar" : (n == 2 ? "Bipolar" : "Multipolar")', distractors: ['"Unipolar"', '"Bipolar"', '"Multipolar"', '"Non-polar"'], explain: 'Polarity counts great powers: one is unipolar, two is bipolar, three or more is multipolar.' },

  /* ===================== Unit 2 ===================== */
  bank('anarchy', [
    ["In IR, anarchy means", "there is no central authority above states", ["the international system is in constant chaos", "states are always at war", "there are no rules at all", "governments have collapsed"], "Anarchy is the absence of world government, not disorder."],
    ["Because of anarchy, states must ultimately rely on", "self-help", ["the UN Security Council", "international courts", "world government", "their neighbours’ goodwill"], "No higher power guarantees a state’s survival."],
    ["“The strong do what they can and the weak suffer what they must” comes from", "Thucydides’ Melian Dialogue", ["Hobbes’s Leviathan", "Kant’s Perpetual Peace", "Machiavelli’s The Prince", "Waltz’s Theory of International Politics"], "The Athenians say this to the Melians."],
    ["In the Melian Dialogue, the Melians appeal to justice, the gods and", "the hope that Sparta will help them", ["the United Nations", "their alliance with Persia", "the Athenian assembly’s mercy", "a peace treaty"], "Athens dismisses all three; Melos is destroyed."],
    ["Why do the Athenians reject Melos’s offer of neutrality?", "A neutral Melos would make Athens look weak to its subjects", ["Melos had attacked Athens first", "Athens needed Melos’s gold", "Sparta had ordered Athens to conquer Melos", "Melos was a democracy"], "For Athens, reputation for power matters more than justice."],
    ["Hobbes describes life in the state of nature as", "“solitary, poor, nasty, brutish, and short”", ["“peaceful but primitive”", "“a federation of free states”", "“what states make of it”", "“a war of states, never of men”"], "Leviathan, ch. 13."],
    ["Hobbes’s three principal causes of quarrel are", "competition, diffidence and glory", ["greed, grievance and identity", "power, wealth and ideology", "anarchy, sovereignty and power", "trade, religion and nationalism"], "Gain, safety (fear) and reputation."],
    ["Hobbes’s solution to the state of nature at home is", "a sovereign (the Leviathan) that keeps everyone in awe", ["a federation of free states", "free trade", "the balance of power", "a world court"], "Internationally there is no Leviathan, which is why realists borrow his logic."],
    ["The security dilemma means that", "steps one state takes for its security make others feel less secure", ["states always want to conquer each other", "international organizations cause wars", "states cannot defend themselves", "nuclear weapons make war impossible"], "Defensive moves read as threats can spiral into arms races."],
    ["Joseph Nye’s concept of soft power is power through", "attraction: culture, values and policies", ["military force", "economic sanctions", "nuclear deterrence", "foreign aid conditions"], "Hard power coerces or pays; soft power attracts."],
    ["Sovereignty means", "a state has supreme authority within its territory and is independent of outside control", ["a state is ruled by a monarch", "a state belongs to the UN", "a state has nuclear weapons", "a state controls other states"], "Externally it implies legal equality and non-interference."],
    ["Thucydides explained the Peloponnesian War by", "the growth of Athenian power and the fear it caused in Sparta", ["Sparta’s democratic government", "a dispute over religion", "Persian manipulation of both sides", "economic interdependence"], "A shift in power plus fear: a realist explanation."],
    ["A state builds missile defenses to protect itself; its rival responds by building more missiles. This illustrates", "the security dilemma", ["the democratic peace", "the tragedy of the commons", "comparative advantage", "collective security"], "Neither side wanted an arms race."],
    ["Which statement about power is correct?", "Power is the ability to get others to do what they would not otherwise do", ["Power is only military strength", "Power cannot be measured or compared", "Only states can have power", "Power means having the most population"], "It includes military, economic and soft power."]
  ]),
  { type: 'table', topic: 'anarchy', columns: ['Thinker', 'Work', 'Idea'], rows: [
    ['Thucydides', 'History of the Peloponnesian War (the Melian Dialogue)', 'the strong do what they can and the weak suffer what they must'],
    ['Thomas Hobbes', 'Leviathan (1651)', 'without a common power, life is a war of all against all'],
    ['Immanuel Kant', 'Perpetual Peace (1795)', 'republics in a federation of free states can make peace lasting'],
    ['Hans Morgenthau', 'Politics Among Nations (1948)', 'interest defined in terms of power, rooted in human nature'],
    ['Kenneth Waltz', 'Theory of International Politics (1979)', 'the structure of the system shapes state behavior'],
    ['John Mearsheimer', 'The Tragedy of Great Power Politics (2001)', 'great powers maximize relative power and seek regional hegemony'],
    ['Alexander Wendt', '“Anarchy Is What States Make of It” (1992)', 'anarchy is socially constructed'],
    ['Robert Keohane', 'After Hegemony (1984)', 'institutions make cooperation possible under anarchy'],
    ['Cynthia Enloe', 'Bananas, Beaches and Bases', 'asking “where are the women?” in international politics'],
    ['Immanuel Wallerstein', 'The Modern World-System', 'the world economy has a core, a semi-periphery and a periphery']
  ], asks: [
    { prompt: 'Who wrote {{Work}}?', answer: 'Thinker', explain: '{{Thinker}}, {{Work}}: {{Idea}}.' },
    { prompt: 'Which thinker is known for the idea that {{Idea}}?', answer: 'Thinker', explain: '{{Thinker}} ({{Work}}).' }
  ] },
  bank('realism', [
    ["Which assumption is central to realism?", "States are the main actors and seek survival under anarchy", ["International institutions can end conflict", "Identities determine state interests", "Economic class drives international politics", "Individuals matter more than states"], "Realists focus on states, anarchy, power and survival."],
    ["Realists emphasize relative gains, which means states ask", "“Who gains more?”", ["“Do we gain anything?”", "“Is it fair?”", "“Is it legal?”", "“What does the UN think?”"], "Gaps in gains can become gaps in power."],
    ["Classical realism (Morgenthau) locates the roots of conflict in", "human nature’s drive for power", ["the anarchic structure of the system", "capitalism", "gender hierarchies", "institutions"], "Structural realism moved the cause to the system."],
    ["Kenneth Waltz’s structural realism explains state behavior mainly through", "anarchy and the distribution of capabilities", ["leaders’ personalities", "domestic regime type", "international norms", "economic class"], "Theory of International Politics (1979)."],
    ["Which is NOT one of Mearsheimer’s five bedrock assumptions?", "International institutions can enforce agreements", ["The system is anarchic", "Great powers have some offensive military capability", "States can never be certain of others’ intentions", "Survival is the primary goal of great powers"], "The fifth is that great powers are rational actors."],
    ["According to offensive realism, the best guarantee of survival is to be", "the hegemon", ["a neutral state", "a member of many IGOs", "a democracy", "a small state"], "Mearsheimer: great powers maximize relative power."],
    ["Why does Mearsheimer think global hegemony is nearly impossible?", "The “stopping power of water” makes projecting power across oceans very hard", ["Nuclear weapons make war obsolete", "The UN forbids it", "Democracies never expand", "Trade makes conquest unprofitable"], "So great powers aim for regional hegemony and try to block rivals elsewhere."],
    ["Defensive realists argue that states seek", "enough power to be secure", ["as much power as possible", "to abolish anarchy", "to spread democracy", "to maximize trade"], "Offensive realists argue states maximize relative power."],
    ["A state forms an alliance to counter a rising power. This is", "external balancing", ["internal balancing", "bandwagoning", "collective security", "appeasement"], "Internal balancing means building up your own strength."],
    ["Joining the stronger side instead of opposing it is called", "bandwagoning", ["balancing", "containment", "deterrence", "isolationism"], "Realists expect balancing to be more common."],
    ["Why are realists pessimistic about lasting cooperation?", "States worry that partners will gain more and become threats later", ["They think states are irrational", "They believe trade is always harmful", "They think institutions are too strong", "They believe democracies cannot cooperate"], "Relative-gains concerns and cheating under anarchy."],
    ["Which statement would a realist most likely make?", "International institutions mostly reflect the interests of powerful states", ["Norms of human rights shape what states want", "Democracies never go to war", "Capitalism causes imperialism", "Gender shapes the concept of security"], "Realists see institutions as tools of power."],
    ["Many realists, including Mearsheimer and Waltz, opposed the 2003 Iraq war. This shows that", "realism can counsel restraint, not just war", ["realism is a liberal theory", "realists ignore power", "realists always oppose the US", "realism rejects anarchy"], "Realists judged the war unnecessary for US security."],
    ["For realists, the key currency of international politics is", "power", ["trade", "law", "identity", "religion"], "Power ensures survival in a self-help system."]
  ]),
  bank('liberalism', [
    ["Which belief is central to liberalism?", "Cooperation is possible and institutions can make it easier", ["Conflict is inevitable because of human nature", "Only great powers matter", "Identities are fixed and unchangeable", "Class struggle drives international politics"], "Liberals emphasize cooperation, institutions and interdependence."],
    ["The democratic peace holds that", "democracies rarely if ever fight wars against each other", ["democracies never fight any wars", "democracies win all their wars", "autocracies never go to war", "all states will become democracies"], "Democracies do fight non-democracies."],
    ["Which is one of Kant’s three definitive articles in Perpetual Peace?", "The civil constitution of every state should be republican", ["Every state should maximize its power", "States should form alliances against the strongest power", "Trade should be restricted", "A world government should replace states"], "The others: a federation of free states; universal hospitality."],
    ["Kant’s second definitive article calls for", "a federation of free states", ["a single world government", "a balance of power", "a hegemon to keep order", "abolishing all states"], "A voluntary league, not a world state."],
    ["Neoliberal institutionalists argue that institutions help states cooperate by", "providing information, monitoring compliance and lengthening the shadow of the future", ["eliminating anarchy", "creating a world government", "forcing states to disarm", "replacing states as actors"], "Robert Keohane accepts anarchy but says institutions soften it."],
    ["Liberals focus on absolute gains, meaning states ask", "“Are we better off?”", ["“Who gains more?”", "“Is our rival weaker?”", "“Will this increase our military power?”", "“Does this change polarity?”"], "Realists ask the relative question."],
    ["In a one-shot prisoner’s dilemma, what is the predicted outcome?", "Both players defect, even though mutual cooperation would leave both better off", ["Both cooperate", "One cooperates and one defects", "The players refuse to play", "A third party enforces cooperation"], "Defecting is each player’s dominant strategy."],
    ["Robert Axelrod showed that cooperation can emerge in a repeated prisoner’s dilemma through", "tit-for-tat: cooperate first, then copy the other player’s last move", ["always defecting", "random moves", "appeasement", "a world government"], "Repetition creates a shadow of the future."],
    ["“Complex interdependence” (Keohane and Nye) describes a world where", "states are linked by many channels and military force is less useful", ["only military power matters", "states are completely independent", "anarchy has ended", "one hegemon controls all trade"], "It challenges realism’s focus on force."],
    ["Commercial liberalism argues that", "trade and economic interdependence raise the costs of war", ["trade causes war", "only military alliances keep the peace", "states should be self-sufficient", "capitalism exploits poor countries"], "War disrupts profitable trade."],
    ["Which explanation of the democratic peace is institutional?", "Leaders who answer to voters and legislatures are constrained from going to war", ["Democracies share norms of compromise", "Democracies are always richer", "Democracies have bigger armies", "Democracies are in the same alliances"], "The norms explanation is the other main one."],
    ["In Rousseau’s stag hunt, cooperation is the best outcome for both players", "if each trusts the other to cooperate", ["only if a hegemon forces them", "never", "only in a one-shot game with no trust", "only if they are enemies"], "Fear that the other will chase a hare can break cooperation."],
    ["Which actors do liberals add to the state in their analysis?", "IGOs, NGOs, multinational firms and individuals", ["Only great powers", "Only military alliances", "Only classes", "Only the UN Security Council"], "Liberals see many actors in world politics."],
    ["A US–China trade deal gives the US $50 billion and China $80 billion. A liberal would most likely say", "accept it, because the US is better off", ["reject it, because China gains more", "reject it, because trade is exploitation", "accept it only if China becomes a democracy", "it does not matter"], "Absolute gains. A realist would worry about China’s relative gain."]
  ]),
  { type: 'calc-mc', options: 4, topic: 'liberalism',
    vars: { g: [
      { T: 5, R: 3, P: 1, S: 0 }, { T: 4, R: 3, P: 2, S: 1 }, { T: 10, R: 6, P: 2, S: 0 }, { T: 7, R: 5, P: 3, S: 1 },
      { T: 3, R: 4, P: 2, S: 0 }, { T: 2, R: 5, P: 2, S: 0 }, { T: 4, R: 6, P: 3, S: 1 },
      { T: 3, R: 4, P: 1, S: 2 }, { T: 2, R: 5, P: 0, S: 3 }
    ] },
    prompt: 'Two states each choose to cooperate or defect. For each state: if it defects while the other cooperates it gets {{T}}; if both cooperate, {{R}} each; if both defect, {{P}} each; if it cooperates while the other defects, {{S}}. Which game is this?',
    answer: 'T > R && R > P && P > S ? "Prisoner’s dilemma" : (R > T && T >= P && P > S ? "Stag hunt" : "No dilemma: cooperating is best whatever the other does")',
    distractors: ['"Prisoner’s dilemma"', '"Stag hunt"', '"No dilemma: cooperating is best whatever the other does"', '"Chicken"'],
    explain: 'Here temptation T = {{T}}, reward R = {{R}}, punishment P = {{P}} and sucker S = {{S}}. Prisoner’s dilemma: T > R > P > S, so defecting always pays and both defect. Stag hunt: R > T ≥ P > S, so cooperating is best if you trust the other. If R > T and S > P, cooperating is best whatever the other does, so there is no dilemma. Answer: {{answer}}.' },
  bank('constructivism', [
    ["Constructivists argue that state interests are shaped mainly by", "shared ideas, identities and norms", ["the distribution of military power", "economic class", "human nature", "geography alone"], "Interests are socially constructed."],
    ["Who wrote that “anarchy is what states make of it”?", "Alexander Wendt", ["Kenneth Waltz", "Thomas Hobbes", "John Mearsheimer", "Robert Keohane"], "Wendt (1992)."],
    ["Wendt notes that 500 British nuclear weapons worry the US less than 5 North Korean ones. This shows that", "the meaning of material power depends on identity and relationships", ["the UK has fewer weapons than North Korea", "nuclear weapons do not matter", "alliances are irrelevant", "realists are always right"], "Friends’ weapons are not read as threats."],
    ["A norm in international relations is", "a shared expectation about appropriate behavior", ["a binding treaty", "a military alliance", "an economic sanction", "a type of exchange rate"], "Norms shape what states consider acceptable."],
    ["In Finnemore and Sikkink’s norm life cycle, what comes after norm emergence?", "Norm cascade", ["Norm decay", "Norm enforcement by the UN", "Norm balancing", "Norm hegemony"], "Then internalization, when the norm is taken for granted."],
    ["People or groups who actively promote new norms, such as the campaign to ban landmines, are called", "norm entrepreneurs", ["hegemons", "free riders", "bandwagoners", "rational actors"], "They persuade states to adopt new standards."],
    ["Feminist IR scholar Cynthia Enloe famously asks", "“Where are the women?”", ["“Who gains more?”", "“What is anarchy?”", "“Why do democracies not fight?”", "“Who controls the means of production?”"], "From Bananas, Beaches and Bases."],
    ["Feminist approaches broaden security to include", "human security: the safety of people affected by war, poverty and trafficking", ["only the security of the state’s borders", "only nuclear deterrence", "only alliance commitments", "only economic growth"], "J. Ann Tickner and others."],
    ["Dependency theory argues that poor countries are underdeveloped because", "their ties to rich core countries keep them dependent and exploited", ["they have not yet passed through the stages of growth", "their cultures reject markets", "they are too democratic", "they have too much foreign aid"], "A radical/Marxist approach."],
    ["Immanuel Wallerstein’s world-systems theory divides the world economy into", "core, semi-periphery and periphery", ["democracies and autocracies", "great powers and small states", "North and East", "realists and liberals"], "Capitalist relations link the three zones."],
    ["Which theory would best explain the spread of the norm against chemical weapons?", "Constructivism", ["Offensive realism", "Mercantilism", "Structural realism", "Hegemonic stability theory"], "Norms and their internalization."],
    ["Constructivism differs from idealism because it", "does not claim states are good, only that their interests come from ideas", ["claims states are always peaceful", "rejects the existence of power", "says only material factors matter", "denies that states exist"], "Shared ideas can be hostile as well as friendly."],
    ["Which theory highlights economic class and capitalism as the drivers of international politics?", "Marxist/radical theory", ["Constructivism", "Liberalism", "Realism", "Feminism"], "Lenin, dependency theory, world-systems theory."]
  ]),
  { type: 'table', topic: 'constructivism', columns: ['Theory', 'Main driver', 'Associated thinker'], rows: [
    ['Classical realism', 'human nature’s drive for power', 'Hans Morgenthau'],
    ['Structural (defensive) realism', 'anarchy and the distribution of capabilities', 'Kenneth Waltz'],
    ['Offensive realism', 'great powers maximizing relative power', 'John Mearsheimer'],
    ['Neoliberal institutionalism', 'institutions that make cooperation possible', 'Robert Keohane'],
    ['Liberal democratic peace', 'republican constitutions and shared democratic norms', 'Immanuel Kant'],
    ['Constructivism', 'shared ideas, identities and norms', 'Alexander Wendt'],
    ['Feminist IR', 'gender and its effects on power and security', 'J. Ann Tickner'],
    ['World-systems theory', 'the capitalist division into core and periphery', 'Immanuel Wallerstein']
  ], asks: [
    { prompt: 'Which theory sees {{Main driver}} as the key to international politics?', answer: 'Theory', explain: '{{Theory}} ({{Associated thinker}}).' },
    { prompt: 'Which thinker is associated with {{Theory}}?', answer: 'Associated thinker', explain: '{{Associated thinker}}: {{Main driver}}.' }
  ] },

  /* ===================== Unit 3 ===================== */
  bank('interstate-war', [
    ["What puzzle does Fearon’s “Rationalist Explanations for War” (1995) address?", "Why rational states fight even though war is costly and a bargain both prefer should exist", ["Why democracies never fight", "Why nuclear weapons have not been used", "Why civil wars last longer", "Why trade causes war"], "The costs of war create a bargaining range."],
    ["Which is NOT one of Fearon’s three rationalist explanations for war?", "Leaders are irrational and aggressive", ["Private information with incentives to misrepresent", "Commitment problems", "Issue indivisibility"], "Fearon assumes rational states."],
    ["Two states disagree about who would win because each bluffs about its strength. Which Fearon mechanism is this?", "Private information and incentives to misrepresent", ["Commitment problem", "Issue indivisibility", "Diversionary war", "Security dilemma"], "Bluffing makes it hard to agree on the likely outcome."],
    ["A declining power attacks a rising rival before the rival grows stronger. This is", "a preventive war, an example of a commitment problem", ["a preemptive war caused by bluffing", "a diversionary war", "an issue indivisibility", "collective security"], "The rising state cannot credibly promise to stay moderate later."],
    ["Striking first because an enemy attack is imminent is", "preemptive war", ["preventive war", "diversionary war", "proxy war", "civil war"], "Israel in June 1967 is the classic example."],
    ["Why does Fearon think issue indivisibility rarely explains war?", "Side payments and linking issues can usually make the stakes divisible", ["Nothing is ever indivisible", "States never care about territory", "Indivisible issues always cause peace", "International law forbids indivisible issues"], "He treats it as the least important of the three."],
    ["A leader starts a conflict abroad to rally support at home. This is", "diversionary war", ["preventive war", "preemptive war", "collective defense", "a commitment problem"], "A state-level explanation."],
    ["Researchers often count a conflict as a war when it causes at least", "1,000 battle deaths in a year", ["100 deaths in total", "10,000 deaths in a month", "one death", "a formal declaration of war"], "The Correlates of War threshold."],
    ["Since 1945, which type of war has been most common?", "Civil (intrastate) wars", ["Wars between great powers", "World wars", "Colonial wars between European powers", "Nuclear wars"], "Interstate war has become rare."],
    ["Why does a bargaining range exist, according to Fearon?", "Because fighting is costly, both sides can do better by agreeing on the likely outcome", ["Because international law requires negotiations", "Because the UN mediates every dispute", "Because states are equal in power", "Because wars are always short"], "The costs of war create the space for a deal."],
    ["Which level of analysis is a leader’s misperception of the enemy’s intentions?", "Individual", ["State", "International system", "Regional", "Organizational"], "Psychology and perception are individual-level factors."],
    ["Which explanation is at the system level?", "A shift in the balance of power makes war more likely", ["A leader wants to distract voters", "Nationalist media inflame the public", "A general misreads intelligence", "Interest groups profit from arms sales"], "Power shifts concern the distribution of capabilities."]
  ]),
  { type: 'calc', topic: 'interstate-war', vars: { p: { min: 30, max: 80, step: 5 }, cA: { min: 5, max: 25, step: 5 }, cB: { min: 5, max: 25, step: 5 } },
    prompt: 'State A would win a war over a disputed territory with probability {{p}}%. Fighting would cost A the equivalent of {{cA}}% of the territory’s value and B {{cB}}%. In Fearon’s model, what is the smallest share of the territory (in %) that A would accept instead of fighting?',
    answer: 'p - cA',
    explain: 'A’s expected value of war is {{p}} − {{cA}} = {{answer}}%. Any deal giving A at least that beats fighting for A.' },
  { type: 'calc', topic: 'interstate-war', vars: { p: { min: 30, max: 75, step: 5 }, cA: { min: 5, max: 25, step: 5 }, cB: { min: 5, max: 25, step: 5 } }, where: 'p + cB <= 100',
    prompt: 'State A would win a war over a territory with probability {{p}}%. War costs A {{cA}}% and B {{cB}}% of the territory’s value. What is the largest share (in %) that B would give A instead of fighting?',
    answer: 'p + cB',
    explain: 'B expects to keep {{= 100 - p}} − {{cB}} = {{= 100 - p - cB}}% by fighting, so it would give A up to 100 − {{= 100 - p - cB}} = {{answer}}%.' },
  { type: 'calc-mc', options: 4, topic: 'interstate-war', vars: { p: { min: 30, max: 75, step: 5 }, cA: { min: 5, max: 20, step: 5 }, cB: { min: 5, max: 20, step: 5 }, x: { min: 10, max: 95, step: 5 } }, where: 'p + cB <= 100',
    prompt: 'A would win with probability {{p}}%; war costs A {{cA}}% and B {{cB}}% of the prize. A settlement offers A {{x}}% of the territory. What happens?',
    answer: 'x >= p - cA && x <= p + cB ? "Both prefer it to war" : (x < p - cA ? "A would rather fight" : "B would rather fight")',
    distractors: ['"Both prefer it to war"', '"A would rather fight"', '"B would rather fight"', '"Neither side cares"'],
    explain: 'The bargaining range for A’s share runs from {{p}} − {{cA}} = {{= p - cA}}% to {{p}} + {{cB}} = {{= p + cB}}%. An offer of {{x}}% is {{= x < p - cA ? "below it, so A gets less than war would give it" : (x > p + cB ? "above it, so B gives up more than war would cost it" : "inside it, so both sides are better off than fighting")}}.' },
  bank('civil-war', [
    ["A civil war is", "armed conflict within a state between the government and organized groups seeking control of the government or territory", ["a war between two states", "a trade dispute", "a peaceful protest movement", "a war fought only by mercenaries"], "Secession is fighting for territory."],
    ["Collier and Hoeffler argue that rebellion is best explained by", "opportunity, such as lootable resources and cheap recruits (greed)", ["grievances such as inequality", "the democratic peace", "the security dilemma between states", "nuclear deterrence"], "Opportunity makes rebellion feasible."],
    ["According to Fearon and Laitin (2003), which factor does NOT predict civil war once income is taken into account?", "Ethnic or religious diversity", ["Rough, mountainous terrain", "A weak, poor state", "Political instability", "A large population"], "Conditions favouring insurgency matter more than diversity."],
    ["Why do Fearon and Laitin emphasize poverty?", "Poor countries usually have weak states that cannot control their territory", ["Poor people are naturally violent", "Poverty causes democracy", "Poor countries have more ethnic groups", "Poverty ends wars quickly"], "Low state capacity favours insurgents."],
    ["Barry Posen’s ethnic security dilemma occurs when", "central authority collapses and ethnic groups arm against each other out of fear", ["two states build nuclear weapons", "a hegemon intervenes", "trade between groups rises", "the UN deploys peacekeepers"], "Anarchy inside a collapsing state."],
    ["Why are civil wars hard to end with a negotiated settlement?", "Rebels must disarm and trust the government not to punish them later (a commitment problem)", ["There is never anything to negotiate", "International law forbids peace deals", "Rebels always win", "Governments cannot sign treaties"], "Third-party guarantees can help (Walter)."],
    ["According to Barbara Walter, what makes peace deals in civil wars more likely to hold?", "Third-party security guarantees such as peacekeepers", ["Letting the strongest side win completely", "Banning elections", "Ending all foreign aid", "Dividing the country randomly"], "Guarantees solve the commitment problem."],
    ["Which resource is most often linked to rebel financing in the greed argument?", "Lootable resources such as alluvial diamonds or drugs", ["Fresh water", "Farmland owned by the state", "Tourism", "Foreign direct investment in banks"], "Easy-to-loot resources fund rebellion."],
    ["Compared with interstate wars, civil wars since 1945 have tended to", "last longer", ["end more quickly", "involve fewer civilians", "be fought only by great powers", "be rare"], "They are frequent and long."],
    ["A civil war in which outside states send arms or troops to support different sides is", "internationalized", ["a proxy-free war", "a preemptive war", "a diversionary war", "collective security"], "Syria after 2011 is an example."],
    ["Fighting to break away and form a new state is called", "secession", ["annexation", "appeasement", "deterrence", "intervention"], "A territorial goal in civil war."],
    ["Grievance explanations of civil war focus on", "inequality, discrimination and political exclusion", ["lootable resources", "rough terrain", "state capacity", "diaspora funding"], "Motives rather than opportunity."]
  ]),
  bank('wmd', [
    ["Which weapons are usually grouped as weapons of mass destruction?", "Nuclear, chemical and biological weapons", ["Tanks, aircraft and ships", "Drones and cyber weapons only", "Small arms and landmines", "Artillery and missiles only"], "Radiological weapons are sometimes added."],
    ["Atomic (fission) weapons release energy by", "splitting heavy nuclei such as uranium-235 or plutonium-239", ["fusing hydrogen nuclei only", "burning chemical explosives only", "releasing toxic gas", "spreading disease"], "Thermonuclear weapons add fusion for much larger yields."],
    ["Mutually assured destruction depends on", "both sides having a secure second-strike capability", ["one side having no nuclear weapons", "a world government", "missile defenses that stop all attacks", "the UN banning nuclear use"], "Striking first must be suicidal."],
    ["Successful deterrence requires capability, communication and", "credibility", ["secrecy about intentions", "a democratic government", "membership of the UN", "a nuclear monopoly"], "The threat must be believed."],
    ["Under the Non-Proliferation Treaty, non-nuclear states agree to forgo nuclear weapons in exchange for", "access to peaceful nuclear energy and a pledge of disarmament negotiations by nuclear states", ["permanent seats on the Security Council", "free trade with nuclear states", "a guarantee of military aid", "membership in NATO"], "IAEA inspections verify compliance."],
    ["Which of these states is NOT one of the NPT’s five recognized nuclear-weapon states?", "India", ["United States", "Russia", "China", "France"], "India, Pakistan and Israel never joined; North Korea withdrew."],
    ["Nina Tannenwald’s “The Nuclear Taboo” (1999) argues that the US has not used nuclear weapons since 1945 mainly because", "a normative prohibition made nuclear use seem unacceptable", ["it never had enough weapons", "the UN would have stopped it", "nuclear weapons do not work", "it feared only Soviet retaliation"], "A constructivist argument about norms."],
    ["Tannenwald’s argument belongs to which theoretical tradition?", "Constructivism", ["Offensive realism", "Mercantilism", "Structural realism", "Marxism"], "Norms shape what leaders consider legitimate."],
    ["In “Why Iran Should Get the Bomb” (2012), Kenneth Waltz argues that", "a nuclear Iran would balance Israel and bring stability", ["Iran should be attacked immediately", "nuclear weapons cause wars", "only democracies should have nuclear weapons", "the NPT has eliminated nuclear risk"], "Nuclear balancing makes states cautious."],
    ["Waltz’s argument about Iran reflects which theory?", "Structural realism", ["Constructivism", "Feminism", "Liberal institutionalism", "Dependency theory"], "Balance of power brings stability."],
    ["The only wartime uses of nuclear weapons were at", "Hiroshima and Nagasaki in August 1945", ["Pearl Harbor in 1941", "Korea in 1950", "Cuba in 1962", "Chernobyl in 1986"], "Hiroshima was a uranium bomb; Nagasaki a plutonium bomb."],
    ["Which treaty bans chemical weapons and requires their destruction?", "The Chemical Weapons Convention (1993, in force 1997)", ["The NPT (1968)", "The Biological Weapons Convention (1972)", "The Rome Statute (1998)", "The Paris Agreement (2015)"], "Syria’s government used chemical weapons despite the ban."],
    ["Why might terrorists be harder to deter than states?", "They may have no territory to retaliate against and may accept death", ["They always have nuclear weapons", "They are protected by international law", "They are members of the UN", "They never use violence"], "Deterrence needs something the target values."],
    ["North Korea’s relationship to the NPT is that it", "announced its withdrawal in 2003 and has tested nuclear weapons", ["was a founding nuclear-weapon state", "never had a nuclear program", "is the treaty’s depositary", "joined in 2020"], "It is outside the treaty."]
  ]),
  { type: 'table', topic: 'wmd', columns: ['Reading', 'Author', 'Argument'], rows: [
    ['“Rationalist Explanations for War” (1995)', 'James Fearon', 'war happens because of private information, commitment problems or indivisibility'],
    ['“The Nuclear Taboo” (1999)', 'Nina Tannenwald', 'a norm against nuclear use explains US non-use since 1945'],
    ['“Why Iran Should Get the Bomb” (2012)', 'Kenneth Waltz', 'nuclear balancing would bring stability to the Middle East'],
    ['“Greed and Grievance in Civil War”', 'Paul Collier and Anke Hoeffler', 'opportunity explains rebellion better than grievance'],
    ['“Ethnicity, Insurgency, and Civil War” (2003)', 'James Fearon and David Laitin', 'weak states and rough terrain, not ethnic diversity, predict civil war'],
    ['“The Security Dilemma and Ethnic Conflict”', 'Barry Posen', 'collapsing authority creates a security dilemma between ethnic groups']
  ], asks: [
    { prompt: 'Who argued that {{Argument}}?', answer: 'Author', explain: '{{Author}}, {{Reading}}.' },
    { prompt: 'Which argument comes from {{Reading}}?', answer: 'Argument', options: 4, explain: '{{Author}}: {{Argument}}.' }
  ] },

  /* ===================== Unit 4 ===================== */
  bank('igos', [
    ["The UN Charter was signed in 1945 in", "San Francisco", ["New York", "Geneva", "Paris", "London"], "It took effect on 24 October 1945."],
    ["How many members does the UN Security Council have?", "15", ["5", "10", "193", "27"], "Five permanent members and ten elected for two-year terms."],
    ["Which of these is NOT a permanent member of the Security Council?", "Germany", ["United States", "China", "France", "Russia"], "The P5: the US, UK, France, Russia and China."],
    ["Which UN body includes all member states, each with one vote, and makes non-binding recommendations?", "The General Assembly", ["The Security Council", "The Secretariat", "The International Court of Justice", "The Trusteeship Council"], "The Security Council can make binding decisions."],
    ["Article 2(4) of the UN Charter", "prohibits the threat or use of force against the territorial integrity or political independence of any state", ["allows any state to use force when it chooses", "creates the veto", "establishes the ICC", "requires all members to be democracies"], "The core rule against force."],
    ["Article 51 of the UN Charter preserves", "the inherent right of individual or collective self-defense against armed attack", ["the veto of the permanent members", "the right to intervene in civil wars", "free trade", "the Secretary-General’s power to declare war"], "One of two exceptions to the ban on force."],
    ["Under which chapter of the UN Charter can the Security Council authorize sanctions or the use of force?", "Chapter VII", ["Chapter I", "Chapter VI", "Chapter IX", "Chapter XIV"], "Chapter VI covers peaceful settlement."],
    ["NATO’s Article 5, “an attack on one is an attack on all,” is an example of", "collective defense", ["collective security", "peacekeeping", "humanitarian intervention", "economic sanctions"], "Collective security is all against any aggressor within the system."],
    ["NATO’s Article 5 has been invoked", "once, after the 9/11 attacks", ["never", "during the Cuban Missile Crisis", "in the Korean War", "every year"], "Allies responded to the attack on the US."],
    ["Traditional UN peacekeeping rests on", "consent of the parties, impartiality and minimal use of force", ["regime change", "full-scale war against aggressors", "the veto", "economic sanctions only"], "Peacekeeping is not in the Charter: “Chapter six and a half.”"],
    ["Which treaty created the European Union in 1992?", "The Maastricht Treaty", ["The Treaty of Rome", "The Treaty of Paris", "The Treaty of Versailles", "The Lisbon Treaty"], "The Treaty of Rome (1957) created the EEC."],
    ["The European Coal and Steel Community (1951) is significant because it", "began European integration by pooling key war industries", ["created the euro", "ended World War II", "created NATO", "admitted the UK"], "The first step toward the EU."],
    ["Pooling sovereignty in EU institutions such as the Commission and the Court of Justice is called", "supranationalism", ["intergovernmentalism", "isolationism", "mercantilism", "unipolarity"], "The Council of the EU is more intergovernmental."],
    ["A realist view of international organizations is that they", "mostly reflect the interests of powerful states", ["can end anarchy", "create identities that end conflict", "are controlled by NGOs", "always enforce international law"], "Liberals and constructivists give IOs more independent influence."],
    ["The UN’s main judicial organ, which settles disputes between states, is", "the International Court of Justice", ["the International Criminal Court", "the European Court of Human Rights", "the WTO Appellate Body", "the Security Council"], "It sits in The Hague."],
    ["After Russia vetoed a Security Council resolution in 2022, the General Assembly demanded Russia’s withdrawal from Ukraine. That resolution was", "not legally binding", ["binding on all states", "an authorization of force", "a NATO decision", "an ICC indictment"], "General Assembly resolutions are recommendations."]
  ]),
  { type: 'table', topic: 'igos', columns: ['Organ', 'Makeup', 'Role'], rows: [
    ['General Assembly', 'all 193 member states, one vote each', 'debates and makes non-binding recommendations'],
    ['Security Council', '15 members, five of them permanent with a veto', 'makes binding decisions on international peace and security'],
    ['Secretariat', 'international civil servants led by the Secretary-General', 'runs the UN’s day-to-day work'],
    ['International Court of Justice', '15 judges sitting in The Hague', 'settles legal disputes between states'],
    ['Economic and Social Council', '54 members elected by the General Assembly', 'coordinates economic and social work'],
    ['Trusteeship Council', 'the five permanent members', 'supervised trust territories; inactive since 1994']
  ], asks: [
    { prompt: 'Which UN organ {{Role}}?', answer: 'Organ', explain: 'The {{Organ}}: {{Makeup}}.' },
    { prompt: 'What is the makeup of the {{Organ}}?', answer: 'Makeup', options: 4, explain: 'The {{Organ}} {{Role}}.' }
  ] },
  { type: 'calc-mc', options: 4, topic: 'igos', vars: { yes: { min: 6, max: 15 }, v: [0, 0, 0, 1, 1, 2] }, where: 'yes + v <= 15 && !(yes < 9 && v > 0)',
    prompt: 'A draft Security Council resolution on a substantive matter gets {{yes}} votes in favour, and {{v}} permanent member{{= v == 1 ? "" : "s"}} vote{{= v == 1 ? "s" : ""}} against. Does it pass?',
    answer: 'v > 0 ? "No: vetoed by a permanent member" : (yes >= 9 ? "Yes: it passes" : "No: fewer than 9 votes in favour")',
    distractors: ['"Yes: it passes"', '"No: vetoed by a permanent member"', '"No: fewer than 9 votes in favour"', '"Only if the General Assembly agrees"'],
    explain: 'Substantive decisions need 9 of 15 votes and no negative vote from a permanent member (an abstention is not a veto). Here: {{yes}} in favour and {{v}} permanent “no” vote{{= v == 1 ? "" : "s"}}.' },
  bank('law-rights', [
    ["Which is NOT a source of international law listed in Article 38 of the ICJ Statute?", "UN General Assembly resolutions", ["Treaties", "Customary international law", "General principles of law", "Judicial decisions and scholarly writings, as subsidiary means"], "GA resolutions are not themselves a formal source, though they can be evidence of custom."],
    ["Customary international law requires state practice plus", "opinio juris: a belief that the practice is legally required", ["a Security Council resolution", "a written treaty", "approval by the ICC", "unanimous consent of all states"], "Habit alone is not enough."],
    ["The International Criminal Court (ICC) prosecutes", "individuals for genocide, crimes against humanity, war crimes and aggression", ["states for breaking treaties", "companies for trade violations", "the UN Security Council", "only heads of state from Europe"], "Created by the Rome Statute (1998, in force 2002)."],
    ["The International Court of Justice (ICJ) hears", "legal disputes between states", ["criminal cases against individuals", "disputes between companies", "human rights complaints from individuals", "trade disputes at the WTO"], "It is the UN’s principal judicial organ."],
    ["Which major powers are NOT members of the ICC?", "The United States, Russia and China", ["France, the UK and Germany", "Canada and Mexico", "Japan and South Korea", "Brazil and Argentina"], "Over 120 states are parties."],
    ["The Universal Declaration of Human Rights was adopted by", "the UN General Assembly on 10 December 1948", ["the Security Council in 1945", "the League of Nations in 1920", "the ICC in 2002", "NATO in 1949"], "Eleanor Roosevelt chaired the drafting commission."],
    ["Is the UDHR a legally binding treaty?", "No, it is a General Assembly declaration, though parts are now customary law", ["Yes, all states signed it as a treaty", "Yes, but only for the P5", "No, and it has no legal influence at all", "Yes, enforced by the ICJ"], "The binding treaties are the 1966 covenants."],
    ["Which two 1966 treaties make UDHR rights binding on states that ratify them?", "The ICCPR and the ICESCR", ["The NPT and the CWC", "The Rome Statute and the Genocide Convention", "The GATT and the WTO Agreement", "Kyoto and Paris"], "Civil and political; economic, social and cultural."],
    ["Under the 1948 Genocide Convention, what distinguishes genocide from other mass killing?", "Intent to destroy, in whole or in part, a national, ethnic, racial or religious group", ["The number of people killed", "Whether weapons of mass destruction were used", "Whether the killing took place in wartime", "Whether the UN was present"], "Intent is the key legal element."],
    ["About how many people were killed in the 1994 Rwandan genocide?", "About 800,000 in about 100 days", ["About 8,000 in a year", "About 6 million over five years", "About 80,000 in a month", "About 2 million in a week"], "Mostly Tutsi and moderate Hutu."],
    ["According to Samantha Power’s “Bystanders to Genocide,” why did US officials avoid the word “genocide” in 1994?", "Using it could create pressure or an obligation to act", ["They did not know what was happening", "The word had not been invented yet", "Rwanda had no ethnic groups", "The UN had banned the term"], "Inaction was a choice, not ignorance."],
    ["Which US decision does Power criticize regarding the UN peacekeeping force in Rwanda (UNAMIR)?", "The US pushed to withdraw or shrink it", ["The US sent thousands of troops to reinforce it", "The US took command of it", "The US funded it fully", "The US moved it to Somalia"], "The Security Council cut UNAMIR sharply in April 1994."],
    ["The Responsibility to Protect (2005) holds that", "if a state fails to protect its people from mass atrocities, the international community should act", ["sovereignty is absolute", "only the US may intervene", "the ICC must approve all wars", "human rights are a domestic matter only"], "Sovereignty as responsibility."],
    ["Louis Henkin observed that almost all nations observe almost all principles of international law almost all of the time. This suggests", "international law is usually followed even without a world police", ["international law is never followed", "only great powers obey international law", "the UN enforces every rule", "treaties are illegal"], "Reciprocity and reputation drive compliance."],
    ["The cultural relativism debate in human rights asks whether", "rights are universal or depend on each society’s culture", ["treaties are binding", "the UN should have a veto", "states are sovereign", "trade improves rights"], "Universalists say rights apply everywhere."]
  ]),
  { type: 'table', topic: 'law-rights', columns: ['Agreement', 'Year', 'What it does'], rows: [
    ['UN Charter', '1945', 'creates the UN and bans the use of force except in self-defense or with Security Council authorization'],
    ['Universal Declaration of Human Rights', '1948', 'sets out a common standard of human rights (not a binding treaty)'],
    ['Genocide Convention', '1948', 'defines genocide and obliges states to prevent and punish it'],
    ['Refugee Convention', '1951', 'defines who is a refugee and forbids returning refugees to danger'],
    ['ICCPR and ICESCR', '1966', 'make civil, political, economic and social rights binding on parties'],
    ['Rome Statute', '1998', 'creates the International Criminal Court'],
    ['World Summit Outcome (Responsibility to Protect)', '2005', 'says sovereignty includes a duty to protect people from mass atrocities']
  ], asks: [
    { prompt: 'Which agreement {{What it does}}?', answer: 'Agreement', explain: 'The {{Agreement}} ({{Year}}).' },
    { prompt: 'In what year was the {{Agreement}} adopted?', answer: 'Year', options: 4, explain: 'The {{Agreement}} ({{Year}}) {{What it does}}.' }
  ] },

  /* ===================== Unit 5 ===================== */
  bank('trade', [
    ["Which IPE perspective holds that the economy should serve state power, through protection and trade surpluses?", "Mercantilism (economic nationalism)", ["Economic liberalism", "Dependency theory", "Constructivism", "World-systems theory"], "Hamilton and List are associated with it."],
    ["Who developed the theory of comparative advantage?", "David Ricardo", ["Adam Smith", "Karl Marx", "Alexander Hamilton", "John Maynard Keynes"], "Principles of Political Economy and Taxation, 1817."],
    ["A country has a comparative advantage in a good when it", "produces it at a lower opportunity cost than its partner", ["produces more of it than any other country", "has the most workers", "exports nothing else", "has the highest tariff on it"], "Absolute advantage means more output, not lower opportunity cost."],
    ["If one country is better at producing everything, can both countries still gain from trade?", "Yes, if each specializes in its comparative advantage", ["No, the stronger country gains everything", "No, trade only works between equals", "Only if they share a currency", "Only if a hegemon forces them"], "Ricardo’s key insight."],
    ["The GATT (1947) mainly", "lowered tariffs through rounds of negotiations", ["created the euro", "provided loans to countries in crisis", "banned nuclear weapons", "created the UN"], "The WTO replaced it as an organization in 1995."],
    ["What did the WTO (1995) add that the GATT lacked?", "Binding dispute settlement and rules on services and intellectual property", ["Tariffs on all goods", "A common currency", "A military alliance", "Control of exchange rates"], "Its Appellate Body stopped working in 2019."],
    ["The WTO’s most-favored-nation principle means", "a trade concession to one member must be extended to all members", ["the richest country gets the best deal", "members may discriminate against rivals", "only allies can trade", "imports must be taxed more than domestic goods"], "National treatment is the other non-discrimination rule."],
    ["Which group is most likely to oppose free trade?", "Workers and firms in import-competing industries", ["Exporters", "Consumers", "Firms that import parts", "Retailers of imported goods"], "Trade raises total income but creates losers."],
    ["A tax on imported goods is a", "tariff", ["quota", "subsidy", "embargo", "exchange rate"], "A quota limits the quantity of imports."],
    ["Bretton Woods (1944) created which two institutions?", "The IMF and the World Bank", ["The WTO and the UN", "NATO and the EU", "The ICC and the ICJ", "The GATT and OPEC"], "The GATT came separately in 1947."],
    ["NAFTA (1994) was replaced in 2020 by", "the USMCA", ["the WTO", "the TPP", "the EU", "Mercosur"], "The United States–Mexico–Canada Agreement."],
    ["Globalization refers to", "growing cross-border flows of goods, capital, people and ideas", ["the creation of a world government", "the end of all trade barriers everywhere", "the spread of nuclear weapons", "the rise of one hegemon"], "Driven by technology and policy."],
    ["A radical/Marxist view of trade emphasizes", "exploitation of poorer countries by richer ones", ["mutual gains for all", "the state’s need for power", "shared norms of free trade", "comparative advantage"], "Dependency and world-systems theory."]
  ]),
  { type: 'calc', topic: 'trade', vars: { a: { min: 2, max: 12 }, b: { min: 1, max: 8 }, c: { min: 2, max: 12 }, d: { min: 1, max: 8 } }, where: 'a * d != b * c',
    prompt: 'In one hour, Country A can make {{a}} shirts or {{b}} phone{{= b == 1 ? "" : "s"}}, and Country B can make {{c}} shirts or {{d}} phone{{= d == 1 ? "" : "s"}}. What is Country A’s opportunity cost of one phone, measured in shirts?',
    answer: 'round(a / b, 2)', unit: 'shirts', tol: 0.01,
    explain: 'To make one phone, A gives up {{a}} ÷ {{b}} = {{answer}} shirts. (B gives up {{c}} ÷ {{d}} = {{= round(c / d, 2)}} shirts per phone.)' },
  { type: 'calc-mc', options: 4, topic: 'trade', vars: { a: { min: 2, max: 12 }, b: { min: 1, max: 8 }, c: { min: 2, max: 12 }, d: { min: 1, max: 8 } }, where: 'a * d != b * c',
    prompt: 'In one hour, Country A can make {{a}} shirts or {{b}} phone{{= b == 1 ? "" : "s"}}, and Country B can make {{c}} shirts or {{d}} phone{{= d == 1 ? "" : "s"}}. Which country has the comparative advantage in phones?',
    answer: 'a / b < c / d ? "Country A" : "Country B"',
    distractors: ['"Country A"', '"Country B"', '"Neither country"', '"Both countries equally"'],
    explain: 'Opportunity cost of a phone: A gives up {{a}} ÷ {{b}} = {{= round(a / b, 2)}} shirts; B gives up {{c}} ÷ {{d}} = {{= round(c / d, 2)}} shirts. The lower cost has the comparative advantage: {{answer}}.' },
  bank('money', [
    ["An exchange rate is", "the price of one currency in terms of another", ["the interest rate set by the IMF", "a tariff on imports", "the rate of inflation", "the amount of gold a country holds"], "For example, euros per dollar."],
    ["Under a fixed exchange rate, a government", "pegs its currency to gold or another currency", ["lets markets set the rate freely", "abolishes its currency", "sets tariffs to zero", "lets the IMF set its interest rate"], "Floating rates are set by markets."],
    ["What does a country gain by letting its currency float?", "Monetary policy autonomy and flexibility", ["Guaranteed stability", "Lower tariffs", "A seat on the Security Council", "Freedom from all crises"], "It gives up the stability of a fixed rate."],
    ["The trilemma says a country cannot have all three of", "a fixed exchange rate, free capital mobility and an independent monetary policy", ["free trade, democracy and peace", "growth, low inflation and full employment", "tariffs, quotas and subsidies", "gold, silver and dollars"], "It must give up one."],
    ["Eurozone countries share a currency and allow free capital flows. By the trilemma, what have they given up?", "An independent national monetary policy", ["Free trade", "Their armies", "Their seats in the UN", "Capital mobility"], "The European Central Bank sets monetary policy."],
    ["A depreciation of the US dollar makes", "US exports cheaper abroad and imports more expensive at home", ["US exports more expensive abroad", "imports cheaper for Americans", "no difference to trade", "the dollar worth more"], "Exporters gain; importers and consumers lose."],
    ["According to Frieden, which group usually favors a weaker (depreciated) currency?", "Exporters and import-competing producers of tradable goods", ["Consumers of imported goods", "People with debts in foreign currency", "Tourists going abroad", "Importers"], "A weaker currency makes their goods more competitive."],
    ["According to Frieden, which group most values a stable, fixed exchange rate?", "Firms and investors involved in international trade and investment", ["Producers of purely domestic services", "Governments that want monetary autonomy", "Groups hurt by fixed rates", "No group"], "Exchange-rate risk hurts cross-border business."],
    ["Frieden’s two dimensions of currency policy are", "the regime (fixed vs floating) and the level (strong vs weak)", ["tariffs and quotas", "gold and silver", "interest rates and inflation", "trade and aid"], "Each has winners and losers."],
    ["What ended the Bretton Woods system of fixed exchange rates?", "Nixon closing the dollar–gold window in August 1971", ["The 2008 financial crisis", "The creation of the euro", "The Asian financial crisis", "World War II"], "Major currencies floated by 1973."],
    ["Under Bretton Woods, the US dollar was convertible into gold at", "$35 an ounce", ["$100 an ounce", "$1 an ounce", "a floating market price", "whatever the IMF set each year"], "Other currencies were pegged to the dollar."],
    ["The Asian financial crisis of 1997–98 began with", "the collapse of Thailand’s currency, the baht", ["the failure of Lehman Brothers", "Greece’s debt crisis", "the end of Bretton Woods", "Mexico’s oil boom"], "It spread across East Asia."],
    ["The 2008 Global Financial Crisis began in", "the US housing and subprime mortgage market", ["Thailand’s currency market", "Greek government bonds", "the Soviet Union", "the WTO"], "Lehman Brothers collapsed in September 2008."],
    ["IMF conditionality means", "loans come with required policy reforms", ["loans have no strings attached", "the IMF sets tariffs", "the IMF can veto Security Council resolutions", "loans are only for rich countries"], "Critics say the reforms often meant austerity."]
  ]),
  { type: 'calc', topic: 'money', vars: { old: { min: 0.80, max: 1.20, step: 0.05 }, pct: [-20, -15, -10, -5, 5, 10, 15, 20] }, let: { nw: 'round(old * (1 + pct / 100), 3)' },
    prompt: 'The dollar moves from {{old}} euros to {{nw}} euros. By what percent did the dollar’s value change? (Use a negative number for a fall.)',
    answer: 'round((nw - old) / old * 100, 1)', tol: 0.02,
    explain: '({{nw}} − {{old}}) ÷ {{old}} × 100 = {{answer}}%. The dollar {{= nw > old ? "appreciated: it buys more euros" : "depreciated: it buys fewer euros"}}.' },
  { type: 'calc-mc', options: 4, topic: 'money', vars: { old: { min: 0.80, max: 1.20, step: 0.05 }, pct: [-20, -15, -10, -5, 5, 10, 15, 20] }, let: { nw: 'round(old * (1 + pct / 100), 3)' },
    prompt: 'The exchange rate moves from {{old}} to {{nw}} euros per dollar. What happened to the dollar, and who in the US benefits?',
    answer: 'nw > old ? "It appreciated; US consumers and importers benefit" : "It depreciated; US exporters benefit"',
    distractors: ['"It appreciated; US exporters benefit"', '"It depreciated; US consumers and importers benefit"', '"It appreciated; US consumers and importers benefit"', '"It depreciated; US exporters benefit"'],
    explain: 'Each dollar now buys {{nw}} euros instead of {{old}}, so it {{= nw > old ? "appreciated. Imports get cheaper (good for consumers and importers) and US exports get dearer abroad" : "depreciated. US exports get cheaper abroad (good for exporters) and imports get dearer"}}.' },
  bank('environment', [
    ["Garrett Hardin’s “tragedy of the commons” (1968) describes", "the overuse of a shared resource because each user gains while the costs are shared", ["the failure of the League of Nations", "the arms race", "the democratic peace", "comparative advantage"], "Fisheries and the atmosphere are examples."],
    ["A free rider is a state that", "enjoys the benefits of others’ cooperation without paying its share", ["pays more than its share", "refuses to trade", "joins every alliance", "has no military"], "Free riding undermines collective action."],
    ["The Kyoto Protocol (1997)", "set binding emission targets for developed countries only", ["required every country to set its own pledge", "banned CFCs", "created the IMF", "was ratified by the United States"], "The US never ratified it."],
    ["Under the Paris Agreement (2015), countries", "each set their own nationally determined contributions (NDCs)", ["accepted targets imposed by the UN", "agreed to ban all fossil fuels by 2020", "created a world environmental police", "agreed only developed countries must act"], "The goal: well below 2°C, pursuing 1.5°C."],
    ["Which environmental agreement is usually seen as the biggest success?", "The Montreal Protocol (1987) on ozone-depleting substances", ["The Kyoto Protocol", "The Copenhagen Accord", "The Refugee Convention", "The NPT"], "Few producers, available substitutes and clear science."],
    ["Common but differentiated responsibilities means", "all countries share the duty to act, but rich countries should do more given their historical emissions", ["only poor countries must cut emissions", "no country is responsible", "all countries must cut emissions equally", "only the UN is responsible"], "A core principle of climate diplomacy."],
    ["Which country is the largest annual emitter of greenhouse gases today?", "China", ["The United States", "India", "Germany", "Brazil"], "The US has the largest cumulative emissions."],
    ["In the demographic transition, which falls first?", "Death rates", ["Birth rates", "Both at the same time", "Neither", "Migration"], "Falling death rates with high birth rates cause rapid growth."],
    ["Thomas Malthus (1798) warned that", "population growth would outrun the food supply", ["trade would end war", "states would form a world government", "technology would end scarcity", "climate change would raise sea levels"], "Optimists point to technology and the Green Revolution."],
    ["World population passed 8 billion in", "2022", ["1999", "2011", "2030", "1950"], "UN estimate, November 2022."],
    ["Under the 1951 Refugee Convention, a refugee is someone outside their country with a well-founded fear of persecution for", "race, religion, nationality, membership of a particular social group or political opinion", ["poverty or unemployment", "climate change", "natural disasters", "any reason at all"], "Economic and climate migrants are not covered."],
    ["The principle of non-refoulement means", "refugees may not be returned to a place where they face serious danger", ["refugees must return home within a year", "states may close all borders", "refugees cannot work", "only the UN can admit refugees"], "A core principle of refugee law."],
    ["Why did the US withdraw from the Paris Agreement under Trump and rejoin under Biden?", "Paris rests on national pledges, so participation shifts with domestic politics", ["The treaty expired", "The UN expelled the US", "China required it", "The ICC ordered it"], "It took a second withdrawal notice in 2025."],
    ["The UNFCCC (1992), the basis for later climate treaties, was adopted at", "the Rio Earth Summit", ["the Bretton Woods conference", "the Congress of Vienna", "the Paris Peace Conference of 1919", "the San Francisco conference of 1945"], "The UN Framework Convention on Climate Change."]
  ]),
  { type: 'calc', topic: 'environment', vars: { r: [0.5, 0.7, 1, 1.4, 2, 2.5, 3.5] }, prompt: 'A country’s population grows by {{r}}% a year. Using the rule of 70, about how many years until it doubles?', answer: 'round(70 / r, 1)', unit: 'years', tol: 0.02, explain: 'Doubling time ≈ 70 ÷ {{r}} = {{answer}} years.' }
];

module.exports = { hint: 'Name the concept the question is testing first, then rule out options that belong to a different theory, reading or period.', topics, ladders, questions };
