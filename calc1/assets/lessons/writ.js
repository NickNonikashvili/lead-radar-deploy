/* WRIT 101 College Writing I: a lesson for each week, laid over its notes (app.js, mergeLessons).
   The notes are a schedule; the lessons teach the writing skill that week practises. */
(window.MathubLessons = window.MathubLessons || {}).writ = {
  w1: {
    plain: 'This course treats writing as something you get better at by doing it often, not by waiting for inspiration. The writer\'s notebook is where that practice happens: short, low-stakes entries where you notice things, try ideas and write badly on purpose. Many of your project ideas will start as a line in the notebook.',
    figure: { type: 'flow', steps: ['Notice something (outside, in a reading, in class)', 'Write fast for 10 minutes: no editing', 'Underline one line worth keeping', 'Turn it into a question or idea for a project'], caption: 'A notebook entry, start to finish.' },
    check: [
      ['What is the notebook for?', 'Low-stakes, frequent practice and collecting ideas, not polished writing.'],
      ['How many notebook entries are due by the end?', 'All 15.'],
      ['What should a letter to your instructor tell them?', 'Who you are as a writer: your experience, habits, hopes and worries.']
    ],
    addExamples: [{ p: 'Turn this notebook line into a project question: "The trail by the dorm is always packed at 4 pm."', s: 'Ask why and for whom: "Why do so many students use the trail at the same time, and what does that say about how campus schedules shape our free time?" A good question is specific and has more than one possible answer.' }]
  },
  w2: {
    plain: 'Every piece of writing belongs to a genre: a type of text with habits readers expect, like a recipe, a profile or an op-ed. Before you write in a genre, read examples like a detective: what do they all do, in what order, in what voice, at what length? Brainstorming widely first gives you better topics than grabbing the first idea.',
    figure: { type: 'table', head: ['ask of each example', 'what you learn'], rows: [['Who is it for?', 'audience'], ['Where does it appear?', 'venue'], ['How does it open and close?', 'structure'], ['How formal is it? First person?', 'voice'], ['What does it include every time?', 'genre conventions']], caption: 'A quick genre analysis.' },
    check: [
      ['What is a genre?', 'A type of writing with conventions readers expect.'],
      ['Why analyse examples before drafting?', 'To learn the moves readers expect so you can use (or break) them on purpose.'],
      ['Name two brainstorming methods.', 'Freewriting, listing, clustering/mind maps, questioning (any two).']
    ],
    addExamples: [{ p: 'You read three profiles of local businesses. What conventions might they share?', s: 'They open with a scene or a person, quote the owner, give a short history, describe the place with sensory detail and end with a look ahead. Those shared moves are the genre\'s conventions.' }]
  },
  w3: {
    plain: 'A first draft only has to exist. Get the whole shape down, then let readers help. In peer review, the most useful comments describe how the draft reads ("I got lost here", "this paragraph convinced me") rather than just "good job". Give the kind of feedback you would want: specific, kind and about the big picture first.',
    figure: { type: 'table', head: ['less useful', 'more useful'], rows: [['"Good job!"', '"Your opening scene made me want to keep reading."'], ['"Fix grammar."', '"Paragraph 3 has three ideas; which is the main one?"'], ['"Confusing."', '"I lost track of who \'she\' is in paragraph 2."']], caption: 'Describe what happened to you as a reader.' },
    check: [
      ['What should a first draft do?', 'Get the whole piece down; polish comes later.'],
      ['What makes a peer comment useful?', 'It is specific and describes the reader\'s experience.'],
      ['In peer review, what comes first: commas or structure?', 'Structure and ideas (global issues) first.']
    ]
  },
  w4: {
    plain: 'Revision means re-seeing the whole piece, not just fixing typos. Start with global questions: is the purpose clear, is anything missing, is the order right? Only then move to paragraphs, then sentences, then proofreading. The reflection afterwards asks what you changed and why, which is how you learn to revise next time.',
    figure: { type: 'flow', steps: ['Global: purpose, audience, focus', 'Structure: order, sections, transitions', 'Paragraphs: one idea each, with support', 'Sentences: clarity, voice, word choice', 'Proofread: spelling, punctuation, format'], caption: 'Revise from big to small.' },
    check: [
      ['What is the difference between revising and editing?', 'Revising changes ideas and structure; editing fixes sentences and errors.'],
      ['Why fix structure before commas?', 'Structural changes may delete those sentences anyway.'],
      ['What should a revision reflection explain?', 'What you changed, why, and what feedback led to it.']
    ]
  },
  w5: {
    plain: 'Research in this course starts with a question you genuinely want answered, not a thesis you already believe. Narrow a broad topic until it is specific enough to investigate. Then use library databases, not just search engines, to find sources, and read them to learn, letting the answer change as you go.',
    figure: { type: 'flow', steps: ['Topic: social media', 'Narrower: social media and sleep', 'Specific: do students who scroll in bed sleep less?', 'Researchable: what do studies of college students show?'], caption: 'Narrowing a topic into a research question.' },
    check: [
      ['What makes a good research question?', 'Specific, open (not yes/no only), and answerable with sources.'],
      ['Why use library databases?', 'They give access to reliable, often peer-reviewed sources.'],
      ['What is "research as inquiry"?', 'Researching to find out, not just to prove what you already think.']
    ],
    addExamples: [{ p: 'Narrow "climate change" into a research question.', s: '"How are Montana ranchers adapting their grazing practices to longer droughts?" It names a place, a group and a specific change, so you can find sources and answer it.' }]
  },
  w6: {
    plain: 'Citing sources shows readers where ideas came from and lets them follow your trail. Different fields use different styles (MLA, APA, Chicago), but all need an in-text marker and a full entry at the end. Every writing choice also depends on the rhetorical situation: who is reading, where it will appear and what you want it to do.',
    figure: { type: 'table', head: ['', 'MLA', 'APA'], rows: [['used in', 'humanities', 'social sciences'], ['in-text', '(Hall 42)', '(Hall, 2023, p. 42)'], ['list at the end', 'Works Cited', 'References'], ['date matters', 'less', 'a lot (near the author)']], caption: 'Two common citation styles.' },
    check: [
      ['Name the parts of the rhetorical situation.', 'Writer, audience, purpose, context/venue (and genre).'],
      ['Do you need to cite a paraphrase?', 'Yes: the idea is still someone else\'s.'],
      ['Write an MLA in-text citation for page 42 of a book by Hall.', '(Hall 42).']
    ]
  },
  w7: {
    plain: 'The research draft weaves sources into your own thinking. Introduce each source (who said it and why they matter), use it, then explain what it means for your question. A quote should never stand alone: sandwich it between your introduction and your analysis.',
    figure: { type: 'flow', steps: ['Introduce: "Sleep researcher Ana Ruiz found…"', 'Quote or paraphrase the evidence (cited)', 'Explain: what this means for your question'], caption: 'The quote sandwich.' },
    check: [
      ['What is a "dropped quote"?', 'A quotation with no introduction or explanation around it.'],
      ['What should come after a quote?', 'Your analysis: why it matters to your question.'],
      ['In peer review of a research draft, what should you check about sources?', 'Whether each is introduced, cited, and connected to the argument.']
    ],
    addExamples: [{ p: 'Fix this dropped quote: "Students sleep 40 minutes less on scroll nights." (Ruiz 12)', s: 'Introduce and explain it: In a study of 300 students, sleep researcher Ana Ruiz found that "students sleep 40 minutes less on scroll nights" (12). That gap adds up to almost five hours a week, which suggests the habit matters more than students think.' }]
  },
  w8: {
    plain: 'A one-on-one conference is your chance to steer your own learning. Come prepared: bring a draft and two or three specific questions, and know your goals for the rest of the term. You get the most out of a conference when you lead it.',
    figure: { type: 'table', head: ['bring', 'example'], rows: [['a draft', 'Project 2, with the spots you are unsure of marked'], ['2–3 questions', '"Is my research question narrow enough?"'], ['a goal', '"I want my conclusions to say more than a summary."']], caption: 'Prepare for a conference in five minutes.' },
    check: [
      ['What is a better conference question than "Is it good?"', 'Something specific, like "Does my second section support my question?"'],
      ['What should you set at mid-term?', 'Goals for Project 3 and the final portfolio.'],
      ['Who should lead the conference?', 'You, the writer.']
    ]
  },
  w9: {
    plain: 'Revising a research project often means rethinking the answer. If your sources taught you something new, let your conclusion change. Check that every claim has support, that the sources talk to each other, and that the citations are complete. Then reflect on how your thinking moved.',
    figure: { type: 'table', head: ['revision question', 'if no'], rows: [['Does the opening state the real question?', 'rewrite the opening'], ['Does each paragraph move the inquiry forward?', 'cut or merge'], ['Is every claim supported?', 'add evidence or soften it'], ['Is every source cited, in text and at the end?', 'fix the citations']], caption: 'A research revision checklist.' },
    check: [
      ['Should your conclusion match your first guess?', 'Only if the evidence supports it; inquiry can change your answer.'],
      ['What does "sources in conversation" mean?', 'Showing how sources agree, disagree or build on each other.'],
      ['What goes in the Project 2 reflection?', 'How your question and thinking changed, and what you revised.']
    ]
  },
  w10: {
    plain: 'Remixing means taking your research and rebuilding it for a public audience in a new genre: a podcast, an infographic, a video, a zine. The ideas stay; almost everything else changes. Academic readers want depth and citations; public readers want a hook, plain language and a reason to care right now.',
    figure: { type: 'table', head: ['', 'academic audience', 'public audience'], rows: [['wants', 'depth, evidence', 'relevance, clarity'], ['tone', 'formal', 'conversational'], ['length', 'long', 'short, skimmable'], ['sources', 'cited in full', 'credited lightly, linked']], caption: 'Same research, different readers.' },
    check: [
      ['What stays the same in a remix?', 'The core ideas and research.'],
      ['Name one change for a public audience.', 'Plainer language, a hook, shorter form, visuals (any one).'],
      ['Why choose the genre carefully?', 'The genre should fit where your audience actually is.']
    ],
    addExamples: [{ p: 'Remix the sleep research for students on campus.', s: 'An Instagram carousel: slide 1 asks "Lost 5 hours of sleep this week?", slides 2–4 give one finding each in big type, slide 5 offers one small change to try tonight, and the caption credits the studies.' }]
  },
  w11: {
    plain: 'Every genre comes with tools: audio editors for podcasts, design apps for infographics, video editors for short films. Learn just enough of the tool to serve your message, and sketch or storyboard before you build. Planning on paper saves hours inside the software.',
    figure: { type: 'flow', steps: ['Pick the genre for your audience', 'Storyboard or outline on paper', 'Learn the tool\'s basics', 'Build a rough version', 'Test it on a real reader'], caption: 'From idea to rough cut.' },
    check: [
      ['Why storyboard before opening the software?', 'It fixes the structure first, so the tool serves the plan.'],
      ['What is a rough cut for?', 'Getting feedback before polishing.'],
      ['How do you choose a tool?', 'By what the genre and audience need, not by what looks impressive.']
    ]
  },
  w12: {
    plain: 'Peer review for multimodal work asks new questions: does the design guide the eye, can you hear every word, does it grab a stranger in the first few seconds? Review it the way its audience would meet it: on a phone, in a hallway, with half your attention.',
    figure: { type: 'table', head: ['ask', 'about'], rows: [['What do I notice first?', 'design, hook'], ['Can I follow it without the writer explaining?', 'clarity'], ['Would I stop scrolling for this?', 'audience fit'], ['Are sources credited?', 'ethics']], caption: 'Reviewing a public remix.' },
    check: [
      ['How should you test a remix?', 'The way its real audience would experience it.'],
      ['What is the first question to ask of a visual piece?', 'What does a viewer notice first?'],
      ['Do remixes still need to credit sources?', 'Yes, in a way that fits the genre.']
    ]
  },
  w13: {
    plain: 'Revising a remix means watching or reading it fresh and cutting whatever does not help the audience. Tighten the opening, check the flow, fix the technical rough spots and credit your sources. The Project 3 reflection explains your choices: why this genre, this audience, these changes.',
    figure: { type: 'flow', steps: ['Watch or read it cold', 'Cut what the audience does not need', 'Strengthen the hook', 'Fix sound, design or format issues', 'Reflect: explain your choices'], caption: 'Revising a remix.' },
    check: [
      ['What is often the most powerful revision of a remix?', 'Cutting.'],
      ['What should the Project 3 reflection explain?', 'Your choices of genre, audience and revisions, and why.'],
      ['Why look at it "cold"?', 'To experience it as a new audience would.']
    ]
  },
  w14: {
    plain: 'The reflective portfolio is your argument about your own growth as a writer, with your work as evidence. Choose pieces that show change, then explain it with specific moments: a revision that worked, a comment that changed your mind. Claims like "I grew a lot" need evidence just like any other claim.',
    figure: { type: 'flow', steps: ['Claim: how you grew as a writer', 'Evidence: specific drafts, revisions, notebook entries', 'Analysis: what each shows and why it matters', 'Looking ahead: what you will keep doing'], caption: 'A reflective portfolio is an argument with you as the subject.' },
    check: [
      ['What counts as evidence in a reflection?', 'Specific passages, revisions and feedback from your own work.'],
      ['Why include an early draft?', 'It shows the change from where you started.'],
      ['What is wrong with "I learned a lot this semester"?', 'It is vague; name what you learned and show where.']
    ],
    addExamples: [{ p: 'Make this reflection sentence specific: "My introductions got better."', s: '"In Project 1 my introduction started with a dictionary definition; by Project 2 I opened with a scene from the trail, which my peer reviewer said made her want to keep reading."' }]
  },
  w15: {
    plain: 'The last week pulls everything together. Get feedback on the portfolio draft, polish its format, and make sure all 15 notebook entries are in. Read the submission instructions twice, and finish the course evaluations: they shape how the course is taught next time.',
    figure: { type: 'table', head: ['before you submit', 'check'], rows: [['portfolio', 'every claim has evidence'], ['format', 'headings, page numbers, citations'], ['notebook', 'all 15 entries'], ['instructions', 'file type, deadline, where to upload']], caption: 'Final checklist.' },
    check: [
      ['How many notebook entries are due?', '15.'],
      ['What should portfolio peer review focus on?', 'Whether the growth claims are supported by evidence.'],
      ['What is the last thing to do before submitting?', 'Reread the submission instructions.']
    ]
  }
};
