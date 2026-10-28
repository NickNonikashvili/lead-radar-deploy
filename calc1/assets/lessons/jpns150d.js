/* JPNS 150D Japanese Culture and Literature: a lesson for every topic, laid over its notes (app.js, mergeLessons) */
(window.MathubLessons = window.MathubLessons || {}).jpns150d = {
  intro: {
    plain: 'Japan is a chain of islands close enough to Korea and China to borrow writing, religion and government from them, and far enough away to choose what to keep and reshape. That pattern of borrowing and adapting runs through the whole course. The Kojiki (712), Japan\'s oldest surviving book, mixes myth and history to give the ruling family a divine origin.',
    figure: { type: 'table', head: ['period', 'dates', 'in this course'], rows: [['Heian', '794–1185', 'Genji, The Pillow Book'], ['Kamakura–Muromachi', '1185–1573', 'Heike, Hōjōki, Kenkō, Noh'], ['Tokugawa (Edo)', '1603–1868', 'Saikaku, Chikamatsu, Bashō'], ['Meiji–Taishō', '1868–1926', 'Sōseki, Kajii, Tanizaki'], ['Shōwa onward', '1926–', 'war, occupation, Banana, anime']], caption: 'The course runs roughly in time order.' },
    check: [
      ['Why would an eighth-century court compile the Kojiki?', 'To give the ruling family a divine origin and so legitimise its rule.'],
      ['Name the four main islands.', 'Honshū, Hokkaidō, Kyūshū, Shikoku.'],
      ['What pattern does Japan\'s geography encourage?', 'Borrowing from the mainland and adapting it selectively.']
    ]
  },
  origins: {
    plain: 'Two stories explain where Japan came from: the myths of the Kojiki, where the islands are born from gods, and the archaeology of real prehistoric cultures. Archaeology shows hunter-gatherers making very early pottery (Jōmon), then rice farmers with metal tools (Yayoi), then powerful chiefs buried in huge keyhole-shaped tombs (Kofun).',
    figure: { type: 'table', head: ['period', 'dates', 'key evidence'], rows: [['Jōmon', 'c. 14,000–300 BCE', 'cord-marked pottery, hunter-gatherers'], ['Yayoi', 'c. 300 BCE–250 CE', 'wet-rice farming, bronze and iron'], ['Kofun', 'c. 250–538 CE', 'keyhole tombs, haniwa figures']], caption: 'What the ground tells us.' },
    check: [
      ['What do the Kofun mounds show that the Kojiki does not?', 'Real, datable concentrations of power and wealth among early rulers.'],
      ['What arrived with the Yayoi?', 'Wet-rice farming and metal tools.'],
      ['Why is Jōmon pottery famous?', 'It is among the oldest pottery in the world.']
    ]
  },
  religions: {
    plain: 'Three traditions blend in Japanese life rather than competing. Shinto honours the kami, spirits of places, nature and ancestors, and values purity. Buddhism, from the mainland, teaches that everything is impermanent and that attachment causes suffering. Confucianism shapes ideas of social order, loyalty and duty. People often draw on all three for different parts of life.',
    figure: { type: 'table', head: ['tradition', 'core idea', 'look for in the readings'], rows: [['Shinto', 'kami; purity and pollution', 'shrines, rituals, nature'], ['Buddhism', 'impermanence; letting go of attachment', 'mono no aware, recluses'], ['Confucianism', 'social roles, loyalty, duty', 'giri, family obligations']], caption: 'Three traditions, often side by side.' },
    check: [
      ['How does Buddhist impermanence show up in literature?', 'As mono no aware: a gentle sadness at the passing of things.'],
      ['What removes pollution (kegare) in Shinto?', 'Purification rituals (harae).'],
      ['Which tradition stresses duty within social roles?', 'Confucianism.']
    ]
  },
  genji: {
    plain: 'The Tale of Genji, written by the court lady Murasaki Shikibu around 1000, is often called the world\'s first novel. It follows the "shining" Prince Genji through his loves and losses. Its key mood is mono no aware: a sensitivity to the beauty of things precisely because they do not last.',
    figure: { type: 'flow', steps: ['Something beautiful: a flower, a lover, a season', 'Awareness that it will fade', 'A gentle, poignant sadness', 'Mono no aware'], caption: 'The emotional logic of Genji.' },
    check: [
      ['How does the "Yūgao" chapter show mono no aware?', 'Yūgao, like the evening-faces flower she is named for, is lovely and short-lived; her sudden death makes the beauty poignant.'],
      ['Who wrote Genji, and in what role?', 'Murasaki Shikibu, a lady-in-waiting to Empress Shōshi.'],
      ['Why is it called the first novel?', 'It is a long prose narrative with developed characters and psychology.']
    ]
  },
  pillow: {
    plain: 'The Pillow Book, by Sei Shōnagon, a lady at a rival court to Murasaki\'s, is a zuihitsu: "following the brush", a mix of lists, sketches and opinions. Its mood is bright, witty and sharp, the opposite of Genji\'s melancholy. Her lists ("Things that make one\'s heart beat faster") show a writer who notices everything and judges with flair.',
    figure: { type: 'table', head: ['', 'The Tale of Genji', 'The Pillow Book'], rows: [['form', 'long narrative', 'zuihitsu: lists, sketches, essays'], ['mood', 'melancholy, mono no aware', 'witty, bright (okashi)'], ['author\'s court', 'Empress Shōshi', 'Empress Teishi']], caption: 'Two court ladies, two very different books.' },
    check: [
      ['What is a zuihitsu?', 'A "following the brush" miscellany of essays, lists and observations.'],
      ['Compare the moods of Genji and The Pillow Book.', 'Genji is melancholy; The Pillow Book is witty and delighted.'],
      ['What aesthetic word fits Sei Shōnagon\'s style?', 'Okashi: charming, delightful, amusing.']
    ]
  },
  samurai: {
    plain: 'As the court in Kyoto grew weak, warrior families in the provinces grew strong. Two clans fought for control: the Taira and the Minamoto. The Minamoto won in 1185 and set up a military government in Kamakura led by a shogun. For the next 700 years, warriors, not the emperor, would hold real power.',
    figure: { type: 'flow', steps: ['Court relies on provincial warriors', 'Taira rise to power at court', 'Genpei War (1180–85)', 'Minamoto victory at Dan-no-ura, 1185', 'Kamakura shogunate'], caption: 'From court rule to warrior rule.' },
    check: [
      ['Why is 1185 a turning point?', 'The Minamoto defeated the Taira and set up the first shogunate: warriors took real power.'],
      ['Which two clans fought the Genpei War?', 'The Taira (Heike) and the Minamoto (Genji).'],
      ['Where was the first shogunate based?', 'Kamakura.']
    ]
  },
  heike: {
    plain: 'The Tales of the Heike retells the fall of the Taira, chanted for generations by blind monks with a lute. Its famous opening sets the theme: the proud do not last, all things pass. Battle scenes become Buddhist lessons, like the warrior Kumagai, who kills a young noble his son\'s age and gives up the warrior life to become a monk.',
    figure: { type: 'flow', steps: ['Kumagai captures the young Atsumori', 'Atsumori is his son\'s age', 'He must kill him anyway', 'He finds Atsumori\'s flute: a refined youth', 'Kumagai becomes a monk'], caption: 'Warfare turned into a lesson about impermanence.' },
    check: [
      ['Why does Kumagai become a monk?', 'Killing a refined youth like his own son shows him the cruelty and emptiness of the warrior life.'],
      ['Who spread the Heike?', 'Blind monks (biwa hōshi) chanting to the lute.'],
      ['What is the opening\'s message?', 'The proud do not endure; everything is impermanent.']
    ]
  },
  hojoki: {
    plain: 'In the Hōjōki (1212), Kamo no Chōmei describes the disasters of his age (fire, whirlwind, famine, earthquake) and his retreat to a tiny hut in the hills. It opens with a river that never stops flowing yet is never the same water: life and cities are like that. The question is whether his peace in the hut is true detachment or a new attachment.',
    figure: { type: 'flow', steps: ['The river: always flowing, never the same water', 'Disasters show cities and fortunes do not last', 'Chōmei shrinks his life to a 10-foot hut', 'Peace, but he loves the hut', 'Is that attachment too?'], caption: 'The arc of the Hōjōki.' },
    check: [
      ['Does Chōmei transcend the chaos of his age?', 'Partly: the hut frees him from the city, but he admits his love for the hut is itself an attachment.'],
      ['What does the opening river image stand for?', 'Impermanence: things seem constant but are always changing.'],
      ['What kind of figure is Chōmei?', 'A recluse poet who withdrew from the world.']
    ]
  },
  kenko: {
    plain: 'Yoshida Kenkō\'s Essays in Idleness (about 1330) is a loose collection of thoughts written "to pass the idle hours". A Buddhist priest who stayed close to court life, he praises the beauty of things that are imperfect, unfinished or fading: the moon behind clouds, cherry blossoms after they fall.',
    figure: { type: 'table', head: ['Kenkō prefers', 'over'], rows: [['the moon behind clouds', 'the full, clear moon'], ['blossoms about to fall', 'blossoms at their peak'], ['the unfinished, irregular', 'the complete, symmetrical'], ['a well-worn object', 'a brand-new one']], caption: 'Beauty in impermanence and imperfection.' },
    check: [
      ['Why is Kenkō called a "worldly ascetic"?', 'He took Buddhist vows and preaches detachment but stays deeply interested in court taste and manners.'],
      ['What form is Essays in Idleness?', 'A zuihitsu.'],
      ['Why does Kenkō value things that fade?', 'Impermanence makes them precious and moving.']
    ]
  },
  noh: {
    plain: 'Noh is a slow, stylised theatre of masks, chant and dance, shaped by Kan\'ami and his son Zeami in the 1300s. Its ideal is yūgen: a deep, mysterious beauty that hints rather than shows. Many plays bring back the ghost of a figure from old tales, who relives their pain and seeks release through Buddhist prayer.',
    figure: { type: 'flow', steps: ['A traveling monk arrives at a famous place', 'A local person tells its story', 'They reveal they are the ghost of that story', 'The ghost relives its past in dance', 'The monk\'s prayers bring release'], caption: 'The shape of a "dream" (mugen) Noh play.' },
    check: [
      ['How does the Noh Atsumori change the Heike\'s story?', 'It tells it from Atsumori\'s ghost\'s side and ends in reconciliation with his killer, now a monk.'],
      ['What is yūgen?', 'A subtle, mysterious, profound beauty.'],
      ['Who were Kan\'ami and Zeami?', 'The father and son who shaped Noh; Zeami also wrote treatises on acting.']
    ]
  },
  tokugawa: {
    plain: 'After a century of civil war, three warlords unified Japan, and Tokugawa Ieyasu founded a shogunate in Edo (Tokyo) in 1603 that kept the peace for 250 years. It did so through control: lords had to spend alternate years in Edo, society was fixed in classes, and contact with the outside world was tightly limited.',
    figure: { type: 'table', head: ['tool of control', 'how it worked'], rows: [['alternate attendance', 'daimyo lived every other year in Edo; families stayed as hostages'], ['class system', 'samurai, farmers, artisans, merchants'], ['seclusion', 'foreign trade limited to Nagasaki'], ['ban on Christianity', 'removed a foreign loyalty']], caption: 'How the Tokugawa kept the peace.' },
    check: [
      ['How did the Tokugawa keep the peace for 250 years?', 'By binding the daimyo through alternate attendance, fixing social classes and limiting foreign contact.'],
      ['Name the three unifiers.', 'Oda Nobunaga, Toyotomi Hideyoshi and Tokugawa Ieyasu.'],
      ['Which battle in 1600 decided the Tokugawa victory?', 'Sekigahara.']
    ]
  },
  saikaku: {
    plain: 'Peace made the cities rich, and the merchants (chōnin), officially the lowest class, created a lively culture of theatres and pleasure quarters: the "floating world". Ihara Saikaku wrote witty stories about them, about love and money. His merchants are admired when they get rich through thrift and cleverness, and mocked when they waste it.',
    figure: { type: 'table', head: ['', 'samurai ideal', 'chōnin ethos (Saikaku)'], rows: [['value', 'loyalty, honour', 'thrift, cleverness, profit'], ['money', 'beneath notice', 'honourable if well earned'], ['world', 'duty', 'the floating world of pleasure']], caption: 'Townspeople with their own values.' },
    check: [
      ['What is the chōnin ethos in Saikaku?', 'Money is honourable when earned through thrift and wit; waste and pretension are foolish.'],
      ['What was the "floating world"?', 'The urban world of pleasure quarters, theatre and fashion.'],
      ['Where were merchants in the official class order?', 'At the bottom.']
    ]
  },
  chikamatsu: {
    plain: 'Chikamatsu wrote plays for bunraku, a puppet theatre where each large puppet is worked by three visible puppeteers while one chanter voices every part. His domestic dramas pit giri (social duty) against ninjō (human feeling). When the two cannot be reconciled, lovers choose to die together.',
    figure: { type: 'table', head: ['giri (duty)', 'ninjō (feeling)'], rows: [['obligations to family and employer', 'love for Ohatsu'], ['reputation and honour', 'loyalty to each other'], ['debts and promises', 'desire to be together']], caption: 'In The Love Suicides at Sonezaki, the two cannot be reconciled.' },
    check: [
      ['Explain giri and ninjō in Sonezaki.', 'Giri: Tokubei\'s duties and honour; ninjō: his love for Ohatsu. Trapped between them, they choose death together.'],
      ['How many puppeteers work a main bunraku puppet?', 'Three.'],
      ['Who voices all the characters?', 'One chanter (tayū), with a shamisen player.']
    ]
  },
  basho: {
    plain: 'Bashō turned a playful game of linked verse into serious art. The opening verse, 5-7-5 syllables, became the haiku. A good haiku sets two images side by side, often divided by a "cutting word", and includes a season word; the meaning sparks in the gap between them.',
    figure: { type: 'table', head: ['line', 'Japanese', 'English'], rows: [['5', 'furuike ya', 'the old pond —'], ['7', 'kawazu tobikomu', 'a frog jumps in'], ['5', 'mizu no oto', 'the sound of water']], caption: 'Stillness, then a splash: the cut (ya) sets the two images side by side.' },
    check: [
      ['How does the "old pond" haiku work?', 'The cut after "old pond" sets timeless stillness against a sudden sound; the meaning lives in the contrast.'],
      ['What is a kigo?', 'A season word.'],
      ['What did the haiku start as?', 'The opening verse (hokku) of linked verse.']
    ]
  },
  bakumatsu: {
    plain: 'Bakumatsu, "the end of the shogunate", covers 1853 to 1868. American warships under Commodore Perry forced Japan to open its ports, and the shogun\'s failure to keep the foreigners out destroyed his authority. Rebel domains rallied around the emperor, and in 1868 the shogunate fell.',
    figure: { type: 'flow', steps: ['1853: Perry\'s black ships arrive', '1854: treaty opens ports', 'Unequal treaties anger samurai', '"Revere the emperor, expel the barbarians"', '1868: shogunate falls, Meiji Restoration'], caption: 'Fifteen years that ended 250 years of rule.' },
    check: [
      ['Why did Perry\'s arrival undermine the shogunate?', 'The shogun\'s main claim was keeping Japan safe; giving in to foreign demands showed he could not.'],
      ['What made the treaties "unequal"?', 'Fixed low tariffs and foreigners tried under their own laws (extraterritoriality).'],
      ['Which domains led the opposition?', 'Satsuma and Chōshū.']
    ]
  },
  meiji: {
    plain: 'The Meiji Restoration (1868) claimed to restore the emperor, but in practice a group of young samurai remade the country within a generation: abolishing the samurai class, building railways, schools, a conscript army and a constitution. The goal was to become strong enough to stand as an equal to the Western powers.',
    figure: { type: 'table', head: ['change', 'year'], rows: [['domains abolished, prefectures created', '1871'], ['national schools, conscription', '1872–73'], ['samurai stipends ended', '1876'], ['constitution', '1889'], ['unequal treaties revised', '1899–1911']], caption: 'A revolution from above.' },
    check: [
      ['Why call Meiji a revolution rather than a restoration?', 'It claimed to restore the emperor, but it overturned the whole social and political order.'],
      ['What was the aim of "rich country, strong army"?', 'To modernise fast enough to resist Western domination.'],
      ['Where did the capital move?', 'To Edo, renamed Tokyo.']
    ]
  },
  soseki: {
    plain: 'Natsume Sōseki is the great novelist of Meiji Japan, writing about the loneliness of modern individuals caught between old obligations and new desires. In And Then, Daisuke lives comfortably on his father\'s money, avoiding work and marriage, until he finally acts on his love for his friend\'s wife, and loses everything.',
    figure: { type: 'flow', steps: ['Daisuke lives idly on family money', 'He gave up Michiyo to his friend years ago', 'He decides to act on his feelings', 'Family cuts him off', 'He must face the world alone'], caption: 'And Then: choosing yourself in Meiji Japan.' },
    check: [
      ['Is Daisuke\'s choice a triumph or a disaster?', 'Both: he finally acts on his own feelings, but it costs him his family, money and security.'],
      ['Where did Sōseki study abroad?', 'London (1900–02).'],
      ['What tension runs through Sōseki\'s novels?', 'The individual\'s desires against family and social obligation.']
    ]
  },
  taisho: {
    plain: 'The Taishō years (1912–1926) were Japan\'s jazz age: party politics, cafés, cinema, department stores and the "modern girl". Writers turned inward, toward mood and sensation. In Kajii Motojirō\'s story "Lemon", a depressed young man finds brief joy in a single lemon and leaves it like a bomb on a pile of art books.',
    figure: { type: 'flow', steps: ['A heavy, shapeless gloom', 'He buys one lemon', 'Its color, coolness and scent lift him', 'He stacks art books in Maruzen', 'Leaves the lemon on top like a bomb'], caption: 'The mood arc of "Lemon".' },
    check: [
      ['What does the lemon mean in Kajii\'s story?', 'Pure sensation and vitality against gloom; his imagined "bomb" is a small rebellion against the weight of culture.'],
      ['What was the "modern girl" (moga)?', 'A young urban woman in Western fashion, a symbol of Taishō modernity.'],
      ['What disaster struck Tokyo in 1923?', 'The Great Kantō Earthquake.']
    ]
  },
  tanizaki: {
    plain: 'In Praise of Shadows (1933) argues that Japanese beauty lives in dimness: lacquer glowing in candlelight, dark wood, shadowed rooms. Electric light, Tanizaki says, washes it away. It is both a beautiful essay on aesthetics and a nostalgic, sometimes reactionary, defence of a "Japan" set against the West.',
    figure: { type: 'table', head: ['shadows (Japan, in the essay)', 'light (the West, in the essay)'], rows: [['lacquer by candlelight', 'shining porcelain under bulbs'], ['dim, deep rooms', 'bright, white rooms'], ['patina, age', 'newness, cleanliness']], caption: 'Tanizaki\'s contrast, which the essay itself half admits is a fantasy.' },
    check: [
      ['Is In Praise of Shadows reactionary?', 'In part: it idealises the past and essentialises "Japanese" versus "Western", but it is also playful and self-aware.'],
      ['What does Tanizaki say electric light destroys?', 'The beauty of shadow, depth and patina.'],
      ['How did Tanizaki\'s own taste change over his career?', 'From admiring the West (Naomi) to celebrating Japanese tradition.']
    ]
  },
  ww2: {
    plain: 'From 1931 Japan expanded into Manchuria and China, then across Asia and the Pacific, causing immense suffering, from the Nanjing Massacre to forced labour. It also suffered firebombing, the atomic bombs and defeat. The course asks how a nation remembers being both victimiser and victim.',
    figure: { type: 'table', head: ['year', 'event'], rows: [['1931', 'Manchurian Incident'], ['1937', 'war with China; Nanjing Massacre'], ['1941', 'Pearl Harbor; Pacific War'], ['1945', 'firebombing, Hiroshima and Nagasaki, surrender']], caption: 'Fifteen years of war.' },
    check: [
      ['Why title the lectures "Victimizers?" and "Victims?"', 'Japan was both, and memory often stresses one side.'],
      ['What happened at Nanjing in 1937?', 'Japanese troops massacred civilians and prisoners after taking the city.'],
      ['When did Japan surrender?', 'August 1945.']
    ]
  },
  hiroshima: {
    plain: 'Japan\'s war memory often centres on its own civilian suffering. Grave of the Fireflies follows two orphaned children starving after the firebombing of Kobe; it is devastating and also says little about why the war happened. The Smithsonian\'s Enola Gay controversy in the US showed that how a bombing is remembered is fought over in both countries.',
    figure: { type: 'flow', steps: ['A film or exhibit chooses what to show', 'It shapes how a nation remembers', 'Pathos for victims can hide causes', 'Debates break out (Enola Gay, 1995)', 'Memory is political'], caption: 'War memory as a contested story.' },
    check: [
      ['How do Grave of the Fireflies and the Enola Gay controversy both concern memory?', 'Both show how a nation chooses what to remember about the war and who it remembers as victims.'],
      ['Who directed Grave of the Fireflies?', 'Takahata Isao (Studio Ghibli).'],
      ['What is the risk of a purely victim-centred memory?', 'It can leave out the causes and the suffering inflicted on others.']
    ]
  },
  occupation: {
    plain: 'From 1945 to 1952, the Allied Occupation under General MacArthur set out to demilitarise and democratise Japan. A new constitution renounced war, gave women the vote and made the emperor a symbol rather than a god. Many old institutions and people survived, though, so the period is a mix of sharp change and quiet continuity.',
    figure: { type: 'table', head: ['changed', 'continued'], rows: [['new constitution; Article 9 renounces war', 'the emperor kept his throne'], ['women\'s suffrage', 'the bureaucracy'], ['land reform', 'many wartime leaders returned'], ['labour unions', 'big business groups re-formed']], caption: 'Change and continuity under the Occupation.' },
    check: [
      ['What changed and what continued under the Occupation?', 'Changed: the constitution, Article 9, women\'s vote, land reform. Continued: the emperor, the bureaucracy, many elites.'],
      ['What does Article 9 say?', 'Japan renounces war as a sovereign right.'],
      ['Who led the Occupation?', 'General Douglas MacArthur (SCAP).']
    ]
  },
  hijiki: {
    plain: 'In Nosaka Akiyuki\'s "American Hijiki", a middle-aged man hosting an American couple relives his starving boyhood after the war, when he mistook American black tea in a care package for hijiki seaweed and boiled it. His mix of resentment, admiration and shame toward America is both funny and painful.',
    figure: { type: 'flow', steps: ['1945: starving boy receives American aid', 'Boils black tea, thinking it is hijiki', 'Decades later: hosts an American couple', 'Overdoes the hospitality', 'Old humiliation and admiration resurface'], caption: 'Past and present collide.' },
    check: [
      ['What does the "American hijiki" stand for?', 'Foreign aid misunderstood: the hungry boy\'s confused gratitude and humiliation.'],
      ['Why does the narrator overdo the hospitality?', 'Lingering feelings of defeat and inferiority toward Americans.'],
      ['What else did Nosaka write?', '"A Grave of Fireflies".']
    ]
  },
  familygame: {
    plain: 'The Family Game (1983) satirises a middle-class family in a Tokyo apartment, obsessed with exam success. A strange, aggressive tutor is hired for the younger son and gradually exposes the family\'s emptiness. The famous dinner shot seats everyone in one row, all facing the camera, eating without looking at each other.',
    figure: { type: 'figure', shapes: [{ kind: 'rect', at: [0, 0], w: 10, h: 1, text: 'one long table' }, { kind: 'point', at: [1.5, 1.6], label: 'father' }, { kind: 'point', at: [3.5, 1.6], label: 'mother' }, { kind: 'point', at: [5.5, 1.6], label: 'son' }, { kind: 'point', at: [7.5, 1.6], label: 'son' }, { kind: 'point', at: [9, 1.6], label: 'tutor' }, { kind: 'text', at: [5, -1], text: 'camera: everyone faces us, no one faces each other' }], caption: 'The dinner table as a portrait of a family that does not talk.' },
    check: [
      ['What does the dinner-table shot say about the family?', 'They sit side by side like strangers at a counter: together, but not connected.'],
      ['What does the family want from the tutor?', 'Exam success for the son.'],
      ['What is the film satirising?', 'The middle-class obsession with education and status, and the hollowness of family life.']
    ]
  },
  kitchen: {
    plain: 'Yoshimoto Banana\'s Kitchen (1988) was a huge bestseller in the bubble years. Mikage, alone after her grandmother dies, can only sleep in kitchens, and finds a new kind of family with Yūichi and his transgender mother Eriko. Its simple, intimate voice and its comfort in food and everyday things spoke to young readers.',
    figure: { type: 'flow', steps: ['Grief: Mikage loses her last relative', 'Comfort in the hum of a kitchen', 'A chosen family: Yūichi and Eriko', 'New loss', 'Healing through cooking and sharing food'], caption: 'Grief and healing in Kitchen.' },
    check: [
      ['Why are kitchens central in Kitchen?', 'They are warm, practical places where food and care make life go on after loss.'],
      ['What kind of family does Mikage find?', 'A chosen, unconventional one.'],
      ['What was "Banana mania"?', 'The huge popularity of Yoshimoto\'s books in the late 1980s.']
    ]
  },
  anime: {
    plain: 'Susan Napier argues anime deserves serious study because it explores big questions about identity, the body, technology and apocalypse. In Akira, Tetsuo\'s body swells out of control as his power grows. In Ghost in the Shell, Major Kusanagi\'s body is a machine, and she wonders whether her "ghost" (self) is real.',
    figure: { type: 'table', head: ['', 'Akira (1988)', 'Ghost in the Shell (1995)'], rows: [['body', 'grotesque, swelling, out of control', 'sleek, manufactured, replaceable'], ['fear', 'power destroying the self', 'losing what makes a self'], ['setting', 'Neo-Tokyo after a new war', 'networked future city']], caption: 'Two bodies, two fears about technology.' },
    check: [
      ['Compare the bodies in Akira and Ghost in the Shell.', 'Akira\'s body is monstrous and uncontrollable; Ghost\'s is a perfect machine that raises questions about the self.'],
      ['What is the "ghost" in Ghost in the Shell?', 'The self or soul inside a cyborg body.'],
      ['Why study anime seriously, per Napier?', 'It reaches global audiences and explores identity, technology and apocalypse.']
    ]
  },
  thief: {
    plain: 'After Japan\'s bubble economy burst around 1990, the "lost decades" brought insecure jobs and anxiety. Nakamura Fuminori\'s The Thief follows a skilled Tokyo pickpocket drawn into a crime run by Kizaki, a man who controls other people\'s lives like a god. The novel asks whether anyone is free in a system that is rigged.',
    figure: { type: 'flow', steps: ['A lone pickpocket in Tokyo', 'Drawn into Kizaki\'s robbery', 'Kizaki controls every move', 'The thief helps a boy as a small act of freedom', 'Ending: a coin tossed into the air'], caption: 'Control and resistance in The Thief.' },
    check: [
      ['What does Kizaki represent?', 'Total control: a power that plans other people\'s lives and deaths.'],
      ['What happened to Japan\'s economy around 1990?', 'The bubble burst, leading to the "lost decade(s)".'],
      ['What other shocks hit Japan in 1995?', 'The Kobe earthquake and the Aum Shinrikyō sarin attack.']
    ]
  },
  murata: {
    plain: 'Murata Sayaka writes about people who do not fit what society calls normal, most famously in Convenience Store Woman. In "Eating the City", a young woman who grew up in the countryside starts foraging wild plants in Tokyo, finding a strange, private relationship with the city. It is a fitting close: a modern echo of the course\'s recluses and outsiders.',
    figure: { type: 'table', head: ['outsider', 'withdraws to'], rows: [['Kamo no Chōmei', 'a 10-foot hut'], ['Yoshida Kenkō', 'idle writing at court\'s edge'], ['Mikage (Kitchen)', 'kitchens'], ['Murata\'s narrator', 'wild plants in the city']], caption: 'Outsiders across the centuries.' },
    check: [
      ['How might "Eating the City" connect to earlier readings?', 'Like Chōmei\'s hut or Kenkō\'s idleness, it finds a private, unconventional way to live apart within society.'],
      ['What is Murata\'s best-known novel?', 'Convenience Store Woman.'],
      ['What theme runs through Murata\'s fiction?', 'Questioning what society counts as normal.']
    ]
  }
};
