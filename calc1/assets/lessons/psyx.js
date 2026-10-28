/* PSYX 340 Abnormal Psychology: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).psyx = {
  history: {
    plain: 'There is no single line between "normal" and "abnormal". The course uses four Ds as a working test: deviance (unusual for the culture), distress (upsetting to the person), dysfunction (gets in the way of daily life) and danger (to self or others). Culture matters: the same behaviour can be expected in one setting and alarming in another. Ideas about causes have swung between the supernatural, the biological and the psychological over history.',
    figure: { type: 'table', head: ['the four Ds', 'question to ask'], rows: [['deviance', 'Is it far from this culture\'s norms?'], ['distress', 'Is it upsetting to the person?'], ['dysfunction', 'Does it get in the way of daily life?'], ['danger', 'Is anyone at risk of harm?']], caption: 'A working definition, not a perfect rule.' },
    check: [
      ['A man meditates and fasts on a mountain as his religion expects, and is content. Is this abnormal?', 'Not by the four Ds: it fits his culture, causes no distress or dysfunction, and is not dangerous.'],
      ['Which D is about whether behaviour gets in the way of work or relationships?', 'Dysfunction.'],
      ['Why does culture matter in judging abnormality?', 'Norms differ, so deviance depends on the setting.']
    ]
  },
  models: {
    plain: 'Each model of abnormality is a lens that points at different causes and treatments. The biological model looks at the brain, genes and chemistry; the psychodynamic model at unconscious conflict; the cognitive-behavioural model at learning and thinking patterns; the humanistic and existential models at meaning and growth; the sociocultural model at family, culture and society. Most disorders are best explained by several together (the biopsychosocial view).',
    figure: { type: 'table', head: ['model', 'cause', 'treatment'], rows: [['biological', 'brain, genes, chemistry', 'medication, ECT'], ['psychodynamic', 'unconscious conflict', 'insight therapy'], ['cognitive-behavioural', 'learned behaviour, distorted thoughts', 'CBT, exposure'], ['humanistic', 'blocked growth', 'client-centred therapy'], ['sociocultural', 'family, culture, stress', 'family or community work']], caption: 'Same person, different lenses.' },
    check: [
      ['"She believes she is worthless" fits which model?', 'Cognitive.'],
      ['"Her mother had depression" points to which model?', 'Biological (genetic).'],
      ['What is the diathesis-stress idea?', 'A vulnerability plus a stressor together trigger a disorder.']
    ]
  },
  assessment: {
    plain: 'Diagnosis depends on good measurement. A useful test is standardised (same procedure for everyone), reliable (gives consistent results) and valid (measures what it claims to). Clinicians combine interviews, tests and observation, then use the DSM-5-TR to classify. A label is a tool for treatment and communication, and it can also stigmatise.',
    figure: { type: 'table', head: ['quality', 'means', 'fails when'], rows: [['reliable', 'consistent results', 'scores jump with nothing changed'], ['valid', 'measures what it claims', 'it measures something else'], ['standardised', 'same procedure and norms', 'each person tested differently']], caption: 'A test can be reliable without being valid, but not valid without being reliable.' },
    check: [
      ['A questionnaire gives 42 on Monday and 18 on Friday, nothing changed. What is wrong?', 'Poor test–retest reliability.'],
      ['What does validity mean?', 'The test measures what it says it measures.'],
      ['Can a reliable test be invalid?', 'Yes: it can consistently measure the wrong thing.']
    ]
  },
  anxiety: {
    plain: 'Fear is a normal alarm; an anxiety disorder is an alarm that goes off too often, too strongly or about the wrong things. Generalized anxiety is constant worry about many things; panic disorder is sudden attacks plus fear of the next one; phobias are intense fear of something specific. In OCD, intrusive thoughts (obsessions) drive repeated acts (compulsions) that bring short relief and keep the cycle going.',
    figure: { type: 'flow', steps: ['Obsession: intrusive, unwanted thought', 'Anxiety rises', 'Compulsion: ritual to neutralise it', 'Short relief', 'Relief reinforces the ritual'], cycle: true, caption: 'The OCD cycle. Exposure and response prevention breaks it at the compulsion.' },
    check: [
      ['Three sudden attacks of pounding heart and fear of dying, plus a month of dread about the next one. Which disorder?', 'Panic disorder.'],
      ['How long must worry last for GAD?', 'At least 6 months, more days than not.'],
      ['What is the main treatment for OCD?', 'Exposure and response prevention (often with an SSRI).']
    ]
  },
  trauma: {
    plain: 'After a terrible event, the body\'s stress systems (fight-or-flight and the cortisol system) can stay switched on. When intrusive memories, avoidance, a darker mood and constant alertness last from 3 days to a month, that is acute stress disorder; longer than a month, PTSD. Most people exposed to trauma do not develop PTSD; support and coping matter a lot.',
    figure: { type: 'numberline', x: [0, 60], intervals: [{ from: 3, to: 30, left: 'closed', right: 'closed' }, { from: 30, to: 60, left: 'open', right: 'open' }], points: [{ x: 3, label: '3 days' }, { x: 30, label: '1 month' }], caption: 'Days after the trauma: acute stress disorder from 3 days to 1 month; PTSD after that.' },
    check: [
      ['Ten days after a crash, nightmares, avoidance and jumpiness. What diagnosis fits?', 'Acute stress disorder (less than a month).'],
      ['What are the four symptom groups of PTSD?', 'Intrusions, avoidance, negative changes in thinking and mood, and arousal/reactivity.'],
      ['Which hormone does the HPA axis release?', 'Cortisol.']
    ]
  },
  depression: {
    plain: 'Major depression is more than sadness: for at least two weeks, a person has five or more of nine symptoms, including low mood or a loss of interest in things they used to enjoy. Sleep, appetite, energy, concentration and self-worth often change too. Persistent depressive disorder is milder but lasts two years or more. Therapy (like CBT) and antidepressants both help, and they work best together.',
    figure: { type: 'table', head: ['', 'major depressive disorder', 'persistent depressive disorder'], rows: [['length', '2 weeks or more', '2 years or more'], ['symptoms', '5 of 9, incl. mood or anhedonia', 'depressed mood + 2 others'], ['severity', 'often severe', 'usually milder, chronic']], caption: 'Two depressive disorders compared.' },
    check: [
      ['What is anhedonia?', 'Loss of interest or pleasure in usual activities.'],
      ['How long must symptoms last for a major depressive episode?', 'At least two weeks.'],
      ['Which neurotransmitters are most linked to depression?', 'Serotonin and norepinephrine.']
    ]
  },
  bipolar: {
    plain: 'Bipolar disorders swing between depression and periods of abnormally high or irritable mood with surging energy. A full manic episode lasts at least a week (or needs hospital care) and brings things like grand ideas, little need for sleep, racing speech and risky choices. Bipolar I needs one manic episode; Bipolar II has milder hypomania plus major depression. Mood stabilisers like lithium are the main treatment.',
    figure: { type: 'table', head: ['', 'Bipolar I', 'Bipolar II', 'Cyclothymic'], rows: [['highs', 'full mania (≥ 1 week)', 'hypomania (≥ 4 days)', 'hypomanic symptoms'], ['lows', 'often depression', 'major depression', 'mild depressive symptoms'], ['length', 'any', 'any', '2 years or more']], caption: 'The bipolar family.' },
    check: [
      ['After a depressive episode, 5 days of little sleep, big plans and fast talk, without impairment. Which diagnosis?', 'Bipolar II (hypomania plus major depression).'],
      ['What is the difference between mania and hypomania?', 'Hypomania is shorter and milder, without severe impairment.'],
      ['What is the classic mood stabiliser?', 'Lithium.']
    ]
  },
  suicide: {
    plain: 'If you or someone you know is in crisis, call or text 988, or contact MSU Counseling at (406) 994-4531. Asking someone directly about suicide does not put the idea in their head; it opens the door to help. Researchers look at risk factors (previous attempts, mood disorders, substance use, access to means, isolation) and protective factors (connection, treatment, reasons for living). Durkheim described types based on how connected a person is to society.',
    figure: { type: 'table', head: ['Durkheim type', 'social link', 'example'], rows: [['egoistic', 'too weak a bond to society', 'isolated, cut off'], ['altruistic', 'too strong: dies for the group', 'self-sacrifice'], ['anomic', 'sudden break in social order', 'job loss when a town\'s factory closes']], caption: 'Durkheim\'s sociological view of suicide.' },
    check: [
      ['Does asking someone about suicide increase the risk?', 'No: asking directly opens the door to help.'],
      ['A man who defined himself by his job is laid off when the town\'s factory closes. Which Durkheim type?', 'Anomic.'],
      ['Name the strongest single risk factor.', 'A previous suicide attempt.']
    ]
  },
  somatic: {
    plain: 'Somatic symptom disorders involve real distress about bodily symptoms. In somatic symptom disorder the symptoms may be mild but the worry about them is consuming; in illness anxiety disorder there are few or no symptoms but strong fear of being ill. In conversion disorder, there is a real loss of function (like paralysis) without a medical cause. Faking illness for the sick role is factitious disorder; faking for a reward is malingering.',
    figure: { type: 'table', head: ['', 'symptoms produced on purpose?', 'goal'], rows: [['somatic symptom / illness anxiety', 'no', '–'], ['conversion disorder', 'no', '–'], ['factitious disorder', 'yes', 'the sick role itself'], ['malingering (not a disorder)', 'yes', 'an outside reward']], caption: 'Intention and motive separate these.' },
    check: [
      ['Rae is sure a mild headache is a brain tumour; tests are normal and reassurance fails. Which disorder?', 'Illness anxiety disorder.'],
      ['How does malingering differ from factitious disorder?', 'Malingering fakes for an outside reward; factitious disorder for the sick role itself.'],
      ['What is conversion disorder?', 'A real loss of movement or sensation with no medical explanation.']
    ]
  },
  eating: {
    plain: 'Anorexia nervosa means eating so little that body weight becomes very low, with an intense fear of gaining weight and a distorted body image. Bulimia nervosa is repeated binges followed by purging or other compensation, often at a normal weight. Binge-eating disorder has binges without compensation. Body mass index (weight in kg over height in metres squared) grades anorexia severity in adults.',
    figure: { type: 'table', head: ['adult severity', 'BMI (kg/m²)'], rows: [['mild', '17 or more'], ['moderate', '16 – 16.99'], ['severe', '15 – 15.99'], ['extreme', 'below 15']], caption: 'Anorexia severity is graded by body mass index.' },
    check: [
      ['An adult is 1.70 m and 44 kg. What is the BMI?', '$44 / 1.70^2 \\approx 15.2$: severe.'],
      ['What separates bulimia from binge-eating disorder?', 'Bulimia includes purging or other compensation.'],
      ['Which eating disorder has the highest death rate?', 'Anorexia nervosa.']
    ]
  },
  substance: {
    plain: 'A substance use disorder is a pattern of use that causes problems, judged by 11 criteria: losing control, harming life and relationships, risky use, and the body\'s changes (tolerance and withdrawal). Two or three criteria in a year is mild; four or five, moderate; six or more, severe. Different drugs act on different brain systems, but all hit the reward pathway that runs on dopamine.',
    figure: { type: 'bars', bars: [['mild', 2], ['moderate', 4], ['severe', 6]], caption: 'Minimum number of the 11 criteria (in 12 months) for each severity.' },
    check: [
      ['Sam drank more than intended, failed to cut down, missed classes and needs more to feel it. How many criteria?', 'At least 4: moderate.'],
      ['What is tolerance?', 'Needing more of a substance to get the same effect.'],
      ['Which neurotransmitter runs the reward pathway?', 'Dopamine.']
    ]
  },
  technology: {
    plain: 'This topic comes from lecture, so lecture notes are the source for the exam. The big lesson is correlation versus causation: heavy social media use goes along with poorer mood, but that does not prove one causes the other. Depressed people may scroll more, or a third factor may drive both. Look for experiments and longitudinal studies before believing a cause.',
    figure: { type: 'flow', steps: ['A and B are correlated', 'Could A cause B?', 'Could B cause A (reverse)?', 'Could a third factor cause both?', 'Only an experiment can show cause'], caption: 'Questions to ask of any correlation headline.' },
    check: [
      ['"Teens on social media 5+ hours are twice as likely to be depressed, so it causes depression." What is wrong?', 'It is a correlation: depression might drive use, or a third factor might drive both.'],
      ['What kind of study can show cause?', 'A randomized experiment.'],
      ['What is a third (confounding) variable?', 'Something else that affects both measured variables.']
    ]
  },
  sexual: {
    plain: 'Sexual dysfunctions disrupt a phase of the sexual response cycle: desire, arousal, orgasm or pain. Paraphilic interests are unusual sexual interests; they become disorders only when they cause the person distress or impairment, or involve harm or non-consenting people. Gender dysphoria is distress from a mismatch between experienced gender and assigned sex; being transgender in itself is not a disorder.',
    figure: { type: 'flow', dir: 'right', steps: ['desire', 'excitement', 'orgasm'], caption: 'The sexual response cycle (then resolution). Each dysfunction disrupts a phase.' },
    check: [
      ['A harmless unusual sexual interest with consenting adults, no distress. Is it a disorder?', 'No: it is a paraphilia, not a paraphilic disorder.'],
      ['Name the phases of the sexual response cycle.', 'Desire, excitement (arousal), orgasm, resolution.'],
      ['What is gender dysphoria about?', 'Distress over a mismatch between experienced gender and assigned sex.']
    ]
  },
  schizophrenia: {
    plain: 'Schizophrenia is a break with reality. Positive symptoms add something that should not be there: delusions, hallucinations, disorganised speech. Negative symptoms take something away: flat emotion, little speech, lack of motivation. Diagnosis needs two or more symptoms for a month and signs for six months. Causes combine genes, brain chemistry (too much dopamine activity in some pathways) and stress.',
    figure: { type: 'table', head: ['positive (added)', 'negative (missing)'], rows: [['delusions', 'flat affect'], ['hallucinations', 'alogia (little speech)'], ['disorganised speech', 'avolition (no drive)'], ['disorganised behaviour', 'social withdrawal']], caption: 'Antipsychotics treat positive symptoms better than negative ones.' },
    check: [
      ['Voices and TV messages for 3 months. Schizophrenia yet?', 'Not yet: it needs 6 months of signs. Schizophreniform disorder (1–6 months) fits.'],
      ['Is flat emotion a positive or negative symptom?', 'Negative.'],
      ['What is the dopamine hypothesis?', 'Too much dopamine activity (in some pathways) drives positive symptoms.']
    ]
  },
  'psychosis-tx': {
    plain: 'Antipsychotic drugs changed treatment in the 1950s. The first generation block dopamine and help positive symptoms, but can cause movement side effects, including tardive dyskinesia after years of use. Second-generation drugs cause fewer movement problems but more weight gain. Medication works best with therapy, family support and community care; deinstitutionalisation left many people without that care.',
    figure: { type: 'table', head: ['', 'first generation', 'second generation'], rows: [['examples', 'haloperidol, chlorpromazine', 'clozapine, risperidone'], ['helps', 'positive symptoms', 'positive, some negative'], ['main risk', 'movement effects, tardive dyskinesia', 'weight gain, metabolic']], caption: 'Two generations of antipsychotics.' },
    check: [
      ['Years on haloperidol, then lip-smacking that continues off the drug. What is it?', 'Tardive dyskinesia.'],
      ['What is a token economy?', 'A system rewarding desired behaviour with tokens to trade for privileges.'],
      ['Which antipsychotic helps people others did not?', 'Clozapine.']
    ]
  },
  narcissism: {
    plain: 'This topic comes from lecture, so lecture notes come first. Narcissism runs from an everyday trait to narcissistic personality disorder: a lasting pattern of grandiosity, need for admiration and lack of empathy. Researchers separate grandiose narcissism (bold, entitled) from vulnerable narcissism (fragile, resentful, easily hurt).',
    figure: { type: 'table', head: ['', 'grandiose', 'vulnerable'], rows: [['self-image', 'superior, special', 'fragile, defensive'], ['in public', 'confident, dominant', 'shy, hypersensitive'], ['when criticised', 'anger, dismissal', 'shame, resentment']], caption: 'Two faces of narcissism.' },
    check: [
      ['A coworker brags constantly, demands special treatment and takes credit for others\' work. Which traits?', 'Grandiosity, entitlement, exploitation: grandiose narcissism.'],
      ['Which DSM cluster is narcissistic personality disorder in?', 'Cluster B.'],
      ['Is high narcissism always a disorder?', 'No: it is a trait on a spectrum; NPD needs pervasive impairment or distress.']
    ]
  },
  personality: {
    plain: 'A personality disorder is a long-lasting, inflexible way of thinking and relating that causes distress or problems, starting by early adulthood. The ten disorders fall into three clusters: odd or eccentric (A), dramatic or erratic (B), and anxious or fearful (C). Borderline personality disorder, in cluster B, responds well to dialectical behaviour therapy.',
    figure: { type: 'table', head: ['cluster', 'feel', 'disorders'], rows: [['A', 'odd, eccentric', 'paranoid, schizoid, schizotypal'], ['B', 'dramatic, erratic', 'antisocial, borderline, histrionic, narcissistic'], ['C', 'anxious, fearful', 'avoidant, dependent, obsessive-compulsive']], caption: 'Remember: weird, wild, worried.' },
    check: [
      ['A woman sure others are plotting against her: which cluster?', 'A (paranoid).'],
      ['A man who cannot make any decision without reassurance: which cluster?', 'C (dependent).'],
      ['Which therapy was built for borderline personality disorder?', 'Dialectical behaviour therapy (DBT).']
    ]
  },
  childhood: {
    plain: 'Some disorders start in childhood. ADHD is inattention and/or hyperactivity that shows up in more than one setting and started before age 12. Autism spectrum disorder affects social communication and brings restricted, repetitive behaviour. Anxiety, conduct problems and learning disorders are also common. Behaviour that appears in only one setting suggests something about that setting.',
    figure: { type: 'table', head: ['ADHD presentation', 'symptoms'], rows: [['predominantly inattentive', '6+ inattention symptoms'], ['predominantly hyperactive-impulsive', '6+ hyperactivity-impulsivity symptoms'], ['combined', 'both']], caption: 'Five symptoms are enough from age 17; all need 6 months and two settings.' },
    check: [
      ['A 9-year-old is restless only at school, calm at home and in sports. ADHD?', 'Unlikely: ADHD symptoms must show in two or more settings.'],
      ['Before what age must ADHD symptoms start?', '12.'],
      ['What are the two core areas of autism spectrum disorder?', 'Social communication differences and restricted, repetitive behaviour.']
    ]
  }
};
