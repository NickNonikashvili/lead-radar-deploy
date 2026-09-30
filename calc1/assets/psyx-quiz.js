/* ============================================================
   Mathub — PSYX 340 question bank
   Multiple-choice banks for every topic, plus generators for the rules
   that are counted or timed (episode durations, the psychosis ladder,
   trauma timing, substance use disorder severity, anorexia BMI
   severity, ADHD thresholds, personality clusters). Written for Mathub
   from the DSM-5-TR and standard abnormal-psychology content; the
   instructor's lectures decide what the exams actually ask.
   ============================================================ */
(function (global) {
  'use strict';
  const TOPICS = {
    history: { unit: 1, sec: 'history', label: 'History & the four Ds' },
    models: { unit: 1, sec: 'models', label: 'Models of abnormality' },
    assessment: { unit: 1, sec: 'assessment', label: 'Assessment & diagnosis' },
    anxiety: { unit: 1, sec: 'anxiety', label: 'Anxiety & OCD' },
    trauma: { unit: 1, sec: 'trauma', label: 'Trauma & stress' },
    depression: { unit: 2, sec: 'depression', label: 'Depressive disorders' },
    bipolar: { unit: 2, sec: 'bipolar', label: 'Bipolar disorders' },
    suicide: { unit: 2, sec: 'suicide', label: 'Suicide' },
    somatic: { unit: 2, sec: 'somatic', label: 'Somatic symptom disorders' },
    eating: { unit: 2, sec: 'eating', label: 'Eating disorders' },
    substance: { unit: 2, sec: 'substance', label: 'Substance & addiction' },
    technology: { unit: 2, sec: 'technology', label: 'Technology & mental health' },
    sexual: { unit: 2, sec: 'sexual', label: 'Sexual disorders & gender' },
    schizophrenia: { unit: 3, sec: 'schizophrenia', label: 'Schizophrenia & psychosis' },
    'psychosis-tx': { unit: 3, sec: 'psychosis-tx', label: 'Treating psychosis' },
    narcissism: { unit: 3, sec: 'narcissism', label: 'Narcissism' },
    personality: { unit: 3, sec: 'personality', label: 'Personality disorders' },
    childhood: { unit: 3, sec: 'childhood', label: 'Childhood disorders' }
  };
  const ri = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function mc(topic, prompt, correct, distractors, explanation, hint) { const opts = [String(correct)]; for (const d of distractors) { const s = String(d); if (!opts.includes(s)) opts.push(s); } const options = shuffle(opts.slice(0, 5)); return { topic, type: 'mc', prompt, options, answer: options.indexOf(String(correct)), explanation, hint }; }
  function num(topic, prompt, answer, explanation, hint, tol) { return { topic, type: 'num', prompt, answer, answerTex: String(answer), explanation, hint, tol: tol || 0.05 }; }
  /* a bank item is [prompt, correct, [distractors], explanation, hint] */
  const bank = (topic, items) => { const g = () => { const it = pick(items); return mc(topic, it[0], it[1], it[2], it[3], it[4] || 'Eliminate the options that belong to a different disorder or model first.'); }; g.bankSize = items.length; return g; };

  /* ---------- Unit 1 ---------- */
  const qHistory = bank('history', [
    ['Which of these is <b>not</b> one of Comer’s four Ds of abnormality?', 'Disability', ['Deviance', 'Distress', 'Dysfunction', 'Danger'], 'The four Ds are deviance, distress, dysfunction and danger.'],
    ['Hippocrates explained abnormal behavior as the result of', 'an imbalance of four bodily humors', ['possession by evil spirits', 'unconscious conflicts', 'faulty learning', 'social labeling'], 'Hippocrates offered a natural (somatogenic) explanation: an imbalance of the four humors.'],
    ['Philippe Pinel is best known for', 'introducing moral treatment by unchaining patients in Paris', ['founding psychoanalysis', 'linking general paresis to syphilis', 'campaigning for US state hospitals', 'developing the first IQ test'], 'Pinel’s moral treatment emphasized humane care. Dorothea Dix campaigned for state hospitals; the paresis link came later.'],
    ['Dorothea Dix is associated with', 'a campaign that established state hospitals for people with mental disorders', ['the York Retreat in England', 'the humoral theory', 'hypnotism', 'the token economy'], 'Dix’s US reform movement founded many state hospitals, which later became overcrowded.'],
    ['The discovery that general paresis is caused by syphilis supported which perspective?', 'The somatogenic perspective', ['The psychogenic perspective', 'Demonology', 'The existential perspective', 'Moral treatment'], 'A physical cause for a mental disorder strengthened the somatogenic view.'],
    ['Deinstitutionalization was made possible largely by', 'antipsychotic and other psychotropic drugs in the 1950s', ['the invention of psychoanalysis', 'the end of moral treatment', 'managed care in the 1990s', 'the DSM-5'], 'Medications controlled severe symptoms well enough for many people to leave hospitals.'],
    ['Trephination in the Stone Age most likely aimed to', 'release evil spirits through a hole in the skull', ['balance the four humors', 'treat syphilis', 'measure intelligence', 'induce seizures'], 'Trephination is thought to have been meant to let spirits escape, though historians debate this.'],
    ['Johann Weyer, a Renaissance physician, argued that', 'the mind can be sick just as the body can', ['abnormality comes from demons', 'mental illness is always inherited', 'asylums should be closed', 'dreams reveal the unconscious'], 'Weyer is often called a founder of modern psychopathology for this view.'],
    ['A behavior that is unusual but causes no distress, impairment or danger is best described as', 'deviant, but not necessarily abnormal', ['a mental disorder', 'dysfunctional', 'dangerous', 'psychotic'], 'Deviance alone does not make behavior abnormal; the four Ds are weighed together.']
  ]);
  const qModels = bank('models', [
    ['According to Freud, which part of the personality operates on the reality principle?', 'Ego', ['Id', 'Superego', 'Ego ideal', 'Libido'], 'The ego seeks realistic ways to meet the id’s needs.'],
    ['A client begins treating the therapist like her critical father. Psychodynamic therapists call this', 'transference', ['resistance', 'catharsis', 'free association', 'modeling'], 'Transference is acting toward the therapist as toward important figures from one’s past.'],
    ['Unconditional positive regard, accurate empathy and genuineness are the core of', 'client-centered therapy (Rogers)', ['gestalt therapy', 'psychoanalysis', 'rational-emotive therapy', 'family systems therapy'], 'Rogers’s client-centered therapy rests on those three conditions.'],
    ['A child gets extra attention every time he throws a tantrum, and the tantrums increase. This is', 'operant conditioning', ['classical conditioning', 'modeling', 'transference', 'a defense mechanism'], 'Behavior strengthened by its consequences (attention) is operant conditioning.'],
    ['The diathesis–stress model says a disorder develops when', 'a predisposition is combined with a triggering stressor', ['stress alone is severe enough', 'genes alone are present', 'parents are critical', 'the id overwhelms the ego'], 'Diathesis (vulnerability) plus stress produces the disorder.'],
    ['Acceptance and commitment therapy (ACT) belongs to', 'the new wave of cognitive-behavioral therapies', ['psychodynamic therapy', 'the biological model', 'existential therapy', 'sociocultural community treatment'], 'ACT teaches acceptance of thoughts and is part of the CBT new wave.'],
    ['Tertiary prevention in community mental health means', 'providing effective treatment once a disorder is established', ['preventing problems before they start', 'identifying problems early', 'screening newborns', 'changing laws'], 'Primary prevents, secondary catches early, tertiary treats established problems.'],
    ['Which model would most likely explain depression by low serotonin activity?', 'The biological model', ['The psychodynamic model', 'The humanistic model', 'The existential model', 'The sociocultural model'], 'Neurotransmitter explanations belong to the biological model.'],
    ['Family systems theory views a person’s symptoms as', 'part of a family’s structure and communication patterns', ['caused by unconscious drives', 'purely biological', 'a failure to self-actualize', 'learned only through modeling'], 'It treats the family as the system that maintains the problem.']
  ]);
  const qAssessment = bank('assessment', [
    ['A test that gives similar scores to the same person on two occasions has good', 'test-retest reliability', ['predictive validity', 'face validity', 'interrater reliability', 'content validity'], 'Consistency over time is test-retest reliability.'],
    ['A test “looks like” it measures depression but has never been checked against other measures. It has only', 'face validity', ['predictive validity', 'concurrent validity', 'test-retest reliability', 'standardization'], 'Face validity means it appears valid; that alone is weak evidence.'],
    ['The Rorschach inkblot test is an example of', 'a projective test', ['a personality inventory', 'a neuropsychological test', 'a response inventory', 'a structured interview'], 'Projective tests ask people to interpret ambiguous stimuli.'],
    ['The MMPI is best described as', 'a personality inventory with clinical and validity scales', ['a projective test', 'an intelligence test', 'a brain-imaging test', 'an unstructured interview'], 'It is the most widely used personality inventory.'],
    ['People behaving differently because they know they are being observed is called', 'reactivity', ['observer drift', 'transference', 'standardization', 'resistance'], 'Reactivity is a known limitation of observation and self-monitoring.'],
    ['Which statement about reliability and validity is true?', 'A test must be reliable to be valid, but a reliable test is not necessarily valid', ['A valid test can be unreliable', 'Reliability and validity mean the same thing', 'Face validity guarantees accuracy', 'Projective tests have the highest reliability'], 'Reliability is necessary but not sufficient for validity.'],
    ['The classification system used by most US clinicians today is', 'the DSM-5-TR', ['the ICD-6', 'the MMPI-3', 'the Rorschach system', 'the DSM-III'], 'The DSM-5-TR was published in 2022; the WHO’s ICD-11 is used in much of the world.'],
    ['The rapprochement movement in therapy research looks for', 'common factors shared by all effective therapies', ['the single best therapy for everyone', 'biological causes only', 'ways to avoid diagnosis', 'new projective tests'], 'It seeks what successful therapies have in common.'],
    ['Two clinicians independently give the same diagnosis to the same client. This shows', 'interrater reliability', ['predictive validity', 'test-retest reliability', 'concurrent validity', 'reactivity'], 'Agreement between judges is interrater reliability.']
  ]);
  const qAnxiety = bank('anxiety', [
    ['The minimum duration for generalized anxiety disorder is', '6 months', ['2 weeks', '1 month', '2 years', '3 days'], 'Worry more days than not for at least 6 months.'],
    ['What separates panic disorder from having a panic attack?', 'Recurrent unexpected attacks plus at least a month of worry or behavior change', ['Having any panic attack', 'Attacks that occur only during phobic situations', 'Attacks lasting more than an hour', 'A family history of panic'], 'Panic attacks can occur in many disorders; panic disorder needs the persistent concern.'],
    ['The most effective treatment for specific phobias is', 'exposure therapy', ['free association', 'benzodiazepines alone', 'client-centered therapy', 'ECT'], 'Exposure (desensitization, flooding, modeling) has the strongest support.'],
    ['Exposure and response prevention is the leading psychological treatment for', 'obsessive-compulsive disorder', ['bipolar disorder', 'schizophrenia', 'illness anxiety disorder', 'dependent personality disorder'], 'ERP exposes the person to obsessions while blocking compulsions.'],
    ['In DSM-5-TR, obsessive-compulsive disorder is placed', 'in its own chapter of obsessive-compulsive and related disorders', ['with the anxiety disorders', 'with the personality disorders', 'with the trauma disorders', 'with the somatic disorders'], 'OCD moved to its own chapter in DSM-5.'],
    ['Agoraphobia involves fear of', 'situations where escape or help might be difficult', ['one specific animal', 'being judged while speaking', 'germs and contamination', 'gaining weight'], 'Fear of at least two of five situation types (crowds, transit, open or enclosed spaces, being outside alone).'],
    ['Benzodiazepines reduce anxiety mainly by', 'enhancing GABA activity', ['blocking dopamine', 'increasing serotonin reuptake', 'lowering cortisol directly', 'blocking norepinephrine synthesis'], 'Benzodiazepines boost GABA’s inhibitory effect.'],
    ['Hoarding disorder is grouped with', 'obsessive-compulsive and related disorders', ['eating disorders', 'personality disorders', 'psychotic disorders', 'substance disorders'], 'Hoarding, body dysmorphic disorder, trichotillomania and excoriation are OCD-related.'],
    ['A cognitive explanation of panic disorder says people', 'misinterpret normal body sensations as signs of catastrophe', ['have too little dopamine', 'repress sexual urges', 'lack social support', 'were raised by cold parents'], 'Anxiety sensitivity and catastrophic misreading of sensations drive the panic cycle.']
  ]);
  const qTrauma = bank('trauma', [
    ['Symptoms that begin after a trauma and last 2 weeks fit', 'acute stress disorder', ['PTSD', 'adjustment disorder', 'panic disorder', 'no diagnosis possible'], 'Acute stress disorder covers 3 days to 1 month.'],
    ['Which is <b>not</b> one of the four PTSD symptom clusters?', 'Psychotic symptoms', ['Intrusion', 'Avoidance', 'Negative changes in thinking and mood', 'Arousal and reactivity'], 'The four clusters are intrusion, avoidance, negative cognition/mood and arousal/reactivity.'],
    ['The HPA axis releases which stress hormone?', 'Cortisol', ['Dopamine', 'Melatonin', 'Oxytocin', 'Serotonin'], 'Hypothalamus → pituitary → adrenal glands → cortisol.'],
    ['Research on psychological debriefing right after a disaster finds that it', 'does not prevent PTSD and may sometimes worsen symptoms', ['prevents PTSD in most people', 'is required by the DSM', 'works only for children', 'is the same as prolonged exposure'], 'Controlled studies have not shown it prevents PTSD.'],
    ['Which event would <b>not</b> qualify as a trauma for a PTSD diagnosis?', 'A painful breakup', ['A serious car crash', 'Witnessing a violent death', 'Sexual assault', 'Combat exposure'], 'PTSD requires actual or threatened death, serious injury or sexual violence; a breakup could lead to adjustment disorder.'],
    ['Adjustment disorder symptoms must begin within', '3 months of the stressor', ['1 week', '6 months', '2 years', '1 month'], 'It covers distress out of proportion to an ordinary stressor, starting within 3 months.'],
    ['Which treatment has strong evidence for PTSD?', 'Prolonged exposure or cognitive processing therapy', ['Psychoanalysis', 'Token economy', 'Lithium', 'Sensate focus'], 'Trauma-focused CBT (and EMDR) has the best support.'],
    ['PTSD “with delayed expression” means', 'full criteria are not met until at least 6 months after the event', ['symptoms last less than a month', 'the trauma was witnessed on TV', 'symptoms appear only in children', 'the person has no memory of the trauma'], 'Some people meet full criteria only months later.']
  ]);

  /* trauma timing generator */
  function qTraumaTiming() {
    const k = pick([['1 day', 'No diagnosis yet: a normal early reaction (acute stress disorder starts at 3 days)'], [`${ri(4, 9)} days`, 'Acute stress disorder'], [`${ri(2, 3)} weeks`, 'Acute stress disorder'], [`${ri(6, 12)} weeks`, 'PTSD'], [`${ri(4, 10)} months`, 'PTSD']]);
    const opts = ['No diagnosis yet: a normal early reaction (acute stress disorder starts at 3 days)', 'Acute stress disorder', 'PTSD', 'Adjustment disorder'];
    return mc('trauma', `After surviving a building fire, a man has nightmares, avoids the neighborhood, feels numb and startles easily. The symptoms have lasted <b>${k[0]}</b>. Which diagnosis fits best?`, k[1], opts.filter(o => o !== k[1]), 'Timing after the trauma decides it: under 3 days is an expected reaction, 3 days to 1 month is acute stress disorder, more than 1 month is PTSD. Adjustment disorder is for stressors that are not traumatic.', 'Convert the time to days or months and use 3 days and 1 month as the cut-offs.');
  }

  /* ---------- Unit 2 ---------- */
  const qDepression = bank('depression', [
    ['How many of the nine symptoms, and for how long, are needed for a major depressive episode?', '5 or more for 2 weeks, including depressed mood or loss of interest', ['3 or more for 1 month', '5 or more for 6 months', '2 or more for 2 years', 'Any 4 for 1 week'], 'Five of nine over the same 2 weeks, one of which is depressed mood or anhedonia.'],
    ['Persistent depressive disorder in adults requires depressed mood for at least', '2 years', ['2 weeks', '6 months', '1 year', '5 years'], 'Two years in adults, one year in children and adolescents.'],
    ['Beck’s cognitive triad consists of negative views of', 'the self, the world (experiences) and the future', ['the past, present and future', 'parents, peers and teachers', 'body, mind and spirit', 'work, love and play'], 'Beck: negative self, world and future.'],
    ['Seligman’s learned helplessness theory says depression develops when people believe', 'they have no control over the reinforcements in their lives', ['they lost a loved object in childhood', 'their serotonin is too high', 'they are more attractive than others', 'others envy them'], 'Perceived lack of control leads to helplessness and depression.'],
    ['Which antidepressant class is most prescribed today?', 'Selective serotonin reuptake inhibitors (SSRIs)', ['MAO inhibitors', 'Benzodiazepines', 'First-generation antipsychotics', 'Stimulants'], 'SSRIs such as fluoxetine and sertraline are the most common.'],
    ['ECT today is used mainly for', 'severe or treatment-resistant depression', ['mild anxiety', 'ADHD', 'specific phobias', 'personality disorders'], 'ECT is effective for severe depression and is given under anesthesia.'],
    ['Lewinsohn’s behavioral theory links depression to', 'a drop in the rewards in a person’s life', ['too much dopamine', 'an overactive superego', 'expressed emotion', 'self-actualization'], 'Fewer rewards → less activity → fewer rewards.'],
    ['Interpersonal psychotherapy (IPT) for depression focuses on', 'interpersonal problems such as grief, role disputes and role transitions', ['unconscious drives from childhood', 'exposure to feared objects', 'lithium levels', 'token rewards'], 'IPT targets current relationship problems.'],
    ['Nolen-Hoeksema’s research links a longer and more severe depression to', 'rumination', ['distraction', 'exposure', 'sensate focus', 'expressed emotion'], 'Repeatedly dwelling on one’s mood prolongs depression.']
  ]);
  /* mood episode generator: count symptoms and weeks */
  function qMoodEpisode() {
    const sy = ['depressed mood', 'loss of interest in almost everything', 'weight gain', 'insomnia', 'fatigue', 'feelings of worthlessness', 'trouble concentrating', 'slowed movements'];
    const kind = pick(['meets', 'meets', 'few', 'short']); const n = kind === 'few' ? ri(3, 4) : ri(5, 6), wks = kind === 'short' ? 1 : pick([2, 3, 6]); const list = ['depressed mood'].concat(shuffle(sy.slice(1)).slice(0, n - 1));
    const meets = n >= 5 && wks >= 2;
    const correct = meets ? 'Yes: 5 or more symptoms, including depressed mood, for at least 2 weeks' : n < 5 ? `No: only ${n} symptoms (5 are needed)` : 'No: symptoms have not lasted 2 weeks';
    return mc('depression', `For the past <b>${wks} week${wks === 1 ? '' : 's'}</b> a student has had: ${list.join(', ')}. Does this meet criteria for a major depressive episode?`, correct, ['Yes: 5 or more symptoms, including depressed mood, for at least 2 weeks', `No: only ${n} symptoms (5 are needed)`, 'No: symptoms have not lasted 2 weeks', 'No: symptoms must last 2 years'].filter(o => o !== correct), `${n} symptom${n === 1 ? '' : 's'} listed, for ${wks} week${wks === 1 ? '' : 's'}. A major depressive episode needs 5 or more (one being depressed mood or loss of interest) over the same 2 weeks.`, 'Count the symptoms, then check the 2-week rule.');
  }
  const qBipolar = bank('bipolar', [
    ['Bipolar I disorder requires', 'at least one manic episode', ['at least one hypomanic and one depressive episode', 'two years of mood swings', 'psychotic symptoms', 'a major depressive episode'], 'One manic episode is enough; depression is common but not required.'],
    ['A hypomanic episode lasts at least', '4 days', ['1 day', '1 week', '2 weeks', '1 month'], 'Hypomania: 4 days without marked impairment. Mania: 1 week.'],
    ['Cyclothymic disorder involves', 'at least 2 years of hypomanic and depressive symptoms that never meet full episode criteria', ['one manic episode', 'a single hypomanic episode', 'depression lasting 2 weeks', 'psychosis without mood symptoms'], 'Two years in adults (one in youth).'],
    ['The classic mood stabilizer, which requires blood monitoring, is', 'lithium', ['fluoxetine', 'diazepam', 'methylphenidate', 'clozapine'], 'Lithium levels must be monitored because the therapeutic and toxic ranges are close.'],
    ['Why can an antidepressant alone be risky in bipolar disorder?', 'It can trigger a manic episode', ['It always causes tardive dyskinesia', 'It blocks dopamine', 'It has no effect on mood', 'It is addictive like opioids'], 'Mood stabilizers are the foundation of treatment.'],
    ['Which feature separates mania from hypomania?', 'Mania causes marked impairment, hospitalization or psychosis', ['Hypomania involves elevated mood', 'Mania never involves irritability', 'Hypomania must last 2 weeks', 'Mania occurs only in bipolar II'], 'Severity and duration separate them.'],
    ['Compared with most disorders, bipolar disorders are', 'among the most heritable', ['never genetic', 'caused mainly by parenting', 'more common in children than adults', 'the same as borderline personality disorder'], 'Twin studies show strong genetic contributions.']
  ]);
  function qBipolarEpisode() {
    const c = pick([
      { days: ri(5, 6), hosp: false, impair: false, pastDep: true, ans: 'Bipolar II disorder' },
      { days: ri(8, 12), hosp: false, impair: true, pastDep: false, ans: 'Bipolar I disorder' },
      { days: ri(2, 4), hosp: true, impair: true, pastDep: false, ans: 'Bipolar I disorder' },
      { days: ri(5, 6), hosp: false, impair: false, pastDep: false, ans: 'Not yet bipolar II: hypomania alone, with no major depressive episode' }
    ]);
    const story = `For <b>${c.days} days</b> Alex has slept 3 hours a night, talked rapidly, felt unusually confident and started several big projects.${c.hosp ? ' The family took him to the hospital, where he was admitted.' : c.impair ? ' He was fired after erratic behavior at work.' : ' Friends noticed the change, but he kept up with work and classes.'}${c.pastDep ? ' Last year he had a major depressive episode.' : ' He has never had a major depressive episode.'} Which fits best?`;
    return mc('bipolar', story, c.ans, ['Bipolar I disorder', 'Bipolar II disorder', 'Cyclothymic disorder', 'Not yet bipolar II: hypomania alone, with no major depressive episode'].filter(o => o !== c.ans), 'Decide the episode first: mania needs 1 week (or hospitalization) and marked impairment; hypomania needs 4 days without marked impairment. One manic episode means bipolar I; hypomania plus a past major depression means bipolar II.', 'Classify the episode (manic or hypomanic) before choosing the disorder.');
  }
  const qSuicide = bank('suicide', [
    ['In Durkheim’s theory, suicide after a sudden economic collapse is', 'anomic', ['egoistic', 'altruistic', 'fatalistic only', 'subintentional'], 'Anomic suicide follows sudden social disruption.'],
    ['In Durkheim’s theory, suicide by a person with few ties to family or community is', 'egoistic', ['anomic', 'altruistic', 'a death initiator', 'a death darer'], 'Egoistic suicide reflects weak social connection.'],
    ['Shneidman’s “death darers” are people who', 'are ambivalent about dying and take risks that could end their lives', ['clearly intend to die', 'believe death is not the end', 'believe they are speeding up an inevitable death', 'play no role in their death'], 'Darers gamble with death, such as playing Russian roulette.'],
    ['A terminally ill patient ends her life believing she is only hastening an inevitable death. Shneidman calls this a', 'death initiator', ['death seeker', 'death ignorer', 'death darer', 'anomic suicide'], 'Death initiators believe the process of death is already under way.'],
    ['Which is true about asking someone whether they are thinking of suicide?', 'Asking directly does not plant the idea and can open the door to help', ['It increases the risk', 'Only professionals may ask', 'It should never be done', 'It is illegal without consent'], 'Direct questions are a key part of prevention.'],
    ['Which is a well-established risk factor for suicide?', 'A previous suicide attempt', ['Being married', 'Having a religious affiliation', 'Regular exercise', 'Strong social support'], 'A prior attempt is one of the strongest predictors.'],
    ['The US number to call or text in a suicidal crisis is', '988', ['411', '311', '211', '511'], '988 connects to the Suicide & Crisis Lifeline.'],
    ['Which therapy has strong evidence for reducing suicidal behavior in people with borderline personality disorder?', 'Dialectical behavior therapy', ['Psychoanalysis', 'Sensate focus', 'Token economy', 'Hypnosis'], 'DBT reduces self-harm and suicide attempts.'],
    ['Why do men in the US die by suicide more often than women even though women attempt more often?', 'Men more often use highly lethal methods such as firearms', ['Men are always more depressed', 'Women never use lethal methods', 'Men are more likely to seek therapy', 'Durkheim proved it'], 'Differences in method lethality explain much of the gap.']
  ]);
  const qSomatic = bank('somatic', [
    ['Faking illness to collect insurance money is', 'malingering', ['factitious disorder', 'conversion disorder', 'illness anxiety disorder', 'somatic symptom disorder'], 'An external reward makes it malingering, which is not a mental disorder.'],
    ['Faking or inducing illness to take on the sick role, with no external reward, is', 'factitious disorder', ['malingering', 'conversion disorder', 'hypochondriasis only', 'psychophysiological disorder'], 'The motive is the patient role itself.'],
    ['Glove anesthesia is a clue that a symptom is part of', 'conversion disorder (functional neurological symptom disorder)', ['a stroke', 'factitious disorder', 'illness anxiety disorder', 'a psychophysiological disorder'], 'The numbness does not follow the arm’s nerve pathways.'],
    ['A person with few symptoms who is convinced she has cancer despite normal tests, for 8 months, most likely has', 'illness anxiety disorder', ['somatic symptom disorder', 'conversion disorder', 'factitious disorder', 'malingering'], 'Illness anxiety centers on fear of disease with few or no symptoms.'],
    ['Stress-related hypertension or ulcers are examples of', 'psychophysiological disorders', ['conversion disorders', 'factitious disorders', 'malingering', 'dissociative disorders'], 'Real physical illness worsened by psychological factors.'],
    ['In the psychodynamic view of conversion, “secondary gain” refers to', 'benefits the symptom brings, such as avoiding unpleasant duties or getting attention', ['keeping internal conflicts out of awareness', 'a financial reward from faking', 'a second symptom', 'a medical side effect'], 'Primary gain keeps conflict unconscious; secondary gain is outside benefit.'],
    ['Which treatment approach is used for illness anxiety?', 'Exposure and response prevention, blocking checking and reassurance-seeking', ['Antipsychotic medication', 'ECT', 'Sensate focus', 'Lithium'], 'Reassurance and checking maintain the anxiety.']
  ]);
  const qEating = bank('eating', [
    ['Which feature is required for anorexia nervosa but not bulimia nervosa?', 'Significantly low body weight', ['Binge eating', 'Self-worth tied to body shape', 'Compensatory behavior', 'Weekly frequency for 3 months'], 'Low weight defines anorexia; people with bulimia are usually near normal weight.'],
    ['Bulimia nervosa requires binges and compensatory behaviors at least', 'once a week for 3 months', ['twice a week for 6 months', 'daily for 1 month', 'once a month for a year', 'once a week for 2 weeks'], 'The DSM-5-TR frequency is weekly for 3 months.'],
    ['Binge-eating disorder differs from bulimia because it has', 'no regular compensatory behavior', ['no binges', 'low body weight', 'only restricting', 'a 6-month duration'], 'Binges without compensation.'],
    ['The treatment with the strongest support for adolescents with anorexia is', 'family-based treatment (the Maudsley approach)', ['psychoanalysis', 'antipsychotics', 'ECT', 'individual gestalt therapy'], 'Parents take charge of refeeding at first.'],
    ['CBT is the leading treatment for', 'bulimia nervosa and binge-eating disorder', ['schizophrenia only', 'ADHD', 'conversion disorder', 'catatonia'], 'CBT targets binge-purge cycles and beliefs about shape and weight.'],
    ['Which eating disorder has the highest mortality rate?', 'Anorexia nervosa', ['Binge-eating disorder', 'Bulimia nervosa', 'ARFID', 'Pica'], 'Starvation and suicide make anorexia the deadliest.'],
    ['Hilde Bruch’s theory of eating disorders emphasized', 'ineffective parenting and children’s poor awareness of their own needs', ['excess dopamine', 'a genetic mutation', 'expressed emotion', 'operant rewards for vomiting'], 'Bruch combined psychodynamic and cognitive ideas.'],
    ['ARFID differs from anorexia because it involves', 'restricted eating without fear of weight gain or body-image disturbance', ['binges with vomiting', 'a normal diet', 'only adults', 'a 2-year duration'], 'Avoidant/restrictive food intake disorder stems from sensory issues, fear of choking or low interest.']
  ]);
  function qBmi() {
    const h = pick([1.55, 1.60, 1.65, 1.70, 1.75, 1.80]); const w = Math.round((13.6 + Math.random() * 4.6) * h * h); const bmi = w / (h * h); const b = Math.round(bmi * 10) / 10;   // weight keeps the BMI in the underweight range an anorexia diagnosis needs
    if (ri(0, 1) === 0) return num('eating', `An adult with anorexia nervosa is ${h.toFixed(2)} m tall and weighs ${w} kg. What is the BMI? (one decimal)`, b, `BMI = kg ÷ m² = ${w} ÷ ${h.toFixed(2)}² = ${w} ÷ ${(h * h).toFixed(4)} ≈ ${bmi.toFixed(2)}.`, 'Square the height in meters first.', 0.15);
    const sev = bmi >= 17 ? 'Mild' : bmi >= 16 ? 'Moderate' : bmi >= 15 ? 'Severe' : 'Extreme';
    return mc('eating', `An adult with anorexia nervosa is ${h.toFixed(2)} m tall and weighs ${w} kg. What severity does DSM-5-TR assign?`, sev, ['Mild', 'Moderate', 'Severe', 'Extreme'].filter(x => x !== sev), `BMI = ${w} ÷ ${h.toFixed(2)}² ≈ ${bmi.toFixed(2)}. Cut-offs: mild ≥ 17, moderate 16–16.99, severe 15–15.99, extreme < 15, so this is ${sev.toLowerCase()}.`, 'Compute BMI, then use the cut-offs 17, 16 and 15.');
  }
  const qSubstance = bank('substance', [
    ['A person meets 3 substance use disorder criteria. The severity is', 'mild', ['moderate', 'severe', 'no diagnosis', 'extreme'], 'Mild 2–3, moderate 4–5, severe 6+.'],
    ['Alcohol is classified as a', 'depressant', ['stimulant', 'hallucinogen', 'opioid', 'cannabinoid'], 'It slows the central nervous system and enhances GABA.'],
    ['Methadone treats opioid use disorder by', 'acting as a longer-lasting agonist at the same receptors (agonist substitution)', ['blocking all opioid receptors', 'causing nausea when drinking', 'reversing an overdose instantly', 'increasing dopamine reuptake'], 'Agonist substitution replaces a dangerous drug with a safer one.'],
    ['Naloxone is used to', 'reverse an opioid overdose', ['treat alcohol withdrawal', 'treat ADHD', 'reduce cravings for nicotine', 'prevent Korsakoff’s syndrome'], 'It rapidly blocks opioid receptors.'],
    ['Korsakoff’s syndrome in heavy drinkers is linked to a deficiency of', 'thiamine (vitamin B1)', ['vitamin C', 'serotonin', 'iron', 'dopamine'], 'It causes severe memory problems and confabulation.'],
    ['Stimulants such as cocaine mainly increase the activity of', 'dopamine (and norepinephrine)', ['GABA', 'endorphins only', 'melatonin', 'acetylcholine only'], 'They block dopamine reuptake or increase its release.'],
    ['Which is the only non-substance addictive disorder officially in the DSM-5-TR?', 'Gambling disorder', ['Internet gaming disorder', 'Shopping addiction', 'Sex addiction', 'Social media addiction'], 'Internet gaming disorder is only a condition for further study.'],
    ['The brain area most tied to the rewarding effects of drugs is the', 'nucleus accumbens (dopamine reward pathway)', ['cerebellum', 'occipital lobe', 'medulla only', 'pineal gland'], 'Drugs of abuse increase dopamine in the reward pathway.'],
    ['Which two criteria are called pharmacological criteria?', 'Tolerance and withdrawal', ['Craving and hazardous use', 'Failed efforts and time spent', 'Social problems and giving up activities', 'Legal problems and arrests'], 'Legal problems are no longer a criterion in DSM-5.']
  ]);
  function qSudCount() {
    const all = ['taking more than intended', 'failed efforts to cut down', 'a lot of time spent getting or recovering from the drug', 'craving', 'failing obligations at work or school', 'continued use despite relationship problems', 'giving up important activities', 'use in physically hazardous situations', 'continued use despite knowing it causes harm', 'tolerance', 'withdrawal'];
    const n = ri(1, 8); const list = shuffle(all).slice(0, n); const sev = n <= 1 ? 'No diagnosis (fewer than 2 criteria)' : n <= 3 ? 'Mild' : n <= 5 ? 'Moderate' : 'Severe';
    return mc('substance', `Over the past year, a student’s cannabis use shows: ${list.join('; ')}. What is the substance use disorder severity?`, sev, ['No diagnosis (fewer than 2 criteria)', 'Mild', 'Moderate', 'Severe'].filter(x => x !== sev), `${n} criterion${n === 1 ? '' : 'a'} present. Severity: 2–3 mild, 4–5 moderate, 6 or more severe; fewer than 2 is no diagnosis.`, 'Count the criteria listed, then use 2–3 / 4–5 / 6+.');
  }
  const qTechnology = bank('technology', [
    ['A study finds that teens who use social media more report more anxiety. The strongest conclusion is that', 'the two are related, but the study cannot show that social media causes anxiety', ['social media causes anxiety', 'anxiety causes social media use', 'there is no relationship', 'the effect must be large'], 'Correlational data cannot establish cause or direction.'],
    ['Internet gaming disorder in DSM-5-TR is', 'a condition for further study in Section III, not an official diagnosis', ['an official substance use disorder', 'a type of OCD', 'a personality disorder', 'removed from all classification systems'], 'ICD-11 does include gaming disorder.'],
    ['A third variable that could explain a link between late-night phone use and depression is', 'poor sleep', ['the phone’s brand', 'the correlation coefficient', 'the sample size', 'random assignment'], 'Poor sleep could affect both phone use and mood.'],
    ['Large studies of screen time and adolescent well-being generally find', 'small average associations', ['very large harmful effects', 'no data at all', 'only positive effects', 'effects identical for every activity'], 'Effect sizes are usually small, and depend on how technology is used.'],
    ['Which study design could best test whether social media use causes lower mood?', 'An experiment that randomly assigns people to reduce or keep their use', ['A single case study', 'A cross-sectional survey', 'A correlational study with more participants', 'An anonymous poll'], 'Random assignment is needed to infer cause.'],
    ['Which is an example of technology used in treatment?', 'Virtual-reality exposure therapy for phobias', ['Trephination', 'Moral treatment', 'Insulin coma therapy', 'Lobotomy'], 'VR, telehealth and internet-delivered CBT are modern examples.']
  ]);
  const qSexual = bank('sexual', [
    ['The phases of the sexual response cycle are', 'desire, excitement, orgasm, resolution', ['arousal, plateau, climax, rest', 'desire, pain, orgasm, relief', 'attraction, dating, intimacy, commitment', 'excitement, orgasm, desire, resolution'], 'Masters and Johnson plus Kaplan’s desire phase.'],
    ['Erectile disorder is a dysfunction of the', 'excitement (arousal) phase', ['desire phase', 'orgasm phase', 'resolution phase', 'pain category'], 'It involves difficulty getting or keeping an erection.'],
    ['Sensate focus is designed to', 'reduce performance anxiety through non-demand touching', ['treat paraphilic disorders with aversion', 'change gender identity', 'measure arousal in a lab', 'replace medication for all dysfunctions'], 'Couples touch without pressure to perform.'],
    ['A paraphilia becomes a paraphilic disorder when it', 'causes distress or impairment, or involves harm or risk of harm to others', ['is unusual', 'is practiced privately', 'involves consenting adults only', 'begins in adolescence'], 'An unusual interest alone is not a disorder.'],
    ['DSM-5-TR’s gender dysphoria diagnosis centers on', 'distress from incongruence between experienced and assigned gender', ['being transgender itself', 'sexual orientation', 'cross-dressing', 'a paraphilia'], 'Gender variance itself is not a disorder.'],
    ['Which medication treats erectile disorder?', 'Sildenafil (Viagra)', ['Lithium', 'Haloperidol', 'Naltrexone', 'Methylphenidate'], 'It increases blood flow to the penis.'],
    ['Taking the “spectator role” during sex refers to', 'watching and judging one’s own performance, which increases anxiety', ['watching others', 'a paraphilic disorder', 'a treatment step', 'a phase of the cycle'], 'Masters and Johnson linked it to performance anxiety.']
  ]);

  /* ---------- Unit 3 ---------- */
  const qSchizophrenia = bank('schizophrenia', [
    ['Which is a negative symptom of schizophrenia?', 'Alogia (poverty of speech)', ['Hallucinations', 'Delusions of grandeur', 'Loose associations', 'Neologisms'], 'Negative symptoms are deficits: alogia, flat affect, avolition, withdrawal.'],
    ['Believing that TV news anchors are sending you personal messages is a delusion of', 'reference', ['grandeur', 'control', 'persecution', 'nihilism'], 'Delusions of reference attach personal meaning to unrelated events.'],
    ['The most common type of hallucination in schizophrenia is', 'auditory', ['visual', 'tactile', 'olfactory', 'gustatory'], 'Hearing voices is most common.'],
    ['The dopamine hypothesis is supported by the finding that', 'antipsychotics block D2 receptors and amphetamines can worsen symptoms', ['SSRIs cure schizophrenia', 'dopamine is absent in schizophrenia', 'benzodiazepines are first-line', 'lithium always works'], 'Dopamine blockers reduce positive symptoms.'],
    ['High expressed emotion in families is associated with', 'higher relapse rates', ['causing schizophrenia', 'better outcomes', 'fewer hospitalizations', 'negative symptoms only'], 'Criticism and hostility predict relapse, not onset.'],
    ['Schizophrenia is roughly how common over a lifetime?', 'About 1 in 100 people', ['About 1 in 5', 'About 1 in 10', 'About 1 in 10,000', 'About 1 in 1 million'], 'Lifetime prevalence is close to 1%.'],
    ['Schizoaffective disorder combines', 'a major mood episode with schizophrenia symptoms, plus 2 weeks of psychosis without mood symptoms', ['OCD with psychosis', 'mania with anxiety', 'dementia with delusions', 'depression with panic'], 'Psychosis must also occur alone for at least 2 weeks.'],
    ['Enlarged ventricles in some people with schizophrenia suggest', 'reduced surrounding brain tissue', ['too much dopamine', 'expressed emotion', 'good response to antipsychotics', 'a viral cure'], 'Larger ventricles mean less tissue around them.'],
    ['“Split personality” describes', 'dissociative identity disorder, not schizophrenia', ['paranoid schizophrenia', 'catatonia', 'negative symptoms', 'schizoaffective disorder'], 'Schizophrenia is a split from reality, not multiple personalities.']
  ]);
  function qPsychosisLadder() {
    const c = pick([[`${ri(2, 20)} days`, 'Brief psychotic disorder'], [`${ri(5, 15)} weeks`, 'Schizophreniform disorder'], [`${ri(2, 5)} months`, 'Schizophreniform disorder'], [`${ri(7, 24)} months`, 'Schizophrenia']]);
    return mc('schizophrenia', `A young man has had hallucinations, delusions and disorganized speech for <b>${c[0]}</b> (with no mood episode and no substance cause). Which diagnosis fits right now?`, c[1], ['Brief psychotic disorder', 'Schizophreniform disorder', 'Schizophrenia', 'Delusional disorder'].filter(x => x !== c[1]), 'Duration ladder: at least 1 day but under 1 month is brief psychotic disorder, 1 to 6 months is schizophreniform, 6 months or more is schizophrenia. Delusional disorder has delusions without the other psychotic symptoms.', 'Convert the time to months and use 1 and 6 as the cut-offs.');
  }
  function qSymptomType() {
    const S = [['hearing a voice comment on his actions', 'Positive'], ['believing aliens control her thoughts', 'Positive'], ['inventing new words (neologisms)', 'Positive'], ['speaking very little (alogia)', 'Negative'], ['showing almost no facial expression', 'Negative'], ['losing motivation to start any task (avolition)', 'Negative'], ['withdrawing from all social contact', 'Negative'], ['holding a rigid pose for hours (catatonic stupor)', 'Psychomotor'], ['laughing while describing a tragedy', 'Positive']];
    const [s, t] = pick(S);
    return mc('schizophrenia', `In schizophrenia, <b>${s}</b> is which kind of symptom?`, t, ['Positive', 'Negative', 'Psychomotor', 'Not a schizophrenia symptom'].filter(x => x !== t), 'Positive symptoms are excesses or distortions (hallucinations, delusions, disordered thought, inappropriate affect); negative symptoms are deficits; psychomotor symptoms include catatonia.', 'Is something added, something missing, or a movement disturbance?');
  }
  const qPsychosisTx = bank('psychosis-tx', [
    ['Tardive dyskinesia is', 'involuntary movements caused by long-term first-generation antipsychotic use', ['a symptom of mania', 'a side effect of SSRIs', 'a negative symptom', 'withdrawal from alcohol'], 'It can be permanent.'],
    ['Which antipsychotic requires regular blood tests because of the risk of agranulocytosis?', 'Clozapine', ['Haloperidol', 'Chlorpromazine', 'Lithium', 'Fluoxetine'], 'Clozapine helps treatment-resistant patients but needs monitoring.'],
    ['A major drawback of second-generation antipsychotics is', 'weight gain and metabolic problems', ['no effect on positive symptoms', 'guaranteed tardive dyskinesia', 'addiction', 'they only work in children'], 'They cause fewer movement effects but more metabolic effects.'],
    ['The token economy in hospitals used', 'operant rewards for desired behaviors', ['free association', 'ECT', 'antipsychotics', 'family therapy'], 'Tokens earned for behaviors could be exchanged for privileges.'],
    ['Assertive community treatment provides', 'a team that brings treatment, housing and job support into the community', ['long-term locked hospitalization', 'psychoanalysis', 'only medication by mail', 'a one-time crisis call'], 'ACT is intensive outreach care.'],
    ['Family psychoeducation for schizophrenia mainly reduces', 'relapse, partly by lowering expressed emotion', ['the risk of developing schizophrenia', 'the need for any medication', 'IQ loss', 'tardive dyskinesia'], 'Informed, less critical families reduce relapse.'],
    ['Chlorpromazine and haloperidol are', 'first-generation antipsychotics', ['second-generation antipsychotics', 'SSRIs', 'mood stabilizers', 'stimulants'], 'Conventional antipsychotics that block D2 receptors.'],
    ['A downside of deinstitutionalization was that', 'many people ended up homeless or in jail when community care was underfunded', ['hospitals became more crowded', 'antipsychotics stopped working', 'fewer people received medication', 'moral treatment returned'], 'Community services often failed to follow.']
  ]);
  const qNarcissism = bank('narcissism', [
    ['Narcissistic personality disorder belongs to which cluster?', 'Cluster B', ['Cluster A', 'Cluster C', 'It is not a personality disorder', 'Cluster D'], 'Cluster B: dramatic, emotional, erratic.'],
    ['Which is a feature of narcissistic personality disorder?', 'A sense of entitlement and lack of empathy', ['Fear of abandonment and self-harm', 'Odd magical beliefs', 'Extreme need to be taken care of', 'Perfectionism about rules'], 'Entitlement and low empathy are core features.'],
    ['Vulnerable narcissism is marked by', 'defensiveness, hypersensitivity and hidden grandiosity', ['open boasting and dominance', 'no self-focus at all', 'psychotic delusions', 'compulsive rituals'], 'Vulnerable narcissists appear insecure.'],
    ['The Narcissistic Personality Inventory mainly measures', 'narcissism as a normal personality trait', ['psychotic symptoms', 'IQ', 'eating disorder severity', 'suicide risk'], 'It is used in research on trait narcissism.'],
    ['People with narcissistic personality disorder usually seek therapy for', 'depression or relationship problems rather than narcissism itself', ['their grandiosity', 'psychosis', 'substance withdrawal only', 'ADHD'], 'They rarely see narcissism as the problem.'],
    ['How many of the nine features are needed for narcissistic personality disorder?', '5', ['3', '2', '7', 'All 9'], 'Five or more, as a pervasive pattern from early adulthood.']
  ]);
  const qPersonality = bank('personality', [
    ['Which personality disorders make up Cluster A?', 'Paranoid, schizoid, schizotypal', ['Antisocial, borderline, histrionic', 'Avoidant, dependent, obsessive-compulsive', 'Narcissistic, paranoid, dependent', 'Schizoid, avoidant, borderline'], 'Cluster A is odd or eccentric.'],
    ['Antisocial personality disorder can be diagnosed only if the person is at least', '18, with evidence of conduct disorder before 15', ['12', '15', '21', '25'], 'Under 18, conduct disorder is diagnosed.'],
    ['Instability in relationships, self-image and mood, with fear of abandonment and self-harm, describes', 'borderline personality disorder', ['histrionic personality disorder', 'schizotypal personality disorder', 'avoidant personality disorder', 'dependent personality disorder'], 'Borderline is Cluster B.'],
    ['Dialectical behavior therapy was developed by', 'Marsha Linehan', ['Aaron Beck', 'Carl Rogers', 'Albert Ellis', 'Otto Kernberg'], 'DBT is the best-supported treatment for borderline personality disorder.'],
    ['A man avoids jobs with social contact because he fears criticism and feels inadequate, though he wishes for friends. Which disorder?', 'Avoidant personality disorder', ['Schizoid personality disorder', 'Paranoid personality disorder', 'Dependent personality disorder', 'Antisocial personality disorder'], 'Avoidant people want relationships but fear rejection; schizoid people are indifferent.'],
    ['Obsessive-compulsive personality disorder differs from OCD because it involves', 'a pervasive style of perfectionism and control rather than true obsessions and compulsions', ['intrusive thoughts and rituals', 'psychotic symptoms', 'binge eating', 'fear of germs only'], 'OCPD is a personality pattern; OCD has obsessions and compulsions.'],
    ['Odd beliefs such as magical thinking, unusual perceptions and eccentric behavior suggest', 'schizotypal personality disorder', ['histrionic personality disorder', 'borderline personality disorder', 'avoidant personality disorder', 'narcissistic personality disorder'], 'Schizotypal is Cluster A and related to schizophrenia.'],
    ['Excessive emotionality and attention-seeking, often with dramatic, shallow emotions, describes', 'histrionic personality disorder', ['narcissistic personality disorder', 'dependent personality disorder', 'schizoid personality disorder', 'paranoid personality disorder'], 'Histrionic is Cluster B.']
  ]);
  function qCluster() {
    const D = [['Paranoid', 'Cluster A (odd, eccentric)'], ['Schizoid', 'Cluster A (odd, eccentric)'], ['Schizotypal', 'Cluster A (odd, eccentric)'], ['Antisocial', 'Cluster B (dramatic, emotional, erratic)'], ['Borderline', 'Cluster B (dramatic, emotional, erratic)'], ['Histrionic', 'Cluster B (dramatic, emotional, erratic)'], ['Narcissistic', 'Cluster B (dramatic, emotional, erratic)'], ['Avoidant', 'Cluster C (anxious, fearful)'], ['Dependent', 'Cluster C (anxious, fearful)'], ['Obsessive-compulsive', 'Cluster C (anxious, fearful)']];
    const [n, c] = pick(D);
    return mc('personality', `${n} personality disorder belongs to which cluster?`, c, ['Cluster A (odd, eccentric)', 'Cluster B (dramatic, emotional, erratic)', 'Cluster C (anxious, fearful)', 'It is not a personality disorder'].filter(x => x !== c), 'A: paranoid, schizoid, schizotypal. B: antisocial, borderline, histrionic, narcissistic. C: avoidant, dependent, obsessive-compulsive.', '“Weird, wild, worried” for A, B, C.');
  }
  const qChildhood = bank('childhood', [
    ['For an ADHD diagnosis, several symptoms must be present before age', '12', ['5', '7', '16', '18'], 'DSM-5 raised the age from 7 to 12.'],
    ['ADHD symptoms must appear in', 'two or more settings, such as home and school', ['school only', 'one setting', 'at least four settings', 'the doctor’s office'], 'Symptoms limited to one setting suggest another cause.'],
    ['The first-line medications for ADHD are', 'stimulants such as methylphenidate', ['antipsychotics', 'benzodiazepines', 'lithium', 'SSRIs only'], 'Stimulants improve attention and reduce hyperactivity for many children.'],
    ['The two core areas of autism spectrum disorder are', 'social communication deficits and restricted, repetitive behaviors or interests', ['hallucinations and delusions', 'inattention and hyperactivity', 'defiance and vindictiveness', 'low mood and irritability'], 'Severity is rated 1–3 by support needed.'],
    ['Which statement about vaccines and autism is accurate?', 'Large studies show no link, and the original claim was retracted', ['Vaccines cause most autism', 'The link is proven for some vaccines', 'Only the MMR vaccine causes autism', 'Autism is caused by cold parenting'], 'The 1998 paper was retracted and discredited.'],
    ['Repeatedly violating others’ rights, with aggression, property destruction and deceit, describes', 'conduct disorder', ['oppositional defiant disorder', 'ADHD', 'separation anxiety disorder', 'autism'], 'ODD is defiance and anger without the serious rule violations.'],
    ['Severity of intellectual developmental disorder in DSM-5-TR is based mainly on', 'adaptive functioning', ['IQ score alone', 'age of diagnosis', 'number of siblings', 'school grades'], 'Adaptive functioning in daily life sets the level.'],
    ['Enuresis refers to', 'repeated bed-wetting or wetting clothes past the age expected to be dry', ['soiling', 'fear of separation', 'hair pulling', 'refusal to eat'], 'Encopresis is the related soiling disorder.']
  ]);
  function qAdhdCount() {
    const age = pick([8, 10, 14, 17, 19, 25]); const n = ri(4, 7); const need = age >= 17 ? 5 : 6; const ok = n >= need;
    const ans = ok ? `Yes: ${n} symptoms meets the threshold of ${need}` : `No: ${n} symptoms is below the threshold of ${need}`;
    return mc('childhood', `A ${age}-year-old shows ${n} inattention symptoms at home and at school, lasting a year, with several present before age 12. Is the inattention symptom count enough for ADHD?`, ans, [`Yes: ${n} symptoms meets the threshold of ${need}`, `No: ${n} symptoms is below the threshold of ${need}`, `Yes: any ${Math.min(n, 3)} symptoms is enough`, `No: at least 9 symptoms are needed`].filter(x => x !== ans), `The threshold is 6 symptoms in a category for children under 17 and 5 for ages 17 and older. Here the person is ${age}, so ${need} are needed.`, 'Check the age first: 17 or older needs 5, younger needs 6.');
  }

  const GENERATORS = [qHistory, qModels, qAssessment, qAnxiety, qTrauma, qTraumaTiming, qDepression, qMoodEpisode, qBipolar, qBipolarEpisode, qSuicide, qSomatic, qEating, qBmi, qSubstance, qSudCount, qTechnology, qSexual, qSchizophrenia, qPsychosisLadder, qSymptomType, qPsychosisTx, qNarcissism, qPersonality, qCluster, qChildhood, qAdhdCount];
  const BY_TOPIC = {};
  for (const g of GENERATORS) { const t = g().topic; (BY_TOPIC[t] = BY_TOPIC[t] || []).push(g); }
  function topicsForUnits(units) { return Object.keys(TOPICS).filter(t => units.includes(TOPICS[t].unit)); }
  function generateSet(topics, n) {
    const pool = topics.filter(t => BY_TOPIC[t]); if (!pool.length) return []; const out = []; const order = shuffle(pool); let guard = 0;
    while (out.length < n && guard++ < n * 25) { const t = order[out.length % order.length]; let q; try { q = pick(BY_TOPIC[t])(); } catch (e) { continue; } if (!q || (q.type === 'mc' && q.options.length < 2)) continue; if (out.some(o => o.prompt === q.prompt)) continue; q.id = 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); out.push(q); }
    return out;
  }
  global.Courses = global.Courses || {}; global.Courses.psyx = global.Courses.psyx || {};
  global.Courses.psyx.quiz = { TOPICS, GENERATORS, BY_TOPIC, generateSet, topicsForUnits, helpers: { fmt: String, shuffle } };

  /* hint ladders: a way to think about it, the procedure, the nearly-there nudge */
  global.MathubLadders = global.MathubLadders || {};
  global.MathubLadders.psyx = {
    history: ['Place the idea on the timeline: ancient, Middle Ages, Renaissance, moral treatment, the 20th century.', 'Match the person to the movement: Pinel and Tuke with moral treatment, Dix with state hospitals, Weyer with the sick-mind argument.', 'Ask whether the explanation is physical (somatogenic) or psychological (psychogenic).'],
    models: ['Ask what the model says causes the problem: the brain, the unconscious, learning and thoughts, blocked growth, or society.', 'Look for the model’s signature words: transference (psychodynamic), reinforcement (behavioral), unconditional positive regard (humanistic).', 'If both a vulnerability and a trigger are mentioned, think diathesis–stress.'],
    assessment: ['Reliability is about consistency; validity is about measuring the right thing.', 'Name what is being compared: the same test twice (test-retest), two raters (interrater), or a later outcome (predictive).', 'Projective tests interpret ambiguous stimuli; inventories use standardized questions.'],
    anxiety: ['Identify the core fear: everything (GAD), an object (phobia), judgment (social), the attacks themselves (panic), or escape (agoraphobia).', 'Check the duration: 6 months for most, 1 month of concern for panic disorder.', 'For treatment, think exposure in some form.'],
    trauma: ['Was the event a qualifying trauma (death, serious injury, sexual violence)?', 'Convert the time since the event: 3 days to 1 month is acute stress disorder, over 1 month is PTSD.', 'Ordinary stressors lead to adjustment disorder, not PTSD.'],
    depression: ['Count symptoms and make sure one is depressed mood or loss of interest.', 'Check the time: 2 weeks for a major depressive episode, 2 years for persistent depressive disorder.', 'Match theories to names: Beck (triad), Seligman (helplessness), Lewinsohn (rewards).'],
    bipolar: ['Classify each episode as manic, hypomanic or depressive.', 'Mania: 1 week or hospitalization, marked impairment. Hypomania: 4 days, no marked impairment.', 'Any mania means bipolar I; hypomania plus major depression means bipolar II.'],
    suicide: ['Decide whether the question uses Shneidman’s types (intent) or Durkheim’s (social ties).', 'Durkheim: few ties is egoistic, sacrifice is altruistic, sudden change is anomic.', 'Shneidman: seekers, initiators, ignorers, darers.'],
    somatic: ['Is the symptom produced on purpose?', 'If faked: is there an external reward (malingering) or not (factitious)?', 'If not faked: is it a neurological-seeming symptom (conversion) or worry about illness (illness anxiety)?'],
    eating: ['Is weight significantly low? That points to anorexia.', 'If not, is there regular compensation (bulimia) or not (binge-eating disorder)?', 'For severity, compute BMI = kg ÷ m² and use 17, 16 and 15.'],
    substance: ['Count the criteria present in the past 12 months.', 'Severity: 2–3 mild, 4–5 moderate, 6+ severe.', 'For drugs, ask: depressant, stimulant, opioid, hallucinogen or cannabis? Then which neurotransmitter?'],
    technology: ['Ask what kind of study it was: correlational or experimental.', 'Think of a third variable that could explain both measures.', 'Only random assignment supports a causal claim.'],
    sexual: ['Place the problem in a phase: desire, excitement, orgasm or pain.', 'For paraphilias, ask whether there is distress, impairment or harm to others.', 'Gender dysphoria centers on distress, not identity.'],
    schizophrenia: ['Sort the symptom: added (positive), missing (negative) or movement (psychomotor).', 'Use the duration ladder: under 1 month, 1–6 months, 6+ months.', 'For causes, think dopamine, genes, brain structure and expressed emotion (relapse).'],
    'psychosis-tx': ['First generation: blocks D2, movement side effects. Second generation: metabolic side effects.', 'Clozapine means blood monitoring.', 'Relapse is lowered by family psychoeducation and community care.'],
    narcissism: ['Separate the trait from the disorder.', 'Grandiose is bold; vulnerable is defensive and hurt.', 'NPD is Cluster B and needs 5 of 9 features.'],
    personality: ['Decide the cluster first: odd (A), dramatic (B) or anxious (C).', 'Then find the signature feature (distrust, detachment, oddness, remorselessness, instability, attention, grandiosity, rejection fear, dependence, perfectionism).', 'Remember the age rule for antisocial personality disorder.'],
    childhood: ['Check the counted rules: symptom number, age of onset, duration, settings.', 'ADHD: 6 symptoms (5 at 17+), before 12, 6 months, 2+ settings.', 'Separate ODD (defiance) from conduct disorder (violating rights).']
  };
})(window);
